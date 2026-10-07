import { dot, type EmbeddingStore } from './embed.js';
import { bm25 } from './prefilter.js';
import type { Capability } from './types.js';

/** Reciprocal rank fusion constant; 60 is the usual default. */
const RRF_K = 60;

export interface Retrieved {
  capability: Capability;
  score: number;
  bm25Rank?: number;
  embedRank?: number;
}

/**
 * Rank the library for a query by fusing BM25 (exact terms, names) with
 * embedding similarity (paraphrases). Either signal alone misses what the
 * other catches; RRF needs no score calibration between them.
 */
export function hybridRank(
  query: string,
  library: Capability[],
  embeddings?: { store: EmbeddingStore; query: Float32Array },
): Retrieved[] {
  const fused = new Map<Capability, Retrieved>();
  const entry = (c: Capability) => {
    let r = fused.get(c);
    if (!r) fused.set(c, (r = { capability: c, score: 0 }));
    return r;
  };

  bm25(query, library).forEach((r, i) => {
    const e = entry(r.capability);
    e.bm25Rank = i + 1;
    e.score += 1 / (RRF_K + i + 1);
  });

  if (embeddings) {
    library
      .map((c) => ({ c, v: embeddings.store.vector(c) }))
      .filter((x): x is { c: Capability; v: Float32Array } => x.v !== undefined)
      .map(({ c, v }) => ({ c, sim: dot(embeddings.query, v) }))
      .sort((a, b) => b.sim - a.sim)
      .forEach(({ c }, i) => {
        const e = entry(c);
        e.embedRank = i + 1;
        e.score += 1 / (RRF_K + i + 1);
      });
  }

  return [...fused.values()].sort((a, b) => b.score - a.score);
}
