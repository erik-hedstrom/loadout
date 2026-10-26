export function cheapestActive(items) {
  return items.filter(item => !item.archived).sort((a, b) => a.price - b.price)[0] ?? null;
}
