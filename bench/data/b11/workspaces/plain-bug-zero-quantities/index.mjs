export function totalQuantity(items) {
  return items.reduce((total, item) => total + (item.quantity || 1), 0);
}
