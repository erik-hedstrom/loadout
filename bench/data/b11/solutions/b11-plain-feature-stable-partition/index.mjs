export function select(values, predicate) {
  return values.filter(predicate);
}

export function partition(values, predicate) {
  const matched = [], unmatched = [];
  values.forEach((value, index) => {
    (predicate(value, index) ? matched : unmatched).push(value);
  });
  return [matched, unmatched];
}
