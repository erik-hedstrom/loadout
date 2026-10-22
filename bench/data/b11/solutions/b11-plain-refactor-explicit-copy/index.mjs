export function copyOrder(order) {
  return {
    id: order.id,
    lines: order.lines.map(line => ({ sku: line.sku, quantity: line.quantity === 0 ? 0 : line.quantity })),
    address: { city: order.address.city, postal: order.address.postal },
  };
}
