import { linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jevClient } from '../src/jev.js';
import { JEV_USAGE_MARKER, JEV_USAGE_MARKER_TEXT, jevUsageJournal } from '../src/jev-usage.js';
import { jevRunUsage, readJevUsage } from '../bench/jev-usage.js';
import { codexRequests } from '../bench/codex-request-usage.js';
import { sessionRollups, summarize, type Row } from '../bench/mcp-overhead.js';
import { parseCodex } from '../bench/overhead.js';
import { cacheLifetimeMs } from '../bench/ab.js';
import { codexUsage } from '../bench/usage.js';
import { report, type RunRow, type Verdict } from '../bench/ab-report.js';

const temps: string[] = [];
vi.mock('node:fs', async (original) => ({ ...await original<typeof import('node:fs')>() }));
vi.mock('node:crypto', async (original) => ({ ...await original<typeof import('node:crypto')>() }));
const temp = () => { const p = mkdtempSync(join(tmpdir(), 'loadout-f2-')); temps.push(p); return p; };
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); for (const p of temps.splice(0)) rmSync(p, { recursive: true, force: true }); });
const fixture = (name: string) => readFileSync(new URL(`./fixtures/request-usage/${name}.jsonl`, import.meta.url), 'utf8');
const questions = { q: { type: 'noul' as const, instructions: 'fixture' } };
const response = (usage: unknown, status = 200) => new Response(JSON.stringify({ model: 'fixture', answers: { q: { type: 'noul', noul: 1 } }, usage }), { status });
const journal = () => {
  const dir = realpathSync(temp());
  writeFileSync(join(dir, JEV_USAGE_MARKER), JEV_USAGE_MARKER_TEXT, { mode: 0o600 });
  vi.stubEnv('LOADOUT_BENCH_JEV_USAGE', dir);
  return dir;
};
const journalText = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
const observedClient = () => {
  const dir = journal();
  return { dir, client: jevClient({ apiKey: 'private-fixture', baseUrl: 'https://fixture.invalid', model: 'fixture', onUsage: jevUsageJournal(0.1) }) };
};

describe('F2 Jev accounting prototype', () => {
  it('does no filesystem work when capture is unset', () => {
    vi.stubEnv('LOADOUT_BENCH_JEV_USAGE', '');
    const open = vi.spyOn(fs, 'openSync');
    expect(jevUsageJournal(0.1)).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });

  it.skipIf(process.platform === 'win32')('refuses a nonprivate directory', () => {
    const dir = journal(); fs.chmodSync(dir, 0o755);
    expect(() => jevUsageJournal(0.1)).toThrow('persistence failed');
    expect(readdirSync(dir)).toEqual([JEV_USAGE_MARKER]);
  });

  it('preserves usage before a later routing call fails and counts retry attempts with unknown billing', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(response({ input_tokens: 100, output_tokens: 0 }))
      .mockResolvedValueOnce(response(undefined, 500)).mockResolvedValueOnce(response(undefined, 500));
    vi.stubGlobal('fetch', fetch);
    const { client, dir } = observedClient();
    await client.ask('private prompt', questions);
    const failure = expect(client.ask('private prompt', questions)).rejects.toThrow('HTTP 500');
    await vi.runAllTimersAsync(); await failure;
    const text = journalText(dir);
    expect(text).not.toMatch(/private|fixture.invalid|Authorization/);
    expect(jevRunUsage(text)).toEqual({ calls: 2, attempts: 3, inputTokens: null, outputTokens: null, usageMissing: true, reportedInputCostUsd: 0.00001, costUsd: null });
  });

  it('does not price unreported tokens or unpriced output as zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ input_tokens: 200, output_tokens: 3 })));
    const { client, dir } = observedClient(); await client.ask('x', questions);
    expect(readJevUsage(dir, ['router'])).toMatchObject({ calls: 1, attempts: 1, inputTokens: 200, outputTokens: 3, usageMissing: false, costUsd: null });
    expect(jevRunUsage('')).toMatchObject({ usageMissing: true, costUsd: null });
    expect(jevRunUsage('{"type":"ready","source":"hook"}', ['hook', 'router'])).toMatchObject({ usageMissing: true, costUsd: null });
    expect(jevRunUsage('{"type":"ready"}\n{"type":"call"}\n{"type":"start"}')).toMatchObject({ usageMissing: true, costUsd: null });
    expect(() => jevRunUsage('private-invalid')).toThrow('contents suppressed');
  });

  it('does not retry when a finish write fails after a successful call/start', async () => {
    const { client, dir } = observedClient();
    const fetch = vi.fn().mockImplementation(async () => {
      rmSync(join(dir, JEV_USAGE_MARKER));
      return response({ input_tokens: 1, output_tokens: 0 });
    }); vi.stubGlobal('fetch', fetch);
    await expect(client.ask('x', questions)).rejects.toThrow('persistence failed');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(readJevUsage(dir, ['router'])).toMatchObject({ attempts: 1, usageMissing: true, costUsd: null });
  });

  it('refuses an existing file and a symlink/junction parent without changing their contents', () => {
    const dir = journal(), target = join(dir, 'victim'); writeFileSync(target, 'original');
    vi.stubEnv('LOADOUT_BENCH_JEV_USAGE', target);
    expect(() => jevUsageJournal(0.1)).toThrow('persistence failed');
    const parent = realpathSync(temp()), alias = join(parent, 'alias');
    symlinkSync(dir, alias, process.platform === 'win32' ? 'junction' : 'dir');
    mkdirSync(join(dir, 'nested'), { mode: 0o700 });
    writeFileSync(join(dir, 'nested', JEV_USAGE_MARKER), JEV_USAGE_MARKER_TEXT);
    vi.stubEnv('LOADOUT_BENCH_JEV_USAGE', join(alias, 'nested'));
    expect(() => jevUsageJournal(0.1)).toThrow('persistence failed');
    expect(readFileSync(target, 'utf8')).toBe('original');
  });

  it('exclusive creation refuses a hard-linked destination on every platform', () => {
    const dir = journal(), victim = join(realpathSync(temp()), 'victim'); writeFileSync(victim, 'original');
    const id = '00000000-0000-0000-0000-000000000000';
    linkSync(victim, join(dir, `jev-${id}.jsonl`));
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
    expect(() => jevUsageJournal(0.1)).toThrow('persistence failed');
    expect(readFileSync(victim, 'utf8')).toBe('original');
  });

  it('does not overwrite an existing target when a checked parent is swapped before open', () => {
    const parent = realpathSync(temp()), dir = join(parent, 'journal'); mkdirSync(dir, { mode: 0o700 });
    writeFileSync(join(dir, JEV_USAGE_MARKER), JEV_USAGE_MARKER_TEXT);
    const target = journal(), id = '00000000-0000-0000-0000-000000000000';
    const victim = join(target, `jev-${id}.jsonl`); writeFileSync(victim, 'original');
    vi.stubEnv('LOADOUT_BENCH_JEV_USAGE', dir);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(id);
    const open = fs.openSync;
    vi.spyOn(fs, 'openSync').mockImplementation(((path, flags, mode) => {
      if (flags === 'wx') { renameSync(dir, join(parent, 'old')); symlinkSync(target, dir, process.platform === 'win32' ? 'junction' : 'dir'); }
      return open(path, flags, mode);
    }) as typeof fs.openSync);
    expect(() => jevUsageJournal(0.1)).toThrow('persistence failed');
    expect(readFileSync(victim, 'utf8')).toBe('original');
  });

  it.each([undefined, null, 'private-price', {}, [], -1, Infinity, NaN])('rejects a nonnumeric/invalid price before writing: %j', (price) => {
    const dir = journal();
    expect(() => jevUsageJournal(price as number)).toThrow('details suppressed');
    expect(readdirSync(dir)).toEqual([JEV_USAGE_MARKER]);
  });

  it('rejects secret-bearing config pricing through the real hook CLI before journaling', () => {
    const dir = journal(), home = realpathSync(temp());
    writeFileSync(join(home, 'config.json'), JSON.stringify({ embeddings: false, jev: { inputPricePerMTok: { credential: 'private-price-value' } } }));
    const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), 'src/cli.ts', 'hook', 'codex'], {
      cwd: join(import.meta.dirname, '..'), encoding: 'utf8', input: JSON.stringify({ prompt: 'ok', session_id: 'fixture' }),
      env: { ...process.env, LOADOUT_HOME: home, TYPESAFE_API_KEY: 'fixture-only-key', LOADOUT_BENCH_JEV_USAGE: dir },
    });
    expect(result.stderr).toContain('hook failed; added nothing');
    expect(result.stdout + result.stderr).not.toContain('private-price-value');
    expect(readdirSync(dir)).toEqual([JEV_USAGE_MARKER]);
  });

  it('returns unknown rather than throwing on malformed persisted usage', () => {
    const dir = journal(); writeFileSync(join(dir, 'jev-bad.jsonl'), 'private-malformed');
    expect(readJevUsage(dir, ['router'])).toEqual({ calls: null, attempts: null, inputTokens: null, outputTokens: null, usageMissing: true, reportedInputCostUsd: null, costUsd: null });
  });
});

describe('offline Codex source candidates', () => {
  it('deduplicates repeated token updates, skips info-null events, and keeps missing writes unknown', () => {
    const parsed = codexRequests(fixture('codex-rollout-0.163.0'), 'rollout', 'fixture-thread');
    expect(parsed.unreconciled).toEqual([]); expect(parsed.requests).toHaveLength(2);
    expect(parsed.requests[0]).toMatchObject({ input: 1200, cacheRead: 1024, cacheWrite: null, uncached: null });
    expect(parsed.requests[1]).toMatchObject({ input: 1600, cacheRead: 1408, cacheWrite: 64, uncached: 128 });
    expect(JSON.stringify(parsed)).not.toMatch(/secret|private|discard|fixture-thread/);
    expect(codexRequests(fixture('codex-app-server-0.163.0'), 'app-server', 'fixture-thread').requests).toHaveLength(1);
    expect(codexRequests(fixture('codex-app-server-0.163.0'), 'app-server', 'other').requests).toEqual([]);
  });

  it('preserves completed counters on truncation and flags estimates/resets instead of inventing requests', () => {
    const text = fixture('codex-rollout-0.163.0');
    expect(codexRequests(text + '{"private', 'rollout', 'fixture-thread')).toMatchObject({ unreconciled: ['truncated final event'] });
    const rows = text.trim().split('\n').map((s) => JSON.parse(s)); rows.at(-1).payload.info.total_token_usage.input_tokens++;
    expect(codexRequests(rows.map((r) => JSON.stringify(r)).join('\n'), 'rollout', 'fixture-thread')).toMatchObject({ unreconciled: ['usage increment does not match last request'] });
    expect(() => codexRequests(text, 'rollout', 'wrong-session')).toThrow('contents suppressed');
    rows.at(-1).payload.info.last_token_usage.output_tokens = 'private-secret';
    expect(() => codexRequests(rows.map((r) => JSON.stringify(r)).join('\n'), 'rollout', 'fixture-thread')).toThrow('contents suppressed');
  });

  it('flags the legacy exec zero-write projection when the field is missing', () => {
    expect(codexUsage('{"type":"turn.completed","usage":{"input_tokens":10,"cached_input_tokens":0,"output_tokens":1}}').unreconciled).toEqual(['cacheWrite not reported (legacy projection uses zero)']);
  });
});

it('rolls B7 measured rows up once per session and never adds repeated run durations', () => {
  const r: Row = { host: 'claude', kind: 'baseline', config: null, toolSearch: null, repeat: 1, turn: 1, model: 'm', requestedModel: 'm', hostVersion: 'v', input: 10, uncached: 4, cacheCreation: 2, cacheRead: 4, output: 1,
    mcp: [], ambientHash: null, toolsListed: 0, mcpToolsListed: 0, toolSearchListed: false, canaryFound: null, runMs: 45 };
  expect(sessionRollups([r, { ...r, turn: 2 }])[0]).toMatchObject({ measuredRows: 2, input: 20, uncached: 8, cacheCreation: 4, cacheRead: 8, output: 2, runMs: 45 });
  const { runMs: _time, ...legacy } = r;
  expect(sessionRollups([legacy])[0]?.runMs).toBeNull();
  expect(sessionRollups([{ ...legacy, host: 'codex' }])[0]?.granularity).toBe('turn');
});

it('keeps Codex lifetime unknown and uses the actual Claude write lifetime', () => {
  const u = { n: 1, at: null, model: null, uncached: 0, cacheWrite: 1, cacheRead: 0, output: 0, cacheWrite5m: 0, cacheWrite1h: 1, reasoning: null, subagent: false };
  expect(cacheLifetimeMs('codex', u)).toBeNull(); expect(cacheLifetimeMs('claude', u)).toBe(3600000);
  expect(cacheLifetimeMs('claude', { ...u, cacheWrite5m: 1, cacheWrite1h: 0 })).toBe(300000);
  expect(cacheLifetimeMs('claude', { ...u, cacheWrite5m: 1 })).toBeNull();
});

describe('legacy C14/C15 report compatibility and missing cache shares', () => {
  const dir = new URL('../bench/results/2026-10-26T21-04-28Z-ab-pilot-luna-rerun/', import.meta.url);
  const rows: RunRow[] = readFileSync(new URL('rows.jsonl', dir), 'utf8').trim().split('\n').map((s) => JSON.parse(s));
  const verdicts: Verdict[] = readFileSync(new URL('verdicts.jsonl', dir), 'utf8').trim().split('\n').map((s) => JSON.parse(s));
  const hashes = JSON.parse(readFileSync(new URL('./fixtures/request-usage/legacy-report-hashes.json', import.meta.url), 'utf8'));
  const digest = (s: string) => createHash('sha256').update(s).digest('hex');
  it('reproduces baseline C14 and legacy native-arm reports byte-for-byte', () => {
    expect(digest(report(rows, verdicts, []))).toBe(hashes.c14);
    const native = rows.map((r) => ({ ...r, arm: r.arm === 'bare' ? 'native' as const : r.arm, librarySize: 250 }));
    expect(digest(report(native, [], []))).toBe(hashes.native);
  });
  it('reports a zero denominator as unknown and never rounds a partial hit to 100%', () => {
    const base = rows.find((r) => !r.warmup)!;
    const make = (uncached: number, cacheRead: number) => ({ ...base, totals: { ...base.totals, uncached, cacheRead, cacheWrite: 0 } });
    expect(report([make(0, 0)], [], [])).not.toMatch(/NaN|Infinity/);
    expect(report([make(2, 20774)], [], [])).toContain('<100%');
  });

  it('renders every capture-v1 accounting and cache-gap state', () => {
    const base = rows.find((r) => !r.warmup)!;
    const complete = { calls: 2, attempts: 3, inputTokens: 100, outputTokens: 0, usageMissing: false, reportedInputCostUsd: 0.01, costUsd: 0.01 };
    const captured: RunRow[] = [
      { ...base, id: 'bare', captureVersion: 1, requestCount: 1, arm: 'bare', jev: null, coldCacheRisk: false },
      { ...base, id: 'complete', captureVersion: 1, requestCount: 2, arm: 'loadout', jev: complete, coldCacheRisk: true },
      { ...base, id: 'missing', captureVersion: 1, requestCount: null, arm: 'loadout', jev: { calls: null, attempts: null, inputTokens: null, outputTokens: null, usageMissing: true, reportedInputCostUsd: null, costUsd: null }, coldCacheRisk: null },
      { ...base, id: 'unpriced-output', captureVersion: 1, requestCount: 3, arm: 'loadout', jev: { ...complete, outputTokens: 3, costUsd: null }, coldCacheRisk: null },
      { ...base, id: 'priced-output', captureVersion: 1, requestCount: 3, arm: 'loadout', jev: { ...complete, outputTokens: 3, costUsd: 0.02 }, coldCacheRisk: false },
    ];
    const text = report(captured, [], []).split('## F2 capture columns')[1]!;
    expect(text).toContain('| bare | 1 | n/a | n/a | not shown | not shown | n/a | n/a | not shown | clear |');
    expect(text).toContain('| complete | 2 | 2 | 3 | 100 | 0 | false | 0.010000000 | 0.010000000 | flagged |');
    expect(text).toContain('| missing | not shown (turn total) | not shown | not shown | not shown | not shown | true | not shown | not shown | unknown |');
    expect(text).toContain('| unpriced-output | 3 | 2 | 3 | 100 | 3 | false | 0.010000000 | not shown | unknown |');
    expect(text).toContain('| priced-output | 3 | 2 | 3 | 100 | 3 | false | 0.010000000 | 0.020000000 | clear |');
    expect(report(captured.map((r) => ({ ...r, arm: r.arm === 'bare' ? 'native' : r.arm, librarySize: 250 })), [], [])).toContain(text);
  });

  it('shows unknown Codex write/uncached buckets in A/B and native reports', () => {
    const usage = codexUsage('{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":20,"output_tokens":1}}');
    const base = rows.find((r) => !r.warmup)!;
    const row: RunRow = { ...base, prompt: 'missing-write', requests: usage.requests.map((r) => ({ ...r, gapMs: null })),
      totals: { ...base.totals, uncached: 80, cacheWrite: 0, cacheRead: 20 } };
    expect(report([row], [], [])).toContain('| codex | missing-write | loadout | 1 | not shown | not shown | 20 |');
    expect(report([{ ...row, arm: 'native', librarySize: 250 }], [], [])).toContain('| missing-write | 1 | native | not shown | not shown | 20 |');
  });

  it('shows unknown Codex writes in B7 request rows and session rollups', () => {
    const parsed = parseCodex('{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":20,"output_tokens":1}}');
    const row: Row = { ...parsed, host: 'codex', kind: 'baseline', config: null, toolSearch: null, repeat: 1, turn: 1, requestedModel: 'fixture', hostVersion: 'fixture',
      mcp: null, ambientHash: null, toolsListed: null, mcpToolsListed: null, toolSearchListed: null, canaryFound: null, runMs: 10 };
    const text = summarize([row]);
    expect(text).toContain('| 100 | 0 | not shown | not shown | 20 |');
    expect(text).toContain('| turn | 1 | 100 | not shown | not shown | 20 | 1 | 10 |');
    const legacy = { ...row }; delete legacy.cacheWriteAvailable; delete legacy.runMs;
    expect(summarize([legacy])).toContain('| 100 | 0 | 80 | 0 | 20 |');
  });
});
