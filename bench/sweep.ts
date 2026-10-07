/**
 * Sweep: route many realistic requests through your real library and keep
 * every decision, so a judge (bench/judge.ts) can check whether the choices
 * are reasonable. Routing only: no agent runs, about $0.001 per request.
 *
 * The requests (bench/data/requests.jsonl) were written by models that never
 * saw the library, so they carry none of its vocabulary: terse seeds from one
 * model, expanded into detailed prompts by another (bench/expand.ts).
 *
 *   npx tsx bench/sweep.ts [--requests bench/data/requests.jsonl] [--limit 50] [--seed]
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig, paths, resolveApiKey } from '../src/config.js';
import { libraryEmbeddings } from '../src/embed.js';
import { jevClient } from '../src/jev.js';
import { scanLibrary, skillExcerpt } from '../src/library.js';
import { NONE, route } from '../src/route.js';
import type { RawRouting, ScoredCapability } from '../src/types.js';
import { DATA, pool, readJsonl, RESULTS } from './lib.js';

export interface SweepRequest { id: string; category: string; request: string; seed?: string }

export interface SweepRow {
  id: string;
  category: string;
  request: string;
  need?: number;
  tier: string;
  loaded: Pick_[];
  offered: Pick_[];
  /** The close-request shortlist with its fits, in the router's order. */
  shortlist: Pick_[];
  warning?: string;
  costUsd: number;
  ms: number;
  /** Jev's answers for the shortlist (wide pick trimmed to it), to replay policies offline with decide(). */
  raw?: Omit<RawRouting, 'candidates'>;
}
/** A capability as the judge sees it: its unique library key plus the router's numbers. */
export interface Pick_ { key: string; fit: number; exact?: number; share?: number; inject?: string }

/** Unique library key: the skill's folder (names can repeat across sources) or the MCP server name. */
export const keyOf = (c: ScoredCapability['capability']) => (c.kind === 'skill' ? basename(c.source) : `mcp:${c.name}`);
const pick = (s: ScoredCapability): Pick_ => ({
  key: keyOf(s.capability),
  fit: +s.p.toFixed(3),
  ...(s.exact !== undefined ? { exact: +s.exact.toFixed(3) } : {}),
  ...(s.share !== undefined ? { share: +s.share.toFixed(3) } : {}),
  ...(s.inject ? { inject: s.inject } : {}),
});

function trimRaw({ candidates: _, ...raw }: RawRouting): Omit<RawRouting, 'candidates'> {
  return { ...raw, wide: { ...raw.wide, pick: Object.fromEntries([...raw.shortlist, NONE].map((k) => [k, raw.wide.pick[k] ?? 0])) } };
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      requests: { type: 'string', default: join(DATA, 'requests.jsonl') },
      limit: { type: 'string' },
      concurrency: { type: 'string', default: '4' },
      /** Route the terse seed instead of the expanded prompt (for comparison). */
      seed: { type: 'boolean', default: false },
    },
  });
  const requests = readJsonl<SweepRequest>(values.requests!)
    .slice(0, values.limit ? Number(values.limit) : undefined)
    .map((r) => (values.seed ? { ...r, request: r.seed ?? r.request } : r));
  const config = loadConfig();
  const apiKey = resolveApiKey(config);
  if (!apiKey) throw new Error('needs a TypeSafe key (loadout init)');
  const client = jevClient({ apiKey, baseUrl: config.jev.baseUrl, model: config.jev.model });
  const library = scanLibrary(paths.library());
  const repo = { name: 'project', files: [], dependencies: [], languages: {} };
  const embeddings = config.embeddings ? await libraryEmbeddings(library, paths.embeddings(), console.log) : undefined;

  const dir = join(RESULTS, `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-sweep${values.seed ? '-seeds' : ''}`);
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'decisions.jsonl');
  console.log(`${requests.length} requests against ${library.length} capabilities${embeddings ? ' (keyword + embedding retrieval)' : ''} → ${out}`);

  let cost = 0;
  let done = 0;
  await pool(requests, Number(values.concurrency), async (r) => {
    const d = await route({ task: r.request, repo, library, config, client, excerpt: skillExcerpt, embeddings });
    const row: SweepRow = {
      id: r.id,
      category: r.category,
      request: r.request,
      ...(d.need !== undefined ? { need: +d.need.toFixed(3) } : {}),
      tier: d.tier,
      loaded: d.selected.map(pick),
      offered: d.suggested.map(pick),
      shortlist: d.scored.slice(0, 8).map(pick),
      ...(d.warning ? { warning: d.warning } : {}),
      costUsd: d.stats.costUsd ?? 0,
      ms: d.stats.ms,
      ...(d.raw ? { raw: trimRaw(d.raw) } : {}),
    };
    cost += row.costUsd;
    appendFileSync(out, JSON.stringify(row) + '\n');
    if (++done % 25 === 0) console.log(`  ${done}/${requests.length}  $${cost.toFixed(4)}`);
  });
  console.log(`done: ${done} decisions, $${cost.toFixed(4)}`);
}
