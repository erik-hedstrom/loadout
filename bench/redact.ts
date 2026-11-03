import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
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

type CredentialForm = 'raw' | 'percent-encoded' | 'json-escaped' | 'json+percent-encoded';

function forms(secret: string): string[] {
  const utf8 = Buffer.from(secret);
  const uri = encodeURIComponent(utf8.toString('utf8'));
  const percent = [...utf8].map((byte) => '%' + byte.toString(16).padStart(2, '0').toUpperCase()).join('');
  const spellings = [secret, uri, percent, secret.replaceAll('-', '%2D'), uri.replaceAll('-', '%2D')];
  return [...new Set([...spellings, ...spellings.map((value) => JSON.stringify(value).slice(1, -1))])];
}

const upperHex = (text: string) => text.replace(/%[0-9a-f]{2}/gi, (part) => part.toUpperCase());
const unescapeJson = (text: string) => text.replace(/\\(?:u[0-9a-fA-F]{4}|["\\/bfnrt])/g, (part) => JSON.parse('"' + part + '"') as string);
const unescapePercent = (text: string) => text.replace(/(?:%[0-9a-f]{2})+/gi, (part) => Buffer.from(part.replaceAll('%', ''), 'hex').toString('utf8'));

/** Decode representations for detection only; never compile credential text into a regex or an error. */
export function credentialMatch(text: string | Buffer, secrets: string[]): CredentialForm | null {
  const raw = text.toString();
  const held = secrets.filter(Boolean);
  if (held.some((secret) => raw.includes(secret))) return 'raw';
  let decoded = raw, json = false, percent = false;
  while (true) {
    const jsonView = unescapeJson(decoded);
    json ||= jsonView !== decoded;
    if (jsonView !== decoded && held.some((secret) => jsonView.includes(secret))) return percent ? 'json+percent-encoded' : 'json-escaped';
    const next = unescapePercent(jsonView);
    percent ||= next !== jsonView;
    if (next === decoded) return null;
    if (held.some((secret) => next.includes(secret))) return json && percent ? 'json+percent-encoded' : json ? 'json-escaped' : 'percent-encoded';
    decoded = next;
  }
}

export function redact(text: string, secrets: string[]): string {
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length)) {
    for (const form of forms(secret).sort((a, b) => b.length - a.length)) {
      // Hex case has equal width, so split offsets still refer to the original text.
      const parts = upperHex(text).split(upperHex(form));
      if (parts.length === 1) continue;
      let offset = 0;
      text = parts.map((part) => {
        const original = text.slice(offset, offset + part.length);
        offset += part.length + form.length;
        return original;
      }).join('<credential>');
    }
  }
  // Unusual mixtures of JSON and partial percent escapes lose the whole field.
  if (credentialMatch(text, secrets)) return '<credential>';
  return text.replace(new RegExp(TOKEN, 'g'), '<credential>');
}

/** TypeSafe's key must come separately from resolveApiKey(); settings and credential file paths are not credentials. */
export function envSecrets(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.keys(env)
    .filter((name) => name.toUpperCase() !== 'TYPESAFE_API_KEY')
    .flatMap((name) => {
      const value = env[name];
      if (!value || /^(?:[\\/]|[A-Za-z]:[\\/]|~[\\/]|file:)/.test(value)) return [];
      const named = /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASSWD|PASS|CREDENTIALS?|API_?KEY|KEY|PAT|COOKIE|AUTH|AUTHORIZATION)$/i.test(name);
      return (named && value.length >= 16) || redactText(value).count > 0 ? [value] : [];
    });
}

export interface SecretHit { file: string; form: CredentialForm | 'symlink' | 'unreadable' | 'unsupported' }

/** One fail-closed gate over all public artifacts, including files a writer did not anticipate. Links are never followed. */
export function scanSecrets(root: string, secrets: string[]): SecretHit[] {
  const hits: SecretHit[] = [];
  const safe = (file: string) => credentialMatch(file, secrets) ? '<credential-bearing path>' : file.replace(/[\x00-\x1f\x7f]/g, '?');
  const visit = (path: string, file: string) => {
    const nameHit = credentialMatch(file === '.' ? basename(path) : file, secrets);
    if (nameHit) hits.push({ file: safe(file), form: nameHit });
    try {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) hits.push({ file: safe(file), form: 'symlink' });
      else if (stat.isDirectory()) for (const name of readdirSync(path)) visit(join(path, name), file === '.' ? name : file + '/' + name);
      else if (stat.isFile()) {
        const form = credentialMatch(readFileSync(path), secrets);
        if (form) hits.push({ file: safe(file), form });
      } else hits.push({ file: safe(file), form: 'unsupported' });
    } catch { hits.push({ file: safe(file), form: 'unreadable' }); }
  };
  visit(root, '.');
  return hits;
}

export function assertNoSecrets(root: string, secrets: string[]): void {
  const hits = scanSecrets(root, secrets);
  if (hits.length) throw new Error('UNUSABLE: results secret scan: ' + hits.map(({ file, form }) => `${file} (${form})`).join('; '));
}

/** Keys and string values are redacted decoded, so a held secret is matched as it was, not as JSON escaped it. */
export function persistJson(value: unknown, secrets: string[]): string {
  const clean = (v: unknown): unknown => typeof v === 'string' ? redact(v, secrets)
    : Array.isArray(v) ? v.map(clean)
    : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [redact(k, secrets), clean(x)]))
    : v;
  return JSON.stringify(clean(value));
}
