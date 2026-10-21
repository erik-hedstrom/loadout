/**
 * C2's primary figure (bench/fixtures/c2/PROTOCOL.md, Analysis): one arm's score against
 * another over n paired tasks, where a win counts 1, a tie or a split 0.5 and a loss 0.
 * So S = 0.5 + (W - L) / (2n), and the interval for S comes from the one for (W - L) / n.
 */
export const score = (wins: number, losses: number, n: number): number => 0.5 + (wins - losses) / (2 * n);

const Z = 1.959964;

// Tango (1998): the maximum-likelihood P(loss) when P(win) - P(loss) = d.
function restrictedLoss(w: number, l: number, n: number, d: number): number {
  const b = w * (1 - d) + l * (1 - 3 * d) - 2 * (n - w - l) * d;
  return (b + Math.sqrt(b * b + 8 * n * l * d * (1 - d))) / (4 * n);
}

// Falls as d rises, so each end of the interval is where it crosses -Z or +Z.
const statistic = (w: number, l: number, n: number, d: number): number =>
  (w - l - n * d) / Math.sqrt(n * (2 * restrictedLoss(w, l, n, d) + d * (1 - d)));

/** 95% score interval (Tango 1998, for paired proportions) for S; ties and splits are the cases that are neither win nor loss. */
export function scoreInterval(wins: number, losses: number, n: number): [number, number] {
  const est = (wins - losses) / n;
  const crossing = (lo: number, hi: number, target: number): number => {
    for (let i = 0; i < 100; i++) {
      const mid = (lo + hi) / 2;
      if (statistic(wins, losses, n, mid) > target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const low = crossing(-1, est, Z);
  const high = crossing(est, 1, -Z);
  return [0.5 + low / 2, 0.5 + high / 2];
}
