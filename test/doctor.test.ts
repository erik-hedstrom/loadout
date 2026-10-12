import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type Config } from '../src/config.js';
import { doctor, formatDoctor } from '../src/doctor.js';
import { jevClient, type SystemOneClient } from '../src/jev.js';
import { claudeHookSettings, hookCommand, hostSetup } from '../src/launch.js';

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

  it.each([false, true])('recognises manual native and generated WSL hook configs (WSL: %s)', async (windows) => {
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', 'settings.json'), JSON.stringify(claudeHookSettings(windows)));
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), windows ? hostSetup('codex', true).snippet : [
      '[mcp_servers.loadout]', 'command = "loadout"', 'args = ["mcp"]',
      '[[hooks.UserPromptSubmit]]', '[[hooks.UserPromptSubmit.hooks]]',
      'type = "command"', `command = ${JSON.stringify(hookCommand('codex', false))}`,
    ].join('\n'));
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']!.detail).toMatch(/loadout: settings hook$/);
    expect(checks['Codex']!.detail).toMatch(/loadout: hook \(trust not checked: approve it once in \/hooks\) and search server$/);
  });

  it('recognises a plugin-only Codex install without exposing or editing config contents', async () => {
    mkdirSync(join(home, 'codex'));
    const file = join(home, 'codex', 'config.toml');
    const content = `[plugins."loadout-codex@loadout"]\nenabled = true\nprivate = "${KEY}"\n`;
    writeFileSync(file, content);
    const checks = await doctor(config, () => okClient);
    expect(byName(checks)['Codex']).toMatchObject({
      ok: true,
      detail: 'CLI not on PATH; loadout: plugin enabled (hook trust not verifiable from config: approve it in /hooks)',
    });
    expect(formatDoctor(checks)).not.toContain(KEY);
    expect(readFileSync(file, 'utf8')).toBe(content);
  });

  it.each([
    '[plugins."loadout-codex@loadout"]\nenabled = false\n',
    '[plugins."loadout@loadout"]\nenabled = true\n',
    '[plugins."loadout-codex@loadout"]\nenabled = true\n[features]\nplugins = false\n',
  ])('does not count a disabled or invalid Codex plugin config (%s)', async (content) => {
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), content);
    expect(byName(await doctor(config, () => okClient))['Codex']).toMatchObject({
      ok: false, detail: 'CLI not on PATH; loadout: not set up',
    });
  });

  it.each([false, true])('fails a Codex plugin with hooks disabled (search disabled: %s)', async (searchOff) => {
    mkdirSync(join(home, 'codex'));
    const file = join(home, 'codex', 'config.toml');
    const content = `[plugins."loadout-codex@loadout"]\nenabled = true\n[plugins."loadout-codex@loadout".mcp_servers.loadout]\nenabled = ${!searchOff}\n[features]\nhooks = false\n[mcp_servers.loadout]\ncommand = "loadout"\n`;
    writeFileSync(file, content);
    expect(byName(await doctor(config, () => okClient))['Codex']).toMatchObject({
      ok: false,
      detail: `CLI not on PATH; loadout: plugin enabled, but [features] hooks = false in config.toml turns hooks off${searchOff ? '; search off (plugin policy)' : ''}`,
      fix: 'turn hooks back on',
    });
    expect(readFileSync(file, 'utf8')).toBe(content);
  });

  it('reports disabled plugin search without failing Codex routing', async () => {
    mkdirSync(join(home, 'codex'));
    const file = join(home, 'codex', 'config.toml');
    const content = `[plugins."loadout-codex@loadout"]\nenabled = true\n[plugins."loadout-codex@loadout".mcp_servers.loadout]\nenabled = false\nprivate = "${KEY}"\n`;
    writeFileSync(file, content);
    const checks = await doctor(config, () => okClient);
    expect(byName(checks)['Codex']).toMatchObject({
      ok: true,
      detail: 'CLI not on PATH; loadout: plugin enabled (hook trust not verifiable from config: approve it in /hooks) and search off (plugin policy)',
    });
    expect(formatDoctor(checks)).not.toContain(KEY);
    expect(readFileSync(file, 'utf8')).toBe(content);
  });

  it.each([
    String.raw`C:\x\dist\cli.js`,
    String.raw`'C:\Program Files\x\dist\cli.js'`,
    String.raw`C:\x\dist\cli.ts`,
    String.raw`'C:\Program Files\x\dist\cli.ts'`,
  ])('recognises a literal Windows hook path (%s)', async (path) => {
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', 'settings.json'), JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: `${path} hook claude` }] }] } }));
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), `[[hooks.UserPromptSubmit]]\n[[hooks.UserPromptSubmit.hooks]]\ntype = "command"\ncommand = ${JSON.stringify(`${path} hook codex`)}\n`);
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']).toMatchObject({ ok: true, detail: 'CLI not on PATH; loadout: settings hook' });
    expect(checks['Codex']).toMatchObject({ ok: true, detail: 'CLI not on PATH; loadout: hook (trust not checked: approve it once in /hooks)' });
  });

  it.each([false, true])('counts a Claude user search server without settings (default config directory: %s)', async (defaultDir) => {
    if (defaultDir) vi.stubEnv('CLAUDE_CONFIG_DIR', '');
    const dir = defaultDir ? home : join(home, 'claude');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.claude.json'), JSON.stringify({ mcpServers: { loadout: { command: 'loadout' } } }));
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']).toMatchObject({ ok: true, detail: 'CLI not on PATH; loadout: search server' });
  });

  it('counts a Claude user search server using a URL', async () => {
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', '.claude.json'), JSON.stringify({ mcpServers: { loadout: { url: 'https://example.invalid/mcp' } } }));
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']).toMatchObject({ ok: true, detail: 'CLI not on PATH; loadout: search server' });
  });

  it.each([{ type: 'stdio' }, 'wrong', null, [], { command: '' }, { url: ' ' }, { command: 42, url: false }].map((server) => ({ server })))('does not count an unusable Claude user search server (%j)', async ({ server }) => {
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', '.claude.json'), JSON.stringify({ mcpServers: { loadout: server } }));
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up' });
  });

  it('ignores project-scoped Claude search servers', async () => {
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', '.claude.json'), JSON.stringify({ projects: { [home]: { mcpServers: { loadout: { command: 'loadout' } } } } }));
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up' });
  });

  it('reports a malformed Claude user MCP config without exposing its contents', async () => {
    const secret = 'claude-broken-config-canary';
    mkdirSync(join(home, 'claude'));
    const file = join(home, 'claude', '.claude.json');
    writeFileSync(file, `{ "account": "${secret}", "mcpServers": `);
    const checks = await doctor(config, () => okClient);
    expect(byName(checks)['Claude Code']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: config cannot be read or parsed', fix: `repair ${file}` });
    expect(formatDoctor(checks)).not.toContain(secret);
    // A half-written .claude.json does not hide a plugin that works.
    writeFileSync(join(home, 'claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'loadout@loadout': true } }));
    const withPlugin = await doctor(config, () => okClient);
    expect(byName(withPlugin)['Claude Code']).toMatchObject({ ok: true, detail: 'CLI not on PATH; loadout: plugin enabled' });
    expect(formatDoctor(withPlugin)).not.toContain(secret);
  });

  it('never prints credentials from Claude user MCP config', async () => {
    const secret = 'claude-config-secret-canary';
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', '.claude.json'), JSON.stringify({ account: secret, mcpServers: { loadout: { command: 'loadout', env: { TOKEN: secret } } } }));
    const checks = await doctor(config, () => okClient);
    expect(byName(checks)['Claude Code']).toMatchObject({ ok: true, detail: 'CLI not on PATH; loadout: search server' });
    expect(formatDoctor(checks)).not.toContain(secret);
  });

  it.each([false, true])('lists active Claude attachments with a search server (hooks disabled: %s)', async (disableAllHooks) => {
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'loadout@loadout': true }, hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'loadout hook claude' }] }] }, disableAllHooks }));
    writeFileSync(join(home, 'claude', '.claude.json'), JSON.stringify({ mcpServers: { loadout: { command: 'loadout' } } }));
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']).toMatchObject({ ok: true, detail: `CLI not on PATH; loadout: ${disableAllHooks ? 'search server' : 'plugin enabled and settings hook and search server'}` });
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

  it.skipIf(process.platform === 'win32')('ignores binaries found through a relative PATH entry', async () => {
    const marker = join(home, 'ran');
    writeFileSync(join(home, 'bin', 'claude'), `#!/bin/sh\n: > '${marker}'\n`);
    chmodSync(join(home, 'bin', 'claude'), 0o755);
    vi.stubEnv('PATH', relative(process.cwd(), join(home, 'bin')));
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'bin', 'loadout'), '#!/bin/sh\n');
    chmodSync(join(home, 'bin', 'loadout'), 0o755);
    const checks = byName(await doctor(config, () => okClient));
    expect(existsSync(marker)).toBe(false);
    expect(checks['Claude Code']!.detail).toMatch(/^CLI not on PATH;/);
    // The hook runs loadout by name from another folder, where a relative entry finds nothing.
    expect(checks['loadout on PATH']).toMatchObject({ ok: false, detail: 'not found' });
  });

  it.skipIf(process.platform === 'win32')('finds the install in an absolute PATH entry behind a relative one', async () => {
    const marker = join(home, 'ran');
    mkdirSync(join(home, 'planted'));
    for (const bin of ['claude', 'loadout']) {
      writeFileSync(join(home, 'planted', bin), `#!/bin/sh\n: > '${marker}'\n`);
      chmodSync(join(home, 'planted', bin), 0o755);
    }
    writeFileSync(join(home, 'bin', 'claude'), '#!/bin/sh\necho 9.9.9\n');
    writeFileSync(join(home, 'bin', 'loadout'), '#!/bin/sh\n');
    chmodSync(join(home, 'bin', 'claude'), 0o755);
    chmodSync(join(home, 'bin', 'loadout'), 0o755);
    vi.stubEnv('PATH', [relative(process.cwd(), join(home, 'planted')), join(home, 'bin')].join(delimiter));
    const checks = byName(await doctor(config, () => okClient));
    expect(existsSync(marker)).toBe(false);
    expect(checks['loadout on PATH']).toMatchObject({ ok: true, detail: join(home, 'bin', 'loadout') });
    expect(checks['Claude Code']!.detail).toMatch(/^9\.9\.9;/);
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

  it('reads a Codex server entry that is not a table as not set up', async () => {
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), 'mcp_servers = { loadout = "wrong" }\n');
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Codex']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up' });
  });

  it('tells a broken host config apart from a missing one', async () => {
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', 'settings.json'), '{ "enabledPlugins": ');
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), '[mcp_servers.loadout\n');
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: config cannot be read or parsed', fix: `repair ${join(home, 'claude', 'settings.json')}` });
    expect(checks['Codex']).toMatchObject({ ok: false, fix: `repair ${join(home, 'codex', 'config.toml')}` });
  });

  it('does not count a hook entry without type = "command"', async () => {
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), '[[hooks.UserPromptSubmit]]\n[[hooks.UserPromptSubmit.hooks]]\ncommand = "loadout hook codex"\n');
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Codex']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up' });
  });

  it.each(['other-tool', 'othercli.js', String.raw`C:\x\dist\othercli.js`])('does not count another tool that has a hook subcommand (%s)', async (tool) => {
    mkdirSync(join(home, 'claude'));
    writeFileSync(join(home, 'claude', 'settings.json'), JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: `${tool} hook claude` }] }] } }));
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), `[[hooks.UserPromptSubmit]]\n[[hooks.UserPromptSubmit.hooks]]\ntype = "command"\ncommand = ${JSON.stringify(`${tool} hook codex`)}\n`);
    const checks = byName(await doctor(config, () => okClient));
    expect(checks['Claude Code']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up' });
    expect(checks['Codex']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up' });
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
