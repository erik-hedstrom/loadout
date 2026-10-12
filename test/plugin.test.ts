import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { claudeHookBlock, hostSetup, SEARCH_TOOLS } from '../src/launch.js';

const ROOT = join(import.meta.dirname, '..');

describe('Claude Code plugin', () => {
  it('ships the same hook block as the settings snippet, running loadout from PATH', () => {
    const hooks = JSON.parse(readFileSync(join(ROOT, 'plugins/loadout/hooks/hooks.json'), 'utf8'));
    expect(hooks).toEqual(claudeHookBlock('loadout hook claude'));
  });

  it('ships a hook-only marketplace plugin', () => {
    const marketplace = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
    expect(marketplace.name).toBe('loadout');
    expect(marketplace.plugins).toHaveLength(2);
    const entry = marketplace.plugins[0];
    expect(entry.name).toBe('loadout');
    expect(entry.source).toBe('./plugins/loadout');
    const dir = join(ROOT, entry.source);
    const plugin = JSON.parse(readFileSync(join(dir, '.claude-plugin/plugin.json'), 'utf8'));
    expect(plugin.name).toBe('loadout');
    for (const key of ['version', 'mcpServers', 'userConfig']) expect(plugin).not.toHaveProperty(key);
    expect(existsSync(join(dir, 'bin'))).toBe(false);
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false);
  });
});

describe('Codex plugin', () => {
  it('ships a Codex entry in the shared marketplace with the prompt hook and search server', () => {
    const marketplace = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
    expect(marketplace.name).toBe('loadout');
    expect(marketplace.plugins).toContainEqual({ name: 'loadout-codex', source: './plugins/loadout-codex' });
    const dir = join(ROOT, marketplace.plugins.find((entry: { name: string }) => entry.name === 'loadout-codex').source);
    const plugin = JSON.parse(readFileSync(join(dir, '.codex-plugin/plugin.json'), 'utf8'));
    expect(plugin.name).toBe('loadout-codex');
    expect(plugin.description).toContain("TypeSafe's Jev API");
    expect(JSON.parse(readFileSync(join(dir, 'hooks/hooks.json'), 'utf8'))).toEqual(claudeHookBlock('loadout hook codex'));
    expect(JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'))).toEqual({
      mcpServers: {
        loadout: {
          command: 'loadout', args: ['mcp'], env_vars: ['TYPESAFE_API_KEY'],
          tools: Object.fromEntries(SEARCH_TOOLS.map((tool) => [tool, { approval_mode: 'approve' }])),
        },
      },
    });
  });

  it('prints plugin installation, privacy and hook trust instructions for native Codex', () => {
    const { where, snippet } = hostSetup('codex', false);
    expect(where).toContain('loadout on PATH and Node 22.12+');
    expect(where).toContain('/hooks');
    expect(snippet).toContain('codex plugin marketplace add erik-hedstrom/loadout\ncodex plugin add loadout-codex@loadout');
    expect(snippet).not.toContain('[mcp_servers.');
    expect(snippet).not.toContain('[[hooks.');
    expect(snippet).not.toContain('codex mcp add');
    const notice = snippet.split('\n')[0]!;
    expect(notice).toContain('every project (user scope)');
    expect(notice).toContain("each routed prompt, with the repository's top-level file names and dependency names, to TypeSafe's Jev API");
    expect(notice).toContain('"router": "lexical"');
    expect(snippet.indexOf('codex plugin marketplace add')).toBeGreaterThan(notice.length);
  });

  it.each([false, true])('setup never prints credentials or a configured key file, or edits host configs (WSL=%s)', (windows) => {
    const home = mkdtempSync(join(tmpdir(), 'loadout-codex-setup-'));
    const key = 'd12-secret-canary';
    const keyFile = join(home, 'd12-private-key-file.txt');
    const configFile = join(home, 'config.json');
    const config = JSON.stringify({ jev: { apiKeyFile: keyFile } });
    writeFileSync(configFile, config);
    try {
      const result = spawnSync(process.execPath, ['--import', 'tsx', join(ROOT, 'src/cli.ts'), 'setup', 'codex', ...(windows ? ['--windows'] : [])], {
        encoding: 'utf8',
        env: { ...process.env, LOADOUT_HOME: home, HOME: home, USERPROFILE: home, CODEX_HOME: join(home, '.codex'), TYPESAFE_API_KEY: key, WSL_DISTRO_NAME: '' },
      });
      expect(result.status, result.stderr).toBe(0);
      for (const secret of [key, keyFile, 'd12-private-key-file.txt', 'apiKeyFile']) {
        expect(result.stdout + result.stderr).not.toContain(secret);
      }
      expect(result.stdout).toContain("TypeSafe's Jev API");
      expect(readFileSync(configFile, 'utf8')).toBe(config);
      for (const dir of ['.codex', '.claude', '.agents']) expect(existsSync(join(home, dir))).toBe(false);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
