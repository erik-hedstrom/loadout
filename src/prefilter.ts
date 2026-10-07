import type { Capability } from './types.js';

const STOPWORDS = new Set(
  ('a an and are as at be by for from has have how i in is it its of on or that the this to was ' +
    'what when where which with you your use used using can will should into out up so do does ' +
    'not no any all my me we our skill skills tool tools').split(' '),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Name tokens count this many times, so a matching name outranks a passing mention. */
const NAME_WEIGHT = 3;
const K1 = 1.2;
const B = 0.75;

interface Doc {
  capability: Capability;
  tf: Map<string, number>;
  length: number;
}

/** Tokenisation dominates BM25 cost; cache it per capability across calls. */
const analyzed = new WeakMap<Capability, Doc>();

function analyze(capability: Capability): Doc {
  let doc = analyzed.get(capability);
  if (!doc) {
    const nameTokens = tokenize(capability.name.replace(/[-_]/g, ' '));
    const tokens = [...Array<string[]>(NAME_WEIGHT).fill(nameTokens).flat(), ...tokenize(capability.description)];
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    doc = { capability, tf, length: tokens.length };
    analyzed.set(capability, doc);
  }
  return doc;
}

/**
 * Rank capabilities against a query with BM25 over name + description.
 * Returns capabilities with a positive score, best first.
 */
export function bm25(query: string, capabilities: Capability[]): { capability: Capability; score: number }[] {
  const docs = capabilities.map(analyze);
  if (docs.length === 0) return [];

  const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);

  const queryTerms = [...new Set(tokenize(query))];
  return docs
    .map((d) => {
      let score = 0;
      for (const term of queryTerms) {
        const f = d.tf.get(term);
        if (!f) continue;
        const n = df.get(term) ?? 0;
        const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
        score += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.length) / avgLength));
      }
      return { capability: d.capability, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Narrow the library to at most `max` candidates for the router. Small
 * libraries pass through untouched: the router is cheap enough to see them all,
 * and lexical matching misses paraphrases ("flaky e2e" vs "Playwright").
 */
export function prefilter(query: string, capabilities: Capability[], max: number): Capability[] {
  if (capabilities.length <= max) return capabilities;
  return bm25(query, capabilities)
    .slice(0, max)
    .map((r) => r.capability);
}
