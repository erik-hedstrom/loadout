import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CallToolRequestSchema, InitializeRequestSchema, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { createServer, skillFiles, type SearchDeps } from '../src/mcp.js';
import { launchMcp } from '../src/relay.js';
import { validateResponse, type Question } from '../src/jev.js';
import type { Capability, McpServerConfig } from '../src/types.js';

const CANARY = 'E11-CREDENTIAL-CANARY';
const dirs: string[] = [];
const closes: (() => Promise<void>)[] = [];
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'loadout-e11-')); dirs.push(dir); return dir; };
const skill = (source: string, name = 'fixture'): Capability => ({ id: `skill:${name}`, kind: 'skill', name, description: '', source });
const capability = (server: McpServerConfig): Capability => ({ id: 'mcp:fixture', kind: 'mcp', name: 'fixture', description: '', source: '', gateway: true, server });
afterEach(async () => {
  await Promise.all(closes.splice(0).map((close) => close()));
  vi.restoreAllMocks();
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

async function host(deps: Partial<SearchDeps>) {
  const { server, gateway } = createServer({ library: [], config: DEFAULT_CONFIG, ...deps });
  const [front, back] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  closes.push(async () => { await client.close(); await gateway.close(); });
  await Promise.all([server.connect(front), client.connect(back)]);
  return (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
}
const failure = (message: string) => ({ isError: true, content: [{ text: message }] });

describe('E11 diagnostics', () => {
  it.each<[string, McpServerConfig, Response | undefined, string]>([
    ['HTTP', { url: `https://example.invalid/${CANARY}?token=${CANARY}` }, new Response(CANARY, { status: 500 }), 'upstream HTTP 500 from https://example.invalid'],
    ['spawn', { command: process.execPath, args: [`--token=${CANARY}\0`], env: { TOKEN: CANARY } }, undefined, 'transport failed'],
    ['URL', { url: `http://user:${CANARY}@[broken/path?token=${CANARY}` }, undefined, 'transport failed'],
    ['parse', { url: 'https://example.invalid/mcp' }, new Response(`invalid JSON ${CANARY}`, { headers: { 'Content-Type': 'application/json' } }), 'transport failed from https://example.invalid'],
  ])('gateway %s failure keeps fixed text', async (_, config, response, message) => {
    if (response) vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const call = await host({ library: [capability(config)] });
    expect(await call('server_tools', { server: 'fixture' })).toMatchObject(failure(`gateway fixture: ${message}`));
  });

  it.each(['connect', 'listTools', 'callTool', 'missing tool'] as const)('gateway %s failure keeps no upstream text', async (stage) => {
    const call = await host({ library: [capability({ command: 'unused' })] });
    const upstream = new Server({ name: 'fake', version: '0' }, { capabilities: { tools: {} } });
    closes.push(() => upstream.close());
    if (stage === 'connect') upstream.setRequestHandler(InitializeRequestSchema, async () => { throw new McpError(-32603, CANARY); });
    upstream.setRequestHandler(ListToolsRequestSchema, async () => {
      if (stage === 'listTools') throw new McpError(-32603, CANARY);
      return { tools: [{ name: CANARY, inputSchema: { type: 'object' } }] };
    });
    upstream.setRequestHandler(CallToolRequestSchema, async () => { throw new McpError(-32603, CANARY); });
    const [front, back] = InMemoryTransport.createLinkedPair();
    await upstream.connect(front);
    const connect = Client.prototype.connect;
    vi.spyOn(Client.prototype, 'connect').mockImplementationOnce(function (this: Client, _transport, options) { return connect.call(this, back, options); });
    const result = await call(stage === 'callTool' ? 'call_server_tool' : 'server_tools', { server: 'fixture', tool: 'requested' });
    expect(JSON.stringify(result)).not.toContain(CANARY);
    expect(result).toMatchObject(failure(stage === 'missing tool' ? 'fixture has no tool "requested"' : 'gateway fixture: upstream MCP error (-32603)'));
  });

  it('relay retains config errors while sanitizing URL and transport failures', async () => {
    const dir = temp();
    for (const [server, message] of [
      [{ type: 'sse', url: 'https://example.invalid/mcp' }, 'mcp-launch requires Streamable HTTP, not SSE'],
      [{}, 'library MCP server has no command'],
      [{ url: `http://user:${CANARY}@[broken/path` }, 'mcp-launch mcp:fixture: transport failed'],
      [{ url: `https://user:%XX${CANARY}@example.invalid/private` }, 'mcp-launch mcp:fixture: transport failed from https://example.invalid'],
      [{ url: 'https://example.invalid/private', headers: { [`bad header ${CANARY}`]: CANARY } }, 'mcp-launch mcp:fixture: transport failed from https://example.invalid'],
    ] as const) {
      writeFileSync(join(dir, 'mcp.json'), JSON.stringify({ mcpServers: { fixture: server } }));
      await expect(launchMcp('mcp:fixture', dir)).rejects.toThrow(message);
    }
  });

  it('relay config parse failure never echoes config input', async () => {
    const dir = temp();
    writeFileSync(join(dir, 'mcp.json'), `invalid JSON ${CANARY}`);
    await expect(launchMcp('mcp:fixture', dir)).rejects.toThrow(/^could not read library MCP config$/);
  });

  it('load_skill path translation failure never echoes command text', async () => {
    const dir = temp();
    writeFileSync(join(dir, 'SKILL.md'), 'Reference');
    const call = await host({ library: [skill(dir)], toPath: () => { throw new Error(`Command failed: wslpath ${CANARY}`); } });
    expect(await call('load_skill', { skill: 'fixture' })).toMatchObject(failure('could not translate skill path'));
  });

  it('load_skill filesystem failure keeps confined errors without paths', async () => {
    const call = await host({ library: [skill(join(temp(), CANARY)), skill(temp(), 'confined')] });
    for (const [args, message] of [
      [{ skill: 'fixture', file: 'data.txt' }, 'could not read skill file'],
      [{ skill: 'absent' }, 'no skill "absent" in the library; use find_skills to search'],
      [{ skill: 'confined', file: '../outside' }, 'give a path relative to the skill folder'],
      [{ skill: 'confined', file: 'absent' }, 'no such file in the skill: absent'],
    ] as const) expect(await call('load_skill', args)).toMatchObject(failure(message));
  });

  it('skill listing filesystem failure never echoes paths', () => {
    expect(() => skillFiles(join(temp(), CANARY))).toThrow('could not list skill files');
  });

  it.each([
    ['fit_3', undefined], ['fit_3', { type: 'noul', noul: CANARY }], ['fit_3', { type: 'score', probabilities: CANARY }],
    ['fit_3', { type: 'score', probabilities: [] }], ['fit_3', { type: 'score', probabilities: {} }],
    ['fit_3', { type: 'score', probabilities: { [CANARY]: 1 } }], ['fit_3', { type: 'score', probabilities: { 0: CANARY } }],
    ['fit_3', { type: 'score', probabilities: { 0: 0.9, 1: 0.9 } }], ['specific_3', { type: 'noul', noul: CANARY }],
  ] as const)('Jev schema failure identifies %s without response data (%j)', (id, answer) => {
    const q: Question = id === 'fit_3' ? { type: 'score', instructions: 'Rate fit', criteria: ['No', 'Yes'] } : { type: 'noul', instructions: 'Specific?' };
    expect(() => validateResponse({ answers: { [id]: answer } }, { [id]: q })).toThrow(new RegExp(`^Jev response did not match the schema \\(answer ${id}\\)$`));
  });
});
