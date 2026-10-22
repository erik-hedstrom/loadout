export function chunks(values, size) {
  if (!Number.isInteger(size) || size <= 0) throw new RangeError('Invalid size');
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}
