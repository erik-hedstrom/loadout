const ERROR_DETAIL_CHARS = 512;

export function safeDetail(text: string, secrets: Iterable<string>): string {
  const spans: [number, number][] = [];
  for (const value of secrets) {
    if (!value) continue;
    for (const part of new Set([JSON.stringify(value).slice(1, -1), value])) {
      for (let start = text.indexOf(part); start !== -1; start = text.indexOf(part, start + 1)) spans.push([start, start + part.length]);
    }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const span of spans) {
    const previous = merged.at(-1);
    if (previous && span[0] < previous[1]) previous[1] = Math.max(previous[1], span[1]);
    else merged.push(span);
  }
  const pieces: string[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    pieces.push(text.slice(cursor, start), '[REDACTED]');
    cursor = end;
  }
  pieces.push(text.slice(cursor));
  const redacted = pieces.join('');
  return redacted.length > ERROR_DETAIL_CHARS ? `${redacted.slice(0, ERROR_DETAIL_CHARS)}…` : redacted;
}
