export function count(values) {
  return values.length;
}

export function groupBy(values, keyOf) {
  const groups = new Map();
  values.forEach((value, index) => {
    const key = keyOf(value, index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  });
  return groups;
}
