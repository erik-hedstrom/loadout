import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  cpSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { paths, withoutKey } from './config.js';
import { isPlainFolder, writeCacheFile } from './safefs.js';
import type { Capability, McpServerConfig } from './types.js';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
/** Provenance written next to each installed skill: where it came from, so re-adding updates in place. */
const SOURCE_FILE = '.loadout-source.json';
/** Budgets against hostile or accidental giant repositories. */
const LIMITS = {
  cloneMs: 120_000,
  manifestBytes: 256 * 1024,
  skillFiles: 2_000,
  skillBytes: 20 * 1024 * 1024,
  skillDepth: 10,
  skillsPerAdd: 3_000,
  discoveryEntries: 200_000,
};

/**
 * Read a regular file inside `root` through a single descriptor. The last path
 * component is never a symlink (O_NOFOLLOW), and what was actually opened is
 * checked to lie inside `root`: through /proc on Linux, elsewhere by matching
 * the descriptor's inode with the resolved path's. Swapping a path component
 * between a check and the read therefore cannot redirect it. Throws otherwise.
 * Multi-file copies pin `realRoot` so later reads cannot reset confinement.
 */
export function readConfined(root: string, rel: string, maxBytes: number, realRoot = realpathSync(root)): Buffer {
  if (isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error('give a path relative to the skill folder');
  let fd: number;
  try {
    fd = openSync(join(root, rel), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  } catch {
    throw new Error('no such file in the skill');
  }
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) throw new Error('no such file in the skill');
    let opened: string;
    if (process.platform === 'linux') {
      opened = readlinkSync(`/proc/self/fd/${fd}`);
    } else {
      opened = realpathSync(join(root, rel));
      const now = statSync(opened);
      if (now.ino !== st.ino || now.dev !== st.dev) throw new Error('the file changed while it was opened');
    }
    if (!isInside(realRoot, opened)) throw new Error('path leaves the skill folder');
    if (st.size > maxBytes) throw new Error(`the file is larger than ${Math.round(maxBytes / 1024)} KB`);
    const buf = Buffer.alloc(st.size);
    return buf.subarray(0, readSync(fd, buf, 0, st.size, 0));
  } finally {
    closeSync(fd);
  }
}

export function copySkillConfined(source: string, destination: string): void {
  if (lstatSync(source).isSymbolicLink()) throw new Error('skill contains a link');
  const root = realpathSync(source);
  let files = 0;
  let bytes = 0;
  const walk = (rel: string, depth: number): void => {
    const path = join(root, rel);
    const st = lstatSync(path);
    if (st.isSymbolicLink()) throw new Error('skill contains a link');
    if (st.isDirectory()) {
      if (depth > LIMITS.skillDepth) throw new Error(`skill nested deeper than ${LIMITS.skillDepth} folders`);
      mkdirSync(join(destination, rel), { recursive: true });
      for (const entry of readdirSync(path)) walk(join(rel, entry), depth + 1);
    } else if (st.isFile()) {
      if (++files > LIMITS.skillFiles) throw new Error(`skill has more than ${LIMITS.skillFiles} files`);
      const maxBytes = Math.min(LIMITS.skillBytes - bytes, rel === 'SKILL.md' ? LIMITS.manifestBytes : LIMITS.skillBytes);
      const body = readConfined(root, rel, maxBytes, root);
      bytes += body.length;
      writeFileSync(join(destination, rel), body, { mode: st.mode });
    } else throw new Error('not a regular skill file');
  };
  walk('', 0);
}

/** A skill's SKILL.md text, or undefined if it is missing, a link, outside the folder or oversized. */
function readManifest(dir: string): string | undefined {
  try {
    return readConfined(dir, 'SKILL.md', LIMITS.manifestBytes).toString('utf8');
  } catch {
    return undefined;
  }
}

/** Folders never searched for skills or copied with them. */
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'target', '.venv', 'venv', '__pycache__']);

interface SkillSource {
  /** e.g. `github.com/obra/superpowers` or an absolute local path. */
  origin: string;
  /** Skill folder relative to the origin root. */
  path: string;
  revision?: string;
  addedAt: string;
}

function readSource(dir: string): SkillSource | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, SOURCE_FILE), 'utf8')) as SkillSource;
  } catch {
    return undefined;
  }
}

export function parseFrontmatter(text: string): Record<string, unknown> {
  const match = FRONTMATTER.exec(text);
  if (!match?.[1]) return {};
  try {
    const meta: unknown = parseYaml(match[1], { logLevel: 'error' });
    return meta !== null && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function parseSkill(dir: string): (Capability & { disableModelInvocation?: boolean }) | undefined {
  // Never follow a symlinked manifest, and never read an outsized one whole.
  const text = readManifest(dir);
  if (text === undefined) return undefined;
  const meta = parseFrontmatter(text);
  const name = typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : basename(dir);
  const description = typeof meta.description === 'string' ? meta.description.trim() : '';
  return skillCapability(dir, { name, description, ...(meta['disable-model-invocation'] === true ? { disableModelInvocation: true } : {}) });
}

function skillCapability(dir: string, metadata: Pick<Capability, 'name' | 'description'> & { disableModelInvocation?: boolean }): Capability & { disableModelInvocation?: boolean } {
  const origin = readSource(dir)?.origin;
  // The id is the library folder, which is unique; the name is what the skill calls itself.
  return { id: `skill:${basename(dir)}`, kind: 'skill', ...metadata, source: dir, ...(origin ? { origin } : {}) };
}

function subdirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => join(dir, e.name));
}

interface McpFile {
  /** Standard MCP config plus loadout-only fields, which are stripped before launch. */
  mcpServers?: Record<string, McpServerConfig & { description?: string; autoApprove?: boolean; gateway?: boolean }>;
}

export function readMcpServers(libraryDir: string): NonNullable<McpFile['mcpServers']> {
  const file = join(libraryDir, 'mcp.json');
  if (!existsSync(file)) return {};
  const text = readFileSync(file, 'utf8');
  let config: McpFile;
  try {
    config = JSON.parse(text) as McpFile;
  } catch {
    throw new Error('library mcp.json is not valid JSON');
  }
  return config.mcpServers ?? {};
}

const SCAN_CACHE_FILE = 'library-scan.json';
const SCAN_CACHE_BYTES = 32 * 1024 * 1024;
const RACY_WINDOW_MS = 2_000;
// Bump when parsing or cacheability changes: file fingerprints cannot detect changes to the code.
const SCAN_CACHE_VERSION = 2;
type CachedSkill = [folder: string, stamp: string, name: string, description: string, disableModelInvocation: boolean];
interface ScanCache {
  version: typeof SCAN_CACHE_VERSION;
  root: string;
  skills: CachedSkill[];
}

function manifestStamp(dir: string, cutoffNs: bigint): string | undefined {
  try {
    const st = lstatSync(join(dir, 'SKILL.md'), { bigint: true });
    // Coarse timestamp ticks can hide same-size edits during a scan; recent files must be parsed again.
    if (st.mtimeNs >= cutoffNs || st.ctimeNs >= cutoffNs) return undefined;
    // ctime catches edits with restored mtimes; inode and mode catch replacements and permission changes.
    return st.isFile() && st.size <= LIMITS.manifestBytes ? `${st.dev}:${st.ino}:${st.mode}:${st.size}:${st.mtimeNs}:${st.ctimeNs}` : undefined;
  } catch {
    return undefined;
  }
}

function readScanCache(dir: string, root: string): ScanCache | undefined {
  try {
    if (!isPlainFolder(dir)) return undefined;
    const cache: unknown = JSON.parse(readConfined(dir, SCAN_CACHE_FILE, SCAN_CACHE_BYTES).toString('utf8'));
    if (!cache || typeof cache !== 'object') return undefined;
    const c = cache as Partial<ScanCache>;
    if (c.version !== SCAN_CACHE_VERSION || c.root !== root || !Array.isArray(c.skills)) return undefined;
    for (const entry of c.skills) {
      if (!Array.isArray(entry) || entry.length !== 5 || !entry.slice(0, 4).every(v => typeof v === 'string') || typeof entry[4] !== 'boolean') return undefined;
    }
    return c as ScanCache;
  } catch {
    return undefined;
  }
}

export function scanLibrary(libraryDir: string, options: { cache?: boolean; skipped?: string[] } = {}): Capability[] {
  const dirs = subdirs(join(libraryDir, 'skills'));
  // Routing opts in; audit, doctor and other read-only callers must neither create nor refresh the cache.
  const cacheDir = options.cache ? paths.index() : undefined;
  const root = cacheDir && existsSync(join(libraryDir, 'skills')) ? realpathSync(join(libraryDir, 'skills')) : '';
  const cache = cacheDir ? readScanCache(cacheDir, root) : undefined;
  const cutoffNs = BigInt(Date.now() - RACY_WINDOW_MS) * 1_000_000n;
  const byFolder = new Map(cache?.skills.map(entry => [entry[0], entry]));
  const skills: CachedSkill[] = [];
  let changed = cache === undefined;
  const capabilities: Capability[] = [];
  for (const dir of dirs) {
    // A skill folder named "mcp:x" would share the key of the server x.
    if (basename(dir).startsWith('mcp:') || unofferable(basename(dir))) {
      options.skipped?.push(basename(dir));
      continue;
    }
    const stamp = cacheDir ? manifestStamp(dir, cutoffNs) : undefined;
    const cached = byFolder.get(basename(dir));
    const hit = stamp !== undefined && cached?.[1] === stamp;
    const skill = hit ? skillCapability(dir, { name: cached[2], description: cached[3], ...(cached[4] ? { disableModelInvocation: true } : {}) }) : parseSkill(dir);
    if (skill) capabilities.push(skill);
    const cacheable = cacheDir && skill && stamp !== undefined && (hit || manifestStamp(dir, cutoffNs) === stamp);
    if (cacheable) {
      skills.push([basename(dir), stamp, skill.name, skill.description, skill.disableModelInvocation === true]);
    }
    if (!hit && (cached || cacheable)) changed = true;
  }

  const mcpFile = join(libraryDir, 'mcp.json');
  for (const [name, { description = '', autoApprove, gateway, ...server }] of Object.entries(readMcpServers(libraryDir))) {
    // A server named "mcp:x" would share the key of a server named "x"; an empty name cannot be sent back.
    if (name === '' || name.startsWith('mcp:') || unofferable(`mcp:${name}`)) {
      options.skipped?.push(`mcp:${name}`);
      continue;
    }
    capabilities.push({ id: `mcp:${name}`, kind: 'mcp', name, description, source: mcpFile, server, autoApprove: autoApprove === true, gateway: gateway === true });
  }

  if (cacheDir && (changed || skills.length !== cache?.skills.length)) writeCacheFile(cacheDir, SCAN_CACHE_FILE, JSON.stringify({ version: SCAN_CACHE_VERSION, root, skills }), 'library metadata');
  return capabilities;
}

/** Where the library's skills came from: one entry per origin, with the revisions seen and a skill count. */
export function librarySources(libraryDir: string): { origin: string; skills: number; revisions: string[] }[] {
  const byOrigin = new Map<string, { skills: number; revisions: Set<string> }>();
  for (const dir of subdirs(join(libraryDir, 'skills'))) {
    const s = readSource(dir);
    const key = s?.origin ?? '(unknown)';
    const e = byOrigin.get(key) ?? { skills: 0, revisions: new Set<string>() };
    e.skills++;
    if (s?.revision) e.revisions.add(s.revision);
    byOrigin.set(key, e);
  }
  return [...byOrigin]
    .map(([origin, e]) => ({ origin, skills: e.skills, revisions: [...e.revisions] }))
    .sort((a, b) => b.skills - a.skills || a.origin.localeCompare(b.origin));
}

/**
 * Whether `escapeSkillTags` (launch.ts, which imports this module) would change the text. Skill folders, server
 * names and tool names the agent must name back exactly cannot hold tag text, so such ones are never offered.
 */
export const hasTagText = (text: string) => /<\/?skill/i.test(text);

/** The longest key the MCP tools take back; their input schemas cap it. */
export const KEY_CHARS = 200;
/** A key the agent could not send back exactly: escaping would change it, or the tools would refuse it. */
const unofferable = (key: string) => hasTagText(key) || key.length > KEY_CHARS;

/** Unique key of a capability: the skill's folder (names repeat across sources) or `mcp:<server>`. */
export const capabilityKey = (c: Capability) => (c.kind === 'skill' ? basename(c.source) : `mcp:${c.name}`);

/** A folder name made only of lowercase letters, digits and hyphens. */
export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'skill'
  );
}

const isInside = (parent: string, child: string) => {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
};

/** Skill folders under `root` at any depth. A skill's own subfolders are its resources, not more skills. */
export function findSkillDirs(root: string, maxDepth = 8, followLinks = false): string[] {
  const found: string[] = [];
  if (!existsSync(root) || (!followLinks && lstatSync(root).isSymbolicLink())) return found;
  const visited = new Set<string>();
  let entries = 0;
  const walk = (dir: string, depth: number) => {
    if (!existsSync(dir)) return;
    if (followLinks) {
      dir = realpathSync(dir);
      if (visited.has(dir) || !lstatSync(dir).isDirectory()) return;
      visited.add(dir);
    }
    if (existsSync(join(dir, 'SKILL.md'))) {
      found.push(dir);
      return;
    }
    if (depth >= maxDepth) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (++entries > LIMITS.discoveryEntries) throw new Error(`more than ${LIMITS.discoveryEntries} entries to search; point at a subfolder`);
      if ((entry.isDirectory() || (followLinks && entry.isSymbolicLink())) && !SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), depth + 1);
    }
  };
  walk(root, 0);
  return found;
}

/** Why a skill folder is too big to install, or undefined if it fits the budget. */
function overBudget(dir: string): string | undefined {
  let files = 0;
  let bytes = 0;
  const walk = (d: string, depth: number): string | undefined => {
    if (depth > LIMITS.skillDepth) return `nested deeper than ${LIMITS.skillDepth} folders`;
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || SKIP_DIRS.has(entry.name)) continue;
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        const why = walk(p, depth + 1);
        if (why) return why;
      } else if (entry.isFile()) {
        files++;
        bytes += statSync(p).size;
        if (files > LIMITS.skillFiles) return `more than ${LIMITS.skillFiles} files`;
        if (bytes > LIMITS.skillBytes) return `larger than ${LIMITS.skillBytes / 1024 / 1024} MB`;
      }
    }
    return undefined;
  };
  return walk(dir, 0);
}

export interface AddResult {
  added: string[];
  updated: string[];
  /** Name taken by a skill from another source: installed under a different folder. */
  renamed: { name: string; folder: string }[];
  skipped: { path: string; reason: string }[];
}

/** One `add` at a time per library: folder allocation and replacement are not safe to interleave. */
function withLock<T>(target: string, fn: () => T): T {
  const lock = join(target, '.lock');
  let fd: number;
  try {
    fd = openSync(lock, 'wx');
  } catch (err) {
    const stale = existsSync(lock) && Date.now() - statSync(lock).mtimeMs > 30 * 60_000;
    if (!stale) throw new Error(`another \`loadout add\` is running (remove ${lock} if it is not)`);
    rmSync(lock, { force: true });
    fd = openSync(lock, 'wx');
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    rmSync(lock, { force: true });
  }
}

/**
 * Copy every skill found under `from` into the library. A skill already
 * installed from the same origin and path is replaced (no stale files); a
 * name already taken by another source gets a disambiguated folder rather
 * than overwriting it. Symlinks and VCS/dependency folders are not copied,
 * and skills over the size budget are skipped with a reason.
 */
export function addSkills(
  from: string,
  libraryDir: string,
  opts: { origin?: string; base?: string; revision?: string } = {},
): AddResult {
  const root = resolve(from);
  const base = resolve(opts.base ?? root);
  const origin = opts.origin ?? base;
  mkdirSync(resolve(libraryDir, 'skills'), { recursive: true });
  // Containment is checked against the real location, so a symlinked library folder cannot redirect writes.
  const target = realpathSync(resolve(libraryDir, 'skills'));

  return withLock(target, () => {
    const installed = new Map<string, string>();
    for (const dir of subdirs(target)) {
      const s = readSource(dir);
      if (s) installed.set(`${s.origin}#${s.path}`, basename(dir));
    }

    const result: AddResult = { added: [], updated: [], renamed: [], skipped: [] };
    const owner = slug(origin.replace(/^github\.com\//, '').split('/')[0] ?? 'local');
    const dirs = findSkillDirs(root);
    if (dirs.length > LIMITS.skillsPerAdd) throw new Error(`${dirs.length} skills found (limit ${LIMITS.skillsPerAdd}); point at a subfolder`);
    for (const dir of dirs) {
      const path = relative(base, dir).split('\\').join('/') || '.';
      const skill = parseSkill(dir);
      if (!skill) {
        result.skipped.push({ path, reason: `SKILL.md is a symlink or larger than ${LIMITS.manifestBytes / 1024} KB` });
        continue;
      }
      const tooBig = overBudget(dir);
      if (tooBig) {
        result.skipped.push({ path, reason: tooBig });
        continue;
      }
      let folder = installed.get(`${origin}#${path}`);
      const update = folder !== undefined;
      if (!folder) {
        folder = slug(skill.name);
        if (existsSync(join(target, folder))) {
          const stem = `${folder}--${owner}`;
          folder = stem;
          for (let i = 2; existsSync(join(target, folder)); i++) folder = `${stem}-${i}`;
          result.renamed.push({ name: skill.name, folder });
        }
        installed.set(`${origin}#${path}`, folder);
      }
      const dest = join(target, folder);
      if (!isInside(target, dest)) {
        result.skipped.push({ path, reason: 'destination outside the library' });
        continue;
      }

      const staging = join(target, `.staging-${folder}-${process.pid}`);
      rmSync(staging, { recursive: true, force: true });
      cpSync(dir, staging, {
        recursive: true,
        filter: (src) => !lstatSync(src).isSymbolicLink() && !SKIP_DIRS.has(basename(src)),
      });
      const source: SkillSource = { origin, path, ...(opts.revision ? { revision: opts.revision } : {}), addedAt: new Date().toISOString() };
      writeFileSync(join(staging, SOURCE_FILE), JSON.stringify(source, null, 2) + '\n');
      // Keep the previous version until the new one is in place.
      const previous = join(target, `.previous-${folder}-${process.pid}`);
      const hadPrevious = existsSync(dest);
      if (hadPrevious) renameSync(dest, previous);
      try {
        renameSync(staging, dest);
      } catch (err) {
        if (hadPrevious) renameSync(previous, dest);
        throw err;
      }
      if (hadPrevious) rmSync(previous, { recursive: true, force: true });
      (update ? result.updated : result.added).push(folder);
    }
    return result;
  });
}

const GITHUB = /^(?:https:\/\/github\.com\/|github:)([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.+?))?)?\/?$/;

/** `https://github.com/owner/repo[/tree/ref/sub/path]` or `github:owner/repo`, else undefined. */
export function parseGitHub(spec: string): { owner: string; repo: string; ref?: string; subpath?: string } | undefined {
  const m = GITHUB.exec(spec.trim());
  if (!m) return undefined;
  return { owner: m[1]!, repo: m[2]!, ref: m[3], subpath: m[4] };
}

/**
 * Shallow-clone a GitHub repo and add its skills. Only `git` runs; nothing
 * from the repo is executed. Symlinks are checked out as plain files
 * (`core.symlinks=false`), so a repo cannot point outside itself.
 */
export function addFromGitHub(spec: string, libraryDir: string): AddResult {
  const gh = parseGitHub(spec);
  if (!gh) throw new Error(`not a GitHub URL: ${spec}`);
  const tmp = mkdtempSync(join(tmpdir(), 'loadout-src-'));
  const env = { ...withoutKey(), GIT_TERMINAL_PROMPT: '0' };
  try {
    const repoDir = join(tmp, 'repo');
    const args = ['-c', 'core.symlinks=false', 'clone', '--depth', '1', '--quiet', ...(gh.ref ? ['--branch', gh.ref] : []), `https://github.com/${gh.owner}/${gh.repo}.git`, repoDir];
    execFileSync('git', args, { stdio: ['ignore', 'ignore', 'pipe'], timeout: LIMITS.cloneMs, env });
    const revision = execFileSync('git', ['-C', repoDir, 'rev-parse', 'HEAD'], { encoding: 'utf8', env }).trim();
    const scanDir = gh.subpath ? resolve(repoDir, gh.subpath) : repoDir;
    if (gh.subpath && (!existsSync(scanDir) || !isInside(realpathSync(repoDir), realpathSync(scanDir)))) {
      throw new Error(`path not inside the repository: ${gh.subpath}`);
    }
    return addSkills(scanDir, libraryDir, { origin: `github.com/${gh.owner}/${gh.repo}`, base: repoDir, revision });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** The opening of a skill's instructions (SKILL.md body after the frontmatter), for the close reread. */
export function skillExcerpt(c: Capability, chars = 700): string | undefined {
  const body = skillBody(c);
  return body ? body.replace(/\s+/g, ' ').trim().slice(0, chars) : undefined;
}

/** The full SKILL.md body after the frontmatter. */
export function skillBody(c: Capability): string | undefined {
  if (c.kind !== 'skill') return undefined;
  return readManifest(c.source)?.replace(FRONTMATTER, '').trim() || undefined;
}
