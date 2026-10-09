/**
 * Tune the selection policy on stored Jev answers (no API calls), then report.
 *
 * Grid-searches `decide()` policies on the dev split, picks the best policy
 * for each budget of skills shown, and reports those policies on the test
 * split next to the other arms (and the v1 router, if its run is given).
 *
 *   npx tsx bench/tune.ts <results dir> [--v1 <old results dir>]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { decide, type FitMeasure, type Policy } from '../src/route.js';
import type { Capability } from '../src/types.js';
import { readJsonl, splitOf, wilson, type Row } from './lib.js';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { v1: { type: 'string' } } });
const dir = positionals[0];
if (!dir) throw new Error('usage: tune.ts <results dir> [--v1 <dir>]');

const rows = readJsonl<Row>(join(dir, 'rows.jsonl'));
const loadout = rows.filter((r) => r.arm === 'loadout' && r.raw);
const sizes = [...new Set(rows.map((r) => r.size))].sort((a, b) => a - b);

const keyCache = new Map<string, Capability>();
const capability = (name: string): Capability => {
  let c = keyCache.get(name);
  if (!c) keyCache.set(name, (c = { id: `skill:${name}`, kind: 'skill', name, description: '', source: '' }));
  return c;
};

interface Metrics {
  n: number;
  recall: number;
  top1: number;
  selected: number;
  /** Gold is loaded or offered as "also relevant" (what the agent can reach). */
  available: number;
  /** Skills loaded plus offered. */
  shown: number;
  nNone: number;
  /** No-skill tasks where something was still selected. */
  needless: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function evaluate(subset: Row[], policy: Policy): Metrics {
  const gold: { hit: boolean; top1: boolean; n: number; avail: boolean; shown: number }[] = [];
  const none: number[] = [];
  for (const r of subset) {
    const raw = r.raw!;
    const keys = new Map(raw.shortlist.map((k) => [k, capability(k)]));
    const d = decide(raw, keys, policy);
    const names = d.selected.map((s) => s.capability.name);
    const all = [...names, ...d.suggested.map((s) => s.capability.name)];
    if (r.gold.length)
      gold.push({ hit: r.gold.every((g) => names.includes(g)), top1: r.gold.includes(names[0] ?? ''), n: names.length, avail: r.gold.every((g) => all.includes(g)), shown: all.length });
    else none.push(names.length);
  }
  return {
    n: gold.length,
    recall: mean(gold.map((g) => (g.hit ? 1 : 0))),
    top1: mean(gold.map((g) => (g.top1 ? 1 : 0))),
    selected: mean(gold.map((g) => g.n)),
    available: mean(gold.map((g) => (g.avail ? 1 : 0))),
    shown: mean(gold.map((g) => g.shown)),
    nNone: none.length,
    needless: mean(none.map((n) => (n > 0 ? 1 : 0))),
  };
}

function* grid(): Generator<Policy> {
  for (const fitBy of ['helps', 'expected', 'exact'] as FitMeasure[])
    for (const fit of [0.5, 0.6, 0.7, 0.8, 0.9, 0.95])
      for (const minShare of [0, 0.01, 0.03, 0.05, 0.1, 0.2])
        for (const need of [0, 0.4, 0.45, 0.5, 0.55, 0.6])
          for (const maxSkills of [1, 2, 3, 5, 8]) yield { fitBy, fit, minShare, need, maxSkills, maxMcp: 2, show: 0.7, maxShown: 4 };
}

const dev = loadout.filter((r) => r.split === 'dev');
const test = loadout.filter((r) => r.split === 'test');
const results = [...grid()].map((policy) => ({ policy, dev: evaluate(dev, policy) }));

/** Best dev recall within a budget of skills shown per gold task, with needless loads capped. */
const BUDGETS = [1, 2, 3, 5];
const MAX_NEEDLESS = 0.1;
const chosen = BUDGETS.flatMap((budget) => {
  // NaN needless (no no-skill tasks in the rows yet) does not disqualify a policy.
  const ok = results.filter((r) => r.dev.selected <= budget && !(r.dev.needless > MAX_NEEDLESS));
  ok.sort((a, b) => b.dev.recall - a.dev.recall || a.dev.needless - b.dev.needless || b.dev.top1 - a.dev.top1 || a.dev.selected - b.dev.selected);
  return ok[0] ? [{ budget, ...ok[0] }] : [];
});
if (!chosen.length) throw new Error(`no policy keeps needless loads ≤ ${MAX_NEEDLESS} on dev`);
const pick = chosen.find((c) => c.budget === 3) ?? chosen.at(-1)!;

const pct = (x: number) => (Number.isNaN(x) ? '—' : `${(x * 100).toFixed(0)}%`);
const describePolicy = (p: Policy) =>
  `${p.fitBy} ≥ ${p.fit}${p.minShare ? `, share ≥ ${p.minShare}` : ''}${p.need ? `, need ≥ ${p.need}` : ''}, max ${p.maxSkills}`;

const lines: string[] = [
  '# Routing benchmark v2 — two-stage Jev',
  '',
  `Rows: \`${dir.split('/').slice(-2).join('/')}\`. Dev split: ${new Set(dev.map((r) => r.task)).size} tasks; test split: ${new Set(test.map((r) => r.task)).size} tasks. ` +
    `Policies tuned on dev (${results.length.toLocaleString('en')} candidates, needless loads ≤ ${MAX_NEEDLESS * 100}%), reported on test.`,
  '',
  '## Tuned policies (dev → test, all sizes pooled)',
  '',
  '| budget | policy | dev recall | test recall (loaded) | test top-1 | test loaded | test available (loaded + also relevant) | test loaded + offered | test needless loads |',
  '|---:|---|---:|---:|---:|---:|---:|---:|---:|',
];
for (const c of chosen) {
  const t = evaluate(test, c.policy);
  lines.push(
    `| ≤ ${c.budget} | ${describePolicy(c.policy)} | ${pct(c.dev.recall)} | **${pct(t.recall)}** | ${pct(t.top1)} | ${t.selected.toFixed(1)} | ${pct(t.available)} | ${t.shown.toFixed(1)} | ${pct(t.needless)} |`,
  );
}

{
  const t = evaluate(test, pick.policy);
  const gold = test.filter((r) => r.gold.length).length;
  const none = test.filter((r) => !r.gold.length).length;
  lines.push(
    '',
    `95% intervals (test, pooled; rows repeat tasks across sizes, so these are optimistic): recall ${wilson(Math.round(t.recall * gold), gold)}, needless loads ${wilson(Math.round(t.needless * none), none)} (${Math.round(t.needless * none)}/${none} rows).`,
  );
}

// Per-size comparison on test, against every other arm.
lines.push('', `## Test split by library size (loadout at budget ≤ ${pick.budget}: ${describePolicy(pick.policy)})`, '');
lines.push('| arm | library | recall | top-1 | skills shown | needless loads | router $/task | router ms |', '|---|---:|---:|---:|---:|---:|---:|---:|');
const other = (arm: string, size: number) => rows.filter((r) => r.arm === arm && r.size === size && r.split === 'test');
for (const size of sizes) {
  for (const arm of ['popular', 'bm25', 'hybrid']) {
    const rs = other(arm, size);
    if (!rs.length) continue;
    const g = rs.filter((r) => r.gold.length);
    lines.push(`| ${arm} | ${size.toLocaleString('en')} | ${pct(mean(g.map((r) => (r.hit ? 1 : 0))))} | ${pct(mean(g.map((r) => (r.top1 ? 1 : 0))))} | ${mean(g.map((r) => r.selected)).toFixed(1)} | 100% | — | ${Math.round(mean(rs.map((r) => r.routerMs)))} |`);
  }
  if (values.v1) {
    const v1 = readJsonl<Row>(join(values.v1, 'rows.jsonl')).filter((r) => r.arm === 'jev' && r.size === size && splitOf(r.task) === 'test') as (Row & { goldP?: number; ps?: number[] })[];
    if (v1.length) {
      const g = v1.filter((r) => r.gold.length);
      const sel = (r: (typeof v1)[number]) => Math.min(12, (r.ps ?? []).filter((p) => p >= 0.8).length);
      const none = v1.filter((r) => !r.gold.length);
      lines.push(
        `| jev v1 (yes/no per skill, ≥ 0.8) | ${size.toLocaleString('en')} | ${pct(mean(g.map((r) => ((r.goldP ?? 0) >= 0.8 && (r.goldRank ?? 99) <= 12 ? 1 : 0))))} | ${pct(mean(g.map((r) => ((r.goldP ?? 0) >= 0.8 && r.goldRank === 1 ? 1 : 0))))} | ${mean(g.map(sel)).toFixed(1)} | ${pct(mean(none.map((r) => (sel(r) > 0 ? 1 : 0))))} | ${mean(v1.map((r) => r.routerCostUsd)).toFixed(5)} | ${Math.round(mean(v1.map((r) => r.routerMs)))} |`,
      );
    }
  }
  const rs = test.filter((r) => r.size === size);
  const m = evaluate(rs, pick.policy);
  lines.push(
    `| **loadout v2** (available: ${pct(m.available)}, ${m.shown.toFixed(1)} shown) | ${size.toLocaleString('en')} | **${pct(m.recall)}** | ${pct(m.top1)} | ${m.selected.toFixed(1)} | ${pct(m.needless)} | ${mean(rs.map((r) => r.routerCostUsd)).toFixed(5)} | ${Math.round(mean(rs.map((r) => r.routerMs)))} |`,
  );
}

// The need gate trades recall for quiet on no-skill tasks; show the whole curve (test, pooled).
lines.push('', `## Need-gate trade-off (test, pooled; otherwise the budget ≤ ${pick.budget} policy)`, '', '| need ≥ | recall (loaded) | available | needless loads |', '|---:|---:|---:|---:|');
for (const need of [0, 0.4, 0.45, 0.5, 0.55, 0.6]) {
  const m = evaluate(test, { ...pick.policy, need });
  lines.push(`| ${need} | ${pct(m.recall)} | ${pct(m.available)} | ${pct(m.needless)} |`);
}

// Ceiling: how often the gold skill reached each stage (test, by size).
lines.push('', '## Where misses happen (test)', '', '| library | gold among candidates | gold in close shortlist | gold selected |', '|---:|---:|---:|---:|');
for (const size of sizes) {
  const g = test.filter((r) => r.size === size && r.gold.length);
  const inCand = mean(g.map((r) => (r.raw!.goldCandidateRank ? 1 : 0)));
  const inShort = mean(g.map((r) => (r.gold.some((x) => r.raw!.shortlist.includes(x)) ? 1 : 0)));
  lines.push(`| ${size.toLocaleString('en')} | ${pct(inCand)} | ${pct(inShort)} | ${pct(evaluate(g, pick.policy).recall)} |`);
}

// Is the fit number meaningful? Share of shortlisted candidates that are gold, by fit bin (dev, expected/3).
lines.push('', '## What the fit number means (dev, all shortlisted candidates)', '', '| fit (expected level / 3) | candidates | gold share | top-ranked in close choice |', '|---|---:|---:|---:|');
const bins = [0, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0001];
for (let i = 0; i < bins.length - 1; i++) {
  let n = 0;
  let goldN = 0;
  let topN = 0;
  for (const r of dev) {
    const raw = r.raw!;
    const ordered = [...raw.shortlist].sort((a, b) => (raw.close.pick[b] ?? 0) - (raw.close.pick[a] ?? 0));
    for (const k of raw.shortlist) {
      const d = raw.close.fit[k] ?? {};
      const f = ((d['1'] ?? 0) + 2 * (d['2'] ?? 0) + 3 * (d['3'] ?? 0)) / 3;
      if (f < bins[i]! || f >= bins[i + 1]!) continue;
      n++;
      if (r.gold.includes(k)) goldN++;
      if (ordered[0] === k) topN++;
    }
  }
  lines.push(`| ${bins[i]}–${Math.min(1, bins[i + 1]!)} | ${n} | ${pct(goldN / n)} | ${pct(topN / n)} |`);
}
lines.push('', 'Gold share is a lower bound on precision: in a 20,000-skill library, many non-gold candidates are near-duplicates that would serve the task equally well.');

const md = lines.join('\n') + '\n';
writeFileSync(join(dir, 'summary.md'), md);
writeFileSync(join(dir, 'tuned.json'), JSON.stringify(chosen.map((c) => ({ budget: c.budget, policy: c.policy, dev: c.dev })), null, 2));
console.log(md);
