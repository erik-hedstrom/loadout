import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Capability } from './types.js';

/**
 * Local sentence embeddings for the prefilter. The model runs on CPU through
 * transformers.js (an optional dependency) and vectors are cached on disk by
 * content hash, so each skill is embedded once.
 */
export const EMBED_MODEL = 'Xenova/bge-small-en-v1.5';
const DIM = 384;
const CACHE_FILE = 'embeddings.bin';
/** bge models expect this prefix on queries, not on documents. */
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

type Extractor = (texts: string[], opts: { pooling: 'cls'; normalize: true }) => Promise<{ data: Float32Array }>;

let extractor: Promise<Extractor> | undefined;

async function getExtractor(modelDir: string): Promise<Extractor> {
  extractor ??= (async () => {
    let transformers: typeof import('@huggingface/transformers');
    try {
      transformers = await import('@huggingface/transformers');
    } catch {
      throw new Error('embeddings need the optional dependency @huggingface/transformers (npm install @huggingface/transformers)');
    }
    transformers.env.cacheDir = modelDir;
    return (await transformers.pipeline('feature-extraction', EMBED_MODEL, { dtype: 'q8' })) as unknown as Extractor;
  })();
  return extractor;
}

export function capabilityText(c: Pick<Capability, 'name' | 'description'>): string {
  return `${c.name.replace(/[-_]/g, ' ')}: ${c.description}`;
}

const hash = (text: string) => createHash('sha1').update(`${EMBED_MODEL}\n${text}`).digest('hex');

export class EmbeddingStore {
  private readonly vectors = new Map<string, Float32Array>();
  private dirty = false;

  /**
   * One file holds keys and vectors together ([u32 header length][header JSON][f32 vectors]),
   * published by rename, so a reader never sees keys from one write and vectors from another.
   * A torn, mismatched or foreign cache is ignored and rebuilt.
   */
  constructor(private readonly dir: string) {
    const file = join(dir, CACHE_FILE);
    if (!existsSync(file)) return;
    try {
      const buf = readFileSync(file);
      const headerLength = buf.readUInt32LE(0);
      const header = JSON.parse(buf.subarray(4, 4 + headerLength).toString('utf8')) as { model: string; dim: number; keys: string[] };
      const offset = 4 + headerLength;
      const bytes = buf.byteLength - offset;
      if (header.model !== EMBED_MODEL || header.dim !== DIM || !Array.isArray(header.keys) || bytes !== header.keys.length * DIM * 4) return;
      const all = new Float32Array(buf.buffer.slice(buf.byteOffset + offset, buf.byteOffset + buf.byteLength));
      header.keys.forEach((k, i) => this.vectors.set(k, all.subarray(i * DIM, (i + 1) * DIM)));
    } catch {
      this.vectors.clear();
    }
  }

  get size(): number {
    return this.vectors.size;
  }

  vector(c: Pick<Capability, 'name' | 'description'>): Float32Array | undefined {
    return this.vectors.get(hash(capabilityText(c)));
  }

  /** Embed every capability not cached yet. */
  async ensure(capabilities: Capability[], onProgress?: (done: number, total: number) => void): Promise<number> {
    const missing = [...new Map(capabilities.map((c) => [hash(capabilityText(c)), capabilityText(c)])).entries()].filter(
      ([k]) => !this.vectors.has(k),
    );
    if (missing.length === 0) return 0;
    const fe = await getExtractor(join(this.dir, '..', 'models'));
    const BATCH = 64;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const { data } = await fe(batch.map(([, text]) => text), { pooling: 'cls', normalize: true });
      batch.forEach(([k], j) => this.vectors.set(k, data.slice(j * DIM, (j + 1) * DIM)));
      onProgress?.(Math.min(i + BATCH, missing.length), missing.length);
    }
    this.dirty = true;
    return missing.length;
  }

  /** Embed a search query; cached like documents, so repeated routing of the same text is free. */
  async query(text: string): Promise<Float32Array> {
    const key = hash(`${QUERY_PREFIX}${text}`);
    const cached = this.vectors.get(key);
    if (cached) return cached;
    const fe = await getExtractor(join(this.dir, '..', 'models'));
    const { data } = await fe([QUERY_PREFIX + text], { pooling: 'cls', normalize: true });
    const vector = data.slice(0, DIM);
    this.vectors.set(key, vector);
    this.dirty = true;
    return vector;
  }

  save(): void {
    if (!this.dirty) return;
    mkdirSync(this.dir, { recursive: true });
    const keys = [...this.vectors.keys()];
    const header = Buffer.from(JSON.stringify({ model: EMBED_MODEL, dim: DIM, keys }), 'utf8');
    const vectors = new Float32Array(keys.length * DIM);
    keys.forEach((k, i) => vectors.set(this.vectors.get(k)!, i * DIM));
    const length = Buffer.alloc(4);
    length.writeUInt32LE(header.byteLength);
    // Unique temp name, then one atomic rename: concurrent writers each publish a consistent file.
    const tmp = join(this.dir, `${CACHE_FILE}.${process.pid}.${Date.now()}.tmp`);
    writeFileSync(tmp, Buffer.concat([length, header, Buffer.from(vectors.buffer)]));
    renameSync(tmp, join(this.dir, CACHE_FILE));
    this.dirty = false;
  }

}

/**
 * The library's embeddings, with new skills embedded and the cache saved, or
 * undefined (keyword retrieval only) when the optional package is missing or
 * the model cannot load. The first run downloads the model (~35 MB) and embeds
 * every skill once; later runs only embed what was added.
 */
export async function libraryEmbeddings(library: Capability[], dir: string, log: (message: string) => void = () => {}): Promise<EmbeddingStore | undefined> {
  try {
    await import('@huggingface/transformers');
  } catch {
    return undefined;
  }
  const store = new EmbeddingStore(dir);
  try {
    const added = await store.ensure(library, (done, total) => {
      if (total > 64 && (done === total || done % 256 === 0)) log(`indexing skills for retrieval: ${done}/${total}`);
    });
    if (added) store.save();
    return store;
  } catch (err) {
    log(`embeddings unavailable (${err instanceof Error ? err.message : err}); using keyword retrieval only`);
    return undefined;
  }
}

/**
 * The cached index only, never embedding the library now: for latency-bound
 * callers (a per-prompt hook). Undefined if the optional package or the cache
 * is missing. Skills without a cached vector are ranked by keywords alone.
 */
export async function cachedEmbeddings(dir: string): Promise<EmbeddingStore | undefined> {
  try {
    await import('@huggingface/transformers');
  } catch {
    return undefined;
  }
  const store = new EmbeddingStore(dir);
  return store.size > 0 ? store : undefined;
}

/** Cosine similarity of unit vectors. */
export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}
