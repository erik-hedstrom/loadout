/**
 * Decision agreement between two sweeps (bench/sweep.ts), per split: same
 * loaded skills, offered skills, load-vs-quiet, injected skills and tier.
 * Run two sweeps of identical code to get the run-to-run floor, then compare
 * across a change. Agreement is not quality: changed rows need judging.
 *
 *   npx tsx bench/agree.ts <before>/decisions.jsonl <after>/decisions.jsonl
 */
import { readFileSync } from 'node:fs';
import { splitOf } from './lib.js';

type Pick = { key: string; inject?: string };
type Row = { id: string; loaded: Pick[]; offered: Pick[]; warning?: string; need?: number; tier: string };
const read = (p: string) => new Map(readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Row).map((r) => [r.id, r]));
const [oldPath, newPath] = process.argv.slice(2);
const before = read(oldPath!);
const after = read(newPath!);
const keys = (ps: Pick[]) => ps.map((p) => p.key).sort().join('|');

for (const split of ['all', 'dev', 'test'] as const) {
  const ids = [...before.keys()].filter((id) => after.has(id) && (split === 'all' || splitOf(id) === split));
  let loaded = 0, offered = 0, quiet = 0, injected = 0, tier = 0;
  const changed: string[] = [];
  for (const id of ids) {
    const a = before.get(id)!, b = after.get(id)!;
    if (keys(a.loaded) === keys(b.loaded)) loaded++; else changed.push(id);
    if (keys(a.offered) === keys(b.offered)) offered++;
    if ((a.loaded.length === 0) === (b.loaded.length === 0)) quiet++;
    if (keys(a.loaded.filter((p) => p.inject)) === keys(b.loaded.filter((p) => p.inject))) injected++;
    if (a.tier === b.tier) tier++;
  }
  const pct = (n: number) => `${n}/${ids.length} (${((100 * n) / ids.length).toFixed(1)}%)`;
  console.log(`${split}: same loaded ${pct(loaded)}; same offered ${pct(offered)}; same load-vs-quiet ${pct(quiet)}; same injected ${pct(injected)}; same tier ${pct(tier)}`);
  if (split === 'test') console.log(`test ids with changed loads: ${changed.join(', ')}`);
}
const warned = [...after.values()].filter((r) => r.warning).length;
const loads = (m: Map<string, Row>) => [...m.values()].reduce((t, r) => t + r.loaded.length, 0);
console.log(`new sweep rows with a warning: ${warned}; loads per request before ${(loads(before) / before.size).toFixed(2)}, after ${(loads(after) / after.size).toFixed(2)}; ids missing from new: ${[...before.keys()].filter((id) => !after.has(id)).length}`);
