export type CapabilityKind = 'skill' | 'mcp';

export interface Capability {
  /** Unique within the library, e.g. `skill:pdf` or `mcp:github`. */
  id: string;
  kind: CapabilityKind;
  name: string;
  description: string;
  /** Skill directory (skills) or the library's mcp.json (MCP servers). */
  source: string;
  /** Where an installed skill came from, e.g. `github.com/obra/superpowers`. */
  origin?: string;
  /** MCP server config as it should be passed to the agent (MCP only). */
  server?: McpServerConfig;
  /** MCP only: the user trusts this server's tools to run without approval prompts. */
  autoApprove?: boolean;
  /**
   * MCP only: reachable mid-session through `loadout mcp`'s call_server_tool.
   * Opt-in, because approving that one tool approves every tool behind it.
   */
  gateway?: boolean;
}

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  type?: string;
  headers?: Record<string, string>;
}

/** Reports allow only server metadata that is useful without credentials. */
export function reportJson(value: unknown): string {
  return JSON.stringify(value, (key, v) => {
    if (key !== 'server' || !v || typeof v !== 'object') return v;
    const server = v as McpServerConfig;
    let url: string | undefined;
    if (server.url) {
      try {
        const parsed = new URL(server.url);
        url = parsed.origin + parsed.pathname;
      } catch { url = '[invalid URL]'; }
    }
    return {
      transport: server.url ? (server.type === 'sse' ? 'sse' : 'http') : 'stdio',
      command: server.command,
      argCount: server.args?.length ?? 0,
      url,
      env: Object.keys(server.env ?? {}),
      headers: Object.keys(server.headers ?? {}),
    };
  }, 2);
}

export type Tier = 'small' | 'medium' | 'large';
export const TIERS: readonly Tier[] = ['small', 'medium', 'large'];

export interface RepoSignals {
  name: string;
  files: string[];
  dependencies: string[];
  languages: Record<string, number>;
}

export interface ScoredCapability {
  capability: Capability;
  /** How well the capability fits the request, 0..1 (Jev router: expected fit level / 3). */
  p: number;
  /** P(fit is "made for exactly what the request asks"). */
  exact?: number;
  /** Share of the shortlist choice: how this candidate compares with the others. */
  share?: number;
  /** Put the full SKILL.md into the session: the user named it, or Jev found a clear winner. */
  inject?: 'mentioned' | 'clear';
}

/** Raw Jev answers behind a decision, kept so policies can be replayed offline. */
export interface RawRouting {
  /** The Jev model version that answered (e.g. jev-1.13.0). */
  model?: string;
  /** Option keys sent to the wide choice, in retrieval order. */
  candidates: string[];
  wide: { pick: Record<string, number>; need: Record<string, number>; tier: Record<string, number>; inputTokens: number; ms: number };
  /** Option keys reread in the second request, best wide pick first. */
  shortlist: string[];
  /** Capability id behind each shortlist option key, so stored answers can be replayed against a library. */
  sources?: Record<string, string>;
  close: {
    pick: Record<string, number>;
    fit: Record<string, Record<string, number>>;
    /** P(the candidate is specifically about something the request names). Absent in older runs. */
    specific?: Record<string, number>;
    inputTokens: number;
    ms: number;
  };
}

export interface RouteDecision {
  tier: Tier;
  tierProbabilities?: Partial<Record<Tier, number>>;
  /** Capabilities to load, most relevant first. */
  selected: ScoredCapability[];
  /** Also relevant but not loaded: shown to the user and offered to the agent as optional. */
  suggested: ScoredCapability[];
  /** Everything the router scored, for explanation and debugging. */
  scored: ScoredCapability[];
  router: 'jev' | 'lexical';
  /** 0..1: how strongly the request calls for a specialised skill at all. */
  need?: number;
  /** The router judged that the request needs no skill. */
  quiet?: boolean;
  /** Something degraded (e.g. Jev unreachable, fell back to keyword ranking). */
  warning?: string;
  raw?: RawRouting;
  stats: {
    librarySize: number;
    candidates: number;
    inputTokens?: number;
    costUsd?: number;
    ms: number;
  };
}
