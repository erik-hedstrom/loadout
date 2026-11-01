import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';
import { claudeHookBlock, hostSetup, SEARCH_TOOLS } from '../src/launch.js';

const ROOT = join(import.meta.dirname, '..');

describe('Claude Code plugin', () => {
  it('ships the same hook block as the settings snippet, running loadout from PATH', () => {
    const hooks = JSON.parse(readFileSync(join(ROOT, 'plugins/loadout/hooks/hooks.json'), 'utf8'));
    expect(hooks).toEqual(claudeHookBlock('loadout hook claude'));
  });

  it('ships a marketplace plugin with the hook and the search server, and no bin/', () => {
    const marketplace = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
    expect(marketplace.name).toBe('loadout');
    expect(marketplace.plugins).toEqual([{ name: 'loadout', source: './plugins/loadout' }]);
    const entry = marketplace.plugins[0];
    const dir = join(ROOT, entry.source);
    const plugin = JSON.parse(readFileSync(join(dir, '.claude-plugin/plugin.json'), 'utf8'));
    expect(plugin.name).toBe('loadout');
    expect(plugin.description).toContain("find_tools goals and keywords, with file names from the folder the host starts the server in");
    // The server is declared once, in .mcp.json; `mcpServers` here would merge a second definition over it.
    for (const key of ['version', 'mcpServers', 'userConfig']) expect(plugin).not.toHaveProperty(key);
    expect(existsSync(join(dir, 'bin'))).toBe(false);
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false);
  });

  // Claude Code gives a stdio server the user's environment (TYPESAFE_API_KEY, LOADOUT_HOME), so the file
  // carries no `env` and no credential. It defines no way for a plugin to pre-approve tools.
  it('declares only `loadout mcp` in .mcp.json, with no env or approval settings', () => {
    expect(JSON.parse(readFileSync(join(ROOT, 'plugins/loadout/.mcp.json'), 'utf8'))).toEqual({
      mcpServers: { loadout: { command: 'loadout', args: ['mcp'] } },
    });
  });

  it('starts the declared server without printing the key, and lists find_tools and load_skill', async () => {
    const home = mkdtempSync(join(tmpdir(), 'loadout-plugin-mcp-'));
    const key = 'd13-secret-canary';
    const skill = join(home, 'library/skills/canary');
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, 'SKILL.md'), '---\nname: canary\ndescription: Test skill\n---\nReference text.');
    writeFileSync(join(home, 'config.json'), JSON.stringify({ router: 'lexical' }));
    const declared = JSON.parse(readFileSync(join(ROOT, 'plugins/loadout/.mcp.json'), 'utf8')).mcpServers.loadout as { args: string[] };
    // The checkout's code stands in for the `loadout` on PATH that Claude Code would run.
    const transport = new StdioClientTransport({
      command: process.execPath, args: ['--import', 'tsx', join(ROOT, 'src/cli.ts'), ...declared.args],
      env: { LOADOUT_HOME: home, TYPESAFE_API_KEY: key }, stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk) => { stderr += chunk; });
    const client = new Client({ name: 'plugin-test', version: '1' });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools.map((t) => t.name)).toEqual(SEARCH_TOOLS);
      const loaded = await client.callTool({ name: 'load_skill', arguments: { skill: 'canary' } });
      expect(JSON.stringify([tools, loaded, client.getServerVersion(), client.getInstructions()])).not.toContain(key);
    } finally {
      await client.close();
      rmSync(home, { recursive: true, force: true });
    }
    expect(stderr).not.toContain(key);
  });

});

describe('Codex plugin', () => {
  it('ships a Codex-only marketplace with the prompt hook and search server', () => {
    const marketplace = JSON.parse(readFileSync(join(ROOT, '.agents/plugins/marketplace.json'), 'utf8'));
    expect(marketplace.name).toBe('loadout');
    expect(marketplace.description).toContain("TypeSafe's Jev API");
    expect(marketplace.plugins).toEqual([{ name: 'loadout-codex', source: './plugins/loadout-codex' }]);
    const claudeMarketplace = JSON.parse(readFileSync(join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
    expect(claudeMarketplace.plugins.some((entry: { name: string }) => entry.name === 'loadout-codex')).toBe(false);
    const dir = join(ROOT, marketplace.plugins[0].source);
    const plugin = JSON.parse(readFileSync(join(dir, '.codex-plugin/plugin.json'), 'utf8'));
    expect(plugin.name).toBe('loadout-codex');
    expect(plugin.description).toContain("TypeSafe's Jev API");
    expect(plugin.description).toContain("find_tools goals and keywords, with file names from the folder the host starts the server in");
    expect(JSON.parse(readFileSync(join(dir, 'hooks/hooks.json'), 'utf8'))).toEqual(claudeHookBlock('loadout hook codex'));
    // No `required`: Codex would accept it, but users cannot override it for a plugin server (D17).
    expect(JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8'))).toEqual({
      mcpServers: {
        loadout: {
          command: 'loadout', args: ['mcp'], env_vars: ['TYPESAFE_API_KEY', 'TYPESAFE_BASE_URL', 'LOADOUT_HOME'],
          tools: Object.fromEntries(SEARCH_TOOLS.map((tool) => [tool, { approval_mode: 'approve' }])),
        },
      },
    });
  });

  it('prints plugin installation, privacy and hook trust instructions for native Codex', () => {
    const { where, snippet } = hostSetup('codex', false);
    expect(where).toContain('loadout on PATH and Node 22.12+');
    expect(where).toContain('/hooks');
    expect(where).toContain('install checked offline with 0.160.1');
    expect(where).toContain('live hook untested (D2)');
    expect(snippet).toContain('codex plugin marketplace add erik-hedstrom/loadout\ncodex plugin add loadout-codex@loadout');
    expect(snippet).toContain('every project (user scope)');
    expect(snippet).toContain("each routed prompt, with the repository's top-level file names and dependency names, to TypeSafe's Jev API");
    expect(snippet).toContain('"router": "lexical"');
    expect(snippet).toContain("the agent's goal and keywords and the top-level file names of the folder the host starts it in");
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
