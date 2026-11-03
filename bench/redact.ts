import { redactText } from '../src/redact.js';

/**
 * What Codex's login tokens (JWTs) and API keys look like; they can occur in third-party skill text and parsed metadata.
 * TOKEN_ANYWHERE has no boundary on purpose: any boundary can be defeated by what precedes a token (a letter, or a JSON
 * escape such as `\n` or `\\n`, which ends in a letter), while escaping never changes the token's own run. It is used
 * where a false positive is cheap: redaction at every sink (a rare kebab-case name such as `task-…` with 20+ characters
 * after `sk-` is shown as `<credential>`) and withholding a local stream.
 */
const TOKEN = String.raw`(?:eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}|sk-[\w-]{20,})`;
export const TOKEN_ANYWHERE = new RegExp(TOKEN);
/**
 * For the one check where a false positive stops a paid study, a token shape in a deliverable: not preceded by a letter
 * or digit, so kebab-case identifiers in agent code (`mask-image-…`, `task-list-item-…`) do not match. A token glued to a
 * letter in a deliverable is therefore not caught; held secrets are matched exactly and are unaffected.
 */
export const CREDENTIAL_SHAPE = new RegExp(String.raw`(?<![A-Za-z0-9])${TOKEN}`);

export function redact(text: string, secrets: string[]): string {
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) {
    // Each character may be literal or percent encoded, including URI-safe hyphens and mixed hex case.
    const pattern = Array.from(secret, (char) => {
      const literal = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const encoded = [...Buffer.from(char)].map((byte) => '%' + byte.toString(16).padStart(2, '0').replace(/[a-f]/g, (hex) => `[${hex}${hex.toUpperCase()}]`)).join('');
      return `(?:${literal}|${encoded})`;
    }).join('');
    text = text.replace(new RegExp(pattern, 'g'), '<credential>');
  }
  return text.replace(new RegExp(TOKEN, 'g'), '<credential>');
}

/** Hold only credentials available to this child. TypeSafe's key must come separately from resolveApiKey(). */
export function envSecrets(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.keys(env)
    .filter((name) => name.toUpperCase() !== 'TYPESAFE_API_KEY')
    .flatMap((name) => {
      const value = env[name];
      return value && (/TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|(?:^|_)(?:KEY|PAT|COOKIE|AUTH|AUTHORIZATION)(?:_|$)/i.test(name) || redactText(value).count > 0) ? [value] : [];
    });
}

/** Keys and string values are redacted decoded, so a held secret is matched as it was, not as JSON escaped it. */
export function persistJson(value: unknown, secrets: string[]): string {
  const clean = (v: unknown): unknown => typeof v === 'string' ? redact(v, secrets)
    : Array.isArray(v) ? v.map(clean)
    : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [redact(k, secrets), clean(x)]))
    : v;
  return JSON.stringify(clean(value));
}
