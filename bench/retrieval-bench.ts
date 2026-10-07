/**
 * Prefilter recall: how often each retriever ranks the gold skill within the
 * top K, per library size. No API calls; embeddings are computed locally and
 * cached in bench/data/embeddings/.
 *
 *   npx tsx bench/retrieval-bench.ts [--sizes 1000,20000]
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { EmbeddingStore } from '../src/embed.js';
import { hybridRank } from '../src/retrieve.js';
import { DATA, hashSeed, loadCorpus, loadTasks, rng, sample } from './lib.js';

const { values } = parseArgs({ options: { sizes: { type: 'string', default: '1000,5000,20000' } } });
const SIZES = values.sizes!.split(',').map(Number);
const KS = [1, 5, 10, 50, 100, 150, 200, 254];

const corpus = loadCorpus();
const byName = new Map(corpus.map((s) => [s.name, s]));
const tasks = loadTasks().filter((t) => t.gold.length);
const store = new EmbeddingStore(join(DATA, 'embeddings'));
const t0 = Date.now();
const added = await store.ensure(corpus, (d, n) => d % 2048 < 64 && console.error(`  embedded ${d}/${n}`));
store.save();
console.error(`corpus embeddings: ${added} new, ${store.size} cached (${((Date.now() - t0) / 1000).toFixed(0)} s)`);

const repoText = (t: (typeof tasks)[number]) => [t.repo.name, ...t.repo.files, ...t.repo.dependencies, ...Object.keys(t.repo.languages)].join(' ');
const queries = new Map<string, { task: Float32Array; full: Float32Array }>();
for (const t of tasks) queries.set(t.id, { task: await store.query(t.task), full: await store.query(`${t.task}\n${repoText(t)}`) });

const variants = {
  bm25: (q: string, lib: typeof corpus) => hybridRank(q, lib),
  embed: (_q: string, lib: typeof corpus, v: Float32Array) => hybridRank('', lib, { store, query: v }),
  hybrid: (q: string, lib: typeof corpus, v: Float32Array) => hybridRank(q, lib, { store, query: v }),
};

for (const size of SIZES) {
  const ranks: Record<string, number[]> = {};
  for (const t of tasks) {
    const gold = t.gold.map((g) => byName.get(g)!).filter(Boolean);
    const lib = [...gold, ...sample(corpus.filter((s) => !t.gold.includes(s.name)), size - gold.length, rng(hashSeed(t.id)))];
    const q = `${t.task} ${repoText(t)}`;
    const qv = queries.get(t.id)!;
    for (const [name, fn] of Object.entries(variants)) {
      for (const [label, vec] of name === 'bm25' ? [['', qv.task]] as const : ([['(task)', qv.task], ['(task+repo)', qv.full]] as const)) {
        const ranked = fn(q, lib, vec);
        const i = ranked.findIndex((r) => t.gold.includes(r.capability.name));
        (ranks[`${name}${label}`] ??= []).push(i >= 0 ? i + 1 : Infinity);
      }
    }
  }
  console.log(`\n## library ${size.toLocaleString('en')} (${tasks.length} gold tasks)\n`);
  console.log(`| retriever | ${KS.map((k) => `@${k}`).join(' | ')} |`);
  console.log(`|---|${KS.map(() => '---:').join('|')}|`);
  for (const [name, rs] of Object.entries(ranks)) {
    console.log(`| ${name} | ${KS.map((k) => `${((100 * rs.filter((r) => r <= k).length) / rs.length).toFixed(0)}%`).join(' | ')} |`);
  }
}
