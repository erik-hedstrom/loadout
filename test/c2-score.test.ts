import { describe, expect, it } from 'vitest';
import { score, scoreInterval } from '../bench/c2-score.js';

const round = ([lo, hi]: [number, number]) => [lo, hi].map((x) => Math.round(x * 100) / 100);

// The figures the protocol's Analysis section quotes.
describe('C2 score interval', () => {
  it('scores a win 1, a tie 0.5 and a loss 0', () => {
    expect(score(0, 0, 14)).toBe(0.5);
    expect(score(14, 0, 14)).toBe(1);
    expect(score(0, 14, 14)).toBe(0);
    expect(score(9, 4, 14)).toBeCloseTo(0.5 + 5 / 28, 10);
  });

  it('matches the figures of an independent calculation', () => {
    expect(round(scoreInterval(0, 0, 14))).toEqual([0.39, 0.61]);
    expect(round(scoreInterval(1, 0, 14))).toEqual([0.42, 0.66]);
    expect(round(scoreInterval(3, 0, 14))).toEqual([0.48, 0.74]);
    expect(round(scoreInterval(9, 4, 14))).toEqual([0.43, 0.85]);
    // The 0.45 "match" bound: 2 wins fall just short, 3 reach it.
    expect(scoreInterval(2, 0, 14)[0]).toBeLessThan(0.45);
    expect(scoreInterval(3, 0, 14)[0]).toBeGreaterThanOrEqual(0.45);
    // 4 wins clear parity ("better"), at 0.504.
    expect(scoreInterval(4, 0, 14)[0]).toBeGreaterThan(0.5);
  });

  it('is mirrored when the arms swap', () => {
    const [lo, hi] = scoreInterval(9, 4, 14);
    const [lo2, hi2] = scoreInterval(4, 9, 14);
    expect(lo2).toBeCloseTo(1 - hi, 8);
    expect(hi2).toBeCloseTo(1 - lo, 8);
  });

  it('stays inside 0 to 1 at the extremes', () => {
    const [lo, hi] = scoreInterval(14, 0, 14);
    expect(lo).toBeGreaterThan(0.5);
    expect(hi).toBeCloseTo(1, 6);
  });
});
