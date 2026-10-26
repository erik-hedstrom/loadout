export function calculate(operation, left, right) {
  switch (operation) {
    case 'add': return left + right;
    case 'subtract': return left - right;
    case 'multiply': return left * right;
    case 'divide': return left / right;
    default: throw new RangeError('Unknown operation: ' + operation);
  }
}
