import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { modelJson, splitOf, wilson } from '../bench/lib.js';
import type { SweepRow } from '../bench/sweep.js';

vi.mock('../bench/lib.js', async (original) => ({
  ...await original<typeof import('../bench/lib.js')>(),
  modelJson: vi.fn(() => { throw new Error('model calls forbidden'); }),
}));
vi.mock('../src/config.js', async (original) => ({
  ...await original<typeof import('../src/config.js')>(),
  paths: { library: () => { throw new Error('offline must not inspect the user library'); } },
}));

const temps: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'loadout-offline-'));
  temps.push(dir);
  return dir;
};
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const jsonl = (dir: string, name: string, rows: unknown[]) => writeFileSync(join(dir, name), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const row = (id: string, loaded: string[] = [], offered: string[] = []): SweepRow => ({
  id, request: `Request ${id}`, category: 'fixture', tier: 'large',
  loaded: loaded.map((key) => ({ key, fit: 0.9 })), offered: offered.map((key) => ({ key, fit: 0.8 })),
  shortlist: [], ms: 10, costUsd: 0.01,
});

function fixture() {
  const target = temp(), blind = temp(), prior = temp(), other = temp();
  jsonl(target, 'decisions.jsonl', [row('c', ['blind', 'helpful', 'neutral', 'misleading', 'new'])]);
  jsonl(blind, 'decisions.jsonl', [row('c')]);
  jsonl(blind, 'judge-blind.jsonl', [{ id: 'c', need: 'essential', useful: ['blind', 'neutral'], note: '' }]);
  jsonl(prior, 'decisions.jsonl', [row('c', ['helpful', 'neutral'])]);
  jsonl(prior, 'judge-verdicts.jsonl', [{ id: 'c', loaded: [{ key: 'helpful', rating: 'helpful' }, { key: 'neutral', rating: 'neutral' }], missed_better: 'blind', note: '' }]);
  jsonl(other, 'decisions.jsonl', [row('c', ['misleading', 'retired'])]);
  jsonl(other, 'judge-verdicts.jsonl', [{ id: 'c', loaded: [{ key: 'misleading', rating: 'misleading' }, { key: 'retired', rating: 'misleading' }], missed_better: null, note: 'Note about the old loaded set' }]);
  const args = [target, '--offline', '--blind-from', blind, '--verdicts-from', prior, '--verdicts-from', other];
  return { target, blind, prior, other, args };
}

describe('offline sweep scoring', () => {
  it('reuses per-skill ratings, includes unrated loads in both bounds, and never calls a model', async () => {
    const { judgeSweep } = await import('../bench/judge.js');
    const { target, args } = fixture();
    await judgeSweep(args);
    const report = readFileSync(join(target, 'report-offline.md'), 'utf8');
    expect(report).toContain('| n | 1 | 0 | 1 |');
    expect(report).toContain('| unratedLoads | 1 | 0 | 1 |');
    expect(report).toContain(`40% (2/5), ${wilson(2, 5)} / 60% (3/5), ${wilson(3, 5)}`);
    expect(report).toContain(`20% (1/5), ${wilson(1, 5)}`);
    expect(report).toContain('missedBetter | not shown');
    expect(report).toContain('no model calls');
    expect(report).not.toContain('Note about the old loaded set');
    expect(readdirSync(target).sort()).toEqual(['decisions.jsonl', 'report-offline.md']);
    expect(modelJson).not.toHaveBeenCalled();
  });

  it.each(['blind', 'prior'] as const)('refuses mismatched request text in the %s source', async (source) => {
    const { judgeSweep } = await import('../bench/judge.js');
    const f = fixture();
    jsonl(f[source], 'decisions.jsonl', [{ ...row('c'), request: 'Changed request' }]);
    await expect(judgeSweep(f.args)).rejects.toThrow(/requests differ/);
    expect(readdirSync(f.target)).toEqual(['decisions.jsonl']);
    expect(modelJson).not.toHaveBeenCalled();
  });

  it('fails loudly on missing blind answers and conflicting prior ratings', async () => {
    const { judgeSweep } = await import('../bench/judge.js');
    const f = fixture();
    jsonl(f.blind, 'judge-blind.jsonl', []);
    await expect(judgeSweep(f.args)).rejects.toThrow(/missing blind/);
    const g = fixture();
    jsonl(g.other, 'decisions.jsonl', [row('c', ['helpful'])]);
    jsonl(g.other, 'judge-verdicts.jsonl', [{ id: 'c', loaded: [{ key: 'helpful', rating: 'neutral' }], missed_better: null, note: '' }]);
    await expect(judgeSweep(g.args)).rejects.toThrow(/conflicting rating/);
    await expect(judgeSweep([g.target, '--offline'])).rejects.toThrow(/--blind-from/);
    expect(modelJson).not.toHaveBeenCalled();
  });
});

describe('sweep stability', () => {
  it('reports exact three-run numbers by split, aligning IDs and treating picks as sets', async () => {
    const { stabilityReport } = await import('../bench/stability.js');
    expect([splitOf('c'), splitOf('a')]).toEqual(['dev', 'test']);
    const runs = [temp(), temp(), temp()];
    const rows = [
      [row('c', ['x'], ['y']), row('a')],
      [row('a'), row('c', ['y'], ['x'])],
      [row('c', ['x', 'y']), row('a')],
    ];
    rows[0]![0]!.warning = 'Jev unavailable (timeout); used keyword ranking';
    rows[0]![1]!.warning = 'Some unrelated warning';
    rows[0]![1]!.ms = 30;
    rows[0]![1]!.costUsd = 0.03;
    runs.forEach((dir, i) => jsonl(dir, 'decisions.jsonl', rows[i]!));
    const report = stabilityReport(runs);
    expect(report).toContain(`| ${runs[0]} | dev | 1 | 1 | 10.00 | 10.00 | $0.010000 |`);
    expect(report).toContain(`| ${runs[0]} | test | 1 | 0 | 30.00 | 30.00 | $0.030000 |`);
    expect(report).toContain(`| ${runs[0]} | all | 2 | 1 | 10.00 | 30.00 | $0.020000 |`);
    expect(report).toContain('| dev | 1 | 0.00% (0/1) | 0.333333 | 100.00% (1/1) | 1.000000 |');
    expect(report).toContain('| test | 1 | 100.00% (1/1) | 1.000000 | 100.00% (1/1) | 1.000000 |');
    expect(report).toContain('| all | 2 | 50.00% (1/2) | 0.666667 | 100.00% (2/2) | 1.000000 |');
  });

  // The tests above call the exports; this runs the scripts the way the README does, so an entry-point guard
  // that is false on a supported Node (import.meta.main needs 22.18) fails here instead of exiting silently.
  it('runs both scripts from the command line', () => {
    const cli = (script: string, args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', join('bench', script), ...args],
      { encoding: 'utf8', timeout: 60_000, env: { ...process.env, LOADOUT_HOME: temp() } });
    const runs = [temp(), temp()];
    runs.forEach((dir) => jsonl(dir, 'decisions.jsonl', [row('a', ['x'])]));
    const stability = cli('stability.ts', runs);
    expect(stability.status, stability.stderr).toBe(0);
    expect(stability.stdout).toContain('# Sweep stability');
    const { target, args } = fixture();
    const judge = cli('judge.ts', args);
    expect(judge.status, judge.stderr).toBe(0);
    expect(readdirSync(target)).toContain('report-offline.md');
  }, 120_000);

  it.each(['text', 'missing', 'duplicate', 'timing'])('refuses incomparable or invalid sweeps: %s', async (problem) => {
    const { stabilityReport } = await import('../bench/stability.js');
    const a = temp(), b = temp();
    jsonl(a, 'decisions.jsonl', [row('a'), row('c')]);
    const rows = [row('a'), row('c')];
    if (problem === 'text') rows[0]!.request = 'Different';
    if (problem === 'missing') rows.pop();
    if (problem === 'duplicate') rows[1] = row('a');
    if (problem === 'timing') rows[0]!.ms = -1;
    jsonl(b, 'decisions.jsonl', rows);
    expect(() => stabilityReport([a, b])).toThrow();
  });
});
