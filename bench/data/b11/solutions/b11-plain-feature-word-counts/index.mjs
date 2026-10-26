export function words(text) {
  return (text.match(/[A-Za-z]+/g) ?? []).map(word => word.toLowerCase());
}

export function wordCounts(text) {
  const counts = new Map();
  for (const word of words(text)) counts.set(word, (counts.get(word) ?? 0) + 1);
  return counts;
}
