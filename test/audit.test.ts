import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import { audit, claudeSettingsScopes, formatAudit } from '../src/audit.js';
import { addSkills, findSkillDirs, parseFrontmatter, parseSkill } from '../src/library.js';

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
function applyClaudeSnippets(output: string) {
  for (const match of output.matchAll(/Claude Code: merge into (.*?) \(keep other settings[\s\S]*?```json\n([\s\S]*?)\n```/g)) {
    const path = JSON.parse(match[1]!);
    const snippet = JSON.parse(match[2]!);
    const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
    json(path, { ...existing, skillOverrides: { ...existing.skillOverrides, ...snippet.skillOverrides } });
  }
}
function mergedOverrides(files: string[]): Record<string, unknown> {
  return Object.fromEntries(files.flatMap((path) => existsSync(path) ? Object.entries(JSON.parse(readFileSync(path, 'utf8')).skillOverrides ?? {}) : []));
}
beforeEach(() => {
  // Real path: macOS's tmpdir() is under the /var -> /private/var link, and audit reports real paths.
  home = realpathSync(mkdtempSync(join(tmpdir(), 'loadout-audit-')));
  project = join(home, 'repo');
  mkdirSync(join(project, '.git'), { recursive: true });
  vi.stubEnv('HOME', home);
  vi.stubEnv('USERPROFILE', home);
  vi.stubEnv('CLAUDE_CONFIG_DIR', join(home, 'claude-custom'));
  vi.stubEnv('CODEX_HOME', join(home, 'codex-custom'));
  vi.stubEnv('XDG_CONFIG_HOME', join(home, '.config'));
  vi.stubEnv('LOADOUT_HOME', join(home, '.loadout'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
});

describe('Claude session settings scopes', () => {
  it.each([
    { name: 'POSIX repository subdirectory with legacy cwd local before root local', platform: 'linux', cwd: '/fixture/repo/package', gitRoot: '/fixture/repo', home: '/fixture', claudeHome: '/fixture/.claude', expected: ['/fixture/.claude/settings.json', '/fixture/repo/package/.claude/settings.json', '/fixture/repo/package/.claude/settings.local.json', '/fixture/repo/.claude/settings.local.json'] },
    { name: 'Windows repository subdirectory', platform: 'win32', cwd: 'C:\\fixture\\repo\\package', gitRoot: 'C:\\fixture\\repo', home: 'C:\\fixture', claudeHome: 'C:\\fixture\\.claude', expected: ['C:\\fixture\\.claude\\settings.json', 'C:\\fixture\\repo\\package\\.claude\\settings.json', 'C:\\fixture\\repo\\package\\.claude\\settings.local.json'] },
    { name: 'outside Git', platform: 'linux', cwd: '/fixture/scratch', gitRoot: undefined, home: '/fixture', claudeHome: '/fixture/.claude', expected: ['/fixture/.claude/settings.json', '/fixture/scratch/.claude/settings.json', '/fixture/scratch/.claude/settings.local.json'] },
    { name: 'repository root is home', platform: 'linux', cwd: '/fixture/package', gitRoot: '/fixture', home: '/fixture', claudeHome: '/fixture/.claude', expected: ['/fixture/.claude/settings.json', '/fixture/package/.claude/settings.json', '/fixture/package/.claude/settings.local.json'] },
    { name: 'cwd is home, user and shared deduplicated without dropping local', platform: 'linux', cwd: '/fixture', gitRoot: undefined, home: '/fixture', claudeHome: '/fixture/.claude', expected: ['/fixture/.claude/settings.json', '/fixture/.claude/settings.local.json'] },
  ])('$name', ({ expected, name: _name, ...input }) => {
    expect(claudeSettingsScopes(input)).toEqual(expected);
  });
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
    json(join(home, 'claude-custom', '.claude.json'), { mcpServers: { global: { env: { KEY: 'SECRET' } } }, projects: { [project]: { mcpServers: { local: {}, global: {} } }, elsewhere: { mcpServers: { ignored: {} } } } });
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
    expect(hosts.Cursor?.skills.map((s) => s.name).sort()).toEqual(['compat', 'cursor', 'editor', 'project', 'repo', 'shared']);
    expect(hosts['Claude Code']?.servers.map((s) => s.name).sort()).toEqual(['global', 'local', 'project']);
    expect(hosts.Codex?.servers.map((s) => s.name).sort()).toEqual(['one', 'two.dot']);
    expect(hosts.OpenCode?.servers).toHaveLength(2);
    expect(hosts.Cursor?.servers).toHaveLength(2);
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
    expect(host.estimatedTokens).toBe(host.skills[0]!.tokens);
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
    expect(result.loadout.skillTokens).toBe(12);
    expect(result.loadout.pickedSkills).toBe(3);
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
    expect(formatAudit(result)).toContain('user-invocable-only');
    expect((await audit(project, true)).adopted).toEqual({ added: 0, updated: 1, skipped: 0 });
  });

  it('prints scoped Claude hide snippets only for adopted skills without a restrictive override', async () => {
    const root = join(home, 'claude-custom', 'skills');
    for (const name of ['personal', 'explicit-on', 'short', 'manual', 'off', '__proto__']) skill(root, name);
    skill(join(project, '.claude', 'skills'), 'project');
    const nested = join(project, 'packages', 'app');
    skill(join(nested, '.claude', 'skills'), 'nested');
    const userFile = join(home, 'claude-custom', 'settings.json');
    const projectFile = join(project, '.claude', 'settings.local.json');
    json(userFile, { skillOverrides: { 'explicit-on': 'on', short: 'name-only', manual: 'user-invocable-only', off: 'off' } });
    json(projectFile, { permissions: { allow: [] } });
    const before = [userFile, projectFile].map((f) => readFileSync(f, 'utf8'));
    const result = await audit(nested, true);
    expect(result.disable?.claude.settings).toEqual([
      { file: userFile, skillOverrides: { ['__proto__']: 'user-invocable-only', 'explicit-on': 'user-invocable-only', personal: 'user-invocable-only' } },
      { file: process.platform === 'win32' ? join(nested, '.claude', 'settings.local.json') : projectFile, skillOverrides: { project: 'user-invocable-only', nested: 'user-invocable-only' } },
    ]);
    const output = formatAudit(result);
    for (const setting of result.disable!.claude.settings) {
      expect(output).toContain(JSON.stringify({ skillOverrides: setting.skillOverrides }, null, 2));
      expect(output).toContain(JSON.stringify(setting.file));
    }
    expect(output).toContain('Printed only; no host configs were changed.');
    expect([userFile, projectFile].map((f) => readFileSync(f, 'utf8'))).toEqual(before);
    expect(existsSync(join(nested, '.claude', 'settings.local.json'))).toBe(false);
  });

  it.each(['settings.json', 'settings.local.json'])('hides a personal skill after applying snippets despite project %s setting it on', async (settings) => {
    skill(join(home, 'claude-custom', 'skills'), 'example');
    const userFile = join(home, 'claude-custom', 'settings.json');
    const projectFile = join(project, '.claude', settings);
    const localFile = join(project, '.claude', 'settings.local.json');
    json(userFile, { skillOverrides: { preserved: 'off' } });
    json(projectFile, { skillOverrides: { example: 'on' }, permissions: { allow: [] } });
    const before = [userFile, projectFile].map((path) => readFileSync(path, 'utf8'));
    const report = await audit(project, true);
    expect(report.disable?.claude.settings.map((s) => s.file)).toEqual([userFile, localFile]);
    expect([userFile, projectFile].map((path) => readFileSync(path, 'utf8'))).toEqual(before);
    applyClaudeSnippets(formatAudit(report));
    expect(mergedOverrides([userFile, join(project, '.claude', 'settings.json'), localFile]).example).toBe('user-invocable-only');
    expect((await audit(project)).hosts[0]!.skills).toEqual([]);
    expect(JSON.parse(readFileSync(userFile, 'utf8')).skillOverrides.preserved).toBe('off');
  });

  it('hides an ancestor project skill through the effective local file for the session platform', async () => {
    skill(join(project, '.claude', 'skills'), 'example');
    const nested = join(project, 'package');
    // Ancestor shared settings are not session settings, even when the skill lives there.
    json(join(project, '.claude', 'settings.json'), { skillOverrides: { example: 'off' } });
    json(join(nested, '.claude', 'settings.json'), { skillOverrides: { example: 'on' } });
    const rootLocal = join(project, '.claude', 'settings.local.json');
    const cwdLocal = join(nested, '.claude', 'settings.local.json');
    const report = await audit(nested, true);
    expect(report.disable?.claude.settings.map((s) => s.file)).toEqual([process.platform === 'win32' ? cwdLocal : rootLocal]);
    expect(formatAudit(report)).toContain(`Project entries apply to Claude sessions started in ${JSON.stringify(nested)}.`);
    applyClaudeSnippets(formatAudit(report));
    const files = [join(home, 'claude-custom', 'settings.json'), join(nested, '.claude', 'settings.json'), cwdLocal];
    if (process.platform !== 'win32') files.push(rootLocal);
    expect(mergedOverrides(files).example).toBe('user-invocable-only');
    expect((await audit(nested)).hosts[0]!.skills).toEqual([]);
  });

  it.skipIf(process.platform === 'win32')('lets root local override the legacy cwd local file', async () => {
    skill(join(project, '.claude', 'skills'), 'example');
    const nested = join(project, 'package');
    const cwdLocal = join(nested, '.claude', 'settings.local.json');
    const rootLocal = join(project, '.claude', 'settings.local.json');
    json(cwdLocal, { skillOverrides: { example: 'on' } });
    json(rootLocal, { skillOverrides: { example: 'off' } });
    expect(mergedOverrides([cwdLocal, rootLocal]).example).toBe('off');
    const report = await audit(nested, true);
    expect(report.hosts[0]!.skills).toEqual([]);
    expect(report.disable?.claude.settings).toEqual([]);
  });

  it.skipIf(process.platform === 'win32').each(['relative', 'absolute'])('resolves a worktree through %s metadata paths without Git', async (mode) => {
    const main = join(home, 'main\ncheckout ');
    const common = join(main, '.git');
    const gitdir = join(common, 'worktrees', 'linked');
    const linked = join(home, 'linked');
    file(join(linked, '.git'), `gitdir: ${mode === 'relative' ? relative(linked, gitdir) : gitdir}\n`);
    file(join(gitdir, 'commondir'), `${mode === 'relative' ? relative(gitdir, common) : common}\n`);
    skill(join(linked, '.claude', 'skills'), 'example');
    const report = await audit(linked, true);
    const localFile = join(main, '.claude', 'settings.local.json');
    expect(report.hosts[0]!.warnings).toEqual([]);
    expect(report.disable?.claude.settings.map((s) => s.file)).toEqual([localFile]);
    applyClaudeSnippets(formatAudit(report));
    expect(mergedOverrides([join(linked, '.claude', 'settings.json'), join(linked, '.claude', 'settings.local.json'), localFile]).example).toBe('user-invocable-only');
    expect((await audit(linked)).hosts[0]!.skills).toEqual([]);
  });

  it.skipIf(process.platform === 'win32').each(['gitdir', 'commondir'])('canonicalizes a symlinked %s before selecting the main checkout', async (component) => {
    const main = join(home, 'main');
    const common = join(main, '.git');
    const gitdir = join(common, 'worktrees', 'linked');
    const linked = join(home, 'linked');
    file(join(gitdir, 'commondir'), '../..\n');
    let pointer = gitdir;
    if (component === 'gitdir') {
      pointer = join(home, 'alias', '.git', 'worktrees', 'linked');
      mkdirSync(dirname(pointer), { recursive: true });
      symlinkSync(gitdir, pointer, 'dir');
    } else {
      const alias = join(home, 'common-alias');
      symlinkSync(common, alias, 'dir');
      file(join(gitdir, 'commondir'), `${relative(gitdir, alias)}\n`);
    }
    file(join(linked, '.git'), `gitdir: ${pointer}\n`);
    skill(join(linked, '.claude', 'skills'), 'example');
    const localFile = join(main, '.claude', 'settings.local.json');
    json(localFile, { skillOverrides: { example: 'off' } });
    const hidden = await audit(linked);
    expect(hidden.hosts[0]!.warnings).toEqual([]);
    expect(hidden.hosts[0]!.skills).toEqual([]);
    json(localFile, { skillOverrides: { example: 'on' } });
    const adopted = await audit(linked, true);
    expect(adopted.hosts[0]!.warnings).toEqual([]);
    expect(adopted.disable?.claude.settings.map((s) => s.file)).toEqual([localFile]);
    applyClaudeSnippets(formatAudit(adopted));
    expect(mergedOverrides([localFile]).example).toBe('user-invocable-only');
    expect((await audit(linked)).hosts[0]!.skills).toEqual([]);
  });

  it.skipIf(process.platform === 'win32').each(['.git', 'commondir'])('rejects a %s FIFO without hanging inventory', (component) => {
    const linked = join(home, 'linked');
    const gitdir = join(home, 'main', '.git', 'worktrees', 'linked');
    mkdirSync(gitdir, { recursive: true });
    mkdirSync(linked);
    const fifo = component === '.git' ? join(linked, '.git') : join(gitdir, 'commondir');
    if (component === 'commondir') file(join(linked, '.git'), `gitdir: ${gitdir}\n`);
    expect(spawnSync('mkfifo', [fifo], { timeout: 5_000 }).status).toBe(0);
    skill(join(linked, '.claude', 'skills'), 'example');
    const script = `import { audit } from ${JSON.stringify(import.meta.resolve('../src/audit.ts'))}; console.log(JSON.stringify(await audit(${JSON.stringify(linked)})));`;
    const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--input-type=module', '-e', script], { env: process.env, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL' });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.hosts[0].skills.map((s: { name: string }) => s.name)).toEqual(['example']);
    expect(report.hosts[0].warnings).toEqual(['Could not resolve the main checkout of this Git worktree; local settings are assumed at the worktree root.']);
  });

  it.skipIf(process.platform === 'win32').each([
    'malformed gitfile', 'empty gitdir', 'missing gitdir', 'gitdir is a file',
    'missing commondir', 'empty commondir', 'common is a file', 'common is not .git',
    'linked gitfile', 'linked commondir', 'oversized gitfile', 'oversized commondir',
  ])('returns inventory with the appropriate warning for %s', async (failure) => {
    const linked = join(home, 'linked');
    const gitfile = join(linked, '.git');
    const gitdir = join(home, 'main', '.git', 'worktrees', 'linked');
    const commonFile = join(gitdir, 'commondir');
    file(gitfile, `gitdir: ${gitdir}\n`);
    file(commonFile, '../..\n');
    const sentinel = join(home, 'sentinel');
    file(sentinel, 'TOP-SECRET-METADATA\u001b[31m');
    switch (failure) {
      case 'malformed gitfile': file(gitfile, 'TOP-SECRET-METADATA\u001b[31m\n'); break;
      case 'empty gitdir': file(gitfile, 'gitdir: \n'); break;
      case 'missing gitdir': file(gitfile, 'gitdir: missing\n'); break;
      case 'gitdir is a file': file(gitfile, `gitdir: ${sentinel}\n`); break;
      case 'missing commondir': rmSync(commonFile); break;
      case 'empty commondir': file(commonFile, '\n'); break;
      case 'common is a file': file(join(home, 'file', '.git'), 'not a directory'); file(commonFile, `${join(home, 'file', '.git')}\n`); break;
      case 'common is not .git': file(commonFile, `${home}\n`); break;
      case 'linked gitfile': rmSync(gitfile); symlinkSync(sentinel, gitfile); break;
      case 'linked commondir': rmSync(commonFile); symlinkSync(sentinel, commonFile); break;
      case 'oversized gitfile': truncateSync(gitfile, 4 * 1024 * 1024 + 1); break;
      case 'oversized commondir': truncateSync(commonFile, 4 * 1024 * 1024 + 1); break;
    }
    skill(join(linked, '.claude', 'skills'), 'example');
    const warning = 'Could not resolve the main checkout of this Git worktree; local settings are assumed at the worktree root.';
    const report = await audit(linked);
    const warnings = failure === 'missing commondir' ? [] : [warning];
    expect(report.hosts[0]!.skills.map((s) => s.name)).toEqual(['example']);
    expect(report.hosts[0]!.warnings).toEqual(warnings);
    expect(formatAudit(report).split(warning)).toHaveLength(warnings.length + 1);
    expect(JSON.stringify(report) + formatAudit(report)).not.toContain('TOP-SECRET-METADATA');
    const adopted = await audit(linked, true);
    expect(adopted.hosts[0]!.warnings).toEqual(warnings);
    expect(adopted.disable?.claude.settings.map((s) => s.file)).toEqual([join(linked, '.claude', 'settings.local.json')]);
  });

  it.each([false, true])('reads home local on and prints an effective hide change (home is Git root: %s)', async (gitRootIsHome) => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', join(home, '.claude'));
    if (gitRootIsHome) mkdirSync(join(home, '.git'));
    skill(join(home, '.claude', 'skills'), 'example');
    const userFile = join(home, '.claude', 'settings.json');
    const localFile = join(home, '.claude', 'settings.local.json');
    json(userFile, { skillOverrides: { example: 'off' } });
    json(localFile, { skillOverrides: { example: 'on' } });
    expect(mergedOverrides([userFile, localFile]).example).toBe('on');
    const report = await audit(home, true);
    expect(report.hosts[0]!.skills.map((s) => s.name)).toEqual(['example']);
    expect(report.disable?.claude.settings.map((s) => s.file)).toEqual([userFile, localFile]);
    applyClaudeSnippets(formatAudit(report));
    expect(mergedOverrides([userFile, localFile]).example).toBe('user-invocable-only');
    expect((await audit(home)).hosts[0]!.skills).toEqual([]);
  });

  it.each([false, true])('reads home local off without suggesting a hide change (home is Git root: %s)', async (gitRootIsHome) => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', join(home, '.claude'));
    if (gitRootIsHome) mkdirSync(join(home, '.git'));
    skill(join(home, '.claude', 'skills'), 'example');
    const userFile = join(home, '.claude', 'settings.json');
    const localFile = join(home, '.claude', 'settings.local.json');
    json(userFile, { skillOverrides: { example: 'on' } });
    json(localFile, { skillOverrides: { example: 'off' } });
    expect(mergedOverrides([userFile, localFile]).example).toBe('off');
    const report = await audit(home, true);
    expect(report.hosts[0]!.skills).toEqual([]);
    expect(report.disable?.claude.settings).toEqual([]);
  });

  it('skips hide instructions when the effective project override is already restrictive', async () => {
    skill(join(home, 'claude-custom', 'skills'), 'example');
    json(join(project, '.claude', 'settings.json'), { skillOverrides: { example: 'on' } });
    json(join(project, '.claude', 'settings.local.json'), { skillOverrides: { example: 'name-only' } });
    expect((await audit(project, true)).disable?.claude.settings).toEqual([]);
  });

  it('displays reversible terminal-safe destination labels for Claude and Codex', async () => {
    const claudeHome = join(home, 'claude\u202e-home');
    const codexHome = join(home, 'codex\u202e-home');
    vi.stubEnv('CLAUDE_CONFIG_DIR', claudeHome);
    vi.stubEnv('CODEX_HOME', codexHome);
    skill(join(claudeHome, 'skills'), 'example');
    skill(join(codexHome, 'skills'), 'checks');
    const session = join(project, 'session\u202e-dir');
    mkdirSync(session);
    const output = formatAudit(await audit(session, true));
    expect(output).not.toMatch(/[\p{Cf}\p{Zl}\p{Zp}]/u);
    const claudeLabel = output.match(/Claude Code: merge into (.*?) \(keep other settings/)!;
    const codexLabel = output.match(/Codex: merge these entries into (.*?) \(update any existing entry/)!;
    expect(JSON.parse(claudeLabel[1]!)).toBe(join(claudeHome, 'settings.json'));
    expect(JSON.parse(codexLabel[1]!)).toBe(join(codexHome, 'config.toml'));
    const sessionLabel = output.match(/Project entries apply to Claude sessions started in (.*?)\.\n/)!;
    expect(JSON.parse(sessionLabel[1]!)).toBe(session);
  });

  it('does not treat the Claude home as a second project settings destination', async () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', join(home, '.claude'));
    skill(join(home, '.claude', 'skills'), 'example');
    const report = await audit(home, true);
    expect(report.disable?.claude.settings).toEqual([
      { file: join(home, '.claude', 'settings.json'), skillOverrides: { example: 'user-invocable-only' } },
    ]);
  });

  it.each(['pack', 'pa"ck\n\u001b[31m\u202e'])('names Claude plugin %j once in /plugin guidance rather than adding skillOverrides', async (name) => {
    const plugin = join(home, 'plugins', 'pack');
    skill(join(plugin, 'skills'), 'first');
    skill(join(plugin, 'skills'), 'second');
    json(join(home, 'claude-custom', 'plugins', 'installed_plugins.json'), { plugins: { [`${name}@market`]: [{ scope: 'user', installPath: plugin }] } });
    json(join(home, 'claude-custom', 'settings.json'), { enabledPlugins: { [`${name}@market`]: true }, skillOverrides: { [`${name}:first`]: 'off' } });
    const result = await audit(project, true);
    expect(result.disable?.claude).toEqual({ sessionDirectory: project, settings: [], plugins: [name] });
    expect(formatAudit(result)).toContain('Disable these plugins via /plugin (skillOverrides does not apply):');
    const printed = formatAudit(result).split('does not apply):\n  ')[1]!.split('\n')[0]!;
    expect(JSON.parse(printed)).toBe(name);
    expect(formatAudit(result)).not.toMatch(/[\u001b\u202e]/);
  });

  it('prints parseable Codex entries for active adopted skills and leaves config untouched', async () => {
    const root = join(home, 'codex-custom', 'skills');
    for (const name of ['active', 'hidden']) skill(root, name);
    skill(join(project, '.agents', 'skills'), 'project');
    const configFile = join(home, 'codex-custom', 'config.toml');
    const config = `[[skills.config]]\npath = ${JSON.stringify(join(root, 'hidden', 'SKILL.md'))}\nenabled = false\n`;
    file(configFile, config);
    const result = await audit(project, true);
    const entries = [join(root, 'active', 'SKILL.md'), join(project, '.agents', 'skills', 'project', 'SKILL.md')].map((path) => ({ path, enabled: false }));
    expect(result.disable?.codex).toEqual({ file: configFile, skills: entries });
    const snippet = formatAudit(result).split('```toml\n')[1]!.split('\n```')[0]!;
    expect(parseToml(snippet)).toEqual({ skills: { config: entries } });
    expect(formatAudit(result)).toContain('Restart Codex');
    expect(readFileSync(configFile, 'utf8')).toBe(config);
  });

  it('round-trips hostile names and paths without terminal controls or snippet injection', async () => {
    const name = 'quo"te\\\n\u001b[31m\u0007\u202e\u2028\u{e0001}" : { "injected" : "off" }';
    file(join(home, 'claude-custom', 'skills', 'safe-folder', 'SKILL.md'), `---\nname: ${JSON.stringify(name)}\ndescription: normal\n---\nbody`);
    const folder = process.platform === 'win32' ? "quo'te [skills.config] # \u202e\u{e0001}" : 'quo"te\n\u001b[31m\u0007\u202e\u{e0001} [skills.config] #';
    skill(join(home, 'codex-custom', 'skills'), folder);
    const result = await audit(project, true);
    const output = formatAudit(result);
    expect(output).not.toMatch(/[\p{Cf}\p{Zl}\p{Zp}]/u);
    expect(output).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202e\u2028]/);
    const claude = JSON.parse(output.split('```json\n')[1]!.split('\n```')[0]!);
    expect(claude).toEqual({ skillOverrides: { [name]: 'user-invocable-only' } });
    const codex = parseToml(output.split('```toml\n')[1]!.split('\n```')[0]!);
    expect(codex).toEqual({ skills: { config: [{ path: join(home, 'codex-custom', 'skills', folder, 'SKILL.md'), enabled: false }] } });
    expect(JSON.parse(JSON.stringify(result)).disable.claude.settings[0].skillOverrides).toEqual(claude.skillOverrides);
    const cliResult = run('--json', '--adopt');
    expect(cliResult.status, cliResult.stderr).toBe(0);
    expect(cliResult.stdout).not.toMatch(/[\p{Cf}\p{Zl}\p{Zp}\u001b\u0007]/u);
    expect(JSON.parse(cliResult.stdout).disable).toEqual(result.disable);
  });

  it('does not suggest hiding a skill whose adoption was skipped', async () => {
    const root = join(home, 'claude-custom', 'skills');
    skill(root, 'oversized');
    const resource = join(root, 'oversized', 'large.bin');
    file(resource, '');
    truncateSync(resource, 21 * 1024 * 1024);
    const result = await audit(project, true);
    expect(result.adopted).toEqual({ added: 0, updated: 0, skipped: 1 });
    expect(result.disable?.claude.settings).toEqual([]);
  });

  it('targets the default user settings files when host homes are not overridden', async () => {
    vi.stubEnv('CLAUDE_CONFIG_DIR', '');
    vi.stubEnv('CODEX_HOME', '');
    skill(join(home, '.claude', 'skills'), 'personal');
    skill(join(home, '.agents', 'skills'), 'shared');
    const result = await audit(project, true);
    expect(result.disable?.claude.settings[0]?.file).toBe(join(home, '.claude', 'settings.json'));
    expect(result.disable?.codex.file).toBe(join(home, '.codex', 'config.toml'));
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

  it.skipIf(process.platform !== 'win32')('adopts into a case-variant LOADOUT_HOME without looping past its boundary', () => {
    skill(join(home, 'claude-custom', 'skills'), 'safe');
    vi.stubEnv('LOADOUT_HOME', join(home, '.LOADOUT'));
    const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), cli, 'audit', '--json', '--adopt'], { cwd: project, env: process.env, encoding: 'utf8', timeout: 15_000 });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).adopted.added).toBe(1);
    expect(existsSync(join(home, '.loadout', 'library', 'skills', 'safe', 'SKILL.md'))).toBe(true);
  });

  it('keeps source-bearing YAML warnings out of audit and add stdout/stderr while rejecting parse errors', () => {
    vi.stubEnv('NODE_NO_WARNINGS', undefined);
    vi.stubEnv('NODE_OPTIONS', undefined);
    const root = join(home, 'claude-custom', 'skills');
    file(join(root, 'safe', 'SKILL.md'), '---\nname: safe\ndescription: normal\ncredential: !private TOP-SECRET\n---\nbody');
    file(join(home, 'claude-custom', 'commands', 'legacy.md'), '---\ndescription: normal\ncredential: !private TOP-SECRET\n---\nbody');
    const script = `import { audit, formatAudit } from ${JSON.stringify(import.meta.resolve('../src/audit.ts'))};
import { addSkills } from ${JSON.stringify(import.meta.resolve('../src/library.ts'))};
const report = await audit(${JSON.stringify(project)});
console.log(formatAudit(report));
console.log(JSON.stringify(report));
console.log(JSON.stringify(addSkills(${JSON.stringify(root)}, ${JSON.stringify(join(home, '.loadout', 'library'))})));
await new Promise(setImmediate);`;
    const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--input-type=module', '-e', script], { cwd: project, env: process.env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('TOP-SECRET');
    expect(result.stderr).not.toContain('TOP-SECRET');
    expect(parseFrontmatter('---\nname: [TOP-SECRET\n---')).toEqual({});
  });

  it('CLI JSON is parseable, secret-free and adoption writes only in the fake loadout home', () => {
    skill(join(home, 'codex-custom', 'skills'), 'safe');
    file(join(home, 'codex-custom', 'config.toml'), '[mcp_servers.secret]\nhttp_headers={ Authorization="TOP-SECRET" }\n');
    json(join(home, 'claude-custom', '.claude.json'), { mcpServers: { secret: { env: { KEY: 'TOP-SECRET' } } } });
    const scanned = run('--json');
    expect(scanned.status, scanned.stderr).toBe(0);
    expect(JSON.parse(scanned.stdout).hosts).toHaveLength(4);
    expect(scanned.stdout + scanned.stderr).not.toContain('TOP-SECRET');
    expect(existsSync(join(home, '.loadout'))).toBe(false);
    const adopted = run('--json', '--adopt');
    expect(adopted.status, adopted.stderr).toBe(0);
    expect(JSON.parse(adopted.stdout).adopted.added).toBe(1);
    expect(JSON.parse(adopted.stdout).disable).toEqual({
      notice: 'Printed only; no host configs were changed.',
      claude: { sessionDirectory: project, settings: [], plugins: [] },
      codex: { file: join(home, 'codex-custom', 'config.toml'), skills: [{ path: join(home, 'codex-custom', 'skills', 'safe', 'SKILL.md'), enabled: false }] },
      guidance: [
        'OpenCode: deny adopted skill names under permission.skill, or move their folders out of discovery directories.',
        'Cursor: move adopted folders out of .cursor/.claude/.codex/.agents skill directories at user and project scope.',
      ],
    });
    expect(existsSync(join(home, '.loadout', 'library', 'skills', 'safe', 'SKILL.md'))).toBe(true);
  });

  it('reports unreadable configs without leaking parse errors or treating the scan as complete', async () => {
    file(join(home, 'claude-custom', '.claude.json'), '{ "TOKEN": "TOP-SECRET", broken');
    const result = await audit(project);
    expect(result.hosts[0]!.warnings.length).toBeGreaterThan(0);
    expect(JSON.stringify(result) + formatAudit(result)).not.toContain('TOP-SECRET');
    expect(result.caveats.join(' ')).toMatch(/within.*context|drops descriptions/);
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
    json(join(project, '.claude', 'settings.json'), { enabledPlugins: { 'pack@market': false } });
    json(join(home, 'claude-custom', '.claude.json'), { projects: { [project]: { mcpServers: { project: {} } } } });
    const nested = join(project, 'src');
    json(join(nested, '.claude', 'settings.json'), { enabledPlugins: { 'pack@market': true } });
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

  it('discovers available synced plugins, generation folders and installed duplicates, honoring disables', async () => {
    const bucket = join(home, 'claude-custom', 'plugins', 'synced', 'account');
    json(join(bucket, 'manifest.json'), { plugins: [
      { name: 'sync', installationPreference: 'available' },
      { name: 'generation', installationPreference: 'available' },
      { name: 'disabled', installationPreference: 'available' },
      { name: 'hidden', installationPreference: 'unavailable' },
      { name: 'installed', installationPreference: 'available' },
    ] });
    for (const name of ['sync', 'generation~g2', 'disabled', 'hidden', 'installed']) skill(join(bucket, name, 'skills'), name);
    const installed = join(home, 'installed');
    skill(join(installed, 'skills'), 'installed');
    json(join(home, 'claude-custom', 'plugins', 'installed_plugins.json'), { plugins: { 'installed@market': [{ scope: 'user', installPath: installed }] } });
    json(join(home, 'claude-custom', 'settings.json'), { enabledPlugins: { 'installed@market': true, disabled: false } });
    json(join(bucket, 'sync', '.mcp.json'), { mcpServers: { synced: { env: { KEY: 'TOP-SECRET' } } } });
    const result = await audit(project);
    expect(result.hosts[0]!.skills.map((s) => s.name).sort()).toEqual(['generation:generation~g2', 'installed:installed', 'sync:sync']);
    expect(result.hosts[0]!.servers.map((s) => s.name)).toEqual(['plugin:sync:synced']);
    expect(result.caveats.join(' ')).toMatch(/claude\.ai.*not counted/);
    expect(JSON.stringify(result) + formatAudit(result)).not.toContain('TOP-SECRET');
  });

  it('uses only the overridden Claude MCP location, or the home file without an override', async () => {
    json(join(home, '.claude.json'), { mcpServers: { old: {} } });
    json(join(home, 'claude-custom', '.claude.json'), { mcpServers: { current: {} } });
    expect((await audit(project)).hosts[0]!.servers.map((s) => s.name)).toEqual(['current']);
    vi.stubEnv('CLAUDE_CONFIG_DIR', '');
    expect((await audit(project)).hosts[0]!.servers.map((s) => s.name)).toEqual(['old']);
  });

  it('reports inventory only, with documented listing rules and short per-host summaries', async () => {
    skill(join(home, 'codex-custom', 'skills'), 'large', 'x'.repeat(8100));
    skill(join(home, 'codex-custom', 'skills'), 'small', 'abcd');
    const result = await audit(project);
    const host = result.hosts.find((h) => h.host === 'Codex')!;
    expect(host.descriptionCharacters).toBe(8118);
    expect(host.estimatedTokens).toBe(2030);
    expect(host).not.toHaveProperty('budget');
    expect(host.skills[0]).not.toHaveProperty('listingCharacters');
    expect(result.summary).toMatch(/cap|truncate/);
    expect(result.summary).not.toMatch(/per request|loadout/i);
    expect(result.summary.split('\n')).toHaveLength(4);
    expect(result.summary).toContain('Codex: 2 skills installed, ~2,030 description tokens');
    expect(result.summary).toContain('MCP schemas not counted');
    expect(result.summary).toContain('0 MCP servers configured');
    expect(formatAudit(result)).toContain('0 MCP servers configured');
    expect(result.caveats.join(' ')).toContain('Servers awaiting authentication add no tools');
    expect(formatAudit(result)).not.toMatch(/tokens\/request|tokens per request|at most.*fit|16,000/);
    expect(result.caveats).toContain('Claude Code keeps descriptions within 1% of the context window; Codex within 2% or 8,000 characters; OpenCode and Cursor do not document one; B1 measures what is actually sent.');
    expect(result.caveats.join(' ')).toMatch(/bundled skills.*claude\.ai connectors.*not counted/i);
  });

  it('merges Claude skill overrides through user, project and local settings before counting and adoption', async () => {
    const root = join(home, 'claude-custom', 'skills');
    for (const name of ['off', 'manual', 'short', 'project-on', 'local-on', 'local-off']) skill(root, name);
    json(join(home, 'claude-custom', 'settings.json'), { skillOverrides: { off: 'off', manual: 'user-invocable-only', short: 'name-only', 'project-on': 'off', 'local-on': 'off' } });
    json(join(project, '.claude', 'settings.json'), { skillOverrides: { 'project-on': 'on', 'local-off': 'on' } });
    json(join(project, '.claude', 'settings.local.json'), { skillOverrides: { 'local-on': 'on', 'local-off': 'off' } });
    const result = await audit(project, true);
    expect(result.hosts[0]!.skills.map((s) => s.name).sort()).toEqual(['local-on', 'project-on', 'short']);
    expect(result.hosts[0]!.skills.find((s) => s.name === 'short')).toEqual({ name: 'short', description: '', characters: 5, tokens: 2 });
    expect(result.adopted?.added).toBe(3);
    expect(readdirSync(join(home, '.loadout', 'library', 'skills')).sort()).toEqual(['local-on', 'project-on', 'short']);
  });

  it('keeps plugin skills and commands unaffected by visibility overrides and honors marketplace-specific disables', async () => {
    const one = join(home, 'plugins', 'one');
    const two = join(home, 'plugins', 'two');
    skill(join(one, 'skills'), 'one');
    skill(join(two, 'skills'), 'two');
    skill(join(two, 'skills'), 'off');
    file(join(two, 'commands', 'command.md'), '---\ndescription: plugin command\n---\nbody');
    json(join(home, 'claude-custom', 'plugins', 'installed_plugins.json'), { plugins: {
      'pack@one': [{ scope: 'user', installPath: one }], 'pack@two': [{ scope: 'user', installPath: two }],
    } });
    json(join(home, 'claude-custom', 'settings.json'), { enabledPlugins: { 'pack@one': false, 'pack@two': true }, skillOverrides: { 'pack:two': 'name-only', 'pack:off': 'off', 'pack:command': 'user-invocable-only' } });
    const host = (await audit(project)).hosts[0]!;
    expect(host.skills.map((s) => [s.name, s.description]).sort()).toEqual([['pack:off', 'abcd'], ['pack:two', 'abcd']]);
    expect(host.listings.map((s) => [s.name, s.description])).toEqual([['pack:command', 'plugin command']]);
  });

  it('applies Claude user/project/local visibility overrides to legacy commands, but not agents', async () => {
    const user = join(home, 'claude-custom', 'commands');
    for (const name of ['off', 'manual', 'short', 'project-on', 'local-off']) file(join(user, `${name}.md`), `---\ndescription: command description\n---\nbody`);
    file(join(project, '.claude', 'commands', 'project-short.md'), '---\nname: project-short\ndescription: project command\n---\nbody');
    file(join(home, 'claude-custom', 'agents', 'agent.md'), '---\ndescription: agent description\n---\nbody');
    json(join(home, 'claude-custom', 'settings.json'), { skillOverrides: { off: 'off', manual: 'user-invocable-only', short: 'name-only', 'project-on': 'off', agent: 'off' } });
    json(join(project, '.claude', 'settings.json'), { skillOverrides: { 'project-on': 'on', 'project-short': 'name-only', 'local-off': 'on' } });
    json(join(project, '.claude', 'settings.local.json'), { skillOverrides: { 'local-off': 'off' } });
    const host = (await audit(project)).hosts[0]!;
    expect(host.listings.map((s) => [s.name, s.description]).sort()).toEqual([['agent', 'agent description'], ['project-on', 'command description'], ['project-short', ''], ['short', '']]);
    expect(host.listings.find((s) => s.name === 'short')).toEqual({ name: 'short', description: '', characters: 5, tokens: 2 });
  });

  it('excludes locally disabled Codex and Claude skills from inventories', async () => {
    const root = join(home, 'codex-custom', 'skills');
    skill(root, 'hidden');
    skill(root, 'kept');
    file(join(home, 'codex-custom', 'config.toml'), `[[skills.config]]\npath = ${JSON.stringify(join(root, 'hidden', 'SKILL.md'))}\nenabled = false\n`);
    file(join(home, 'claude-custom', 'skills', 'manual', 'SKILL.md'), '---\nname: manual\ndescription: Hidden from automatic listing\ndisable-model-invocation: true\n---\nbody');
    expect(parseSkill(join(home, 'claude-custom', 'skills', 'manual'))?.disableModelInvocation).toBe(true);
    const result = await audit(project, true);
    expect(result.hosts.find((h) => h.host === 'Codex')!.skills.map((s) => s.name)).toEqual(['kept']);
    expect(result.hosts[0]!.skills).toHaveLength(0);
    expect(result.adopted?.added).toBe(1);
    expect(readdirSync(join(home, '.loadout', 'library', 'skills'))).toEqual(['kept']);
  });

  it('finds Cursor packs in user and project .agents directories', async () => {
    skill(join(home, '.agents', 'skills'), 'user-agent');
    skill(join(project, '.agents', 'skills'), 'repo-agent');
    const cursor = (await audit(project)).hosts.find((h) => h.host === 'Cursor')!;
    expect(cursor.skills.map((s) => s.name).sort()).toEqual(['repo-agent', 'user-agent']);
  });

  it('follows external Codex folder links, confines manifests and adopts exactly the real skill folder', async () => {
    const root = join(home, 'codex-custom', 'skills');
    const real = join(home, 'external');
    skill(real, 'linked');
    file(join(real, 'linked', 'reference.txt'), 'kept');
    skill(real, 'sibling');
    symlinkSync(join(real, 'sibling', 'SKILL.md'), join(real, 'linked', 'outside.txt'));
    mkdirSync(root, { recursive: true });
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    symlinkSync(join(real, 'linked'), join(root, 'alias'), linkType);
    symlinkSync(root, join(root, 'cycle'), linkType);
    const escape = join(real, 'escape');
    mkdirSync(escape);
    symlinkSync(join(real, 'linked', 'SKILL.md'), join(escape, 'SKILL.md'));
    symlinkSync(escape, join(root, 'escape'), linkType);
    expect(findSkillDirs(root)).toEqual([]);
    expect(findSkillDirs(root, 8, true)).toContain(join(real, 'linked'));
    const result = await audit(project, true);
    expect(result.hosts.find((h) => h.host === 'Codex')!.skills.map((s) => s.name)).toEqual(['linked']);
    const library = join(home, '.loadout', 'library', 'skills');
    expect(readdirSync(library)).toEqual(['linked']);
    expect(readdirSync(join(library, 'linked')).sort()).toEqual(['.loadout-source.json', 'SKILL.md', 'reference.txt']);
    expect(readFileSync(join(library, 'linked', 'reference.txt'), 'utf8')).toBe('kept');
    expect(JSON.parse(readFileSync(join(library, 'linked', '.loadout-source.json'), 'utf8')).origin).toBe(join(real, 'linked'));
  });

  it('does not copy the library back into itself when Codex links to its skills directory', async () => {
    const original = join(home, 'original');
    const library = join(home, '.loadout', 'library');
    skill(original, 'already');
    addSkills(original, library);
    const sourceFile = join(library, 'skills', 'already', '.loadout-source.json');
    const before = readFileSync(sourceFile, 'utf8');
    const codexSkills = join(home, 'codex-custom', 'skills');
    mkdirSync(dirname(codexSkills), { recursive: true });
    symlinkSync(join(library, 'skills'), codexSkills, process.platform === 'win32' ? 'junction' : 'dir');
    if (process.platform === 'win32') vi.stubEnv('LOADOUT_HOME', join(home, '.LOADOUT'));
    for (let i = 0; i < 2; i++) {
      const result = await audit(project, true);
      expect(result.hosts.find((h) => h.host === 'Codex')!.skills.map((s) => s.name)).toEqual(['already']);
      expect(result.adopted).toEqual({ added: 0, updated: 0, skipped: 1 });
      expect(readdirSync(join(library, 'skills'))).toEqual(['already']);
      expect(readFileSync(sourceFile, 'utf8')).toBe(before);
    }
  });

  it('keeps OpenCode project name precedence without applying permission rules', async () => {
    const user = join(home, '.config', 'opencode', 'skills');
    const repo = join(project, '.opencode', 'skills');
    skill(user, 'same', 'user definition');
    skill(repo, 'same', 'project definition');
    skill(user, 'denied');
    skill(user, 'default-denied');
    json(join(home, '.config', 'opencode', 'opencode.json'), { permission: { skill: { '*': 'deny', same: 'allow', denied: 'deny' } } });
    const result = await audit(project);
    const host = result.hosts.find((h) => h.host === 'OpenCode')!;
    expect(host.skills.map((s) => [s.name, s.description]).sort()).toEqual([['default-denied', 'abcd'], ['denied', 'abcd'], ['same', 'project definition']]);
    expect(result.caveats).toContain('OpenCode permission rules are not applied.');
  });

  it('discloses unsupported OpenCode permission patterns without printing their config values', async () => {
    skill(join(project, '.opencode', 'skills'), 'kept');
    json(join(project, 'opencode.json'), { permission: { skill: { 'TOP-SECRET*': 'deny' } } });
    const result = await audit(project);
    expect(result.caveats).toContain('OpenCode permission rules are not applied.');
    expect(JSON.stringify(result) + formatAudit(result)).not.toContain('TOP-SECRET');
  });

  it('does not let skills.config arrays disable the preceding MCP server', async () => {
    file(join(home, 'codex-custom', 'config.toml'), '[mcp_servers.real]\ncommand="unused"\n[[skills.config]]\npath="ignored"\nenabled=false\n');
    expect((await audit(project)).hosts.find((h) => h.host === 'Codex')!.servers.map((s) => s.name)).toEqual(['real']);
  });

  it('redacts TOML parse errors and marks the config not parsed', async () => {
    file(join(home, 'codex-custom', 'config.toml'), 'TOP-SECRET-CONFIG-VALUE = "unterminated');
    const result = await audit(project);
    expect(result.hosts.find((h) => h.host === 'Codex')!.warnings).toContain('config.toml: not parsed');
    expect(JSON.stringify(result) + formatAudit(result)).not.toContain('TOP-SECRET-CONFIG-VALUE');
  });

  it('bounds Codex linked-directory depth', async () => {
    const root = join(home, 'codex-custom', 'skills');
    mkdirSync(root, { recursive: true });
    let previous = root;
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    for (let i = 0; i < 10; i++) {
      const next = join(home, `depth-${i}`);
      mkdirSync(next);
      symlinkSync(next, join(previous, 'next'), linkType);
      previous = next;
    }
    file(join(previous, 'SKILL.md'), '---\nname: too-deep\ndescription: not discoverable\n---\n');
    expect((await audit(project)).hosts.find((h) => h.host === 'Codex')!.skills).toHaveLength(0);
  });

});
