import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jevClient, validateResponse } from '../src/jev.js';
import { jevUsageJournal } from '../src/jev-usage.js';
import { jevRunUsage } from '../bench/jev-usage.js';
import { codexRequests } from '../bench/codex-request-usage.js';
import { sessionRollups, type Row } from '../bench/mcp-overhead.js';
import { cacheLifetimeMs } from '../bench/ab.js';
import { codexUsage } from '../bench/usage.js';
import { report, type RunRow, type Verdict } from '../bench/ab-report.js';

const temps: string[] = [];
const temp = () => { const p = mkdtempSync(join(tmpdir(), 'loadout-f2-')); temps.push(p); return p; };
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); for (const p of temps.splice(0)) rmSync(p, { recursive: true, force: true }); });
const fixture = (name: string) => readFileSync(new URL(`./fixtures/request-usage/${name}.jsonl`, import.meta.url), 'utf8');
const questions = { q: { type: 'noul' as const, instructions: 'fixture' } };
const response = (usage: unknown, status = 200) => new Response(JSON.stringify({ model: 'fixture', answers: { q: { type: 'noul', noul: 1 } }, usage }), { status });
const observedClient = () => {
  const file = join(temp(), 'usage.jsonl'); writeFileSync(file, ''); vi.stubEnv('LOADOUT_BENCH_JEV_USAGE', file);
  return { file, client: jevClient({ apiKey: 'private-fixture', baseUrl: 'https://fixture.invalid', model: 'fixture', onUsage: jevUsageJournal(0.1) }) };
};

describe('F2 Jev accounting prototype', () => {
  it('preserves usage before a later routing call fails and counts retry attempts with unknown billing', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(response({ input_tokens: 100, output_tokens: 0 }))
      .mockResolvedValueOnce(response(undefined, 500)).mockResolvedValueOnce(response(undefined, 500));
    vi.stubGlobal('fetch', fetch);
    const { client, file } = observedClient();
    await client.ask('private prompt', questions);
    const failure = expect(client.ask('private prompt', questions)).rejects.toThrow('HTTP 500');
    await vi.runAllTimersAsync(); await failure;
    const text = readFileSync(file, 'utf8');
    expect(text).not.toMatch(/private|fixture.invalid|Authorization/);
    expect(jevRunUsage(text)).toEqual({ calls: 2, attempts: 3, inputTokens: null, outputTokens: null, usageMissing: true, reportedInputCostUsd: 0.00001, costUsd: null });
  });

  it('does not price unreported tokens or unpriced output as zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ input_tokens: 200, output_tokens: 3 })));
    const { client, file } = observedClient(); await client.ask('x', questions);
    expect(jevRunUsage(readFileSync(file, 'utf8'))).toMatchObject({ calls: 1, attempts: 1, inputTokens: 200, outputTokens: 3, usageMissing: false, costUsd: null });
    expect(validateResponse({ answers: { q: { type: 'noul', noul: 1 } } }, questions).usageMissing).toBe(true);
    expect(jevRunUsage('')).toMatchObject({ usageMissing: true, costUsd: null });
    expect(jevRunUsage('{"type":"ready","source":"hook"}', ['hook', 'router'])).toMatchObject({ usageMissing: true, costUsd: null });
    expect(jevRunUsage('{"type":"ready"}\n{"type":"call"}\n{"type":"start"}')).toMatchObject({ usageMissing: true, costUsd: null });
    expect(() => jevRunUsage('private-invalid')).toThrow('contents suppressed');
  });

  it('refuses a missing/nonregular journal and does not retry persistence failures', async () => {
    const { client, file } = observedClient();
    const fetch = vi.fn().mockResolvedValue(response({ input_tokens: 1, output_tokens: 0 })); vi.stubGlobal('fetch', fetch);
    rmSync(file);
    await expect(client.ask('x', questions)).rejects.toThrow('persistence failed');
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv('LOADOUT_BENCH_JEV_USAGE', temp());
    expect(() => jevUsageJournal(0.1)).toThrow('details suppressed');
  });

  it.skipIf(process.platform === 'win32')('refuses a symlink without writing its target', () => {
    const dir = temp(), target = join(dir, 'target'), link = join(dir, 'link'); writeFileSync(target, 'original'); symlinkSync(target, link);
    vi.stubEnv('LOADOUT_BENCH_JEV_USAGE', link);
    expect(() => jevUsageJournal(0.1)).toThrow('persistence failed'); expect(readFileSync(target, 'utf8')).toBe('original');
  });
});

describe('offline Codex source candidates', () => {
  it('deduplicates repeated token updates, skips info-null events, and keeps missing writes unknown', () => {
    const parsed = codexRequests(fixture('codex-rollout-0.163.0'), 'rollout', 'fixture-thread');
    expect(parsed.unreconciled).toEqual([]); expect(parsed.requests).toHaveLength(2);
    expect(parsed.requests[0]).toMatchObject({ input: 1200, cacheRead: 1024, cacheWrite: null, uncached: null, previousInput: null });
    expect(parsed.requests[1]).toMatchObject({ input: 1600, cacheRead: 1408, cacheWrite: 64, uncached: 128, previousInput: 1200 });
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
});
