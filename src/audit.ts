import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DEFAULT_CONFIG, paths } from './config.js';
import { addSkills, findSkillDirs, parseFrontmatter, parseSkill, readConfined, scanLibrary } from './library.js';
import { createServer } from './mcp.js';
import type { Capability } from './types.js';

const MAX_CONFIG_BYTES = 4 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_DESCRIPTION_ENTRIES = 20_000;
const MAX_DESCRIPTION_DEPTH = 8;
const clean = (text: string) => text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '');
// Serializers escape C0 controls; escape the remaining terminal controls while
// preserving the original configuration values (TOML uses \U for astral code points).
const escapeControls = (text: string, toml = false) => text.replace(/[\p{Cf}\p{Zl}\p{Zp}\u007f-\u009f]/gu, (c) => toml && c.length === 2
  ? `\\U${c.codePointAt(0)!.toString(16).padStart(8, '0')}`
  : c.split('').map((unit) => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`).join(''));
const tokens = (text: string) => Math.ceil(text.length / 4);
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

interface Listing {
  name: string;
  description: string;
  characters: number;
  tokens: number;
}
interface FoundSkill {
  capability: Capability;
  listings: Map<string, Listing>;
  settingsFiles: Set<string>;
}
interface HostAudit {
  host: string;
  skills: Listing[];
  listings: Listing[];
  servers: { name: string }[];
  descriptionCharacters: number;
  estimatedTokens: number;
  warnings: string[];
}
export interface AuditReport {
  method: string;
  hosts: HostAudit[];
  loadout: { toolTokens: number; pickedSkills: number; skillTokens: number; estimatedTokens: number };
  summary: string;
  caveats: string[];
  adopted?: { added: number; updated: number; skipped: number };
  disable?: {
    notice: string;
    claude: { settings: { file: string; skillOverrides: Record<string, 'user-invocable-only'> }[]; plugins: string[] };
    codex: { file: string; skills: { path: string; enabled: false }[] };
    guidance: string[];
  };
}

function readText(file: string, host: HostAudit, label: string): string | undefined {
  try {
    return readConfined(dirname(file), basename(file), MAX_CONFIG_BYTES).toString('utf8');
  } catch {
    if (existsSync(file)) host.warnings.push(`Could not read ${label} (inaccessible, linked or oversized).`);
    return undefined;
  }
}

function readJson(file: string, host: HostAudit, label: string): Record<string, unknown> {
  const text = readText(file, host, label);
  if (text === undefined) return {};
  try {
    // JSONC comments and trailing commas occur in OpenCode configs; quoted strings stay intact.
    const uncommented = text.replace(/"(?:\\.|[^"\\])*"|\/\/[^\r\n]*|\/\*[\s\S]*?\*\//g, (s) => s.startsWith('"') ? s : ' ');
    return object(JSON.parse(uncommented.replace(/"(?:\\.|[^"\\])*"|,\s*(?=[}\]])/g, (s) => s.startsWith('"') ? s : '')));
  } catch {
    // Parser errors can include credential-bearing source text.
    host.warnings.push(`Could not parse ${label}; its entries are not counted.`);
    return {};
  }
}

function listing(name: string, description?: string): Listing {
  const characters = description === undefined ? name.length : `${name}: ${description}`.length;
  return { name: clean(name), description: clean(description ?? ''), characters, tokens: Math.ceil(characters / 4) };
}

function projectDirs(cwd: string): string[] {
  const dirs: string[] = [];
  for (let dir = resolve(cwd);; dir = dirname(dir)) {
    dirs.unshift(dir);
    if (existsSync(join(dir, '.git')) || dir === resolve(homedir()) || dirname(dir) === dir) return dirs;
  }
}

function addSkillRoot(root: string, host: HostAudit, found: Map<string, FoundSkill>, prefix = '', settingsFile?: string) {
  try {
    for (const dir of findSkillDirs(root, MAX_DESCRIPTION_DEPTH, host.host === 'Codex')) {
      const skill = parseSkill(dir);
      if (!skill) {
        host.warnings.push('A skill manifest was skipped (linked, unreadable or oversized).');
        continue;
      }
      if (host.host === 'Claude Code' && skill.disableModelInvocation) continue;
      const key = realpathSync(dir);
      const discovered = found.get(key) ?? { capability: skill, listings: new Map<string, Listing>(), settingsFiles: new Set<string>() };
      found.set(key, discovered);
      if (settingsFile) discovered.settingsFiles.add(settingsFile);
      const identity = `${host.host}:${prefix}`;
      if (discovered.listings.has(identity)) continue;
      const entry = listing(prefix + skill.name, skill.description);
      discovered.listings.set(identity, entry);
      host.skills.push(entry);
    }
  } catch {
    host.warnings.push('A skill directory could not be fully scanned; counts may be incomplete.');
  }
}

function addMarkdown(root: string, host: HostAudit, seen: Set<string>, kind: 'commands' | 'agents', prefix = '', overrides: Record<string, unknown> = {}) {
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) return;
  const confinement = lstatSync(root).isFile() ? dirname(root) : root;
  let entries = 0;
  const walk = (path: string, depth: number) => {
    const st = lstatSync(path);
    if (st.isSymbolicLink()) return;
    if (++entries > MAX_DESCRIPTION_ENTRIES || depth > MAX_DESCRIPTION_DEPTH) throw new Error('description scan budget exceeded');
    if (st.isDirectory()) {
      for (const entry of readdirSync(path)) walk(join(path, entry), depth + 1);
    } else if (st.isFile() && path.endsWith('.md')) {
      try {
        const meta = parseFrontmatter(readConfined(confinement, relative(confinement, path), MAX_MANIFEST_BYTES).toString('utf8'));
        const identity = JSON.stringify([host.host, kind, prefix, realpathSync(path)]);
        if (seen.has(identity)) return;
        seen.add(identity);
        if (kind === 'commands' && meta['disable-model-invocation'] === true) return;
        const name = prefix + (typeof meta.name === 'string' ? meta.name : basename(path, '.md'));
        const description = typeof meta.description === 'string' ? meta.description : '';
        const override = kind === 'commands' && !prefix ? overrides[name] : undefined;
        if (override === 'off' || override === 'user-invocable-only') return;
        if (description || override === 'name-only') host.listings.push(listing(name, override === 'name-only' ? undefined : description));
        else host.warnings.push(`A plugin ${kind} description is missing; its listing is not counted.`);
      } catch {
        host.warnings.push(`A ${kind} file could not be counted.`);
      }
    }
  };
  try { walk(root, 0); } catch { host.warnings.push(`A ${kind} directory could not be fully scanned.`); }
}

function addServers(config: unknown, servers: Map<string, unknown>, prefix = '') {
  for (const [name, value] of Object.entries(object(config))) servers.set(prefix + name, { ...object(servers.get(prefix + name)), ...object(value) });
}

function claudePlugins(home: string, dirs: string[], host: HostAudit, found: Map<string, FoundSkill>, seen: Set<string>, servers: Map<string, unknown>, settings: Record<string, unknown>) {
  const installed = object(readJson(join(home, 'plugins', 'installed_plugins.json'), host, 'plugin registry').plugins);
  const disabled = new Set(Object.entries(settings).filter(([, enabled]) => enabled === false).map(([id]) => id));
  const plugins = new Map<string, string>();
  for (const [id, enabled] of Object.entries(settings)) {
    const name = id.split('@')[0]!;
    if (enabled !== true || disabled.has(id) || disabled.has(name)) continue;
    const installs = installed[id];
    if (!Array.isArray(installs)) continue;
    const applicable = installs.map(object).reverse();
    const install = applicable.find((p) => typeof p.projectPath === 'string' && dirs.includes(resolve(p.projectPath))) ?? applicable.find((p) => p.scope === 'user');
    if (typeof install?.installPath === 'string' && existsSync(install.installPath)) plugins.set(name, install.installPath);
  }
  const synced = join(home, 'plugins', 'synced');
  if (existsSync(synced)) try {
    for (const bucket of readdirSync(synced, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const dir = join(synced, bucket.name);
      const manifest = readJson(join(dir, 'manifest.json'), host, 'synced plugin manifest');
      if (!Array.isArray(manifest.plugins)) continue;
      for (const plugin of manifest.plugins.map(object)) {
        const name = plugin.name;
        if (typeof name !== 'string' || !name || /[\\/]|^\.{1,2}$/.test(name)) continue;
        if ((plugin.installationPreference ?? manifest.installationPreference) !== 'available' || disabled.has(name) || plugins.has(name)) continue;
        const folder = [join(dir, name), join(dir, `${name}~g2`)].find(existsSync);
        if (folder) plugins.set(name, folder);
        else host.warnings.push('An available synced plugin has no readable folder; its entries are not counted.');
      }
    }
  } catch { host.warnings.push('Synced plugins could not be fully scanned.'); }
  for (const [id, enabled] of Object.entries(settings)) {
    const name = id.split('@')[0]!;
    if (enabled === true && !disabled.has(id) && !disabled.has(name) && !plugins.has(name)) host.warnings.push('An enabled plugin has no readable installation; its entries are not counted.');
  }
  for (const [name, dir] of plugins) {
    addSkillRoot(join(dir, 'skills'), host, found, `${name}:`);
    addMarkdown(join(dir, 'commands'), host, seen, 'commands', `${name}:`);
    addMarkdown(join(dir, 'agents'), host, seen, 'agents', `${name}:`);
    addServers(readJson(join(dir, '.mcp.json'), host, 'plugin MCP config').mcpServers, servers, `plugin:${name}:`);
    const manifest = readJson(join(dir, '.claude-plugin', 'plugin.json'), host, 'plugin manifest');
    // Custom plugin component locations are relative to the plugin root, never executable hooks.
    for (const kind of ['skills', 'commands', 'agents'] as const) {
      const value = manifest[kind];
      const locations = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
      for (const location of locations) {
        if (typeof location !== 'string') continue;
        const target = resolve(dir, location);
        if (isAbsolute(relative(dir, target)) || relative(dir, target).startsWith('..')) {
          host.warnings.push('An outside plugin component path was skipped.');
          continue;
        }
        if (target === join(dir, kind)) continue;
        if (kind === 'skills') addSkillRoot(target, host, found, `${name}:`);
        else addMarkdown(target, host, seen, kind, `${name}:`);
      }
    }
    const mcp = manifest.mcpServers;
    if (typeof mcp === 'string' || Array.isArray(mcp)) {
      for (const location of typeof mcp === 'string' ? [mcp] : mcp) {
        if (typeof location !== 'string') continue;
        const target = resolve(dir, location);
        if (!relative(dir, target).startsWith('..') && !isAbsolute(relative(dir, target))) addServers(readJson(target, host, 'plugin MCP config').mcpServers, servers, `plugin:${name}:`);
        else host.warnings.push('An outside plugin MCP path was skipped.');
      }
    } else addServers(mcp, servers, `plugin:${name}:`);
  }
}

function canonicalSkillPath(path: string): string {
  const folder = basename(path).toUpperCase() === 'SKILL.MD' ? dirname(path) : path;
  const resolved = existsSync(folder) ? realpathSync(folder) : resolve(folder);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function codexConfig(file: string, host: HostAudit, servers: Map<string, unknown>, disabled: Map<string, boolean>) {
  const text = readText(file, host, 'config.toml');
  if (text === undefined) return;
  try {
    const config = parseToml(text);
    for (const [name, value] of Object.entries(object(config.mcp_servers))) {
      const enabled = object(value).enabled;
      servers.set(name, { ...object(servers.get(name)), ...(typeof enabled === 'boolean' ? { enabled } : {}) });
    }
    const skills = object(config.skills).config;
    if (Array.isArray(skills)) for (const entry of skills) {
      const { path, enabled } = object(entry);
      if (typeof path === 'string' && typeof enabled === 'boolean') disabled.set(canonicalSkillPath(resolve(dirname(file), path)), !enabled);
    }
  } catch {
    host.warnings.push('config.toml: not parsed');
  }
}

function checkAdoptTarget(library: string) {
  const allowed = resolve(homedir(), '.loadout');
  const rel = relative(allowed, resolve(library));
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('audit adoption must stay under ~/.loadout; unset the outside LOADOUT_HOME override');
  for (let dir = resolve(library, 'skills');; dir = dirname(dir)) {
    if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw new Error('audit adoption refuses a symlink in the loadout destination');
    if (relative(allowed, dir) === '' || dirname(dir) === dir) break;
  }
}

async function toolTokens(library: Capability[]): Promise<number> {
  const { server, gateway } = createServer({ library, config: DEFAULT_CONFIG });
  const client = new Client({ name: 'loadout-audit', version: '0.1.0' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(right);
    await client.connect(left);
    return tokens(JSON.stringify((await client.listTools()).tools));
  } finally {
    await client.close();
    await server.close();
    await gateway.close();
  }
}

export async function audit(cwd = process.cwd(), adopt = false): Promise<AuditReport> {
  const home = homedir();
  const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(home, '.claude');
  const codexHome = process.env.CODEX_HOME || join(home, '.codex');
  const openHome = join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode');
  const dirs = projectDirs(cwd);
  const claudeDirs = dirs.filter((dir) => relative(resolve(claudeHome), resolve(dir, '.claude')) !== '');
  const found = new Map<string, FoundSkill>();
  const seenDescriptions = new Set<string>();
  const hosts = ['Claude Code', 'Codex', 'OpenCode', 'Cursor'].map((host): HostAudit => ({ host, skills: [], listings: [], servers: [], descriptionCharacters: 0, estimatedTokens: 0, warnings: [] }));
  const disabledSkills = new Map<string, boolean>();
  const [claude, codex, open, cursor] = hosts as [HostAudit, HostAudit, HostAudit, HostAudit];
  const serverMaps = hosts.map(() => new Map<string, unknown>());
  const [claudeServers, codexServers, openServers, cursorServers] = serverMaps as [Map<string, unknown>, Map<string, unknown>, Map<string, unknown>, Map<string, unknown>];
  const userSettings = readJson(join(claudeHome, 'settings.json'), claude, 'user settings');
  const claudeSettings = object(userSettings.enabledPlugins);
  // Retain the scope files in precedence order so project-level "on" entries
  // can be hidden through local settings without changing shared settings.
  const overrideScopes = [{ file: resolve(claudeHome, 'settings.json'), overrides: object(userSettings.skillOverrides) }];
  for (const settings of ['settings.json', 'settings.local.json']) for (const dir of claudeDirs) {
    const file = join(dir, '.claude', settings);
    const config = readJson(file, claude, 'project settings');
    Object.assign(claudeSettings, object(config.enabledPlugins));
    overrideScopes.push({ file, overrides: object(config.skillOverrides) });
  }
  const skillOverrides = Object.fromEntries(overrideScopes.flatMap(({ overrides }) => Object.entries(overrides)));
  addSkillRoot(join(claudeHome, 'skills'), claude, found, '', resolve(claudeHome, 'settings.json'));
  addMarkdown(join(claudeHome, 'commands'), claude, seenDescriptions, 'commands', '', skillOverrides);
  addMarkdown(join(claudeHome, 'agents'), claude, seenDescriptions, 'agents');
  addSkillRoot(join(codexHome, 'skills'), codex, found);
  addSkillRoot(join(home, '.agents', 'skills'), codex, found);
  if (existsSync(join(codexHome, 'plugins'))) codex.warnings.push('Plugin cache skills are not counted: this audit cannot establish which cached plugins are enabled.');
  for (const root of [join(home, '.claude', 'skills'), join(home, '.agents', 'skills'), join(openHome, 'skill'), join(openHome, 'skills')]) addSkillRoot(root, open, found);
  for (const root of [join(home, '.cursor', 'skills'), join(home, '.claude', 'skills'), join(home, '.codex', 'skills'), join(home, '.agents', 'skills')]) addSkillRoot(root, cursor, found);
  const claudeConfig = readJson(join(process.env.CLAUDE_CONFIG_DIR || home, '.claude.json'), claude, 'user MCP config');
  addServers(claudeConfig.mcpServers, claudeServers);
  for (const dir of dirs) addServers(object(object(claudeConfig.projects)[dir]).mcpServers, claudeServers);
  codexConfig(join(codexHome, 'config.toml'), codex, codexServers, disabledSkills);
  addServers(readJson(join(home, '.cursor', 'mcp.json'), cursor, 'user MCP config').mcpServers, cursorServers);
  const openConfigs = [join(openHome, 'opencode.json'), join(openHome, 'opencode.jsonc')];
  for (const dir of dirs) {
    if (claudeDirs.includes(dir)) addSkillRoot(join(dir, '.claude', 'skills'), claude, found, '', join(dir, '.claude', 'settings.local.json'));
    addMarkdown(join(dir, '.claude', 'commands'), claude, seenDescriptions, 'commands', '', skillOverrides);
    addMarkdown(join(dir, '.claude', 'agents'), claude, seenDescriptions, 'agents');
    addSkillRoot(join(dir, '.agents', 'skills'), codex, found);
    codexConfig(join(dir, '.codex', 'config.toml'), codex, codexServers, disabledSkills);
    for (const root of [join(dir, '.claude', 'skills'), join(dir, '.agents', 'skills'), join(dir, '.opencode', 'skills'), join(dir, '.opencode', 'skill')]) addSkillRoot(root, open, found);
    for (const root of [join(dir, '.cursor', 'skills'), join(dir, '.claude', 'skills'), join(dir, '.codex', 'skills'), join(dir, '.agents', 'skills')]) addSkillRoot(root, cursor, found);
    addServers(readJson(join(dir, '.mcp.json'), claude, 'project MCP config').mcpServers, claudeServers);
    addServers(readJson(join(dir, '.cursor', 'mcp.json'), cursor, 'project MCP config').mcpServers, cursorServers);
    openConfigs.push(join(dir, 'opencode.json'), join(dir, 'opencode.jsonc'), join(dir, '.opencode', 'opencode.json'), join(dir, '.opencode', 'opencode.jsonc'));
  }
  claudePlugins(claudeHome, dirs, claude, found, seenDescriptions, claudeServers, claudeSettings);
  for (const configFile of [...new Set(openConfigs)]) {
    const config = readJson(configFile, open, 'MCP config');
    addServers(config.mcp, openServers);
  }
  for (const { capability, listings } of found.values()) for (const [identity, entry] of listings) {
    if (identity !== 'Claude Code:') continue;
    const name = capability.name;
    const override = skillOverrides[name];
    if (override === 'off' || override === 'user-invocable-only') claude.skills = claude.skills.filter((s) => s !== entry);
    else if (override === 'name-only') Object.assign(entry, listing(name));
  }
  for (const { capability, listings } of found.values()) if (disabledSkills.get(canonicalSkillPath(capability.source))) {
    const entry = listings.get('Codex:');
    codex.skills = codex.skills.filter((s) => s !== entry);
  }
  const openNames = new Map<Listing, string>();
  for (const skill of found.values()) {
    const entry = skill.listings.get('OpenCode:');
    if (entry) openNames.set(entry, skill.capability.name);
  }
  open.skills = [...new Map(open.skills.map((s) => [openNames.get(s)!, s])).values()];
  const active = new Set(hosts.flatMap((h) => h.skills));
  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[i]!;
    host.servers = [...serverMaps[i]!].filter(([, c]) => object(c).enabled !== false && object(c).disabled !== true).map(([name]) => ({ name: clean(name) }));
    host.descriptionCharacters = host.skills.reduce((sum, s) => sum + s.characters, 0);
    host.estimatedTokens = Math.ceil(host.descriptionCharacters / 4);
  }
  let library: Capability[];
  try { library = scanLibrary(paths.library()); } catch { throw new Error('Could not read the loadout library; the comparison is unavailable.'); }
  const descriptions = new Map([...found].filter(([, skill]) => [...skill.listings.values()].some((s) => active.has(s))).map(([path, skill]) => [path, skill.capability]));
  for (const c of library) if (c.kind === 'skill') descriptions.set(realpathSync(c.source), c);
  const picks = [...descriptions.values()].map((s) => listing(s.name, s.description).tokens).sort((a, b) => b - a).slice(0, Math.min(3, DEFAULT_CONFIG.maxSkills));
  const toolBudget = await toolTokens(library);
  const skillBudget = picks.reduce((a, b) => a + b, 0);
  const report: AuditReport = {
    method: 'Inventory estimate: "name: description" (or name alone for name-only overrides) at 4 characters per token, before host listing caps or truncation.',
    hosts,
    loadout: { toolTokens: toolBudget, pickedSkills: picks.length, skillTokens: skillBudget, estimatedTokens: toolBudget + skillBudget },
    summary: '',
    caveats: [
      'Claude Code keeps descriptions within 1% of the context window; Codex within 2% or 8,000 characters; OpenCode and Cursor do not document one; B1 measures what is actually sent.',
      'Claude Code always lists names; on overflow it drops descriptions from least-invoked skills first. Descriptions plus when_to_use are cut at 1,536 characters; skillListingBudgetFraction and SLASH_COMMAND_TOOL_CHAR_BUDGET configure the budget.',
      'MCP schemas, bundled skills and claude.ai connectors are not counted; no servers were started or contacted. Servers awaiting authentication add no tools. Codex/Cursor plugin caches are not inspected.',
      'OpenCode permission rules are not applied.',
      'loadout comparison covers real tool definitions plus up to 3 largest descriptions; bodies, suggestions and instructions are excluded.',
    ],
  };
  if (adopt) {
    checkAdoptTarget(paths.library());
    const destination = canonicalSkillPath(paths.library());
    report.adopted = { added: 0, updated: 0, skipped: 0 };
    const claudeOverrides = new Map<string, Map<string, 'user-invocable-only'>>();
    const plugins = new Set<string>();
    const codexSkills: { path: string; enabled: false }[] = [];
    for (const [source, { capability: skill, listings, settingsFiles }] of found) {
      if (![...listings.values()].some((s) => active.has(s))) continue;
      const rel = relative(destination, source);
      if (!isAbsolute(rel) && !rel.split(/[\\/]/).includes('..')) {
        report.adopted.skipped++;
        continue;
      }
      let result: ReturnType<typeof addSkills>;
      try { result = addSkills(skill.source, paths.library()); } catch {
        throw new Error('Could not adopt a discovered skill: check library locks and file access. Earlier copies were retained; host files were unchanged.');
      }
      report.adopted.added += result.added.length;
      report.adopted.updated += result.updated.length;
      report.adopted.skipped += result.skipped.length;
      if (!result.added.length && !result.updated.length) continue;
      for (const [identity, entry] of listings) {
        if (!active.has(entry)) continue;
        if (identity === 'Claude Code:') {
          if (Object.hasOwn(skillOverrides, skill.name) && skillOverrides[skill.name] !== 'on') continue;
          const destinations = new Set(settingsFiles);
          for (const file of settingsFiles) {
            const precedence = overrideScopes.findIndex((scope) => scope.file === file);
            for (const scope of overrideScopes.slice(precedence + 1)) {
              if (scope.overrides[skill.name] === 'on') destinations.add(join(dirname(scope.file), 'settings.local.json'));
            }
          }
          for (const file of destinations) {
            const overrides = claudeOverrides.get(file) ?? new Map<string, 'user-invocable-only'>();
            overrides.set(skill.name, 'user-invocable-only');
            claudeOverrides.set(file, overrides);
          }
        } else if (identity.startsWith('Claude Code:')) plugins.add(identity.slice('Claude Code:'.length, -1));
        else if (identity === 'Codex:') codexSkills.push({ path: resolve(skill.source, 'SKILL.md'), enabled: false });
      }
    }
    report.disable = {
      notice: 'Printed only; no host configs were changed.',
      claude: { settings: [...claudeOverrides].map(([file, overrides]) => ({ file, skillOverrides: Object.fromEntries(overrides) })), plugins: [...plugins] },
      codex: { file: resolve(codexHome, 'config.toml'), skills: codexSkills },
      guidance: [
        'OpenCode: deny adopted skill names under permission.skill, or move their folders out of discovery directories.',
        'Cursor: move adopted folders out of .cursor/.claude/.codex/.agents skill directories at user and project scope.',
      ],
    };
  }
  report.summary = hosts.map((h) => `${h.host}: ${h.skills.length} skills installed, ~${h.estimatedTokens.toLocaleString('en-US')} description tokens ${h.host === 'Claude Code' ? 'before its listing cap (1% of context)' : h.host === 'Codex' ? 'before its listing cap (2% or 8,000 characters)' : '(listing budget not documented)'}; ${h.servers.length} MCP servers configured; MCP schemas not counted.`).join('\n');
  return report;
}

export function formatAuditJson(value: object): string {
  return escapeControls(JSON.stringify(value, null, 2));
}

export function formatAudit(report: AuditReport): string {
  const lines = [report.summary, `loadout comparison: ~${report.loadout.estimatedTokens} tokens (${report.loadout.toolTokens} tokens for real tool definitions + ${report.loadout.skillTokens} for up to ${report.loadout.pickedSkills} descriptions).`, report.method];
  for (const host of report.hosts) {
    lines.push(`\n${host.host}: ${host.skills.length} skills, ${host.descriptionCharacters} description characters, ~${host.estimatedTokens} inventory tokens; ${host.servers.length} MCP servers configured`);
    if (host.listings.length) lines.push(`  Separate command/agent inventory: ${host.listings.length} descriptions, ${host.listings.reduce((sum, s) => sum + s.characters, 0)} characters.`);
    for (const entry of [...host.skills, ...host.listings]) lines.push(`  ${entry.name}: ${entry.description} (~${entry.tokens} tokens)`);
    for (const server of host.servers) lines.push(`  MCP ${server.name}: not counted (schemas unavailable offline)`);
    for (const warning of host.warnings) lines.push(`  warning: ${warning}`);
  }
  lines.push('', ...report.caveats);
  if (report.adopted) lines.push(`\nAdopted: ${report.adopted.added} added, ${report.adopted.updated} updated, ${report.adopted.skipped} skipped.`);
  if (report.disable) {
    const { notice, claude, codex, guidance } = report.disable;
    lines.push(notice);
    for (const { file, skillOverrides } of claude.settings) lines.push(
      `\nClaude Code: merge into ${escapeControls(JSON.stringify(file))} (keep other settings and overrides). /name stays available:`,
      '```json', formatAuditJson({ skillOverrides }), '```',
    );
    if (claude.plugins.length) lines.push('\nClaude Code: Disable these plugins via /plugin (skillOverrides does not apply):', ...claude.plugins.map((name) => `  ${escapeControls(JSON.stringify(name))}`));
    if (codex.skills.length) lines.push(
      `\nCodex: merge these entries into ${escapeControls(JSON.stringify(codex.file))} (update any existing entry for the same path). Restart Codex afterwards:`,
      '```toml', escapeControls(stringifyToml({ skills: { config: codex.skills } }).trimEnd(), true), '```',
    );
    lines.push(...guidance);
  }
  return lines.join('\n');
}
