import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { audit, formatAudit } from '../src/audit.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { createServer } from '../src/mcp.js';

let home: string;
let project: string;
const cli = resolve('src/cli.ts');
function file(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
function skill(root: string, name: string, description = 'abcd') {
  file(join(root, name, 'SKILL.md'), `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\n---\nUncounted body\n`);
}
function json(path: string, value: unknown) {
  file(path, JSON.stringify(value));
}
function run(...args: string[]) {
  return spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), cli, 'audit', ...args], { cwd: project, env: process.env, encoding: 'utf8' });
}
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'loadout-audit-'));
  project = join(home, 'repo');
  mkdirSync(join(project, '.git'), { recursive: true });
  vi.stubEnv('HOME', home);
  vi.stubEnv('USERPROFILE', home);
  vi.stubEnv('CLAUDE_CONFIG_DIR', join(home, 'claude-custom'));
  vi.stubEnv('CODEX_HOME', join(home, 'codex-custom'));
  vi.stubEnv('XDG_CONFIG_HOME', join(home, '.config'));
  vi.stubEnv('LOADOUT_HOME', join(home, '.loadout'));
  vi.stubEnv('OPENCODE_CONFIG', '');
  vi.stubEnv('OPENCODE_CONFIG_DIR', '');
  vi.stubEnv('OPENCODE_CONFIG_CONTENT', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

describe('audit', () => {
  it('covers all hosts, compatibility skill directories and project MCP overrides without writing', async () => {
    skill(join(home, 'claude-custom', 'skills'), 'user');
    skill(join(home, '.claude', 'skills'), 'compat');
    skill(join(project, '.claude', 'skills'), 'project');
    skill(join(home, 'codex-custom', 'skills'), 'codex');
    skill(join(home, '.agents', 'skills'), 'shared');
    skill(join(project, '.agents', 'skills'), 'repo');
    skill(join(home, '.config', 'opencode', 'skills'), 'open');
    skill(join(project, '.opencode', 'skills'), 'local');
    skill(join(home, '.cursor', 'skills'), 'cursor');
    skill(join(project, '.cursor', 'skills'), 'editor');
    json(join(home, '.claude.json'), { mcpServers: { global: { env: { KEY: 'SECRET' } } }, projects: { [project]: { mcpServers: { local: {}, global: {} } }, elsewhere: { mcpServers: { ignored: {} } } } });
    json(join(project, '.mcp.json'), { mcpServers: { local: {}, project: {} } });
    file(join(home, 'codex-custom', 'config.toml'), '[mcp_servers.one]\ncommand="SECRET"\n[mcp_servers.one.env]\nKEY="SECRET"\n[mcp_servers."two.dot"]\nurl="SECRET"\n');
    json(join(home, '.config', 'opencode', 'opencode.json'), { mcp: { open: { type: 'local', command: ['SECRET'] } } });
    file(join(project, 'opencode.jsonc'), '{ // comment\n"mcp": {"local": {"url": "https://SECRET",},},}');
    json(join(home, '.cursor', 'mcp.json'), { mcpServers: { cursor: { headers: { Authorization: 'SECRET' } } } });
    json(join(project, '.cursor', 'mcp.json'), { mcpServers: { cursor: {}, editor: {} } });
    const result = await audit(project);
    const hosts = Object.fromEntries(result.hosts.map((h) => [h.host, h]));
    expect(hosts['Claude Code']?.skills.map((s) => s.name).sort()).toEqual(['project', 'user']);
    expect(hosts.Codex?.skills.map((s) => s.name).sort()).toEqual(['codex', 'repo', 'shared']);
    expect(hosts.OpenCode?.skills.map((s) => s.name).sort()).toEqual(['compat', 'local', 'open', 'project', 'repo', 'shared']);
    expect(hosts.Cursor?.skills.map((s) => s.name).sort()).toEqual(['compat', 'cursor', 'editor', 'project']);
    expect(hosts['Claude Code']?.servers.map((s) => s.name).sort()).toEqual(['global', 'local', 'project']);
    expect(hosts.Codex?.servers.map((s) => s.name).sort()).toEqual(['one', 'two.dot']);
    expect(hosts.OpenCode?.servers).toHaveLength(2);
    expect(hosts.Cursor?.servers).toHaveLength(2);
    expect(result.hosts.flatMap((h) => h.servers).every((s) => s.schemaTokens === null)).toBe(true);
    expect(JSON.stringify(result) + formatAudit(result)).not.toContain('SECRET');
    expect(existsSync(join(home, '.loadout'))).toBe(false);
  });

  it('includes only enabled applicable Claude plugins, namespaced skills, commands, agents and MCP', async () => {
    const plugin = join(home, 'plugins', 'pack');
    skill(join(plugin, 'skills'), 'folded', 'Use this skill.');
    file(join(plugin, 'commands', 'do.md'), '---\ndescription: Do a thing\n---\nDo not count this body');
    file(join(plugin, 'agents', 'helper.md'), '---\nname: helper\ndescription: Help with a thing\n---\nHidden body');
    json(join(plugin, '.mcp.json'), { mcpServers: { tools: { env: { TOKEN: 'SECRET' } } } });
    skill(join(home, 'plugins', 'disabled', 'skills'), 'disabled');
    skill(join(home, 'plugins', 'other', 'skills'), 'other');
    json(join(home, 'claude-custom', 'plugins', 'installed_plugins.json'), { version: 2, plugins: {
      'pack@market': [{ scope: 'user', installPath: plugin }],
      'disabled@market': [{ scope: 'user', installPath: join(home, 'plugins', 'disabled') }],
      'other@market': [{ scope: 'project', projectPath: join(home, 'other-project'), installPath: join(home, 'plugins', 'other') }],
    } });
    json(join(home, 'claude-custom', 'settings.json'), { enabledPlugins: { 'pack@market': true, 'disabled@market': true, 'other@market': true } });
    json(join(project, '.claude', 'settings.json'), { enabledPlugins: { 'disabled@market': false } });
    const host = (await audit(project)).hosts[0]!;
    expect(host.skills.map((s) => s.name)).toEqual(['pack:folded']);
    expect(host.listings.map((s) => s.name).sort()).toEqual(['pack:do', 'pack:helper']);
    expect(host.servers.map((s) => s.name)).toEqual(['plugin:pack:tools']);
    expect(host.estimatedTokens).toBeGreaterThan(host.skills[0]!.tokens);
  });

  it('counts Cursor rule descriptions and always-on bodies separately from conditional bodies', async () => {
    file(join(project, '.cursor', 'rules', 'always.mdc'), '---\nalwaysApply: true\n---\nabcdefgh');
    file(join(project, '.cursor', 'rules', 'requested.mdc'), '---\ndescription: abcd\nalwaysApply: false\n---\n' + 'x'.repeat(1000));
    file(join(project, '.cursor', 'rules', 'conditional.mdc'), '---\nglobs: "*.ts"\n---\n' + 'x'.repeat(1000));
    file(join(project, '.cursorrules'), 'abcd');
    const cursor = (await audit(project)).hosts.find((h) => h.host === 'Cursor')!;
    expect(cursor.rules.map((r) => [r.name, r.tokens])).toEqual([['.cursorrules', 1], ['always', 2], ['conditional', null], ['requested', 4]]);
    expect(cursor.estimatedTokens).toBe(7);
  });

  it('does not miscount TOML nested tables, comments or multiline strings as servers', async () => {
    file(join(home, 'codex-custom', 'config.toml'), `notes = """\n[mcp_servers.fake]\n"""\n# [mcp_servers.comment]\n[ mcp_servers . 'real.dot' ] # note\ncommand = "#not-comment"\n[mcp_servers.'real.dot'.http_headers]\nTOKEN="SECRET"\n[mcp_servers.off]\nenabled = false\n[mcp_servers.off.env]\nenabled = "true"\n[mcp_servers."quo\\\"te"]\nurl="SECRET"\n`);
    const host = (await audit(project)).hosts.find((h) => h.host === 'Codex')!;
    expect(host.servers.map((s) => s.name).sort()).toEqual(['quo"te', 'real.dot']);
  });

  it('rejects escaped skill symlinks and strips terminal controls from third-party listings', async () => {
    const root = join(home, 'claude-custom', 'skills');
    file(join(root, 'safe', 'SKILL.md'), '---\nname: "safe\\u001b[31m\\u202e"\ndescription: "text\\n\\u0007description"\n---\n');
    skill(join(home, 'outside'), 'escaped');
    mkdirSync(join(root, 'manifest-link'), { recursive: true });
    symlinkSync(join(home, 'outside', 'escaped', 'SKILL.md'), join(root, 'manifest-link', 'SKILL.md'));
    symlinkSync(join(home, 'outside', 'escaped'), join(root, 'directory-link'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = await audit(project);
    expect(result.hosts[0]!.skills).toHaveLength(1);
    expect(formatAudit(result)).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202e]/);
    expect(JSON.stringify(result)).not.toContain('escaped');
  });

  it('uses real serialized tools and the three largest descriptions for a bounded comparison', async () => {
    for (const [name, description] of [['a', 'abc'], ['b', 'abcdefg'], ['c', 'abcdefghijk'], ['d', 'abcdefghijklmno']]) skill(join(home, 'claude-custom', 'skills'), name!, description!);
    const result = await audit(project);
    const { server, gateway } = createServer({ library: [], config: DEFAULT_CONFIG });
    const client = new Client({ name: 'audit-test', version: '1' });
    const [left, right] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(right);
      await client.connect(left);
      const tools = (await client.listTools()).tools;
      expect(result.loadout.toolTokens).toBe(Math.ceil(JSON.stringify(tools).length / 4));
      expect(result.loadout.skillTokens).toBe(12);
      expect(result.loadout.pickedSkills).toBe(3);
      expect(result.loadout.estimatedTokens).toBe(result.loadout.toolTokens + 12);
    } finally {
      await client.close();
      await server.close();
      await gateway.close();
    }
  });

  it('adopts through safe add, keeps provenance and resources, and leaves host files untouched', async () => {
    const root = join(home, 'claude-custom', 'skills');
    skill(root, 'adopted');
    file(join(root, 'adopted', 'reference.txt'), 'kept');
    file(join(root, 'adopted', 'run.js'), 'throw new Error("must not execute")');
    file(join(home, 'outside.txt'), 'SECRET');
    symlinkSync(join(home, 'outside.txt'), join(root, 'adopted', 'escape.txt'));
    const before = readFileSync(join(root, 'adopted', 'SKILL.md'), 'utf8');
    const result = await audit(project, true);
    expect(result.adopted).toEqual({ added: 1, updated: 0, skipped: 0 });
    const destination = join(home, '.loadout', 'library', 'skills', 'adopted');
    expect(readFileSync(join(destination, 'reference.txt'), 'utf8')).toBe('kept');
    expect(existsSync(join(destination, 'escape.txt'))).toBe(false);
    expect(JSON.parse(readFileSync(join(destination, '.loadout-source.json'), 'utf8')).origin).toBe(join(root, 'adopted'));
    expect(readFileSync(join(root, 'adopted', 'SKILL.md'), 'utf8')).toBe(before);
    expect(readdirSync(join(home, '.loadout'))).toEqual(['library']);
    expect(formatAudit(result)).toMatch(/Disable|disable/);
    expect((await audit(project, true)).adopted).toEqual({ added: 0, updated: 1, skipped: 0 });
  });

  it('refuses adoption through a redirected loadout directory or an outside LOADOUT_HOME', async () => {
    skill(join(home, 'claude-custom', 'skills'), 'safe');
    const outside = join(home, 'outside');
    mkdirSync(outside);
    vi.stubEnv('LOADOUT_HOME', outside);
    await expect(audit(project, true)).rejects.toThrow(/under ~\/\.loadout/);
    expect(readdirSync(outside)).toEqual([]);
    vi.stubEnv('LOADOUT_HOME', join(home, '.loadout'));
    symlinkSync(outside, join(home, '.loadout'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(audit(project, true)).rejects.toThrow(/symlink/);
    expect(readdirSync(outside)).toEqual([]);
  });

  it('CLI JSON is parseable, secret-free and adoption writes only in the fake loadout home', () => {
    skill(join(home, 'codex-custom', 'skills'), 'safe');
    file(join(home, 'codex-custom', 'config.toml'), '[mcp_servers.secret]\nhttp_headers={ Authorization="TOP-SECRET" }\n');
    json(join(home, '.claude.json'), { mcpServers: { secret: { env: { KEY: 'TOP-SECRET' } } } });
    const scanned = run('--json');
    expect(scanned.status, scanned.stderr).toBe(0);
    expect(JSON.parse(scanned.stdout).hosts).toHaveLength(4);
    expect(scanned.stdout + scanned.stderr).not.toContain('TOP-SECRET');
    expect(existsSync(join(home, '.loadout'))).toBe(false);
    const adopted = run('--json', '--adopt');
    expect(adopted.status, adopted.stderr).toBe(0);
    expect(JSON.parse(adopted.stdout).adopted.added).toBe(1);
    expect(existsSync(join(home, '.loadout', 'library', 'skills', 'safe', 'SKILL.md'))).toBe(true);
  });

  it('reports unreadable configs without leaking parse errors or treating the scan as complete', async () => {
    file(join(home, '.claude.json'), '{ "TOKEN": "TOP-SECRET", broken');
    const result = await audit(project);
    expect(result.hosts[0]!.warnings.length).toBeGreaterThan(0);
    expect(JSON.stringify(result) + formatAudit(result)).not.toContain('TOP-SECRET');
    expect(result.caveats.join(' ')).toMatch(/cap|truncate/);
  });

  it('counts custom plugin command/agent files and direct Claude descriptions', async () => {
    const plugin = join(home, 'plugins', 'pack');
    file(join(plugin, 'extras', 'command.md'), '---\ndescription: command description\n---\nbody');
    file(join(plugin, 'extras', 'agent.md'), '---\nname: custom-agent\ndescription: agent description\n---\nbody');
    json(join(plugin, '.claude-plugin', 'plugin.json'), { commands: ['./extras/command.md'], agents: './extras/agent.md' });
    json(join(home, 'claude-custom', 'plugins', 'installed_plugins.json'), { plugins: { 'pack@market': [{ scope: 'user', installPath: plugin }] } });
    json(join(home, 'claude-custom', 'settings.json'), { enabledPlugins: { 'pack@market': true } });
    file(join(home, 'claude-custom', 'commands', 'user.md'), '---\ndescription: user command\n---\nbody');
    file(join(project, '.claude', 'agents', 'project.md'), '---\ndescription: project agent\n---\nbody');
    const host = (await audit(project)).hosts[0]!;
    expect(host.listings.map((s) => s.name).sort()).toEqual(['pack:command', 'pack:custom-agent', 'project', 'user']);
  });

  it('copies every host once, retaining colliding skill names and leaving host configs byte-identical', async () => {
    const roots = [join(home, 'claude-custom', 'skills'), join(home, 'codex-custom', 'skills'), join(home, '.config', 'opencode', 'skills'), join(home, '.cursor', 'skills')];
    for (const root of roots) skill(root, 'same');
    const configFile = join(home, '.cursor', 'mcp.json');
    json(configFile, { mcpServers: { tools: { env: { SECRET: 'do not print' } } } });
    const before = readFileSync(configFile);
    const result = await audit(project, true);
    expect(result.adopted?.added).toBe(4);
    expect(result.adopted?.updated).toBe(0);
    expect(readFileSync(configFile)).toEqual(before);
    expect(readdirSync(join(home, '.loadout', 'library', 'skills'))).toHaveLength(4);
  });

  it('never exposes invalid library MCP config values through CLI errors', () => {
    file(join(home, '.loadout', 'library', 'mcp.json'), '{"TOKEN":"TOP-SECRET",broken');
    const result = run('--json');
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain('TOP-SECRET');
  });

  it('finds project-scoped plugins and Claude project MCP entries when invoked from a subdirectory', async () => {
    const plugin = join(home, 'plugins', 'project');
    skill(join(plugin, 'skills'), 'project-plugin');
    json(join(home, 'claude-custom', 'plugins', 'installed_plugins.json'), { plugins: { 'pack@market': [{ scope: 'project', projectPath: project, installPath: plugin }] } });
    json(join(project, '.claude', 'settings.json'), { enabledPlugins: { 'pack@market': true } });
    json(join(home, '.claude.json'), { projects: { [project]: { mcpServers: { project: {} } } } });
    const nested = join(project, 'src');
    mkdirSync(nested);
    const host = (await audit(nested)).hosts[0]!;
    expect(host.skills.map((s) => s.name)).toEqual(['pack:project-plugin']);
    expect(host.servers.map((s) => s.name)).toEqual(['project']);
  });

  it('merges Codex project MCP tables, including overrides and disabled servers', async () => {
    file(join(home, 'codex-custom', 'config.toml'), '[mcp_servers.user]\ncommand="SECRET"\n[mcp_servers.overridden]\ncommand="SECRET"\n');
    file(join(project, '.codex', 'config.toml'), '[mcp_servers.project]\nurl="SECRET"\n[mcp_servers.overridden]\nenabled=false\n');
    const host = (await audit(project)).hosts.find((h) => h.host === 'Codex')!;
    expect(host.servers.map((s) => s.name).sort()).toEqual(['project', 'user']);
  });

  it('does not count a user skill twice when auditing outside a git repository', async () => {
    skill(join(home, '.claude', 'skills'), 'one');
    vi.stubEnv('CLAUDE_CONFIG_DIR', join(home, '.claude'));
    const host = (await audit(home)).hosts[0]!;
    expect(host.skills).toHaveLength(1);
  });

  it('includes loadout gateway definitions without executing a configured server', async () => {
    const sentinel = join(home, 'server-was-started');
    json(join(home, '.loadout', 'library', 'mcp.json'), { mcpServers: { canary: { gateway: true, command: process.execPath, args: ['-e', `require('fs').writeFileSync(${JSON.stringify(sentinel)}, 'bad')`], env: { TOKEN: 'TOP-SECRET' } } } });
    const result = await audit(project);
    rmSync(join(home, '.loadout', 'library', 'mcp.json'));
    const bare = await audit(project);
    expect(result.loadout.toolTokens).toBeGreaterThan(bare.loadout.toolTokens);
    expect(existsSync(sentinel)).toBe(false);
    expect(JSON.stringify(result) + formatAudit(result)).not.toContain('TOP-SECRET');
  });

  it('counts plugin MCP config arrays without exposing connection settings', async () => {
    const plugin = join(home, 'plugins', 'pack');
    json(join(plugin, 'one.json'), { mcpServers: { one: { url: 'TOP-SECRET' } } });
    json(join(plugin, 'two.json'), { mcpServers: { two: { env: { KEY: 'TOP-SECRET' } } } });
    json(join(plugin, '.claude-plugin', 'plugin.json'), { mcpServers: ['./one.json', './two.json'] });
    json(join(home, 'claude-custom', 'plugins', 'installed_plugins.json'), { plugins: { 'pack@market': [{ scope: 'user', installPath: plugin }] } });
    json(join(home, 'claude-custom', 'settings.json'), { enabledPlugins: { 'pack@market': true } });
    const result = await audit(project);
    expect(result.hosts[0]!.servers.map((s) => s.name).sort()).toEqual(['plugin:pack:one', 'plugin:pack:two']);
    expect(JSON.stringify(result) + formatAudit(result)).not.toContain('TOP-SECRET');
  });

  it('counts overlapping default and custom plugin descriptions only once', async () => {
    const plugin = join(home, 'plugins', 'pack');
    file(join(plugin, 'commands', 'review.md'), '---\ndescription: Review code\n---\nbody');
    file(join(plugin, 'agents', 'nested', 'helper.md'), '---\ndescription: Help with code\n---\nbody');
    json(join(plugin, '.claude-plugin', 'plugin.json'), { commands: ['./commands/review.md'], agents: ['./agents/nested'] });
    json(join(home, 'claude-custom', 'plugins', 'installed_plugins.json'), { plugins: { 'pack@market': [{ scope: 'user', installPath: plugin }] } });
    json(join(home, 'claude-custom', 'settings.json'), { enabledPlugins: { 'pack@market': true } });
    const host = (await audit(project)).hosts[0]!;
    expect(host.listings.map((s) => s.name).sort()).toEqual(['pack:helper', 'pack:review']);
  });

  it('preserves disabled Codex servers through partial project overrides and permits explicit re-enabling', async () => {
    file(join(home, 'codex-custom', 'config.toml'), '[mcp_servers.off]\nenabled=false\n[mcp_servers.on]\nenabled=false\n');
    file(join(project, '.codex', 'config.toml'), '[mcp_servers.off]\ncommand="SECRET"\n[mcp_servers.on]\nenabled=true\n');
    const host = (await audit(project)).hosts.find((h) => h.host === 'Codex')!;
    expect(host.servers.map((s) => s.name)).toEqual(['on']);
  });

  it('reports adoption failures without printing filesystem paths derived from host sources', () => {
    skill(join(home, 'claude-custom', 'skills'), 'safe');
    file(join(home, '.loadout', 'library', 'skills', '.lock'), 'held');
    const result = run('--adopt');
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/adopt|copy/);
    expect(result.stderr).not.toContain(home);
  });
});
