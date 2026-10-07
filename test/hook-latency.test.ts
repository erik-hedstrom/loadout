import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fakeClient, percentile, replayPreload } from '../bench/hook-latency.js';
import { validateResponse } from '../src/jev.js';
import { NONE } from '../src/route.js';

describe('hook latency benchmark', () => {
  it('nearest-rank percentiles', () => {
    const samples = [20, ...Array.from({ length: 19 }, (_, i) => i + 1)];
    expect(percentile(samples, 0.5)).toBe(10);
    expect(percentile(samples, 0.95)).toBe(19);
    expect(samples[0]).toBe(20);
  });

  it('schema-valid fake Jev', async () => {
    const client = fakeClient();
    const questions = {
      pick: { type: 'choice' as const, instructions: '', criteria: { fixture: '', [NONE]: '' } },
      model_tier: { type: 'choice' as const, instructions: '', criteria: { small: '', medium: '', large: '' } },
      fit_0: { type: 'score' as const, instructions: '', criteria: ['unrelated', 'same area', 'helps', 'exact'] },
      general_enough: { type: 'noul' as const, instructions: '' },
      specific_0: { type: 'noul' as const, instructions: '' },
    };
    const response = validateResponse(await client.ask({}, questions), questions);
    expect(response.answers.pick).toMatchObject({ choice: 'fixture' });
    expect(response.answers.model_tier).toMatchObject({ choice: 'medium' });
    expect(response.answers.fit_0).toMatchObject({ probabilities: { '3': 0.99 } });
    expect(response.answers.general_enough).toEqual({ type: 'noul', noul: 0.01 });
  });

  it('offline subprocess replay', async () => {
    const reply = await fakeClient().ask({}, {});
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

  it('large hostile file preload', async () => {
    const dir = mkdtempSync(join(import.meta.dirname, '..', '.hook-latency-test-'));
    try {
      const criteria = Object.fromEntries([...Array.from({ length: 200 }, (_, i) => [`${i}-${'long-key-'.repeat(20)}`, 'fixture']), ['__proto__', 'fixture']]);
      const reply = await fakeClient().ask({}, { pick: { type: 'choice', instructions: '', criteria } });
      const preload = join(dir, 'fake-preload.mjs');
      writeFileSync(preload, replayPreload([reply], 'https://example.invalid/v1/systemone'));
      const output = execFileSync(process.execPath, ['--import', pathToFileURL(preload).href, '--input-type=module', '-e',
        "const reply = await (await fetch('https://example.invalid/v1/systemone')).json(); const p = reply.answers.pick.probabilities; console.log(Object.keys(p).length, Object.hasOwn(p, '__proto__'));",
      ], { encoding: 'utf8', timeout: 10_000 });
      expect(output.trim()).toBe('201 true');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
