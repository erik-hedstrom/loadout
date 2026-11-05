import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import * as config from '../src/config.js';
import { credentialMatch, envSecrets, heldSecrets, persistJson, scanSecrets } from '../bench/redact.js';
import { copyOutputs, hiddenResult } from '../bench/ab.js';
import { claudeJson, modelJson } from '../bench/lib.js';

vi.mock('node:child_process', async (original) => ({ ...await original<typeof import('node:child_process')>(),
  spawn: () => { throw new Error('FAKE: live judge must not run'); },
  execFileSync: () => { throw new Error('FAKE: judge probe must not run'); },
}));
const secret = 'FAKE-opaque/value+key?';
const roots: string[] = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), 'loadout-e21-model-')); roots.push(root); return root; };
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.doUnmock('../bench/lib.js'); vi.resetModules(); for (const root of roots) rmSync(root, { recursive: true, force: true }); roots.length = 0; });
const encoded = [
  ...[0, 1, 2].flatMap((offset) => ['base64', 'base64url'].map((encoding) => ({
    form: `${encoding}/${offset}`, bytes: Buffer.from(Buffer.from('X'.repeat(offset) + secret + 'YZ').toString(encoding as BufferEncoding)),
  }))),
  { form: 'lower hex', bytes: Buffer.from(Buffer.from(secret).toString('hex')) },
  { form: 'upper hex', bytes: Buffer.from(Buffer.from(secret).toString('hex').toUpperCase()) },
  { form: 'UTF16LE', bytes: Buffer.from(secret, 'utf16le') },
  { form: 'UTF16BE', bytes: Buffer.from(secret, 'utf16le').swap16() },
];

it('uses explicit parent credential names, four-character minimum and name-only exclusions', () => {
  const env = { DB_PASSWORD: 'hunter2', CLIENT_SECRET: '/FAKE/long/slash/value', PGPASSWORD: 'opaque7', DB_PWD: 'fake-pwd',
    PWD: '/working/dir', OLDPWD: '/old/dir', KEY_FILE: '/key/file', API_KEY_PATH: '/key/path', MAX_THINKING_TOKENS: '1024',
    MAX_MCP_OUTPUT_TOKENS: '000000000001024', NAMELESS: 'sk-' + 'FAKE'.repeat(8), API_KEY: 'abc', TOKEN: 'abcd' };
  expect(envSecrets(env)).toEqual(['hunter2', '/FAKE/long/slash/value', 'opaque7', 'fake-pwd', 'abcd']);
  expect(envSecrets({ PGPASSWORD: 'root' })).toEqual(['root']);
  expect(persistJson({ hash: 'afe1024dead' }, envSecrets(env))).toBe('{"hash":"afe1024dead"}');
  vi.stubEnv('GITHUB_TOKEN', 'FAKE-parent-github-token');
  expect(heldSecrets('FAKE-resolved-typesafe', {})).toEqual(expect.arrayContaining(['FAKE-parent-github-token', 'FAKE-resolved-typesafe']));
  expect(heldSecrets('abc', {})).not.toContain('abc');
  expect(credentialMatch('abc', ['', 'abc'])).toBeNull();
  expect(persistJson({ safe: 'abc' }, ['', 'abc'])).toBe('{"safe":"abc"}');
  const names = ['KEY', 'API_KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'PASSWD', 'CREDENTIAL', 'CREDENTIALS', 'AUTH',
    'PGPASSWORD', 'GITHUB_TOKEN', 'GH_TOKEN', 'NPM_TOKEN', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
  for (const name of names) expect(envSecrets({ [name]: 'FAKE-' + name })).toEqual(['FAKE-' + name]);
});

it.each(encoded)('detects $form in contents and portable filename encodings without printing recoverable values', ({ bytes, form }) => {
  const root = temp(); writeFileSync(join(root, 'output.bin'), bytes);
  expect(scanSecrets(root, [secret])).toHaveLength(1);
  expect(credentialMatch(bytes, [secret])).not.toBeNull();
  if (form.startsWith('base64')) for (let offset = 1; offset < 4; offset++) {
    expect(credentialMatch('Z'.repeat(offset) + bytes.toString(), [secret])).not.toBeNull();
  }
  if (form.includes('hex')) expect(credentialMatch('a' + bytes.toString(), [secret])).toBe('hex');
  rmSync(join(root, 'output.bin'));
  // Filesystems store Unicode names, not NUL-containing UTF-16 byte strings; base64 wraps those bytes portably.
  const name = bytes.includes(0) ? bytes.toString('base64url') : bytes.toString('utf8').replaceAll('/', '_');
  writeFileSync(join(root, name), 'safe');
  const hits = scanSecrets(root, [secret]);
  expect(hits).toHaveLength(1);
  expect(JSON.stringify(hits)).not.toContain(name);
});

it.each(['content', 'filename', 'final message'])('withholds a base64 A/B deliverable in its %s', (where) => {
  const work = temp(), dest = join(temp(), 'copy'), value = Buffer.from('X' + secret + 'YZ').toString('base64url');
  writeFileSync(join(work, where === 'filename' ? value : 'answer.md'), where === 'content' ? value : 'safe');
  expect(copyOutputs(work, dest, [], [secret], where === 'final message' ? value : undefined)?.rule).toBe('held secret');
  expect(existsSync(dest)).toBe(false);
});

it('bounds JSON/percent decoding at four rounds and refuses deeper nesting', () => {
  let text = secret.replaceAll('-', '%2D');
  for (let round = 0; round < 3; round++) text = text.replaceAll('%', '%25');
  expect(credentialMatch(text, [secret])).toBe('percent-encoded');
  const deep = '%' + '25'.repeat(20_000) + '41';
  expect(credentialMatch(deep, [secret])).toBe('decode-depth');
});

it('ignores links and excluded dependencies in WORK while keeping result scans strict', () => {
  const work = temp(), outside = temp(), dest = join(temp(), 'copy');
  writeFileSync(join(outside, 'secret'), secret);
  mkdirSync(join(work, 'node_modules', '.bin'), { recursive: true });
  writeFileSync(join(work, 'node_modules', 'private.txt'), secret);
  symlinkSync(outside, join(work, 'node_modules', '.bin', 'npm'), process.platform === 'win32' ? 'junction' : 'dir');
  symlinkSync(outside, join(work, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  writeFileSync(join(work, 'answer.md'), 'safe answer');
  expect(scanSecrets(work, [secret], true)).toEqual([]);
  expect(copyOutputs(work, dest, [], [secret])).toBeNull();
  expect(readFileSync(join(dest, 'answer.md'), 'utf8')).toBe('safe answer');
  expect(scanSecrets(work, [secret]).some((hit) => hit.form === 'symlink')).toBe(true);
  const hidden = join(temp(), 'hidden.mjs');
  writeFileSync(hidden, "import { existsSync } from 'node:fs'; import assert from 'node:assert/strict'; import test from 'node:test'; test('copies no links or dependencies', () => { assert.equal(existsSync('linked'), false); assert.equal(existsSync('node_modules'), false); assert.equal(existsSync('answer.md'), true); });");
  expect(hiddenResult(work, hidden)).toEqual({ passed: true, tests: 1, failed: 0 });
});

it.each(['claude', 'codex'])('refuses assembled %s judge prompt and system before any live process', async (backend) => {
  const out = temp(), home = temp(); vi.stubEnv('LOADOUT_HOME', home); vi.stubEnv('DB_PASSWORD', 'hunter2');
  for (const where of ['prompt', 'system']) {
    const prompt = where === 'prompt' ? 'Request: ' + Buffer.from('hunter2').toString('base64') : 'safe';
    const system = where === 'system' ? 'System: hunter2' : 'safe';
    await expect(modelJson(prompt, z.object({ answer: z.string() }), { backend, model: 'fake', system, out })).rejects.toThrow(/UNUSABLE.*judge/);
    await expect(Promise.resolve().then(() => claudeJson(prompt, {}, { model: 'fake', system }))).rejects.toThrow(/UNUSABLE.*judge/);
  }
});

it('hashes only redacted batch text and its public counter', async () => {
  const out = temp(), home = temp(); vi.stubEnv('LOADOUT_HOME', home);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  await modelJson(secret, z.object({ answer: z.string() }), { backend: 'files', model: 'fake', system: 'safe', out, secrets: [secret] });
  const saved = readFileSync(join(out, 'batches', '001.prompt.md'), 'utf8'), end = saved.indexOf('\n');
  expect(saved.slice(0, end)).toBe('Batch SHA256: ' + createHash('sha256').update('1\n' + saved.slice(end + 1)).digest('hex'));
});

it('scanner CLI hides base64url credential-bearing filenames', () => {
  const root = temp(), home = temp(), name = Buffer.from('X' + secret + 'YZ').toString('base64url');
  writeFileSync(join(root, name), 'safe');
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'bench/scan-secrets.ts', root], {
    encoding: 'utf8', timeout: 15_000, env: { ...process.env, LOADOUT_HOME: home, TYPESAFE_API_KEY: secret },
  });
  expect(result.status).toBe(1); expect(result.stderr).toContain('UNUSABLE');
  expect(result.stderr + result.stdout).not.toContain(name);
  expect(result.stderr + result.stdout).not.toContain(secret);
});

it('checks the assembled live judge system when the private library is outside the result folder', async () => {
  const out = temp(), home = temp(); vi.stubEnv('LOADOUT_HOME', home); vi.stubEnv('PGPASSWORD', secret);
  mkdirSync(join(home, 'library', 'skills', 'safe'), { recursive: true });
  writeFileSync(join(home, 'library', 'skills', 'safe', 'SKILL.md'), `---\nname: safe\ndescription: ${secret}\n---\n`);
  writeFileSync(join(out, 'decisions.jsonl'), '{"id":"fixture","request":"safe","loaded":[],"offered":[],"shortlist":[],"ms":0,"costUsd":0}\n');
  const { judgeSweep } = await import('../bench/judge.js');
  await expect(judgeSweep([out, '--backend', 'claude'])).rejects.toThrow(/UNUSABLE.*judge payload/);
});

it('uses the supplied full inventory without reloading an invalid study configuration', async () => {
  const out = temp(), home = temp(); vi.stubEnv('LOADOUT_HOME', home);
  writeFileSync(join(home, 'config.json'), '{invalid FAKE-config');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const opts = { model: 'fake', system: 'safe', secrets: [secret], out };
  await expect(modelJson(secret, z.object({ answer: z.string() }), { ...opts, backend: 'files' })).resolves.toBeNull();
  expect(readFileSync(join(out, 'batches', '001.prompt.md'), 'utf8')).not.toContain(secret);
  for (const backend of ['claude', 'codex']) await expect(modelJson(secret, z.object({ answer: z.string() }), { ...opts, backend })).rejects.toThrow(/UNUSABLE.*judge/);
  expect(() => claudeJson(secret, {}, opts)).toThrow(/UNUSABLE.*judge/);
  const load = vi.spyOn(config, 'loadConfig').mockReturnValue(config.DEFAULT_CONFIG);
  vi.spyOn(config, 'resolveApiKey').mockReturnValue(secret);
  await expect(modelJson(secret, z.object({ answer: z.string() }), { backend: 'claude', model: 'fake', system: 'safe', out })).rejects.toThrow(/UNUSABLE.*judge/);
  expect(load).toHaveBeenCalledOnce();
});
