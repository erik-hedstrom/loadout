/**
 * B7: what configured MCP servers cost per request, natively and through loadout's gateway. Nothing is
 * spent without `--run`; the method, the arms, the estimate and the commands are in docs/loop/BACKLOG.md
 * (B7) and bench/RESULTS.md ("B7 method").
 *
 * Why it is built this way: Claude Code defers MCP definitions by default, so every configuration is read at
 * both ends, tool search off (all loaded) and the host default, and no arm may read as "deferred" unless the
 * tools were actually there (positive controls). Claude's requests (two measured, and a canary lookup where
 * deferral may be claimed) share one process with `--no-session-persistence`, so no transcript lands in ~/.claude;
 * Codex gets one `--ephemeral` request.
 */
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir, tmpdir, userInfo } from 'node:os';
import { basename, dirname, join, posix, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { asJson } from '../src/launch.js';
import { createServer } from '../src/mcp.js';
import type { Capability } from '../src/types.js';
import { assertTemporary, claudeIsolation, cli, codexSettings, execute, MODELS, parseClaudeTurns, parseCodex, parsePromptInput, validateFeatures, withAppServer, type Command, type Host, type ToolCall } from './overhead.js';
import { catalogFacts, serverSpecs, serverTools, type Facts, type ServerSpec } from './mcp-fixtures.js';
import { isEntry } from './lib.js';

const LOADOUT_TOOLS = ['find_tools', 'load_skill', 'server_tools', 'call_server_tool'];
const PROMPTS = ['Reply with exactly OK. Do not use tools, skills, commands, agents, or external services.', 'Reply with exactly OK again. Do not use tools, skills, commands, agents, or external services.'] as const;
const CONFIGS = { n1: 1, n5: 5, n20: 20 } as const;
const TOOL_SEARCH = ['default', 'false', 'auto'] as const;
const FIXTURE_SERVER = fileURLToPath(new URL('./mcp-fixture-server.ts', import.meta.url));
const B1_INPUT_PER_CALL = 8_500;
// Assumptions, not measurements: characters per token, and seconds per request (the hard cap is execute()'s 120 s).
const CHARS_PER_TOKEN = 3;
const SECONDS_PER_REQUEST = 30;
// `--max-turns` bounds the canary lookup: a ToolSearch for loadout's tool, find_tools, server_tools and the answer. The
// cli-reference says "With `--input-format stream-json`, a message still queued when the limit ends a turn stays queued
// and starts a new turn with its own limit" (code.claude.com/docs/en/cli-reference); each message here is sent after the
// previous result. A run has not confirmed it is per message; a cumulative limit would fail the canary turn loudly.
const MAX_TURNS = 4;

export type ConfigName = keyof typeof CONFIGS;
export type ToolSearch = typeof TOOL_SEARCH[number];
export interface Arm { host: Host; kind: 'baseline' | 'native' | 'gateway'; config?: ConfigName; toolSearch?: ToolSearch }
export const armId = (a: Arm) => [a.host, a.kind, a.config, a.toolSearch].filter(Boolean).join('/');

export function arms(): Arm[] {
  const out: Arm[] = [];
  for (const host of ['claude', 'codex'] as const) {
    out.push({ host, kind: 'baseline' });
    for (const config of Object.keys(CONFIGS) as ConfigName[]) {
      if (host === 'codex') out.push({ host, kind: 'native', config }, { host, kind: 'gateway', config });
      else {
        for (const toolSearch of TOOL_SEARCH) out.push({ host, kind: 'native', config, toolSearch });
        for (const toolSearch of ['default', 'false'] as const) out.push({ host, kind: 'gateway', config, toolSearch });
      }
    }
  }
  return out;
}

// --- Offline: characters only ---------------------------------------------------------------

export interface OfflineRow extends Facts { kind: 'native' | 'gateway'; config: ConfigName; libraryDefinitionChars?: number }

const serverConfig = (spec: ServerSpec) => ({ command: process.execPath, args: ['--import', import.meta.resolve('tsx'), FIXTURE_SERVER, spec.name] });

/** loadout's own fixed cost: its tool definitions and server instructions, as an MCP client receives them. */
export async function loadoutFacts(specs: ServerSpec[]): Promise<Facts> {
  const library: Capability[] = specs.map((s) => ({ id: `mcp:${s.name}`, kind: 'mcp', name: s.name, description: s.archetype, source: '', server: serverConfig(s), autoApprove: false, gateway: true }));
  const { server, gateway } = createServer({ library, config: DEFAULT_CONFIG });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'b7-offline', version: '0.0.1' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  try {
    const { tools } = await client.listTools();
    return { servers: specs.length, tools: tools.length,
      definitionChars: tools.reduce((n, t) => n + JSON.stringify(t).length, 0),
      nameChars: tools.reduce((n, t) => n + `mcp__loadout__${t.name}`.length, 0),
      instructionChars: client.getInstructions()?.length ?? 0 };
  } finally { await client.close(); await gateway.close(); }
}

export async function offline(): Promise<OfflineRow[]> {
  const rows: OfflineRow[] = [];
  for (const [config, n] of Object.entries(CONFIGS) as [ConfigName, number][]) {
    const native = catalogFacts(n);
    rows.push({ kind: 'native', config, ...native });
    rows.push({ kind: 'gateway', config, ...await loadoutFacts(serverSpecs(n)), libraryDefinitionChars: native.definitionChars });
  }
  return rows;
}

export function formatOffline(rows: OfflineRow[]): string {
  const lines = ['Fixture facts, characters of what the host would hold. Not tokens, not a result.',
    'All loaded = definitions + instructions (tool search off). Search on = qualified names + instructions, a lower bound: the host\'s own list format and its tool-search tool are not counted.',
    '| Config | Kind | Servers | Tools | Definition chars | Name chars | Instruction chars | All loaded | Search on | Behind gateway |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
  for (const r of rows) lines.push(`| ${r.config} | ${r.kind} | ${r.servers} | ${r.tools} | ${r.definitionChars} | ${r.nameChars} | ${r.instructionChars} | ${r.definitionChars + r.instructionChars} | ${r.nameChars + r.instructionChars} | ${r.libraryDefinitionChars ?? ''} |`);
  lines.push('Gateway rows are loadout\'s own tools (find_tools, load_skill, server_tools, call_server_tool) and instructions; the library servers\' definitions stay behind the gateway and enter the context only when the agent asks for them.');
  return lines.join('\n');
}

// --- Plan ------------------------------------------------------------------------------------

export interface Canary { server: string; tool: string; qualified: string }
export interface Run { arm: Arm; repeat: number; servers: string[]; requests: number; command: Command; canary?: Canary; free?: { features: Command; prompt: Command; version: Command; inventory: Command } }
export interface Plan { runs: Run[]; blockers: string[]; root: string; work: string }
export interface Only { hosts?: Host[]; configs?: ConfigName[]; repeats?: number }

// A variable can redirect writes (DEBUG with CLAUDE_CODE_DEBUG_LOGS_DIR, updaters, base URLs) to places hostWrites does not
// list, and rounds 3 to 6 kept finding one more. So a CLI child gets the names of its own host only, when they are set.
const COMMON_ENV = ['PATH', 'HOME', 'USERPROFILE', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'TMPDIR', 'TMP', 'TEMP', 'SHELL',
  'SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'COMSPEC', 'PATHEXT', 'USERNAME', 'USERDOMAIN',
  // a corporate machine needs these to reach the API
  'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR'];
// Cache, certificate and Codex home overrides. Claude's home is fresh and its subscription token is injected only at launch.
// API keys would bill cash under `-p`, so are excluded (backlog B7). Names: code.claude.com/docs/en/env-vars; codex-rs at cf0ed4c.
const HOST_ENV: Record<Host, string[]> = {
  claude: ['XDG_CACHE_HOME', 'NODE_EXTRA_CA_CERTS', 'CLAUDE_CODE_CERT_STORE', 'CLAUDE_CODE_CLIENT_CERT', 'CLAUDE_CODE_CLIENT_KEY'],
  codex: ['CODEX_HOME', 'CODEX_SQLITE_HOME', 'CODEX_CA_CERTIFICATE'],
};
export const envAllowlist = (host: Host) => [...COMMON_ENV, ...HOST_ENV[host]];
export const childEnv = (base: NodeJS.ProcessEnv, host: Host): NodeJS.ProcessEnv => {
  const allowed = envAllowlist(host);
  return Object.fromEntries(Object.entries(base).filter(([name, value]) => value !== undefined && allowed.includes(name.toUpperCase())));
};

/**
 * The child environment for Claude: the tool search setting is explicit in every arm and updates are off, so no new CLI is
 * installed mid-study (code.claude.com/docs/en/env-vars, read 2026-10-14: `DISABLE_AUTOUPDATER` "disable automatic
 * background updates", `DISABLE_UPDATES` "block all updates ... stricter"). The login token the child may hold must not reach
 * the MCP servers it starts: `CLAUDE_CODE_MCP_ALLOWLIST_ENV` "spawn[s] stdio MCP servers with only a safe baseline environment
 * plus the server's configured `env`", and `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` strips credentials from subprocess environments
 * (CLI 2.1.83; by variable name from 2.1.251). A CLI too old to know either is not detectable offline: see the precondition.
 * Auto memory is off ("does not create or load auto memory files"), no CLAUDE.md memory file is loaded ("including user, project, and
 * auto memory files"), and the system-wide managed skills directory is skipped (env-vars, read 2026-10-14).
 */
/**
 * `--settings` for Claude: hooks off, and AGENTS.md off. A built-in plugin reads AGENTS.md as project instructions, and its
 * setting is read from a `--settings` file; `managed-only` leaves only the managed CLAUDE.md and auto memory (docs/en/memory,
 * "Choose which instruction files load"). The pre-2.1.285 plugin ID is used because later versions read either.
 */
export const CLAUDE_SETTINGS = { disableAllHooks: true, pluginConfigs: { 'agents-md@builtin': { options: { instructionFiles: 'managed-only' } } } };

export function claudeEnv(base: NodeJS.ProcessEnv, toolSearch: ToolSearch = 'default'): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, MCP_TIMEOUT: '60000', DISABLE_AUTOUPDATER: '1', DISABLE_UPDATES: '1', CLAUDE_CODE_MCP_ALLOWLIST_ENV: '1', CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1', CLAUDE_CODE_DISABLE_CLAUDE_MDS: '1', CLAUDE_CODE_DISABLE_POLICY_SKILLS: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
  if (toolSearch !== 'default') env.ENABLE_TOOL_SEARCH = toolSearch;
  return env;
}

/** The last tool of the last server of a configuration, which a host that stopped ingesting early would lose; one per config. */
export function canaryOf(config: ConfigName): Canary {
  const spec = serverSpecs(CONFIGS[config]).at(-1)!;
  const tool = serverTools(spec).at(-1)!.name;
  return { server: spec.name, tool, qualified: `mcp__${spec.name}__${tool}` };
}
const canaryPrompt = (c: Canary) => `Find the tool "${c.tool}" of the MCP server "${c.server}" with the tool lookup available to you, and reply with exactly its name. Do not use any other tool.`;
const CANARY_TOOLS = ['ToolSearch', 'mcp__loadout__find_tools', 'mcp__loadout__server_tools'];
/**
 * The lookup must have answered in the host's own structure, not in text that mentions the tool (a reply, an error or an
 * echoed query could): tool search, a tool_reference block naming exactly the qualified tool; the gateway, a server_tools
 * result for the canary's server with the tool's own line (`- "<tool>": ` in a listing, `"<tool>": ` for one tool). Errors
 * never count. The name is quoted with the gateway's own asJson, so a change to its format fails the real-gateway test.
 */
export function canaryFound(arm: Arm, canary: Canary, calls: ToolCall[]): boolean {
  return calls.some((c) => {
    if (c.isError) return false;
    if (arm.kind !== 'gateway') return c.name === 'ToolSearch' && c.content.some((b) => b.type === 'tool_reference' && b.tool_name === canary.qualified);
    const server = String((c.input as { server?: unknown } | null)?.server ?? '').replace(/^mcp:/, '');
    return c.name === 'mcp__loadout__server_tools' && server === canary.server
      && c.content.some((b) => b.type === 'text' && (b.text ?? '').split('\n').some((line) => line.startsWith(`- ${asJson(canary.tool)}: `) || line.startsWith(`${asJson(canary.tool)}: `)));
  });
}

function gatewayServer(root: string, config: ConfigName) {
  const home = join(root, 'homes', config);
  assertTemporary(home);
  mkdirSync(join(home, 'library'), { recursive: true });
  const servers = Object.fromEntries(serverSpecs(CONFIGS[config]).map((s) => [s.name, { ...serverConfig(s), description: `${s.archetype} fixture`, gateway: true }]));
  writeFileSync(join(home, 'library', 'mcp.json'), JSON.stringify({ mcpServers: servers }));
  writeFileSync(join(home, 'config.json'), JSON.stringify({ embeddings: false }));
  return { command: process.execPath, args: ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL('../src/cli.ts', import.meta.url)), 'mcp', '--lexical'], env: { LOADOUT_HOME: home } };
}

/** Every command of every arm runs here, emptied before each: both hosts put the working directory in the prompt, and a host may write into it. */
export function resetWork(work: string) {
  assertTemporary(work);
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
}

const userMessage = (text: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } });

// A macOS configuration profile lands as a plist for the device or for the user in this folder (the macOS convention; the
// domains are from the Claude docs and codex-rs, and the folder is unverified on a Mac).
const managedPlists = (domain: string) => ['/Library/Managed Preferences', posix.join('/Library/Managed Preferences', userInfo().username)].map((d) => posix.join(d, `${domain}.plist`));

/**
 * What Claude Code reads that an administrator controls (code.claude.com/docs/en/managed-settings and /server-managed-settings,
 * read 2026-10-14): the managed settings files and the macOS profile domain com.anthropic.claudecode. The fresh home excludes
 * the user's server-managed cache (docs/en/env-vars: CLAUDE_CONFIG_DIR). Nothing in `--settings` overrides a managed key,
 * and a managed `env` block is applied inside the child after the allowlist. Not checked: the Windows registry (HKLM or HKCU SOFTWARE\Policies\ClaudeCode) and a Windows
 * policy inherited by WSL.
 */
const claudeManagedDir = (platform: NodeJS.Platform) => platform === 'darwin' ? '/Library/Application Support/ClaudeCode' : platform === 'win32' ? 'C:\\Program Files\\ClaudeCode' : '/etc/claude-code';
export function managedClaudeFiles(platform: NodeJS.Platform = process.platform): string[] {
  const dir = claudeManagedDir(platform);
  return [...['managed-settings.json', 'managed-settings.d', 'managed-mcp.json'].map((f) => (platform === 'win32' ? win32 : posix).join(dir, f)),
    ...(platform === 'darwin' ? managedPlists('com.anthropic.claudecode') : [])];
}

/** Host paths reach notes that are committed with the results, so a user's directories appear as variables, never as /home/<user>. */
export function redacted(file: string, env: NodeJS.ProcessEnv = process.env): string {
  const swaps: [string, string][] = [[env.CODEX_HOME || join(homedir(), '.codex'), '$CODEX_HOME'],
    [posix.join('/Library/Managed Preferences', userInfo().username), '/Library/Managed Preferences/<user>'], [homedir(), '~']];
  return swaps.reduce((path, [from, to]) => (path.startsWith(from) ? to + path.slice(from.length) : path), file);
}

export function buildPlan(root: string, only: Only = {}, env: NodeJS.ProcessEnv = process.env, claudeManaged: string[] = refusedFiles('claude')): Plan {
  assertTemporary(root);
  const work = join(root, 'work');
  resetWork(work);
  const hosts = only.hosts ?? ['claude', 'codex'];
  const blockers: string[] = [];
  if (hosts.includes('claude') && claudeManaged.length) blockers.push(`Claude state the study cannot isolate exists (${claudeManaged.map((f) => redacted(f)).join(', ')}): managed settings override --settings and can set env and paths, and instructions above the working directory may load; run the study on a machine and account without them`);
  if (hosts.includes('claude') && !env.CLAUDE_CODE_OAUTH_TOKEN) blockers.push('Claude arms require CLAUDE_CODE_OAUTH_TOKEN for personal subscription login on a fresh empty Claude home');
  const runs: Run[] = [];
  for (const arm of arms()) {
    if (!hosts.includes(arm.host) || (arm.config && only.configs && !only.configs.includes(arm.config))) continue;
    const clean = childEnv(env, arm.host);
    const servers: Record<string, object> = arm.kind === 'native' ? Object.fromEntries(serverSpecs(CONFIGS[arm.config!]).map((s) => [s.name, serverConfig(s)]))
      : arm.kind === 'gateway' ? { loadout: gatewayServer(root, arm.config!) } : {};
    const binary = cli(arm.host);
    const command = (args: string[], extra: Partial<Command> = {}): Command => ({ bin: binary.bin, args: [...binary.prefix, ...args], cwd: work, ...extra });
    // A free Codex command gets its own empty CODEX_HOME and no CODEX_SQLITE_HOME, so it reads nothing of the user's and
    // writes nothing there: prompt-input takes global instructions from the home (codex-rs/cli/src/main.rs), and the
    // app-server and exec open their state databases in it (codex-rs/state/src/runtime.rs; config_toml.rs for sqlite_home).
    // The MCP inventory takes auth as optional (codex-rs/app-server/src/request_processors/mcp_processor.rs): the pilot confirms it lists without a login.
    const free = (name: string, args: string[]): Command => {
      const home = join(root, 'codex-homes', `${armId(arm).replaceAll('/', '-')}-${name}`);
      assertTemporary(home);
      mkdirSync(home, { recursive: true });
      const freeEnv: NodeJS.ProcessEnv = { ...clean, CODEX_HOME: home };
      delete freeEnv.CODEX_SQLITE_HOME;
      return command(args, { env: freeEnv });
    };
    // Codex starts every configured server at startup; required makes a failed start fail the run, not shrink the arm.
    const settings = codexSettings(Object.fromEntries(Object.entries(servers).map(([name, s]) => [name, { ...s, required: true }])));
    // Where an arm may claim deferral, a third message asks for a distinctive tool through the host's lookup; its
    // result is checked and nothing in it is measured. Tool search off is exact from the init list, and Codex has no
    // second turn: its one request would absorb the lookup, so its control is the app-server inventory.
    const canary = arm.host === 'claude' && (arm.kind === 'gateway' || (arm.kind === 'native' && arm.toolSearch !== 'false')) ? canaryOf(arm.config!) : undefined;
    for (let repeat = 1; repeat <= (only.repeats ?? 2); repeat++) {
      if (arm.host === 'claude') {
        const homes = join(root, 'claude-homes');
        mkdirSync(homes, { recursive: true });
        // Plugin registrations can point outside the config directory; a fresh home excludes them without scanning roots.
        clean.CLAUDE_CONFIG_DIR = mkdtempSync(join(homes, 'run-'));
      }
      // Claude: all requests in one process, nothing persisted. Codex: one --ephemeral request, because only a
      // persisted session can be resumed. --ignore-user-config and --ignore-rules exist on exec only (codex-rs/exec/src/cli.rs
      // at openai/codex cf0ed4c600161fcaa18eeac02b5fc715e1076955); there the user config layer is replaced by an empty
      // one while `-c` overrides are a separate layer (codex-rs/config/src/loader/mod.rs), so mcp_servers survive. The free
      // commands cannot take the flags, so their inventory is checked against the arm's declaration instead.
      runs.push(arm.host === 'claude'
        ? { arm, repeat, servers: Object.keys(servers), canary, requests: canary ? 2 + MAX_TURNS : 2,
            command: command([...claudeIsolation(servers, CLAUDE_SETTINGS), '--input-format', 'stream-json', '--max-turns', String(MAX_TURNS), '--model', MODELS.claude], { env: claudeEnv(clean, arm.toolSearch), stdin: [...PROMPTS, ...(canary ? [canaryPrompt(canary)] : [])].map(userMessage) }) }
        : { arm, repeat, servers: Object.keys(servers), requests: 1, command: command(['exec', '--json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', ...settings, PROMPTS[0]], { env: clean }),
            ...(repeat === 1 ? { free: { features: free('features', ['features', 'list', ...settings]), prompt: free('prompt', ['debug', 'prompt-input', ...settings, PROMPTS[0]]), version: free('version', ['--version']), inventory: free('inventory', ['app-server', ...settings]) } } : {}) });
    }
  }
  runs.sort((a, b) => Number(a.arm.host === 'codex') - Number(b.arm.host === 'codex') || Number(a.arm.kind !== 'baseline') - Number(b.arm.kind !== 'baseline'));
  return { runs, blockers, root, work };
}

export interface Estimate { requests: number; inputTokens: [number, number]; seconds: [number, number] }
/**
 * Low assumes everything deferred; high assumes every definition loads. B1's base was measured with `--tools Skill`, so low
 * probably undercounts. Requests count a canary message at its --max-turns bound; the time cap is execute()'s 120 s per stdin message.
 */
export function estimate(runs: Run[], rows: OfflineRow[]): Estimate {
  let requests = 0, high = 0, messages = 0;
  for (const run of runs) {
    const facts = rows.find((r) => r.kind === run.arm.kind && r.config === run.arm.config);
    requests += run.requests;
    messages += run.command.stdin?.length ?? 1;
    high += run.requests * (B1_INPUT_PER_CALL + (facts ? (facts.definitionChars + facts.instructionChars) / CHARS_PER_TOKEN : 0));
  }
  return { requests, inputTokens: [requests * B1_INPUT_PER_CALL, Math.round(high)], seconds: [requests * SECONDS_PER_REQUEST, messages * 120] };
}

/**
 * The directories a paid command may write anywhere in, as far as this harness knows and given no managed Codex config,
 * resolved for this environment; Claude uses a fresh home, while Codex keeps its login home. An itemized list kept missing
 * files, so the known ones are examples only.
 */
export function hostWrites(env: NodeJS.ProcessEnv = process.env): string[] {
  const home = homedir();
  const cache = process.platform === 'darwin' ? join(home, 'Library', 'Caches') : process.platform === 'win32' ? (env.LOCALAPPDATA || join(home, 'AppData', 'Local')) : (env.XDG_CACHE_HOME || join(home, '.cache'));
  const codexHome = env.CODEX_HOME || join(home, '.codex');
  const sqlite = env.CODEX_SQLITE_HOME && env.CODEX_SQLITE_HOME !== codexHome ? ` and ${env.CODEX_SQLITE_HOME}` : '';
  return [
    `Claude Code may write anywhere in each fresh CLAUDE_CONFIG_DIR under the work root's claude-homes/ (settings, history and plugins: code.claude.com/docs/en/env-vars, CLAUDE_CONFIG_DIR). Still listed conservatively: ${join(home, '.claude.json')} bookkeeping and MCP server logs in ${join(cache, 'claude-cli-nodejs')}; whether either moves with CLAUDE_CONFIG_DIR is unverified. No transcript (--no-session-persistence), no self-update (DISABLE_UPDATES, DISABLE_AUTOUPDATER). Not verified by a run.`,
    `Codex exec may write anywhere in ${codexHome}${sqlite}, as far as this harness knows: it refuses the Codex arms if a system or managed Codex config exists, which could move sqlite_home or log_dir. Neither exec nor app-server checks for updates (that code is in the tui crate). Examples: the state and logs SQLite databases, which exec opens even with --ephemeral (codex-rs/exec/src/lib.rs, codex-rs/state/src/runtime.rs), installation_id (codex-rs/core/src/installation_id.rs), a refreshed auth.json, caches (cf0ed4c). No rollout file. Its free commands run on empty temporary CODEX_HOMEs and write nothing there.`,
  ];
}

// --- Measurement -----------------------------------------------------------------------------

export interface Row {
  host: Host; kind: Arm['kind']; config: ConfigName | null; toolSearch: ToolSearch | null; repeat: number; turn: number;
  model: string | null; requestedModel: string; hostVersion: string; input: number; uncached: number; cacheCreation: number; cacheRead: number; output: number;
  mcp: { name: string; status: string }[] | null; ambientHash: string | null;
  toolsListed: number | null; mcpToolsListed: number | null; toolSearchListed: boolean | null; canaryFound: boolean | null;
}

/**
 * A row where the servers connected but the tools never arrived would read as "deferred", the conclusion under
 * test. So every MCP arm needs a positive input delta over its baseline (every arm runs in the same working
 * directory, so nothing else adds tokens), and Claude needs the tools: all listed, or reachable through the lookup (canary).
 */
export function positiveControl(arm: Arm, tools: string[] | null, delta: number, canary: boolean | null) {
  if (arm.kind === 'baseline') return;
  if (delta <= 0) throw new Error(`${armId(arm)}: no positive input delta over the baseline; measurement invalid`);
  if (!tools) return;
  const listed = tools.filter((t) => t.startsWith('mcp__')).length;
  if (arm.kind === 'gateway') {
    // Under tool search loadout's own four tools may be deferred; the successful server_tools lookup then went through ToolSearch.
    if (!LOADOUT_TOOLS.every((t) => tools.includes(`mcp__loadout__${t}`)) && (arm.toolSearch === 'false' || !tools.includes('ToolSearch'))) throw new Error(`${armId(arm)}: loadout's tools are not listed and ToolSearch cannot reach them; measurement invalid`);
    if (!canary) throw new Error(`${armId(arm)}: server_tools did not list the canary tool; measurement invalid`);
    return;
  }
  const expected = catalogFacts(CONFIGS[arm.config!]).tools;
  if (listed === expected) return;
  if (arm.toolSearch === 'false' || !tools.includes('ToolSearch')) throw new Error(`${armId(arm)}: ${listed} of ${expected} MCP tools listed and no ToolSearch to reach the rest; measurement invalid`);
  if (!canary) throw new Error(`${armId(arm)}: ${listed} of ${expected} MCP tools listed and tool search did not return the canary tool; measurement invalid`);
}

/** Servers and tools the app-server reports, on an empty home, against what the arm declares. */
export function checkCodexInventory(found: Map<string, string[]>, arm: Arm) {
  const expected = new Map<string, string[]>(arm.kind === 'native' ? serverSpecs(CONFIGS[arm.config!]).map((s) => [s.name, serverTools(s).map((t) => t.name)])
    : arm.kind === 'gateway' ? [['loadout', LOADOUT_TOOLS]] : []);
  const same = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  const wrong = [...found.keys()].filter((name) => !expected.has(name)).length + [...expected].filter(([name, tools]) => !same(found.get(name) ?? [], tools)).length;
  if (wrong) throw new Error(`Codex MCP inventory differs from the arm in ${wrong} server(s): ambient or missing servers`);
}
export async function codexMcpInventory(command: Command): Promise<Map<string, string[]>> {
  return withAppServer(command, async (request) => {
    const found = new Map<string, string[]>();
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const result = await request('mcpServerStatus/list', { detail: 'toolsAndAuthOnly', ...(cursor ? { cursor } : {}) });
      if (!Array.isArray(result?.data)) throw new Error('invalid Codex MCP inventory');
      for (const server of result.data) {
        if (server.toolsError || server.runtimeStatus === 'failed') throw new Error('an MCP server failed to start');
        found.set(server.name, Object.values(server.tools ?? {}).map((t: any) => t.name as string));
      }
      cursor = result.nextCursor ?? undefined;
      if (!cursor) return found;
    }
    throw new Error('Codex MCP inventory has too many pages');
  });
}

// Agents stay enabled and are listed to the model, so a changed roster changes input too; null (not reported) is its own value.
const ambient = (inventory: { skills: string[]; slashCommands: string[]; agents: string[] | null }) => createHash('sha256').update(JSON.stringify({ skills: [...inventory.skills].sort(), slashCommands: [...inventory.slashCommands].sort(), agents: inventory.agents ? [...inventory.agents].sort() : null })).digest('hex');
const firstLine = (text: string) => text.trim().split(/\r?\n/)[0] ?? '';

/**
 * Codex layers an administrator controls, which `--ignore-user-config` does not skip and which can move sqlite_home, log_dir
 * or the MCP servers (codex-rs/config/src/loader/mod.rs, layer_io.rs and macos.rs at cf0ed4c): the system files, the macOS
 * profile domain com.openai.codex, and the cache of a cloud config bundle in CODEX_HOME (cloud-config/src/cache.rs, valid for
 * an hour). The cache proves a bundle exists; its absence proves nothing.
 */
/**
 * Codex's system config folder. On Windows Codex asks for the ProgramData known folder and falls back to C:\ProgramData, not to
 * the variable (loader/mod.rs). Node cannot ask without a dependency, so the variable and the fallback are both returned, once each.
 */
export function codexSystemDirs(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): string[] {
  if (platform !== 'win32') return ['/etc/codex'];
  return [...new Map([env.ProgramData, 'C:\\ProgramData'].filter((d): d is string => !!d).map((d) => [d.toLowerCase(), win32.join(d, 'OpenAI', 'Codex')])).values()];
}

export function managedCodexFiles(platform: NodeJS.Platform = process.platform, env: NodeJS.ProcessEnv = process.env): string[] {
  const paths = platform === 'win32' ? win32 : posix;
  const cloudCache = paths.join(env.CODEX_HOME || paths.join(homedir(), '.codex'), 'cloud-config-bundle-cache.json');
  const files = platform === 'win32' ? ['config.toml', 'requirements.toml'] : ['config.toml', 'requirements.toml', 'managed_config.toml'];
  return [...codexSystemDirs(platform, env).flatMap((dir) => files.map((f) => paths.join(dir, f))), ...(platform === 'darwin' ? managedPlists('com.openai.codex') : []), cloudCache];
}

export const CLAUDE_SCRUB_PRECONDITION = 'Claude MCP servers receive no login token only if this CLI honours CLAUDE_CODE_MCP_ALLOWLIST_ENV (introduced in a version the docs do not give) or CLAUDE_CODE_SUBPROCESS_ENV_SCRUB (2.1.83; credential names from 2.1.251); a CLI that knows neither ignores them silently. Codex starts stdio MCP servers with a small default environment plus the declared env (codex-rs/rmcp-client/src/utils.rs).';
export const CLAUDE_SWITCH_PRECONDITION = 'Claude loads no CLAUDE.md and no managed skills only if this CLI honours CLAUDE_CODE_DISABLE_CLAUDE_MDS and CLAUDE_CODE_DISABLE_POLICY_SKILLS (the docs give no version for either; an older CLI ignores them silently): the setting sources, the folders above the working directory and the managed skills directory (recorded) are the checks behind them.';
export const CLAUDE_MANAGED_PRECONDITION = 'Claude arms require Erik\'s personal subscription and assume no Windows registry policy (HKLM or HKCU SOFTWARE\\Policies\\ClaudeCode), no Windows policy inherited by WSL, and no live server-managed settings or policy limits. Each fresh home starts without their caches; a `-p` run may fetch and apply them: that is not checked.';
/**
 * A paid exec fetches the workspace's cloud config bundle when it is logged in with a ChatGPT business, education or
 * enterprise plan (codex-rs/cloud-config/src/service.rs, cloud_config_eligible_auth; exec/src/lib.rs). The bundle can set
 * sqlite_home, log_dir and MCP servers. No flag or variable turns it off, and the free commands run without a login, so a
 * live bundle cannot be seen; a cached one can (managedCodexFiles).
 */
export const CODEX_CLOUD_PRECONDITION = 'Codex arms assume the logged-in account has no cloud-managed requirements (ChatGPT business, education or enterprise workspaces): a cached bundle is checked, but no free command shows a live one.';

type Decision = 'refuse if present' | 'neutralised' | 'identical across arms, recorded' | 'needed' | 'not checked';
export interface HostItem { host: Host; item: string; files: string[]; decision: Decision; how: string; source: string }

/**
 * What each CLI can load at startup or during a run, with what the harness does about it. This is the
 * single list: BACKLOG (B7, Isolation) keeps only the note on what "identical" means. Claude sources: code.claude.com/docs/en/
 * cli-reference, /settings-reference, /managed-settings, /env-vars, /claude-directory, /memory (read 2026-10-14). Codex sources: openai/codex at cf0ed4c600161fcaa18eeac02b5fc715e1076955.
 * A "refuse" item stops its host's arms when a file exists; an "identical" item is the same in every arm of the host, so the
 * baseline delta cancels it, and its presence is saved as names only; the flags of a "neutralised" item are asserted in tests.
 */
export function hostState(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform, workParent: string = realpathSync(tmpdir())): HostItem[] {
  const codex = env.CODEX_HOME || join(homedir(), '.codex');
  const managed = claudeManagedDir(platform);
  const systemPaths = platform === 'win32' ? win32 : posix;
  const at = (dir: string, ...names: string[]) => names.map((n) => join(dir, n));
  const above = (dir: string): string[] => (dirname(dir) === dir ? [dir] : [dir, ...above(dirname(dir))]);
  // The user's own dot-folders in the home directory are the config directories listed separately.
  const ancestors = (names: string[], dotted: string[]) => above(workParent).flatMap((d) => [...at(d, ...names), ...(d === homedir() ? [] : at(d, ...dotted))]);
  const codexSystem = codexSystemDirs(platform, env);
  // files only for the decisions that read them: refuse and identical
  const item = (host: Host, decision: Decision, name: string, how: string, source: string, files: string[] = []): HostItem => ({ host, item: name, files, decision, how, source });
  const SDK = 'docs/en/agent-sdk/claude-code-features: What settingSources does not control, CLAUDE.md load locations';
  return [
    item('claude', 'refuse if present', 'managed settings, managed MCP, macOS profile', 'they override --settings and can set env and paths; the plan blocks the Claude arms', 'docs/en/managed-settings', managedClaudeFiles(platform)),
    item('claude', 'neutralised', 'user server-managed cache, policy-limits.json and its stamp', 'fresh empty CLAUDE_CONFIG_DIR per run; live policy remains an unchecked precondition on the personal subscription', 'docs/en/env-vars: CLAUDE_CONFIG_DIR; /claude-directory: Application data'),
    item('claude', 'refuse if present', 'memory, rules, skills, agents or commands in the folders above the temp working directory', 'neutralised below, but the setting sources and switches depend on the CLI version, so any trace stops the Claude arms; the user\'s own dot-folders in the home directory are listed elsewhere',
      'docs/en/memory: How CLAUDE.md files load; /skills: Load skills in monorepos', ancestors(['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md'], ['.claude/CLAUDE.md', '.claude/AGENTS.md', '.claude/rules', '.claude/skills', '.claude/agents', '.claude/commands'])),
    item('claude', 'neutralised', 'settings.json and settings.local.json (user, project, local): env block, hooks, apiKeyHelper, statusLine, permissions, enabledPlugins, outputStyle', '--restricted loads only managed settings and --settings, and --setting-sources "" names no source', 'docs/en/cli-reference: --restricted, --setting-sources'),
    item('claude', 'neutralised', 'CLAUDE.md (user, project in the working directory and every parent, .claude/CLAUDE.md), CLAUDE.local.md, rules folders and their @path imports', '--setting-sources "" leaves out user, project and local, and CLAUDE_CODE_DISABLE_CLAUDE_MDS=1 skips any CLAUDE.md memory file', `${SDK}; docs/en/env-vars`),
    item('claude', 'neutralised', 'AGENTS.md and .claude/AGENTS.md in the working directory and above', 'pluginConfigs "agents-md@builtin" instructionFiles "managed-only" in --settings', 'docs/en/memory: AGENTS.md, Choose which instruction files load'),
    item('claude', 'neutralised', 'user and project skills, agents and commands, and skills synced from claude.ai (~/.claude/skills/synced)', '--setting-sources "" leaves out user and project, which also stops the claude.ai sync', `${SDK}; docs/en/skills: Where synced skills load`),
    item('claude', 'neutralised', 'ambient plugins', 'fresh empty CLAUDE_CONFIG_DIR per run; init.plugins must be an empty array or the measurement is refused', 'docs/en/env-vars: CLAUDE_CONFIG_DIR; init inventory via parseClaudeTurns'),
    item('claude', 'neutralised', 'managed skills directory (.claude/skills in the managed settings directory)', 'CLAUDE_CODE_DISABLE_POLICY_SKILLS=1', 'docs/en/env-vars'),
    item('claude', 'neutralised', 'background runs of plugin marketplace command sources, which could change files outside this list mid-study', 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1', 'docs/en/env-vars'),
    item('claude', 'neutralised', 'hooks from settings, plugins, skills or agents, and the status line command', '"disableAllHooks":true in --settings', 'docs/en/settings-reference: disableAllHooks'),
    item('claude', 'neutralised', 'MCP servers in ~/.claude.json (user and local scope), .mcp.json, plugins and claude.ai connectors', '--strict-mcp-config with the arm\'s own --mcp-config', `docs/en/cli-reference: --strict-mcp-config; ${SDK}`),
    item('claude', 'neutralised', 'auto memory (projects/<project>/memory)', 'CLAUDE_CODE_DISABLE_AUTO_MEMORY=1', 'docs/en/env-vars'),
    item('claude', 'identical across arms, recorded', 'managed-policy CLAUDE.md and managed agents, which no setting excludes, and the managed skills directory (also switched off above)',
      'skills, slash commands and agents are hashed from init and must match the baseline; the managed files cannot be excluded ("Managed policy CLAUDE.md files cannot be excluded")', 'docs/en/memory: Exclude specific CLAUDE.md files; /sub-agents: managed subagents; /claude-directory: File reference',
      [systemPaths.join(managed, 'CLAUDE.md'), systemPaths.join(managed, '.claude', 'agents'), systemPaths.join(managed, '.claude', 'skills')]),
    item('claude', 'needed', 'subscription login through CLAUDE_CODE_OAUTH_TOKEN only', 'unset or empty blocks Claude; passed from the environment only at launch, never stored in the plan; Erik\'s personal subscription quota', 'docs/en/env-vars: CLAUDE_CODE_OAUTH_TOKEN'),
    item('claude', 'not checked', 'what Claude writes: transcripts, history.jsonl, stats-cache.json, caches, debug logs, sessions/, backups/, and keybindings.json and themes (interactive only)', 'listed as writable in HOST STATE; none is read into the prompt or the settings', 'docs/en/claude-directory: Application data'),
    item('claude', 'not checked', 'global config keys in ~/.claude.json', 'interface, IDE and teammate preferences only; none sets env, hooks or MCP', 'docs/en/settings-reference: Global config settings'),
    item('codex', 'refuse if present', 'system, managed and cloud-bundle config layers', '--ignore-user-config does not skip them and they can move sqlite_home, log_dir and the MCP servers', 'codex-rs/config/src/loader/mod.rs, cloud-config/src/cache.rs', managedCodexFiles(platform, env)),
    item('codex', 'refuse if present', '$CODEX_HOME/.env', 'Codex loads it into its own environment before any command, every name not starting CODEX_ (API keys, proxy URLs, HOME), past the allowlist', 'codex-rs/arg0/src/lib.rs: load_dotenv', at(codex, '.env')),
    item('codex', 'refuse if present', 'AGENTS.md, AGENTS.override.md, .codex or .agents in the folders above the temp working directory', 'AGENTS.md is read from the project root (the nearest .git) down to the working directory, project config layers and .agents/skills are read from there too, and none of it is skipped by --ignore-user-config',
      'codex-rs/core/src/agents_md.rs, ext/skills/src/host_roots.rs: repo_agents_skill_roots', ancestors(['AGENTS.md', 'AGENTS.override.md'], ['.codex', '.agents'])),
    item('codex', 'neutralised', 'config.toml and environments.toml: model, features, mcp_servers, notify, hooks, profiles, project trust, project_doc_fallback_filenames', '--ignore-user-config makes the user layer empty, loads no environments.toml, and no --profile is passed; -c overrides are a separate layer', 'codex-rs/config/src/loader/mod.rs: load_user_config_layer; exec/src/lib.rs: EnvironmentManager::from_env'),
    item('codex', 'neutralised', 'hooks.json', '--disable hooks (the layer\'s folder stays CODEX_HOME, so the feature flag is what stops it; the free features check confirms it)', 'codex-rs/hooks/src/engine/discovery.rs'),
    item('codex', 'neutralised', 'rules/*.rules', '--ignore-rules', 'codex-rs/exec/src/cli.rs'),
    item('codex', 'neutralised', 'plugins, marketplaces and skill MCP dependencies', '--disable plugins and --disable skill_mcp_dependency_install', 'codex-rs/features/src/lib.rs'),
    item('codex', 'identical across arms, recorded', 'AGENTS.md and AGENTS.override.md', 'read at startup into every arm\'s prompt; the free prompt-input check runs on an empty home and does not see them', 'codex-rs/codex-home/src/instructions/mod.rs', at(codex, 'AGENTS.md', 'AGENTS.override.md')),
    item('codex', 'identical across arms, recorded', 'skills (user, ~/.agents and the admin root next to the system config) and agents (custom roles in CODEX_HOME and the system config folder, which add to the spawn tool description)', '--ignore-user-config does not skip them: the user layer keeps CODEX_HOME as its folder, and the system layer\'s folder is a skills root', 'codex-rs/ext/skills/src/host_roots.rs, exec-server/src/discoverV2/capability_locations.rs, agent-roles/src/loader.rs', [...at(codex, 'skills', 'agents'), join(homedir(), '.agents', 'skills'), ...codexSystem.flatMap((d) => ['skills', 'agents'].map((f) => systemPaths.join(d, f)))]),
    item('codex', 'needed', 'auth.json', 'the study runs on subscription quota; Codex may refresh it in place', 'codex-rs/login'),
    item('codex', 'not checked', 'models_cache.json: the model catalog cache', 'a five-minute cache of what the service returns, refreshed when the service sends a new ETag; a change mid-study would be the service\'s, the same for every arm that follows it, and is not detected', 'codex-rs/models-manager/src/manager.rs'),
    item('codex', 'not checked', 'Claude Code files (CLAUDE.md, .claude/settings.json)', 'read only by an app-server import request, which neither exec nor the free commands send', 'codex-rs/app-server/src/external_agent_migration'),
  ];
}
export const presentFiles = (i: HostItem) => i.files.filter((f) => existsSync(f));
/** The files of the refuse items of one host that exist: they stop that host's arms. */
export const refusedFiles = (host: Host, env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform, workParent: string = realpathSync(tmpdir())) =>
  hostState(env, platform, workParent).filter((i) => i.host === host && i.decision === 'refuse if present').flatMap(presentFiles);

export interface Deps { run?: (command: Command) => Promise<string>; inventory?: typeof codexMcpInventory; refused?: () => string[] }
interface Baseline { version: string }

/** Free Codex checks. A refusal skips the Codex arms; Claude is independent. Only counts and hashes are saved. */
async function codexPreflight(plan: Plan, deps: Required<Deps>, out: string): Promise<{ ready: boolean; baseline?: Baseline; reason?: string }> {
  const refused = deps.refused();
  if (refused.length) return { ready: false, reason: `Codex state the study cannot isolate exists (${refused.map((f) => redacted(f)).join(', ')}): a managed layer, which --ignore-user-config does not skip, or $CODEX_HOME/.env, which Codex loads into its own environment` };
  let ready = true;
  let baseline: Baseline | undefined;
  for (const r of plan.runs.filter((x) => x.free)) {
    const line: Record<string, unknown> = { arm: armId(r.arm) };
    const refusals: string[] = [];
    try { line.version = firstLine(await deps.run(r.free!.version)); } catch { refusals.push('version collection failed'); }
    try { const v = parsePromptInput(await deps.run(r.free!.prompt), r.command.cwd); line.renderedCharacters = v.renderedCharacters; line.contextHash = v.contextHash; } catch { refusals.push('prompt-input collection failed (details suppressed)'); }
    try { validateFeatures(await deps.run(r.free!.features)); } catch (error) { refusals.push((error as Error).message); }
    try { checkCodexInventory(await deps.inventory(r.free!.inventory), r.arm); } catch (error) { refusals.push((error as Error).message); }
    if (r.arm.kind === 'baseline') baseline = { version: String(line.version) };
    if (refusals.length) ready = false;
    appendFileSync(join(out, 'preflight.jsonl'), JSON.stringify({ ...line, refusals }) + '\n');
  }
  return { ready, baseline };
}

export async function runStudy(plan: Plan, out: string, deps: Deps = {}): Promise<{ rows: Row[]; notes: string[] }> {
  if (plan.blockers.length) throw new Error(`blocked: ${plan.blockers.join('; ')}`);
  // Strictly sequential, each command in the emptied work directory.
  const fresh = <R>(f: (command: Command) => Promise<R>) => (command: Command) => { resetWork(plan.work); return f(command); };
  const full = { run: fresh(deps.run ?? execute), inventory: fresh(deps.inventory ?? codexMcpInventory), refused: deps.refused ?? (() => refusedFiles('codex')) };
  mkdirSync(out, { recursive: true });
  const rows: Row[] = [];
  const notes: string[] = [];
  let codex: Awaited<ReturnType<typeof codexPreflight>> | undefined;
  for (const r of plan.runs) {
    if (r.arm.host === 'codex') {
      codex ??= await codexPreflight(plan, full, out);
      if (!codex.ready) continue;
    }
    let command = r.command;
    if (r.arm.host === 'claude') {
      const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
      if (!token) throw new Error('Claude arms require CLAUDE_CODE_OAUTH_TOKEN at launch');
      resetWork(command.env!.CLAUDE_CONFIG_DIR!);
      command = { ...command, env: { ...command.env, CLAUDE_CODE_OAUTH_TOKEN: token } };
    }
    const stdout = await full.run(command);
    const session = r.arm.host === 'claude' ? parseClaudeTurns(stdout, 2, r.canary ? { allow: CANARY_TOOLS } : undefined) : null;
    if (session && session.inventory.plugins.length !== 0) throw new Error('Claude init plugins must be empty; measurement invalid');
    const turns = session ? session.turns : [parseCodex(stdout)];
    const hostVersion = session ? session.version : codex!.baseline!.version;
    if (rows.some((m) => m.host === r.arm.host && m.hostVersion !== hostVersion)) throw new Error(`${r.arm.host} version changed during the study; measurement invalid`);
    const hash = session ? ambient(session.inventory) : null;
    const first = rows.find((m) => m.host === r.arm.host && m.kind === 'baseline');
    if (first && hash && first.ambientHash !== hash) throw new Error('Claude ambient inventory drift; measurement invalid');
    // A managed setting can swap the model without changing any name the drift hash sees.
    if (session && !session.model?.toLowerCase().includes(MODELS.claude)) throw new Error(`Claude resolved model is not the requested ${MODELS.claude}; measurement invalid`);
    if (session && rows.some((m) => m.host === 'claude' && m.model !== session.model)) throw new Error('Claude resolved model changed during the study; measurement invalid');
    if (session && (session.inventory.mcp.length !== r.servers.length || !r.servers.every((n) => session.inventory.mcp.some((m) => m.name === n && m.status === 'connected')))) throw new Error('MCP servers differ from the arm or did not connect; measurement invalid');
    const found = r.canary && session ? canaryFound(r.arm, r.canary, session.calls!) : null;
    const made = turns.map((u, i): Row => {
      const base = rows.find((m) => m.host === r.arm.host && m.kind === 'baseline' && m.repeat === r.repeat && m.turn === i + 1);
      positiveControl(r.arm, session?.tools ?? null, base ? u.input - base.input : 0, found);
      return { host: r.arm.host, kind: r.arm.kind, config: r.arm.config ?? null, toolSearch: r.arm.toolSearch ?? null, repeat: r.repeat, turn: i + 1,
        model: session?.model ?? null, requestedModel: MODELS[r.arm.host], hostVersion, input: u.input, uncached: u.uncached, cacheCreation: u.cacheCreation, cacheRead: u.cacheRead, output: u.output,
        mcp: session?.inventory.mcp ?? null, ambientHash: hash, toolsListed: session?.tools.length ?? null, mcpToolsListed: session?.tools.filter((t) => t.startsWith('mcp__')).length ?? null,
        toolSearchListed: session ? session.tools.includes('ToolSearch') : null, canaryFound: found };
    });
    for (const row of made) { rows.push(row); appendFileSync(join(out, 'rows.jsonl'), JSON.stringify(row) + '\n'); }
  }
  if (plan.runs.some((r) => r.arm.host === 'codex')) {
    if (!codex?.ready) notes.push(`Codex skipped: ${codex?.reason ?? 'a free preflight check refused it (see preflight.jsonl)'}.`);
    else {
      const b = plan.runs.find((r) => r.arm.host === 'codex' && r.arm.kind === 'baseline' && r.free)!;
      if (firstLine(await full.run(b.free!.version)) !== codex.baseline?.version) throw new Error('Codex version changed during the study; measurement invalid');
    }
  }
  return { rows, notes };
}

/**
 * How a Claude row's tools reached the model; "deferred" only when the host listed fewer tools than were configured and
 * the canary was found. Codex shows no tool list, so its rows are "not shown".
 */
export function reading(r: Row): string {
  if (r.kind === 'baseline') return '';
  if (r.host === 'codex') return 'not shown';
  if (r.kind === 'gateway') return 'gateway';
  const all = r.mcpToolsListed === catalogFacts(CONFIGS[r.config!]).tools;
  if (r.toolSearch === 'false') return 'all loaded';
  return all ? (r.toolSearchListed ? 'all loaded (ToolSearch present)' : 'all loaded (no ToolSearch)') : 'deferred (canary found)';
}

export function summarize(rows: Row[], notes: string[] = []): string {
  const lines = ['B7 input tokens per request. Delta is over the same host\'s no-MCP baseline, same repeat and turn.',
    'Claude readings: tool search false = every definition loaded; default = host tool search on; auto = host decides. Deferral is not reported by the host: the Reading column is inferred from the init tool list and a canary lookup.',
    '| Host | Arm | Config | Tool search | Reading | Repeat | Turn | Input | Delta | Uncached | Cache creation | Cache read | Tools listed (MCP) | ToolSearch listed |',
    '| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |'];
  for (const r of rows) {
    const base = rows.find((b) => b.host === r.host && b.kind === 'baseline' && b.repeat === r.repeat && b.turn === r.turn);
    lines.push(`| ${r.host} | ${r.kind} | ${r.config ?? ''} | ${r.toolSearch ?? ''} | ${reading(r)} | ${r.repeat} | ${r.turn} | ${r.input} | ${base ? r.input - base.input : 'unavailable'} | ${r.uncached} | ${r.cacheCreation} | ${r.cacheRead} | ${r.toolsListed === null ? 'n/a' : `${r.toolsListed} (${r.mcpToolsListed})`} | ${r.toolSearchListed ?? 'n/a'} |`);
  }
  if (rows.some((r) => r.kind === 'native' && r.config === 'n20' && r.toolSearch === 'default' && !r.toolSearchListed)) lines.push('Tool search was not listed for native default at n20: this model or host has none here, so those rows are "all loaded", not deferred.');
  lines.push(...notes);
  lines.push('Codex has one request per session (a second turn needs a persisted session), and exec reports no tool list: whether it deferred is not shown. Sessions per arm are few: report ranges, not intervals. Tokens, not money. Not measured: tool use through the gateway beyond the canary lookup, output quality, other models.');
  return lines.join('\n');
}

export async function main(args: string[], deps: { print?: (s: string) => void; run?: Deps['run']; out?: string; claudeManaged?: string[] } = {}) {
  const print = deps.print ?? console.log;
  const { values } = parseArgs({ args, options: { offline: { type: 'boolean' }, run: { type: 'boolean' }, hosts: { type: 'string' }, configs: { type: 'string' }, repeats: { type: 'string' } } });
  const list = <T extends string>(text: string | undefined, allowed: readonly T[]) => text?.split(',').map((x) => { if (!allowed.includes(x as T)) throw new Error(`unknown value ${x}`); return x as T; });
  const only: Only = { hosts: list(values.hosts, ['claude', 'codex']), configs: list(values.configs, Object.keys(CONFIGS) as ConfigName[]), repeats: values.repeats ? Number(values.repeats) : undefined };
  if (only.repeats !== undefined && !(Number.isInteger(only.repeats) && only.repeats >= 1)) throw new Error('--repeats must be a positive integer');
  const facts = await offline();
  if (values.offline) { print(formatOffline(facts)); return; }
  const root = mkdtempSync(join(tmpdir(), 'loadout-b7-'));
  try {
    const plan = buildPlan(root, only, process.env, deps.claudeManaged);
    const e = estimate(plan.runs, facts);
    print(`${plan.runs.length} runs, ${e.requests} paid requests (Codex only if its preflight passes; each canary lookup counted at its --max-turns bound of ${MAX_TURNS}). Estimate: ${e.inputTokens[0]} to ${e.inputTokens[1]} input tokens; ${Math.round(e.seconds[0] / 60)} to ${Math.round(e.seconds[1] / 60)} minutes. Subscription quota; no Jev. Needs Erik's approval before --run.`);
    print('The low figure uses B1\'s 8.5k tokens a call, measured with `--tools Skill`; B7 keeps every built-in tool, so it probably undercounts, and the high figure, built on the same base, is not an upper bound. Claude pilot 1 calibrates both.');
    for (const blocker of plan.blockers) print(`BLOCKED: ${blocker}`);
    for (const write of hostWrites()) print(`HOST STATE: ${write}`);
    for (const precondition of [CODEX_CLOUD_PRECONDITION, CLAUDE_MANAGED_PRECONDITION, CLAUDE_SCRUB_PRECONDITION, CLAUDE_SWITCH_PRECONDITION]) print(`PRECONDITION: ${precondition}`);
    for (const i of hostState()) print(`LOADS ${i.host}: ${i.item}: ${i.decision}. ${i.how} (${i.source}).${i.decision === 'refuse if present' || i.decision.startsWith('identical') ? ` Present: ${presentFiles(i).map((f) => basename(f)).join(', ') || 'none'}.` : ''}`);
    for (const host of ['claude', 'codex'] as const) print(`ENV ${host}: a child gets only these variables, when set: ${envAllowlist(host).join(', ')}. Passed from this environment: ${Object.keys(childEnv(process.env, host)).join(', ')}.`);
    if (!values.run) {
      print('Illustrative: the temp root below is deleted when this exits, so use --run rather than replaying these lines. Every command runs in the one cwd shown, emptied before each. Claude is sent its stdin lines one at a time, each after the previous result.');
      for (const r of plan.runs) {
        const env = r.arm.host === 'claude' ? ` env=ENABLE_TOOL_SEARCH=${r.command.env?.ENABLE_TOOL_SEARCH ?? '(unset)'},MCP_TIMEOUT=${r.command.env?.MCP_TIMEOUT}` : '';
        print(`PAID ${armId(r.arm)}/${r.repeat}: cwd=${JSON.stringify(r.command.cwd)}${env} argv=${JSON.stringify([r.command.bin, ...r.command.args])}${r.command.stdin ? ` stdin=${JSON.stringify(r.command.stdin)}` : ''}`);
      }
      return;
    }
    // Raw rows are committed, as in B1. A run that stops early leaves INCOMPLETE beside its partial rows.jsonl: delete the folder.
    const out = deps.out ?? fileURLToPath(new URL(`./results/${new Date().toISOString().replace(/[:.]/g, '-')}-b7-mcp-overhead/`, import.meta.url));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'INCOMPLETE'), 'This run did not finish: delete this folder; its rows are not a result.\n');
    writeFileSync(join(out, 'offline.json'), JSON.stringify(facts, null, 1));
    writeFileSync(join(out, 'host-state.json'), JSON.stringify(hostState().filter((i) => i.decision.startsWith('identical')).map((i) => ({ host: i.host, item: i.item, present: presentFiles(i).map((f) => basename(f)) })), null, 1));
    const { rows, notes } = await runStudy(plan, out, { run: deps.run });
    writeFileSync(join(out, 'summary.md'), summarize(rows, notes) + '\n');
    rmSync(join(out, 'INCOMPLETE'));
    print(`Raw metrics: ${out}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
if (isEntry(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'mcp-overhead failed'); process.exitCode = 1; });
}
