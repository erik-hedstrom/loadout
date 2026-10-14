import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { EmbeddingStore } from '../src/embed.js';

// transformers.js 4.3's contract (dist/transformers.node.mjs): logger.error prints unless
// env.logLevel is LogLevel.NONE, and a failed inference logs the model's inputs before rethrowing.
const lib = vi.hoisted(() => ({ env: { cacheDir: '', logLevel: 30 }, LogLevel: { NONE: 50 }, failLoad: false }));
vi.mock('@huggingface/transformers', () => ({
  ...lib,
  pipeline: async () => {
    if (lib.failLoad) throw new Error('model download https://user:E11-MODEL-CANARY@example.invalid/private?token=E11-MODEL-CANARY');
    return async (texts: string[]) => {
      if (lib.env.logLevel < lib.LogLevel.NONE) console.error('Inputs given to model:', texts);
      throw new Error('inference failed');
    };
  },
}));

it('keeps the prompt out of stderr when inference fails', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const dir = mkdtempSync(join(tmpdir(), 'loadout-embed-'));
  try {
    await expect(new EmbeddingStore(dir).query('PROMPT-CANARY')).rejects.toThrow('inference failed');
    expect(errors).not.toHaveBeenCalled();
  } finally {
    errors.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  }
});

it('keeps model-load text out of embeddings stderr', async () => {
  vi.resetModules();
  const { libraryEmbeddings } = await import('../src/embed.js');
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const dir = mkdtempSync(join(tmpdir(), 'loadout-embed-'));
  lib.failLoad = true;
  try {
    expect(await libraryEmbeddings([{ id: 'skill:test', kind: 'skill', name: 'test', description: '', source: '' }], dir, console.error)).toBeUndefined();
    expect(errors.mock.calls).toEqual([['embeddings unavailable; using keyword retrieval only']]);
  } finally {
    lib.failLoad = false;
    errors.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  }
});

it.each(['models', 'models/Xenova', 'models/Xenova/bge-small-en-v1.5'])('does not download the model through a link at index/%s', async (level) => {
  vi.resetModules();
  const { libraryEmbeddings } = await import('../src/embed.js');
  const home = mkdtempSync(join(tmpdir(), 'loadout-embed-'));
  const outside = mkdtempSync(join(tmpdir(), 'loadout-outside-'));
  const link = join(home, 'index', level);
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(outside, link);
  vi.stubEnv('LOADOUT_HOME', home);
  lib.env.cacheDir = '';
  const log = vi.fn();
  try {
    expect(await libraryEmbeddings([{ id: 'skill:test', kind: 'skill', name: 'test', description: '', source: '' }], join(home, 'index', 'embeddings'), log)).toBeUndefined();
    expect(log).toHaveBeenCalledWith('embeddings unavailable; using keyword retrieval only');
    expect(lib.env.cacheDir).toBe('');
  } finally {
    vi.unstubAllEnvs();
    rmSync(home, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
