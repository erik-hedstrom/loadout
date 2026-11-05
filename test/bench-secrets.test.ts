import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { modelJson } from '../bench/lib.js';
import { copyOutputs } from '../bench/ab.js';
import { assertNoSecrets, credentialMatch, envSecrets, persistJson, redact, scanSecrets } from '../bench/redact.js';

const secret = 'FAKE-secret/a+b?opaque';
const dirs: string[] = [];
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'loadout-secret-gate-')); dirs.push(dir); return dir; };
afterEach(() => { vi.restoreAllMocks(); dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })); dirs.length = 0; });
const forms = [
  secret,
  encodeURIComponent(secret),
  encodeURIComponent(secret).toLowerCase().replace('fake', 'FAKE'),
  [...Buffer.from(secret)].map((byte) => '%' + byte.toString(16).padStart(2, '0')).join(''),
  [...Buffer.from(secret)].map((byte) => '%' + byte.toString(16).padStart(2, '0').toUpperCase()).join(''),
  secret.replace('-', '%2D'), secret.replace('-', '%2d'),
  secret.replace('a', '%61').replace('?', '%3f'),
  [...secret].map((char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')).join(''),
  JSON.stringify(encodeURIComponent(secret)).slice(1, -1).replace('%', '\\u0025'),
];

it('ignores numeric token settings and unlisted shapes, holding named path values of at least four characters', () => {
  const inventory = envSecrets({ MAX_THINKING_TOKENS: '1024', CLAUDE_CODE_MAX_OUTPUT_TOKENS: '16384', MAX_MCP_OUTPUT_TOKENS: '25000', PADDED_MAX_OUTPUT_TOKENS: '00000000000001024',
    SSH_AUTH_SOCK: '/tmp/a', CLIENT_SECRET: 'tiny', PRIVATE_KEY: '/tmp/long-private-key-path', TOKEN: 'C:\\fake\\long-token-path',
    GITHUB_TOKEN: secret, ODD: 'ghp_' + 'FAKE'.repeat(8) });
  expect(inventory).toEqual(['tiny', '/tmp/long-private-key-path', 'C:\\fake\\long-token-path', secret]);
  expect(persistJson({ hash: 'afe1024dead16384beef25000' }, inventory)).toBe('{"hash":"afe1024dead16384beef25000"}');
});

it('redacts a 10k fake credential without building a credential-bearing regex or error', () => {
  const long = 'FAKE-' + 'x'.repeat(10_000);
  let actual: string | undefined;
  let failed = false;
  try { actual = redact(`before ${long} after`, [long]); } catch { failed = true; }
  expect(failed).toBe(false);
  expect(actual).toBe('before <credential> after');
});

it.each(forms.map((value, index) => ({ value, index })))('detects encoding $index in arbitrary contents and names', ({ value }) => {
  expect(credentialMatch(`before ${value} after`, ['', secret])).not.toBeNull();
  expect(credentialMatch(redact(`before ${value} after`, [secret]), [secret])).toBeNull();
  const root = temp();
  mkdirSync(join(root, 'nested'));
  writeFileSync(join(root, 'nested', 'unanticipated.bin'), Buffer.from(`before\0${value} after`));
  const hits = scanSecrets(root, [secret]);
  expect(hits).toHaveLength(1);
  expect(hits[0]?.file).toBe('nested/unanticipated.bin');
  expect(() => assertNoSecrets(root, [secret])).toThrow(/UNUSABLE.*unanticipated.bin/);
  // '%' and JSON escape spelling are legal portable file names; raw '/' is a directory separator.
  const name = value.replaceAll('/', '%2F').replaceAll('?', '%3F').replaceAll('\\', '%5C');
  const named = join(root, name); mkdirSync(named);
  const report = scanSecrets(root, [secret]);
  expect(report.length).toBeGreaterThan(1);
  expect(JSON.stringify(report)).not.toContain(secret);
  expect(JSON.stringify(report)).not.toContain(name);
});

it.each(forms.map((value, index) => ({ value, index })))('withholds encoded A/B deliverables and final messages ($index)', ({ value }) => {
  const work = temp(), dest = join(temp(), 'outputs');
  writeFileSync(join(work, 'answer.txt'), value);
  expect(copyOutputs(work, dest, [], [secret])?.rule).toBe('held secret');
  expect(readFileSync(join(work, 'answer.txt'), 'utf8')).toBe(value);
  expect(scanSecrets(dest, [secret])[0]?.form).toBe('unreadable');
  rmSync(join(work, 'answer.txt'));
  expect(copyOutputs(work, dest, [], [secret], value)?.rule).toBe('held secret');
  const name = value.replaceAll('/', '%2F').replaceAll('?', '%3F').replaceAll('\\', '%5C');
  mkdirSync(join(work, name)); writeFileSync(join(work, name, 'clean.txt'), 'clean');
  expect(copyOutputs(work, dest, [], [secret])?.rule).toBe('held secret');
});

it('scans clean nested binary files without treating ordinary percent escapes as credentials', () => {
  const root = temp(); mkdirSync(join(root, 'nested')); writeFileSync(join(root, 'nested', 'clean'), '1024 %2D \\u0061');
  expect(scanSecrets(root, ['', secret])).toEqual([]);
  expect(() => assertNoSecrets(root, [secret])).not.toThrow();
  expect(redact('ordinary %2d and \\n', [secret])).toBe('ordinary %2d and \\n');
});

it('checks JSON-decoded credentials before percent decoding their literal percent characters', () => {
  const held = 'FAKE-percent%2Dopaque-secret', encoded = 'FAKE-percent\\u00252Dopaque-secret';
  expect(credentialMatch(encoded, [held])).toBe('json-escaped');
  const root = temp(); writeFileSync(join(root, 'response.json'), encoded);
  expect(() => assertNoSecrets(root, [held])).toThrow(/UNUSABLE.*response.json.*json-escaped/);
});

it('fails closed on links and unreadable entries without echoing credential-bearing paths', () => {
  const root = temp(), outside = temp(); writeFileSync(join(outside, 'private'), secret);
  symlinkSync(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => assertNoSecrets(root, [secret])).toThrow(/UNUSABLE.*linked.*symlink/);
  expect(() => assertNoSecrets(join(root, secret.replace('/', '_')), [secret])).toThrow(/UNUSABLE/);
});

it('the scanner CLI gates raw results and never prints a detected value or unsafe name', () => {
  const root = temp(), home = temp();
  const encoded = encodeURIComponent(secret);
  writeFileSync(join(root, encoded), secret);
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'bench/scan-secrets.ts', root], {
    encoding: 'utf8', timeout: 15_000, env: { ...process.env, LOADOUT_HOME: home, TYPESAFE_API_KEY: secret },
  });
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).toContain('UNUSABLE');
  expect(result.stdout + result.stderr).not.toContain(secret);
  expect(result.stdout + result.stderr).not.toContain(encoded);
});

it('spawn ENOENT reaches the normal failure row without an unhandled error or spawnargs', () => {
  const cwd = temp();
  const code = `import { run } from './bench/lib.ts'; console.log(JSON.stringify(await run('FAKE-missing-loadout-binary', [${JSON.stringify(secret)}], ${JSON.stringify(cwd)}, 1000, {})));`;
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { encoding: 'utf8', timeout: 15_000 });
  expect(child.status).toBe(0);
  expect(child.stderr).not.toContain(secret);
  expect(JSON.parse(child.stdout)).toMatchObject({ code: 1, timedOut: false });
  expect(child.stdout).not.toContain(secret);
});

it('files judging redacts held inputs and keeps distinct batches matched after redaction', async () => {
  const out = temp(), second = 'FAKE-second/secret+opaque';
  const options = { backend: 'files', model: 'fake', system: secret, out, secrets: [secret, second] };
  const schema = z.object({ result: z.string() });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  expect(await modelJson(`request ${secret}`, schema, options)).toBeNull();
  const first = readFileSync(join(out, 'batches', '001.prompt.md'), 'utf8');
  expect(first).not.toContain(secret); expect(first).toContain('<credential>');
  writeFileSync(join(out, 'batches', '001.answer.json'), '{"result":"first"}');
  expect((await modelJson(`request ${secret}`, schema, options))?.output).toEqual({ result: 'first' });
  expect(await modelJson(`different request ${second}`, schema, options)).toBeNull();
  expect(readFileSync(join(out, 'batches', '002.prompt.md'), 'utf8')).not.toContain(second);
});

it('files judging gates unrelated artifacts before handing a batch to its judge', async () => {
  const out = temp(); writeFileSync(join(out, 'unknown-writer.txt'), secret.replace('-', '%2d'));
  await expect(modelJson('fake', z.object({ answer: z.string() }), { backend: 'files', model: 'fake', system: 'fake', out, secrets: [secret] }))
    .rejects.toThrow(/UNUSABLE.*unknown-writer/);
});
