export function parseAssignments(lines) {
  const result = new Map();
  for (const line of lines) {
    const index = line.indexOf('=');
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    if (key) result.set(key, line.slice(index + 1));
  }
  return result;
}
