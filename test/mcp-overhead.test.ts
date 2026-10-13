import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DISABLED_FEATURES, type Command } from '../bench/overhead.js';
import { catalogFacts, serverInstructions, serverSpecs, serverTools } from '../bench/mcp-fixtures.js';
import { arms, armId, buildPlan, claudeEnv, estimate, formatOffline, loadoutFacts, main, offline, runStudy, sessionFacts, summarize, toolSearchBlockers, type Plan } from '../bench/mcp-overhead.js';

const temps: string[] = [];
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'loadout-b7-test-')); temps.push(dir); return dir; };
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const serverPath = join(import.meta.dirname, '../bench/mcp-fixture-server.ts');

describe('fixture catalogues', () => {
  it('are deterministic, prefix-stable and well formed', () => {
    expect(serverSpecs(20)).toEqual(serverSpecs(20));
    expect(serverSpecs(5)).toEqual(serverSpecs(20).slice(0, 5));
    expect(new Set(serverSpecs(20).map((s) => s.name)).size).toBe(20);
    for (const spec of serverSpecs(20)) {
      const tools = serverTools(spec);
      expect(tools).toHaveLength(spec.tools);
      expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length);
      for (const t of tools) {
        const schema = t.inputSchema as { type: string; properties: Record<string, unknown>; required: string[] };
        expect(schema.type).toBe('object');
        expect(schema.required.length).toBeGreaterThan(0);
        for (const name of schema.required) expect(schema.properties).toHaveProperty(name);
        expect(t.description.length).toBeGreaterThan(80);
      }
    }
  });

  it('record the characters per configuration', () => {
    expect(catalogFacts(1)).toEqual({ servers: 1, tools: 10, definitionChars: 8012, nameChars: 281, instructionChars: 170 });
    expect(catalogFacts(5)).toMatchObject({ servers: 5, tools: 110, definitionChars: 81434 });
    expect(catalogFacts(20)).toMatchObject({ servers: 20, tools: 485, definitionChars: 355934 });
  });
});

describe('fixture server over stdio', () => {
  it('serves exactly the catalogue and instructions, with fixed replies', async () => {
    const spec = serverSpecs(4)[3]!;
    const client = new Client({ name: 'b7-test', version: '0.0.1' });
    const transport = new StdioClientTransport({ command: process.execPath, args: ['--import', 'tsx', serverPath, spec.name], stderr: 'pipe' });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      expect(tools.reduce((n, t) => n + JSON.stringify(t).length, 0)).toBe(serverTools(spec).reduce((n, t) => n + JSON.stringify(t).length, 0));
      expect(tools.map((t) => t.name)).toEqual(serverTools(spec).map((t) => t.name));
      expect(client.getInstructions()).toBe(serverInstructions(spec));
      expect(await client.callTool({ name: tools[0]!.name, arguments: {} })).toMatchObject({ content: [{ text: `fixture docs.${tools[0]!.name}: ok` }] });
      expect(await client.callTool({ name: 'nope', arguments: {} })).toMatchObject({ isError: true });
    } finally { await client.close(); }
  }, 60_000);

  it('refuses an unknown server name', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', serverPath, 'nope'], { encoding: 'utf8' });
    expect(result.status).toBe(2);
  }, 60_000);
});

describe('offline mode', () => {
  it('counts native definitions and loadout\'s own fixed cost without any CLI', async () => {
    const rows = await offline();
    expect(rows).toHaveLength(6);
    for (const config of ['n1', 'n5', 'n20'] as const) {
      const native = rows.find((r) => r.kind === 'native' && r.config === config)!;
      const gateway = rows.find((r) => r.kind === 'gateway' && r.config === config)!;
      expect(gateway.tools).toBe(4);
      expect(gateway.libraryDefinitionChars).toBe(native.definitionChars);
      expect(gateway.definitionChars).toBeLessThan(native.config === 'n1' ? native.definitionChars : native.definitionChars / 10);
    }
  });

  it('grows loadout\'s cost with the server names it lists and carries its instructions', async () => {
    const one = await loadoutFacts(serverSpecs(1));
    const twenty = await loadoutFacts(serverSpecs(20));
    expect(twenty.definitionChars).toBeGreaterThan(one.definitionChars);
    expect(one.instructionChars).toBeGreaterThan(200);
    const none = await loadoutFacts([]);
    expect(none.tools).toBe(2);
  });

  it('prints a table with both baselines and the gateway', async () => {
    const table = formatOffline(await offline());
    expect(table).toContain('| n20 | native | 20 | 485 | 355934 | 13884 | 3530 | 359464 | 17414 |');
    expect(table).toContain('All loaded');
    expect(table).toContain('Search on');
  });

  it('main --offline spawns nothing and prints only the table', async () => {
    const lines: string[] = [];
    await main(['--offline'], (s) => lines.push(s));
    expect(lines.join('\n')).toContain('| n1 | gateway |');
    expect(lines.join('\n')).not.toContain('PAID');
  });
});

describe('arms and environment', () => {
  it('covers the native tool search readings for Claude and one reading for Codex', () => {
    const all = arms();
    expect(all).toHaveLength(23);
    const native = (host: string, config: string) => all.filter((a) => a.host === host && a.kind === 'native' && a.config === config).map((a) => a.toolSearch);
    expect(native('claude', 'n5')).toEqual(['default', 'false', 'auto']);
    expect(native('codex', 'n5')).toEqual([undefined]);
    expect(all.filter((a) => a.kind === 'baseline').map(armId)).toEqual(['claude/baseline', 'codex/baseline']);
  });

  it('makes the tool search setting explicit and never inherits it', () => {
    const base = { ENABLE_TOOL_SEARCH: 'auto:5', PATH: '/bin' };
    expect(claudeEnv(base, 'default').ENABLE_TOOL_SEARCH).toBeUndefined();
    expect(claudeEnv(base, 'false').ENABLE_TOOL_SEARCH).toBe('false');
    expect(claudeEnv(base, 'auto').ENABLE_TOOL_SEARCH).toBe('auto');
    expect(claudeEnv(base).PATH).toBe('/bin');
    expect(base.ENABLE_TOOL_SEARCH).toBe('auto:5');
  });

  it('blocks environments in which Claude Code tool search is off or unavailable', () => {
    expect(toolSearchBlockers({ PATH: '/bin' })).toEqual([]);
    for (const name of ['ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS']) {
      expect(toolSearchBlockers({ [name]: '1' })[0]).toContain(name);
    }
  });
});

describe('plan', () => {
  const plan = (only = {}, env: NodeJS.ProcessEnv = { PATH: process.env.PATH }) => buildPlan(temp(), only, env);

  it('builds 46 runs under temp dirs with the same isolation and model in every Claude arm', () => {
    const p = plan();
    expect(p.runs).toHaveLength(46);
    expect(p.blockers).toEqual([]);
    const claudeRuns = p.runs.filter((r) => r.arm.host === 'claude');
    expect(claudeRuns.map((r) => r.first.args[r.first.args.indexOf('--model') + 1])).toEqual(claudeRuns.map(() => 'haiku'));
    for (const r of claudeRuns) {
      expect(r.first.args).not.toContain('--no-session-persistence');
      expect(r.first.args).toContain('--strict-mcp-config');
      expect(r.first.args).not.toContain('--tools');
      expect(r.first.cwd.startsWith(tmpdir())).toBe(true);
    }
    expect(p.runs[0]!.arm).toEqual({ host: 'claude', kind: 'baseline' });
  });

  it('configures N native servers, or only loadout behind the gateway', () => {
    const p = plan({ hosts: ['claude'], configs: ['n5'], repeats: 1 });
    const mcp = (r: Plan['runs'][number]) => Object.keys(JSON.parse(r.first.args[r.first.args.indexOf('--mcp-config') + 1]!).mcpServers);
    const find = (kind: string, toolSearch: string) => p.runs.find((r) => r.arm.kind === kind && r.arm.toolSearch === toolSearch)!;
    expect(mcp(find('native', 'false'))).toEqual(serverSpecs(5).map((s) => s.name));
    expect(mcp(find('gateway', 'false'))).toEqual(['loadout']);
    expect(find('native', 'false').first.env?.ENABLE_TOOL_SEARCH).toBe('false');
    expect(find('native', 'default').first.env).not.toHaveProperty('ENABLE_TOOL_SEARCH');
    expect(find('native', 'auto').first.env?.ENABLE_TOOL_SEARCH).toBe('auto');
    const gateway = JSON.parse(find('gateway', 'default').first.args[find('gateway', 'default').first.args.indexOf('--mcp-config') + 1]!).mcpServers.loadout;
    const library = JSON.parse(readFileSync(join(gateway.env.LOADOUT_HOME, 'library', 'mcp.json'), 'utf8')).mcpServers;
    expect(Object.keys(library)).toEqual(serverSpecs(5).map((s) => s.name));
    expect(Object.values(library).every((s) => (s as { gateway: boolean }).gateway)).toBe(true);
  });

  it('resumes the first session for the second request', () => {
    const p = plan({ hosts: ['claude', 'codex'], configs: ['n1'], repeats: 1 });
    const claude = p.runs.find((r) => r.arm.host === 'claude' && r.arm.kind === 'native')!;
    expect(claude.follow('abc-123').args.slice(-3, -1)).toEqual(['--resume', 'abc-123']);
    const codex = p.runs.find((r) => r.arm.host === 'codex' && r.arm.kind === 'native')!;
    expect(codex.first.args).not.toContain('--ephemeral');
    expect(codex.follow('thread-1').args.slice(0, 2)).toEqual(['exec', 'resume']);
    expect(codex.first.args.join(' ')).toContain('required');
  });

  it('reports a blocker instead of a misleading default arm', () => {
    expect(plan({}, { ANTHROPIC_BASE_URL: 'http://proxy.invalid' }).blockers[0]).toContain('ANTHROPIC_BASE_URL');
    expect(plan({ hosts: ['codex'] }, { ANTHROPIC_BASE_URL: 'http://proxy.invalid' }).blockers).toEqual([]);
  });

  it('estimates two requests a run and brackets the input tokens', async () => {
    const p = plan();
    const e = estimate(p.runs, await offline());
    expect(e.requests).toBe(92);
    expect(e.inputTokens[0]).toBe(92 * 8_500);
    expect(e.inputTokens[1]).toBeGreaterThan(e.inputTokens[0]);
    expect(e.seconds).toEqual([92 * 30, 92 * 120]);
  });

  it('main without --run prints the estimate and argv, and spawns nothing', async () => {
    const lines: string[] = [];
    await main(['--hosts', 'claude', '--configs', 'n1', '--repeats', '1'], (s) => lines.push(s));
    expect(lines[0]).toContain('6 runs, 12 paid requests');
    expect(lines.some((l) => l.startsWith('PAID claude/native/n1/false/1'))).toBe(true);
    await expect(main(['--hosts', 'gemini'], () => {})).rejects.toThrow('unknown value');
    await expect(main(['--repeats', '0'], () => {})).rejects.toThrow('--repeats');
  });
});

describe('measurement', () => {
  const jsonl = (...events: unknown[]) => events.map((e) => JSON.stringify(e)).join('\n');
  const SECRET_PLUGIN = 'ambient-private-plugin';
  /** A fake Claude or Codex: reports the servers it was configured with, counters per request. */
  function fakeHost(opts: { ambient?: (command: Command) => string; connected?: boolean; features?: boolean } = {}) {
    const calls: Command[] = [];
    const run = async (command: Command) => {
      calls.push(command);
      const args = command.args;
      if (args.includes('features')) return DISABLED_FEATURES.map((name) => `${name} stable ${opts.features === false ? 'true' : 'false'}`).join('\n');
      if (args.includes('prompt-input')) return JSON.stringify([{ type: 'message', content: [{ type: 'input_text', text: 'rendered' }] }]);
      const follow = args.includes('--resume') || args.includes('resume');
      if (args[0] === 'exec') {
        return jsonl({ type: 'thread.started', thread_id: 'thread-1' }, { type: 'turn.completed', usage: { input_tokens: follow ? 900 : 1000, cached_input_tokens: follow ? 800 : 0, output_tokens: 1 } });
      }
      const servers = Object.keys(JSON.parse(args[args.indexOf('--mcp-config') + 1]!).mcpServers);
      return jsonl(
        { type: 'system', subtype: 'init', session_id: 'sess-1', model: 'haiku-resolved', skills: ['s'], plugins: [{ name: opts.ambient?.(command) ?? SECRET_PLUGIN }], slash_commands: ['c'], tools: ['Bash', ...(servers.length ? ['ToolSearch', `mcp__${servers[0]}__t`] : [])],
          mcp_servers: servers.map((name) => ({ name, status: opts.connected === false ? 'failed' : 'connected' })) },
        { type: 'assistant', message: { content: [{ type: 'text', text: 'OK' }] } },
        { type: 'result', subtype: 'success', num_turns: follow ? 2 : 1, usage: { input_tokens: 5, cache_creation_input_tokens: follow ? 0 : 100 + servers.length * 10, cache_read_input_tokens: follow ? 100 : 0, output_tokens: 1 } },
      );
    };
    return { run, calls };
  }
  const small = () => buildPlan(temp(), { configs: ['n1'], repeats: 1 }, { PATH: process.env.PATH });

  it('measures request 1 and a resumed request 2 per run, without keeping inventory names', async () => {
    const out = temp();
    const host = fakeHost();
    const rows = await runStudy(small(), out, await offline(), { run: host.run });
    expect(rows).toHaveLength(18);
    const claude = rows.filter((r) => r.host === 'claude');
    expect(claude.filter((r) => r.kind === 'native').length).toBe(6);
    const second = claude.find((r) => r.turn === 2)!;
    expect(second.cacheRead).toBe(100);
    expect(host.calls.some((c) => c.args.includes('--resume') && c.args.includes('sess-1'))).toBe(true);
    const native = claude.find((r) => r.kind === 'native')!;
    expect(native).toMatchObject({ mcpToolsListed: 1, toolSearchListed: true, toolsListed: 3 });
    expect(native.fixture?.definitionChars).toBe(8012);
    expect(claude.find((r) => r.kind === 'baseline')).toMatchObject({ mcp: [], toolsListed: 1 });
    const saved = readFileSync(join(out, 'rows.jsonl'), 'utf8');
    expect(saved.trim().split('\n')).toHaveLength(rows.length);
    expect(saved).not.toContain(SECRET_PLUGIN);
    expect(summarize(rows)).toContain('| claude | native | n1 | false | 1 | 1 |');
  });

  it('runs Codex only when its disabled features read false', async () => {
    const p = small();
    const ok = await runStudy(p, temp(), [], { run: fakeHost().run });
    expect(ok.some((r) => r.host === 'codex' && r.renderedCharacters === null && r.turn === 2 && r.cacheRead === 800)).toBe(true);
    const out = temp();
    const refused = await runStudy(p, out, [], { run: fakeHost({ features: false }).run });
    expect(refused.some((r) => r.host === 'codex')).toBe(false);
    expect(refused.some((r) => r.host === 'claude')).toBe(true);
    expect(readFileSync(join(out, 'preflight.jsonl'), 'utf8')).toContain('is enabled or unrecognized');
  });

  it('refuses a row when a server did not connect or the ambient inventory drifts', async () => {
    await expect(runStudy(small(), temp(), [], { run: fakeHost({ connected: false }).run })).rejects.toThrow('did not connect');
    let n = 0;
    await expect(runStudy(small(), temp(), [], { run: fakeHost({ ambient: () => `plugin-${n++ > 1 ? 'b' : 'a'}` }).run })).rejects.toThrow('inventory drift');
  });

  it('does not measure while a blocker stands', async () => {
    const blocked: Plan = { ...small(), blockers: ['ANTHROPIC_BASE_URL is set'] };
    const host = fakeHost();
    await expect(runStudy(blocked, temp(), [], { run: host.run })).rejects.toThrow('blocked');
    expect(host.calls).toHaveLength(0);
  });

  it('reads the session to resume and rejects ids that could pass as flags', () => {
    const claude = jsonl({ type: 'system', subtype: 'init', session_id: 'a1-b2', tools: ['Bash', { name: 'mcp__x__y' }] });
    expect(sessionFacts(claude, 'claude')).toEqual({ session: 'a1-b2', tools: ['Bash', 'mcp__x__y'] });
    expect(sessionFacts(jsonl({ type: 'thread.started', thread_id: 'T-9' }), 'codex')).toEqual({ session: 'T-9', tools: null });
    expect(() => sessionFacts(jsonl({ type: 'system', subtype: 'init', session_id: '--dangerous' }), 'claude')).toThrow('session id');
    expect(() => sessionFacts('not json', 'codex')).toThrow('session id');
  });
});
