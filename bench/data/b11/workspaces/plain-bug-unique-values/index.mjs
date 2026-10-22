export function uniqueValues(values) {
  return values.filter((value, index) => values.indexOf(value) === index);
}
