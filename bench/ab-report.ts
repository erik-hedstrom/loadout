/** The A/B pilot's rows and verdicts, and the report written from them. */
import type { Host } from './overhead.js';
import type { Arm } from './pairwise.js';
import type { RequestUsage, RunUsage } from './usage.js';

export interface RunRow {
  id: string;
  host: Host;
  arm: Arm;
  prompt: string;
  /** 0 for the warm-up run. */
  repeat: number;
  warmup: boolean;
  seq: number;
  startedAt: string;
  endedAt: string;
  ms: number;
  hostVersion: string | null;
  requestedModel: string;
  /** From the stream; null where the host does not report it (Codex). */
  model: string | null;
  exit: number | null;
  timedOut: boolean;
  /** Claude's result subtype ("success", or e.g. "error_max_turns"); null where the host reports none. */
  stop: string | null;
  granularity: 'request' | 'turn';
  /** `gapMs`: time since the same host and arm last made a request (see ab.ts, gapMs). */
  requests: (RequestUsage & { gapMs: number | null })[];
  totals: { uncached: number; cacheWrite: number; cacheRead: number; output: number; effectiveInput: number | null; costUsd: number | null; turns: number | null };
  unreconciled: string[];
  /** Claude's per-model totals from the result event; null where the host reports none. */
  modelUsage: RunUsage['modelUsage'];
  coldCacheRisk: boolean;
  toolCalls: number;
  toolErrors: number;
  loadoutTools: string[];
  skillsOpened: string[];
  hook: { invocations: number; contextChars: number; listed: string[]; injected: string[] };
  hiddenTest: { passed: boolean; tests: number; failed: number } | null;
  invalid?: string;
  /** Set with `invalid: 'credential in output'`: the file and rule that stopped the copy, never the matched text. */
  leak?: { file: string; rule: 'held secret' | 'token shape' };
}

export interface Verdict {
  host: Host;
  prompt: string;
  repeat: number;
  winner: Arm | 'tie' | 'split';
  judge: { backend: string; model: string };
  /** Skill names removed from both arms' files before judging, per arm. */
  redactions: Record<Arm, number>;
}

interface Spread { mean: number; min: number; max: number; n: number }
const spread = (xs: number[]): Spread | null => (xs.length ? { mean: xs.reduce((a, b) => a + b, 0) / xs.length, min: Math.min(...xs), max: Math.max(...xs), n: xs.length } : null);
const num = (n: number) => Math.round(n).toLocaleString('en');
const show = (s: Spread | null, f: (n: number) => string = num) => (s ? (s.n > 1 && s.min !== s.max ? `${f(s.mean)} (${f(s.min)}–${f(s.max)})` : f(s.mean)) : 'not shown');
const usd = (n: number) => `$${n.toFixed(2)}`;
const secs = (n: number) => `${Math.round(n / 1000)} s`;
const percent = (n: number) => `${(100 * n).toFixed(0)}%`;

const measured = (rows: RunRow[]) => rows.filter((r) => !r.warmup && !r.invalid);
const cell = (rows: RunRow[], host: Host, prompt: string, arm: Arm) => measured(rows).filter((r) => r.host === host && r.prompt === prompt && r.arm === arm);
const cacheShare = (r: RunRow) => r.totals.cacheRead / (r.totals.uncached + r.totals.cacheWrite + r.totals.cacheRead);
const triple = (rs: RequestUsage[]) => {
  const mean = (f: (r: RequestUsage) => number) => (rs.length ? rs.reduce((n, r) => n + f(r), 0) / rs.length : null);
  const v = [mean((r) => r.uncached), mean((r) => r.cacheWrite), mean((r) => r.cacheRead)];
  return v.every((x) => x === null) ? 'not shown' : v.map((x) => num(x ?? 0)).join(' / ');
};

export function report(rows: RunRow[], verdicts: Verdict[]): string {
  const hosts = [...new Set(rows.map((r) => r.host))];
  const prompts = [...new Set(measured(rows).map((r) => r.prompt))];
  const judged = (host: Host, prompt: string) => {
    const vs = verdicts.filter((v) => v.host === host && v.prompt === prompt);
    return vs.length ? `loadout ${vs.filter((v) => v.winner === 'loadout').length}, bare ${vs.filter((v) => v.winner === 'bare').length}, tie ${vs.filter((v) => v.winner === 'tie').length}, split ${vs.filter((v) => v.winner === 'split').length}` : 'not judged';
  };
  const out: string[] = ['# A/B pilot report', '',
    `${measured(rows).length} measured runs, ${rows.filter((r) => r.warmup).length} warm-up runs, ${rows.filter((r) => !r.warmup && r.invalid).length} excluded; ${verdicts.length} judged pairs. Three hand-picked prompts where the router loaded something the C1 judge rated useful, so no general claim follows. Two repeats per cell: ranges, not intervals. Tokens are the host's own usage report; uncached input, cache writes, cache reads and output are never summed.`, ''];

  out.push('## 1. Per run, measured runs only (warm-ups excluded)', '',
    'Mean (min–max) over repeats. Cache share = cache read / (uncached + write + read). Effective input = uncached + 1.25 × 5-minute write + 2 × 1-hour write + 0.1 × read (Anthropic\'s published multipliers; Claude only). Cost is the stream\'s `total_cost_usd`, a nominal API price. Codex reports a thread total only.', '',
    '| Host | Prompt | Arm | Runs | Uncached in | Cache write | Cache read | Output | Cache share | Effective in | Cost | Turns | Time | Hidden test | Judge (loadout vs bare) |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |');
  for (const host of hosts) for (const prompt of prompts) for (const arm of ['bare', 'loadout'] as const) {
    const rs = cell(rows, host, prompt, arm);
    if (!rs.length) continue;
    const hidden = rs.filter((r) => r.hiddenTest);
    out.push(`| ${host} | ${prompt} | ${arm} | ${rs.length} | ${show(spread(rs.map((r) => r.totals.uncached)))} | ${show(spread(rs.map((r) => r.totals.cacheWrite)))} | ${show(spread(rs.map((r) => r.totals.cacheRead)))} | ${show(spread(rs.map((r) => r.totals.output)))} | ${show(spread(rs.map(cacheShare)), percent)} | ${show(spread(rs.flatMap((r) => (r.totals.effectiveInput === null ? [] : [r.totals.effectiveInput]))))} | ${show(spread(rs.flatMap((r) => (r.totals.costUsd === null ? [] : [r.totals.costUsd]))), usd)} | ${show(spread(rs.flatMap((r) => (r.totals.turns === null ? [] : [r.totals.turns]))))} | ${show(spread(rs.map((r) => r.ms)), secs)} | ${hidden.length ? `${hidden.filter((r) => r.hiddenTest!.passed).length} of ${hidden.length}` : '—'} | ${arm === 'loadout' ? judged(host, prompt) : ''} |`);
  }

  out.push('', '## 2. loadout − bare (mean of the repeats; negative is cheaper)', '',
    '| Host | Prompt | Δ uncached | Δ cache write | Δ cache read | Δ output | Δ effective in | Δ cost | Hook context (chars) | Skills named / injected / opened |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |');
  for (const host of hosts) for (const prompt of prompts) {
    const [b, l] = [cell(rows, host, prompt, 'bare'), cell(rows, host, prompt, 'loadout')];
    if (!b.length || !l.length) continue;
    const mean = (rs: RunRow[], f: (r: RunRow) => number | null) => { const xs = rs.flatMap((r) => (f(r) === null ? [] : [f(r)!])); return xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null; };
    const delta = (f: (r: RunRow) => number | null, g: (n: number) => string = (n) => (n > 0 ? '+' : '') + num(n)) => { const [x, y] = [mean(l, f), mean(b, f)]; return x === null || y === null ? 'not shown' : g(x - y); };
    out.push(`| ${host} | ${prompt} | ${delta((r) => r.totals.uncached)} | ${delta((r) => r.totals.cacheWrite)} | ${delta((r) => r.totals.cacheRead)} | ${delta((r) => r.totals.output)} | ${delta((r) => r.totals.effectiveInput)} | ${delta((r) => r.totals.costUsd, (n) => `${n > 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`)} | ${show(spread(l.map((r) => r.hook.contextChars)))} | ${[...new Set(l.flatMap((r) => r.hook.listed))].join(', ') || '—'} / ${[...new Set(l.flatMap((r) => r.hook.injected))].join(', ') || '—'} / ${[...new Set(l.flatMap((r) => r.skillsOpened))].join(', ') || '—'} |`);
  }

  out.push('', '## 3. Request 1 against requests 2+ (per request, uncached / write / read)', '',
    'Request 1 carries the prompt-specific hook context, which cannot be cached on first use; later requests should read it from cache. A loadout − bare difference that stays in "uncached" or "write" on requests 2+ means the injected text is paid every turn. Subagent requests are billed in every total but left out of this split. Codex: not shown (`codex exec --json` reports one thread total).', '',
    '| Host | Prompt | Arm | Request 1 | Requests 2+ (mean per request) | Main-thread requests per run | Subagent requests (all runs) |', '| --- | --- | --- | --- | --- | ---: | ---: |');
  for (const host of hosts.filter((h) => h === 'claude')) for (const prompt of prompts) for (const arm of ['bare', 'loadout'] as const) {
    const rs = cell(rows, host, prompt, arm).filter((r) => r.granularity === 'request');
    const thread = (r: RunRow) => r.requests.filter((q) => !q.subagent);
    if (rs.length) out.push(`| ${host} | ${prompt} | ${arm} | ${triple(rs.flatMap((r) => thread(r).slice(0, 1)))} | ${triple(rs.flatMap((r) => thread(r).slice(1)))} | ${show(spread(rs.map((r) => thread(r).length)))} | ${rs.reduce((n, r) => n + r.requests.length - thread(r).length, 0)} |`);
  }

  out.push('', '## 4. Cold start (warm-up run) against warm (measured runs)', '',
    'The first run of each arm writes that arm\'s own prefix to the cache (the arms\' prefixes differ), so it is reported here and excluded from every other table. Per request: uncached / write / read; Codex: whole-run totals.', '',
    '| Host | Arm | Warm-up request 1 | Measured request 1 (mean) | Warm-up run total | Measured run total (mean) |', '| --- | --- | --- | --- | --- | --- |');
  for (const host of hosts) for (const arm of ['bare', 'loadout'] as const) {
    const w = rows.filter((r) => r.host === host && r.arm === arm && r.warmup && !r.invalid);
    const m = measured(rows).filter((r) => r.host === host && r.arm === arm);
    if (!w.length) continue;
    const run = (rs: RunRow[]) => triple(rs.map((r) => ({ uncached: r.totals.uncached, cacheWrite: r.totals.cacheWrite, cacheRead: r.totals.cacheRead }) as RequestUsage));
    out.push(`| ${host} | ${arm} | ${host === 'claude' ? triple(w.flatMap((r) => r.requests.slice(0, 1))) : 'not shown'} | ${host === 'claude' ? triple(m.flatMap((r) => r.requests.slice(0, 1))) : 'not shown'} | ${run(w)} | ${run(m)} |`);
  }

  const silent = (r: RunRow) => r.arm === 'loadout' && !r.warmup && !r.invalid && r.hook.contextChars === 0;
  const models = (r: RunRow) => Object.keys(r.modelUsage ?? {});
  const flagged = rows.filter((r) => r.coldCacheRisk || r.unreconciled.length || r.invalid || silent(r) || models(r).length > 1);
  out.push('', '## 5. Flags', '');
  out.push(...(flagged.length ? flagged.map((r) => `- ${r.id}${r.warmup ? ' (warm-up)' : ''}: ${[r.invalid && `invalid: ${r.invalid}`, r.coldCacheRisk && 'coldCacheRisk (a gap of over 5 minutes since this arm\'s previous request)', r.unreconciled.length && `usage differs from the result event in ${r.unreconciled.join(', ')}`, silent(r) && 'the hook added no context, so this run may measure the bare setup', models(r).length > 1 && `tokens were billed to ${models(r).join(', ')}`].filter(Boolean).join('; ')}`) : ['None.']));
  const timedOut = rows.filter((r) => r.timedOut);
  if (timedOut.length) out.push(`- Timed out: ${timedOut.map((r) => r.id).join(', ')}.`);
  const stopped = rows.filter((r) => r.stop && r.stop !== 'success');
  if (stopped.length) out.push(`- Stopped before finishing: ${stopped.map((r) => `${r.id} (${r.stop})`).join(', ')}.`);

  out.push('', '## 6. Not shown', '',
    '- Per-request usage for Codex, its model name and its cost: `codex exec --json` gives a thread total only.',
    '- Quality beyond the blind pairwise judge and the hidden test; the judge sees file contents only, with skill names removed, so a skill\'s own template can still reveal the arm.',
    '- Anything about prompts other than these three, or about a random sample of requests.');
  return out.join('\n') + '\n';
}
