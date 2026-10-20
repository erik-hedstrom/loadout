import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { report, type RunRow, type Verdict } from '../bench/ab-report.js';
import { AB_MODELS, blockers, buildCommand, checkRun, copyOutputs, hiddenResult, hookFacts, main, openedSkills, planLines, promptText, redactNames, refuseOtherSettings, refuseStopped, routedByKeyword, runEnv, schedule, scrub, type Ctx, type Evidence, type Job, type Options } from '../bench/ab.js';
import { JEV_FALLBACK_NOTE, NO_KEY_WARNING } from '../src/hook.js';
import { hookShim, toolEvents } from '../bench/stream.js';
import { claudeUsage, codexUsage, effectiveInput } from '../bench/usage.js';

const temps: string[] = [];
const temp = (prefix: string) => { const dir = mkdtempSync(join(tmpdir(), prefix)); temps.push(dir); return dir; };
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

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
    const env = { TYPESAFE_API_KEY: 'key-value', LOADOUT_HOME: '/h', ANTHROPIC_API_KEY: 'api-value', OPENAI_API_KEY: 'o-value', CLAUDE_CODE_OAUTH_TOKEN: 'token-value' };
    const bare = runEnv(job('claude', 'bare'), ctx(env));
    const loadout = runEnv(job('claude', 'loadout'), ctx(env));
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
      writeFileSync(join(home, 'config.json'), JSON.stringify({ router: 'jev', jev: { apiKeyFile: keyFile } }));
      expect(lexical({ ...options, hosts: ['codex'] })).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

const evidence = (over: Partial<Evidence> = {}): Evidence => {
  const stream = toolEvents(claudeStream);
  return { usage: claudeUsage(claudeStream), hooks: stream.hooks, inventory: stream.inventory, failedBeforeModel: false, hookInvocations: 1, uncountedContext: 0, keywordRouted: false, pluginDir: '/opt/loadout/plugins/loadout', codexHook: true, requestedModel: 'sonnet', ...over };
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
    expect(checkRun({ host: 'claude', arm: 'bare' }, { ...e, hookInvocations: 0, hooks: [] })).toContain('plugin');
    expect(checkRun({ host: 'claude', arm: 'bare' }, { ...e, hookInvocations: 0, hooks: [], inventory: { plugins: [{ name: 'agents-md', path: 'builtin', source: 'agents-md@builtin' }], mcpServers: [] } })).toBeUndefined();
  });

  it('refuses a hook the shim did not see, a failed start and another model', () => {
    const e = evidence();
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, uncountedContext: 1 })).toContain('uncounted');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, hooks: [] })).toContain('ran 0 UserPromptSubmit');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, failedBeforeModel: true })).toContain('before the model');
    expect(checkRun({ host: 'claude', arm: 'loadout' }, { ...e, requestedModel: 'opus' })).toContain('resolved model');
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
    expect(checkRun({ host: 'codex', arm: 'bare' }, { ...e, hookInvocations: 0 })).toBeUndefined();
    expect(checkRun({ host: 'codex', arm: 'loadout' }, { ...e, codexHook: false, hookInvocations: 0 })).toBeUndefined();
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
    expect(copyOutputs(work, dest, [], ['sentinel-jev-key'])).toBe(true);
    expect(readFileSync(join(dest, 'notes.md'), 'utf8')).toBe('fine\n');

    writeFileSync(join(work, 'config.txt'), 'key = sentinel-jev-key\n');
    expect(copyOutputs(work, dest, [], ['sentinel-jev-key', 'oauth-token-value'])).toBe(false);
    expect(existsSync(dest)).toBe(false);

    // Not a value the harness holds: a login token (JWT) or an API key, which an agent could read from its own home.
    for (const token of ['eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.c2lnbmF0dXJl', `sk-${'a1B2'.repeat(8)}`]) {
      writeFileSync(join(work, 'config.txt'), `token ${token}\n`);
      expect(copyOutputs(work, dest, [], [])).toBe(false);
      expect(existsSync(dest)).toBe(false);
    }
  });

  it('copies what the judge sees and nothing else: no dotfiles, dependencies or build output', () => {
    const dir = temp('loadout-ab-copy-');
    const [work, dest] = [join(dir, 'work'), join(dir, 'dest')];
    for (const f of ['app.js', '.env', 'node_modules/x/index.js', 'dist/out.js', 'src/b.js', 'package-lock.json']) {
      mkdirSync(join(work, f, '..'), { recursive: true });
      writeFileSync(join(work, f), `${work}/${f}\n`);
    }
    expect(copyOutputs(work, dest, [[work, '<work>']], [])).toBe(true);
    expect((readdirSync(dest, { recursive: true }) as string[]).map((f) => f.replace(/\\/g, '/')).filter((f) => f.endsWith('.js')).sort()).toEqual(['app.js', 'src/b.js']);
    expect(readFileSync(join(dest, 'app.js'), 'utf8')).toBe('<work>/app.js\n');
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
  const text = report(rows, verdicts);

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
    const withSub = report([{ ...base, requests: [...base.requests, sub], modelUsage: { 'claude-sonnet-5': {}, 'claude-haiku-5': {} } }], []);
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
  const study = (rows: RunRow[], settings: Partial<Options> = {}) => {
    const dir = temp('loadout-ab-study-');
    const o = { ...options, ...settings };
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ ...o, versions: {}, schedule: rows.map((r) => r.id) }));
    writeFileSync(join(dir, 'rows.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    writeFileSync(join(dir, 'INCOMPLETE'), 'x');
    return dir;
  };
  const rows = [row({ id: 'claude/bare/warmup/0', prompt: 'warmup', repeat: 0, warmup: true }), row({ id: 'claude/loadout/p1/1', arm: 'loadout' })];

  it('refuses to resume with another model, which would pair rows measured under different ones', () => {
    const dir = study(rows);
    refuseOtherSettings(dir, options);
    expect(() => refuseOtherSettings(dir, { ...options, models: { ...AB_MODELS, claude: 'opus' } })).toThrow(/other settings \(models\)/);
    expect(() => refuseOtherSettings(dir, { ...options, repeats: 3, maxTurns: 10 })).toThrow(/repeats, maxTurns/);
    refuseOtherSettings(join(dir, 'new'), options);
  });

  it('refuses to continue or finish after a row that stopped the batch, but not after an unusable run', async () => {
    const stopped = (invalid: string) => study([...rows, row({ id: 'claude/bare/p1/1', invalid })]);
    refuseStopped(stopped('timed out before the host reported usage'));
    expect(() => refuseStopped(stopped('credential in output'))).toThrow('credential in output');
    const dir = stopped('ambient plugin in the bare arm; measurement invalid');
    await expect(main(['--judge-only', dir], { print: () => {} })).rejects.toThrow('stopped this study');
    expect(existsSync(join(dir, 'INCOMPLETE'))).toBe(true);
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

  const codexScript = (log: string) => `
import { appendFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
const ev = (o) => console.log(JSON.stringify(o));
if (args[0] === '--version') { console.log('codex-cli 0.160.1'); process.exit(0); }
if (args.includes('features')) { for (const f of ['plugins', 'hooks', 'skill_mcp_dependency_install', 'shell_tool', 'unified_exec']) console.log(f.padEnd(32) + 'stable             false'); process.exit(0); }
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
    expect([readFileSync(marker, 'utf8'), readFileSync(capture, 'utf8'), readFileSync(`${capture}.err`, 'utf8')]).toEqual(['invoked\n', '{"a":1}\n', 'noted\n']);
  });

  /** Stand-in CLIs on PATH, a loadout home with one skill, and a way to start bench/ab.ts against them. */
  const stage = (leak = false) => {
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
    writeFileSync(join(dir, 'codex.mjs'), codexScript(log));
    writeFileSync(join(bin, 'claude'), wrapper(join(dir, 'claude.mjs')), { mode: 0o755 });
    writeFileSync(join(bin, 'codex'), wrapper(join(dir, 'codex.mjs')), { mode: 0o755 });
    const start = (args: string[], tmp?: string) => new Promise<{ code: number | null; text: string }>((resolve) => {
      const lines: string[] = [];
      // An absolute loader: the hook the shim runs inherits these arguments and starts in another folder.
      const child = spawn(process.execPath, ['--import', import.meta.resolve('tsx'), 'bench/ab.ts', '--run', '--out', out, ...args], {
        cwd: repo,
        env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, LOADOUT_HOME: loadoutHome, CLAUDE_CODE_OAUTH_TOKEN: 'oauth-secret-value', TYPESAFE_API_KEY: 'jev-secret-value', ...(tmp ? { TMPDIR: tmp } : {}) },
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
    expect(text).toContain('claude/loadout/c1-web-14/1: credential in output');
    const rows = rowsOf();
    // Two warm-ups (not copied), then the first measured run is the loadout arm and ends the batch.
    expect(rows.map((r) => [r.id, r.invalid])).toEqual([['claude/bare/warmup/0', undefined], ['claude/loadout/warmup/0', undefined], ['claude/loadout/c1-web-14/1', 'credential in output']]);
    expect(existsSync(join(out, 'INCOMPLETE'))).toBe(true);
    expect(existsSync(join(out, 'outputs', 'claude', 'c1-web-14', 'loadout-1'))).toBe(false);
    const everything = (readdirSync(out, { recursive: true }) as string[]).filter((f) => statSync(join(out, f)).isFile() && !/^streams[/\\]/.test(f)).map((f) => readFileSync(join(out, f), 'utf8')).join('\n');
    expect(`${text}\n${everything}`).not.toMatch(/oauth-secret-value|jev-secret-value/);

    const again = await start(args);
    expect(again.code).toBe(1);
    expect(again.text).toContain('stopped this study');
    expect(rowsOf()).toHaveLength(3);
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
