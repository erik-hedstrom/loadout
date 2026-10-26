export function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
