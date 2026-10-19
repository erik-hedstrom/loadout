/**
 * Audit the need gate offline (backlog C12): replay `decide()` on the Jev answers stored in
 * saved sweeps and compare the gate with the judge's blind labels. No model calls.
 *
 *   npx tsx bench/need-audit.ts --labels <judge-blind.jsonl> [--split dev|test] [--out report.md] <sweep dir> ...
 *
 * The split defaults to dev: tune on dev, report on test once (AGENTS.md).
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DEFAULT_CONFIG } from '../src/config.js';
import { capabilityKey } from '../src/library.js';
import { decide, needScore, policyFrom } from '../src/route.js';
import type { Capability } from '../src/types.js';
import { auc, exactSignTest, readJsonl, splitOf, wilson } from './lib.js';
import type { SweepRow } from './sweep.js';

interface Label { id: string; need: 'none' | 'helpful' | 'essential'; useful: string[] }

const THRESHOLDS = [0, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6];

const pct = (k: number, n: number) => (n ? `${((100 * k) / n).toFixed(0)}% (${k}/${n}, ${wilson(k, n)})` : '—');
/** `decide()` only reads the kind and the key, so a stored source id is enough to rebuild a candidate. */
const candidate = (id: string | undefined): Capability => {
  if (!id?.startsWith('skill:')) throw new Error(`cannot replay ${id}: only skills appear in the C1 sweeps`);
  return { id, kind: 'skill', name: id.slice('skill:'.length), description: '', source: id.slice('skill:'.length) };
};

const median = (sorted: number[]) => (sorted[Math.floor((sorted.length - 1) / 2)]! + sorted[Math.ceil((sorted.length - 1) / 2)]!) / 2;

export function needAudit(labelsFile: string, dirs: string[], split: 'dev' | 'test' = 'dev'): string {
  const policy = policyFrom(DEFAULT_CONFIG);
  const labels = new Map(readJsonl<Label>(labelsFile).map((l) => [l.id, l]));
  const runs = dirs.map((dir) => new Map(readJsonl<SweepRow>(join(dir, 'decisions.jsonl')).map((r) => [r.id, r])));
  const ids = [...runs[0]!.keys()].filter((id) => splitOf(id) === split);
  for (const id of ids) {
    if (!labels.has(id)) throw new Error(`no judge label for ${id}`);
    runs.forEach((run, i) => {
      if (!run.has(id)) throw new Error(`${dirs[i]} lacks ${id}`);
      if (run.get(id)!.request !== runs[0]!.get(id)!.request) throw new Error(`requests differ for ${id} in ${dirs[i]}`);
    });
  }

  interface Obs { id: string; label: Label; need: number; replay: (need: number) => { quiet: boolean; loaded: string[] }; matches: boolean }
  const observe = (run: Map<string, SweepRow>): Obs[] =>
    ids.flatMap((id) => {
      const row = run.get(id)!;
      const raw = row.raw;
      if (!raw) return []; // keyword fallback: no Jev answers to replay
      const keys = new Map(raw.shortlist.map((k) => [k, candidate(raw.sources?.[k])]));
      const replay = (need: number) => {
        const d = decide(raw, keys, { ...policy, need });
        return { quiet: d.quiet, loaded: d.selected.map((s) => capabilityKey(s.capability)) };
      };
      const stored = row.loaded.map((p) => p.key).sort().join('\n');
      return [{ id, label: labels.get(id)!, need: needScore(raw), replay, matches: replay(policy.need).loaded.slice().sort().join('\n') === stored }];
    });
  const perRun = runs.map(observe);
  const flat = perRun.flat();

  const needed = (o: Obs) => o.label.need !== 'none';
  const lines = [
    `# Need gate audit (${split} split)`, '',
    `Gate: need < ${policy.need} selects nothing (\`decide()\` replayed on stored answers). Judge labels: ${labelsFile} (${labels.size} blind labels); ${ids.length} ${split} requests, ${dirs.length} runs: ${dirs.join(', ')}. ` +
      `Intervals are 95% Wilson; pooled rows repeat requests, so pooled intervals are optimistic.`, '',
    `Rows without Jev answers (keyword fallback, not replayable): ${perRun.map((obs) => ids.length - obs.length).join(' / ')}. ` +
      `Replay reproduces the stored loaded set in ${flat.filter((o) => o.matches).length} of ${flat.length} rows.`, '',
  ];

  const gate = (obs: Obs[], t: number) => {
    const need = obs.filter(needed), essential = obs.filter((o) => o.label.need === 'essential'), none = obs.filter((o) => !needed(o));
    const quiet = (o: Obs) => o.replay(t).quiet;
    return {
      falseQuiet: pct(need.filter(quiet).length, need.length),
      falseQuietEssential: pct(essential.filter(quiet).length, essential.length),
      falseSkill: pct(none.filter((o) => !quiet(o)).length, none.length),
    };
  };
  lines.push(
    '## Gate verdict against the judge, at the current threshold', '',
    '| Run | Rows | False "no skill" (judge: helpful or essential) | False "no skill" (essential only) | False "skill" (judge: none) |', '|---|---:|---|---|---|',
  );
  [...perRun.map((obs, i) => [`run ${i + 1}`, obs] as const), ['pooled', flat] as const].forEach(([name, obs]) => {
    const g = gate(obs, policy.need);
    lines.push(`| ${name} | ${obs.length} | ${g.falseQuiet} | ${g.falseQuietEssential} | ${g.falseSkill} |`);
  });

  const labelCounts = Object.fromEntries(['essential', 'helpful', 'none'].map((n) => [n, ids.filter((id) => labels.get(id)!.need === n).length]));
  lines.push('', `Judge labels on these requests: ${labelCounts.essential} essential, ${labelCounts.helpful} helpful, ${labelCounts.none} none.`);

  // How much `need` moves when the same request is routed again.
  const byId = ids.flatMap((id) => {
    const xs = perRun.map((obs) => obs.find((o) => o.id === id)).filter((o): o is Obs => o !== undefined);
    return xs.length === runs.length ? [xs] : [];
  });
  const spread = byId.map((xs) => Math.max(...xs.map((o) => o.need)) - Math.min(...xs.map((o) => o.need)));
  const verdictFlips = byId.filter((xs) => new Set(xs.map((o) => o.replay(policy.need).quiet)).size > 1).length;
  const near = byId.filter((xs) => xs.some((o) => Math.abs(o.need - policy.need) <= 0.05)).length;
  const sorted = [...spread].sort((a, b) => a - b);
  lines.push(
    '', '## Stability of `need` across runs', '',
    `- Requests with an answer in every run: ${byId.length}.`,
    `- Range of \`need\` per request (max minus min): median ${sorted[Math.floor(sorted.length / 2)]?.toFixed(3) ?? '—'}, 90th percentile ${sorted[Math.ceil(sorted.length * 0.9) - 1]?.toFixed(3) ?? '—'}, max ${sorted.at(-1)?.toFixed(3) ?? '—'}.`,
    `- Gate verdict differs between runs: ${pct(verdictFlips, byId.length)}.`,
    `- Within 0.05 of the threshold in some run: ${pct(near, byId.length)}.`,
  );

  const mean = (xs: Obs[]) => xs.reduce((sum, o) => sum + o.need, 0) / xs.length;
  const labelled = (n: Label['need']) => byId.filter((xs) => xs[0]!.label.need === n);
  const quietEveryRun = byId.filter((xs) => needed(xs[0]!) && xs.every((o) => o.need < policy.need));
  lines.push(
    '', '## `need` by judge label (mean over runs, per request)', '',
    ...(['essential', 'helpful', 'none'] as const).map((n) => {
      const means = labelled(n).map(mean).sort((a, b) => a - b);
      return `- ${n}: median ${means.length ? median(means).toFixed(2) : '—'}, range ${means.length ? `${means[0]!.toFixed(2)}–${means.at(-1)!.toFixed(2)}` : '—'} (n=${means.length}).`;
    }),
    `- Mean \`need\` at or above ${policy.need}, judge none: ${pct(labelled('none').filter((xs) => mean(xs) >= policy.need).length, labelled('none').length)}.`,
    `- Needed requests below ${policy.need} in every run: ${quietEveryRun.length} of ${byId.filter((xs) => needed(xs[0]!)).length} (${quietEveryRun.map((xs) => `${xs[0]!.id} ${xs[0]!.label.need}`).join(', ') || 'none'}).`,
  );

  lines.push(
    '', '## Threshold sweep (pooled over runs)', '',
    `Same policy otherwise. Useful load: a loaded skill is in the judge's \`useful\` list. AUC of \`need\` for "judge says a skill helps": ${auc(flat.filter(needed).map((o) => o.need), flat.filter((o) => !needed(o)).map((o) => o.need)).toFixed(3)}.`, '',
    '| need ≥ | False "no skill" | Needed requests with a useful load | Loaded skills that are useful | False "skill" | Nothing loaded when none needed |', '|---:|---|---|---|---|---|',
  );
  for (const t of [...new Set([...THRESHOLDS, policy.need])].sort((a, b) => a - b)) {
    const need = flat.filter(needed), none = flat.filter((o) => !needed(o));
    const loads = flat.flatMap((o) => o.replay(t).loaded.map((k) => o.label.useful.includes(k)));
    lines.push(
      `| ${t}${t === policy.need ? ' (current)' : ''} | ${gate(flat, t).falseQuiet} | ${pct(need.filter((o) => o.replay(t).loaded.some((k) => o.label.useful.includes(k))).length, need.length)} | ${pct(loads.filter(Boolean).length, loads.length)} | ${gate(flat, t).falseSkill} | ${pct(none.filter((o) => !o.replay(t).loaded.length).length, none.length)} |`,
    );
  }
  // Pooled rows repeat requests, so the comparison to the current threshold is paired per request:
  // a request counts as better or worse when its share of runs changes, and ties drop out.
  const usefulShare = (xs: Obs[], t: number) => xs.filter((o) => o.replay(t).loaded.some((k) => o.label.useful.includes(k))).length / xs.length;
  const loadShare = (xs: Obs[], t: number) => xs.filter((o) => o.replay(t).loaded.length > 0).length / xs.length;
  lines.push(
    '', '## Paired against the current threshold (per request)', '',
    'Needed requests (judge: helpful or essential) that gain or lose a useful load, and requests the judge labelled none that gain or lose a load, counted per request over the runs. p is an exact two-sided sign test.', '',
    '| need ≥ | Needed: gain / lose (p) | None: more loads / fewer (p) |', '|---:|---|---|',
  );
  const requests = byId.map((xs) => ({ xs, needed: needed(xs[0]!) }));
  for (const t of THRESHOLDS.filter((x) => x !== policy.need)) {
    const change = (isNeeded: boolean, share: (xs: Obs[], t: number) => number) => {
      const d = requests.filter((r) => r.needed === isNeeded).map((r) => share(r.xs, t) - share(r.xs, policy.need));
      return [d.filter((x) => x > 0).length, d.filter((x) => x < 0).length] as const;
    };
    const [gain, lose] = change(true, usefulShare), [more, fewer] = change(false, loadShare);
    lines.push(`| ${t} | ${gain} / ${lose} (p=${exactSignTest(gain, lose).toFixed(3)}) | ${more} / ${fewer} (p=${exactSignTest(more, fewer).toFixed(3)}) |`);
  }
  lines.push('', '"Useful" counts only skills the blind judge listed, so precision is a lower bound (C13).');
  return lines.join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { labels: { type: 'string' }, split: { type: 'string', default: 'dev' }, out: { type: 'string' } } });
  if (!values.labels || !positionals.length || !['dev', 'test'].includes(values.split!)) throw new Error('usage: need-audit.ts --labels <judge-blind.jsonl> [--split dev|test] [--out file] <sweep dir> ...');
  const report = needAudit(values.labels, positionals, values.split as 'dev' | 'test');
  if (values.out) writeFileSync(values.out, report);
  console.log(report);
}
