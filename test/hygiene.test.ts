import childProcess, { spawnSync } from 'node:child_process';
import fs, { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, paths, writeDefaultConfig } from '../src/config.js';
import { repoSignals } from '../src/repo.js';
import { isPlainFolder } from '../src/safefs.js';

const CANARY = 'e16-pasted-credential-canary';
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'loadout-hygiene-'));
  vi.stubEnv('LOADOUT_HOME', join(root, '.loadout'));
  vi.stubEnv('TYPESAFE_API_KEY', '');
});
afterEach(() => {
  vi.restoreAllMocks();
  syncBuiltinESMExports();
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

function cli(args: string[], preload?: string) {
  const script = join(root, 'preload.mjs');
  if (preload) writeFileSync(script, preload);
  return spawnSync(process.execPath, [...(preload ? ['--import', pathToFileURL(script).href] : []), '--import', 'tsx', join(import.meta.dirname, '../src/cli.ts'), ...args], {
    encoding: 'utf8', input: '', timeout: 20_000,
    env: { ...process.env, HOME: root, USERPROFILE: root },
  });
}

describe('E16 hygiene', () => {
  it('strips every C0/C1 control from a colliding skill name printed by add', () => {
    writeDefaultConfig();
    writeFileSync(paths.config(), JSON.stringify({ embeddings: false }));
    const first = join(root, 'first');
    const second = join(root, 'second');
    mkdirSync(first);
    mkdirSync(second);
    writeFileSync(join(first, 'SKILL.md'), '---\nname: safe-name\n---\nFirst');
    const controls = Array.from({ length: 65 }, (_, i) => i < 32 ? i : i + 95);
    const escaped = controls.map((c) => `\\x${c.toString(16).padStart(2, '0')}`).join('');
    writeFileSync(join(second, 'SKILL.md'), `---\nname: "safe${escaped}name"\n---\nSecond`);
    const result = cli(['add', first, second]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('"safename" already exists from another source; installed as ');
    expect(result.stdout.replaceAll('\n', '')).not.toMatch(/[\x00-\x1f\x7f-\x9f]/);
  });

  it.each([
    ['C1', String.fromCharCode(...Array.from({ length: 33 }, (_, i) => i + 127))],
    // Windows forbids C0 controls in filenames; NUL is forbidden on every platform.
    ...(process.platform === 'win32' ? [] : [['C0', String.fromCharCode(...Array.from({ length: 31 }, (_, i) => i + 1))]]),
  ])('strips controls from a skipped skill path (%s)', (_label, controls) => {
    writeDefaultConfig();
    writeFileSync(paths.config(), JSON.stringify({ embeddings: false }));
    const source = join(root, 'pack');
    const skill = join(source, `skip${controls}me`);
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, 'SKILL.md'), 'x'.repeat(256 * 1024 + 1));
    const result = cli(['add', source]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('skipped skipme: SKILL.md is a symlink or larger than 256 KB');
    expect(result.stdout.replaceAll('\n', '')).not.toMatch(/[\x00-\x1f\x7f-\x9f]/);
  });

  it('keeps credentials out of git ls-files while retaining repository signals and other env', () => {
    vi.stubEnv('TYPESAFE_API_KEY', CANARY);
    vi.stubEnv('typesafe_api_key', CANARY);
    vi.stubEnv('E16_GIT_CANARY', 'retained');
    let inherited: NodeJS.ProcessEnv | undefined;
    const git = vi.spyOn(childProcess, 'execFileSync').mockImplementation((_file, _args, options) => {
      inherited = (options as { env?: NodeJS.ProcessEnv }).env ?? process.env;
      return 'src/main.ts\n';
    });
    syncBuiltinESMExports();
    expect(repoSignals(root).languages).toEqual({ ts: 1 });
    expect(git).toHaveBeenCalledWith('git', ['ls-files'], expect.any(Object));
    expect(Object.keys(inherited!).some((k) => k.toUpperCase() === 'TYPESAFE_API_KEY')).toBe(false);
    expect(inherited!.E16_GIT_CANARY).toBe('retained');
  });

  it.each([false, true])('writes config through a user-relocated linked home (existing: %s)', (existing) => {
    const target = join(root, 'target');
    mkdirSync(target);
    const config = join(target, 'config.json');
    const original = '{"threshold":0.25}\n';
    if (existing) writeFileSync(config, original);
    symlinkSync(target, join(root, '.loadout'), 'junction');
    // Cache callers still allow the user to link the whole home.
    expect(isPlainFolder(paths.index())).toBe(true);
    writeDefaultConfig({ model: 'replacement' });
    expect(JSON.parse(readFileSync(config, 'utf8'))).toEqual({ ...(existing ? { threshold: 0.25 } : {}), jev: { model: 'replacement' } });
    expect(loadConfig().jev.model).toBe('replacement');
  });

  it.each(['link', 'dangling link', 'directory'])('refuses a nonregular config before reading it (%s)', (kind) => {
    mkdirSync(join(root, '.loadout'));
    const target = join(root, 'outside.json');
    if (kind !== 'dangling link') writeFileSync(target, '{"threshold":0.25}');
    if (kind === 'directory') mkdirSync(paths.config());
    else symlinkSync(target, paths.config(), 'file');
    const reads = vi.spyOn(fs, 'readFileSync');
    syncBuiltinESMExports();
    expect(() => writeDefaultConfig()).toThrow('config.json must be a regular file');
    expect(reads.mock.calls.some(([file]) => file === paths.config())).toBe(false);
    reads.mockRestore();
    syncBuiltinESMExports();
    if (kind === 'dangling link') expect(existsSync(target)).toBe(false);
    else expect(readFileSync(target, 'utf8')).toBe('{"threshold":0.25}');
  });

  it.each([['init'], ['route', '--lexical', 'test task']].map((args) => [args]))('refuses linked config before the CLI reads its target: %j', (args) => {
    mkdirSync(join(root, '.loadout'));
    const target = join(root, 'outside.json');
    const content = `invalid JSON ${CANARY}`;
    writeFileSync(target, content);
    symlinkSync(target, paths.config(), 'file');
    const reads = join(root, 'config-read');
    const result = cli(args, `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const read = fs.readFileSync;
      fs.readFileSync = (file, ...args) => {
        if (String(file) === ${JSON.stringify(paths.config())} || String(file) === ${JSON.stringify(target)}) fs.appendFileSync(${JSON.stringify(reads)}, 'read');
        return read(file, ...args);
      };
      syncBuiltinESMExports();
    `);
    expect(result.status).toBe(1);
    expect(existsSync(reads)).toBe(false);
    expect(result.stderr).toContain('config.json must be a regular file');
    expect(result.stdout + result.stderr).not.toContain(CANARY);
    expect(readFileSync(target, 'utf8')).toBe(content);
  });

  it('propagates config inspection failures instead of treating the file as missing', () => {
    writeDefaultConfig();
    const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const stat = fs.lstatSync;
    vi.spyOn(fs, 'lstatSync').mockImplementation((...args: Parameters<typeof stat>) => {
      if (args[0] === paths.config()) throw denied;
      return stat(...args);
    });
    syncBuiltinESMExports();
    expect(() => writeDefaultConfig({ model: 'replacement' })).toThrow(denied);
    expect(readFileSync(paths.config(), 'utf8')).toBe('{}\n');
  });

  it.each([
    [CANARY], ['add', CANARY], ['add', `--${CANARY}`],
    ['list', CANARY], ['list', `--${CANARY}`], ['list', `--json=${CANARY}`],
    ['audit', CANARY], ['route', `--${CANARY}`],
    ['claude', `--${CANARY}`], ['codex', `--${CANARY}`],
    ['mcp', CANARY], ['mcp', '--port', `--${CANARY}`], ['setup', `--${CANARY}`],
  ].map((args) => [args]))('does not echo a rejected argument: %j', (args) => {
    const result = cli(args);
    expect(result.status, result.stderr).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(CANARY);
    expect(result.stderr).toMatch(/unknown command|invalid arguments|could not add source/);
  });

  it('does not echo an existing add source when the filesystem rejects it', () => {
    const file = join(root, CANARY);
    writeFileSync(file, 'not a directory');
    const result = cli(['add', file]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(CANARY);
    expect(result.stderr).toContain('could not add source');
  });

  it('reports failed source positions and reasons while continuing the add', () => {
    const file = join(root, `${CANARY}-file`);
    const empty = join(root, 'empty');
    writeFileSync(file, 'not a directory');
    mkdirSync(empty);
    const result = cli(['add', join(root, CANARY), file, empty]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(CANARY);
    expect(result.stderr).toContain('source 1 of 3: could not add source: not found (ENOENT)');
    expect(result.stderr).toContain('source 2 of 3: could not add source: not a directory (ENOTDIR)');
    expect(result.stdout).toContain(`${empty}: no skills found`);
  });

  it.each(['EACCES', CANARY])('reports only allowlisted errno for failed adds (%s)', (code) => {
    const result = cli(['add', CANARY], `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const stat = fs.statSync;
      fs.statSync = (file, ...args) => {
        if (String(file).endsWith(${JSON.stringify(CANARY)})) throw Object.assign(new Error(${JSON.stringify(CANARY)}), {code: ${JSON.stringify(code)}});
        return stat(file, ...args);
      };
      syncBuiltinESMExports();
    `);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(CANARY);
    expect(result.stderr).toContain(`source 1 of 1: could not add source: ${code === 'EACCES' ? 'permission denied (EACCES)' : 'operation failed'}`);
  });

  it('reports a GitHub failure by position without echoing git stderr or the spec', () => {
    const result = cli(['add', `github:${CANARY}/repo`], `
      import cp from 'node:child_process';
      import { syncBuiltinESMExports } from 'node:module';
      cp.execFileSync = () => { throw Object.assign(new Error(${JSON.stringify(CANARY)}), {status: 128, stderr: ${JSON.stringify(CANARY)}}); };
      syncBuiltinESMExports();
    `);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(CANARY);
    expect(result.stderr).toContain('source 1 of 1: GitHub import failed: operation failed');
  });

  it.each(['EADDRINUSE', 'EACCES', 'ENOTFOUND', 'EADDRNOTAVAIL', CANARY, undefined])('classifies HTTP startup failures without echoing host or error text (%s)', (code) => {
    const token = join(root, 'token');
    writeFileSync(token, 'test-token');
    const result = cli(['mcp', '--http', '--lexical', '--token-file', token, '--host', `${CANARY}\\bad`], `
      import http from 'node:http';
      http.Server.prototype.listen = function () {
        this.emit('error', Object.assign(new Error(${JSON.stringify(CANARY)}), {code: ${JSON.stringify(code)}}));
        return this;
      };
    `);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(CANARY);
    expect(result.stderr).toContain('MCP HTTP server could not start');
    if (code && code !== CANARY) expect(result.stderr).toContain(`(${code})`);
    else expect(result.stderr).toContain('operation failed');
  });

  it.each(['EACCES', CANARY])('sanitizes non-parser filesystem failures in other commands (%s)', (code) => {
    writeDefaultConfig();
    const result = cli(['route', '--lexical', CANARY], `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const read = fs.readFileSync;
      fs.readFileSync = (file, ...args) => {
        if (String(file).endsWith('config.json')) throw Object.assign(new Error(${JSON.stringify(CANARY)}), {code: ${JSON.stringify(code)}});
        return read(file, ...args);
      };
      syncBuiltinESMExports();
    `);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(CANARY);
    expect(result.stderr).toContain(code === 'EACCES' ? 'permission denied (EACCES)' : 'operation failed');
  });

  it.each([false, true])('does not echo an unreadable or empty MCP token-file argument (existing: %s)', (existing) => {
    const file = join(root, CANARY);
    if (existing) writeFileSync(file, '');
    const result = cli(['mcp', '--http', '--lexical', '--token-file', file]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(CANARY);
    expect(result.stderr).toContain(existing ? 'empty token file' : 'could not read token file');
  });
});
