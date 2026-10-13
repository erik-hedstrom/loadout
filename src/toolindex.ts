import { createHash } from 'node:crypto';
import { oneLine } from './launch.js';
import { readConfined, writeCacheFile } from './library.js';
import type { Capability, McpServerConfig, ToolSummary } from './types.js';

/**
 * What `server_tools` learned about each gateway server, kept so a later search can match a goal to a
 * server by what its tools do without starting it. The server's own words are untrusted when written and
 * again when read: a tampered file can only be dropped, never trusted, and only the checked fields are used.
 */
const FILE = 'mcp-tools.json';
const VERSION = 1;
const FILE_MAX_BYTES = 1024 * 1024;
const MAX_TOOLS = 100;
const NAME_CHARS = 100;
const DESCRIPTION_CHARS = 200;

interface Entry {
  fingerprint: string;
  tools: ToolSummary[];
}

/** Ties an entry to the command or URL that produced it; env and headers are left out because they hold secrets. */
const fingerprint = (s: McpServerConfig) => createHash('sha256').update(JSON.stringify([s.command, s.args, s.cwd, s.url, s.type])).digest('hex');

const isTool = (t: unknown): t is ToolSummary => {
  const { name, description } = (t ?? {}) as Partial<ToolSummary>;
  return typeof name === 'string' && name.length <= NAME_CHARS && typeof description === 'string' && description.length <= DESCRIPTION_CHARS;
};

function readIndex(dir: string): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  try {
    const file: unknown = JSON.parse(readConfined(dir, FILE, FILE_MAX_BYTES).toString('utf8'));
    const { version, servers } = (file ?? {}) as { version?: unknown; servers?: unknown };
    if (version !== VERSION || !servers || typeof servers !== 'object') return entries;
    for (const [name, e] of Object.entries(servers)) {
      const { fingerprint: f, tools } = (e ?? {}) as Partial<Entry>;
      if (typeof f === 'string' && Array.isArray(tools) && tools.length > 0 && tools.length <= MAX_TOOLS && tools.every(isTool)) {
        entries.set(name, { fingerprint: f, tools: tools.map(({ name, description }) => ({ name, description })) });
      }
    }
  } catch {
    // Missing, oversized or unreadable: search just has less to go on.
  }
  return entries;
}

/** Remember a server's tools after a successful listing. */
export function rememberTools(dir: string, name: string, server: McpServerConfig, tools: { name: string; description?: string }[]): void {
  const index = readIndex(dir);
  index.set(name, {
    fingerprint: fingerprint(server),
    tools: tools.slice(0, MAX_TOOLS).map((t) => ({ name: oneLine(t.name, NAME_CHARS), description: oneLine(t.description ?? '', DESCRIPTION_CHARS) })),
  });
  writeCacheFile(dir, FILE, JSON.stringify({ version: VERSION, servers: Object.fromEntries(index) }), 'MCP tool index');
}

/** The library with remembered tools attached to the servers they still describe. */
export function withTools(library: Capability[], dir: string | undefined): Capability[] {
  if (!dir || !library.some((c) => c.kind === 'mcp')) return library;
  const index = readIndex(dir);
  return library.map((c) => {
    const e = c.kind === 'mcp' && c.server ? index.get(c.name) : undefined;
    return e && e.fingerprint === fingerprint(c.server!) ? { ...c, tools: e.tools } : c;
  });
}
