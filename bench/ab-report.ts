/** The A/B pilot's rows and verdicts, and the report written from them. */
import type { Host } from './overhead.js';
import type { Arm } from './pairwise.js';
import type { RequestUsage, RunUsage } from './usage.js';
import { codexEffectiveInput } from './usage.js';
import { DATA, readJsonl, wilson } from './lib.js';
import { join } from 'node:path';

/** Frozen before the study; shared with selection so missing pairs cannot redefine the planned sample. */
export const C15_IDS = readJsonl<{ id: string }>(join(DATA, 'ab-c15-prompts.jsonl')).map((p) => p.id);

/**
 * What Codex's login tokens (JWTs) and API keys look like; they can occur in third-party skill text and parsed metadata.
 * TOKEN_ANYWHERE has no boundary on purpose: any boundary can be defeated by what precedes a token (a letter, or a JSON
 * escape such as `\n` or `\\n`, which ends in a letter), while escaping never changes the token's own run. It is used
 * where a false positive is cheap: redaction at every sink (a rare kebab-case name such as `task-…` with 20+ characters
 * after `sk-` is shown as `<credential>`) and withholding a local stream.
 */
const TOKEN = String.raw`(?:eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}|sk-[\w-]{20,})`;
export const TOKEN_ANYWHERE = new RegExp(TOKEN);
/**
 * For the one check where a false positive stops a paid study, a token shape in a deliverable: not preceded by a letter
 * or digit, so kebab-case identifiers in agent code (`mask-image-…`, `task-list-item-…`) do not match. A token glued to a
 * letter in a deliverable is therefore not caught; held secrets are matched exactly and are unaffected.
 */
export const CREDENTIAL_SHAPE = new RegExp(String.raw`(?<![A-Za-z0-9])${TOKEN}`);

export function redact(text: string, secrets: string[]): string {
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) text = text.split(secret).join('<credential>');
  return text.replace(new RegExp(TOKEN, 'g'), '<credential>');
}

/** Keys and string values are redacted decoded, so a held secret is matched as it was, not as JSON escaped it. */
export function persistJson(value: unknown, secrets: string[]): string {
  const clean = (v: unknown): unknown => typeof v === 'string' ? redact(v, secrets)
    : Array.isArray(v) ? v.map(clean)
    : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [redact(k, secrets), clean(x)]))
    : v;
  return JSON.stringify(clean(value));
}

export interface Leak { file: string; rule: 'held secret' | 'token shape' }

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
  /** New or changed deliverable file, excluding the synthetic final response and unchanged fixture files. Absent on legacy rows. */
  wroteFile?: boolean;
  invalid?: string;
  /** Set with `invalid: 'credential in output'`: the source and rule that stopped persistence, never the matched text. */
  leak?: Leak;
  streamWithheld?: 'token shape';
  /** C15 only; absent on historical C14 rows. Hashes cover the sanitized SKILL.md bytes. */
  librarySize?: number;
  corpusHash?: string;
  manifestHash?: string;
  skillsBudget?: { descriptionsRemoved: boolean; omitted: number } | null;
  codexRetries?: number;
}

export interface Verdict {
  host: Host;
  prompt: string;
  repeat: number;
  winner: Arm | 'tie' | 'split';
  judge: { backend: string; model: string };
  /** Skill names removed from both arms' files before judging, per arm. */
  redactions: Partial<Record<Arm, number>>;
  orders?: { winner: Arm | 'tie'; confidence: string; reasons: string }[];
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

export function report(rows: RunRow[], verdicts: Verdict[], secrets: string[]): string {
  if (rows.some((r) => r.arm === 'native' || r.librarySize !== undefined)) return redact(reportNative(rows, verdicts), secrets);
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
    '| Host | Prompt | Arm | Runs | Uncached in | Cache write | Cache read | Output | Cache share | Effective in | Cost | Turns | Time | Hidden test | Judge (loadout vs bare) | Wrote a file |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |');
  for (const host of hosts) for (const prompt of prompts) for (const arm of ['bare', 'loadout'] as const) {
    const rs = cell(rows, host, prompt, arm);
    if (!rs.length) continue;
    const hidden = rs.filter((r) => r.hiddenTest);
    out.push(`| ${host} | ${prompt} | ${arm} | ${rs.length} | ${show(spread(rs.map((r) => r.totals.uncached)))} | ${show(spread(rs.map((r) => r.totals.cacheWrite)))} | ${show(spread(rs.map((r) => r.totals.cacheRead)))} | ${show(spread(rs.map((r) => r.totals.output)))} | ${show(spread(rs.map(cacheShare)), percent)} | ${show(spread(rs.flatMap((r) => (r.totals.effectiveInput === null ? [] : [r.totals.effectiveInput]))))} | ${show(spread(rs.flatMap((r) => (r.totals.costUsd === null ? [] : [r.totals.costUsd]))), usd)} | ${show(spread(rs.flatMap((r) => (r.totals.turns === null ? [] : [r.totals.turns]))))} | ${show(spread(rs.map((r) => r.ms)), secs)} | ${hidden.length ? `${hidden.filter((r) => r.hiddenTest!.passed).length} of ${hidden.length}` : '—'} | ${arm === 'loadout' ? judged(host, prompt) : ''} | ${rs.every((r) => r.wroteFile !== undefined) ? `${rs.filter((r) => r.wroteFile).length} of ${rs.length}` : 'not shown'} |`);
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
    '- Quality beyond the blind pairwise judge and the hidden test; the judge sees saved files and final responses (when captured), with skill names removed, so a skill\'s own template can still reveal the arm.',
    '- Anything about prompts other than these three, or about a random sample of requests.');
  return redact(out.join('\n') + '\n', secrets);
}

/** C15 keeps individual repeats visible: differences of unpaired means cannot substitute for paired savings. */
function reportNative(rows: RunRow[], verdicts: Verdict[]): string {
  const measuredRows = measured(rows);
  const metric = (n: number) => n.toLocaleString('en', { maximumFractionDigits: 2 });
  const out = ['# C15 native library comparison', '',
    `${measuredRows.length} measured runs; ${rows.filter((r) => r.warmup).length} warm-ups excluded; ${rows.filter((r) => r.invalid).length} invalid rows. Codex thread totals, not per-request usage.`, '',
    'Effective input = uncached input x 1 + cache write x 1 + cached input x 0.1. The 0.1 multiplier is a fixed price-sheet assumption ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)), not verified Luna subscription billing. Output tokens and Jev costs are separate. Positive native minus loadout means input savings for loadout.', '',
    '| Prompt | Repeat | Arm | Uncached | Cache write | Cached | Output | Effective input | Tool calls | Skills opened | Hook context chars | skillsBudget |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |'];
  for (const r of measuredRows) out.push(`| ${r.prompt} | ${r.repeat} | ${r.arm} | ${num(r.totals.uncached)} | ${num(r.totals.cacheWrite)} | ${num(r.totals.cacheRead)} | ${num(r.totals.output)} | ${metric(codexEffectiveInput(r.totals))} | ${r.toolCalls} | ${r.skillsOpened.join(', ') || 'none observed'} | ${r.hook.contextChars} | ${r.skillsBudget === undefined ? 'not shown' : JSON.stringify(r.skillsBudget)} |`);
  out.push('', '## Paired native minus loadout', '',
    '| Prompt | Repeat | Uncached delta | Write delta | Cached delta | Output delta | Effective input delta |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  const pairs: { native: RunRow; loadout: RunRow; delta: number }[] = [];
  const key = (r: { host: Host; prompt: string; repeat: number }) => `${r.host}/${r.prompt}/${r.repeat}`;
  const planned = C15_IDS.flatMap((prompt) => [1, 2].map((repeat) => `codex/${prompt}/${repeat}`));
  const byKey = new Map<string, RunRow[]>();
  for (const r of rows.filter((r) => !r.warmup)) {
    const k = `${key(r)}/${r.arm}`;
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const duplicateRows = [...byKey.values()].some((rs) => rs.length !== 1);
  const unexpectedRows = [...byKey.values()].flat().some((r) => !planned.includes(key(r)) || !['native', 'loadout'].includes(r.arm));
  const identity = (r: RunRow) => JSON.stringify([r.manifestHash, r.corpusHash, r.librarySize]);
  const commonManifest = rows.every((r) => !!r.manifestHash && !!r.corpusHash && Number.isSafeInteger(r.librarySize) && r.librarySize! > 0)
    && new Set(rows.map(identity)).size === 1;
  const metricMismatch = measuredRows.some((r) => r.totals.effectiveInput !== null && Math.abs(r.totals.effectiveInput - codexEffectiveInput(r.totals)) > 0.001);
  if (duplicateRows) out.push('- Invalid study: duplicate row keys; duplicates excluded.');
  if (unexpectedRows) out.push('- Invalid study: unexpected prompt/repeat/arm keys.');
  if (!commonManifest) out.push('- Invalid study: manifest mismatch across the study; not paired.');
  if (metricMismatch) out.push('- Invalid study: stored effective input differs from recomputation.');
  for (const k of planned) {
    const ns = byKey.get(`${k}/native`) ?? [], ls = byKey.get(`${k}/loadout`) ?? [];
    if (!commonManifest || ns.length !== 1 || ls.length !== 1 || ns[0]!.invalid || ls[0]!.invalid) continue;
    const native = ns[0]!, loadout = ls[0]!;
    const delta = codexEffectiveInput(native.totals) - codexEffectiveInput(loadout.totals);
    pairs.push({ native, loadout, delta });
    out.push(`| ${native.prompt} | ${native.repeat} | ${num(native.totals.uncached - loadout.totals.uncached)} | ${num(native.totals.cacheWrite - loadout.totals.cacheWrite)} | ${num(native.totals.cacheRead - loadout.totals.cacheRead)} | ${num(native.totals.output - loadout.totals.output)} | ${metric(delta)} |`);
  }
  const pairedSummary = (xs: number[]) => {
    if (!xs.length) return 'not shown';
    const sorted = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
    return `median ${metric(median)}; range ${metric(sorted[0]!)} to ${metric(sorted.at(-1)!)}; n=${xs.length}`;
  };
  out.push('', `Missing planned pairs: ${planned.length - pairs.length} of ${planned.length} (primary plan).`);
  out.push('', pairs.length ? `Paired effective-input ${pairedSummary(pairs.map((p) => p.delta))}.` : 'Paired effective-input median: not shown.');
  for (const prompt of new Set(pairs.map((p) => p.native.prompt))) out.push(`- ${prompt}: ${pairedSummary(pairs.filter((p) => p.native.prompt === prompt).map((p) => p.delta))}.`);
  out.push('', '## Blind quality, both orders', '',
    '| Prompt | Repeat | First order winner | Reverse order winner | Both-orders verdict |',
    '| --- | ---: | --- | --- | --- |');
  const verdictsByKey = new Map<string, Verdict[]>();
  for (const v of verdicts) verdictsByKey.set(key(v), [...(verdictsByKey.get(key(v)) ?? []), v]);
  const duplicateVerdicts = [...verdictsByKey.values()].some((vs) => vs.length !== 1);
  const unexpectedVerdicts = verdicts.some((v) => !planned.includes(key(v)));
  if (duplicateVerdicts) out.push('- Invalid study: duplicate verdict keys; duplicates excluded.');
  if (unexpectedVerdicts) out.push('- Invalid study: unexpected verdict keys.');
  const judged = pairs.flatMap((p) => {
    const vs = verdictsByKey.get(key(p.native)) ?? [];
    if (vs.length !== 1 || vs[0]!.orders?.length !== 2) return [];
    const v = vs[0]!, [a, b] = v.orders!;
    const allowed = ['native', 'loadout', 'tie'];
    if (!allowed.includes(a!.winner) || !allowed.includes(b!.winner) || v.winner !== (a!.winner === b!.winner ? a!.winner : 'split')) return [];
    return [v];
  });
  for (const v of judged) out.push(`| ${v.prompt} | ${v.repeat} | ${v.orders![0]!.winner} | ${v.orders![1]!.winner} | ${v.winner} |`);
  const losses = judged.filter((v) => v.winner === 'native').length;
  const wins = judged.filter((v) => v.winner === 'loadout').length;
  out.push('', judged.length ? `Loadout wins ${wins}; native wins (loadout loses) ${losses}; ties ${judged.filter((v) => v.winner === 'tie').length}; splits ${judged.filter((v) => v.winner === 'split').length}. Loadout-loses rate ${losses}/${judged.length}; Wilson 95% ${wilson(losses, judged.length)}.` : 'Quality: not shown (unjudged).');
  out.push(`Missing both-orders verdicts: ${pairs.length - judged.length} of ${pairs.length} available pairs.`);
  const hidden = pairs.filter((p) => p.native.prompt === 'c1-debug-13');
  const validHidden = hidden.filter((p) => (p.native.hiddenTest?.tests ?? 0) > 0 && (p.loadout.hiddenTest?.tests ?? 0) > 0);
  const nativePasses = validHidden.filter((p) => p.native.hiddenTest!.passed).length;
  const loadoutPasses = validHidden.filter((p) => p.loadout.hiddenTest!.passed).length;
  out.push(`Hidden c1-debug-13 passes: native ${nativePasses}, loadout ${loadoutPasses}; ${hidden.length} paired repeats; missing tests ${hidden.length - validHidden.length}.`);
  const complete = !duplicateRows && !unexpectedRows && !duplicateVerdicts && !unexpectedVerdicts && commonManifest && !metricMismatch
    && pairs.length === planned.length && judged.length === planned.length && validHidden.length === 2
    && pairs.every((p) => p.native.librarySize === 250 && p.native.requestedModel === 'gpt-6-luna' && p.loadout.requestedModel === 'gpt-6-luna');
  out.push(`Primary quality screen: ${complete ? losses - wins <= 2 && loadoutPasses >= nativePasses ? 'passes' : 'fails' : 'not shown (incomplete or secondary study)'}. Fixed rule: native wins minus loadout wins <= 2 of 20, and loadout hidden passes >= native. This is a screening rule, not proof of non-inferiority; repeated prompts are not independent population samples.`);
  const sensitivityPairs = pairs.filter((p) => p.native.prompt !== 'c1-debug-13');
  const sensitivityJudged = judged.filter((v) => v.prompt !== 'c1-debug-13');
  out.push(`Sensitivity excluding c1-debug-13: paired effective-input ${pairedSummary(sensitivityPairs.map((p) => p.delta))}; ${sensitivityJudged.length ? `loadout wins ${sensitivityJudged.filter((v) => v.winner === 'loadout').length}, native wins (loadout loses) ${sensitivityJudged.filter((v) => v.winner === 'native').length}, ties ${sensitivityJudged.filter((v) => v.winner === 'tie').length}, splits ${sensitivityJudged.filter((v) => v.winner === 'split').length}` : 'quality not shown (unjudged)'}. The fixture was previously selected using Jev and judge results; the primary screen is unchanged.`);
  out.push("Blindness limitation: a skill's own template can still reveal the arm despite redaction. The judge sees saved files and final responses, not independent quality evidence.");
  out.push('', '## Cold starts and provenance', '');
  for (const r of rows.filter((r) => r.warmup)) out.push(`- ${r.id}: uncached ${num(r.totals.uncached)}, write ${num(r.totals.cacheWrite)}, cached ${num(r.totals.cacheRead)}, output ${num(r.totals.output)}; ${r.invalid ?? 'valid'}.`);
  for (const manifest of new Set(rows.map((r) => JSON.stringify({ librarySize: r.librarySize, corpusHash: r.corpusHash, manifestHash: r.manifestHash })))) out.push(`- ${manifest}`);
  for (const arm of ['native', 'loadout']) {
    const runs = rows.filter((r) => r.arm === arm);
    out.push(`- ${arm}: codexRetries ${runs.length && runs.every((r) => r.codexRetries !== undefined) ? runs.reduce((n, r) => n + r.codexRetries!, 0) : 'not shown'} (including warm-up).`);
  }
  for (const r of rows.filter((r) => r.invalid || r.coldCacheRisk || r.timedOut || r.unreconciled.length)) out.push(`- ${r.id}: ${[r.invalid, r.coldCacheRisk && 'coldCacheRisk', r.timedOut && 'timed out', ...r.unreconciled].filter(Boolean).join('; ')}`);
  out.push('', 'Not shown: general quality retention, actual subscription cost, per-request Codex usage, other hosts/models, whole-library quality, and Jev dollars (record separately). Ten prompts and an assumed cached price do not establish population savings.', '');
  return out.join('\n');
}
