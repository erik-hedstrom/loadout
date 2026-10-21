import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { format } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig, paths, withoutKey, writeDefaultConfig } from '../src/config.js';
import { windowsPath } from '../src/launch.js';
import { parseGitHub } from '../src/library.js';
import { detectHosts, interactive, PACKS, packSources, wizard, type InitDeps } from '../src/init.js';

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
  vi.restoreAllMocks();
  rmSync(home, { recursive: true, force: true });
});

/** Runs the wizard on scripted stdin with real config and key handling, and fake add, index and hosts. */
async function run(lines: string[], overrides: Partial<InitDeps> = {}) {
  let output = '';
  const sink = new Writable({ write: (chunk, _enc, done) => ((output += chunk), done()) });
  const added: string[][] = [];
  const deps: InitDeps = {
    add: (sources) => (added.push(sources), 0),
    index: vi.fn(async () => {}),
    hosts: ['claude-code'],
    setup: (host) => `# setup for ${host}`,
    ...overrides,
  };
  const code = await wizard(Readable.from(lines.map((l) => `${l}\n`)), sink, loadConfig(), deps);
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
    // Also watch the process's own streams: a stray console.log or stderr write would bypass the wizard's output.
    const streams = [
      vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true),
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true),
    ];
    const { output } = await run([KEY, '']);
    // The typed key was taken as a pack choice, rejected without being echoed, and the pack prompt asked again.
    expect(output.split('Packs to add').length - 1).toBe(2);
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
    // Printed as Node and the streams would: objects formatted, bytes decoded, writes joined without separators.
    const text = (a: unknown) => (a instanceof Uint8Array ? Buffer.from(a).toString() : a);
    for (const spy of streams) expect(spy.mock.calls.map((args) => format(...args.map(text))).join('')).not.toContain(KEY);
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
    const pack = cli(['--pack', KEY]);
    expect(pack.status).toBe(1);
    expect(pack.stderr).toContain('unknown pack; packs: documents, security, workflow');
    expect(pack.stderr + pack.stdout).not.toContain(KEY);
    const missing = cli(['--key-file', KEY]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('key file not found');
    expect(missing.stdout + missing.stderr).not.toContain(KEY);
    // Neither a stray positional nor an unknown option is echoed back by the argument parser.
    for (const args of [[KEY], [`--${KEY}`]]) {
      const bad = cli(args);
      expect(bad.status).toBe(1);
      expect(bad.stderr).toContain('usage: loadout init');
      expect(bad.stdout + bad.stderr).not.toContain(KEY);
    }
    expect(existsSync(join(home, '.loadout'))).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('adds a pack given by flag through the add path', () => {
    // A fake git: `clone` only makes the target folder and `rev-parse` fails, so the pack's source reaches
    // `loadout add` without downloading anything. Each call records whether the TypeSafe key reached git.
    const bin = join(home, 'bin');
    mkdirSync(bin);
    const git = [
      '#!/bin/sh',
      'echo "$1 ${TYPESAFE_API_KEY:-unset}" >> "$HOME/git-env"',
      'for a; do last="$a"; done',
      'if [ "$1" = "-c" ]; then mkdir -p "$last"; exit 0; fi',
      'echo "fake git: $*" >&2',
      'exit 1',
    ];
    writeFileSync(join(bin, 'git'), `${git.join('\n')}\n`, { mode: 0o755 });
    const result = cli(['--pack', 'security'], { PATH: `${bin}${delimiter}${process.env.PATH}`, TYPESAFE_API_KEY: KEY });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('wrote ');
    expect(result.stderr).toContain('could not add source');
    // Both the clone (`-c ...`) and the rev-parse (`-C ...`) ran without the key.
    expect(readFileSync(join(home, 'git-env'), 'utf8')).toBe('-c unset\n-C unset\n');
  });
});

describe('when the wizard runs', () => {
  it('needs no arguments and a terminal on stdin and stdout', () => {
    const tty = { isTTY: true };
    const pipe = {};
    expect(interactive([], tty, tty)).toBe(true);
    expect(interactive([], pipe, tty)).toBe(false);
    expect(interactive([], tty, pipe)).toBe(false);
    expect(interactive(['--pack', 'security'], tty, tty)).toBe(false);
  });
});

describe('child processes get no TypeSafe key', () => {
  it('drops the key under any casing and keeps the rest', () => {
    expect(withoutKey({ TYPESAFE_API_KEY: KEY, typesafe_api_key: KEY, PATH: '/bin' })).toEqual({ PATH: '/bin' });
  });

  it.skipIf(process.platform === 'win32')('keeps the key out of wslpath', () => {
    const bin = join(home, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'wslpath'), '#!/bin/sh\necho "${TYPESAFE_API_KEY:-unset}"\n', { mode: 0o755 });
    vi.stubEnv('PATH', `${bin}${delimiter}${process.env.PATH}`);
    vi.stubEnv('TYPESAFE_API_KEY', KEY);
    expect(windowsPath('/')).toBe('unset');
  });
});
