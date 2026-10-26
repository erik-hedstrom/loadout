export function pickOwn(record, keys) {
  const result = {};
  for (const key of keys) {
    if (key in record) result[key] = record[key];
  }
  return result;
}
