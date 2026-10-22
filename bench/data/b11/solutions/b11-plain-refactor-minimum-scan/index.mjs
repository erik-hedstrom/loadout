export function cheapestActive(items) {
  let cheapest = null;
  for (const item of items) {
    if (!item.archived && (cheapest === null || item.price < cheapest.price)) cheapest = item;
  }
  return cheapest;
}
