/**
 * Did a change move the router's decisions beyond run-to-run noise? Give the
 * sweep (bench/sweep.ts) from before the change and two sweeps of identical
 * code after it. Per split, for the loaded skills and the load-vs-quiet
 * choice: agreement of the two after-runs (the floor) and of before with
 * each after-run, with 95% Wilson intervals, plus an exact McNemar test
 * pairing each before/after agreement with the floor on the same requests.
 * Many tests, uncorrected: read them as exploratory. Agreement is not quality;
 * changed rows still need judging.
 *
 *   npx tsx bench/agree.ts <before>/decisions.jsonl <after-1>/decisions.jsonl <after-2>/decisions.jsonl
 */
import { exactSignTest, readJsonl, splitOf, wilson } from './lib.js';

interface Row { id: string; loaded: { key: string }[]; warning?: string }

const files = process.argv.slice(2);
if (files.length !== 3) throw new Error('usage: agree.ts <before> <after-1> <after-2> (decisions.jsonl files)');
const [before, after1, after2] = files.map((f) => new Map(readJsonl<Row>(f).map((r) => [r.id, r])));
const metrics: Record<string, (r: Row) => string> = {
  'loaded skills': (r) => r.loaded.map((p) => p.key).sort().join('|'),
  'load-vs-quiet': (r) => String(r.loaded.length > 0),
};

const count = (xs: boolean[]) => {
  const k = xs.filter(Boolean).length;
  return `${k}/${xs.length} (${(100 * k / xs.length).toFixed(1)}%, ${wilson(k, xs.length)})`;
};

for (const split of ['test', 'dev', 'all'] as const) {
  const ids = [...before!.keys()].filter((id) => after1!.has(id) && after2!.has(id) && (split === 'all' || splitOf(id) === split));
  for (const [name, f] of Object.entries(metrics)) {
    const agree = (a: Map<string, Row>, b: Map<string, Row>) => ids.map((id) => f(a.get(id)!) === f(b.get(id)!));
    const floor = agree(after1!, after2!);
    const lines = [`floor ${count(floor)}`];
    for (const [label, after] of [['before/after-1', after1!], ['before/after-2', after2!]] as const) {
      const cross = agree(before!, after);
      const b = ids.filter((_, i) => floor[i] && !cross[i]).length;
      const c = ids.filter((_, i) => !floor[i] && cross[i]).length;
      lines.push(`${label} ${count(cross)}, discordant ${b} vs ${c}, McNemar p = ${exactSignTest(b, c).toFixed(3)}`);
    }
    console.log(`${split}, same ${name}: ${lines.join('; ')}`);
  }
}
const perRequest = (m: Map<string, Row>) => ([...m.values()].reduce((t, r) => t + r.loaded.length, 0) / m.size).toFixed(2);
const warned = [after1!, after2!].map((m) => [...m.values()].filter((r) => r.warning).length);
console.log(`loads per request: before ${perRequest(before!)}, after ${perRequest(after1!)} and ${perRequest(after2!)}; rows with a warning after: ${warned.join(' and ')}`);
