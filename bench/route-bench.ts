/**
 * Routing benchmark: does each arm put the skill a task needs in front of the
 * agent, at what cost, as the library grows?
 *
 * Arms
 *   popular   the 50 most-installed skills.sh skills, always loaded (what people do today)
 *   bm25      top 10 by BM25 (≈ lexical tool search)
 *   hybrid    top 10 by BM25 + embeddings fused (retrieval only, no Jev)
 *   loadout   hybrid retrieval → wide Jev choice → close Jev reread → policy
 *   frontier  optional: a frontier model reads every description and picks (sizes ≤ 1000)
 *
 * For each task and size N, the library is the gold skill(s) plus N-1 random
 * corpus skills; libraries are nested across sizes (each is a prefix of one
 * per-task shuffle) so curves are comparable. Each task is in a dev or test
 * split by hash: tune policies on dev with bench/tune.ts, report on test.
 * loadout rows store the raw Jev answers so policies replay without API calls.
 *
 *   npx tsx bench/route-bench.ts [--sizes 1000,5000,20000] [--arms popular,bm25,hybrid,loadout] [--frontier 20]
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_CONFIG, loadConfig, resolveApiKey, type Config } from '../src/config.js';
import { EmbeddingStore } from '../src/embed.js';
import { jevClient } from '../src/jev.js';
import { bm25 } from '../src/prefilter.js';
import { hybridRank } from '../src/retrieve.js';
import { retrievalQuery, route } from '../src/route.js';
import type { RawRouting } from '../src/types.js';
import {
  approxTokens,
  claudeJson,
  DATA,
  hashSeed,
  loadCorpus,
  loadTasks,
  pool,
  readJsonl,
  RESULTS,
  rng,
  sample,
  splitOf,
  type CorpusSkill,
  type Row,
} from './lib.js';

const { values } = parseArgs({
  options: {
    sizes: { type: 'string', default: '1000,5000,20000' },
    limit: { type: 'string' },
    arms: { type: 'string', default: 'popular,bm25,hybrid,loadout' },
    frontier: { type: 'string', default: '0' },
    'frontier-model': { type: 'string', default: 'sonnet' },
    'frontier-max-size': { type: 'string', default: '1000' },
    concurrency: { type: 'string', default: '3' },
    /** Fuse embeddings into loadout's retrieval (off by default: no gain on this benchmark). */
    embed: { type: 'boolean', default: false },
  },
});

const SIZES = values.sizes!.split(',').map(Number);
const ARMS = new Set(values.arms!.split(','));
const TOP_K = 10;
const POPULAR_N = 50;

const descTokens = (s: { name: string; description: string }) => approxTokens(`${s.name}: ${s.description}`);

function scored(base: Omit<Row, 'hit' | 'top1'>, selectedNames: string[]): Row {
  const set = new Set(selectedNames);
  return {
    ...base,
    selectedNames,
    hit: base.gold.length ? base.gold.every((g) => set.has(g)) : undefined,
    top1: base.gold.length ? base.gold.includes(selectedNames[0] ?? '') : undefined,
  };
}

function trimRaw(raw: RawRouting, gold: string[]): NonNullable<Row['raw']> {
  const keep = new Set([...Object.entries(raw.wide.pick).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k]) => k), ...gold]);
  const { candidates, ...rest } = raw;
  const goldIndex = candidates.findIndex((k) => gold.includes(k));
  return {
    ...rest,
    wide: { ...raw.wide, pick: Object.fromEntries(Object.entries(raw.wide.pick).filter(([k]) => keep.has(k))) },
    goldCandidateRank: goldIndex >= 0 ? goldIndex + 1 : undefined,
  };
}

const corpus = loadCorpus();
const byName = new Map(corpus.map((s) => [s.name, s]));
let tasks = loadTasks();
if (values.limit) tasks = tasks.slice(0, Number(values.limit));
const popular = readJsonl<{ name: string }>(join(DATA, 'popular.jsonl'))
  .slice(0, POPULAR_N)
  .map((p) => byName.get(p.name))
  .filter((s): s is CorpusSkill => Boolean(s));
const popularNames = popular.map((s) => s.name);
const popularTokens = popular.reduce((sum, s) => sum + descTokens(s), 0);

const base = loadConfig();
const config: Config = { ...DEFAULT_CONFIG, jev: base.jev, router: 'jev' };
const apiKey = resolveApiKey(base);
if (ARMS.has('loadout') && !apiKey) throw new Error('loadout arm needs TYPESAFE_API_KEY or jev.apiKeyFile in ~/.loadout/config.json');
const client = apiKey ? jevClient({ apiKey, baseUrl: config.jev.baseUrl, model: config.jev.model, timeoutMs: 30_000, retries: 5 }) : undefined;

const store = new EmbeddingStore(join(DATA, 'embeddings'));
if (ARMS.has('hybrid') || ARMS.has('loadout')) {
  await store.ensure(corpus);
  for (const t of tasks) await store.query(t.task);
  store.save();
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const label = [...ARMS].filter((a) => a !== 'none').concat(Number(values.frontier) > 0 ? ['frontier'] : [], values.embed ? ['embed'] : []).join('+');
const outDir = join(RESULTS, `${stamp}-${label}`);
mkdirSync(outDir, { recursive: true });
const rowsFile = join(outDir, 'rows.jsonl');
writeFileSync(join(outDir, 'config.json'), JSON.stringify({ sizes: SIZES, arms: [...ARMS], config: { ...config, jev: { ...config.jev, apiKeyFile: undefined } } }, null, 2));
const emit = (row: Row) => appendFileSync(rowsFile, JSON.stringify(row) + '\n');

const goldTasks = tasks.filter((t) => t.gold.length);
const nFrontier = Math.min(Number(values.frontier), goldTasks.length);
const frontierIds = new Set(Array.from({ length: nFrontier }, (_, i) => goldTasks[Math.floor((i * goldTasks.length) / nFrontier)]!.id));

const jobs = tasks.flatMap((task) => SIZES.map((size) => ({ task, size })));
let done = 0;
let jevCost = 0;
let frontierCost = 0;

await pool(jobs, Number(values.concurrency), async ({ task, size }) => {
  const goldSkills = task.gold.map((g) => byName.get(g)).filter((s): s is CorpusSkill => Boolean(s));
  const others = sample(corpus.filter((s) => !task.gold.includes(s.name)), Math.max(0, size - goldSkills.length), rng(hashSeed(task.id)));
  const library = [...goldSkills, ...others];
  const common = { task: task.id, split: splitOf(task.id), size, scope: task.scope, bucket: task.bucket, gold: task.gold };
  const query = retrievalQuery(task.task, task.repo);
  const goldRankIn = (names: string[]) => {
    const i = names.findIndex((n) => task.gold.includes(n));
    return i >= 0 ? i + 1 : undefined;
  };

  if (ARMS.has('popular')) {
    emit(scored({ ...common, arm: 'popular', selected: popular.length, contextTokens: popularTokens, routerCostUsd: 0, routerMs: 0 }, popularNames));
  }

  for (const arm of ['bm25', 'hybrid'] as const) {
    if (!ARMS.has(arm)) continue;
    const started = Date.now();
    const ranked = arm === 'bm25' ? bm25(query, library) : hybridRank(query, library, { store, query: await store.query(task.task) });
    const top = ranked.slice(0, TOP_K);
    emit(
      scored(
        {
          ...common,
          arm,
          goldRank: goldRankIn(ranked.map((r) => r.capability.name)),
          selected: top.length,
          contextTokens: top.reduce((sum, r) => sum + descTokens(r.capability), 0),
          routerCostUsd: 0,
          routerMs: Date.now() - started,
        },
        top.map((r) => r.capability.name),
      ),
    );
  }

  if (ARMS.has('loadout') && client) {
    const decision = await route({ task: task.task, repo: task.repo, library, config, client, embeddings: values.embed ? store : undefined });
    jevCost += decision.stats.costUsd ?? 0;
    const names = decision.selected.map((s) => s.capability.name);
    emit(
      scored(
        {
          ...common,
          arm: 'loadout',
          goldRank: goldRankIn(decision.scored.map((s) => s.capability.name)),
          selected: names.length,
          contextTokens: decision.selected.reduce((sum, s) => sum + descTokens(s.capability), 0),
          routerCostUsd: decision.stats.costUsd ?? 0,
          routerMs: decision.stats.ms,
          tier: decision.tier,
          need: decision.need,
          raw: decision.raw && trimRaw(decision.raw, task.gold),
        },
        names,
      ),
    );
  }

  if (frontierIds.has(task.id) && size <= Number(values['frontier-max-size'])) {
    const list = [...library].sort((a, b) => a.name.localeCompare(b.name)).map((s) => `- ${s.name}: ${s.description}`).join('\n');
    const res = await claudeJson<{ skills: string[] }>(
      `A coding agent is about to work on this task:\n\n${task.task}\n\nRepository: ${JSON.stringify(task.repo)}\n\nAvailable skills:\n${list}\n\nWhich skills (at most 12) should be loaded for this task? Return their exact names; an empty list if none would help.`,
      { type: 'object', properties: { skills: { type: 'array', items: { type: 'string' }, maxItems: 12 } }, required: ['skills'] },
      { model: values['frontier-model']!, system: 'You select agent skills for coding tasks. Output only the requested JSON.' },
    );
    frontierCost += res.costUsd;
    emit(
      scored(
        {
          ...common,
          arm: 'frontier',
          selected: res.output.skills.length,
          contextTokens: library.reduce((sum, s) => sum + descTokens(s), 0),
          routerCostUsd: res.costUsd,
          routerMs: res.ms,
        },
        res.output.skills,
      ),
    );
  }

  if (++done % 25 === 0 || done === jobs.length) {
    console.error(`  ${done}/${jobs.length}  jev $${jevCost.toFixed(4)}  frontier $${frontierCost.toFixed(3)}`);
  }
});

console.log(`rows: ${rowsFile}\nsummarise: npx tsx bench/tune.ts ${outDir}`);
