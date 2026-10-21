import childProcess, { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { paths, writeDefaultConfig } from '../src/config.js';
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

function cli(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', join(import.meta.dirname, '../src/cli.ts'), ...args], {
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

  it.each([false, true])('refuses a linked loadout home before creating or updating config (existing: %s)', (existing) => {
    const target = join(root, 'target');
    mkdirSync(target);
    const config = join(target, 'config.json');
    const original = '{"threshold":0.25}\n';
    if (existing) writeFileSync(config, original);
    symlinkSync(target, join(root, '.loadout'), 'junction');
    // Cache callers still allow the user to link the whole home.
    expect(isPlainFolder(paths.index())).toBe(true);
    expect(() => writeDefaultConfig({ model: 'replacement' })).toThrow('loadout home must be a plain folder');
    if (existing) expect(readFileSync(config, 'utf8')).toBe(original);
    else expect(existsSync(config)).toBe(false);
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

  it.each([false, true])('does not echo an unreadable or empty MCP token-file argument (existing: %s)', (existing) => {
    const file = join(root, CANARY);
    if (existing) writeFileSync(file, '');
    const result = cli(['mcp', '--http', '--lexical', '--token-file', file]);
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(CANARY);
    expect(result.stderr).toContain(existing ? 'empty token file' : 'could not read token file');
  });
});
