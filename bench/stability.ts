/** Compare saved sweeps without routing or judging: npx tsx bench/stability.ts <dir> <dir> ... */
import { join } from 'node:path';
import { z } from 'zod';
import { readJsonl, splitOf } from './lib.js';

const pick = z.object({ key: z.string() });
const rowSchema = z.object({
  id: z.string(), request: z.string(), loaded: z.array(pick), offered: z.array(pick),
  warning: z.string().optional(), ms: z.number().nonnegative(), costUsd: z.number().nonnegative(),
});

export function stabilityReport(dirs: string[]): string {
  if (dirs.length < 2) throw new Error('usage: stability.ts <sweep dir> <sweep dir> ...');
  const runs = dirs.map((dir) => {
    const rows = readJsonl<unknown>(join(dir, 'decisions.jsonl')).map((r) => rowSchema.parse(r));
    if (!rows.length) throw new Error(`empty sweep: ${dir}`);
    const byId = new Map(rows.map((r) => [r.id, r]));
    if (byId.size !== rows.length) throw new Error(`duplicate request ID in ${dir}`);
    return byId;
  });
  const first = runs[0]!;
  for (const [i, run] of runs.entries()) {
    if (run.size !== first.size || [...first].some(([id, row]) => run.get(id)?.request !== row.request)) {
      throw new Error(`requests differ from the first sweep: ${dirs[i]}`);
    }
  }
  const splits = ['dev', 'test', 'all'] as const;
  const idsFor = (split: typeof splits[number]) => [...first.keys()].filter((id) => split === 'all' || splitOf(id) === split);
  const lines = [
    '# Sweep stability', '',
    'Latency in ms (nearest-rank percentiles); mean cost per decision in USD. Keyword fallbacks match the stored "used keyword ranking" warning. Empty sets have Jaccard 1 with each other.', '',
    '| Run | Split | Rows | Keyword fallbacks | Latency p50 | Latency p95 | Mean cost |',
    '|---|---|---:|---:|---:|---:|---:|',
  ];
  runs.forEach((run, i) => {
    for (const split of splits) {
      const rows = idsFor(split).map((id) => run.get(id)!);
      const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
      const percentile = (p: number) => ms.length ? ms[Math.ceil(ms.length * p) - 1]!.toFixed(2) : '—';
      const meanCost = rows.length ? `$${(rows.reduce((sum, r) => sum + r.costUsd, 0) / rows.length).toFixed(6)}` : '—';
      lines.push(`| ${dirs[i]} | ${split} | ${rows.length} | ${rows.filter((r) => r.warning?.includes('used keyword ranking')).length} | ${percentile(0.5)} | ${percentile(0.95)} | ${meanCost} |`);
    }
  });
  lines.push('', '| Split | Requests | Loaded identical in all runs | Loaded mean pairwise Jaccard | Loaded or offered identical in all runs | Loaded or offered mean pairwise Jaccard |', '|---|---:|---:|---:|---:|---:|');
  for (const split of splits) {
    const ids = idsFor(split);
    const metrics = [false, true].flatMap((includeOffered) => {
      let identical = 0, jaccard = 0, pairs = 0;
      for (const id of ids) {
        const sets = runs.map((run) => {
          const row = run.get(id)!;
          return new Set([...row.loaded, ...(includeOffered ? row.offered : [])].map((p) => p.key));
        });
        if (sets.every((s) => s.size === sets[0]!.size && [...s].every((k) => sets[0]!.has(k)))) identical++;
        for (let i = 0; i < sets.length; i++) {
          for (let j = i + 1; j < sets.length; j++) {
            const a = sets[i]!, b = sets[j]!;
            const union = new Set([...a, ...b]).size;
            jaccard += union ? [...a].filter((k) => b.has(k)).length / union : 1;
            pairs++;
          }
        }
      }
      return [ids.length ? `${(100 * identical / ids.length).toFixed(2)}% (${identical}/${ids.length})` : '—', pairs ? (jaccard / pairs).toFixed(6) : '—'];
    });
    lines.push(`| ${split} | ${ids.length} | ${metrics.join(' | ')} |`);
  }
  return lines.join('\n') + '\n';
}

if (import.meta.main) console.log(stabilityReport(process.argv.slice(2)));
