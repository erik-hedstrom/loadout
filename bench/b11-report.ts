/** Offline: npx tsx bench/b11-report.ts <rows.jsonl> ... > report.md */
import { readFileSync } from 'node:fs';
import { isEntry, wilson } from './lib.js';
import { parseRow } from './b11-types.js';
import type { B11Row } from './b11-types.js';

type Tokens = B11Row['totals'];
interface PriceSheet {
  id: string;
  name: string;
  source: string;
  retrieved: string;
  /** USD per million tokens; write is a disjoint prompt bucket, including its processing. */
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

// Snapshots, never fetched by the report. Repricing uses measured tokens, not another model's tokenizer.
export const PRICE_SHEETS: readonly PriceSheet[] = [
  { id: 'deepseek-flash-off-peak', name: 'DeepSeek V4.1 Flash, off-peak', source: 'https://api-docs.deepseek.com/quick_start/pricing/', retrieved: '2026-10-22', input: 0.15, cacheRead: 0.003, cacheWrite: 0.15, output: 0.6 },
  { id: 'deepseek-flash-peak', name: 'DeepSeek V4.1 Flash, peak', source: 'https://api-docs.deepseek.com/quick_start/pricing/', retrieved: '2026-10-22', input: 0.3, cacheRead: 0.006, cacheWrite: 0.3, output: 1.2 },
  { id: 'glm-5.3-flash', name: 'Z.ai GLM-5.3-Flash, free cache storage', source: 'https://docs.z.ai/guides/overview/pricing', retrieved: '2026-10-22', input: 0.15, cacheRead: 0.03, cacheWrite: 0.15, output: 0.5 },
  { id: 'claude-sonnet-5.5-5m', name: 'Anthropic Sonnet 5.5, 5-minute cache', source: 'https://platform.claude.com/docs/en/about-claude/pricing', retrieved: '2026-10-22', input: 2, cacheRead: 0.1, cacheWrite: 2.5, output: 10 },
  { id: 'gpt-6.1-sol-30m', name: 'OpenAI GPT-6.1 Sol, standard short context, 30-minute cache', source: 'https://developers.openai.com/api/docs/pricing', retrieved: '2026-10-22', input: 2, cacheRead: 0.1, cacheWrite: 2.5, output: 10 },
];

export function pricedUsage(tokens: Tokens, sheet: PriceSheet) {
  const weightedInput = tokens.input + tokens.cacheRead * sheet.cacheRead / sheet.input + tokens.cacheWrite * sheet.cacheWrite / sheet.input;
  const inputUsd = weightedInput * sheet.input / 1e6;
  const outputUsd = (tokens.output + tokens.reasoning) * sheet.output / 1e6;
  return { weightedInput, inputUsd, outputUsd, totalUsd: inputUsd + outputUsd };
}

const zero = (): Tokens => ({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 });
function add(sum: Tokens, tokens: Tokens): void {
  for (const key of Object.keys(sum) as (keyof Tokens)[]) sum[key] += tokens[key];
}
const sessionKey = (row: B11Row) => JSON.stringify([row.taskId, row.rep]);

export function summarizeRows(rows: readonly B11Row[]) {
  const groups = new Map<string, B11Row[]>();
  const completed = new Set<string>();
  for (const row of rows) {
    const key = JSON.stringify([row.split, row.model, row.arm]);
    if (row.result !== 'invalid') {
      const identity = JSON.stringify([row.model, row.arm, row.taskId, row.rep]);
      if (completed.has(identity)) throw new Error('duplicate valid session in B11 rows');
      completed.add(identity);
    }
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((attempts) => {
    const first = attempts[0]!;
    const valid = attempts.filter((row) => row.result !== 'invalid');
    const pass = valid.filter((row) => row.result === 'pass').length;
    const totals = zero(), invalidTotals = zero();
    const steps: Tokens[] = [], counts: number[] = [];
    for (const row of attempts) {
      add(row.result === 'invalid' ? invalidTotals : totals, row.totals);
      if (row.result === 'invalid') continue;
      row.steps.forEach((step, index) => {
        steps[index] ??= zero();
        counts[index] = (counts[index] ?? 0) + 1;
        add(steps[index]!, step);
      });
    }
    return {
      split: first.split, model: first.model, arm: first.arm, pass, fail: valid.length - pass,
      invalid: attempts.length - valid.length, valid: valid.length,
      successInterval: valid.length ? wilson(pass, valid.length) : 'not shown', totals, invalidTotals,
      steps: valid.reduce((sum, row) => sum + row.steps.length, 0),
      invalidSteps: attempts.filter((row) => row.result === 'invalid').reduce((sum, row) => sum + row.steps.length, 0),
      jev: { calls: attempts.reduce((sum, row) => sum + row.jev.calls, 0), costUsd: attempts.reduce((sum, row) => sum + row.jev.costUsd, 0) },
      validJevUsd: valid.reduce((sum, row) => sum + row.jev.costUsd, 0),
      cache: steps.map((tokens, index) => {
        const prompt = tokens.input + tokens.cacheRead + tokens.cacheWrite;
        return { step: index + 1, requests: counts[index]!, input: tokens.input, cacheRead: tokens.cacheRead, cacheWrite: tokens.cacheWrite, hitRatio: prompt ? tokens.cacheRead / prompt : null };
      }),
    };
  }).sort((a, b) => a.split.localeCompare(b.split) || a.model.localeCompare(b.model) || a.arm.localeCompare(b.arm));
}

export function sizeSweep(rows: readonly B11Row[], sheet: PriceSheet) {
  const results: {
    split: B11Row['split']; model: string; family: 'skills' | 'mcp'; pairs: number;
    gateway: { mean: number; low: number; high: number };
    points: { arm: string; size: number; mean: number }[]; breakEvenSize: number | null;
  }[] = [];
  for (const split of ['test', 'dev'] as const) {
    for (const model of [...new Set(rows.filter((r) => r.split === split).map((r) => r.model))].sort()) {
      const valid = rows.filter((r) => r.split === split && r.model === model && r.result !== 'invalid');
      const gatewayRows = valid.filter((r) => r.arm === 'gateway');
      for (const family of ['skills', 'mcp'] as const) {
        const native = valid.filter((r) => new RegExp(`^${family}-(?:\\d+|all)$`).test(r.arm));
        const listingSize = (r: B11Row) => r.listing[family === 'skills' ? 'skills' : 'tools'];
        const configurations = [...new Map(native.map((r) => [JSON.stringify([r.arm, listingSize(r)]), { arm: r.arm, size: listingSize(r) }])).values()];
        if (new Set(configurations.map(c => c.size)).size < 2) continue;
        // A common panel prevents a different task mix from appearing to be a listing-size effect.
        const shared = new Set(gatewayRows.map(sessionKey).filter((key) => configurations.every((c) => native.some((r) => r.arm === c.arm && listingSize(r) === c.size && sessionKey(r) === key))));
        if (!shared.size) continue;
        const cost = (r: B11Row) => pricedUsage(r.totals, sheet).totalUsd + r.jev.costUsd;
        const gatewayCosts = gatewayRows.filter((r) => shared.has(sessionKey(r))).map(cost);
        const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
        const gateway = { mean: mean(gatewayCosts), low: Math.min(...gatewayCosts), high: Math.max(...gatewayCosts) };
        const points = configurations.map(({ arm, size }) => ({ arm, size, mean: mean(native.filter((r) => r.arm === arm && listingSize(r) === size && shared.has(sessionKey(r))).map(cost)) }))
          .sort((a, b) => a.size - b.size || a.arm.localeCompare(b.arm));
        results.push({ split, model, family, pairs: shared.size, gateway, points, breakEvenSize: points.find((p) => p.mean >= gateway.mean)?.size ?? null });
      }
    }
  }
  return results;
}

const cell = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '&#124;').replaceAll('`', '&#96;').replace(/[\r\n]/g, ' ');
const usd = (value: number) => `$${value.toFixed(6)}`;
const ratio = (value: number | null) => value === null ? 'not shown' : `${(100 * value).toFixed(2)}%`;

export function renderReport(rows: readonly B11Row[]): string {
  if (!rows.length) throw new Error('no rows in B11 input');
  const groups = summarizeRows(rows);
  const lines = [
    '# B11 cache-aware session report', '',
    'Test rows are the evaluation result. Dev rows appear separately and are the only rows eligible for tuning. Invalid attempts are counted separately, never as quality failures. Wilson 95% intervals describe observed valid sessions; repeated tasks are not independent evidence of population-wide quality.', '',
    'Token columns sum valid sessions. Input, cache read and cache write are disjoint prompt buckets ([OpenCode 1.19.3 usage normalization](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/opencode/src/session/session.ts#L321-L383)). Output excludes the separately recorded reasoning counter. First requests can already hit a cross-session cache; they are not assumed cold. Cache ratios pool tokens within each request position; later positions include only sessions that reached them.', '',
    'Hypothetical paid costs reprice these measured tokens under each named sheet; tokenizers and cache policies differ across providers, so this does not predict their quality or actual billed usage. Weighted input = input + read × read/input price + write × write/input price. Session cost adds output and reasoning at the output rate, plus recorded Jev cost. Free model spend is $0; Jev spend includes invalid attempts in the attempts table.', '',
    '## Price snapshots', '',
    'USD per million tokens. GLM and DeepSeek have no extra storage/write charge; newly written prompt tokens retain their ordinary input processing cost. Anthropic uses 5-minute writes and OpenAI uses 30-minute writes. No batch, geography, long-context, or promotional adjustment is inferred.', '',
    '| Sheet | Input | Cache read | Cache write | Output | Read/input | Retrieved | Source |',
    '|---|---:|---:|---:|---:|---:|---|---|',
    ...PRICE_SHEETS.map((p) => `| ${p.name} | ${p.input} | ${p.cacheRead} | ${p.cacheWrite} | ${p.output} | ${(p.cacheRead / p.input).toFixed(3)} | ${p.retrieved} | [Official pricing](${p.source}) |`),
  ];
  for (const split of ['test', 'dev'] as const) {
    const selected = groups.filter((g) => g.split === split);
    lines.push('', `## ${split === 'test' ? 'Test' : 'Dev'} split`, '');
    if (!selected.length) { lines.push('not shown: no rows.'); continue; }
    lines.push('| Model | Arm | Pass | Fail | Invalid attempts | Success (Wilson 95%) | Steps | Uncached input | Cache read | Cache write | Output | Reasoning |', '|---|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|');
    for (const g of selected) {
      lines.push(`| ${cell(g.model)} | ${cell(g.arm)} | ${g.pass} | ${g.fail} | ${g.invalid} | ${g.valid ? `${ratio(g.pass / g.valid)} (${g.successInterval})` : 'not shown'} | ${g.steps} | ${g.totals.input} | ${g.totals.cacheRead} | ${g.totals.cacheWrite} | ${g.totals.output} | ${g.totals.reasoning} |`);
    }
    lines.push('', '### Invalid usage and all-attempt Jev spend', '', '| Model | Arm | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const g of selected) lines.push(`| ${cell(g.model)} | ${cell(g.arm)} | ${g.invalidSteps} | ${g.invalidTotals.input} | ${g.invalidTotals.cacheRead} | ${g.invalidTotals.cacheWrite} | ${g.invalidTotals.output} | ${g.invalidTotals.reasoning} | ${g.jev.calls} | ${usd(g.jev.costUsd)} |`);
    lines.push('', '### Cache by request position', '', '| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |', '|---|---|---|---:|---:|---:|---:|---:|');
    for (const g of selected) {
      for (const c of g.cache) lines.push(`| ${cell(g.model)} | ${cell(g.arm)} | ${c.step === 1 ? '1 (first / cross-session)' : `${c.step} (later)`} | ${c.requests} | ${c.input} | ${c.cacheRead} | ${c.cacheWrite} | ${ratio(c.hitRatio)} |`);
    }
    lines.push('', '### Hypothetical paid cost per valid session', '', '| Model | Arm | Sheet | Mean steps | Mean weighted input | Mean input USD | Mean output/reasoning USD | Mean Jev USD | Mean total USD |', '|---|---|---|---:|---:|---:|---:|---:|---:|');
    for (const g of selected) {
      for (const p of PRICE_SHEETS) {
        const cost = pricedUsage(g.totals, p);
        const values = g.valid ? [(g.steps / g.valid).toFixed(2), (cost.weightedInput / g.valid).toFixed(2), usd(cost.inputUsd / g.valid), usd(cost.outputUsd / g.valid), usd(g.validJevUsd / g.valid), usd((cost.totalUsd + g.validJevUsd) / g.valid)] : Array<string>(6).fill('not shown');
        lines.push(`| ${cell(g.model)} | ${cell(g.arm)} | ${p.id} | ${values.join(' | ')} |`);
      }
    }
    lines.push('', '### Size sweep and observed break-even', '',
      'Comparisons use the common valid task/repetition panel across gateway and every observed size in a family. Sizes are recorded skill counts or tool counts (MCP), including planted items. The gateway horizontal band is the observed session-cost min/max, not a confidence interval. Break-even is the first measured native size at or above the gateway mean; no interpolation or extrapolation. Cost includes Jev. Chart x labels are categorical measured sizes.', '');
    let shown = false;
    for (const p of PRICE_SHEETS) {
      for (const sweep of sizeSweep(rows, p).filter((s) => s.split === split)) {
        shown = true;
        lines.push(`**${cell(sweep.model)} / ${sweep.family} / ${p.id}**: ${sweep.pairs} matched sessions; gateway ${usd(sweep.gateway.mean)} [${usd(sweep.gateway.low)}, ${usd(sweep.gateway.high)}]. First measured size at/above gateway: ${sweep.breakEvenSize ?? 'not shown'}.`, '', '| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |', '|---|---:|---:|---:|---|');
        for (const point of sweep.points) lines.push(`| ${cell(point.arm)} | ${point.size} | ${usd(point.mean)} | ${usd(sweep.gateway.mean)} | ${usd(sweep.gateway.low)}–${usd(sweep.gateway.high)} |`);
        lines.push('', 'Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.', '', '```mermaid', 'xychart-beta', `  x-axis "${sweep.family === 'skills' ? 'Skills' : 'MCP tools'}" [${sweep.points.map((point) => point.size).join(', ')}]`, '  y-axis "USD/session"', `  line [${sweep.points.map((point) => point.mean.toFixed(9)).join(', ')}]`);
        for (const level of [sweep.gateway.mean, sweep.gateway.low, sweep.gateway.high]) lines.push(`  line [${sweep.points.map(() => level.toFixed(9)).join(', ')}]`);
        lines.push('```', '');
      }
    }
    if (!shown) lines.push('not shown: no common valid gateway/size-sweep panel.');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function reportFiles(paths: readonly string[]): string {
  if (!paths.length) throw new Error('usage: b11-report.ts <rows.jsonl> ...');
  const rows = paths.flatMap((path) => readFileSync(path, 'utf8').split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try { return [parseRow(JSON.parse(line))]; }
    catch { throw new Error(`invalid B11 row in input ${paths.indexOf(path) + 1}, line ${index + 1}`); }
  }));
  return renderReport(rows);
}

if (isEntry(import.meta.url)) {
  try { process.stdout.write(reportFiles(process.argv.slice(2))); }
  catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
