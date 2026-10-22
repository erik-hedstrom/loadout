export function flatten(values) {
  const result = [];
  for (const value of values) {
    if (Array.isArray(value)) result.push(...flatten(value));
    else result.push(value);
  }
  return result;
}
