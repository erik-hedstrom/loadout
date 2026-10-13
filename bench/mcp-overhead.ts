/**
 * B7: what configured MCP servers cost per request, natively and through loadout's gateway. Nothing is
 * spent without `--run`; the method, the arms, the estimate and the commands are in docs/loop/BACKLOG.md
 * (B7) and bench/RESULTS.md ("B7 method").
 *
 * Why it is built this way: Claude Code defers MCP definitions by default, so every configuration is read at
 * both ends, tool search off (all loaded) and the host default, and no arm may read as "deferred" unless the
 * tools were actually there (positive controls). Both Claude requests share one process with
 * `--no-session-persistence`, so no transcript lands in ~/.claude; Codex gets one `--ephemeral` request.
 */
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { createServer } from '../src/mcp.js';
import type { Capability } from '../src/types.js';
import { assertTemporary, claudeIsolation, cli, codexSettings, execute, MODELS, parseClaudeTurns, parseCodex, parsePromptInput, validateFeatures, withAppServer, type Command, type Host } from './overhead.js';
import { catalogFacts, serverSpecs, serverTools, type Facts, type ServerSpec } from './mcp-fixtures.js';

const LOADOUT_TOOLS = ['find_skills', 'load_skill', 'server_tools', 'call_server_tool'];
const PROMPTS = ['Reply with exactly OK. Do not use tools, skills, commands, agents, or external services.', 'Reply with exactly OK again. Do not use tools, skills, commands, agents, or external services.'] as const;
const CONFIGS = { n1: 1, n5: 5, n20: 20 } as const;
const TOOL_SEARCH = ['default', 'false', 'auto'] as const;
const FIXTURE_SERVER = fileURLToPath(new URL('./mcp-fixture-server.ts', import.meta.url));
const B1_INPUT_PER_CALL = 8_500;
// Assumptions, not measurements: characters per token, and seconds per request (the hard cap is execute()'s 120 s).
const CHARS_PER_TOKEN = 3;
const SECONDS_PER_REQUEST = 30;
// Claude Code turns tool search off or unavailable for these (code.claude.com/docs/en/mcp, "Configure tool search").
const TOOL_SEARCH_OFF = ['ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS'];

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
  lines.push('Gateway rows are loadout\'s own tools (find_skills, load_skill, server_tools, call_server_tool) and instructions; the library servers\' definitions stay behind the gateway and enter the context only when the agent asks for them.');
  return lines.join('\n');
}

// --- Plan ------------------------------------------------------------------------------------

export interface Run { arm: Arm; repeat: number; servers: string[]; command: Command; free?: { features: Command; prompt: Command; version: Command; inventory: Command } }
export interface Plan { runs: Run[]; blockers: string[]; root: string }
export interface Only { hosts?: Host[]; configs?: ConfigName[]; repeats?: number }

/** The child environment for Claude: the tool search setting is explicit in every arm, never inherited. */
export function claudeEnv(base: NodeJS.ProcessEnv, toolSearch: ToolSearch = 'default'): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, MCP_TIMEOUT: '60000' };
  delete env.ENABLE_TOOL_SEARCH;
  if (toolSearch !== 'default') env.ENABLE_TOOL_SEARCH = toolSearch;
  return env;
}
export const toolSearchBlockers = (env: NodeJS.ProcessEnv) => TOOL_SEARCH_OFF.filter((name) => env[name]).map((name) => `${name} is set: it turns Claude Code tool search off or unavailable, so the default arm would not mean what it says; unset it for this study`);

function gatewayServer(root: string, config: ConfigName) {
  const home = join(root, 'homes', config);
  assertTemporary(home);
  mkdirSync(join(home, 'library'), { recursive: true });
  const servers = Object.fromEntries(serverSpecs(CONFIGS[config]).map((s) => [s.name, { ...serverConfig(s), description: `${s.archetype} fixture`, gateway: true }]));
  writeFileSync(join(home, 'library', 'mcp.json'), JSON.stringify({ mcpServers: servers }));
  writeFileSync(join(home, 'config.json'), JSON.stringify({ embeddings: false }));
  return { command: process.execPath, args: ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL('../src/cli.ts', import.meta.url)), 'mcp', '--lexical'], env: { LOADOUT_HOME: home } };
}

const userMessage = (text: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } });

export function buildPlan(root: string, only: Only = {}, env: NodeJS.ProcessEnv = process.env): Plan {
  assertTemporary(root);
  const hosts = only.hosts ?? ['claude', 'codex'];
  const blockers = hosts.includes('claude') ? toolSearchBlockers(env) : [];
  const runs: Run[] = [];
  for (const arm of arms().filter((a) => hosts.includes(a.host) && (!a.config || !only.configs || only.configs.includes(a.config)))) {
    const cwd = join(root, armId(arm).replaceAll('/', '-'));
    assertTemporary(cwd);
    mkdirSync(cwd, { recursive: true });
    const servers: Record<string, object> = arm.kind === 'native' ? Object.fromEntries(serverSpecs(CONFIGS[arm.config!]).map((s) => [s.name, serverConfig(s)]))
      : arm.kind === 'gateway' ? { loadout: gatewayServer(root, arm.config!) } : {};
    const binary = cli(arm.host);
    const command = (args: string[], extra: Partial<Command> = {}): Command => ({ bin: binary.bin, args: [...binary.prefix, ...args], cwd, ...extra });
    // Codex starts every configured server at startup; required makes a failed start fail the run, not shrink the arm.
    const settings = codexSettings(Object.fromEntries(Object.entries(servers).map(([name, s]) => [name, { ...s, required: true }])));
    for (let repeat = 1; repeat <= (only.repeats ?? 2); repeat++) {
      // Claude: both requests in one process, nothing persisted. Codex: one --ephemeral request, because only a
      // persisted session can be resumed. --ignore-user-config and --ignore-rules exist on exec only (codex-rs/exec/src/cli.rs
      // at openai/codex cf0ed4c600161fcaa18eeac02b5fc715e1076955), so the free commands below see the user's config and
      // their inventory is checked against the arm's declaration instead.
      runs.push(arm.host === 'claude'
        ? { arm, repeat, servers: Object.keys(servers), command: command([...claudeIsolation(servers), '--input-format', 'stream-json', '--model', MODELS.claude], { env: claudeEnv(env, arm.toolSearch), stdin: PROMPTS.map(userMessage) }) }
        : { arm, repeat, servers: Object.keys(servers), command: command(['exec', '--json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', ...settings, PROMPTS[0]]),
            ...(repeat === 1 ? { free: { features: command(['features', 'list', ...settings]), prompt: command(['debug', 'prompt-input', ...settings, PROMPTS[0]]), version: command(['--version']), inventory: command(['app-server', ...settings]) } } : {}) });
    }
  }
  runs.sort((a, b) => Number(a.arm.host === 'codex') - Number(b.arm.host === 'codex') || Number(a.arm.kind !== 'baseline') - Number(b.arm.kind !== 'baseline'));
  return { runs, blockers, root };
}

const requestsOf = (run: Run) => run.command.stdin?.length ?? 1;
export interface Estimate { requests: number; inputTokens: [number, number]; seconds: [number, number] }
/** Low assumes everything deferred; high assumes every definition loads. B1's base was measured with `--tools Skill`, so low probably undercounts. */
export function estimate(runs: Run[], rows: OfflineRow[]): Estimate {
  let requests = 0, high = 0, cap = 0;
  for (const run of runs) {
    const n = requestsOf(run);
    const facts = rows.find((r) => r.kind === run.arm.kind && r.config === run.arm.config);
    requests += n;
    cap += n * 120;
    high += n * (B1_INPUT_PER_CALL + (facts ? (facts.definitionChars + facts.instructionChars) / CHARS_PER_TOKEN : 0));
  }
  return { requests, inputTokens: [requests * B1_INPUT_PER_CALL, Math.round(high)], seconds: [requests * SECONDS_PER_REQUEST, cap] };
}

// --- Measurement -----------------------------------------------------------------------------

export interface Row {
  host: Host; kind: Arm['kind']; config: ConfigName | null; toolSearch: ToolSearch | null; repeat: number; turn: number;
  model: string | null; requestedModel: string; hostVersion: string; input: number; uncached: number; cacheCreation: number; cacheRead: number; output: number;
  mcp: { name: string; status: string }[] | null; ambientHash: string | null;
  toolsListed: number | null; mcpToolsListed: number | null; toolSearchListed: boolean | null;
}

/**
 * A row where the servers connected but the tools never arrived would read as "deferred", the conclusion under
 * test. So every MCP arm needs a positive input delta over its baseline, and Claude needs the tools themselves.
 */
export function positiveControl(arm: Arm, tools: string[] | null, delta: number | null) {
  if (arm.kind === 'baseline') return;
  if (delta !== null && delta <= 0) throw new Error(`${armId(arm)}: no positive input delta over the baseline; measurement invalid`);
  if (!tools) return;
  const listed = tools.filter((t) => t.startsWith('mcp__')).length;
  if (arm.kind === 'gateway' && !LOADOUT_TOOLS.every((t) => tools.includes(`mcp__loadout__${t}`))) throw new Error(`${armId(arm)}: loadout's tools are not listed; measurement invalid`);
  const expected = arm.kind === 'native' ? catalogFacts(CONFIGS[arm.config!]).tools : 0;
  if (arm.kind === 'native' && listed !== expected && (arm.toolSearch === 'false' || !tools.includes('ToolSearch'))) throw new Error(`${armId(arm)}: ${listed} of ${expected} MCP tools listed and no ToolSearch to reach the rest; measurement invalid`);
}

/** Servers and tools the host reports against what the arm declares; counts only, since undeclared names may be the user's. */
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

const ambient = (inventory: { plugins: string[]; skills: string[]; slashCommands: string[] }) => createHash('sha256').update(JSON.stringify({ plugins: [...inventory.plugins].sort(), skills: [...inventory.skills].sort(), slashCommands: [...inventory.slashCommands].sort() })).digest('hex');
const firstLine = (text: string) => text.trim().split(/\r?\n/)[0] ?? '';

export interface Deps { run?: (command: Command) => Promise<string>; inventory?: typeof codexMcpInventory }
interface Preflight { ready: boolean; version: string; baseline: { version: string; contextHash: string } | null }

/** Free Codex checks. A refusal skips the Codex arms; Claude is independent. Only counts and hashes are saved. */
async function codexPreflight(plan: Plan, deps: Required<Deps>, out: string): Promise<Preflight> {
  const result: Preflight = { ready: true, version: '', baseline: null };
  for (const r of plan.runs.filter((x) => x.free)) {
    const line: Record<string, unknown> = { arm: armId(r.arm) };
    const refusals: string[] = [];
    try { line.version = firstLine(await deps.run(r.free!.version)); } catch { refusals.push('version collection failed'); }
    try { const v = parsePromptInput(await deps.run(r.free!.prompt), r.command.cwd); line.renderedCharacters = v.renderedCharacters; line.contextHash = v.contextHash; } catch { refusals.push('prompt-input collection failed (details suppressed)'); }
    try { validateFeatures(await deps.run(r.free!.features)); } catch (error) { refusals.push((error as Error).message); }
    try { checkCodexInventory(await deps.inventory(r.free!.inventory), r.arm); } catch (error) { refusals.push((error as Error).message); }
    if (r.arm.kind === 'baseline') result.baseline = { version: String(line.version), contextHash: String(line.contextHash) };
    result.version ||= String(line.version);
    if (refusals.length) result.ready = false;
    appendFileSync(join(out, 'preflight.jsonl'), JSON.stringify({ ...line, refusals }) + '\n');
  }
  return result;
}

export async function runStudy(plan: Plan, out: string, deps: Deps = {}): Promise<{ rows: Row[]; notes: string[] }> {
  if (plan.blockers.length) throw new Error(`blocked: ${plan.blockers.join('; ')}`);
  const full = { run: deps.run ?? execute, inventory: deps.inventory ?? codexMcpInventory };
  mkdirSync(out, { recursive: true });
  const rows: Row[] = [];
  const notes: string[] = [];
  let codex: Preflight | undefined;
  for (const r of plan.runs) {
    if (r.arm.host === 'codex') {
      codex ??= await codexPreflight(plan, full, out);
      if (!codex.ready) continue;
    }
    const stdout = await full.run(r.command);
    const session = r.arm.host === 'claude' ? parseClaudeTurns(stdout, 2) : null;
    const turns = session ? session.turns : [parseCodex(stdout)];
    const hostVersion = session ? session.version : codex!.version;
    if (rows.some((m) => m.host === r.arm.host && m.hostVersion !== hostVersion)) throw new Error(`${r.arm.host} version changed during the study; measurement invalid`);
    const hash = session ? ambient(session.inventory) : null;
    const first = rows.find((m) => m.host === r.arm.host && m.kind === 'baseline');
    if (first && hash && first.ambientHash !== hash) throw new Error('Claude ambient inventory drift; measurement invalid');
    if (session && (session.inventory.mcp.length !== r.servers.length || !r.servers.every((n) => session.inventory.mcp.some((m) => m.name === n && m.status === 'connected')))) throw new Error('MCP servers differ from the arm or did not connect; measurement invalid');
    const made = turns.map((u, i): Row => {
      const base = rows.find((m) => m.host === r.arm.host && m.kind === 'baseline' && m.repeat === r.repeat && m.turn === i + 1);
      positiveControl(r.arm, session?.tools ?? null, base ? u.input - base.input : null);
      return { host: r.arm.host, kind: r.arm.kind, config: r.arm.config ?? null, toolSearch: r.arm.toolSearch ?? null, repeat: r.repeat, turn: i + 1,
        model: session?.model ?? null, requestedModel: MODELS[r.arm.host], hostVersion, input: u.input, uncached: u.uncached, cacheCreation: u.cacheCreation, cacheRead: u.cacheRead, output: u.output,
        mcp: session?.inventory.mcp ?? null, ambientHash: hash, toolsListed: session?.tools.length ?? null, mcpToolsListed: session?.tools.filter((t) => t.startsWith('mcp__')).length ?? null,
        toolSearchListed: session ? session.tools.includes('ToolSearch') : null };
    });
    for (const row of made) { rows.push(row); appendFileSync(join(out, 'rows.jsonl'), JSON.stringify(row) + '\n'); }
  }
  if (plan.runs.some((r) => r.arm.host === 'codex')) {
    if (!codex?.ready) notes.push('Codex skipped: a free preflight check refused it (see preflight.jsonl).');
    else {
      const b = plan.runs.find((r) => r.arm.host === 'codex' && r.arm.kind === 'baseline' && r.free)!;
      const same = parsePromptInput(await full.run(b.free!.prompt), b.command.cwd).contextHash === codex.baseline?.contextHash && firstLine(await full.run(b.free!.version)) === codex.baseline.version;
      if (!same) throw new Error('Codex ambient context or version changed during the study; measurement invalid');
    }
  }
  return { rows, notes };
}

export function summarize(rows: Row[], notes: string[] = []): string {
  const lines = ['B7 input tokens per request. Delta is over the same host\'s no-MCP baseline, same repeat and turn.',
    'Claude readings: tool search false = every definition loaded; default = host tool search on; auto = host decides. Deferral is not reported by the host: read it from the delta against the fixture characters.',
    '| Host | Arm | Config | Tool search | Repeat | Turn | Input | Delta | Uncached | Cache creation | Cache read | Tools listed (MCP) | ToolSearch listed |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |'];
  for (const r of rows) {
    const base = rows.find((b) => b.host === r.host && b.kind === 'baseline' && b.repeat === r.repeat && b.turn === r.turn);
    lines.push(`| ${r.host} | ${r.kind} | ${r.config ?? ''} | ${r.toolSearch ?? ''} | ${r.repeat} | ${r.turn} | ${r.input} | ${base ? r.input - base.input : 'unavailable'} | ${r.uncached} | ${r.cacheCreation} | ${r.cacheRead} | ${r.toolsListed === null ? 'n/a' : `${r.toolsListed} (${r.mcpToolsListed})`} | ${r.toolSearchListed ?? 'n/a'} |`);
  }
  lines.push(...notes);
  lines.push('Codex has one request per session (a second turn needs a persisted session). Sessions per arm are few: report ranges, not intervals. Tokens, not money. Not measured: tool use through the gateway (find, list, call), output quality, other models.');
  return lines.join('\n');
}

export async function main(args: string[], deps: { print?: (s: string) => void; run?: Deps['run'] } = {}) {
  const print = deps.print ?? console.log;
  const { values } = parseArgs({ args, options: { offline: { type: 'boolean' }, run: { type: 'boolean' }, hosts: { type: 'string' }, configs: { type: 'string' }, repeats: { type: 'string' } } });
  const list = <T extends string>(text: string | undefined, allowed: readonly T[]) => text?.split(',').map((x) => { if (!allowed.includes(x as T)) throw new Error(`unknown value ${x}`); return x as T; });
  const only: Only = { hosts: list(values.hosts, ['claude', 'codex']), configs: list(values.configs, Object.keys(CONFIGS) as ConfigName[]), repeats: values.repeats ? Number(values.repeats) : undefined };
  if (only.repeats !== undefined && !(Number.isInteger(only.repeats) && only.repeats >= 1)) throw new Error('--repeats must be a positive integer');
  const facts = await offline();
  if (values.offline) { print(formatOffline(facts)); return; }
  const root = mkdtempSync(join(tmpdir(), 'loadout-b7-'));
  try {
    const plan = buildPlan(root, only);
    const e = estimate(plan.runs, facts);
    print(`${plan.runs.length} runs, ${e.requests} paid requests (Codex only if its preflight passes). Estimate: ${e.inputTokens[0]} to ${e.inputTokens[1]} input tokens; ${Math.round(e.seconds[0] / 60)} to ${Math.round(e.seconds[1] / 60)} minutes. Subscription quota; no Jev. Needs Erik's approval before --run.`);
    print('The low figure uses B1\'s 8.5k tokens a call, measured with `--tools Skill`; B7 keeps every built-in tool, so it probably undercounts. The pilot calibrates it.');
    for (const blocker of plan.blockers) print(`BLOCKED: ${blocker}`);
    if (!values.run) {
      print('Illustrative: the temp root below is deleted when this exits, so use --run rather than replaying these lines. Claude is sent both stdin lines, the second after the first result.');
      for (const r of plan.runs) {
        const env = r.arm.host === 'claude' ? ` env=ENABLE_TOOL_SEARCH=${r.command.env?.ENABLE_TOOL_SEARCH ?? '(unset)'},MCP_TIMEOUT=${r.command.env?.MCP_TIMEOUT}` : '';
        print(`PAID ${armId(r.arm)}/${r.repeat}: cwd=${JSON.stringify(r.command.cwd)}${env} argv=${JSON.stringify([r.command.bin, ...r.command.args])}${r.command.stdin ? ` stdin=${JSON.stringify(r.command.stdin)}` : ''}`);
      }
      return;
    }
    // The only write outside the temp root: committed raw rows, as in B1.
    const out = fileURLToPath(new URL(`./results/${new Date().toISOString().replace(/[:.]/g, '-')}-b7-mcp-overhead/`, import.meta.url));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'offline.json'), JSON.stringify(facts, null, 1));
    const { rows, notes } = await runStudy(plan, out, { run: deps.run });
    writeFileSync(join(out, 'summary.md'), summarize(rows, notes) + '\n');
    print(`Raw metrics: ${out}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'mcp-overhead failed'); process.exitCode = 1; });
}
