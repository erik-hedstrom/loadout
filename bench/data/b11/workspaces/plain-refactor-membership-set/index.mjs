export function allowedValues(values, allowed) {
  return values.filter(value => allowed.includes(value));
}
