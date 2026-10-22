export function maxScore(items) {
  return items.length ? Math.max(...items.map(item => item.score)) : null;
}
