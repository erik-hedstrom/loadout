export function parseAssignments(lines) {
  const result = new Map();
  for (const line of lines) {
    const [rawKey, value] = line.split('=');
    const key = rawKey.trim();
    if (key && value !== undefined) result.set(key, value);
  }
  return result;
}
