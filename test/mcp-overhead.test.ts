import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DISABLED_FEATURES, execute, parseClaudeTurns, stopChild, withAppServer, type Command, type ToolCall } from '../bench/overhead.js';
import { EventEmitter } from 'node:events';
import { catalogFacts, serverInstructions, serverSpecs, serverTools } from '../bench/mcp-fixtures.js';
import { arms, armId, buildPlan, canaryFound, canaryOf, checkCodexInventory, claudeEnv, estimate, childEnv, droppedEnv, ENV_ALLOWLIST, CLAUDE_MANAGED_PRECONDITION, CODEX_CLOUD_PRECONDITION, managedClaudeFiles, formatOffline, hostWrites, loadoutFacts, main, managedCodexFiles, offline, positiveControl, reading, resetWork, runStudy, summarize, toolSearchBlockers, type Arm, type Plan, type Row, type Run } from '../bench/mcp-overhead.js';

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
    for (const toolSearch of ['default', 'false', 'auto'] as const) expect(claudeEnv({ DISABLE_UPDATES: '0', DISABLE_AUTOUPDATER: '0' }, toolSearch)).toMatchObject({ DISABLE_UPDATES: '1', DISABLE_AUTOUPDATER: '1' });
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
  const plan = (only = {}, env: NodeJS.ProcessEnv = clean) => buildPlan(temp(), only, env, []);
  const mcpOf = (r: Run) => JSON.parse(r.command.args[r.command.args.indexOf('--mcp-config') + 1]!).mcpServers as Record<string, { env?: { LOADOUT_HOME: string } }>;

  it('builds 46 runs: Claude sends its requests through one process, with a bounded canary message where deferral may be claimed', () => {
    const p = plan();
    expect(p.runs).toHaveLength(46);
    expect(p.blockers).toEqual([]);
    const claude = p.runs.filter((r) => r.arm.host === 'claude');
    expect(claude).toHaveLength(32);
    for (const r of claude) {
      expect(r.command.args).not.toContain('--tools');
      expect(r.command.args.slice(r.command.args.indexOf('--input-format'), r.command.args.indexOf('--input-format') + 2)).toEqual(['--input-format', 'stream-json']);
      expect(r.command.args[r.command.args.indexOf('--model') + 1]).toBe('haiku');
      const canary = r.arm.kind === 'gateway' || (r.arm.kind === 'native' && r.arm.toolSearch !== 'false');
      expect(r.canary !== undefined).toBe(canary);
      expect(r.command.stdin).toHaveLength(canary ? 3 : 2);
      expect(r.requests).toBe(canary ? 6 : 2);
      expect(r.command.args.slice(r.command.args.indexOf('--max-turns'), r.command.args.indexOf('--max-turns') + 2)).toEqual(['--max-turns', '4']);
      for (const line of r.command.stdin!) expect(JSON.parse(line)).toMatchObject({ type: 'user', message: { role: 'user' } });
      if (canary) expect(r.command.stdin![2]).toContain(`\\"${r.canary!.tool}\\"`);
    }
    expect(p.runs.filter((r) => r.arm.host === 'codex').every((r) => r.requests === 1 && r.canary === undefined)).toBe(true);
    expect(p.runs[0]!.arm).toEqual({ host: 'claude', kind: 'baseline' });
  });

  it('writes no session files for either host and ignores the user\'s Codex config', () => {
    for (const r of plan().runs) {
      const args = r.command.args;
      expect(args).not.toContain('resume');
      expect(args).not.toContain('--resume');
      if (r.arm.host === 'codex') for (const flag of ['--ephemeral', '--ignore-user-config', '--ignore-rules']) expect(args).toContain(flag);
      else expect(args).toContain('--no-session-persistence');
    }
  });

  it('keeps every directory it creates or configures under the temp root', () => {
    const root = temp();
    const p = buildPlan(root, {}, clean, []);
    for (const r of p.runs) {
      expect(r.command.cwd.startsWith(root)).toBe(true);
      for (const s of Object.values(r.arm.host === 'claude' ? mcpOf(r) : {})) if (s.env) expect(s.env.LOADOUT_HOME.startsWith(root)).toBe(true);
    }
    expect(() => buildPlan(join(homedir(), '.claude', 'b7-test'), {}, clean, [])).toThrow('temporary');
    expect(() => buildPlan(join(homedir(), '.codex', 'b7-test'), {}, clean, [])).toThrow('temporary');
  });

  it('runs every command of every arm in one working directory, since the prompt carries it', () => {
    const p = plan();
    const free = p.runs.flatMap((r) => Object.values(r.free ?? {}));
    expect(free).toHaveLength(4 * 7);
    expect(new Set([...p.runs.map((r) => r.command), ...free].map((c) => c.cwd))).toEqual(new Set([p.work]));
    expect(p.work.startsWith(p.root)).toBe(true);
  });

  it('gives each free Codex command its own empty CODEX_HOME and no CODEX_SQLITE_HOME, and the paid exec nothing', () => {
    const p = plan({ hosts: ['codex'] }, { PATH: process.env.PATH, CODEX_HOME: '/users/real', CODEX_SQLITE_HOME: '/users/sqlite' });
    const free = p.runs.flatMap((r) => Object.values(r.free ?? {}));
    expect(free).toHaveLength(4 * 7);
    const homes = free.map((c) => c.env!.CODEX_HOME!);
    expect(new Set(homes).size).toBe(free.length);
    for (const home of homes) {
      expect(home.startsWith(join(p.root, 'codex-homes'))).toBe(true);
      expect(readdirSync(home)).toEqual([]);
    }
    expect(free.every((c) => !('CODEX_SQLITE_HOME' in c.env!) && c.env!.PATH === process.env.PATH)).toBe(true);
    expect(p.runs.every((r) => r.command.env?.PATH === process.env.PATH)).toBe(true);
  });

  it('builds every child environment from an allowlist, so a debug log path or a stray variable cannot reach it', () => {
    const ambient = { PATH: '/bin', HOME: '/h', HTTPS_PROXY: 'http://p', NODE_EXTRA_CA_CERTS: '/ca', CODEX_HOME: '/users/real', DEBUG: '1', CLAUDE_CODE_DEBUG_LOGS_DIR: '/elsewhere/log', RANDOM_B7_VAR: 'x', ANTHROPIC_API_KEY: 'k', ENABLE_TOOL_SEARCH: 'auto', CODEX_API_KEY: 'k' };
    const p = plan({}, ambient);
    const commands = p.runs.flatMap((r) => [r.command, ...Object.values(r.free ?? {})]);
    expect(commands.length).toBeGreaterThan(60);
    for (const c of commands) {
      for (const name of ['DEBUG', 'CLAUDE_CODE_DEBUG_LOGS_DIR', 'RANDOM_B7_VAR', 'ANTHROPIC_API_KEY', 'CODEX_API_KEY']) expect(c.env).not.toHaveProperty(name);
      expect(c.env).toMatchObject({ PATH: '/bin', HOME: '/h', HTTPS_PROXY: 'http://p', NODE_EXTRA_CA_CERTS: '/ca' });
    }
    expect(p.runs.filter((r) => r.arm.host === 'claude').every((r) => r.command.env!.ENABLE_TOOL_SEARCH === (r.arm.toolSearch === 'false' || r.arm.toolSearch === 'auto' ? r.arm.toolSearch : undefined))).toBe(true);
    expect(p.runs.find((r) => r.arm.host === 'codex')!.command.env!.CODEX_HOME).toBe('/users/real');
  });

  it('matches allowed names case-insensitively and reports only the names it drops', () => {
    expect(childEnv({ Path: 'C:\\x', systemroot: 'C:\\Windows', https_proxy: 'http://p', Debug: '1' })).toEqual({ Path: 'C:\\x', systemroot: 'C:\\Windows', https_proxy: 'http://p' });
    expect(droppedEnv({ PATH: '/bin', DEBUG: '1', SECRET_TOKEN: 'shh' })).toEqual(['DEBUG', 'SECRET_TOKEN']);
    expect(ENV_ALLOWLIST).toEqual(expect.arrayContaining(['PATH', 'HTTPS_PROXY', 'NODE_EXTRA_CA_CERTS', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR']));
    expect(ENV_ALLOWLIST).not.toContain('DEBUG');
  });

  it('makes the arms of a host differ only by their treatment', () => {
    const p = plan();
    const blank = (r: Run) => {
      const args = [...r.command.args];
      const i = args.indexOf('--mcp-config');
      if (i >= 0) args[i + 1] = '<mcp>';
      return JSON.stringify({ args: args.map((a) => a.replace(/^mcp_servers=.*/, 'mcp_servers=<mcp>')), stdin: r.command.stdin?.slice(0, 2), env: { ...r.command.env, ENABLE_TOOL_SEARCH: undefined }, bin: r.command.bin, cwd: r.command.cwd });
    };
    for (const host of ['claude', 'codex']) {
      const runs = p.runs.filter((r) => r.arm.host === host);
      expect(new Set(runs.map(blank)).size).toBe(1);
    }
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

  it('blocks the Claude arms, naming the files, when managed Claude settings exist', () => {
    expect(managedClaudeFiles('linux')).toEqual(['/etc/claude-code/managed-settings.json', '/etc/claude-code/managed-settings.d', '/etc/claude-code/managed-mcp.json']);
    expect(managedClaudeFiles('darwin')[0]).toBe('/Library/Application Support/ClaudeCode/managed-settings.json');
    expect(managedClaudeFiles('win32')[0]).toContain('ClaudeCode');
    const fake = '/fake/managed-settings.json';
    expect(buildPlan(temp(), {}, clean, [fake]).blockers[0]).toContain(fake);
    expect(buildPlan(temp(), { hosts: ['codex'] }, clean, [fake]).blockers).toEqual([]);
    expect(plan().blockers).toEqual([]);
  });

  it('reports a blocker instead of a misleading default arm', () => {
    expect(plan({}, { ANTHROPIC_BASE_URL: 'http://proxy.invalid' }).blockers[0]).toContain('ANTHROPIC_BASE_URL');
    expect(plan({ hosts: ['codex'] }, { ANTHROPIC_BASE_URL: 'http://proxy.invalid' }).blockers).toEqual([]);
  });

  it('estimates by request, canary lookups included, and brackets the input tokens', async () => {
    const e = estimate(plan().runs, await offline());
    // 24 canary runs of 2 + 4, 8 Claude runs of 2, 14 Codex runs of 1; 24 x 3 + 8 x 2 + 14 stdin messages
    expect(e.requests).toBe(174);
    expect(e.inputTokens[0]).toBe(174 * 8_500);
    expect(e.inputTokens[1]).toBeGreaterThan(e.inputTokens[0]);
    expect(e.seconds).toEqual([174 * 30, 102 * 120]);
  });

  it('names whole resolved directories as writable, with the known files only as examples', () => {
    const [claude, codex] = hostWrites({});
    for (const dir of [join(homedir(), '.claude'), join(homedir(), '.claude.json'), 'claude-cli-nodejs']) expect(claude).toContain(dir);
    expect(codex).toContain(`anywhere in ${join(homedir(), '.codex')},`);
    expect(codex).toContain('managed Codex config');
    const moved = hostWrites({ CLAUDE_CONFIG_DIR: '/c', CODEX_HOME: '/x', XDG_CACHE_HOME: '/cache' });
    for (const dir of ['anywhere in /c,', join('/c', '.claude.json')]) expect(moved[0]).toContain(dir);
    if (process.platform === 'linux') expect(moved[0]).toContain(join('/cache', 'claude-cli-nodejs'));
    expect(moved[1]).toContain('anywhere in /x,');
    expect(hostWrites({ CODEX_HOME: '/x', CODEX_SQLITE_HOME: '/db' })[1]).toContain('anywhere in /x and /db,');
    expect(moved[0]).toContain('DISABLE_UPDATES');
    expect(codex).toContain('installation_id');
    expect(codex).toContain('auth.json');
  });

  it('empties the work directory, and refuses a linked one or one outside the temp root', () => {
    const work = join(temp(), 'work');
    mkdirSync(join(work, 'sub'), { recursive: true });
    writeFileSync(join(work, 'sub', 'left'), 'x');
    resetWork(work);
    expect(readdirSync(work)).toEqual([]);
    const real = temp();
    writeFileSync(join(real, 'precious'), 'x');
    const link = join(temp(), 'link');
    symlinkSync(real, link);
    expect(() => resetWork(link)).toThrow('linked');
    expect(existsSync(join(real, 'precious'))).toBe(true);
    const outside = mkdtempSync(join(process.cwd(), '.b7-outside-'));
    try {
      writeFileSync(join(outside, 'precious'), 'x');
      expect(() => resetWork(outside)).toThrow('temporary');
      expect(existsSync(join(outside, 'precious'))).toBe(true);
    } finally { rmSync(outside, { recursive: true, force: true }); }
  });

  it('main without --run prints the estimate, caveats, host-state writes, env, stdin and argv, and starts no host', async () => {
    const lines: string[] = [];
    await main(['--hosts', 'claude', '--configs', 'n1', '--repeats', '1'], { print: (s) => lines.push(s), run: never });
    expect(lines[0]).toContain('6 runs, 28 paid requests');
    expect(lines[0]).toContain('--max-turns bound of 4');
    const text = lines.join('\n');
    expect(text).toContain('probably undercounts');
    expect(text).toContain('Illustrative');
    expect(lines).toContain(`PRECONDITION: ${CODEX_CLOUD_PRECONDITION}`);
    expect(lines).toContain(`PRECONDITION: ${CLAUDE_MANAGED_PRECONDITION}`);
    expect(lines.find((l) => l.startsWith('ENV: '))).toMatch(/only these variables.*Passed from this environment: .*Dropped \(names only\)/);
    for (const write of hostWrites()) expect(lines).toContain(`HOST STATE: ${write}`);
    const paid = lines.find((l) => l.startsWith('PAID claude/native/n1/false/1'))!;
    expect(paid).toContain('env=ENABLE_TOOL_SEARCH=false,MCP_TIMEOUT=60000');
    expect(paid).toContain('stdin=[');
    expect(lines.find((l) => l.startsWith('PAID claude/native/n1/default/1'))).toContain('ENABLE_TOOL_SEARCH=(unset)');
    await expect(main(['--hosts', 'gemini'], { print: () => {}, run: never })).rejects.toThrow('unknown value');
    await expect(main(['--repeats', '0'], { print: () => {}, run: never })).rejects.toThrow('--repeats');
  });
});

describe('host process', () => {
  it('kills an app-server that ignores the first signal, within the grace and a short second bound', async () => {
    const file = join(temp(), 'stubborn.cjs');
    writeFileSync(file, `
      require('fs').writeFileSync(process.env.PIDFILE, String(process.pid));
      process.on('SIGTERM', () => {});
      setInterval(() => {}, 1000);
      require('readline').createInterface({ input: process.stdin }).on('line', (line) => {
        const m = JSON.parse(line);
        if (m.id !== undefined) console.log(JSON.stringify({ id: m.id, result: {} }));
      });
    `);
    const pidFile = join(temp(), 'pid');
    const started = Date.now();
    await withAppServer({ bin: process.execPath, args: [file], cwd: tmpdir(), env: { ...process.env, PIDFILE: pidFile } }, (request) => request('probe', {}), 200);
    const pid = Number(readFileSync(pidFile, 'utf8'));
    const alive = (() => { try { process.kill(pid, 0); return true; } catch { return false; } })();
    if (alive) process.kill(pid, 'SIGKILL');
    expect(alive).toBe(false);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('fails closed when a child is still alive after SIGKILL and the second bound', async () => {
    const signals: (string | number | undefined)[] = [];
    const stuck = Object.assign(new EventEmitter(), { pid: 4242, exitCode: null, signalCode: null, kill: (signal?: string | number) => { signals.push(signal); return true; } });
    await expect(stopChild(stuck as never, 20, 20)).rejects.toThrow('did not exit after SIGKILL');
    expect(signals).toEqual([undefined, 'SIGKILL']);
    const polite = Object.assign(new EventEmitter(), { pid: 1, exitCode: null as number | null, signalCode: null, kill: () => { setTimeout(() => { polite.exitCode = 0; polite.emit('exit'); }, 10); return true; } });
    await expect(stopChild(polite as never, 200, 20)).resolves.toBeUndefined();
  });

  it('waits for the app-server to exit before returning', async () => {
    const file = join(temp(), 'slow-exit.cjs');
    writeFileSync(file, `
      process.on('SIGTERM', () => setTimeout(() => { require('fs').writeFileSync(process.env.MARKER, 'exited'); process.exit(0); }, 300));
      require('readline').createInterface({ input: process.stdin }).on('line', (line) => {
        const m = JSON.parse(line);
        if (m.id !== undefined) console.log(JSON.stringify({ id: m.id, result: {} }));
      });
    `);
    const marker = join(temp(), 'marker');
    await withAppServer({ bin: process.execPath, args: [file], cwd: tmpdir(), env: { ...process.env, MARKER: marker } }, (request) => request('probe', {}));
    expect(existsSync(marker)).toBe(true);
  });

  it('starts the Codex app-server with the command\'s own environment', async () => {
    const file = join(temp(), 'app-server.cjs');
    writeFileSync(file, `
      require('readline').createInterface({ input: process.stdin }).on('line', (line) => {
        const m = JSON.parse(line);
        if (m.id !== undefined) console.log(JSON.stringify({ id: m.id, result: { home: process.env.CODEX_HOME ?? null } }));
      });
    `);
    const home = temp();
    const ask = (env?: NodeJS.ProcessEnv) => withAppServer({ bin: process.execPath, args: [file], cwd: tmpdir(), env }, (request) => request('probe', {}));
    expect(await ask({ ...process.env, CODEX_HOME: home })).toEqual({ home });
  });

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

  it('collects the canary turn\'s tool calls and results, and allows nothing else there or elsewhere', () => {
    const init = { type: 'system', subtype: 'init', claude_code_version: '2.1.0', model: 'm', tools: [], skills: [], plugins: [], slash_commands: [], mcp_servers: [] };
    const usage = (n: number) => ({ input_tokens: 5, cache_creation_input_tokens: n, cache_read_input_tokens: 0, output_tokens: 1 });
    const turn = (n: number) => [{ type: 'assistant', message: { content: [{ type: 'text', text: 'OK' }], usage: usage(n) } }, { type: 'result', subtype: 'success', num_turns: n }];
    const canary = (name: string) => [
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu1', name, input: { query: 'x' } }], usage: usage(3) } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: [{ type: 'tool_reference', tool_name: 'mcp__a__b' }] }] } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'b' }], usage: usage(4) } },
      { type: 'result', subtype: 'success', num_turns: 5 }];
    const allow = { allow: ['ToolSearch'] };
    const ok = parseClaudeTurns(jsonl(init, ...turn(1), ...turn(2), ...canary('ToolSearch')), 2, allow);
    expect(ok.turns).toHaveLength(2);
    expect(ok.calls).toEqual([{ name: 'ToolSearch', input: { query: 'x' }, isError: false, content: [{ type: 'tool_reference', tool_name: 'mcp__a__b' }] }]);
    const flagged = canary('ToolSearch');
    (flagged[1] as any).message.content[0] = { type: 'tool_result', tool_use_id: 'tu1', is_error: true, content: 'No match for mcp__a__b' };
    expect(parseClaudeTurns(jsonl(init, ...turn(1), ...turn(2), ...flagged), 2, allow).calls).toEqual([{ name: 'ToolSearch', input: { query: 'x' }, isError: true, content: [{ type: 'text', text: 'No match for mcp__a__b' }] }]);
    expect(() => parseClaudeTurns(jsonl(init, ...turn(1), ...turn(2), ...canary('Bash')), 2, allow)).toThrow('tool use');
    expect(() => parseClaudeTurns(jsonl(init, ...turn(1), ...turn(2)), 2, allow)).toThrow('3 results');
    expect(() => parseClaudeTurns(jsonl(init, ...turn(1), ...turn(2), ...canary('ToolSearch')), 2)).toThrow('2 results');
    expect(() => parseClaudeTurns(jsonl(init, ...canary('ToolSearch').slice(0, 1), ...turn(1), ...turn(2), ...turn(3)), 2, allow)).toThrow('tool use');
  });
});

describe('positive controls', () => {
  const native = (toolSearch: Arm['toolSearch']): Arm => ({ host: 'claude', kind: 'native', config: 'n1', toolSearch });
  const names = (n: number) => serverTools(serverSpecs(1)[0]!).slice(0, n).map((t) => `mcp__tracker__${t.name}`);
  const gateway: Arm = { host: 'claude', kind: 'gateway', config: 'n1', toolSearch: 'default' };
  const four = ['find_skills', 'load_skill', 'server_tools', 'call_server_tool'].map((t) => `mcp__loadout__${t}`);

  it('requires every tool when tool search is off', () => {
    expect(() => positiveControl(native('false'), ['Bash', ...names(10)], 50, null)).not.toThrow();
    expect(() => positiveControl(native('false'), ['Bash', 'ToolSearch', ...names(9)], 50, null)).toThrow('9 of 10');
    expect(() => positiveControl(native('false'), ['Bash'], 50, null)).toThrow('0 of 10');
  });

  it('accepts a deferred reading only with ToolSearch present and the canary found, or every tool listed', () => {
    expect(() => positiveControl(native('default'), ['Bash', 'ToolSearch'], 5, true)).not.toThrow();
    expect(() => positiveControl(native('default'), ['Bash', 'ToolSearch'], 5, false)).toThrow('canary');
    expect(() => positiveControl(native('auto'), ['Bash', 'ToolSearch', ...names(3)], 5, false)).toThrow('canary');
    expect(() => positiveControl(native('auto'), ['Bash', ...names(10)], 5, false)).not.toThrow();
    expect(() => positiveControl(native('default'), ['Bash', ...names(3)], 5, true)).toThrow('no ToolSearch');
    expect(() => positiveControl(native('default'), ['Bash'], 5, true)).toThrow('no ToolSearch');
  });

  it('requires loadout\'s four tools behind the gateway, and the canary found through server_tools', () => {
    expect(() => positiveControl(gateway, ['Bash', ...four], 5, true)).not.toThrow();
    expect(() => positiveControl(gateway, ['Bash', ...four], 5, false)).toThrow('canary');
    expect(() => positiveControl(gateway, ['Bash', ...four.slice(1)], 5, true)).toThrow('not listed');
  });

  it('accepts a gateway whose four tools are deferred only with ToolSearch present and the lookup answered', () => {
    expect(() => positiveControl(gateway, ['Bash', 'ToolSearch'], 5, true)).not.toThrow();
    expect(() => positiveControl(gateway, ['Bash', 'ToolSearch'], 5, false)).toThrow('canary');
    expect(() => positiveControl(gateway, ['Bash'], 5, true)).toThrow('cannot reach');
    expect(() => positiveControl({ ...gateway, toolSearch: 'false' }, ['Bash', 'ToolSearch'], 5, true)).toThrow('cannot reach');
  });

  it('requires a positive input delta over the baseline, and none of the baseline itself', () => {
    expect(() => positiveControl(native('default'), ['ToolSearch'], 0, true)).toThrow('no positive input delta');
    expect(() => positiveControl(native('default'), ['ToolSearch'], -3, true)).toThrow('no positive input delta');
    expect(() => positiveControl({ host: 'codex', kind: 'native', config: 'n1' }, null, 0, null)).toThrow('no positive input delta');
    expect(() => positiveControl({ host: 'codex', kind: 'native', config: 'n1' }, null, 1, null)).not.toThrow();
    expect(() => positiveControl({ host: 'claude', kind: 'baseline' }, ['Bash'], 0, null)).not.toThrow();
  });

  it('finds the canary only in the host\'s own structure, never in text that names the tool', () => {
    const c = canaryOf('n5');
    const call = (name: string, content: ToolCall['content'], o: Partial<ToolCall> = {}): ToolCall => ({ name, input: {}, isError: false, content, ...o });
    const ref = (tool_name: string) => ({ type: 'tool_reference', tool_name });
    expect(canaryFound(native('default'), c, [call('ToolSearch', [ref(c.qualified)])])).toBe(true);
    expect(canaryFound(native('default'), c, [call('ToolSearch', [ref('mcp__tracker__get_issue')])])).toBe(false);
    expect(canaryFound(native('default'), c, [call('ToolSearch', [ref(`${c.qualified}_x`)])])).toBe(false);
    expect(canaryFound(native('default'), c, [call('Bash', [ref(c.qualified)])])).toBe(false);
    // an error that names the tool, a reply that echoes the query, and a text block are not a lookup result
    expect(canaryFound(native('default'), c, [call('ToolSearch', [ref(c.qualified)], { isError: true })])).toBe(false);
    expect(canaryFound(native('default'), c, [call('ToolSearch', [{ type: 'text', text: `No tools match "${c.qualified}"` }], { input: { query: c.qualified } })])).toBe(false);
    expect(canaryFound(native('default'), c, [call('ToolSearch', [{ type: 'text', text: c.qualified }])])).toBe(false);
    expect(canaryFound(native('default'), c, [call('ToolSearch', [{ type: 'text', tool_name: c.qualified }])])).toBe(false);
    const list = (server: string, text: string, o: Partial<ToolCall> = {}) => [call('mcp__loadout__server_tools', [{ type: 'text', text }], { input: { server }, ...o })];
    expect(canaryFound(gateway, c, list(c.server, `- other: x\n- ${c.tool}: desc\n  input schema: {}`))).toBe(true);
    expect(canaryFound(gateway, c, list(`mcp:${c.server}`, `${c.tool}: desc\ninput schema: {}`))).toBe(true);
    expect(canaryFound(gateway, c, list(c.server, `- other: mentions ${c.tool}`))).toBe(false);
    expect(canaryFound(gateway, c, list(c.server, `- ${c.tool}_x: desc`))).toBe(false);
    expect(canaryFound(gateway, c, list(c.server, `- ${c.tool}: desc`, { isError: true }))).toBe(false);
    expect(canaryFound(gateway, c, list('tracker', `- ${c.tool}: desc`))).toBe(c.server === 'tracker');
    expect(canaryFound(gateway, c, [call('ToolSearch', [ref(c.qualified)])])).toBe(false);
  });

  it('picks a different canary per configuration: the last tool of the last server', () => {
    const picks = (['n1', 'n5', 'n20'] as const).map(canaryOf);
    expect(new Set(picks.map((c) => c.qualified)).size).toBe(3);
    expect(picks[2]!.server).toBe(serverSpecs(20).at(-1)!.name);
    expect(picks[0]!.tool).toBe(serverTools(serverSpecs(1)[0]!).at(-1)!.name);
  });

  it('labels a row deferred only when fewer tools were listed than configured', () => {
    const row = (o: Partial<Row>): Row => ({ host: 'claude', kind: 'native', config: 'n1', toolSearch: 'default', mcpToolsListed: 0, toolSearchListed: true, ...o }) as Row;
    expect(reading(row({}))).toBe('deferred (canary found)');
    expect(reading(row({ mcpToolsListed: 10 }))).toBe('all loaded (ToolSearch present)');
    expect(reading(row({ mcpToolsListed: 10, toolSearchListed: false }))).toBe('all loaded (no ToolSearch)');
    expect(reading(row({ toolSearch: 'false', mcpToolsListed: 10 }))).toBe('all loaded');
    expect(reading(row({ kind: 'gateway' }))).toBe('gateway');
    expect(reading(row({ kind: 'baseline' }))).toBe('');
    expect(reading(row({ host: 'codex', toolSearch: null }))).toBe('not shown');
    expect(reading(row({ host: 'codex', kind: 'baseline' }))).toBe('');
    expect(summarize([row({ config: 'n20', mcpToolsListed: 485, toolSearchListed: false, repeat: 1, turn: 1 })])).toContain('Tool search was not listed for native default at n20');
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
  type Lookup = 'found' | 'missing' | 'error' | 'echo';
  interface Opts { canary?: (run: Run) => Lookup; version?: (call: number) => string | undefined; plugin?: (call: number) => string; status?: string; extraServer?: boolean; toolUse2?: boolean; numTurns1?: number; tools?: (run: Run, base: string[]) => string[]; flat?: boolean; features?: boolean; codexVersion?: (call: number) => string; inventory?: (run: Run) => Map<string, string[]>; byOrder?: boolean; findSkills?: boolean }
  /**
   * A fake Claude and Codex that report what the plan declared: tools follow the tool search setting (under it loadout's own
   * four are deferred as well), counters grow with the servers. Each command finds the work directory empty or the test fails.
   */
  function fakeHost(p: Plan, o: Opts = {}) {
    const calls: Command[] = [];
    const listings: string[][] = [];
    let claudeCalls = 0, versions = 0, order = 0;
    const owner = new Map<Command, Run>(p.runs.flatMap((r) => [r.command, ...Object.values(r.free ?? {})].map((c): [Command, Run] => [c, r])));
    const run = async (command: Command) => {
      calls.push(command);
      listings.push(readdirSync(command.cwd));
      writeFileSync(join(command.cwd, 'stale'), 'left by a host');
      const r = o.byOrder ? p.runs[order++]! : owner.get(command)!;
      const args = command.args;
      if (args.includes('features')) return DISABLED_FEATURES.map((name) => `${name} stable ${o.features === false ? 'true' : 'false'}`).join('\n');
      if (args.includes('prompt-input')) return JSON.stringify([{ type: 'message', content: [{ type: 'input_text', text: 'rendered' }] }]);
      if (args.includes('--version')) return `${o.codexVersion?.(versions++) ?? 'codex-cli 9.9.9'}\n`;
      const delta = o.flat || r.arm.kind === 'baseline' ? 0 : 10 * Math.max(1, r.servers.length);
      if (r.arm.host === 'codex') return jsonl({ type: 'thread.started', thread_id: 'thread-1' }, { type: 'turn.completed', usage: { input_tokens: 1000 + delta, cached_input_tokens: 0, output_tokens: 1 } });
      const call = claudeCalls++;
      const all = r.arm.kind === 'native' ? serverSpecs(r.servers.length).flatMap((s) => serverTools(s).map((t) => `mcp__${s.name}__${t.name}`))
        : r.arm.kind === 'gateway' ? ['find_skills', 'load_skill', 'server_tools', 'call_server_tool'].map((t) => `mcp__loadout__${t}`) : [];
      const deferred = r.arm.kind !== 'baseline' && r.command.env?.ENABLE_TOOL_SEARCH !== 'false';
      const base = ['Bash', ...(deferred ? ['ToolSearch'] : all)];
      const listed = [...r.servers, ...(o.extraServer ? ['ambient-extra'] : [])];
      const turn = (usage: object, numTurns: number, content: unknown[] = [{ type: 'text', text: 'OK' }]) => [{ type: 'assistant', message: { content, usage } }, { type: 'result', subtype: 'success', num_turns: numTurns, usage: { input_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1, output_tokens: 1 } }];
      const use = (id: string, name: string, input: object) => ({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name, input }], usage: {} } });
      const result = (id: string, content: unknown, isError = false) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content }] } });
      const lookup = (): unknown[] => {
        if (!r.canary) return [];
        const how = o.canary?.(r) ?? 'found';
        const tool = r.canary.tool;
        // The gateway's server_tools is itself deferred under tool search, so the host first returns it from ToolSearch.
        const reach = [...(o.findSkills ? [use('fs', 'mcp__loadout__find_skills', { query: tool }), result('fs', [{ type: 'text', text: 'no skills' }])] : []),
          ...(r.arm.kind === 'gateway' && deferred ? [use('ts', 'ToolSearch', { query: 'server_tools' }), result('ts', [{ type: 'tool_reference', tool_name: 'mcp__loadout__server_tools' }])] : [])];
        if (r.arm.kind === 'gateway') {
          const text = { found: `- other: x\n- ${tool}: desc\n  input schema: {}`, missing: '- other: x', error: `- ${tool}: desc`, echo: `- other: you asked for ${tool}` }[how];
          return [...reach, use('tu', 'mcp__loadout__server_tools', { server: r.canary.server }), result('tu', [{ type: 'text', text }], how === 'error')];
        }
        const content = { found: [{ type: 'tool_reference', tool_name: r.canary.qualified }], missing: [{ type: 'tool_reference', tool_name: 'mcp__x__y' }],
          error: [{ type: 'text', text: `no match for ${r.canary.qualified}` }], echo: [{ type: 'text', text: r.canary.qualified }] }[how];
        return [use('tu', 'ToolSearch', { query: tool }), result('tu', content, how === 'error')];
      };
      const canaryTurn = !r.canary ? [] : [...lookup(), ...turn({ input_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 100, output_tokens: 1 }, 5)];
      return jsonl(
        { type: 'system', subtype: 'init', claude_code_version: o.version ? o.version(call) : '2.0.0', model: 'haiku-resolved', skills: ['s'], plugins: [{ name: o.plugin?.(call) ?? SECRET_PLUGIN }], slash_commands: ['c'],
          tools: o.tools ? o.tools(r, base) : base, mcp_servers: listed.map((name) => ({ name, status: o.status ?? 'connected' })) },
        ...turn({ input_tokens: 5, cache_creation_input_tokens: 100 + delta, cache_read_input_tokens: 0, output_tokens: 1 }, o.numTurns1 ?? 1),
        ...turn({ input_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 100 + delta, output_tokens: 1 }, 2, o.toolUse2 ? [{ type: 'tool_use', name: 'x' }] : undefined),
        ...canaryTurn);
    };
    const inventory = async (command: Command) => {
      const r = p.runs.find((x) => x.free?.inventory === command)!;
      if (o.inventory) return o.inventory(r);
      return new Map<string, string[]>(r.arm.kind === 'native' ? serverSpecs(r.servers.length).map((s) => [s.name, serverTools(s).map((t) => t.name)])
        : r.arm.kind === 'gateway' ? [['loadout', ['find_skills', 'load_skill', 'server_tools', 'call_server_tool']]] : []);
    };
    return { run, inventory, calls, listings };
  }
  const small = () => buildPlan(temp(), { configs: ['n1'], repeats: 1 }, { PATH: process.env.PATH }, []);
  const study = (o: Opts = {}, p = small()) => { const h = fakeHost(p, o); return runStudy(p, temp(), { run: h.run, inventory: h.inventory, managed: () => [] }); };

  it('measures both Claude requests of a run and one Codex request, without keeping inventory names', async () => {
    const p = small();
    const out = temp();
    const h = fakeHost(p);
    const { rows, notes } = await runStudy(p, out, { run: h.run, inventory: h.inventory, managed: () => [] });
    expect(rows).toHaveLength(6 * 2 + 3);
    expect(notes).toEqual([]);
    const claude = rows.filter((r) => r.host === 'claude');
    expect(claude.find((r) => r.turn === 2 && r.kind === 'native')!.cacheRead).toBeGreaterThan(100);
    expect(claude.every((r) => r.hostVersion === '2.0.0')).toBe(true);
    expect(rows.filter((r) => r.host === 'codex').every((r) => r.turn === 1 && r.hostVersion === 'codex-cli 9.9.9')).toBe(true);
    expect(claude.find((r) => r.kind === 'native' && r.toolSearch === 'false')).toMatchObject({ mcpToolsListed: 10, toolSearchListed: false });
    expect(claude.find((r) => r.kind === 'native' && r.toolSearch === 'default')).toMatchObject({ mcpToolsListed: 0, toolSearchListed: true });
    expect(claude.find((r) => r.kind === 'gateway' && r.toolSearch === 'default')).toMatchObject({ mcpToolsListed: 0, toolSearchListed: true, canaryFound: true });
    expect(claude.find((r) => r.kind === 'gateway' && r.toolSearch === 'false')).toMatchObject({ mcpToolsListed: 4, canaryFound: true });
    expect(claude.find((r) => r.kind === 'baseline')).toMatchObject({ mcp: [], toolsListed: 1 });
    const saved = readFileSync(join(out, 'rows.jsonl'), 'utf8');
    expect(saved.trim().split('\n')).toHaveLength(rows.length);
    expect(saved).not.toContain(SECRET_PLUGIN);
    expect(summarize(rows, notes)).toContain('| claude | native | n1 | false | all loaded | 1 | 1 |');
    expect(h.calls.filter((c) => c.stdin).length).toBe(6);
    expect(h.listings).toHaveLength(h.calls.length);
    expect(h.listings.every((l) => l.length === 0)).toBe(true);
    expect(claude.filter((r) => r.canaryFound === true).length).toBe(2 * 4);
    expect(claude.filter((r) => r.canaryFound === null).every((r) => r.kind === 'baseline' || r.toolSearch === 'false')).toBe(true);
  });

  it('records a Codex preflight with the version and counts, never the context', async () => {
    const p = small();
    const out = temp();
    const h = fakeHost(p);
    await runStudy(p, out, { run: h.run, inventory: h.inventory, managed: () => [] });
    const lines = readFileSync(join(out, 'preflight.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ arm: 'codex/baseline', version: 'codex-cli 9.9.9', refusals: [] });
    expect(lines[0].renderedCharacters).toBe(8);
  });

  it('refuses the Codex arms, naming the file, when a system or managed Codex config exists', async () => {
    expect(managedCodexFiles('linux')).toEqual(['/etc/codex/config.toml', '/etc/codex/requirements.toml', '/etc/codex/managed_config.toml']);
    // Codex asks Windows for ProgramData and falls back to C:\ProgramData, so both are checked, once each
    const under = (dir: string) => ['config.toml', 'requirements.toml'].map((f) => join(dir, 'OpenAI', 'Codex', f));
    expect(managedCodexFiles('win32', { ProgramData: 'D:\\PD' })).toEqual([...under('D:\\PD'), ...under('C:\\ProgramData')]);
    expect(managedCodexFiles('win32', { ProgramData: 'c:\\programdata' })).toHaveLength(2);
    expect(managedCodexFiles('win32', {})).toHaveLength(2);
    const p = small();
    const h = fakeHost(p);
    const fake = join(temp(), 'requirements.toml');
    const { rows, notes } = await runStudy(p, temp(), { run: h.run, inventory: h.inventory, managed: () => [fake] });
    expect(rows.some((r) => r.host === 'codex')).toBe(false);
    expect(rows.some((r) => r.host === 'claude')).toBe(true);
    expect(notes[0]).toContain(fake);
    expect(h.calls.some((c) => c.args.includes('exec') || c.args.includes('features'))).toBe(false);
    const clear = fakeHost(p);
    expect((await runStudy(p, temp(), { run: clear.run, inventory: clear.inventory, managed: () => [] })).rows.some((r) => r.host === 'codex')).toBe(true);
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
    const ambient = await runStudy(p, out, { run: h.run, inventory: h.inventory, managed: () => [] });
    expect(ambient.rows.some((r) => r.host === 'codex')).toBe(false);
    const saved = readFileSync(join(out, 'preflight.jsonl'), 'utf8');
    expect(saved).toContain('differs from the arm');
    expect(saved).not.toContain('my-private-server');
  });

  it('refuses when the Codex version changes during the study', async () => {
    await expect(study({ codexVersion: (n) => `codex-cli 9.9.${n}` })).rejects.toThrow('Codex version changed');
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

  it('lets the model try find_skills before the gateway lookup in the canary turn', async () => {
    const { rows } = await study({ findSkills: true });
    expect(rows.filter((r) => r.kind === 'gateway' && r.canaryFound).length).toBe(4);
  });

  it('refuses a row whose canary lookup found nothing, errored or only echoed the query, for tool search and for the gateway', async () => {
    for (const how of ['missing', 'error', 'echo'] as const) {
      await expect(study({ canary: (r) => (r.arm.kind === 'native' ? how : 'found') })).rejects.toThrow('canary');
      await expect(study({ canary: (r) => (r.arm.kind === 'gateway' ? how : 'found') })).rejects.toThrow('server_tools did not list the canary tool');
    }
    await expect(study({ tools: (r, base) => (r.arm.kind === 'native' && r.arm.toolSearch === 'default' ? ['Bash'] : base) })).rejects.toThrow('no ToolSearch');
    await expect(study({ tools: (r, base) => (r.arm.kind === 'gateway' && r.arm.toolSearch === 'default' ? ['Bash'] : base) })).rejects.toThrow('cannot reach');
  });

  it('refuses an MCP arm with no positive input delta over its baseline', async () => {
    await expect(study({ flat: true })).rejects.toThrow('no positive input delta');
  });

  it('does not save the rows of a run that fails a control', async () => {
    const p = small();
    const out = temp();
    const h = fakeHost(p, { tools: (r, base) => (r.arm.kind === 'gateway' ? ['Bash'] : base) });
    await expect(runStudy(p, out, { run: h.run, inventory: h.inventory, managed: () => [] })).rejects.toThrow();
    const saved = readFileSync(join(out, 'rows.jsonl'), 'utf8');
    expect(saved).not.toContain('"kind":"gateway"');
  });

  it('leaves INCOMPLETE beside the partial rows of a run that stops, and removes it when the run finishes', async () => {
    const only = ['--run', '--hosts', 'claude', '--configs', 'n1', '--repeats', '1'];
    vi.stubEnv('ANTHROPIC_BASE_URL', '');
    try {
      const stopped = temp();
      const p = buildPlan(temp(), { hosts: ['claude'], configs: ['n1'], repeats: 1 }, { PATH: process.env.PATH }, []);
      const bad = fakeHost(p, { byOrder: true, tools: (r, base) => (r.arm.kind === 'gateway' ? ['Bash'] : base) });
      await expect(main(only, { print: () => {}, run: bad.run, out: stopped })).rejects.toThrow();
      expect(existsSync(join(stopped, 'INCOMPLETE'))).toBe(true);
      expect(readFileSync(join(stopped, 'rows.jsonl'), 'utf8')).toContain('"kind":"baseline"');
      expect(existsSync(join(stopped, 'summary.md'))).toBe(false);
      const done = temp();
      const good = fakeHost(p, { byOrder: true });
      await main(only, { print: () => {}, run: good.run, out: done });
      expect(existsSync(join(done, 'INCOMPLETE'))).toBe(false);
      expect(readFileSync(join(done, 'summary.md'), 'utf8')).toContain('B7 input tokens per request');
    } finally { vi.unstubAllEnvs(); }
  });

  it('does not measure while a blocker stands', async () => {
    const blocked: Plan = { ...small(), blockers: ['ANTHROPIC_BASE_URL is set'] };
    const h = fakeHost(blocked);
    await expect(runStudy(blocked, temp(), { run: h.run })).rejects.toThrow('blocked');
    expect(h.calls).toHaveLength(0);
  });
});
