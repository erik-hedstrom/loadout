import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, expect, it, vi } from 'vitest';
import { persistJson, redact } from '../bench/redact.js';

// Import-driven harness tests retain rejection semantics; subprocess tests exercise the real CLI renderer.
vi.mock('../bench/redact.js', async (original) => ({ ...await original<typeof import('../bench/redact.js')>(), benchmarkFailure: (error: unknown) => { throw error; } }));

vi.mock('node:child_process', async (original) => ({
  ...await original<typeof import('node:child_process')>(), spawn: vi.fn(),
}));

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.doUnmock('../src/launch.js'); vi.doUnmock('node:fs'); });

it.each([
  ['hyphen upper', 'FAKE-opaque-token', 'FAKE%2Dopaque%2Dtoken'],
  ['hyphen lower', 'FAKE-opaque-token', 'FAKE%2dopaque%2dtoken'],
  ['URI upper', 'FAKE:a/b+c=d?e', 'FAKE%3Aa%2Fb%2Bc%3Dd%3Fe'],
  ['URI lower', 'FAKE:a/b+c=d?e', 'FAKE%3aa%2fb%2bc%3dd%3fe'],
  ['all bytes mixed case', 'FAKE-z', '%46%41%4b%45%2D%7a'],
  ['literal metacharacters', 'FAKE.[x]+($)\\?', 'FAKE.[x]+($)\\?'],
])('redacts held credentials (%s) in decoded JSON keys and nested values', (_name, secret, encoded) => {
  expect(JSON.parse(persistJson({ [encoded]: [{ goal: encoded }] }, ['', secret])))
    .toEqual({ '<credential>': [{ goal: '<credential>' }] });
  expect(redact(`before ${encoded} after`, [secret, ''])).toBe('before <credential> after');
});

it('does not redact ordinary text for empty credentials', () => {
  expect(persistJson({ goal: 'ordinary request' }, ['', ''])).toBe('{"goal":"ordinary request"}');
});

it.each([
  { source: 'TypeSafe env', name: 'TYPESAFE_API_KEY', secret: 'FAKEopaqueTypeSafeKey', exit: 1 },
  { source: 'TypeSafe key file', name: '', secret: 'FAKEopaqueFileKey', exit: 1 },
  { source: 'GitHub inherited env', name: 'GITHUB_TOKEN', secret: 'ghp_FAKEopaqueGithubKey', exit: 1 },
  { source: 'OAuth successful search', name: 'CLAUDE_CODE_OAUTH_TOKEN', secret: 'FAKEoauth-token-opaque', exit: 0 },
  { source: 'cleanup diagnostic', name: 'GITHUB_TOKEN', secret: 'FAKEcleanup-token', exit: 0 },
])('redacts the complete invoke row and console ($source)', async ({ source, name, secret, exit }) => {
  const dir = mkdtempSync(join(tmpdir(), 'loadout-invoke-redaction-'));
  const argv = process.argv;
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    vi.stubEnv('LOADOUT_HOME', dir);
    vi.stubEnv('TYPESAFE_API_KEY', '');
    if (source === 'cleanup diagnostic') {
      const work = join(dir, secret); mkdirSync(work);
      for (const name of ['TMP', 'TEMP', 'TMPDIR']) vi.stubEnv(name, work);
      vi.doMock('node:fs', async (original) => {
        const fs = await original<typeof import('node:fs')>();
        return { ...fs, rmSync: (...args: Parameters<typeof fs.rmSync>) => {
          if (String(args[0]).includes('loadout-work-')) throw new Error('FAKE cleanup failure');
          return fs.rmSync(...args);
        } };
      });
    }
    if (name) vi.stubEnv(name, secret);
    else {
      const keyFile = join(dir, 'fake-key');
      writeFileSync(keyFile, secret);
      writeFileSync(join(dir, 'config.json'), JSON.stringify({ jev: { apiKeyFile: keyFile } }));
    }
    mkdirSync(join(dir, 'library'));
    writeFileSync(join(dir, 'decisions.jsonl'), JSON.stringify({ id: secret, request: 'test', tier: 'medium', loaded: [], offered: [] }) + '\n');
    vi.doMock('../src/launch.js', async (original) => ({
      ...await original<typeof import('../src/launch.js')>(), which: () => 'fake-codex', pathTranslator: () => (s: string) => s,
    }));
    vi.mocked(spawn).mockImplementation(() => {
      const child = new EventEmitter() as ChildProcess;
      child.stdout = new PassThrough(); child.stderr = new PassThrough();
      queueMicrotask(() => {
        child.stdout!.emit('data', Buffer.from(JSON.stringify({ type: 'item.completed', item: {
          type: 'mcp_tool_call', server: 'loadout', tool: 'find_tools', status: 'completed', arguments: { goal: secret }, result: {},
        } })));
        // A chunk boundary must not leave a partial credential in the retained tail.
        child.stderr!.emit('data', Buffer.from(secret.slice(0, 6)));
        child.stderr!.emit('data', Buffer.from(secret.slice(6) + 'e'.repeat(385)));
        child.emit('close', exit);
      });
      return child;
    });
    process.argv = [process.execPath, 'bench/invoke.ts', dir, '--agent', 'codex', '--mode', 'search', '--ids', secret];
    vi.resetModules();
    await expect(import('../bench/invoke.js')).rejects.toThrow(/UNUSABLE/);
    const row = JSON.parse(readFileSync(join(dir, 'invoke-codex-search.jsonl'), 'utf8'));
    expect(row).toMatchObject({ id: '<credential>', searches: [{ goal: '<credential>' }], exit });
    if (exit) expect(row.stderr).toBe(`<credential>${'e'.repeat(385)}`);
    expect([...log.mock.calls, ...error.mock.calls].flat().join('\n')).not.toContain(secret);
    expect(log.mock.calls.flat().join('\n')).toContain('<credential>');
  } finally {
    process.argv = argv;
    rmSync(dir, { recursive: true, force: true });
  }
});
