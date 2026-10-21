import { execFileSync, spawn, spawnSync } from 'node:child_process';
import * as childProcess from 'node:child_process';
import * as benchLib from '../bench/lib.js';
import * as overhead from '../bench/overhead.js';
import * as mcpOverhead from '../bench/mcp-overhead.js';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CREDENTIAL_SHAPE, persistJson, redact, report, type RunRow, type Verdict } from '../bench/ab-report.js';
import { JUDGE_MAX_BYTES } from '../bench/pairwise.js';
import { AB_MODELS, blockers, buildCommand, checkRun, copyOutputs, hiddenResult, hookFacts, main, openedSkills, planLines, promptText, provenance, redactNames, refuseOtherSettings, refuseStopped, routedByKeyword, runEnv, schedule, scrub, type Ctx, type Evidence, type Job, type Options } from '../bench/ab.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { JEV_FALLBACK_NOTE, NO_KEY_WARNING } from '../src/hook.js';
import { hookShim, toolEvents } from '../bench/stream.js';
import { claudeUsage, codexUsage, effectiveInput } from '../bench/usage.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFileSync: vi.fn(actual.execFileSync) };
});

const temps: string[] = [];
const temp = (prefix: string) => { const dir = mkdtempSync(join(tmpdir(), prefix)); temps.push(dir); return dir; };
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
beforeEach(() => { vi.stubEnv('LOADOUT_HOME', temp('loadout-ab-home-')); vi.stubEnv('TYPESAFE_API_KEY', ''); });
afterEach(() => vi.unstubAllEnvs());

const repo = join(import.meta.dirname, '..');
const claudeStream = readFileSync(join(import.meta.dirname, 'fixtures', 'ab', 'claude-loadout.jsonl'), 'utf8');
const codexStream = readFileSync(join(import.meta.dirname, 'fixtures', 'ab', 'codex-loadout.jsonl'), 'utf8');

describe('usage per request', () => {
  it('reads Claude requests once each, with the four counters apart', () => {
    const u = claudeUsage(claudeStream);
    // msg_01A arrives as two events (a thinking block and a tool_use block) with the same usage.
    expect(u.requests).toHaveLength(3);
    expect(u.requests.map((r) => [r.uncached, r.cacheWrite, r.cacheRead, r.output])).toEqual([[3, 4100, 21000, 210], [1, 900, 25100, 480], [1, 300, 26000, 40]]);
    expect(u.requests[0]).toMatchObject({ n: 1, at: '2026-10-19T10:00:06.000Z', cacheWrite5m: 4100, cacheWrite1h: 0 });
    expect(u).toMatchObject({ granularity: 'request', costUsd: 0.1234, turns: 3, model: 'claude-sonnet-5', version: '2.1.281', unreconciled: [] });
  });

  it('keeps the largest output count of a message and skips synthetic messages', () => {
    const line = (id: string, model: string, out: number) => JSON.stringify({ type: 'assistant', message: { id, model, usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 10, output_tokens: out } } });
    const u = claudeUsage([line('m1', 'claude-sonnet-5', 5), line('m1', 'claude-sonnet-5', 90), line('x', '<synthetic>', 0)].join('\n'));
    expect(u.requests.map((r) => r.output)).toEqual([90]);
    expect(u.unreconciled).toEqual(['no result usage']);
  });

  it('marks subagent requests and keeps the result event\'s totals per model', () => {
    const line = (id: string, parent?: string) => JSON.stringify({ type: 'assistant', ...(parent ? { parent_tool_use_id: parent } : {}), message: { id, model: 'claude-sonnet-5', usage: { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 10, output_tokens: 2 } } });
    const result = JSON.stringify({ type: 'result', usage: { input_tokens: 2, cache_creation_input_tokens: 0, cache_read_input_tokens: 20, output_tokens: 4 }, modelUsage: { 'claude-sonnet-5': { inputTokens: 1 }, 'claude-haiku-5': { inputTokens: 1 } } });
    const u = claudeUsage([line('m1'), line('m2', 'toolu_1'), result].join('\n'));
    expect(u.requests.map((r) => r.subagent)).toEqual([false, true]);
    expect(Object.keys(u.modelUsage ?? {})).toEqual(['claude-sonnet-5', 'claude-haiku-5']);
    expect(codexUsage(codexStream).modelUsage).toBeNull();
  });

  it('says which counters differ from the result event', () => {
    const lines = claudeStream.trim().split('\n');
    const result = JSON.parse(lines.pop()!);
    result.usage.cache_read_input_tokens += 7;
    expect(claudeUsage([...lines, JSON.stringify(result)].join('\n')).unreconciled).toEqual(['cacheRead']);
  });

  it('rejects an assistant message without usage rather than counting zero', () => {
    expect(() => claudeUsage(JSON.stringify({ type: 'assistant', message: { id: 'm', model: 'claude-sonnet-5', usage: {} } }))).toThrow('input_tokens');
  });

  it('reads Codex as one thread total and splits cached from uncached input', () => {
    const u = codexUsage(codexStream);
    expect(u.granularity).toBe('turn');
    expect(u.requests).toHaveLength(1);
    expect(u.requests[0]).toMatchObject({ uncached: 9000, cacheRead: 52000, cacheWrite: 0, output: 2300, reasoning: 900 });
    expect(u.costUsd).toBeNull();
    expect(() => codexUsage('{"type":"turn.started"}')).toThrow('no completed turn');
    expect(() => codexUsage('{"type":"turn.completed","usage":{"input_tokens":5,"cached_input_tokens":9,"output_tokens":1}}')).toThrow('cached input exceeds input');
  });

  it('weights cache writes and reads by Anthropic\'s multipliers', () => {
    expect(effectiveInput({ uncached: 100, cacheWrite: 1000, cacheRead: 10000, cacheWrite5m: 600, cacheWrite1h: 400 })).toBe(100 + 750 + 800 + 1000);
    expect(effectiveInput({ uncached: 0, cacheWrite: 400, cacheRead: 0, cacheWrite5m: null, cacheWrite1h: null })).toBe(500);
  });
});

describe('schedule', () => {
  const jobs = schedule(['claude', 'codex'], ['p1', 'p2', 'p3'], 2);
  it('starts every host and arm with a warm-up and keeps the hosts apart', () => {
    expect(jobs).toHaveLength(2 * (2 + 3 * 2 * 2));
    expect(jobs.slice(0, 2).map((j) => [j.host, j.arm, j.warmup, j.repeat])).toEqual([['claude', 'bare', true, 0], ['claude', 'loadout', true, 0]]);
    expect(jobs.filter((j) => j.host === 'claude').every((j, i, all) => i === 0 || all[i - 1]!.seq < j.seq)).toBe(true);
    expect(jobs.findIndex((j) => j.host === 'codex')).toBe(14);
    expect(jobs.filter((j) => j.warmup).every((j) => j.prompt === 'warmup')).toBe(true);
  });

  it('interleaves the arms, and the arm that goes first alternates by prompt and repeat', () => {
    const measured = jobs.filter((j) => j.host === 'claude' && !j.warmup);
    for (let i = 0; i < measured.length; i += 2) {
      expect(measured[i]!.arm).not.toBe(measured[i + 1]!.arm);
      expect([measured[i]!.prompt, measured[i]!.repeat]).toEqual([measured[i + 1]!.prompt, measured[i + 1]!.repeat]);
    }
    const first = (prompt: string, repeat: number) => measured.find((j) => j.prompt === prompt && j.repeat === repeat)!.arm;
    expect(first('p1', 1)).not.toBe(first('p2', 1));
    expect(first('p1', 1)).not.toBe(first('p1', 2));
    expect(measured.filter((_, i) => i % 2 === 0).filter((j) => j.arm === 'bare')).toHaveLength(measured.length / 4);
  });
});

const options: Options = { hosts: ['claude', 'codex'], ids: ['c1-web-14', 'c1-apps-08', 'c1-debug-13'], repeats: 2, models: AB_MODELS, maxTurns: 30, timeoutS: 600, codexHook: true };
const ctx = (env: NodeJS.ProcessEnv = {}): Ctx => ({ work: '/w/work', shimDir: '/w/shim', configDir: '/w/home', env: { PATH: '/usr/bin', HOME: '/home/u', ...env }, models: AB_MODELS, maxTurns: 30, codexHook: true });
const job = (host: Job['host'], arm: Job['arm']): Job => ({ host, arm, prompt: 'c1-web-14', repeat: 1, warmup: false, seq: 0 });

/** Removes `piece` from `args` once, for the "differs only by" comparisons. */
const without = (args: string[], piece: string[]) => {
  const at = args.findIndex((_, i) => piece.every((p, j) => args[i + j] === p));
  return at < 0 ? args : [...args.slice(0, at), ...args.slice(at + piece.length)];
};

describe('commands', () => {
  it('give the Claude arms the same flags, apart from the plugin, the MCP server and their two tools', () => {
    const bare = buildCommand(job('claude', 'bare'), 'P', ctx());
    const loadout = buildCommand(job('claude', 'loadout'), 'P', ctx());
    const mcp = (c: typeof bare) => JSON.parse(c.args[c.args.indexOf('--mcp-config') + 1]!).mcpServers;
    expect(mcp(bare)).toEqual({});
    expect(Object.keys(mcp(loadout))).toEqual(['loadout']);
    expect(mcp(buildCommand(job('claude', 'loadout'), 'P', ctx({ TYPESAFE_BASE_URL: 'https://jev.example.invalid' }))).loadout.env.TYPESAFE_BASE_URL).toBe('https://jev.example.invalid');
    const strip = (c: typeof bare) => { const a = [...c.args]; a[a.indexOf('--mcp-config') + 1] = '{}'; return a; };
    const extras = ['--plugin-dir', loadout.args[loadout.args.indexOf('--plugin-dir') + 1]!];
    expect(without(without(strip(loadout), extras), ['mcp__loadout__find_tools', 'mcp__loadout__load_skill'])).toEqual(strip(bare));
    expect(loadout.args[loadout.args.indexOf('--plugin-dir') + 1]).toMatch(/plugins[\\/]loadout$/);
    for (const c of [bare, loadout]) {
      expect(c.args).not.toContain('--restricted');
      expect(c.args.slice(0, 2)).toEqual(['-p', 'P']);
      expect(c.args[c.args.indexOf('--model') + 1]).toBe('sonnet');
      expect(c.args.join(' ')).not.toContain('disableAllHooks');
      expect(c.args[c.args.indexOf('--setting-sources') + 1]).toBe('');
    }
  });

  it('give the Codex arms the same flags, apart from the MCP server and hook; the bare arm has hooks off', () => {
    const bare = buildCommand(job('codex', 'bare'), 'P', ctx());
    const loadout = buildCommand(job('codex', 'loadout'), 'P', ctx());
    expect(bare.args).toContain('hooks');
    expect(bare.args.join(' ')).not.toContain('mcp_servers');
    expect(loadout.args).not.toContain('hooks');
    expect(loadout.args).toEqual(expect.arrayContaining(['--dangerously-bypass-hook-trust', '--ignore-user-config', '--ephemeral']));
    expect(loadout.args.find((a) => a.startsWith('mcp_servers.loadout='))).toContain('required');
    expect(loadout.args.find((a) => a.startsWith('mcp_servers.loadout='))).toContain('"env_vars" = ["TYPESAFE_API_KEY", "TYPESAFE_BASE_URL"]');
    expect(loadout.args.find((a) => a.startsWith('hooks.UserPromptSubmit='))).toContain('loadout hook codex');
    expect(loadout.args.at(-1)).toBe('P');
    expect(bare.args.slice(bare.args.indexOf('-m'), bare.args.indexOf('-m') + 2)).toEqual(['-m', 'gpt-6.1-sol']);
  });

  it('keep the hook out of the Codex loadout arm with --no-codex-hook', () => {
    const c = buildCommand(job('codex', 'loadout'), 'P', { ...ctx(), codexHook: false });
    expect(c.args.join(' ')).not.toContain('hooks.UserPromptSubmit');
    expect(c.args).not.toContain('--dangerously-bypass-hook-trust');
    expect(c.args).toContain('hooks');
  });

  it('pass credentials by allowlist: the key reaches the loadout arm only, the subscription token neither', () => {
    const env = { TYPESAFE_API_KEY: 'key-value', TYPESAFE_BASE_URL: 'https://jev.example.invalid', LOADOUT_HOME: '/h', ANTHROPIC_API_KEY: 'api-value', OPENAI_API_KEY: 'o-value', CLAUDE_CODE_OAUTH_TOKEN: 'token-value' };
    const bare = runEnv(job('claude', 'bare'), ctx(env));
    const loadout = runEnv(job('claude', 'loadout'), ctx(env));
    for (const host of ['claude', 'codex'] as const) {
      expect(runEnv(job(host, 'bare'), ctx(env))).not.toHaveProperty('TYPESAFE_BASE_URL');
      expect(runEnv(job(host, 'loadout'), ctx(env)).TYPESAFE_BASE_URL).toBe(env.TYPESAFE_BASE_URL);
    }
    expect(Object.keys(bare)).not.toEqual(expect.arrayContaining(['TYPESAFE_API_KEY']));
    expect(loadout).toMatchObject({ TYPESAFE_API_KEY: 'key-value', LOADOUT_HOME: '/h', CLAUDE_CONFIG_DIR: '/w/home' });
    expect(JSON.stringify([bare, loadout, runEnv(job('codex', 'loadout'), ctx(env))])).not.toMatch(/api-value|o-value|token-value/);
    expect(bare.PATH?.startsWith('/w/shim')).toBe(true);
  });

  it('append the shared note to the copy prompts and a corrected one to the fixture prompt', () => {
    expect(promptText({ id: 'c1-web-14', kind: 'copy' })).toContain('the folder is empty');
    const code = promptText({ id: 'c1-debug-13', kind: 'code', fixture: 'c1-debug-13' });
    expect(code).toContain('the project is in this folder');
    expect(code).not.toContain('folder is empty');
    expect(code).toContain('Put every deliverable in this folder.');
  });
});

describe('plan', () => {
  const secrets = { CLAUDE_CODE_OAUTH_TOKEN: 'oauth-secret-value', TYPESAFE_API_KEY: 'jev-secret-value', ANTHROPIC_API_KEY: 'anthropic-secret-value' };
  const lines = planLines(options, { PATH: '/usr/bin', HOME: '/home/u', ...secrets });
  const text = lines.join('\n');

  it('prints both hosts\' argv and env names, never a value', () => {
    for (const host of ['claude', 'codex']) for (const arm of ['bare', 'loadout']) expect(text).toContain(`ARGV ${host}/${arm}:`);
    expect(text).toContain('CLAUDE_CODE_OAUTH_TOKEN (injected at launch)');
    expect(text).toContain('TYPESAFE_API_KEY');
    expect(text).not.toMatch(/secret-value/);
  });

  it('lists where each host may write and what the study cannot verify offline', () => {
    expect(text).toContain('HOST STATE: Claude Code may write');
    expect(text).toContain('HOST STATE: Codex exec may write');
    expect(text).toContain('UNVERIFIED offline');
    expect(text).toContain('28 paid runs (4 warm-ups)');
  });

  it('plans one host when asked', () => {
    expect(planLines({ ...options, hosts: ['codex'] }, {}).join('\n')).not.toContain('ARGV claude');
  });

  it('blocks a Claude run without the subscription token and a loadout arm that cannot route', () => {
    const found = blockers({ ...options, hosts: ['claude'] }, { PATH: '/usr/bin' });
    expect(found.some((b) => b.includes('CLAUDE_CODE_OAUTH_TOKEN'))).toBe(true);
  });

  it.each([
    { name: 'task-specific-instructions-for-the-application', folder: 'sample' },
    { name: 'Task specific instructions for apps', folder: 'task-specific-instructions-for-apps' },
  ])('blocks library names or keys that redaction would change before spending ($folder)', ({ name, folder }) => {
    const home = process.env.LOADOUT_HOME!;
    writeFileSync(join(home, 'config.json'), JSON.stringify({ router: 'lexical', embeddings: false }));
    const skill = join(home, 'library', 'skills', 'sample', 'SKILL.md');
    mkdirSync(join(skill, '..'), { recursive: true });
    const check = () => blockers({ ...options, hosts: ['codex'] }, { LOADOUT_AB_SELF_TEST: 'lexical', CODEX_HOME: join(home, 'codex') })
      .filter((b) => b.includes('library capability names requiring redaction'));
    writeFileSync(skill, '---\nname: sample\ndescription: Test fixture\n---\nText');
    expect(check()).toEqual([]);
    const target = join(home, 'library', 'skills', folder, 'SKILL.md');
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, `---\nname: ${name}\ndescription: Test fixture\n---\nText`);
    const found = check();
    expect(found).toEqual(['library capability names requiring redaction: 1; blind judging is not possible']);
    expect(found.join('\n')).not.toContain(name);
    expect(found.join('\n')).not.toContain(folder);
  });

  it('refuses a global AGENTS.md or AGENTS.override.md in CODEX_HOME, a symlink included, which Codex puts in every run', () => {
    const blocked = (home: string) => blockers({ ...options, hosts: ['codex'] }, { CODEX_HOME: home }).filter((b) => b.includes('global instructions'));
    expect(blocked(temp('loadout-ab-codex-'))).toEqual([]);
    for (const name of ['AGENTS.md', 'AGENTS.override.md']) {
      const home = temp('loadout-ab-codex-');
      writeFileSync(join(home, name), 'Load the Impeccable skill.\n');
      expect(blocked(home)).toHaveLength(1);
      expect(blocked(home)[0]).toContain(name);
    }
    const home = temp('loadout-ab-codex-');
    const shared = join(temp('loadout-ab-shared-'), 'AGENTS.md');
    writeFileSync(shared, 'global\n');
    try { symlinkSync(shared, join(home, 'AGENTS.md')); } catch { return; } // Windows without the privilege to link
    expect(blocked(home)).toHaveLength(1);
    expect(blockers({ ...options, hosts: ['claude'] }, { CODEX_HOME: home }).some((b) => b.includes('global instructions'))).toBe(false);
  });

  it.each([
    { label: 'non-default without override', baseUrl: 'https://jev.example.invalid', override: undefined, ambient: 'https://ambient.example.invalid', blocked: true },
    { label: 'non-default with override', baseUrl: 'https://jev.example.invalid', override: 'https://override.example.invalid', ambient: '', blocked: false },
    { label: 'default', baseUrl: DEFAULT_CONFIG.jev.baseUrl, override: undefined, ambient: '', blocked: false },
  ])('checks the Jev endpoint before spending: $label', ({ baseUrl, override, ambient, blocked }) => {
    const home = process.env.LOADOUT_HOME!;
    writeFileSync(join(home, 'config.json'), JSON.stringify({ router: 'jev', jev: { baseUrl } }));
    vi.stubEnv('TYPESAFE_API_KEY', 'synthetic-key');
    vi.stubEnv('TYPESAFE_BASE_URL', ambient);
    const inherited = process.env;
    const found = blockers({ ...options, hosts: ['codex'] }, { CODEX_HOME: join(home, 'codex'), TYPESAFE_BASE_URL: override })
      .filter((b) => b.includes('jev.baseUrl'));
    expect(found).toEqual(blocked ? ['jev.baseUrl in config.json is not the default; the key is sent to another host only when TYPESAFE_BASE_URL names it'] : []);
    expect(found.join('\n')).not.toContain('https://jev.example.invalid');
    expect(process.env).toBe(inherited);
    expect(process.env.TYPESAFE_BASE_URL).toBe(ambient);
  });

  it('wants the key in a key file for Claude, whose MCP allowlist and hook scrub can drop the variable', () => {
    const home = temp('loadout-ab-home-');
    const keyFile = join(home, 'key');
    writeFileSync(keyFile, 'file-key-value\n');
    vi.stubEnv('LOADOUT_HOME', home);
    vi.stubEnv('TYPESAFE_API_KEY', 'env-key-value');
    try {
      const needsFile = (o: Options) => blockers(o, {}).some((b) => b.includes('through a key file'));
      writeFileSync(join(home, 'config.json'), JSON.stringify({ router: 'jev' }));
      expect(needsFile({ ...options, hosts: ['claude'] })).toBe(true);
      expect(needsFile({ ...options, hosts: ['codex'] })).toBe(false);
      writeFileSync(join(home, 'config.json'), JSON.stringify({ router: 'jev', jev: { apiKeyFile: keyFile } }));
      expect(needsFile({ ...options, hosts: ['claude'] })).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('refuses lexical routing for every host, even with a key, since the loadout arm would not route with Jev', () => {
    const home = temp('loadout-ab-home-');
    const keyFile = join(home, 'key');
    writeFileSync(keyFile, 'file-key-value\n');
    vi.stubEnv('LOADOUT_HOME', home);
    try {
      const lexical = (o: Options) => blockers(o, {}).some((b) => b.includes('"router": "lexical"'));
      writeFileSync(join(home, 'config.json'), JSON.stringify({ router: 'lexical', jev: { apiKeyFile: keyFile } }));
      expect(lexical({ ...options, hosts: ['codex'] })).toBe(true);
      expect(lexical({ ...options, hosts: ['claude'] })).toBe(true);
      // Only the stand-in test's own variable lifts it, and only for lexical.
      expect(blockers({ ...options, hosts: ['codex'] }, { LOADOUT_AB_SELF_TEST: 'lexical' }).some((b) => b.includes('"router"'))).toBe(false);
      expect(lexical({ ...options, hosts: ['codex'] })).toBe(true);
      writeFileSync(join(home, 'config.json'), JSON.stringify({ router: 'jev', jev: { apiKeyFile: keyFile } }));
      expect(lexical({ ...options, hosts: ['codex'] })).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

const evidence = (over: Partial<Evidence> = {}): Evidence => {
  const stream = toolEvents(claudeStream);
  return { usage: claudeUsage(claudeStream), hooks: stream.hooks, inventory: stream.inventory, failedBeforeModel: false, hookInvocations: 1, hookExits: [0], uncountedContext: 0, keywordRouted: false, pluginDir: '/opt/loadout/plugins/loadout', codexHook: true, requestedModel: 'sonnet', ...over };
};

describe('validity', () => {
  it('accepts the recorded loadout run', () => {
    expect(checkRun({ host: 'claude', arm: 'loadout' }, evidence())).toBeUndefined();
  });

  it('refuses a loadout arm without its plugin, hook or server, and a bare arm with any of them', () => {
    const e = evidence();
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, hookInvocations: 0 })).toContain('expected 1 loadout hook');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, inventory: { ...e.inventory!, plugins: [{ name: 'loadout', path: '/elsewhere', source: 'loadout@inline' }] } })).toContain('plugin');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, inventory: { ...e.inventory!, plugins: [...e.inventory!.plugins, { name: 'other', path: '/p', source: 'other@market' }] } })).toContain('plugin');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, inventory: { ...e.inventory!, mcpServers: [{ name: 'loadout', status: 'failed' }] } })).toContain('MCP server');
    expect(checkRun({ host: 'claude', arm: 'bare' }, e)).toContain('expected 0 loadout hook');
    expect(checkRun({ host: 'claude', arm: 'bare' }, { ...e, hookInvocations: 0, hookExits: [], hooks: [] })).toContain('plugin');
    expect(checkRun({ host: 'claude', arm: 'bare' }, { ...e, hookInvocations: 0, hookExits: [], hooks: [], inventory: { plugins: [{ name: 'agents-md', path: 'builtin', source: 'agents-md@builtin' }], mcpServers: [] } })).toBeUndefined();
  });

  it('refuses a hook the shim did not see, a failed start and another model', () => {
    const e = evidence();
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, uncountedContext: 1 })).toContain('uncounted');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, hooks: [] })).toContain('ran 0 UserPromptSubmit');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, failedBeforeModel: true })).toContain('before the model');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, requestedModel: 'opus' })).toContain('resolved model');
  });

  it('rejects a loadout hook that failed or never finished, on either host, and accepts one that exited 0 with no context', () => {
    const e = evidence();
    const failedResponse = (over: object) => ({ ...e, hooks: e.hooks.map((h) => ({ ...h, ...over })) });
    expect(checkRun({ host: 'claude', arm: 'loadout' }, failedResponse({ exit_code: 2 }))).toContain('failed or unfinished');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, failedResponse({ outcome: 'error' }))).toContain('failed or unfinished');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, failedResponse({ exit_code: undefined, outcome: undefined }))).toContain('failed or unfinished');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, hookExits: [1] })).toContain('did not finish successfully');
    const codex = evidence({ usage: codexUsage(codexStream), hooks: [], inventory: undefined });
    expect(checkRun({ host: 'codex', arm: 'loadout' }, { ...codex, hookExits: [127] })).toContain('did not finish successfully');
    expect(checkRun({ host: 'codex', arm: 'loadout' }, { ...codex, hookExits: [] })).toContain('did not finish successfully');
    expect(checkRun({ host: 'codex', arm: 'loadout' }, { ...codex, hookExits: [0] })).toBeUndefined();
  });

  it('stops the batch on a loadout arm that routed by keyword, on either host', () => {
    const e = evidence();
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, keywordRouted: true })).toContain('routed by keyword');
    expect(checkRun({ host: 'codex', arm: 'loadout' }, evidence({ usage: codexUsage(codexStream), hooks: [], inventory: undefined, keywordRouted: true }))).toContain('routed by keyword');
  });

  it('sees keyword routing in the hook\'s warning or stderr and in a find_tools result', () => {
    const warned = JSON.stringify({ systemMessage: NO_KEY_WARNING });
    const events = (result: string) => [{ tool: 'mcp__loadout__find_tools', detail: '{}', ok: true, result: JSON.stringify(result) }];
    expect(routedByKeyword(`${warned}\n`, '', [])).toBe(true);
    expect(routedByKeyword('', `${JEV_FALLBACK_NOTE}\n`, [])).toBe(true);
    expect(routedByKeyword('', '', events('- "ux-copy" (keyword match): Write copy'))).toBe(true);
    expect(routedByKeyword('', '', events('(Jev unavailable (timeout); used keyword ranking)\n- "a" (fit 0.5)'))).toBe(true);
    expect(routedByKeyword('', '', events('- "ux-copy" (fit 0.91, best match): Write copy'))).toBe(false);
    expect(routedByKeyword('', '', [{ ...events('(keyword match)')[0]!, ok: false }, { tool: 'mcp__other__find_tools', detail: '{}', ok: true, result: '"(keyword match)"' }])).toBe(false);
    expect(routedByKeyword(`${JSON.stringify({ hookSpecificOutput: { additionalContext: 'x' } })}\n`, '', [])).toBe(false);
  });

  it('keeps an MCP tool\'s result for the validity check and no other tool\'s', () => {
    const lines = [
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'mcp__loadout__find_tools', input: {} }, { type: 'tool_use', id: 't2', name: 'Read', input: {} }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: '- "a" (keyword match): d' }] }, { type: 'tool_result', tool_use_id: 't2', content: 'file text' }] } },
      { type: 'item.completed', item: { type: 'mcp_tool_call', server: 'loadout', tool: 'find_tools', status: 'completed', result: { content: [{ type: 'text', text: '(keyword match)' }] } } },
    ].map((l) => JSON.stringify(l)).join('\n');
    const { events } = toolEvents(lines);
    expect(events.map((x) => [x.tool, x.result?.includes('keyword match') ?? null])).toEqual([['mcp__loadout__find_tools', true], ['Read', null], ['mcp__loadout__find_tools', true]]);
  });

  it('checks the Codex arms by the shim\'s count', () => {
    const e = evidence({ usage: codexUsage(codexStream), hooks: [], inventory: undefined });
    expect(checkRun({ host: 'codex', arm: 'loadout' }, e)).toBeUndefined();
    expect(checkRun({ host: 'codex', arm: 'loadout' }, { ...e, hookInvocations: 0 })).toContain('expected 1');
    expect(checkRun({ host: 'codex', arm: 'bare' }, { ...e, hookInvocations: 0, hookExits: [] })).toBeUndefined();
    expect(checkRun({ host: 'codex', arm: 'loadout' }, { ...e, codexHook: false, hookInvocations: 0, hookExits: [] })).toBeUndefined();
  });
});

describe('what a run shows', () => {
  it('names the skills the hook listed and injected, and counts its characters', () => {
    const output = JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: '<skill_relevance>\nMost relevant:\n- "ux-copy" (fit 0.91): d\n- "brand--acme" (fit 0.5): d\n</skill_relevance>\n<skill name="ux-copy" trust="third-party">\nbody\n</skill>' } });
    const facts = hookFacts(`${output}\n\n`);
    expect(facts.listed).toEqual(['ux-copy', 'brand--acme']);
    expect(facts.injected).toEqual(['ux-copy']);
    expect(facts.contextChars).toBeGreaterThan(80);
    expect(hookFacts('\n')).toEqual({ contextChars: 0, listed: [], injected: [] });
  });

  it('finds opened skills from the Skill tool, load_skill and reads of SKILL.md, successful calls only', () => {
    const events = [
      { tool: 'Skill', detail: JSON.stringify({ skill: 'loadout:ux-copy' }), ok: true },
      { tool: 'mcp__loadout__load_skill', detail: JSON.stringify({ skill: 'user-research' }), ok: true },
      { tool: 'Read', detail: JSON.stringify({ file_path: '/lib/skills/surgical-patch/SKILL.md' }), ok: true },
      { tool: 'shell', detail: 'cat /lib/skills/investigate-first/SKILL.md', ok: true },
      { tool: 'Skill', detail: JSON.stringify({ skill: 'denied' }), ok: false },
    ];
    expect(openedSkills(events).sort()).toEqual(['investigate-first', 'surgical-patch', 'ux-copy', 'user-research'].sort());
    expect(openedSkills(toolEvents(claudeStream).events)).toEqual(['ux-copy']);
  });

  it('refuses to copy any output when a file holds a credential, and never prints it', () => {
    const dir = temp('loadout-ab-leak-');
    const [work, dest] = [join(dir, 'work'), join(dir, 'dest')];
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, 'notes.md'), 'fine\n');
    expect(copyOutputs(work, dest, [], ['sentinel-jev-key'])).toBeNull();
    expect(readFileSync(join(dest, 'notes.md'), 'utf8')).toBe('fine\n');

    writeFileSync(join(work, 'config.txt'), 'key = sentinel-jev-key\n');
    const held = copyOutputs(work, dest, [], ['sentinel-jev-key', 'oauth-token-value']);
    // The file and rule, so a false positive can be told from a leak; never the value.
    expect(held).toEqual({ file: 'config.txt', rule: 'held secret' });
    expect(JSON.stringify(held)).not.toContain('sentinel-jev-key');
    expect(existsSync(dest)).toBe(false);

    // Not a value the harness holds: a login token (JWT) or an API key, which an agent could read from its own home.
    for (const token of ['eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.c2lnbmF0dXJl', `sk-${'a1B2'.repeat(8)}`]) {
      writeFileSync(join(work, 'config.txt'), `token ${token}\n`);
      expect(copyOutputs(work, dest, [], [])).toEqual({ file: 'config.txt', rule: 'token shape' });
      expect(existsSync(dest)).toBe(false);
    }
  });

  it.each([
    ['sentinel-held-key', false], ['sentinel-held-key', true],
    [`sk-${'a1B2'.repeat(8)}`, false], [`sk-${'a1B2'.repeat(8)}`, true],
  ] as const)('screens credential-bearing paths without retaining them: %s, contents=%s', (secret, contentLeak) => {
    const dir = temp('loadout-ab-path-');
    const [work, dest] = [join(dir, 'work'), join(dir, 'dest')];
    mkdirSync(work);
    const file = join(work, `${secret}.md`);
    writeFileSync(file, contentLeak ? secret : 'safe text');
    const rule = secret.startsWith('sk-') ? 'token shape' : 'held secret';
    const secrets = secret.startsWith('sk-') ? [] : [secret];
    const leak = copyOutputs(work, dest, [], secrets);
    expect(leak).toEqual({ file: '<credential-bearing path>', rule });
    expect(JSON.stringify(leak)).not.toContain(secret);
    expect(existsSync(dest)).toBe(false);
  });

  it('copies what the judge sees and nothing else: no dotfiles, dependencies or build output', () => {
    const dir = temp('loadout-ab-copy-');
    const [work, dest] = [join(dir, 'work'), join(dir, 'dest')];
    for (const f of ['app.js', '.env', 'node_modules/x/index.js', 'dist/out.js', 'src/b.js', 'package-lock.json']) {
      mkdirSync(join(work, f, '..'), { recursive: true });
      writeFileSync(join(work, f), `${work}/${f}\n`);
    }
    expect(copyOutputs(work, dest, [[work, '<work>']], [])).toBeNull();
    expect((readdirSync(dest, { recursive: true }) as string[]).map((f) => f.replace(/\\/g, '/')).filter((f) => f.endsWith('.js')).sort()).toEqual(['app.js', 'src/b.js']);
    expect(readFileSync(join(dest, 'app.js'), 'utf8')).toBe('<work>/app.js\n');
  });

  it('leaves out a deliverable the judge does not show for its size, and does not shape-check it', () => {
    const dir = temp('loadout-ab-copy-');
    const [work, dest] = [join(dir, 'work'), join(dir, 'dest')];
    mkdirSync(work, { recursive: true });
    writeFileSync(join(work, 'small.md'), 'ok\n');
    writeFileSync(join(work, 'big.md'), `sk-${'x'.repeat(24)}\n${'a'.repeat(JUDGE_MAX_BYTES)}`);
    expect(copyOutputs(work, dest, [], [])).toBeNull();
    expect((readdirSync(dest) as string[]).sort()).toEqual(['small.md']);
  });

  it('removes skill names from both arms\' files and counts them', () => {
    const r = redactNames('Used UX-Copy and ux-copy; the brand-guidelines--acme template; ux-copying stays.', ['ux-copy', 'brand-guidelines--acme']);
    expect(r.text).toBe('Used [skill] and [skill]; the [skill] template; ux-copying stays.');
    expect(r.count).toBe(3);
    expect(redactNames('brand-guidelines notes', ['brand-guidelines--acme']).text).toBe('[skill] notes');
  });

  it('writes this machine\'s folders as variables', () => {
    expect(scrub('see /tmp/loadout-ab-1/work/a.md and C:\\Users\\u\\x', [['/tmp/loadout-ab-1/work', '<work>'], ['C:\\Users\\u', '~']])).toBe('see <work>/a.md and ~\\x');
  });
});

describe('the c1-debug-13 fixture', () => {
  const fixtures = join(repo, 'bench', 'data', 'ab-fixtures');
  const hidden = join(fixtures, 'c1-debug-13.hidden.test.mjs');
  // The fix is kept here only: the agent's folder never has it.
  const REFERENCE_FIX = `export function createMenu({ doc, button, panel }) {
  let isOpen = false;
  const render = () => { panel.hidden = !isOpen; button.ariaExpanded = String(isOpen); };
  const onOutsideTap = (event) => { if (event.target === button || panel.contains(event.target)) return; close(); };
  const onKeydown = (event) => { if (event.key === 'Escape') close(); };
  function open() { isOpen = true; render(); doc.addEventListener('click', onOutsideTap); doc.addEventListener('keydown', onKeydown); }
  function close() { isOpen = false; render(); doc.removeEventListener('click', onOutsideTap); doc.removeEventListener('keydown', onKeydown); }
  button.addEventListener('click', () => (isOpen ? close() : open()));
  render();
  return { open, close, isOpen: () => isOpen };
}
`;
  const copy = () => { const dir = temp('loadout-ab-fixture-'); cpSync(join(fixtures, 'c1-debug-13'), dir, { recursive: true }); return dir; };

  it('has the reported bug: opening passes, the hidden test fails on closing', () => {
    const r = hiddenResult(copy(), hidden);
    expect(r.passed).toBe(false);
    expect(r.tests).toBeGreaterThanOrEqual(8);
    expect(r.failed).toBeGreaterThanOrEqual(4);
  });

  it('passes the hidden test once the menu is fixed', () => {
    const dir = copy();
    writeFileSync(join(dir, 'menu.js'), REFERENCE_FIX);
    expect(hiddenResult(dir, hidden)).toMatchObject({ passed: true, failed: 0 });
  });

  it('also passes a fix that tells the button apart with button.contains', () => {
    const dir = copy();
    writeFileSync(join(dir, 'menu.js'), REFERENCE_FIX.replace('if (event.target === button || panel.contains(event.target)) return;', 'if (panel.contains(event.target) || button.contains(event.target)) return;'));
    expect(readFileSync(join(dir, 'menu.js'), 'utf8')).toContain('button.contains(event.target)');
    expect(hiddenResult(dir, hidden)).toMatchObject({ passed: true, failed: 0 });
  });

  it('keeps the hidden test and the fix out of the agent\'s folder', () => {
    const names = readdirSync(join(fixtures, 'c1-debug-13'), { recursive: true }).map(String);
    expect(names.sort()).toEqual(['README.md', 'index.html', 'menu.js', 'menu.test.mjs', 'package.json']);
    expect(readFileSync(join(fixtures, 'c1-debug-13', 'menu.js'), 'utf8')).toContain("button.addEventListener('keydown', onKeydown)");
  });

  it('reports a copy with a broken module as failed, not as an error', () => {
    const dir = copy();
    writeFileSync(join(dir, 'menu.js'), 'export const nope = ;');
    expect(hiddenResult(dir, hidden).passed).toBe(false);
  });
});

const row = (over: Partial<RunRow>): RunRow => ({
  id: 'x', host: 'claude', arm: 'bare', prompt: 'p1', repeat: 1, warmup: false, seq: 0, startedAt: '2026-10-19T10:00:00.000Z', endedAt: '2026-10-19T10:01:00.000Z', ms: 60_000,
  hostVersion: '2.1.281', requestedModel: 'sonnet', model: 'claude-sonnet-5', exit: 0, timedOut: false, stop: 'success', granularity: 'request',
  requests: [{ n: 1, at: null, model: null, uncached: 10, cacheWrite: 1000, cacheRead: 20000, output: 100, cacheWrite5m: 1000, cacheWrite1h: 0, reasoning: null, subagent: false, gapMs: 1000 },
    { n: 2, at: null, model: null, uncached: 2, cacheWrite: 100, cacheRead: 21000, output: 50, cacheWrite5m: 100, cacheWrite1h: 0, reasoning: null, subagent: false, gapMs: 5000 }],
  totals: { uncached: 12, cacheWrite: 1100, cacheRead: 41000, output: 150, effectiveInput: 5000, costUsd: 0.1, turns: 2 },
  unreconciled: [], modelUsage: null, coldCacheRisk: false, toolCalls: 0, toolErrors: 0, loadoutTools: [], skillsOpened: [], hook: { invocations: 0, contextChars: 0, listed: [], injected: [] }, hiddenTest: null, ...over,
});

describe('report', () => {
  const rows: RunRow[] = [
    row({ id: 'w', warmup: true, repeat: 0, prompt: 'warmup', totals: { uncached: 20, cacheWrite: 30000, cacheRead: 0, output: 5, effectiveInput: 40000, costUsd: 0.2, turns: 1 } }),
    row({ id: 'b1' }), row({ id: 'b2', repeat: 2, totals: { uncached: 14, cacheWrite: 1300, cacheRead: 41000, output: 170, effectiveInput: 6000, costUsd: 0.12, turns: 2 } }),
    row({ id: 'l1', arm: 'loadout', hook: { invocations: 1, contextChars: 2400, listed: ['ux-copy'], injected: ['ux-copy'] }, totals: { uncached: 12, cacheWrite: 2100, cacheRead: 41000, output: 150, effectiveInput: 6000, costUsd: 0.13, turns: 2 },
      requests: [{ n: 1, at: null, model: null, uncached: 10, cacheWrite: 2000, cacheRead: 20000, output: 100, cacheWrite5m: 2000, cacheWrite1h: 0, reasoning: null, subagent: false, gapMs: 1000 }, { n: 2, at: null, model: null, uncached: 2, cacheWrite: 100, cacheRead: 21000, output: 50, cacheWrite5m: 100, cacheWrite1h: 0, reasoning: null, subagent: false, gapMs: 5000 }], skillsOpened: ['ux-copy'] }),
    row({ id: 'c1', host: 'codex', arm: 'loadout', granularity: 'turn', requests: [{ n: 1, at: null, model: null, uncached: 9000, cacheWrite: 0, cacheRead: 52000, output: 2300, cacheWrite5m: null, cacheWrite1h: null, reasoning: 900, subagent: false, gapMs: null }],
      totals: { uncached: 9000, cacheWrite: 0, cacheRead: 52000, output: 2300, effectiveInput: null, costUsd: null, turns: null }, coldCacheRisk: true }),
    row({ id: 'bad', repeat: 2, arm: 'loadout', invalid: 'timed out before the host reported usage' }),
  ];
  const verdicts: Verdict[] = [{ host: 'claude', prompt: 'p1', repeat: 1, winner: 'loadout', judge: { backend: 'codex', model: 'gpt-6.1-sol' }, redactions: { bare: 0, loadout: 2 } }];
  const text = report(rows, verdicts, []);

  it('leaves the warm-up and invalid runs out of the comparison and shows them apart', () => {
    const table1 = text.split('## 2.')[0]!;
    expect(table1).toContain('| claude | p1 | bare | 2 |');
    expect(table1).toContain('| claude | p1 | loadout | 1 |');
    expect(table1).not.toContain('warmup');
    expect(text).toContain('| claude | bare | 10 / 1,000 / 20,000 | 10 / 1,000 / 20,000 | 20 / 30,000 / 0 | 13 / 1,200 / 41,000 |');
    expect(text).toContain('timed out before the host reported usage');
    expect(text).toContain('coldCacheRisk');
  });

  it('keeps the counters apart, with the cache share, the judge and the loadout − bare difference', () => {
    expect(text).toContain('1,200 (1,100–1,300)');
    expect(text).toContain('loadout 1, bare 0, tie 0, split 0');
    expect(text).toContain('| claude | p1 | -1 | +900 | 0 | -10 | +500 | +$0.02 | 2,400 |');
    expect(text).toContain('2,400');
    expect(text).toContain('ux-copy / ux-copy / ux-copy');
  });

  it('leaves subagent requests out of the request 1 / 2+ split, counts them apart and flags a second model', () => {
    const sub = { n: 3, at: null, model: null, uncached: 500, cacheWrite: 9000, cacheRead: 0, output: 10, cacheWrite5m: 9000, cacheWrite1h: 0, reasoning: null, subagent: true, gapMs: 100 };
    const base = row({});
    const withSub = report([{ ...base, requests: [...base.requests, sub], modelUsage: { 'claude-sonnet-5': {}, 'claude-haiku-5': {} } }], [], []);
    expect(withSub).toContain('| claude | p1 | bare | 10 / 1,000 / 20,000 | 2 / 100 / 21,000 | 2 | 1 |');
    expect(withSub).toContain('tokens were billed to claude-sonnet-5, claude-haiku-5');
  });

  it('splits request 1 from requests 2+ for Claude and says not shown for Codex', () => {
    expect(text).toContain('| claude | p1 | loadout | 10 / 2,000 / 20,000 | 2 / 100 / 21,000 | 2 | 0 |');
    expect(text).not.toContain('| codex | p1 | loadout | 9,000');
    expect(text).toContain('not shown');
    expect(text).toContain('| codex | p1 | loadout | 1 | 9,000 | 0 | 52,000 | 2,300 | 85% | not shown | not shown | not shown |');
  });
});

describe('resuming and finishing a study', () => {
  const prov = { commit: 'abc123', library: '12 skills, 0123456789ab' };
  const study = (rows: RunRow[], settings: Partial<Options> = {}) => {
    const dir = temp('loadout-ab-study-');
    const o = { ...options, ...settings };
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ ...o, ...prov, versions: {}, schedule: rows.map((r) => r.id) }));
    writeFileSync(join(dir, 'rows.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    writeFileSync(join(dir, 'INCOMPLETE'), 'x');
    return dir;
  };
  const rows = [row({ id: 'claude/bare/warmup/0', prompt: 'warmup', repeat: 0, warmup: true }), row({ id: 'claude/loadout/p1/1', arm: 'loadout' })];

  it.each(['listed', 'injected', 'skillsOpened'] as const)('refuses judge-only when %s lost a name to redaction', async (source) => {
    const names = ['ta<credential>'];
    const loadout = row({ id: 'loadout', arm: 'loadout', prompt: 'c1-web-14',
      ...(source === 'skillsOpened' ? { skillsOpened: names } : { hook: { invocations: 1, contextChars: 10, listed: [], injected: [], [source]: names } }) });
    const dir = study([row({ id: 'bare', prompt: 'c1-web-14' }), loadout]);
    const judge = vi.spyOn(benchLib, 'modelJson').mockResolvedValue({ output: { winner: 'first', confidence: 'high', reasons: 'fixture' }, costUsd: 0 });
    try {
      await expect(main(['--judge-only', dir], { print: () => {} })).rejects.toThrow('skill names were redacted: blind judging is not possible');
      expect(judge).not.toHaveBeenCalled();
      expect(existsSync(join(dir, 'verdicts.jsonl'))).toBe(false);
    } finally { judge.mockRestore(); }
  });

  it('refuses to resume with another model, which would pair rows measured under different ones', () => {
    const dir = study(rows);
    refuseOtherSettings(dir, options, prov, []);
    expect(() => refuseOtherSettings(dir, { ...options, models: { ...AB_MODELS, claude: 'opus' } }, prov, [])).toThrow(/other settings \(models\)/);
    expect(() => refuseOtherSettings(dir, { ...options, repeats: 3, maxTurns: 10 }, prov, [])).toThrow(/repeats, maxTurns/);
    // The code and the library are what is under test: a resume after a pull or a library change mixes them.
    expect(() => refuseOtherSettings(dir, options, { ...prov, commit: 'other-commit' }, [])).toThrow(/other settings \(commit\)/);
    expect(() => refuseOtherSettings(dir, options, { ...prov, library: '13 skills, 000000000000' }, [])).toThrow(/other settings \(library\)/);
    refuseOtherSettings(join(dir, 'new'), options, prov, []);
  });

  it('fingerprints each tracked diff so a second dirty edit refuses resume', async () => {
    const dir = temp('loadout-ab-git-');
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
    git('init');
    git('config', 'core.autocrlf', 'false');
    const file = join(dir, 'tracked.txt');
    writeFileSync(file, 'original\n');
    git('add', 'tracked.txt');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture');
    const home = temp('loadout-ab-home-');
    vi.stubEnv('LOADOUT_HOME', home);
    const { execFileSync: realExec } = await vi.importActual<typeof import('node:child_process')>('node:child_process');
    const spy = vi.spyOn(childProcess, 'execFileSync').mockImplementation(((bin: string, args: string[], opts: object) =>
      realExec(bin, args, { ...opts, cwd: dir })) as typeof execFileSync);
    try {
      const clean = provenance();
      expect(clean.commit).toBe(git('rev-parse', 'HEAD'));
      writeFileSync(join(dir, 'untracked.txt'), 'ignored');
      expect(provenance()).toEqual(clean);
      writeFileSync(file, 'first edit\n');
      const first = provenance();
      expect(first.commit).toMatch(/\+dirty-[a-f0-9]{12}$/);
      const out = study(rows);
      writeFileSync(join(out, 'config.json'), JSON.stringify({ ...options, ...first }));
      refuseOtherSettings(out, options, provenance(), []);
      writeFileSync(file, 'second edit\n');
      expect(() => refuseOtherSettings(out, options, provenance(), [])).toThrow(/other settings \(commit\)/);
      git('add', 'tracked.txt');
      expect(provenance().commit).not.toBe(first.commit);
      writeFileSync(file, Buffer.from([0, 1]));
      const binary = provenance();
      writeFileSync(file, Buffer.from([0, 2]));
      expect(provenance().commit).not.toBe(binary.commit);
    } finally {
      spy.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it('refuses a resume after a skill\'s text or description is edited without renaming it', () => {
    const home = temp('loadout-ab-lib-');
    const file = join(home, 'library', 'skills', 'ux-copy', 'SKILL.md');
    mkdirSync(join(file, '..'), { recursive: true });
    const write = (description: string, body: string) => writeFileSync(file, `---\nname: ux-copy\ndescription: ${description}\n---\n${body}\n`);
    write('Write interface copy.', 'Keep it short.');
    vi.stubEnv('LOADOUT_HOME', home);
    try {
      const before = provenance();
      expect(provenance()).toEqual(before);
      const dir = study(rows);
      writeFileSync(join(dir, 'config.json'), JSON.stringify({ ...options, ...before, versions: {}, schedule: [] }));
      refuseOtherSettings(dir, options, before, []);
      write('Write interface copy.', 'Keep it long.');
      expect(() => refuseOtherSettings(dir, options, provenance(), [])).toThrow(/other settings \(library\)/);
      write('Write interface copy.', 'Keep it short.');
      refuseOtherSettings(dir, options, provenance(), []);
      write('Write error pages.', 'Keep it short.');
      expect(() => refuseOtherSettings(dir, options, provenance(), [])).toThrow(/other settings \(library\)/);
      expect(JSON.stringify(before)).not.toContain('Keep it');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('refuses to continue or finish after a row that stopped the batch, but not after an unusable run', async () => {
    const stopped = (invalid: string) => study([...rows, row({ id: 'claude/bare/p1/1', invalid })]);
    refuseStopped(stopped('timed out before the host reported usage'));
    expect(() => refuseStopped(stopped('credential in output'))).toThrow('credential in output');
    const dir = stopped('ambient plugin in the bare arm; measurement invalid');
    await expect(main(['--judge-only', dir], { print: () => {} })).rejects.toThrow('stopped this study');
    expect(existsSync(join(dir, 'INCOMPLETE'))).toBe(true);
  });

  it('redacts legacy report text at the report sink without changing measurements', async () => {
    const held = 'synthetic-held-secret';
    const shape = `sk-${'x'.repeat(24)}`;
    const home = temp('loadout-ab-report-home-');
    vi.stubEnv('LOADOUT_HOME', home);
    vi.stubEnv('TYPESAFE_API_KEY', held);
    const rows = [row({ id: 'b' }), row({ id: 'l', arm: 'loadout', hook: { invocations: 1, contextChars: 123, listed: [held, shape, shape], injected: [held, shape] } })];
    const dir = study(rows);
    writeFileSync(join(dir, 'verdicts.jsonl'), JSON.stringify({ host: 'claude', prompt: 'p1', repeat: 1, winner: 'tie', judge: { backend: 'codex', model: 'test' }, redactions: { bare: 0, loadout: 0 } }) + '\n');
    try {
      await main(['--judge-only', dir], { print: () => {} });
      const text = readFileSync(join(dir, 'report.md'), 'utf8');
      expect(text).not.toContain(held);
      expect(text).not.toContain(shape);
      expect(text).toContain('<credential>');
      expect(text).toContain('1,100');
      expect(text).toContain('41,000');
    } finally { vi.unstubAllEnvs(); }
  });

  it('--judge-only removes the INCOMPLETE marker only when every scheduled run has a row', async () => {
    const dir = study(rows);
    await main(['--judge-only', dir], { print: () => {} });
    expect(existsSync(join(dir, 'INCOMPLETE'))).toBe(false);
    expect(readFileSync(join(dir, 'report.md'), 'utf8')).toContain('# A/B pilot report');

    const partial = study(rows);
    writeFileSync(join(partial, 'config.json'), JSON.stringify({ ...options, schedule: [...rows.map((r) => r.id), 'claude/loadout/p1/2'] }));
    await main(['--judge-only', partial], { print: () => {} });
    expect(existsSync(join(partial, 'INCOMPLETE'))).toBe(true);
  });
});

describe('public text sinks', () => {
  const held = 'synthetic-held-secret';
  const shape = `sk-${'x'.repeat(24)}`;
  const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.c2lnbmF0dXJl';
  const text = `${held} ${held} ${shape} ${jwt}`;

  it('redacts a token whatever precedes it, while the deliverable stop rule skips kebab-case identifiers', () => {
    expect(redact(`mcp__loadout__${shape} key${shape} \\n${shape} (${jwt})`, [])).toBe('mcp__loadout__<credential> key<credential> \\n<credential> (<credential>)');
    const css = '.mask-image-linear-gradient-overlay, .task-list-item-checkbox-wrapper { display: none }';
    expect(CREDENTIAL_SHAPE.test(css)).toBe(false);
    expect(CREDENTIAL_SHAPE.test(`key: ${shape}`) && CREDENTIAL_SHAPE.test(`x_${shape}`)).toBe(true);
  });

  it('redacts every plan and blocker print at the print sink', async () => {
    vi.stubEnv('LOADOUT_HOME', temp('loadout-ab-print-'));
    vi.stubEnv('TYPESAFE_API_KEY', held);
    const lines: string[] = [];
    try {
      await main(['--plan', '--hosts', 'codex', '--codex-model', text], { print: (s) => lines.push(s), env: { CODEX_HOME: 'no-codex-home' } });
      const printed = lines.join('\n');
      expect(printed).toContain('<credential> <credential> <credential> <credential>');
      expect(printed).not.toContain(held);
      expect(printed).not.toContain(shape);
    } finally { vi.unstubAllEnvs(); }
  });

  it('redacts thrown option errors at the public error sink', async () => {
    vi.stubEnv('LOADOUT_HOME', temp('loadout-ab-error-'));
    vi.stubEnv('TYPESAFE_API_KEY', held);
    try {
      await expect(main(['--hosts', text], { print: () => {} })).rejects.toThrow('unknown value <credential> <credential> <credential> <credential>');
    } finally { vi.unstubAllEnvs(); }
  });
});

describe('structured JSON persistence', () => {
  it.each(['\n', '\t'])('redacts decoded names, reasons, leak paths and keys after prefix %j', (prefix) => {
    const shape = `sk-${'x'.repeat(24)}`;
    const held = 'synthetic-held-secret';
    const name = prefix + shape;
    const events = toolEvents(JSON.stringify({ type: 'item.completed', item: { type: 'mcp_tool_call', server: 'loadout', tool: 'load_skill', arguments: { skill: name }, status: 'completed' } })).events;
    const hook = hookFacts(JSON.stringify({ hookSpecificOutput: { additionalContext: `<skill name="${name}">text</skill>` } }));
    const saved = JSON.parse(persistJson({ row: row({ skillsOpened: openedSkills(events), hook: { invocations: 1, ...hook }, leak: { file: name + '.md', rule: 'held secret' } }), reason: name + prefix + held, [prefix + shape]: 7 }, [held]));
    expect(saved.row.skillsOpened).toEqual([prefix + '<credential>']);
    expect(saved.row.hook.injected).toEqual([prefix + '<credential>']);
    expect(saved.row.leak.file).toBe(prefix + '<credential>.md');
    expect(saved.reason).toBe(prefix + '<credential>' + prefix + '<credential>');
    expect(saved[prefix + '<credential>']).toBe(7);
    expect(saved.row.totals.uncached).toBe(12);
    expect(saved.row.totals.cacheRead).toBe(41000);
  });
});

describe('subprocess stderr isolation', () => {
  it.each(['version', 'provenance'])('captures stderr from a failed %s probe', async (probe) => {
    const dir = temp('loadout-ab-stderr-');
    const marker = join(dir, 'started');
    const script = join(dir, 'fail.mjs');
    const held = 'synthetic-held-secret';
    writeFileSync(script, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'started'); process.stderr.write('${held}'); process.exit(1);`);
    const { execFileSync: realExec } = await vi.importActual<typeof import('node:child_process')>('node:child_process');
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      if (probe === 'version') {
        vi.spyOn(overhead, 'cli').mockReturnValue({ bin: process.execPath, prefix: [script] });
        await main(['--plan', '--hosts', 'codex'], { print: () => {}, env: { CODEX_HOME: join(dir, 'codex') } });
      } else {
        vi.spyOn(childProcess, 'execFileSync').mockImplementation(((_bin: string, _args: string[], opts: object) =>
          realExec(process.execPath, [script], opts)) as typeof execFileSync);
        expect(() => provenance()).toThrow();
      }
      expect(readFileSync(marker, 'utf8')).toBe('started');
      expect(stderr.mock.calls.map(([chunk]) => String(chunk)).join('')).not.toContain(held);
    } finally { vi.restoreAllMocks(); vi.mocked(childProcess.execFileSync).mockImplementation(realExec); }
  });
});

describe('credential screening before persistence', () => {
  const cases: { when: string; where: string; kind: string; prefix?: string }[] = ['warmup', 'measured'].flatMap((when) => [
    ...['binary', 'node_modules', '.env', 'path', 'stdout', 'stderr', 'hook', 'hook stderr'].map((where) => ({ when, where, kind: 'held' })),
    ...['binary', 'node_modules', '.env', 'excluded path', 'stderr', 'hook', 'hook stderr', 'stdout', 'deliverable text', 'deliverable path'].map((where) => ({ when, where, kind: 'shape' })),
  ]);
  cases.push({ when: 'measured code', where: '.env', kind: 'held' });
  cases.push({ when: 'measured', where: 'shaped filename', kind: 'held' });
  // `nested` is JSON text inside a JSON string (an MCP result quoting JSON): a literal backslash-n before the token.
  const leads: Record<string, string> = { newline: '\n', tab: '\t', carriage: '\r', unicode: '\u000b', backslash: '\\', quote: '"', slash: '/', backspace: '\b', formfeed: '\f', nested: '\\n', letter: 'key' };
  for (const prefix of ['carriage', 'unicode', 'backslash', 'quote', 'slash', 'backspace', 'formfeed']) cases.push({ when: 'measured', where: 'stdout', kind: 'shape', prefix });
  for (const prefix of ['newline', 'tab', 'nested', 'letter']) for (const where of ['hook', 'stdout']) cases.push({ when: 'measured', where, kind: 'shape', prefix });
  cases.push({ when: 'measured', where: 'model', kind: 'shape' });
  it.each(cases)('$kind credential in $where during $when ($prefix) obeys the persistence boundary', async ({ when, where, kind, prefix }) => {
    const dir = temp('loadout-ab-screen-');
    const out = join(dir, 'out');
    const prompt = when === 'measured code' ? 'c1-debug-13' : 'c1-web-14';
    const home = join(dir, 'home');
    mkdirSync(join(home, 'library', 'skills', 'sample'), { recursive: true });
    writeFileSync(join(home, 'config.json'), JSON.stringify({ router: 'lexical', embeddings: false }));
    writeFileSync(join(home, 'library', 'skills', 'sample', 'SKILL.md'), '---\nname: sample\ndescription: Test fixture\n---\nText');
    const script = join(dir, 'free-cli.mjs');
    writeFileSync(script, `if (process.argv.includes('--version')) console.log('0.160.1');
      else for (const f of ['plugins', 'hooks', 'skill_mcp_dependency_install']) console.log(f + ' stable false');`);
    // Simulate a POSIX run on Windows while keeping the real native path confinement check.
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    const realAssertTemporary = overhead.assertTemporary;
    vi.spyOn(overhead, 'assertTemporary').mockImplementation((destination) => {
      const simulated = Object.getOwnPropertyDescriptor(process, 'platform')!;
      Object.defineProperty(process, 'platform', platform);
      try { realAssertTemporary(destination); }
      finally { Object.defineProperty(process, 'platform', simulated); }
    });
    vi.stubEnv('LOADOUT_HOME', home);
    vi.stubEnv('TYPESAFE_API_KEY', 'synthetic-held-secret');
    vi.spyOn(overhead, 'cli').mockReturnValue({ bin: process.execPath, prefix: [script] });
    vi.spyOn(mcpOverhead, 'refusedFiles').mockReturnValue([]);
    vi.spyOn(benchLib, 'modelJson').mockResolvedValue({ output: { winner: 'first', confidence: 'high', reasons: `synthetic-held-secret \nsk-${'x'.repeat(24)} \tsk-${'x'.repeat(24)}` }, costUsd: 0 });
    const secret = kind === 'held' ? 'synthetic-held-secret' : `sk-${'x'.repeat(24)}`;
    const lead = prefix ? leads[prefix]! : '';
    const value = lead + secret;
    const target = when === 'warmup' ? 0 : 2;
    const stops = kind === 'held' || (when !== 'warmup' && where.startsWith('deliverable'));
    let runs = 0;
    vi.spyOn(benchLib, 'run').mockImplementation(async (_bin, _args, work) => {
      const tainted = runs++ === target;
      writeFileSync(join(work, 'notes.md'), 'safe deliverable');
      if (tainted) {
        const file = where === '.env' ? '.env' : where === 'binary' ? 'payload.bin'
          : where === 'node_modules' ? 'node_modules/pkg/index.js'
          : where === 'path' ? `${secret}/notes.txt`
          : where === 'excluded path' ? `.${secret}/notes.txt`
          : where === 'deliverable path' ? `${secret}.md`
          : where === 'deliverable text' ? 'notes.md'
          : where === 'shaped filename' ? `sk-${'x'.repeat(24)}.md` : null;
        if (file) {
          mkdirSync(join(work, file, '..'), { recursive: true });
          writeFileSync(join(work, file), where === 'binary' ? Buffer.from(`before\0${secret}`) : where.includes('path') ? 'safe' : secret);
        }
        if (where.startsWith('hook')) {
          const shim = join(work, '..', 'shim', 'codex');
          const capture = when === 'warmup' ? 'codex_bare_warmup_0.invocations.out' : `codex_loadout_${prompt}_1.invocations.out`;
          writeFileSync(join(shim, capture + (where === 'hook stderr' ? '.err' : '')), where === 'hook'
            ? JSON.stringify({ hookSpecificOutput: { additionalContext: `- "${value}" (fit 0.9): text\n<skill name="${value}">body</skill>` } }) : secret);
        }
      }
      let stdout = codexStream + (tainted && where === 'stdout'
        ? '\n' + JSON.stringify({ type: 'item.completed', item: kind === 'held'
          ? { type: 'mcp_tool_call', server: 'loadout', tool: secret, status: 'completed' } : { type: 'mcp_tool_call', server: 'loadout', tool: 'load_skill', arguments: { skill: value }, status: 'completed' } }) + (kind === 'shape' ? '\n' + JSON.stringify({ type: 'item.completed', item: { type: 'mcp_tool_call', server: 'loadout', tool: value, status: 'completed' } }) : '') : '');
      if (prefix === 'slash') stdout = stdout.replaceAll('/sk-', String.raw`\/sk-`);
      return { stdout, stderr: tainted && where === 'stderr' ? secret : '', code: 0, timedOut: false };
    });
    try {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      const lines: string[] = [];
      const model = `synthetic-held-secret \nsk-${'x'.repeat(24)}`;
      const args = ['--run', '--hosts', 'codex', '--no-codex-hook', '--ids', prompt, '--repeats', '1', '--out', out, ...(where === 'model' ? ['--codex-model', model] : [])];
      const env = { LOADOUT_AB_SELF_TEST: 'lexical', CODEX_HOME: join(dir, 'codex') };
      let message = '';
      try {
        await main(args, {
          env, print: (s) => lines.push(s),
        });
      } catch (error) { message = (error as Error).message; }
      if (stops) expect(message).toContain('credential in output');
      else if (when !== 'warmup' && kind === 'shape' && ['hook', 'stdout'].includes(where)) expect(message).toBe('skill names were redacted: blind judging is not possible');
      else expect(message).toBe('');
      const rows = readFileSync(join(out, 'rows.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as RunRow);
      expect(rows).toHaveLength(stops ? target + 1 : 4);
      const row = rows[target]!;
      expect(row.invalid).toBe(stops ? 'credential in output' : undefined);
      expect(row.hiddenTest).toBeNull();
      expect(row.totals).toMatchObject({ uncached: 9000, cacheRead: 52000, output: 2300 });
      if (where === 'shaped filename') expect(row.leak?.file).toBe('<credential>.md');
      expect(row.leak?.rule).toBe(stops ? kind === 'held' ? 'held secret' : 'token shape' : undefined);
      if (stops && where.includes('path')) expect(row.leak?.file).toBe('<credential-bearing path>');
      const withheld = !stops && where === 'stdout';
      expect(row.streamWithheld).toBe(withheld ? 'token shape' : undefined);
      if (!stops) {
        expect(row.totals.cacheRead).toBeGreaterThan(0);
        expect(row.toolCalls).toBeGreaterThan(0);
      }
      const streamFile = join(out, 'streams', row.id.replace(/\//g, '_') + '.jsonl');
      expect(existsSync(streamFile)).toBe(!stops && !withheld);
      const dest = join(out, 'outputs', row.host, row.prompt, `${row.arm}-${row.repeat}`);
      expect(existsSync(dest)).toBe(!stops && when !== 'warmup');
      if (!stops && when !== 'warmup') expect(readFileSync(join(dest, 'notes.md'), 'utf8')).toBe('safe deliverable');
      const files = (readdirSync(out, { recursive: true }) as string[]).filter((f) => statSync(join(out, f)).isFile());
      const persisted = files.map((f) => readFileSync(join(out, f), 'utf8')).join('\n');
      const saved = [persisted, message, ...lines].join('\n');
      expect(saved).not.toContain(secret);
      expect(saved).not.toContain('synthetic-held-secret');
      expect(saved).not.toContain(`sk-${'x'.repeat(24)}`);
      if (kind === 'shape' && where === 'stdout') {
        expect(row.skillsOpened).toContain(lead + '<credential>');
        expect(row.loadoutTools).toContain('mcp__loadout__' + lead + '<credential>');
      }
      if (kind === 'shape' && where === 'hook') {
        expect(row.hook.listed).toContain(lead + '<credential>');
        expect(row.hook.injected).toContain(lead + '<credential>');
      }
      if (where === 'model') {
        const config = JSON.parse(readFileSync(join(out, 'config.json'), 'utf8'));
        expect(config.models.codex).toBe('<credential> \n<credential>');
        const before = readFileSync(join(out, 'rows.jsonl'), 'utf8');
        await expect(main(args, { env, print: () => {} })).resolves.toBeUndefined();
        expect(readFileSync(join(out, 'rows.jsonl'), 'utf8')).toBe(before);
      }
      if (stops) {
        expect(files.filter((f) => f.startsWith('streams'))).toHaveLength(target);
        expect(files.some((f) => f.startsWith('outputs'))).toBe(false);
      }
    } finally {
      Object.defineProperty(process, 'platform', platform);
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
  });
});

// The stand-ins are shell scripts, which Windows cannot run from PATH.
describe.skipIf(process.platform === 'win32')('bench/ab.ts --run against stand-in CLIs', () => {
  const NODE = process.execPath;
  const wrapper = (script: string) => `#!/bin/sh\nexec "${NODE}" "${script}" "$@"\n`;

  // `leak`: the loadout arm's agent writes the TypeSafe key it was given into a deliverable.
  const claudeScript = (log: string, leak = false) => `
import { appendFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const ev = (o) => console.log(JSON.stringify(o));
if (args[0] === '--version') { console.log('2.1.281 (Claude Code)'); process.exit(0); }
if (args.includes('--json-schema')) {
  process.stdin.resume();
  process.stdin.on('end', () => console.log(JSON.stringify({ structured_output: { winner: 'first', confidence: 'high', reasons: 'x' }, total_cost_usd: 0, duration_ms: 1, usage: { input_tokens: 1 } })));
} else {
  const plugin = args.includes('--plugin-dir') ? args[args.indexOf('--plugin-dir') + 1] : undefined;
  const mcp = Object.keys(JSON.parse(args[args.indexOf('--mcp-config') + 1]).mcpServers);
  appendFileSync(${JSON.stringify(log)}, JSON.stringify({ host: 'claude', args, env: Object.keys(process.env).sort(), cwd: process.cwd() }) + '\\n');
  if (plugin) {
    const r = spawnSync('loadout', ['hook', 'claude'], { input: JSON.stringify({ session_id: 'fake-' + process.pid, prompt: 'Please use $ux-copy for this', cwd: process.cwd() }), encoding: 'utf8' });
    ev({ type: 'system', subtype: 'hook_started', hook_id: 'h1', hook_name: 'UserPromptSubmit', hook_event: 'UserPromptSubmit' });
    ev({ type: 'system', subtype: 'hook_response', hook_id: 'h1', hook_name: 'UserPromptSubmit', hook_event: 'UserPromptSubmit', stdout: r.stdout, exit_code: 0, outcome: 'success' });
  }
  ev({ type: 'system', subtype: 'init', model: 'claude-sonnet-5', claude_code_version: '2.1.281', tools: ['Bash'], mcp_servers: mcp.map((name) => ({ name, status: 'connected' })), plugins: [...(plugin ? [{ name: 'loadout', path: plugin, source: 'loadout@inline' }] : []), { name: 'agents-md', path: 'builtin', source: 'agents-md@builtin' }] });
  writeFileSync('notes.md', 'A short deliverable for ' + process.cwd() + '\\n');
  if (${leak} && process.env.TYPESAFE_API_KEY) writeFileSync('setup.md', 'export TYPESAFE_API_KEY=' + process.env.TYPESAFE_API_KEY + '\\n');
  const usage = (i, w, r, o) => ({ input_tokens: i, cache_creation_input_tokens: w, cache_read_input_tokens: r, output_tokens: o });
  ev({ type: 'assistant', message: { id: 'm1', model: 'claude-sonnet-5', content: [{ type: 'text', text: 'ok' }], usage: usage(2, plugin ? 900 : 400, 5000, 50) }, timestamp: new Date().toISOString() });
  ev({ type: 'assistant', message: { id: 'm2', model: 'claude-sonnet-5', content: [{ type: 'text', text: 'done' }], usage: usage(1, 50, 6000, 20) }, timestamp: new Date().toISOString() });
  ev({ type: 'result', subtype: 'success', is_error: false, num_turns: 2, total_cost_usd: 0.01, usage: usage(3, plugin ? 950 : 450, 11000, 70) });
}
`;

  // `unifiedExec`: the install keeps unified_exec on whatever is set (E12), so it cannot judge tool-less.
  const codexScript = (log: string, unifiedExec = false) => `
import { appendFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const ev = (o) => console.log(JSON.stringify(o));
if (args[0] === '--version') { console.log('codex-cli 0.160.1'); process.exit(0); }
if (args.includes('features')) { for (const f of ['plugins', 'hooks', 'skill_mcp_dependency_install', 'shell_tool', 'unified_exec']) console.log(f.padEnd(32) + 'stable             ' + (${unifiedExec} && f === 'unified_exec' ? 'true' : 'false')); process.exit(0); }
if (args.includes('--output-schema')) {
  process.stdin.resume();
  process.stdin.on('end', () => writeFileSync(args[args.indexOf('--output-last-message') + 1], JSON.stringify({ winner: 'second', confidence: 'low', reasons: 'x' })));
} else {
  appendFileSync(${JSON.stringify(log)}, JSON.stringify({ host: 'codex', args, env: Object.keys(process.env).sort(), cwd: process.cwd() }) + '\\n');
  if (args.some((a) => a.startsWith('hooks.UserPromptSubmit='))) spawnSync('loadout', ['hook', 'codex'], { input: JSON.stringify({ session_id: 'fake-' + process.pid, prompt: 'Please use $ux-copy for this', cwd: process.cwd() }), encoding: 'utf8' });
  writeFileSync('notes.md', 'A short deliverable for ' + process.cwd() + '\\n');
  ev({ type: 'thread.started', thread_id: 't' }); ev({ type: 'turn.started' });
  ev({ type: 'item.completed', item: { id: 'i', type: 'agent_message', text: 'done' } });
  ev({ type: 'turn.completed', usage: { input_tokens: 8000, cached_input_tokens: 6000, cache_write_input_tokens: 0, output_tokens: 100, reasoning_output_tokens: 10 } });
}
`;

  it('hands the host the hook\'s output and keeps its stderr for the validity check', () => {
    const dir = temp('loadout-ab-shim-');
    const [marker, capture, shim] = ['marks', 'out', 'loadout'].map((n) => join(dir, n)) as [string, string, string];
    writeFileSync(shim, hookShim(marker, `echo '{"a":1}'; echo noted >&2`, capture), { mode: 0o755 });
    const r = spawnSync('/bin/sh', [shim], { encoding: 'utf8' });
    expect([r.status, r.stdout, r.stderr]).toEqual([0, '{"a":1}', '']);
    expect([readFileSync(marker, 'utf8'), readFileSync(capture, 'utf8'), readFileSync(`${capture}.err`, 'utf8')]).toEqual(['invoked\nexit 0\n', '{"a":1}\n', 'noted\n']);
  });

  it('records the hook\'s exit status for the validity check, and passes the failure on to the host', () => {
    const dir = temp('loadout-ab-shim-');
    const [marker, shim] = ['marks', 'loadout'].map((n) => join(dir, n)) as [string, string];
    writeFileSync(shim, hookShim(marker, 'exit 3'), { mode: 0o755 });
    expect(spawnSync('/bin/sh', [shim], { encoding: 'utf8' }).status).toBe(3);
    expect(readFileSync(marker, 'utf8')).toBe('invoked\nexit 3\n');
  });

  /** Stand-in CLIs on PATH, a loadout home with one skill, and a way to start bench/ab.ts against them. */
  const stage = (leak = false, unifiedExec = false) => {
    const dir = temp('loadout-ab-smoke-');
    const bin = join(dir, 'bin');
    const home = join(dir, 'home');
    const loadoutHome = join(dir, 'loadout-home');
    const out = join(dir, 'out');
    const log = join(dir, 'calls.log');
    for (const d of [bin, home, join(loadoutHome, 'library', 'skills', 'ux-copy')]) mkdirSync(d, { recursive: true });
    writeFileSync(join(loadoutHome, 'config.json'), JSON.stringify({ router: 'lexical', embeddings: false }));
    writeFileSync(join(loadoutHome, 'library', 'skills', 'ux-copy', 'SKILL.md'), '---\nname: ux-copy\ndescription: Write interface copy such as error pages and button labels.\n---\nKeep it short.\n');
    writeFileSync(join(dir, 'claude.mjs'), claudeScript(log, leak));
    writeFileSync(join(dir, 'codex.mjs'), codexScript(log, unifiedExec));
    writeFileSync(join(bin, 'claude'), wrapper(join(dir, 'claude.mjs')), { mode: 0o755 });
    writeFileSync(join(bin, 'codex'), wrapper(join(dir, 'codex.mjs')), { mode: 0o755 });
    const start = (args: string[], tmp?: string) => new Promise<{ code: number | null; text: string }>((resolve) => {
      const lines: string[] = [];
      // An absolute loader: the hook the shim runs inherits these arguments and starts in another folder.
      const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), 'bench/ab.ts', '--run', '--out', out, ...args], {
        cwd: repo,
        // Lexical routing keeps the real hook off Jev's network; only this test may run the harness that way.
        env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, LOADOUT_HOME: loadoutHome, LOADOUT_AB_SELF_TEST: 'lexical', CLAUDE_CODE_OAUTH_TOKEN: 'oauth-secret-value', TYPESAFE_API_KEY: 'jev-secret-value', ...(tmp ? { TMPDIR: tmp } : {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (d: Buffer) => lines.push(String(d)));
      child.stderr.on('data', (d: Buffer) => lines.push(String(d)));
      child.on('close', (code) => resolve({ code, text: lines.join('') }));
    });
    const rowsOf = () => readFileSync(join(out, 'rows.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as RunRow);
    const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { host: string; args: string[]; env: string[]; cwd: string }) : []);
    return { dir, out, start, rowsOf, calls };
  };

  it('records warm-ups apart from interleaved measured runs, one hook call per loadout run, and no credential', async () => {
    const { dir, out, start, rowsOf, calls: callsOf } = stage();
    const { code, text } = await start(['--repeats', '1', '--ids', 'c1-web-14,c1-debug-13']);
    expect(code, text).toBe(0);
    const lines = [text];

    const rows = rowsOf();
    // Per host: two warm-ups, then (2 prompts × 2 arms) measured, in schedule order.
    expect(rows).toHaveLength(2 * (2 + 4));
    expect(rows.slice(0, 2).map((r) => [r.arm, r.warmup])).toEqual([['bare', true], ['loadout', true]]);
    const claudeMeasured = rows.filter((r) => r.host === 'claude' && !r.warmup);
    expect(claudeMeasured.map((r) => r.arm)).toEqual(['loadout', 'bare', 'bare', 'loadout']);
    for (const r of rows) {
      expect(r.invalid).toBeUndefined();
      expect(r.hook.invocations).toBe(r.arm === 'loadout' ? 1 : 0);
    }
    const loadoutClaude = rows.find((r) => r.host === 'claude' && r.arm === 'loadout' && !r.warmup)!;
    expect(loadoutClaude.hook.injected).toEqual(['ux-copy']);
    expect(loadoutClaude.hook.contextChars).toBeGreaterThan(50);
    expect(loadoutClaude.requests.map((r) => [r.uncached, r.cacheWrite, r.cacheRead])).toEqual([[2, 900, 5000], [1, 50, 6000]]);
    expect(loadoutClaude.totals).toMatchObject({ uncached: 3, cacheWrite: 950, cacheRead: 11000, output: 70, turns: 2 });
    expect(rows.find((r) => r.host === 'codex' && r.arm === 'loadout' && !r.warmup)!.hook.invocations).toBe(1);
    expect(rows.find((r) => r.host === 'codex')!.totals).toMatchObject({ uncached: 2000, cacheRead: 6000, effectiveInput: null });

    // The arms differ only in the loadout pieces: the same flags, the same environment names.
    const calls = callsOf();
    for (const host of ['claude', 'codex']) {
      const [bare, loadout] = ['bare', 'loadout'].map((arm) => calls.filter((c) => c.host === host).find((c) => (host === 'claude' ? c.args.includes('--plugin-dir') : c.args.some((a) => a.startsWith('mcp_servers.'))) === (arm === 'loadout'))!);
      expect(bare!.env.filter((n) => !['TYPESAFE_API_KEY', 'LOADOUT_HOME'].includes(n))).toEqual(loadout!.env.filter((n) => !['TYPESAFE_API_KEY', 'LOADOUT_HOME'].includes(n)));
      expect(bare!.env).not.toContain('TYPESAFE_API_KEY');
      expect(loadout!.env).toContain('TYPESAFE_API_KEY');
    }
    expect(calls.filter((c) => c.host === 'claude').every((c) => c.env.includes('CLAUDE_CODE_OAUTH_TOKEN'))).toBe(true);
    expect(calls.filter((c) => c.host === 'codex').every((c) => !c.env.includes('CLAUDE_CODE_OAUTH_TOKEN'))).toBe(true);

    // The hidden test ran on the fixture prompt (the stand-in never fixes the menu), and the agent's folder held no test but its own.
    expect(rows.filter((r) => r.prompt === 'c1-debug-13').every((r) => r.hiddenTest?.passed === false)).toBe(true);
    expect(rows.filter((r) => r.prompt === 'c1-web-14').every((r) => r.hiddenTest === null)).toBe(true);

    // Judged across families, both orders, in a finished folder with no credential in it.
    const verdicts = readFileSync(join(out, 'verdicts.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(verdicts).toHaveLength(4);
    expect(verdicts.find((v) => v.host === 'claude' && v.prompt === 'c1-web-14').judge).toEqual({ backend: 'codex', model: 'gpt-6.1-sol' });
    expect(verdicts.find((v) => v.host === 'codex' && v.prompt === 'c1-web-14').judge).toEqual({ backend: 'claude', model: 'opus' });
    expect(existsSync(join(out, 'INCOMPLETE'))).toBe(false);
    expect(readFileSync(join(out, 'report.md'), 'utf8')).toContain('## 4. Cold start');
    // streams/ holds the raw streams (gitignored): local paths and hook text are expected there, and only there.
    const committed = (readdirSync(out, { recursive: true }) as string[]).filter((f) => /\.(jsonl?|md|mjs|html)$/.test(f) && !/^streams[/\\]/.test(f));
    expect(readdirSync(join(out, 'streams')).length).toBe(rows.length);
    const everything = committed.map((f) => readFileSync(join(out, f), 'utf8')).join('\n');
    expect(everything).toContain('<work>');
    expect(everything).not.toContain(dir);
    expect(`${lines.join('')}\n${everything}`).not.toMatch(/oauth-secret-value|jev-secret-value/);
    // One work folder for every run: its path is in the prompt prefix the cache keys on.
    expect(new Set(calls.map((c) => c.cwd)).size).toBe(1);
  }, 180_000);

  it('stops the batch when an agent writes the TypeSafe key into a deliverable, copies nothing and refuses to resume', async () => {
    const { out, start, rowsOf } = stage(true);
    const args = ['--hosts', 'claude', '--repeats', '1', '--ids', 'c1-web-14'];
    const { code, text } = await start(args);
    expect(code).toBe(1);
    expect(text).toContain('claude/loadout/warmup/0: credential in output');
    const rows = rowsOf();
    // The loadout warm-up is screened too and ends the batch before measured runs.
    expect(rows.map((r) => [r.id, r.invalid])).toEqual([['claude/bare/warmup/0', undefined], ['claude/loadout/warmup/0', 'credential in output']]);
    expect(existsSync(join(out, 'INCOMPLETE'))).toBe(true);
    expect(existsSync(join(out, 'outputs', 'claude', 'c1-web-14', 'loadout-1'))).toBe(false);
    const everything = (readdirSync(out, { recursive: true }) as string[]).filter((f) => statSync(join(out, f)).isFile() && !/^streams[/\\]/.test(f)).map((f) => readFileSync(join(out, f), 'utf8')).join('\n');
    expect(`${text}\n${everything}`).not.toMatch(/oauth-secret-value|jev-secret-value/);

    const again = await start(args);
    expect(again.code).toBe(1);
    expect(again.text).toContain('stopped this study');
    expect(rowsOf()).toHaveLength(2);
  }, 180_000);

  it('runs when the temporary base is itself a link, as /tmp is on macOS when TMPDIR is unset', async () => {
    const { dir, start, rowsOf } = stage();
    const real = join(dir, 'real-tmp');
    const link = join(dir, 'link-tmp');
    mkdirSync(real);
    symlinkSync(real, link, 'dir');
    const { code, text } = await start(['--hosts', 'claude', '--repeats', '1', '--ids', 'c1-web-14'], link);
    expect(code, text).toBe(0);
    expect(rowsOf()).toHaveLength(4);
  }, 180_000);

  it('stops before any agent launches when a judge the hosts need cannot run', async () => {
    const { out, start, calls, rowsOf } = stage(false, true);
    // Claude's outputs are judged by Codex, which here keeps unified_exec on.
    const claude = await start(['--hosts', 'claude', '--repeats', '1', '--ids', 'c1-web-14']);
    expect(claude.code).toBe(1);
    expect(claude.text).toContain('claude outputs are judged by Codex and it cannot');
    expect(calls()).toHaveLength(0);
    expect(existsSync(join(out, 'rows.jsonl'))).toBe(false);
    expect(existsSync(join(out, 'INCOMPLETE'))).toBe(false);
    // Codex's outputs are judged by Claude, so a Codex-only study is not affected.
    const codex = await start(['--hosts', 'codex', '--repeats', '1', '--ids', 'c1-web-14']);
    expect(codex.code, codex.text).toBe(0);
    expect(rowsOf().every((r) => r.host === 'codex')).toBe(true);
  }, 180_000);

  it('resumes in the same work folder, and refuses to resume with another model before running anything', async () => {
    const { out, start, rowsOf, calls } = stage();
    const args = ['--hosts', 'claude', '--repeats', '1', '--ids', 'c1-web-14'];
    expect((await start(args)).code).toBe(0);
    const before = calls().length;
    const other = await start([...args, '--claude-model', 'opus']);
    expect(other.code).toBe(1);
    expect(other.text).toContain('other settings (models)');
    expect(calls()).toHaveLength(before);
    expect(existsSync(join(out, 'INCOMPLETE'))).toBe(false);

    // Lose the last measured run, as a crash would, and resume with the same settings.
    const kept = rowsOf().slice(0, -1);
    writeFileSync(join(out, 'rows.jsonl'), kept.map((r) => JSON.stringify(r)).join('\n') + '\n');
    writeFileSync(join(out, 'verdicts.jsonl'), '');
    expect((await start(args)).code).toBe(0);
    expect(rowsOf()).toHaveLength(kept.length + 1);
    expect(new Set(calls().map((c) => c.cwd)).size).toBe(1);
  }, 180_000);
});
