import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, paths, writeDefaultConfig } from '../src/config.js';
import { parseGitHub } from '../src/library.js';
import { detectHosts, hasKey, PACKS, packSources, wizard, type InitDeps } from '../src/init.js';

const KEY = 'a3-key-canary-5519';
const CLI = join(import.meta.dirname, '../src/cli.ts');

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'loadout-init-'));
  vi.stubEnv('LOADOUT_HOME', join(home, '.loadout'));
  vi.stubEnv('TYPESAFE_API_KEY', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

/** Runs the wizard on scripted stdin with real config and key handling, and fake add, index and hosts. */
async function run(lines: string[], overrides: Partial<InitDeps> = {}) {
  let output = '';
  const sink = new Writable({ write: (chunk, _enc, done) => ((output += chunk), done()) });
  const added: string[][] = [];
  const deps: InitDeps = {
    keyFound: () => hasKey(loadConfig()),
    writeConfig: () => writeDefaultConfig(),
    add: (sources) => (added.push(sources), 0),
    index: vi.fn(async () => {}),
    hosts: ['claude-code'],
    setup: (host) => `# setup for ${host}`,
    ...overrides,
  };
  const code = await wizard(Readable.from(lines.map((l) => `${l}\n`)), sink, deps);
  return { code, output, added, deps };
}

describe('starter packs', () => {
  it('maps names and 1-based numbers to deduplicated sources and reports the rest', () => {
    const documents = PACKS.find((p) => p.name === 'documents')!.source;
    const security = PACKS.find((p) => p.name === 'security')!.source;
    expect(packSources(['Documents, 2', 'documents'])).toEqual({ sources: [documents, security], unknown: [] });
    expect(packSources(['0', '99', 'popular', '../etc'])).toEqual({ sources: [], unknown: ['0', '99', 'popular', '../etc'] });
    expect(packSources([])).toEqual({ sources: [], unknown: [] });
  });

  it('are GitHub sources the add path accepts', () => {
    for (const p of PACKS) expect(parseGitHub(p.source)).toBeTruthy();
  });
});

describe('detectHosts', () => {
  it('lists the hosts whose CLI is found', () => {
    const found = new Set(['codex', 'opencode']);
    expect(detectHosts((bin) => (found.has(bin) ? `/bin/${bin}` : undefined))).toEqual(['codex', 'opencode']);
  });
});

describe('init wizard', () => {
  it('adds the chosen packs, builds the index and prints setup for detected hosts', async () => {
    const { code, output, added, deps } = await run(['1, security']);
    expect(code).toBe(0);
    expect(added).toEqual([[PACKS[0]!.source, PACKS[1]!.source]]);
    expect(deps.index).toHaveBeenCalledOnce();
    expect(output).toContain('not found: set TYPESAFE_API_KEY in your shell, or run `loadout init --key-file <path>`');
    expect(output).toContain(`wrote ${paths.config()}`);
    expect(output).toContain('# setup for claude-code');
    expect(output).toContain('Other hosts: loadout setup <codex|claude-desktop|cursor|opencode>');
  });

  it('reports a found key, and adds nothing on Enter', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', KEY);
    const { code, output, added, deps } = await run([''], { hosts: [] });
    expect(code).toBe(0);
    expect(output).toMatch(/TypeSafe key .*\n {2}found\n/);
    expect(added).toEqual([]);
    expect(deps.index).toHaveBeenCalledOnce();
    expect(output).toContain('No host CLI found on PATH: loadout setup <claude-code|codex|claude-desktop|cursor|opencode>');
  });

  it('asks again after an unknown pack, and ends cleanly when input runs out', async () => {
    const { code, output, added } = await run(['popular']);
    expect(code).toBe(0);
    expect(output).toContain('unknown pack; choose from documents, security, workflow');
    expect(added).toEqual([]);
  });

  it('fails when a pack fails to add', async () => {
    const { code } = await run(['workflow'], { add: () => 1 });
    expect(code).toBe(1);
  });

  it('never asks for or prints the key: not from the env, the key file, or a key typed at a prompt', async () => {
    const { output } = await run([KEY, '']);
    // The typed key was taken as a pack choice, rejected without being echoed, and the pack prompt asked again.
    expect(output.split('Packs to add').length - 1).toBe(2);
    expect(output).not.toMatch(/key file path/i);
    expect(output).toContain('unknown pack; choose from');
    expect(output).not.toContain(KEY);
    expect(readFileSync(paths.config(), 'utf8')).not.toContain(KEY);

    const keyFile = join(home, 'typesafe.txt');
    writeFileSync(keyFile, KEY, { mode: 0o600 });
    writeDefaultConfig({ apiKeyFile: keyFile });
    const fromFile = await run(['']);
    expect(fromFile.output).toContain('  found');
    expect(fromFile.output).not.toContain(KEY);
    expect(readFileSync(paths.config(), 'utf8')).not.toContain(KEY);
    expect(loadConfig().jev.apiKeyFile).toBe(keyFile);

    vi.stubEnv('TYPESAFE_API_KEY', KEY);
    expect((await run([''])).output).not.toContain(KEY);
  });
});

describe('loadout init without a terminal', () => {
  const cli = (args: string[], env: Record<string, string> = {}) =>
    spawnSync(process.execPath, ['--import', 'tsx', CLI, 'init', ...args], {
      encoding: 'utf8',
      input: '',
      env: { ...process.env, HOME: home, USERPROFILE: home, LOADOUT_HOME: join(home, '.loadout'), TYPESAFE_API_KEY: '', ...env },
    });

  it('keeps the flags behaviour: writes the config, asks nothing, prints no key and touches no host config', () => {
    const keyFile = join(home, 'typesafe.txt');
    writeFileSync(keyFile, KEY, { mode: 0o600 });
    const result = cli(['--key-file', keyFile], { TYPESAFE_API_KEY: `${KEY}-env` });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(`wrote ${join(home, '.loadout', 'config.json')}\n`);
    expect(result.stdout + result.stderr).not.toContain(KEY);
    expect(JSON.parse(readFileSync(join(home, '.loadout', 'config.json'), 'utf8'))).toEqual({ jev: { apiKeyFile: keyFile } });
    for (const dir of ['.claude', '.codex', '.agents']) expect(existsSync(join(home, dir))).toBe(false);

    expect(cli([]).stdout).toBe(`wrote ${join(home, '.loadout', 'config.json')}\n`);
  });

  it('rejects an unknown pack or a missing key file before writing anything', () => {
    const pack = cli(['--pack', 'popular']);
    expect(pack.status).toBe(1);
    expect(pack.stderr).toContain('unknown pack: popular; packs: documents, security, workflow');
    const missing = cli(['--key-file', join(home, 'nope.txt')]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('key file not found');
    expect(existsSync(join(home, '.loadout'))).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('adds a pack given by flag through the add path', () => {
    // A failing git: the pack's source reaches `loadout add` without downloading anything.
    const bin = join(home, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'git'), '#!/bin/sh\necho "fake git: $*" >&2\nexit 1\n', { mode: 0o755 });
    const result = cli(['--pack', 'security'], { PATH: `${bin}${delimiter}${process.env.PATH}` });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('wrote ');
    expect(result.stderr).toContain(`${PACKS[1]!.source}: `);
  });
});
