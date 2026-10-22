export function median(values) {
  if (values.length === 0) return null;
  const ordered = [...values].sort();
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}
