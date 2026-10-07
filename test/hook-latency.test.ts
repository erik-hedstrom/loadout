import { describe, expect, it } from 'vitest';
import { percentile, replayPreload } from '../bench/hook-latency.js';

describe('hook latency benchmark', () => {
  it('nearest-rank percentiles', () => {
    const samples = [20, ...Array.from({ length: 19 }, (_, i) => i + 1)];
    expect(percentile(samples, 0.5)).toBe(10);
    expect(percentile(samples, 0.95)).toBe(19);
    expect(samples[0]).toBe(20);
  });

  it('offline subprocess replay', async () => {
    const reply = { model: 'jev-test', answers: {}, usage: { input_tokens: 0, output_tokens: 0 } };
    const originalFetch = globalThis.fetch;
    try {
      await import(`data:text/javascript,${encodeURIComponent(replayPreload([reply], 'https://example.invalid/v1/systemone'))}`);
      await expect(globalThis.fetch('https://other.invalid')).rejects.toThrow('offline');
      expect(await (await globalThis.fetch('https://example.invalid/v1/systemone')).json()).toEqual(reply);
      await expect(globalThis.fetch('https://example.invalid/v1/systemone')).rejects.toThrow('exhausted');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});
