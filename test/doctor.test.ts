import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, type Config } from '../src/config.js';
import { doctor, formatDoctor } from '../src/doctor.js';
import { jevClient, type SystemOneClient } from '../src/jev.js';

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

  it.skipIf(process.platform === 'win32')('passes when everything is set up, and never prints the key', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', KEY);
    cpSync(join(import.meta.dirname, 'fixtures', 'library'), join(home, '.loadout', 'library'), { recursive: true });
    for (const bin of ['loadout', 'claude', 'codex']) {
      writeFileSync(join(home, 'bin', bin), `#!/bin/sh\necho "${bin} 9.9.9"\n`);
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

  it('flags a host that is installed but has no loadout', async () => {
    mkdirSync(join(home, 'codex'));
    writeFileSync(join(home, 'codex', 'config.toml'), 'model = "gpt-6.1-sol"\n');
    expect(byName(await doctor(config, () => okClient))['Codex']).toMatchObject({ ok: false, detail: 'CLI not on PATH; loadout: not set up', fix: 'loadout setup codex' });
  });
});
