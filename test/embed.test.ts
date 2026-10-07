import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { EmbeddingStore } from '../src/embed.js';

// transformers.js 4.3's contract (dist/transformers.node.mjs): logger.error prints unless
// env.logLevel is LogLevel.NONE, and a failed inference logs the model's inputs before rethrowing.
const lib = vi.hoisted(() => ({ env: { cacheDir: '', logLevel: 30 }, LogLevel: { NONE: 50 } }));
vi.mock('@huggingface/transformers', () => ({
  ...lib,
  pipeline: async () => async (texts: string[]) => {
    if (lib.env.logLevel < lib.LogLevel.NONE) console.error('Inputs given to model:', texts);
    throw new Error('inference failed');
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
