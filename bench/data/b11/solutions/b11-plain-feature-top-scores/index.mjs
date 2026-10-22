export function maxScore(items) {
  return items.length ? Math.max(...items.map(item => item.score)) : null;
}

export function topScores(items, limit) {
  if (!Number.isInteger(limit) || limit < 0) throw new RangeError('Invalid limit');
  return [...items].sort((a, b) => b.score - a.score).slice(0, limit);
}
