export function pickOwn(record, keys) {
  const result = {};
  for (const key of keys) {
    if (Object.hasOwn(record, key)) result[key] = record[key];
  }
  return result;
}
