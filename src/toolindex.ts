import { createHash } from 'node:crypto';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { oneLine } from './launch.js';
import { readConfined } from './library.js';
import { isPlainFolder, writeCacheFile } from './safefs.js';
import type { Capability, McpServerConfig, ToolSummary } from './types.js';

/**
 * What `server_tools` learned about each gateway server, kept so a later search can match a goal to a
 * server by what its tools do without starting it. The text came from a third-party server and sits in
 * files anyone with write access to the loadout home can change, so it is read as untrusted: checked for
 * shape and size, only ever used to rank servers and in escaped Jev questions, never shown as instructions.
 *
 * One file per server, so sessions that list different servers at the same time cannot overwrite each
 * other, and no entry can crowd another out of a shared size cap.
 */
const FOLDER = 'mcp-tools';
const VERSION = 1;
/** What the writer keeps per server; JSON escaping of control characters can make 100 tools several times this raw size. */
const ENTRY_MAX_BYTES = 64 * 1024;
const FILE_MAX_BYTES = 2 * ENTRY_MAX_BYTES;
const MAX_TOOLS = 100;
const NAME_CHARS = 100;
const DESCRIPTION_CHARS = 200;

const ENTRY_FILE = /^[0-9a-f]{32}\.json$/;
const entryFile = (name: string) => `${createHash('sha256').update(name).digest('hex').slice(0, 32)}.json`;

/** Env and headers in a fixed order, so the same config always gives the same fingerprint. */
const sorted = (o: Record<string, string> | undefined) => Object.entries(o ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * Marks an entry stale when the server's command, URL, env or headers change: they often pick the account, tenant
 * or tool set. Not a check on the file, since anyone can compute it. Only the hash is stored, so no secret is
 * written; mcp.json already holds the same values in plain text beside it.
 */
const fingerprint = (s: McpServerConfig) =>
  createHash('sha256').update(JSON.stringify([s.command, s.args, s.cwd, s.url, s.type, sorted(s.env), sorted(s.headers)])).digest('hex');

const isTool = (t: unknown): t is ToolSummary => {
  const { name, description } = (t ?? {}) as Partial<ToolSummary>;
  return typeof name === 'string' && name.length <= NAME_CHARS && typeof description === 'string' && description.length <= DESCRIPTION_CHARS;
};

/** The remembered tools of a library server, or nothing when the file is missing, malformed, oversized, for another server or stale. */
function readEntry(folder: string, c: Capability): ToolSummary[] | undefined {
  try {
    const entry = JSON.parse(readConfined(folder, entryFile(c.name), FILE_MAX_BYTES).toString('utf8')) as Record<string, unknown>;
    const { version, name, fingerprint: f, tools } = entry ?? {};
    if (version !== VERSION || name !== c.name || f !== fingerprint(c.server!)) return undefined;
    if (!Array.isArray(tools) || tools.length === 0 || tools.length > MAX_TOOLS || !tools.every(isTool)) return undefined;
    return tools.map(({ name, description }) => ({ name, description }));
  } catch {
    return undefined;
  }
}

/**
 * Remember a server's tools after a successful listing (an empty one forgets them), and forget servers that
 * are no longer gateway servers in the library.
 */
export function rememberTools(dir: string, server: Capability, gateway: Capability[], tools: { name: string; description?: string }[]): void {
  const folder = join(dir, FOLDER);
  const kept: ToolSummary[] = [];
  let bytes = 0;
  for (const t of tools.slice(0, MAX_TOOLS)) {
    const tool = { name: oneLine(t.name, NAME_CHARS), description: oneLine(t.description ?? '', DESCRIPTION_CHARS) };
    bytes += Buffer.byteLength(JSON.stringify(tool)) + 1;
    if (bytes > ENTRY_MAX_BYTES) break;
    kept.push(tool);
  }
  if (kept.length > 0) {
    writeCacheFile(folder, entryFile(server.name), JSON.stringify({ version: VERSION, name: server.name, fingerprint: fingerprint(server.server!), tools: kept }), 'MCP tool index');
  }
  if (!isPlainFolder(folder)) return;
  // A listing with no tools means the old entry is wrong now, so it goes rather than keep advertising them.
  if (kept.length === 0) rmSync(join(folder, entryFile(server.name)), { force: true });
  const current = new Set(gateway.map((c) => entryFile(c.name)));
  try {
    for (const f of readdirSync(folder)) if (ENTRY_FILE.test(f) && !current.has(f)) rmSync(join(folder, f), { force: true });
  } catch {
    // No folder yet, or another session already removed it.
  }
}

/** The library with remembered tools attached to the servers they still describe. */
export function withTools(library: Capability[], dir: string | undefined): Capability[] {
  const folder = dir && join(dir, FOLDER);
  if (!folder || !library.some((c) => c.kind === 'mcp') || !isPlainFolder(folder)) return library;
  return library.map((c) => {
    const tools = c.kind === 'mcp' && c.server ? readEntry(folder, c) : undefined;
    return tools ? { ...c, tools } : c;
  });
}
