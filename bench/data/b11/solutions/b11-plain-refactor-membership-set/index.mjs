export function allowedValues(values, allowed) {
  const membership = new Set(allowed);
  return values.filter(value => membership.has(value));
}
