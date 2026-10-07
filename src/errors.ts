const ERROR_DETAIL_CHARS = 512;

export function safeDetail(text: string, secrets: Iterable<string>): string {
  let redacted = text;
  for (const value of secrets) {
    if (!value) continue;
    for (const part of new Set([JSON.stringify(value).slice(1, -1), value])) redacted = redacted.split(part).join('[REDACTED]');
  }
  return redacted.length > ERROR_DETAIL_CHARS ? `${redacted.slice(0, ERROR_DETAIL_CHARS)}…` : redacted;
}
