export function isInteger(value) {
  return Number.isSafeInteger(value);
}

export function integerRanges(values) {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const ranges = [];
  for (const value of sorted) {
    const last = ranges.at(-1);
    if (last && value === last[1] + 1) last[1] = value;
    else ranges.push([value, value]);
  }
  return ranges;
}
