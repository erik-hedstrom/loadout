import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DISABLED_FEATURES, execute, parseClaudeTurns, type Command } from '../bench/overhead.js';
import { catalogFacts, serverInstructions, serverSpecs, serverTools } from '../bench/mcp-fixtures.js';
import { arms, armId, buildPlan, checkCodexInventory, claudeEnv, estimate, formatOffline, loadoutFacts, main, offline, positiveControl, runStudy, summarize, toolSearchBlockers, type Arm, type Plan, type Run } from '../bench/mcp-overhead.js';

const temps: string[] = [];
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'loadout-b7-test-')); temps.push(dir); return dir; };
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const serverPath = join(import.meta.dirname, '../bench/mcp-fixture-server.ts');
const jsonl = (...events: unknown[]) => events.map((e) => JSON.stringify(e)).join('\n');
const never = async (): Promise<string> => { throw new Error('a host was started'); };

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
    expect((await loadoutFacts([])).tools).toBe(2);
  });

  it('prints a table with both baselines and the gateway', async () => {
    const table = formatOffline(await offline());
    expect(table).toContain('| n20 | native | 20 | 485 | 355934 | 13884 | 3530 | 359464 | 17414 |');
    expect(table).toContain('All loaded');
    expect(table).toContain('Search on');
  });

  it('main --offline starts no host and prints only the table', async () => {
    const lines: string[] = [];
    await main(['--offline'], { print: (s) => lines.push(s), run: never });
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
  const clean = { PATH: process.env.PATH };
  const plan = (only = {}, env: NodeJS.ProcessEnv = clean) => buildPlan(temp(), only, env);
  const mcpOf = (r: Run) => JSON.parse(r.command.args[r.command.args.indexOf('--mcp-config') + 1]!).mcpServers as Record<string, { env?: { LOADOUT_HOME: string } }>;

  it('builds 46 runs: Claude sends both requests through one process, Codex one', () => {
    const p = plan();
    expect(p.runs).toHaveLength(46);
    expect(p.blockers).toEqual([]);
    const claude = p.runs.filter((r) => r.arm.host === 'claude');
    expect(claude).toHaveLength(32);
    for (const r of claude) {
      expect(r.command.args).toContain('--no-session-persistence');
      expect(r.command.args).not.toContain('--resume');
      expect(r.command.args).not.toContain('--tools');
      expect(r.command.args.slice(r.command.args.indexOf('--input-format'), r.command.args.indexOf('--input-format') + 2)).toEqual(['--input-format', 'stream-json']);
      expect(r.command.args[r.command.args.indexOf('--model') + 1]).toBe('haiku');
      expect(r.command.stdin).toHaveLength(2);
      expect(JSON.parse(r.command.stdin![1]!)).toMatchObject({ type: 'user', message: { role: 'user' } });
    }
    expect(p.runs[0]!.arm).toEqual({ host: 'claude', kind: 'baseline' });
  });

  it('writes no session files for either host and ignores the user\'s Codex config', () => {
    for (const r of plan().runs) {
      const args = r.command.args;
      expect(args).not.toContain('resume');
      expect(args).not.toContain('--resume');
      if (r.arm.host === 'codex') for (const flag of ['--ephemeral', '--ignore-user-config', '--ignore-rules']) expect(args).toContain(flag);
      else expect(args).toContain('--no-session-persistence');
      expect(r.command.stdin?.length ?? 1).toBe(r.arm.host === 'claude' ? 2 : 1);
    }
  });

  it('keeps every directory it creates or configures under the temp root', () => {
    const root = temp();
    const p = buildPlan(root, {}, clean);
    for (const r of p.runs) {
      expect(r.command.cwd.startsWith(root)).toBe(true);
      for (const s of Object.values(r.arm.host === 'claude' ? mcpOf(r) : {})) if (s.env) expect(s.env.LOADOUT_HOME.startsWith(root)).toBe(true);
    }
    expect(() => buildPlan(join(homedir(), '.claude', 'b7-test'), {}, clean)).toThrow('temporary');
    expect(() => buildPlan(join(homedir(), '.codex', 'b7-test'), {}, clean)).toThrow('temporary');
  });

  it('configures N native servers, or only loadout behind the gateway, with the tool search setting in the env', () => {
    const p = plan({ hosts: ['claude'], configs: ['n5'], repeats: 1 });
    const find = (kind: string, toolSearch: string) => p.runs.find((r) => r.arm.kind === kind && r.arm.toolSearch === toolSearch)!;
    expect(Object.keys(mcpOf(find('native', 'false')))).toEqual(serverSpecs(5).map((s) => s.name));
    expect(Object.keys(mcpOf(find('gateway', 'false')))).toEqual(['loadout']);
    expect(find('native', 'false').command.env?.ENABLE_TOOL_SEARCH).toBe('false');
    expect(find('native', 'default').command.env).not.toHaveProperty('ENABLE_TOOL_SEARCH');
    expect(find('native', 'auto').command.env?.ENABLE_TOOL_SEARCH).toBe('auto');
    const home = mcpOf(find('gateway', 'default')).loadout!.env!.LOADOUT_HOME;
    const library = JSON.parse(readFileSync(join(home, 'library', 'mcp.json'), 'utf8')).mcpServers;
    expect(Object.keys(library)).toEqual(serverSpecs(5).map((s) => s.name));
    expect(Object.values(library).every((s) => (s as { gateway: boolean }).gateway)).toBe(true);
  });

  it('requires every Codex server so a failed start cannot shrink an arm', () => {
    const codex = plan({ hosts: ['codex'], configs: ['n1'], repeats: 1 }).runs.find((r) => r.arm.kind === 'native')!;
    expect(codex.command.args.join(' ')).toContain('required');
  });

  it('reports a blocker instead of a misleading default arm', () => {
    expect(plan({}, { ANTHROPIC_BASE_URL: 'http://proxy.invalid' }).blockers[0]).toContain('ANTHROPIC_BASE_URL');
    expect(plan({ hosts: ['codex'] }, { ANTHROPIC_BASE_URL: 'http://proxy.invalid' }).blockers).toEqual([]);
  });

  it('estimates by request and brackets the input tokens', async () => {
    const e = estimate(plan().runs, await offline());
    expect(e.requests).toBe(78);
    expect(e.inputTokens[0]).toBe(78 * 8_500);
    expect(e.inputTokens[1]).toBeGreaterThan(e.inputTokens[0]);
    expect(e.seconds).toEqual([78 * 30, 32 * 240 + 14 * 120]);
  });

  it('main without --run prints the estimate, its caveat, env, stdin and argv, and starts no host', async () => {
    const lines: string[] = [];
    await main(['--hosts', 'claude', '--configs', 'n1', '--repeats', '1'], { print: (s) => lines.push(s), run: never });
    expect(lines[0]).toContain('6 runs, 12 paid requests');
    expect(lines.join('\n')).toContain('probably undercounts');
    expect(lines.join('\n')).toContain('Illustrative');
    const paid = lines.find((l) => l.startsWith('PAID claude/native/n1/false/1'))!;
    expect(paid).toContain('env=ENABLE_TOOL_SEARCH=false,MCP_TIMEOUT=60000');
    expect(paid).toContain('stdin=[');
    expect(lines.find((l) => l.startsWith('PAID claude/native/n1/default/1'))).toContain('ENABLE_TOOL_SEARCH=(unset)');
    await expect(main(['--hosts', 'gemini'], { print: () => {}, run: never })).rejects.toThrow('unknown value');
    await expect(main(['--repeats', '0'], { print: () => {}, run: never })).rejects.toThrow('--repeats');
  });
});

describe('host process', () => {
  it('sends the next stdin line only after the host\'s result event, then closes stdin', async () => {
    const file = join(temp(), 'host.cjs');
    writeFileSync(file, `
      const rl = require('readline').createInterface({ input: process.stdin });
      let n = 0;
      rl.on('line', (line) => {
        const arrived = Date.now();
        console.log(JSON.stringify({ type: 'arrived', n: ++n, line, t: arrived }));
        setTimeout(() => console.log(JSON.stringify({ type: 'result', n, t: Date.now() })), 150);
      });
      rl.on('close', () => console.log(JSON.stringify({ type: 'closed', n })));
    `);
    const out = jsonl2(await execute({ bin: process.execPath, args: [file], cwd: tmpdir(), stdin: ['one', 'two'] }));
    const at = (type: string, n?: number) => out.find((e) => e.type === type && (n === undefined || e.n === n))!;
    expect(at('arrived', 2).line).toBe('two');
    expect(at('arrived', 2).t).toBeGreaterThanOrEqual(at('result', 1).t);
    expect(at('closed').n).toBe(2);
  });

  const jsonl2 = (text: string) => text.trim().split('\n').map((l) => JSON.parse(l));

  it('reads each turn\'s request from its assistant message and accepts only valid turn counts', () => {
    const init = { type: 'system', subtype: 'init', claude_code_version: '2.1.0', model: 'm', tools: ['Bash', { name: 'ToolSearch' }], skills: [], plugins: [], slash_commands: [], mcp_servers: [] };
    const turn = (usage: object, numTurns: number, content: unknown[] = [{ type: 'text', text: 'OK' }]) => [
      { type: 'assistant', message: { content, usage } },
      { type: 'result', subtype: 'success', num_turns: numTurns, usage: { input_tokens: 9999, cache_creation_input_tokens: 9999, cache_read_input_tokens: 9999, output_tokens: 9999 } }];
    const u1 = { input_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 0, output_tokens: 1 };
    const u2 = { input_tokens: 6, cache_creation_input_tokens: 0, cache_read_input_tokens: 100, output_tokens: 1 };
    const ok = parseClaudeTurns(jsonl(init, ...turn(u1, 1), ...turn(u2, 2)), 2);
    expect(ok.turns.map((t) => t.input)).toEqual([105, 106]);
    expect(ok.version).toBe('2.1.0');
    expect(ok.tools).toEqual(['Bash', 'ToolSearch']);
    expect(parseClaudeTurns(jsonl(init, ...turn(u1, 1), ...turn(u2, 1)), 2).turns).toHaveLength(2);
    expect(() => parseClaudeTurns(jsonl(init, ...turn(u1, 2), ...turn(u2, 2)), 2)).toThrow('turn 1');
    expect(() => parseClaudeTurns(jsonl(init, ...turn(u1, 1), ...turn(u2, 3)), 2)).toThrow('turn 2');
    expect(() => parseClaudeTurns(jsonl(init, ...turn(u1, 1), ...turn(u2, 2, [{ type: 'tool_use', name: 'x' }])), 2)).toThrow('tool use');
    expect(() => parseClaudeTurns(jsonl(init, ...turn(u1, 1)), 2)).toThrow('2 results');
    expect(() => parseClaudeTurns(jsonl({ ...init, claude_code_version: undefined }, ...turn(u1, 1), ...turn(u2, 2)), 2)).toThrow('claude_code_version');
    expect(() => parseClaudeTurns(jsonl(init, ...turn({ ...u1, cache_read_input_tokens: -1 }, 1), ...turn(u2, 2)), 2)).toThrow('cache_read');
  });
});

describe('positive controls', () => {
  const native = (toolSearch: Arm['toolSearch']): Arm => ({ host: 'claude', kind: 'native', config: 'n1', toolSearch });
  const names = (n: number) => serverTools(serverSpecs(1)[0]!).slice(0, n).map((t) => `mcp__tracker__${t.name}`);
  const gateway: Arm = { host: 'claude', kind: 'gateway', config: 'n1', toolSearch: 'default' };

  it('requires every tool when tool search is off', () => {
    expect(() => positiveControl(native('false'), ['Bash', ...names(10)], 50)).not.toThrow();
    expect(() => positiveControl(native('false'), ['Bash', 'ToolSearch', ...names(9)], 50)).toThrow('9 of 10');
    expect(() => positiveControl(native('false'), ['Bash'], 50)).toThrow('0 of 10');
  });

  it('accepts a deferred reading only with ToolSearch present', () => {
    expect(() => positiveControl(native('default'), ['Bash', 'ToolSearch'], 5)).not.toThrow();
    expect(() => positiveControl(native('auto'), ['Bash', ...names(10)], 5)).not.toThrow();
    expect(() => positiveControl(native('default'), ['Bash', ...names(3)], 5)).toThrow('no ToolSearch');
    expect(() => positiveControl(native('default'), ['Bash'], 5)).toThrow('no ToolSearch');
  });

  it('requires loadout\'s four tools behind the gateway', () => {
    const four = ['find_skills', 'load_skill', 'server_tools', 'call_server_tool'].map((t) => `mcp__loadout__${t}`);
    expect(() => positiveControl(gateway, ['Bash', ...four], 5)).not.toThrow();
    expect(() => positiveControl(gateway, ['Bash', 'ToolSearch', ...four.slice(1)], 5)).toThrow('not listed');
  });

  it('requires a positive input delta over the baseline, and none of the baseline itself', () => {
    expect(() => positiveControl(native('default'), ['ToolSearch'], 0)).toThrow('no positive input delta');
    expect(() => positiveControl(native('default'), ['ToolSearch'], -3)).toThrow('no positive input delta');
    expect(() => positiveControl({ host: 'codex', kind: 'native', config: 'n1' }, null, 0)).toThrow('no positive input delta');
    expect(() => positiveControl({ host: 'claude', kind: 'baseline' }, ['Bash'], 0)).not.toThrow();
  });

  it('compares Codex\'s reported servers and tools with the arm, by count', () => {
    const arm: Arm = { host: 'codex', kind: 'native', config: 'n1' };
    const spec = serverSpecs(1)[0]!;
    const right = new Map([[spec.name, serverTools(spec).map((t) => t.name)]]);
    expect(() => checkCodexInventory(right, arm)).not.toThrow();
    expect(() => checkCodexInventory(new Map([...right, ['my-private-server', ['t']]]), arm)).toThrow('1 server');
    expect(() => checkCodexInventory(new Map([[spec.name, ['only_one']]]), arm)).toThrow('1 server');
    expect(() => checkCodexInventory(new Map(), arm)).toThrow('1 server');
    expect(() => checkCodexInventory(new Map([['x', []]]), { host: 'codex', kind: 'baseline' })).toThrow('1 server');
    expect(() => checkCodexInventory(new Map(), { host: 'codex', kind: 'baseline' })).not.toThrow();
    try { checkCodexInventory(new Map([['my-private-server', ['t']]]), { host: 'codex', kind: 'baseline' }); } catch (e) { expect((e as Error).message).not.toContain('my-private-server'); }
  });
});

describe('measurement', () => {
  const SECRET_PLUGIN = 'ambient-private-plugin';
  interface Opts { version?: (call: number) => string | undefined; plugin?: (call: number) => string; status?: string; extraServer?: boolean; toolUse2?: boolean; numTurns1?: number; tools?: (run: Run, base: string[]) => string[]; flat?: boolean; features?: boolean; codexContext?: (call: number) => string; codexVersion?: (call: number) => string; inventory?: (run: Run) => Map<string, string[]> }
  /** A fake Claude and Codex that report what the plan declared: tools follow the tool search setting, counters grow with the servers. */
  function fakeHost(p: Plan, o: Opts = {}) {
    const calls: Command[] = [];
    let claudeCalls = 0, contexts = 0, versions = 0;
    const find = (command: Command) => p.runs.find((r) => r.command.cwd === command.cwd)!;
    const run = async (command: Command) => {
      calls.push(command);
      const r = find(command);
      const args = command.args;
      if (args.includes('features')) return DISABLED_FEATURES.map((name) => `${name} stable ${o.features === false ? 'true' : 'false'}`).join('\n');
      if (args.includes('prompt-input')) return JSON.stringify([{ type: 'message', content: [{ type: 'input_text', text: o.codexContext?.(contexts++) ?? 'rendered' }] }]);
      if (args.includes('--version')) return `${o.codexVersion?.(versions++) ?? 'codex-cli 9.9.9'}\n`;
      const delta = o.flat || r.arm.kind === 'baseline' ? 0 : 10 * Math.max(1, r.servers.length);
      if (r.arm.host === 'codex') return jsonl({ type: 'thread.started', thread_id: 'thread-1' }, { type: 'turn.completed', usage: { input_tokens: 1000 + delta, cached_input_tokens: 0, output_tokens: 1 } });
      const call = claudeCalls++;
      const all = r.arm.kind === 'native' ? serverSpecs(r.servers.length).flatMap((s) => serverTools(s).map((t) => `mcp__${s.name}__${t.name}`))
        : r.arm.kind === 'gateway' ? ['find_skills', 'load_skill', 'server_tools', 'call_server_tool'].map((t) => `mcp__loadout__${t}`) : [];
      const deferred = r.arm.kind === 'native' && r.command.env?.ENABLE_TOOL_SEARCH !== 'false';
      const base = ['Bash', ...(deferred ? ['ToolSearch'] : all)];
      const listed = [...r.servers, ...(o.extraServer ? ['ambient-extra'] : [])];
      const turn = (usage: object, numTurns: number, content: unknown[] = [{ type: 'text', text: 'OK' }]) => [{ type: 'assistant', message: { content, usage } }, { type: 'result', subtype: 'success', num_turns: numTurns, usage: { input_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1, output_tokens: 1 } }];
      return jsonl(
        { type: 'system', subtype: 'init', claude_code_version: o.version ? o.version(call) : '2.0.0', model: 'haiku-resolved', skills: ['s'], plugins: [{ name: o.plugin?.(call) ?? SECRET_PLUGIN }], slash_commands: ['c'],
          tools: o.tools ? o.tools(r, base) : base, mcp_servers: listed.map((name) => ({ name, status: o.status ?? 'connected' })) },
        ...turn({ input_tokens: 5, cache_creation_input_tokens: 100 + delta, cache_read_input_tokens: 0, output_tokens: 1 }, o.numTurns1 ?? 1),
        ...turn({ input_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 100 + delta, output_tokens: 1 }, 2, o.toolUse2 ? [{ type: 'tool_use', name: 'x' }] : undefined));
    };
    const inventory = async (command: Command) => {
      const r = p.runs.find((x) => x.free?.inventory.cwd === command.cwd)!;
      if (o.inventory) return o.inventory(r);
      return new Map<string, string[]>(r.arm.kind === 'native' ? serverSpecs(r.servers.length).map((s) => [s.name, serverTools(s).map((t) => t.name)])
        : r.arm.kind === 'gateway' ? [['loadout', ['find_skills', 'load_skill', 'server_tools', 'call_server_tool']]] : []);
    };
    return { run, inventory, calls };
  }
  const small = () => buildPlan(temp(), { configs: ['n1'], repeats: 1 }, { PATH: process.env.PATH });
  const study = (o: Opts = {}, p = small()) => { const h = fakeHost(p, o); return runStudy(p, temp(), { run: h.run, inventory: h.inventory }); };

  it('measures both Claude requests of a run and one Codex request, without keeping inventory names', async () => {
    const p = small();
    const out = temp();
    const h = fakeHost(p);
    const { rows, notes } = await runStudy(p, out, { run: h.run, inventory: h.inventory });
    expect(rows).toHaveLength(6 * 2 + 3);
    expect(notes).toEqual([]);
    const claude = rows.filter((r) => r.host === 'claude');
    expect(claude.find((r) => r.turn === 2 && r.kind === 'native')!.cacheRead).toBeGreaterThan(100);
    expect(claude.every((r) => r.hostVersion === '2.0.0')).toBe(true);
    expect(rows.filter((r) => r.host === 'codex').every((r) => r.turn === 1 && r.hostVersion === 'codex-cli 9.9.9')).toBe(true);
    expect(claude.find((r) => r.kind === 'native' && r.toolSearch === 'false')).toMatchObject({ mcpToolsListed: 10, toolSearchListed: false });
    expect(claude.find((r) => r.kind === 'native' && r.toolSearch === 'default')).toMatchObject({ mcpToolsListed: 0, toolSearchListed: true });
    expect(claude.find((r) => r.kind === 'baseline')).toMatchObject({ mcp: [], toolsListed: 1 });
    const saved = readFileSync(join(out, 'rows.jsonl'), 'utf8');
    expect(saved.trim().split('\n')).toHaveLength(rows.length);
    expect(saved).not.toContain(SECRET_PLUGIN);
    expect(summarize(rows, notes)).toContain('| claude | native | n1 | false | 1 | 1 |');
    expect(h.calls.filter((c) => c.stdin).length).toBe(6);
  });

  it('records a Codex preflight with the version and counts, never the context', async () => {
    const p = small();
    const out = temp();
    const h = fakeHost(p);
    await runStudy(p, out, { run: h.run, inventory: h.inventory });
    const lines = readFileSync(join(out, 'preflight.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ arm: 'codex/baseline', version: 'codex-cli 9.9.9', refusals: [] });
    expect(lines[0].renderedCharacters).toBe(8);
  });

  it('skips Codex and says so when a free check refuses it, and when an undeclared server is visible', async () => {
    const features = await study({ features: false });
    expect(features.rows.some((r) => r.host === 'codex')).toBe(false);
    expect(features.rows.some((r) => r.host === 'claude')).toBe(true);
    expect(features.notes[0]).toContain('Codex skipped');
    expect(summarize(features.rows, features.notes)).toContain('Codex skipped');
    const p = small();
    const out = temp();
    const h = fakeHost(p, { inventory: () => new Map([['my-private-server', ['t']]]) });
    const ambient = await runStudy(p, out, { run: h.run, inventory: h.inventory });
    expect(ambient.rows.some((r) => r.host === 'codex')).toBe(false);
    const saved = readFileSync(join(out, 'preflight.jsonl'), 'utf8');
    expect(saved).toContain('differs from the arm');
    expect(saved).not.toContain('my-private-server');
  });

  it('refuses when the Codex context or version changes during the study', async () => {
    await expect(study({ codexContext: (n) => `rendered ${n}` })).rejects.toThrow('Codex ambient context or version changed');
    await expect(study({ codexVersion: (n) => `codex-cli 9.9.${n}` })).rejects.toThrow('Codex ambient context or version changed');
  });

  it('refuses Claude version drift or a missing version within a run', async () => {
    await expect(study({ version: (n) => (n < 2 ? '2.0.0' : '2.0.1') })).rejects.toThrow('version changed');
    await expect(study({ version: () => undefined })).rejects.toThrow('claude_code_version');
  });

  it('refuses a row when a server did not connect, extra servers are present, or the ambient inventory drifts', async () => {
    await expect(study({ status: 'failed' })).rejects.toThrow('did not connect');
    await expect(study({ extraServer: true })).rejects.toThrow('differ from the arm');
    await expect(study({ plugin: (n) => (n < 1 ? 'a' : 'b') })).rejects.toThrow('inventory drift');
  });

  it('refuses a tool_use on turn 2 and a turn 1 that reports two turns', async () => {
    await expect(study({ toolUse2: true })).rejects.toThrow('tool use');
    await expect(study({ numTurns1: 2 })).rejects.toThrow('turn 1');
  });

  it('refuses a connected server whose tools never arrived, in every arm kind', async () => {
    await expect(study({ tools: (r, base) => (r.arm.toolSearch === 'false' ? base.slice(0, 5) : base) })).rejects.toThrow('of 10 MCP tools listed');
    await expect(study({ tools: (r, base) => (r.arm.toolSearch === 'default' ? ['Bash'] : base) })).rejects.toThrow('no ToolSearch');
    await expect(study({ tools: (r, base) => (r.arm.kind === 'gateway' ? ['Bash'] : base) })).rejects.toThrow('not listed');
  });

  it('refuses an MCP arm with no positive input delta over its baseline', async () => {
    await expect(study({ flat: true })).rejects.toThrow('no positive input delta');
  });

  it('does not save the rows of a run that fails a control', async () => {
    const p = small();
    const out = temp();
    const h = fakeHost(p, { tools: (r, base) => (r.arm.kind === 'gateway' ? ['Bash'] : base) });
    await expect(runStudy(p, out, { run: h.run, inventory: h.inventory })).rejects.toThrow();
    const saved = readFileSync(join(out, 'rows.jsonl'), 'utf8');
    expect(saved).not.toContain('"kind":"gateway"');
  });

  it('does not measure while a blocker stands', async () => {
    const blocked: Plan = { ...small(), blockers: ['ANTHROPIC_BASE_URL is set'] };
    const h = fakeHost(blocked);
    await expect(runStudy(blocked, temp(), { run: h.run })).rejects.toThrow('blocked');
    expect(h.calls).toHaveLength(0);
  });
});
