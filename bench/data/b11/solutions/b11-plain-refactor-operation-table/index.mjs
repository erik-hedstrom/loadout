const operations = new Map([
  ['add', (left, right) => left + right],
  ['subtract', (left, right) => left - right],
  ['multiply', (left, right) => left * right],
  ['divide', (left, right) => left / right],
]);

export function calculate(operation, left, right) {
  const compute = operations.get(operation);
  if (!compute) throw new RangeError('Unknown operation: ' + operation);
  return compute(left, right);
}
