import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type Config } from '../src/config.js';
import { doctor, formatDoctor } from '../src/doctor.js';
import { jevClient, type SystemOneClient } from '../src/jev.js';
import { claudeHookSettings, hostSetup } from '../src/launch.js';

const KEY = 'doctor-key-canary-7731';
const config: Config = { ...DEFAULT_CONFIG, embeddings: false };
const okClient: SystemOneClient = { ask: async () => ({ model: 'jev-test', answers: { ok: { type: 'noul', noul: 0.9 } }, usage: { input_tokens: 10, output_tokens: 0 } }) };

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'loadout-doctor-'));
  mkdirSync(join(home, 'bin'));
  vi.stubEnv('HOME', home);
  vi.stubEnv('USERPROFILE', home);
  vi.stubEnv('PATH', join(home, 'bin'));
  vi.stubEnv('LOADOUT_HOME', join(home, '.loadout'));
  vi.stubEnv('CLAUDE_CONFIG_DIR', join(home, 'claude'));
  vi.stubEnv('CODEX_HOME', join(home, 'codex'));
  vi.stubEnv('TYPESAFE_API_KEY', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(home, { recursive: true, force: true });
});

const byName = (checks: Awaited<ReturnType<typeof doctor>>) => Object.fromEntries(checks.map((c) => [c.name, c]));

describe('doctor', () => {
  it('prints a fix for each failed check and makes no Jev call without a key', async () => {
    const client = vi.fn(() => okClient);
    const checks = byName(await doctor(config, client));
    expect(client).not.toHaveBeenCalled();
    expect(checks['Jev key']).toMatchObject({ ok: false, detail: 'not found' });
    expect(checks['Jev call']).toBeUndefined();
    expect(checks['library']).toMatchObject({ ok: false, fix: 'loadout add <dir|github-url>' });
    expect(checks['loadout on PATH']!.ok).toBe(false);
    // No CLI and no config folder: the host is not shown at all.
    expect(checks['Claude Code']).toBeUndefined();
    expect(formatDoctor(Object.values(checks))).toMatch(/✗ Jev key +not found\n +fix: set TYPESAFE_API_KEY/);
  });

  it('names a configured key file that is missing, without printing its path', async () => {
    const keyFile = join(home, 'secret-key-file.txt');
    const checks = byName(await doctor({ ...config, jev: { ...config.jev, apiKeyFile: keyFile } }, () => okClient));
    expect(checks['Jev key']!.detail).toBe('not found; jev.apiKeyFile in the config names a missing file');
    expect(formatDoctor(Object.values(checks))).not.toContain(keyFile);
  });

  it('reports an unreadable key file in fixed text and carries on', async () => {
    const keyDir = join(home, 'secret-key-folder');
    mkdirSync(keyDir);
    const checks = byName(await doctor({ ...config, jev: { ...config.jev, apiKeyFile: keyDir } }, () => okClient));
    expect(checks['Jev key']).toMatchObject({ ok: false, detail: 'not found; jev.apiKeyFile in the config cannot be read' });
    expect(checks['library']).toBeDefined();
    expect(formatDoctor(Object.values(checks))).not.toContain(keyDir);
  });

  it('reports a malformed library mcp.json as a failed check and carries on', async () => {
    mkdirSync(join(home, '.loadout', 'library'), { recursive: true });
    writeFileSync(join(home, '.loadout', 'library', 'mcp.json'), '{ not json');
    mkdirSync(join(home, 'codex'));
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['library']).toMatchObject({ ok: false, detail: 'library mcp.json is not valid JSON' });
    expect(checks['Codex']).toBeDefined();
  });

  it.skipIf(process.platform === 'win32')('passes when everything is set up, and never prints the key', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', KEY);
    vi.stubEnv('GITHUB_TOKEN', 'github-token-canary');
    cpSync(join(import.meta.dirname, 'fixtures', 'library'), join(home, '.loadout', 'library'), { recursive: true });
    for (const bin of ['loadout', 'claude', 'codex']) {
      // A CLI that would print credentials from its environment if it received them.
      writeFileSync(join(home, 'bin', bin), `#!/bin/sh\necho "${bin} 9.9.9 $TYPESAFE_API_KEY $GITHUB_TOKEN"\n`);
      chmodSync(join(home, 'bin', bin), 0o755);
    }
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'loadout@loadout': true } }));
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), '[mcp_servers.loadout]\ncommand = "loadout"\n');
    const checks = await doctor(config, () => okClient);
    expect(checks.filter((c) => !c.ok)).toEqual([]);
    const named = byName(checks);
    expect(named['Claude Code']!.detail).toBe('claude 9.9.9; loadout: plugin enabled');
    expect(named['Codex']!.detail).toBe('codex 9.9.9; loadout: search server');
    expect(formatDoctor(checks)).not.toContain(KEY);
  });

  it('reports a failed Jev call in fixed text, whatever the error carried', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', KEY);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError(`connect failed: Bearer ${KEY}`));
    const checks = byName(await doctor(config, (apiKey) => jevClient({ apiKey, baseUrl: 'https://example.invalid', model: 'fake', retries: 0 })));
    expect(checks['Jev call']).toMatchObject({ ok: false, detail: 'Jev request failed: network error' });
    expect(formatDoctor(Object.values(checks))).not.toContain(KEY);
  });

  it('counts the library skills missing from the embedding index', async () => {
    vi.doMock('../src/embed.js', async (original) => ({ ...(await original<typeof import('../src/embed.js')>()), hasTransformers: async () => true }));
    vi.resetModules();
    const { doctor: withIndex } = await import('../src/doctor.js');
    cpSync(join(import.meta.dirname, 'fixtures', 'library'), join(home, '.loadout', 'library'), { recursive: true });
    const index = byName(await withIndex({ ...config, embeddings: true }, () => okClient))['embedding index']!;
    expect(index).toMatchObject({ ok: false, fix: 'the next `loadout add` or `loadout route` indexes the rest' });
    expect(index.detail).toMatch(/^0 of [1-9]\d* indexed$/);
    vi.doUnmock('../src/embed.js');
  });

  it.each([false, true])('recognises the hooks setup generates (WSL: %s)', async (windows) => {
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', 'settings.json'), JSON.stringify(claudeHookSettings(windows)));
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), hostSetup('codex', windows).snippet);
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']!.detail).toMatch(/loadout: settings hook$/);
    expect(checks['Codex']!.detail).toMatch(/loadout: hook \(trust not checked: approve it once in \/hooks\) and search server$/);
  });

  it('ignores loadout mentioned only in comments or strings', async () => {
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), '# [mcp_servers.loadout]\n# command = "loadout hook codex"\nnotes = """\n[mcp_servers.loadout]\n"""\n');
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', 'settings.json'), JSON.stringify({ note: 'loadout hook claude' }));
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Codex']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up' });
    expect(checks['Claude Code']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up' });
  });

  it.each(['startup_timeout_sec = 20', 'command = ""', 'url = " "', 'command = "loadout"\nurl = "http://127.0.0.1:1"', 'command = "loadout"\nurl = ""'])('does not count a Codex server table that Codex cannot start (%s)', async (line) => {
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), `[mcp_servers.loadout]\n${line}\n`);
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Codex']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up' });
  });

  it('reports a malformed loadout config as a failed check and runs the rest on defaults', () => {
    mkdirSync(join(home, '.loadout'));
    writeFileSync(join(home, '.loadout', 'config.json'), '{ "jev": { "apiKeyFile": "/secret/path" ');
    const result = spawnSync(process.execPath, ['--import', 'tsx', join(import.meta.dirname, '../src/cli.ts'), 'doctor'], { encoding: 'utf8', env: { ...process.env } });
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/✗ config +config\.json is not valid JSON/);
    expect(result.stdout).toMatch(/library/);
    expect(result.stdout + result.stderr).not.toContain('/secret/path');
  });

  it('reports a hook that the host has switched off', async () => {
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', 'settings.json'), JSON.stringify({ ...claudeHookSettings(false), disableAllHooks: true }));
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), '[[hooks.UserPromptSubmit]]\n[[hooks.UserPromptSubmit.hooks]]\ntype = "command"\ncommand = "loadout hook codex"\n\n[features]\nhooks = false\n');
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: settings hook, but disableAllHooks in settings.json turns hooks off', fix: 'turn hooks back on' });
    expect(checks['Codex']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: hook, but [features] hooks = false in config.toml turns hooks off' });
  });

  it.skipIf(process.platform === 'win32')('runs no host CLI found through a relative PATH entry', async () => {
    const marker = join(home, 'ran');
    writeFileSync(join(home, 'bin', 'claude'), `#!/bin/sh\n: > '${marker}'\n`);
    chmodSync(join(home, 'bin', 'claude'), 0o755);
    vi.stubEnv('PATH', relative(process.cwd(), join(home, 'bin')));
    mkdirSync(join(home, 'claude'));
    const checks = byName(await doctor(config, () => okClient));
    expect(existsSync(marker)).toBe(false);
    expect(checks['Claude Code']!.detail).toMatch(/^CLI not on PATH;/);
  });

  it.skipIf(process.platform === 'win32')('gives a host CLI shim no relative PATH entry to resolve its interpreter through', async () => {
    const marker = join(home, 'ran');
    mkdirSync(join(home, 'planted'));
    writeFileSync(join(home, 'planted', 'fake-node'), `#!/bin/sh\n: > '${marker}'\n`);
    chmodSync(join(home, 'planted', 'fake-node'), 0o755);
    // Like `#!/usr/bin/env node`: the interpreter is looked up on PATH.
    writeFileSync(join(home, 'bin', 'claude'), '#!/bin/sh\nexec fake-node "$@"\n');
    chmodSync(join(home, 'bin', 'claude'), 0o755);
    vi.stubEnv('PATH', [relative(process.cwd(), join(home, 'planted')), join(home, 'bin')].join(delimiter));
    await doctor(config, () => okClient);
    expect(existsSync(marker)).toBe(false);
  });

  it.skipIf(process.platform === 'win32')('stops a version check that ignores SIGTERM', async () => {
    writeFileSync(join(home, 'bin', 'claude'), "#!/bin/sh\ntrap '' TERM\nwhile :; do sleep 1; done\n");
    chmodSync(join(home, 'bin', 'claude'), 0o755);
    const started = Date.now();
    const checks = byName(await doctor(config, () => okClient));
    expect(Date.now() - started).toBeLessThan(15_000);
    expect(checks['Claude Code']!.detail).toMatch(/^version unknown;/);
  }, 30_000);

  it('does not count a hook entry without type = "command"', async () => {
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), '[[hooks.UserPromptSubmit]]\n[[hooks.UserPromptSubmit.hooks]]\ncommand = "loadout hook codex"\n');
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Codex']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up' });
  });

  it('does not count another tool that has a hook subcommand', async () => {
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), '[[hooks.UserPromptSubmit]]\n[[hooks.UserPromptSubmit.hooks]]\ntype = "command"\ncommand = "other-tool hook codex"\n');
    expect(byName(await doctor(config, () => okClient))['Codex']!.detail).toBe('CLI not on PATH; loadout: not set up');
  });

  it('finishes with a malformed jev.baseUrl', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', KEY);
    const bad = { ...config, jev: { ...config.jev, baseUrl: 'not a url' } };
    const checks = byName(await doctor(bad, (apiKey) => jevClient({ apiKey, baseUrl: bad.jev.baseUrl, model: 'fake', retries: 0 })));
    expect(checks['Jev call']).toMatchObject({ ok: false, detail: 'Jev request failed: network error' });
    expect(checks['library']).toBeDefined();
  });

  it('flags a host that is installed but has no loadout', async () => {
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), 'model = "gpt-6.1-sol"\n');
    expect(byName(await doctor(config, () => okClient))['Codex']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up', fix: 'loadout setup codex' });
  });
});
