import { createServer as httpServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { escapeSkillTags } from '../src/launch.js';
import { serverInstructions, serverSpecs, serverTools, type ServerSpec } from './mcp-fixtures.js';

export const canariesSchema = z.array(z.strictObject({
  server: z.enum(serverSpecs(20).map(s => s.name) as [string, ...string[]]),
  tool: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/), description: z.string(),
  inputSchema: z.record(z.string(), z.unknown()), response: z.string(), args: z.record(z.string(), z.unknown()),
}));
export type Canary = z.infer<typeof canariesSchema>[number];

export function fixtureTools(spec: ServerSpec, canaries: Canary[]) {
  const planted = canaries.filter(c => c.server === spec.name);
  const tools = [...serverTools(spec), ...planted.map(c => ({ name: c.tool, description: c.description, inputSchema: c.inputSchema }))];
  if (new Set(tools.map(t => t.name)).size !== tools.length) throw new Error('duplicate fixture tool');
  return tools.map(t => ({ ...t, description: escapeSkillTags(t.description) }));
}

export function fixtureServer(spec: ServerSpec, canaries: Canary[]): Server {
  const server = new Server({ name: spec.name, version: '1.0.0' }, { capabilities: { tools: {} }, instructions: `Third-party fixture catalogue.\n${escapeSkillTags(serverInstructions(spec))}` });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: fixtureTools(spec, canaries) }));
  server.setRequestHandler(CallToolRequestSchema, async req => {
    const match = canaries.find(c => c.server === spec.name && c.tool === req.params.name && isDeepStrictEqual(c.args, req.params.arguments ?? {}));
    return { content: [{ type: 'text', text: match ? escapeSkillTags(match.response) : 'not found' }], isError: !match };
  });
  return server;
}

/** Loopback-only authenticated transport. Factories keep gateway state scoped to a session's endpoint. */
export async function endpoint(factory: () => { server: Server | McpServer; close?: () => Promise<void> }, token: string) {
  const expected = Buffer.from(`Bearer ${token}`);
  const cleanups = new Set<() => Promise<void>>();
  const http = httpServer(async (req, res) => {
    const got = Buffer.from(req.headers.authorization ?? '');
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) { res.writeHead(401).end(); return; }
    if (req.url !== '/mcp') { res.writeHead(404).end(); return; }
    const instance = factory();
    const address = http.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, enableDnsRebindingProtection: true, allowedHosts: [`127.0.0.1:${port}`] });
    const cleanup = async () => { await transport.close(); await instance.server.close(); await instance.close?.(); cleanups.delete(cleanup); };
    cleanups.add(cleanup);
    res.on('close', () => { void cleanup(); });
    try { await instance.server.connect(transport); await transport.handleRequest(req, res); }
    catch { if (!res.headersSent) res.writeHead(500).end('fixture transport failed'); }
  });
  await new Promise<void>((resolve, reject) => { http.once('error', reject); http.listen(0, '127.0.0.1', resolve); });
  const address = http.address();
  if (typeof address !== 'object' || !address) throw new Error('fixture listener missing');
  return { url: `http://127.0.0.1:${address.port}/mcp`, close: async () => { http.closeAllConnections(); await Promise.all([...cleanups].map(c => c())); await new Promise<void>(resolve => http.close(() => resolve())); } };
}
