import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { loadConfig, resolveApiKey } from '../src/config.js';

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

type CredentialForm = 'raw' | 'percent-encoded' | 'json-escaped' | 'json+percent-encoded' | 'base64' | 'hex' | 'UTF16LE' | 'UTF16BE' | 'decode-depth';
const MAX_DECODE_ROUNDS = 4;

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

/** Only the representations in E21's threat model are decoded; no secret text becomes a regex or diagnostic. */
export function credentialMatch(text: string | Buffer, secrets: string[]): CredentialForm | null {
  const patterns = secrets.filter((secret) => secret.length >= 4).flatMap((secret) => [
    { bytes: Buffer.from(secret), form: 'raw' as const },
    { bytes: Buffer.from(secret, 'utf16le'), form: 'UTF16LE' as const },
    { bytes: Buffer.from(secret, 'utf16le').swap16(), form: 'UTF16BE' as const },
  ]);
  const direct = (bytes: Buffer) => patterns.find((pattern) => bytes.includes(pattern.bytes))?.form ?? null;
  const terminal = (bytes: Buffer): CredentialForm | null => {
    const raw = direct(bytes);
    if (raw) return raw;
    const view = bytes.toString('utf8');
    for (const [run] of view.matchAll(/[a-fA-F0-9]{8,}/g)) for (let offset = 0; offset < 2; offset++) {
      if (direct(Buffer.from(run.slice(offset), 'hex'))) return 'hex';
    }
    // Check all four character alignments of a run, so surrounding base64-alphabet text cannot hide any of the three byte offsets.
    for (const [run] of view.matchAll(/[A-Za-z0-9+/_-]{6,}={0,2}/g)) for (let offset = 0; offset < 4; offset++) {
      if (direct(Buffer.from(run.slice(offset), 'base64'))) return 'base64';
    }
    return null;
  };
  const raw = terminal(Buffer.isBuffer(text) ? text : Buffer.from(text));
  if (raw) return raw;
  let decoded = text.toString(), json = false, percent = false;
  for (let round = 0; round < MAX_DECODE_ROUNDS; round++) {
    const jsonView = unescapeJson(decoded);
    json ||= jsonView !== decoded;
    if (jsonView !== decoded && terminal(Buffer.from(jsonView))) return percent ? 'json+percent-encoded' : 'json-escaped';
    const next = unescapePercent(jsonView);
    percent ||= next !== jsonView;
    if (next === decoded) return null;
    if (terminal(Buffer.from(next))) return json && percent ? 'json+percent-encoded' : json ? 'json-escaped' : 'percent-encoded';
    decoded = next;
  }
  // A still-encoded value is refused rather than spending unbounded time proving it clean.
  return unescapePercent(unescapeJson(decoded)) === decoded ? null : 'decode-depth';
}

export function redact(text: string, secrets: string[]): string {
  for (const secret of secrets.filter((secret) => secret.length >= 4).sort((a, b) => b.length - a.length)) {
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

/** Bare PWD/OLDPWD are shell directory settings. DB_PWD and other final PWD segments are credentials. */
export function envSecrets(env: NodeJS.ProcessEnv = process.env): string[] {
  return Object.keys(env)
    .filter((name) => !['TYPESAFE_API_KEY', 'PWD', 'OLDPWD'].includes(name.toUpperCase()))
    .flatMap((name) => {
      const named = /(?:^|_)(?:KEY|API_KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|CREDENTIALS?|AUTH)$/i.test(name) || name.toUpperCase() === 'PGPASSWORD';
      const value = named ? env[name] : undefined;
      return value && value.length >= 4 ? [value] : [];
    });
}

/** Resolve TypeSafe separately; always retain the full parent inventory even when a child receives a filtered environment. */
export function heldSecrets(apiKey: string | undefined, env: NodeJS.ProcessEnv = process.env): string[] {
  return [...new Set([apiKey ?? '', ...envSecrets(), ...envSecrets(env)])].filter((value) => value.length >= 4);
}

/** The CLI boundary prints only a sanitized message, never Node's stack/cause/argv rendering. */
export function benchmarkFailure(error: unknown): void {
  let message = 'Benchmark failed; details suppressed.';
  try {
    const secrets = heldSecrets(resolveApiKey(loadConfig()));
    message = redact(error instanceof Error ? error.message : typeof error === 'string' ? error : message, secrets);
  } catch { /* Without the complete inventory, even an error about configuration must stay private. */ }
  console.error(message);
  process.exitCode = 1;
}

export const SKIP_DIRS = /[/\\](node_modules|\.git|\.venv|venv|__pycache__)([/\\]|$)/;
/** Used both before copying WORK entries and when screening that same tree. Result artifacts use the stricter scanner. */
export function copyWorkEntry(path: string): boolean {
  return !SKIP_DIRS.test(path) && !lstatSync(path).isSymbolicLink();
}

/** Check the final payload at the call boundary, including requests loaded from a parent decisions file. */
export function assertJudgePayload(prompt: string, system: string, secrets: string[]): void {
  const form = credentialMatch(prompt, secrets) ?? credentialMatch(system, secrets);
  if (form) throw new Error(`UNUSABLE: held credential in judge payload (${form})`);
}

export interface SecretHit { file: string; form: CredentialForm | 'symlink' | 'unreadable' | 'unsupported' }

/** One fail-closed gate over all public artifacts, including files a writer did not anticipate. Links are never followed. */
export function scanSecrets(root: string, secrets: string[], work = false): SecretHit[] {
  const hits: SecretHit[] = [];
  const safe = (file: string) => credentialMatch(file, secrets) ? '<credential-bearing path>' : file.replace(/[\x00-\x1f\x7f]/g, '?');
  const visit = (path: string, file: string) => {
    try {
      if (work && !copyWorkEntry(path)) return;
      const nameHit = credentialMatch(file === '.' ? basename(path) : file, secrets);
      if (nameHit) hits.push({ file: safe(file), form: nameHit });
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
