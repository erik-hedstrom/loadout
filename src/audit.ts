import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DEFAULT_CONFIG, paths } from './config.js';
import { addSkills, findSkillDirs, parseSkill, readConfined, scanLibrary } from './library.js';
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
  tokens: number;
}
interface FoundSkill {
  capability: Capability;
  listings: Set<string>;
}
interface HostAudit {
  host: string;
  skills: Listing[];
  listings: Listing[];
  rules: { name: string; tokens: number | null }[];
  servers: { name: string; schemaTokens: null }[];
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

function listing(name: string, description: string): Listing {
  return { name: clean(name), description: clean(description), tokens: tokens(`${name}: ${description}`) };
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
    for (const dir of findSkillDirs(root)) {
      const skill = parseSkill(dir);
      if (!skill) {
        host.warnings.push('A skill manifest was skipped (linked, unreadable or oversized).');
        continue;
      }
      const key = realpathSync(dir);
      const discovered = found.get(key) ?? { capability: skill, listings: new Set<string>() };
      found.set(key, discovered);
      const identity = `${host.host}:${prefix}`;
      if (discovered.listings.has(identity)) continue;
      discovered.listings.add(identity);
      const entry = listing(prefix + skill.name, skill.description);
      host.skills.push(entry);
    }
  } catch {
    host.warnings.push('A skill directory could not be fully scanned; counts may be incomplete.');
  }
}

function metadata(text: string): { meta: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) return { meta: {}, body: text };
  return { meta: object(parseYaml(match[1]!)), body: text.slice(match[0].length) };
}

function addMarkdown(root: string, host: HostAudit, seen: Set<string>, kind: 'commands' | 'agents' | 'rules', prefix = '') {
  if (!existsSync(root) || lstatSync(root).isSymbolicLink()) return;
  const confinement = lstatSync(root).isFile() ? dirname(root) : root;
  let entries = 0;
  const walk = (path: string, depth: number) => {
    const st = lstatSync(path);
    if (st.isSymbolicLink()) return;
    if (++entries > MAX_DESCRIPTION_ENTRIES || depth > MAX_DESCRIPTION_DEPTH) throw new Error('description scan budget exceeded');
    if (st.isDirectory()) {
      for (const entry of readdirSync(path)) walk(join(path, entry), depth + 1);
    } else if (st.isFile() && path.endsWith(kind === 'rules' ? '.mdc' : '.md')) {
      try {
        const { meta, body } = metadata(readConfined(confinement, relative(confinement, path), MAX_MANIFEST_BYTES).toString('utf8'));
        const identity = JSON.stringify([host.host, kind, prefix, realpathSync(path)]);
        if (seen.has(identity)) return;
        seen.add(identity);
        const name = prefix + (typeof meta.name === 'string' ? meta.name : basename(path, kind === 'rules' ? '.mdc' : '.md'));
        const description = typeof meta.description === 'string' ? meta.description : '';
        if (kind === 'rules') host.rules.push({ name: clean(name), tokens: meta.alwaysApply === true ? tokens(body) : description ? listing(name, description).tokens : null });
        else if (description) host.listings.push(listing(name, description));
        else host.warnings.push(`A plugin ${kind} description is missing; its listing is not counted.`);
      } catch {
        host.warnings.push(`A ${kind} file could not be counted.`);
      }
    }
  };
  try { walk(root, 0); } catch { host.warnings.push(`A ${kind} directory could not be fully scanned.`); }
}

function addRule(file: string, host: HostAudit, name = basename(file)) {
  const text = readText(file, host, 'instruction file');
  if (text !== undefined) host.rules.push({ name: clean(name), tokens: tokens(text) });
}

function addServers(config: unknown, servers: Map<string, unknown>, prefix = '') {
  for (const [name, value] of Object.entries(object(config))) servers.set(prefix + name, { ...object(servers.get(prefix + name)), ...object(value) });
}

function claudePlugins(home: string, dirs: string[], host: HostAudit, found: Map<string, FoundSkill>, seen: Set<string>, servers: Map<string, unknown>, settings: Record<string, unknown>) {
  const installed = object(readJson(join(home, 'plugins', 'installed_plugins.json'), host, 'plugin registry').plugins);
  for (const [id, enabled] of Object.entries(settings)) {
    if (enabled !== true) continue;
    const installs = installed[id];
    if (!Array.isArray(installs)) {
      host.warnings.push('An enabled plugin has no readable installation; its entries are not counted.');
      continue;
    }
    const applicable = installs.map(object).reverse();
    const install = applicable.find((p) => typeof p.projectPath === 'string' && dirs.includes(resolve(p.projectPath))) ?? applicable.find((p) => p.scope === 'user');
    if (!install || typeof install.installPath !== 'string') continue;
    const dir = install.installPath;
    const name = id.split('@')[0]!;
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

function tomlServers(text: string, host: HostAudit): Map<string, unknown> {
  const servers = new Map<string, unknown>();
  let multiline = '';
  let current: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    let line = '';
    let quote = '';
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i]!;
      if (multiline) {
        if (raw.slice(i, i + 3) === multiline && (multiline === "'''" || raw[i - 1] !== '\\')) { multiline = ''; i += 2; }
        continue;
      }
      if (quote) {
        line += char;
        if (char === '\\' && quote === '"') line += raw[++i] ?? '';
        else if (char === quote) quote = '';
      } else if (char === '#') break;
      else if (raw.slice(i, i + 3) === '"""' || raw.slice(i, i + 3) === "'''") { multiline = raw.slice(i, i + 3); i += 2; }
      else { line += char; if (char === '"' || char === "'") quote = char; }
    }
    const header = /^\s*\[([^\[\]]+)\]\s*$/.exec(line);
    if (header) {
      current = undefined;
      const parts: string[] = [];
      let rest = header[1]!.trim();
      while (rest) {
        const key = /^(?:([\w-]+)|"((?:\\.|[^"\\])*)"|'([^']*)')\s*(\.|$)/.exec(rest);
        if (!key) break;
        try { parts.push(key[1] ?? key[3] ?? JSON.parse(`"${key[2]}"`) as string); } catch { break; }
        rest = rest.slice(key[0].length).trimStart();
      }
      if (!rest && parts[0] === 'mcp_servers' && parts[1]) {
        const name = parts[1];
        if (!servers.has(name)) servers.set(name, {});
        if (parts.length === 2) current = name;
      }
    } else {
      const enabled = /^\s*(?:enabled|"enabled"|'enabled')\s*=\s*(true|false)\s*$/.exec(line);
      if (current && enabled) servers.set(current, { enabled: enabled[1] === 'true' });
      else if (/^\s*mcp_servers\s*=/.test(line)) host.warnings.push('Inline TOML MCP tables are not counted; named [mcp_servers.*] tables are supported.');
    }
  }
  return servers;
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
  const hosts = ['Claude Code', 'Codex', 'OpenCode', 'Cursor'].map((host): HostAudit => ({ host, skills: [], listings: [], rules: [], servers: [], estimatedTokens: 0, warnings: [] }));
  const [claude, codex, open, cursor] = hosts as [HostAudit, HostAudit, HostAudit, HostAudit];
  const serverMaps = hosts.map(() => new Map<string, unknown>());
  const [claudeServers, codexServers, openServers, cursorServers] = serverMaps as [Map<string, unknown>, Map<string, unknown>, Map<string, unknown>, Map<string, unknown>];
  addSkillRoot(join(claudeHome, 'skills'), claude, found);
  addMarkdown(join(claudeHome, 'commands'), claude, seenDescriptions, 'commands');
  addMarkdown(join(claudeHome, 'agents'), claude, seenDescriptions, 'agents');
  addSkillRoot(join(codexHome, 'skills'), codex, found);
  addSkillRoot(join(home, '.agents', 'skills'), codex, found);
  if (existsSync(join(codexHome, 'plugins'))) codex.warnings.push('Plugin cache skills are not counted: this audit cannot establish which cached plugins are enabled.');
  for (const root of [join(openHome, 'skills'), join(openHome, 'skill'), join(home, '.claude', 'skills'), join(home, '.agents', 'skills')]) addSkillRoot(root, open, found);
  for (const root of [join(home, '.cursor', 'skills'), join(home, '.claude', 'skills'), join(home, '.codex', 'skills')]) addSkillRoot(root, cursor, found);
  const claudeSettings = object(readJson(join(claudeHome, 'settings.json'), claude, 'user settings').enabledPlugins);
  const claudeConfig = readJson(join(home, '.claude.json'), claude, 'user MCP config');
  addServers(claudeConfig.mcpServers, claudeServers);
  for (const dir of dirs) addServers(object(object(claudeConfig.projects)[dir]).mcpServers, claudeServers);
  const toml = readText(join(codexHome, 'config.toml'), codex, 'MCP config');
  if (toml !== undefined) addServers(Object.fromEntries(tomlServers(toml, codex)), codexServers);
  addServers(readJson(join(home, '.cursor', 'mcp.json'), cursor, 'user MCP config').mcpServers, cursorServers);
  const openConfigs = [join(openHome, 'opencode.json'), join(openHome, 'opencode.jsonc')];
  for (const dir of dirs) {
    addSkillRoot(join(dir, '.claude', 'skills'), claude, found);
    addMarkdown(join(dir, '.claude', 'commands'), claude, seenDescriptions, 'commands');
    addMarkdown(join(dir, '.claude', 'agents'), claude, seenDescriptions, 'agents');
    for (const settings of ['settings.json', 'settings.local.json']) Object.assign(claudeSettings, object(readJson(join(dir, '.claude', settings), claude, 'project settings').enabledPlugins));
    addSkillRoot(join(dir, '.agents', 'skills'), codex, found);
    const projectToml = readText(join(dir, '.codex', 'config.toml'), codex, 'project MCP config');
    if (projectToml !== undefined) addServers(Object.fromEntries(tomlServers(projectToml, codex)), codexServers);
    for (const root of [join(dir, '.claude', 'skills'), join(dir, '.agents', 'skills'), join(dir, '.opencode', 'skills'), join(dir, '.opencode', 'skill')]) addSkillRoot(root, open, found);
    for (const root of [join(dir, '.cursor', 'skills'), join(dir, '.claude', 'skills'), join(dir, '.codex', 'skills')]) addSkillRoot(root, cursor, found);
    addServers(readJson(join(dir, '.mcp.json'), claude, 'project MCP config').mcpServers, claudeServers);
    addServers(readJson(join(dir, '.cursor', 'mcp.json'), cursor, 'project MCP config').mcpServers, cursorServers);
    addRule(join(dir, '.cursorrules'), cursor);
    addRule(join(dir, 'AGENTS.md'), cursor);
    addMarkdown(join(dir, '.cursor', 'rules'), cursor, seenDescriptions, 'rules');
    openConfigs.push(join(dir, 'opencode.json'), join(dir, 'opencode.jsonc'), join(dir, '.opencode', 'opencode.json'), join(dir, '.opencode', 'opencode.jsonc'));
  }
  claudePlugins(claudeHome, dirs, claude, found, seenDescriptions, claudeServers, claudeSettings);
  if (process.env.OPENCODE_CONFIG) openConfigs.push(resolve(process.env.OPENCODE_CONFIG));
  if (process.env.OPENCODE_CONFIG_DIR) {
    const dir = resolve(process.env.OPENCODE_CONFIG_DIR);
    openConfigs.push(join(dir, 'opencode.json'), join(dir, 'opencode.jsonc'));
    addSkillRoot(join(dir, 'skills'), open, found);
    addSkillRoot(join(dir, 'skill'), open, found);
  }
  for (const configFile of [...new Set(openConfigs)]) {
    const config = readJson(configFile, open, 'MCP/instruction config');
    addServers(config.mcp, openServers);
    if (Array.isArray(config.instructions)) for (const instruction of config.instructions) {
      if (typeof instruction !== 'string') continue;
      if (/[*?\[\]]|^https?:\/\//.test(instruction)) open.warnings.push('A glob or remote instruction source is not counted.');
      else addRule(resolve(cwd, instruction), open, 'configured instruction');
    }
  }
  if (process.env.OPENCODE_CONFIG_CONTENT) open.warnings.push('OPENCODE_CONFIG_CONTENT is not inspected; counts may be incomplete.');
  addRule(join(openHome, 'AGENTS.md'), open);
  if (!existsSync(join(openHome, 'AGENTS.md'))) addRule(join(home, '.claude', 'CLAUDE.md'), open);
  const projectInstructions = [...dirs].reverse().find((dir) => existsSync(join(dir, 'AGENTS.md')) || existsSync(join(dir, 'CLAUDE.md')));
  if (projectInstructions) addRule(join(projectInstructions, existsSync(join(projectInstructions, 'AGENTS.md')) ? 'AGENTS.md' : 'CLAUDE.md'), open);
  for (let i = 0; i < hosts.length; i++) {
    const host = hosts[i]!;
    host.servers = [...serverMaps[i]!].filter(([, c]) => object(c).enabled !== false && object(c).disabled !== true).map(([name]) => ({ name: clean(name), schemaTokens: null }));
    host.estimatedTokens = [...host.skills, ...host.listings].reduce((sum, s) => sum + s.tokens, 0) + host.rules.reduce((sum, r) => sum + (r.tokens ?? 0), 0);
  }
  let library: Capability[];
  try { library = scanLibrary(paths.library()); } catch { throw new Error('Could not read the loadout library; the comparison is unavailable.'); }
  const descriptions = new Map([...found].map(([path, skill]) => [path, skill.capability]));
  for (const c of library) if (c.kind === 'skill') descriptions.set(realpathSync(c.source), c);
  const picks = [...descriptions.values()].map((s) => listing(s.name, s.description).tokens).sort((a, b) => b - a).slice(0, DEFAULT_CONFIG.maxSkills);
  const toolBudget = await toolTokens(library);
  const skillBudget = picks.reduce((a, b) => a + b, 0);
  const report: AuditReport = {
    method: 'Estimate: 4 characters per token; skill/command/agent listings use "name: description", always-on rules use their body, loadout tools use serialized definitions.',
    hosts,
    loadout: { toolTokens: toolBudget, pickedSkills: picks.length, skillTokens: skillBudget, estimatedTokens: toolBudget + skillBudget },
    summary: '',
    caveats: [
      'These are installed listing/rule estimates per request, not measured input tokens. Hosts may cap, truncate, disable, shadow or defer listings; project configs may require trust. B1 measures actual overhead.',
      'MCP schemas are not counted: these host configs contain connection settings, not offline tool definitions. No servers are started or contacted.',
      'loadout comparison uses its real MCP tools plus up to 3 largest found skill descriptions, an upper bound for those descriptions; it excludes loaded bodies, optional suggestions, server instructions and selected native MCP schemas.',
      'Cursor UI user rules and managed/remote host settings are not inspected. Conditional rule bodies are not counted.',
      'Codex/Cursor plugin registries are not verified by this scanner; cached plugin skills outside the listed native skill directories are not counted.',
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
      'Claude Code: move adopted user/project skill folders out of skills directories; disable their plugins in /plugin or enabledPlugins settings. Plugin commands/agents and MCP need separate disabling.',
      'Codex: move adopted folders out of CODEX_HOME/skills, ~/.agents/skills and project .agents/skills; set enabled = false in the relevant [mcp_servers.*] table if you also retire a server.',
      'OpenCode: move adopted folders out of .opencode/skills, ~/.config/opencode/skills and compatible .claude/.agents skill directories (including config overrides); set enabled: false for MCP entries you retire.',
      'Cursor: move adopted folders out of user/project .cursor/skills and compatible .claude/.codex directories; disable retired MCP servers in Cursor settings. Rules remain separate.',
      'Copies keep provenance and resources; no host configuration was changed. Only skills were adopted, not rules, commands, agents or MCP servers.',
    ];
  }
  report.summary = `Listing/rule estimates per request: ${hosts.map((h) => `${h.host}: ${h.skills.length} skills, ${h.servers.length} MCP, ~${h.estimatedTokens} tokens`).join('; ')}; loadout: ~${report.loadout.estimatedTokens} tokens (tools + up to 3 descriptions; MCP schemas uncounted).`;
  return report;
}

export function formatAudit(report: AuditReport): string {
  const lines = [report.summary, report.method];
  for (const host of report.hosts) {
    lines.push(`\n${host.host}: ${host.skills.length} skills, ${host.listings.length} command/agent descriptions, ${host.rules.length} rules, ${host.servers.length} MCP servers; ~${host.estimatedTokens} counted tokens/request`);
    for (const entry of [...host.skills, ...host.listings]) lines.push(`  ${entry.name}: ${entry.description} (~${entry.tokens} tokens)`);
    for (const rule of host.rules) lines.push(`  rule ${rule.name}: ${rule.tokens === null ? 'not counted (conditional body)' : `~${rule.tokens} tokens`}`);
    for (const server of host.servers) lines.push(`  MCP ${server.name}: not counted (schemas unavailable offline)`);
    for (const warning of host.warnings) lines.push(`  warning: ${warning}`);
  }
  lines.push('', ...report.caveats);
  if (report.adopted) lines.push(`\nAdopted: ${report.adopted.added} added, ${report.adopted.updated} updated, ${report.adopted.skipped} skipped.`, ...report.disable!);
  return lines.join('\n');
}
