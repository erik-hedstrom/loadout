import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parse as parseToml } from 'smol-toml';
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
const tokens = (text: string) => Math.ceil(text.length / 4);
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

interface Listing {
  name: string;
  description: string;
  characters: number;
  listingCharacters: number;
  tokens: number;
}
interface FoundSkill {
  capability: Capability;
  listings: Map<string, Listing>;
}
interface HostAudit {
  host: string;
  skills: Listing[];
  listings: Listing[];
  servers: { name: string }[];
  descriptionCharacters: number;
  budget: { characters: number | null; fullSkills: number | null; source: string | null; note: string };
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
  disable?: string[];
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

function listing(name: string, description: string, source = ''): Listing {
  const characters = `${name}: ${description}`.length;
  return { name: clean(name), description: clean(description), characters, listingCharacters: characters + (source ? ` (file: ${join(source, 'SKILL.md')})\n`.length : 0), tokens: Math.ceil(characters / 4) };
}

function projectDirs(cwd: string): string[] {
  const dirs: string[] = [];
  for (let dir = resolve(cwd);; dir = dirname(dir)) {
    dirs.unshift(dir);
    if (existsSync(join(dir, '.git')) || dir === resolve(homedir()) || dirname(dir) === dir) return dirs;
  }
}

function addSkillRoot(root: string, host: HostAudit, found: Map<string, FoundSkill>, prefix = '') {
  try {
    for (const dir of host.host === 'Codex' ? codexSkillDirs(root) : findSkillDirs(root)) {
      const skill = parseSkill(dir);
      if (!skill) {
        host.warnings.push('A skill manifest was skipped (linked, unreadable or oversized).');
        continue;
      }
      if (host.host === 'Claude Code' && parseFrontmatter(readConfined(dir, 'SKILL.md', MAX_MANIFEST_BYTES).toString('utf8'))['disable-model-invocation'] === true) continue;
      const key = realpathSync(dir);
      const discovered = found.get(key) ?? { capability: skill, listings: new Map<string, Listing>() };
      found.set(key, discovered);
      const identity = `${host.host}:${prefix}`;
      if (discovered.listings.has(identity)) continue;
      const entry = listing(prefix + skill.name, skill.description, dir);
      discovered.listings.set(identity, entry);
      host.skills.push(entry);
    }
  } catch {
    host.warnings.push('A skill directory could not be fully scanned; counts may be incomplete.');
  }
}

function addMarkdown(root: string, host: HostAudit, seen: Set<string>, kind: 'commands' | 'agents', prefix = '') {
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
        if (description) host.listings.push(listing(name, description));
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
  const disabled = new Set(Object.entries(settings).filter(([, enabled]) => enabled === false).map(([id]) => id.split('@')[0]!));
  const plugins = new Map<string, string>();
  for (const [id, enabled] of Object.entries(settings)) {
    const name = id.split('@')[0]!;
    if (enabled !== true || disabled.has(name)) continue;
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
    if (enabled === true && !disabled.has(name) && !plugins.has(name)) host.warnings.push('An enabled plugin has no readable installation; its entries are not counted.');
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

function codexSkillDirs(root: string): string[] {
  const found: string[] = [];
  const visited = new Set<string>();
  let entries = 0;
  const walk = (dir: string, depth: number) => {
    if (!existsSync(dir)) return;
    const real = realpathSync(dir);
    if (visited.has(real) || !lstatSync(real).isDirectory()) return;
    visited.add(real);
    if (++entries > MAX_DESCRIPTION_ENTRIES) throw new Error('skill discovery budget exceeded');
    if (existsSync(join(real, 'SKILL.md'))) { found.push(real); return; }
    if (depth >= MAX_DESCRIPTION_DEPTH) return;
    for (const entry of readdirSync(real, { withFileTypes: true })) if (entry.isDirectory() || entry.isSymbolicLink()) walk(join(real, entry.name), depth + 1);
  };
  walk(root, 0);
  return found;
}

function listingBudget(host: HostAudit): HostAudit['budget'] {
  let characters: number | null = null;
  let source: string | null = null;
  let note = 'budget not documented; B1 measures it';
  if (host.host === 'Codex') {
    characters = 8_000;
    source = 'https://developers.openai.com/codex/skills';
    note = '2% of model context; unknown-context fallback of 8,000 characters used here';
  } else if (host.host === 'Claude Code') {
    const override = Number(process.env.SLASH_COMMAND_TOOL_CHAR_BUDGET);
    characters = Number.isSafeInteger(override) && override > 0 ? override : 16_000;
    source = 'https://code.claude.com/docs/en/skills#troubleshooting';
    note = characters === 16_000 ? '2% of model context; unknown-context fallback of 16,000 characters used here' : 'SLASH_COMMAND_TOOL_CHAR_BUDGET override';
  }
  let remaining = characters ?? 0;
  let fullSkills = 0;
  for (const size of host.skills.map((s) => host.host === 'Codex' ? s.listingCharacters : s.characters).sort((a, b) => a - b)) {
    if (size > remaining) break;
    remaining -= size;
    fullSkills++;
  }
  return { characters, fullSkills: characters === null ? null : fullSkills, source, note };
}

function checkAdoptTarget(library: string) {
  const allowed = resolve(homedir(), '.loadout');
  const rel = relative(allowed, resolve(library));
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('audit adoption must stay under ~/.loadout; unset the outside LOADOUT_HOME override');
  for (let dir = resolve(library, 'skills');; dir = dirname(dir)) {
    if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw new Error('audit adoption refuses a symlink in the loadout destination');
    if (dir === allowed) break;
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
  const found = new Map<string, FoundSkill>();
  const seenDescriptions = new Set<string>();
  const hosts = ['Claude Code', 'Codex', 'OpenCode', 'Cursor'].map((host): HostAudit => ({ host, skills: [], listings: [], servers: [], descriptionCharacters: 0, budget: { characters: null, fullSkills: null, source: null, note: '' }, estimatedTokens: 0, warnings: [] }));
  const disabledSkills = new Map<string, boolean>();
  const permissions = new Map<string, string>();
  let complexPermissions = false;
  const [claude, codex, open, cursor] = hosts as [HostAudit, HostAudit, HostAudit, HostAudit];
  const serverMaps = hosts.map(() => new Map<string, unknown>());
  const [claudeServers, codexServers, openServers, cursorServers] = serverMaps as [Map<string, unknown>, Map<string, unknown>, Map<string, unknown>, Map<string, unknown>];
  addSkillRoot(join(claudeHome, 'skills'), claude, found);
  addMarkdown(join(claudeHome, 'commands'), claude, seenDescriptions, 'commands');
  addMarkdown(join(claudeHome, 'agents'), claude, seenDescriptions, 'agents');
  addSkillRoot(join(codexHome, 'skills'), codex, found);
  addSkillRoot(join(home, '.agents', 'skills'), codex, found);
  if (existsSync(join(codexHome, 'plugins'))) codex.warnings.push('Plugin cache skills are not counted: this audit cannot establish which cached plugins are enabled.');
  for (const root of [join(home, '.claude', 'skills'), join(home, '.agents', 'skills'), join(openHome, 'skill'), join(openHome, 'skills')]) addSkillRoot(root, open, found);
  for (const root of [join(home, '.cursor', 'skills'), join(home, '.claude', 'skills'), join(home, '.codex', 'skills'), join(home, '.agents', 'skills')]) addSkillRoot(root, cursor, found);
  const claudeSettings = object(readJson(join(claudeHome, 'settings.json'), claude, 'user settings').enabledPlugins);
  const claudeConfig = readJson(join(process.env.CLAUDE_CONFIG_DIR || home, '.claude.json'), claude, 'user MCP config');
  addServers(claudeConfig.mcpServers, claudeServers);
  for (const dir of dirs) addServers(object(object(claudeConfig.projects)[dir]).mcpServers, claudeServers);
  codexConfig(join(codexHome, 'config.toml'), codex, codexServers, disabledSkills);
  addServers(readJson(join(home, '.cursor', 'mcp.json'), cursor, 'user MCP config').mcpServers, cursorServers);
  const openConfigs = [join(openHome, 'opencode.json'), join(openHome, 'opencode.jsonc')];
  for (const dir of dirs) {
    addSkillRoot(join(dir, '.claude', 'skills'), claude, found);
    addMarkdown(join(dir, '.claude', 'commands'), claude, seenDescriptions, 'commands');
    addMarkdown(join(dir, '.claude', 'agents'), claude, seenDescriptions, 'agents');
    for (const settings of ['settings.json', 'settings.local.json']) Object.assign(claudeSettings, object(readJson(join(dir, '.claude', settings), claude, 'project settings').enabledPlugins));
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
    const config = readJson(configFile, open, 'MCP/skill permission config');
    addServers(config.mcp, openServers);
    const skillPermission = object(config.permission).skill;
    if (typeof skillPermission === 'string' && ['allow', 'ask', 'deny'].includes(skillPermission)) { permissions.clear(); permissions.set('*', skillPermission); }
    else if (skillPermission !== undefined && (typeof skillPermission !== 'object' || skillPermission === null || Array.isArray(skillPermission))) complexPermissions = true;
    else for (const [name, value] of Object.entries(object(skillPermission))) {
      if ((name === '*' || !/[*?\[\]{}]/.test(name)) && typeof value === 'string' && ['allow', 'ask', 'deny'].includes(value)) { permissions.delete(name); permissions.set(name, value); }
      else complexPermissions = true;
    }
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
  open.skills = [...new Map(open.skills.map((s) => [openNames.get(s)!, s]))].filter(([skillName]) => {
    let permission = 'allow';
    for (const [name, value] of permissions) if (name === '*' || name === skillName) permission = value;
    return permission !== 'deny';
  }).map(([, entry]) => entry);
  const active = new Set(hosts.flatMap((h) => h.skills));
  for (const [path, skill] of found) if (![...skill.listings.values()].some((s) => active.has(s))) found.delete(path);
  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[i]!;
    host.servers = [...serverMaps[i]!].filter(([, c]) => object(c).enabled !== false && object(c).disabled !== true).map(([name]) => ({ name: clean(name) }));
    host.descriptionCharacters = host.skills.reduce((sum, s) => sum + s.characters, 0);
    host.estimatedTokens = Math.ceil(host.descriptionCharacters / 4);
    host.budget = listingBudget(host);
  }
  let library: Capability[];
  try { library = scanLibrary(paths.library()); } catch { throw new Error('Could not read the loadout library; the comparison is unavailable.'); }
  const descriptions = new Map([...found].map(([path, skill]) => [path, skill.capability]));
  for (const c of library) if (c.kind === 'skill') descriptions.set(realpathSync(c.source), c);
  const picks = [...descriptions.values()].map((s) => listing(s.name, s.description).tokens).sort((a, b) => b - a).slice(0, Math.min(3, DEFAULT_CONFIG.maxSkills));
  const toolBudget = await toolTokens(library);
  const skillBudget = picks.reduce((a, b) => a + b, 0);
  const report: AuditReport = {
    method: 'Inventory estimate: "name: description" at 4 characters per token. Budget fit uses complete descriptions, smallest first; Codex includes manifest paths. Hosts can shorten descriptions or omit entries.',
    hosts,
    loadout: { toolTokens: toolBudget, pickedSkills: picks.length, skillTokens: skillBudget, estimatedTokens: toolBudget + skillBudget },
    summary: '',
    caveats: [
      'Inventory is not request overhead: hosts cap/truncate listings; B1 measures actual overhead. Locally disabled skills are excluded; project configs may require trust.',
      'MCP schemas and claude.ai connectors are not counted; no servers were started or contacted. Codex/Cursor plugin caches are not inspected.',
      'loadout comparison covers real tool definitions plus up to 3 largest descriptions; bodies, suggestions and instructions are excluded.',
      ...(complexPermissions ? ['OpenCode: permissions not applied for complex rules; inventory may include denied skills.'] : []),
    ],
  };
  if (adopt) {
    checkAdoptTarget(paths.library());
    report.adopted = { added: 0, updated: 0, skipped: 0 };
    for (const { capability: skill } of found.values()) {
      let result: ReturnType<typeof addSkills>;
      try { result = addSkills(skill.source, paths.library()); } catch {
        throw new Error('Could not adopt a discovered skill: check library locks and file access. Earlier copies were retained; host files were unchanged.');
      }
      report.adopted.added += result.added.length;
      report.adopted.updated += result.updated.length;
      report.adopted.skipped += result.skipped.length;
    }
    report.disable = [
      'Claude Code: move adopted skill folders out of discovery directories; disable their plugins in /plugin or enabledPlugins.',
      'Codex: disable adopted skills with [[skills.config]] path and enabled=false entries.',
      'OpenCode: deny adopted skill names under permission.skill, or move their folders out of discovery directories.',
      'Cursor: move adopted folders out of .cursor/.claude/.codex/.agents skill directories at user and project scope.',
    ];
  }
  report.summary = `Local skill inventory: ${hosts.map((h) => `${h.host}: ${h.skills.length} skills, ${h.servers.length} MCP, ${h.descriptionCharacters} description chars, ~${h.estimatedTokens} tokens`).join('; ')}. Hosts cap/truncate listings; these totals are not request overhead. MCP schemas/connectors not counted.`;
  return report;
}

export function formatAudit(report: AuditReport): string {
  const lines = [report.summary, `loadout comparison: ~${report.loadout.estimatedTokens} tokens (${report.loadout.toolTokens} tokens for real tool definitions + ${report.loadout.skillTokens} for up to ${report.loadout.pickedSkills} descriptions).`, report.method];
  for (const host of report.hosts) {
    lines.push(`\n${host.host}: ${host.skills.length} skills, ${host.descriptionCharacters} description characters, ~${host.estimatedTokens} inventory tokens; ${host.servers.length} MCP servers`);
    lines.push(host.budget.characters === null ? `  ${host.budget.note}` : `  Listing budget: ${host.budget.characters} characters; at most ~${host.budget.fullSkills} full skills fit (${host.host === 'Codex' ? 'paths included' : 'name/description estimate'}). ${host.budget.note}. Source: ${host.budget.source}`);
    if (host.listings.length) lines.push(`  Separate command/agent inventory: ${host.listings.length} descriptions, ${host.listings.reduce((sum, s) => sum + s.characters, 0)} characters.`);
    for (const entry of [...host.skills, ...host.listings]) lines.push(`  ${entry.name}: ${entry.description} (~${entry.tokens} tokens)`);
    for (const server of host.servers) lines.push(`  MCP ${server.name}: not counted (schemas unavailable offline)`);
    for (const warning of host.warnings) lines.push(`  warning: ${warning}`);
  }
  lines.push('', ...report.caveats);
  if (report.adopted) lines.push(`\nAdopted: ${report.adopted.added} added, ${report.adopted.updated} updated, ${report.adopted.skipped} skipped.`, ...report.disable!);
  return lines.join('\n');
}
