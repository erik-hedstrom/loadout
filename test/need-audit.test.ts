import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { auc, exactSignTest, splitOf } from '../bench/lib.js';
import { needAudit } from '../bench/need-audit.js';
import type { SweepRow } from '../bench/sweep.js';

const temps: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'loadout-need-'));
  temps.push(dir);
  return dir;
};
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const jsonl = (file: string, rows: unknown[]) => writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const ids = (split: 'dev' | 'test', n: number) => {
  const out: string[] = [];
  for (let i = 0; out.length < n; i++) if (splitOf(`n-${i}`) === split) out.push(`n-${i}`);
  return out;
};

/** One candidate, "a", rated an exact fit; `need` is the level all three need answers imply. */
const row = (id: string, level: number, source = 'skill:a'): SweepRow => ({
  id, request: `Request ${id}`, category: 'fixture', tier: 'large', loaded: [], offered: [], shortlist: [], ms: 1, costUsd: 0,
  raw: {
    model: 'fake',
    wide: { pick: { a: 0.9 }, need: { need_procedure: level, general_enough: 1 - level }, tier: {}, inputTokens: 1, ms: 1 },
    shortlist: ['a'],
    sources: { a: source },
    close: { pick: { a: 0.9 }, fit: { a: { '3': 0.95, '2': 0.05 } }, specific: { a: level }, inputTokens: 1, ms: 1 },
  },
});
const label = (id: string, need: 'none' | 'helpful' | 'essential', useful: string[]) => ({ id, need, useful, note: '' });

function fixture(source = 'skill:a') {
  const [strong, weak, none] = ids('dev', 3) as [string, string, string];
  const [heldOut] = ids('test', 1) as [string];
  const key = source.slice(source.indexOf(':') + 1);
  const dir = temp(), labels = join(temp(), 'judge-blind.jsonl');
  const rows = [row(strong, 0.9, source), row(weak, 0.4, source), row(none, 0.1, source), row(heldOut, 0.1, source)];
  // The stored loaded set is what the current policy chose: only the strong request clears the gate.
  jsonl(join(dir, 'decisions.jsonl'), rows.map((r) => (r.id === strong ? { ...r, loaded: [{ key, fit: 0.9 }] } : r)));
  jsonl(labels, [label(strong, 'essential', [key]), label(weak, 'helpful', [key]), label(none, 'none', []), label(heldOut, 'helpful', [key])]);
  return { dir, labels, rows };
}

describe('need gate audit', () => {
  it('counts a quiet verdict on a needed request as false, and reads only the chosen split', () => {
    const { dir, labels } = fixture();
    const report = needAudit(labels, [dir], 'dev');
    expect(report).toContain('3 dev requests');
    expect(report).toContain('Replay reproduces the stored loaded set in 3 of 3 rows.');
    expect(report).toContain('| run 1 | 3 | 50% (1/2, ');
    expect(report).toContain('| 0.5 (current) | 50% (1/2, ');
    expect(report).toContain('| 0.35 | 1 / 0 (p=1.000) | 0 / 0 (p=1.000) |');
  });

  it('refuses a request the judge has not labelled', () => {
    const { dir, rows } = fixture();
    const labels = join(temp(), 'judge-blind.jsonl');
    jsonl(labels, [label(rows[0]!.id, 'essential', ['a'])]);
    expect(() => needAudit(labels, [dir], 'dev')).toThrow(/no judge label/);
  });

  it('refuses sweeps that routed different request text', () => {
    const { dir, labels, rows } = fixture();
    const other = temp();
    jsonl(join(other, 'decisions.jsonl'), rows.map((r) => ({ ...r, request: 'changed' })));
    expect(() => needAudit(labels, [dir, other], 'dev')).toThrow(/requests differ/);
  });

  it('refuses a stored candidate that is not a skill', () => {
    const { dir, labels } = fixture('mcp:server');
    expect(() => needAudit(labels, [dir], 'dev')).toThrow(/cannot replay/);
  });

  it('reports need by judge label and the needed requests quiet in every run', () => {
    const { dir, labels, rows } = fixture();
    const report = needAudit(labels, [dir], 'dev');
    expect(report).toContain('- essential: median 0.90, range 0.90–0.90 (n=1).');
    expect(report).toContain(`- Needed requests below 0.5 in every run: 1 of 2 (${rows[1]!.id} helpful).`);
  });

  it('runs an exact two-sided sign test', () => {
    expect(exactSignTest(0, 0)).toBe(1);
    expect(exactSignTest(4, 0)).toBeCloseTo(0.125);
    expect(exactSignTest(0, 6)).toBeCloseTo(0.03125);
    expect(exactSignTest(3, 3)).toBe(1);
  });

  it('computes AUC with ties counting half and NaN for an empty side', () => {
    expect(auc([0.9, 0.5], [0.5, 0.1])).toBeCloseTo(0.875);
    expect(auc([], [0.1])).toBeNaN();
  });
});
