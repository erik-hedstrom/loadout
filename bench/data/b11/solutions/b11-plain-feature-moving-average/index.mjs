export function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function movingAverage(values, width) {
  if (!Number.isInteger(width) || width <= 0) throw new RangeError('Invalid width');
  const result = [];
  for (let index = 0; index + width <= values.length; index++) {
    result.push(mean(values.slice(index, index + width)));
  }
  return result;
}
