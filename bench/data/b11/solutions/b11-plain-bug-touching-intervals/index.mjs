export function mergeIntervals(intervals) {
  const sorted = intervals.map(pair => [...pair]).sort((a, b) => a[0] - b[0]);
  const result = [];
  for (const pair of sorted) {
    const previous = result.at(-1);
    if (previous && pair[0] <= previous[1]) previous[1] = Math.max(previous[1], pair[1]);
    else result.push(pair);
  }
  return result;
}
