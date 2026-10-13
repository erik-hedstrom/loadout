/**
 * B7: what configured MCP servers cost per request, natively and through loadout's gateway.
 * Method and acceptance: docs/loop/BACKLOG.md (B7). Nothing is measured until `--run`.
 *
 *   npx tsx bench/mcp-overhead.ts --offline               characters per arm, no CLI, no network, $0
 *   npx tsx bench/mcp-overhead.ts                         the plan, argv and the estimate below, $0
 *   npx tsx bench/mcp-overhead.ts --run --hosts claude --configs n1 --repeats 1    pilot
 *   npx tsx bench/mcp-overhead.ts --run                   everything; needs Erik's approval of the estimate
 *
 * Two Claude baselines per configuration: ENABLE_TOOL_SEARCH=false loads every definition (hosts and
 * models without tool search); the default leaves the host's own tool search on (names and server
 * instructions load, definitions are deferred). `auto` is the third reading. Codex has one reading
 * (its default). Each run is a fresh session: request 1, then request 2 in the same session.
 *
 * Estimate (not observed; `--plan` recomputes it): 23 arms x 2 sessions x 2 requests = 92 paid requests
 * (64 Claude haiku, 28 Codex; the Codex ones only if its preflight passes). B1 spent about 136k input
 * tokens over 16 calls, 8.5k a call, mostly cache creation. Low: 92 x 8.5k = 0.8M input tokens, if
 * tool search defers everything. High: 3.2M, if every native arm loads every definition (n20 is 0.36M
 * characters of definitions, taken as 3 characters a token, an assumption). Subscription quota, no Jev;
 * list-price money is not computed, as in B1. Time: 92 x 30 s = 46 minutes at an assumed 30 s a call;
 * at most 92 x 120 s = 184 minutes (the timeout in execute()). A pilot (`--hosts claude --configs n1
 * --repeats 1`, 6 runs, 12 requests, about 0.1M tokens, 6 to 24 minutes) comes first.
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
import { assertTemporary, claudeIsolation, cli, codexSettings, execute, MODELS, parseClaude, parseCodex, parsePromptInput, validateFeatures, type Command, type Host, type Usage } from './overhead.js';
import { catalogFacts, serverSpecs, type Facts, type ServerSpec } from './mcp-fixtures.js';

const PROMPTS = ['Reply with exactly OK. Do not use tools, skills, commands, agents, or external services.', 'Reply with exactly OK again. Do not use tools, skills, commands, agents, or external services.'] as const;
const CONFIGS = { n1: 1, n5: 5, n20: 20 } as const;
const TOOL_SEARCH = ['default', 'false', 'auto'] as const;
const FIXTURE_SERVER = fileURLToPath(new URL('./mcp-fixture-server.ts', import.meta.url));
const B1_INPUT_PER_CALL = 8_500;
const CHARS_PER_TOKEN = [4, 3] as const;
const SECONDS_PER_CALL = [30, 120] as const;
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

export interface Run { arm: Arm; repeat: number; servers: string[]; first: Command; follow: (session: string) => Command; free?: { features: Command; prompt: Command } }
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
  mkdirSync(join(home, 'library'), { recursive: true });
  const servers = Object.fromEntries(serverSpecs(CONFIGS[config]).map((s) => [s.name, { ...serverConfig(s), description: `${s.archetype} fixture`, gateway: true }]));
  writeFileSync(join(home, 'library', 'mcp.json'), JSON.stringify({ mcpServers: servers }));
  writeFileSync(join(home, 'config.json'), JSON.stringify({ embeddings: false }));
  return { command: process.execPath, args: ['--import', import.meta.resolve('tsx'), fileURLToPath(new URL('../src/cli.ts', import.meta.url)), 'mcp', '--lexical'], env: { LOADOUT_HOME: home } };
}

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
    const claude = (extra: string[]) => command([...claudeIsolation(servers, true), '--model', MODELS.claude, ...extra], { env: claudeEnv(env, arm.toolSearch) });
    for (let repeat = 1; repeat <= (only.repeats ?? 2); repeat++) {
      runs.push(arm.host === 'claude'
        ? { arm, repeat, servers: Object.keys(servers), first: claude([PROMPTS[0]]), follow: (id) => claude(['--resume', id, PROMPTS[1]]) }
        : { arm, repeat, servers: Object.keys(servers), first: command(['exec', '--json', '--skip-git-repo-check', ...settings, PROMPTS[0]]),
            // Persisted so the second request can resume it; unverified against the installed Codex until the pilot.
            follow: (id) => command(['exec', 'resume', '--json', '--skip-git-repo-check', ...settings, id, PROMPTS[1]]),
            ...(repeat === 1 ? { free: { features: command(['features', 'list', ...settings]), prompt: command(['debug', 'prompt-input', ...settings, PROMPTS[0]]) } } : {}) });
    }
  }
  runs.sort((a, b) => Number(a.arm.host === 'codex') - Number(b.arm.host === 'codex') || Number(a.arm.kind !== 'baseline') - Number(b.arm.kind !== 'baseline'));
  return { runs, blockers, root };
}

export interface Estimate { requests: number; inputTokens: [number, number]; seconds: [number, number] }
/** Requests are 2 per run. Low assumes everything deferred; high assumes every definition loads at 3 characters a token. */
export function estimate(runs: Run[], rows: OfflineRow[]): Estimate {
  const requests = runs.length * 2;
  let low = 0, high = 0;
  for (const run of runs) {
    low += 2 * B1_INPUT_PER_CALL;
    const facts = rows.find((r) => r.kind === run.arm.kind && r.config === run.arm.config);
    high += 2 * (B1_INPUT_PER_CALL + (facts ? (facts.definitionChars + facts.instructionChars) / CHARS_PER_TOKEN[1] : 0));
  }
  return { requests, inputTokens: [Math.round(low), Math.round(high)], seconds: [requests * SECONDS_PER_CALL[0], requests * SECONDS_PER_CALL[1]] };
}

// --- Measurement -----------------------------------------------------------------------------

const SESSION_ID = /^[0-9A-Za-z][0-9A-Za-z-]*$/;
const jsonLines = (stdout: string) => stdout.split(/\r?\n/).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
/** The session or thread to resume, and for Claude the tool names its init event lists. */
export function sessionFacts(stdout: string, host: Host): { session: string; tools: string[] | null } {
  for (const e of jsonLines(stdout)) {
    const claude = host === 'claude' && e?.type === 'system' && e.subtype === 'init';
    const id = claude ? e.session_id : host === 'codex' && e?.type === 'thread.started' ? e.thread_id : undefined;
    if (typeof id === 'string' && SESSION_ID.test(id)) {
      const tools = claude && Array.isArray(e.tools) ? e.tools.map((t: unknown) => typeof t === 'string' ? t : (t as { name?: string })?.name ?? '') : null;
      return { session: id, tools };
    }
  }
  throw new Error('host did not report a usable session id');
}

export interface Row {
  host: Host; kind: Arm['kind']; config: ConfigName | null; toolSearch: ToolSearch | null; repeat: number; turn: 1 | 2;
  model: string | null; requestedModel: string; input: number; uncached: number; cacheCreation: number; cacheRead: number; output: number;
  mcp: { name: string; status: string }[] | null; ambientHash: string | null;
  toolsListed: number | null; mcpToolsListed: number | null; toolSearchListed: boolean | null; renderedCharacters: number | null;
  fixture: { tools: number; definitionChars: number; nameChars: number; instructionChars: number } | null;
}
// Deferral is not reported by either host; these init facts and the input delta against the fixture characters are the evidence.
const ambient = (u: Usage) => createHash('sha256').update(JSON.stringify({ plugins: [...u.inventory!.plugins].sort(), skills: [...u.inventory!.skills].sort(), slashCommands: [...u.inventory!.slashCommands].sort() })).digest('hex');

export interface Deps { run?: (command: Command) => Promise<string> }
export async function runStudy(plan: Plan, out: string, rows: OfflineRow[], deps: Deps = {}): Promise<Row[]> {
  if (plan.blockers.length) throw new Error(`blocked: ${plan.blockers.join('; ')}`);
  const run = deps.run ?? execute;
  mkdirSync(out, { recursive: true });
  const measured: Row[] = [];
  let codexReady: boolean | undefined;
  for (const r of plan.runs) {
    if (r.arm.host === 'codex') {
      codexReady ??= await codexPreflight(plan, run, out);
      if (!codexReady) continue;
    }
    const first = await run(r.first);
    const { session, tools } = sessionFacts(first, r.arm.host);
    const outputs = [first, await run(r.follow(session))];
    for (const [i, stdout] of outputs.entries()) {
      const u = r.arm.host === 'claude' ? parseClaude(stdout, i === 0 ? [1] : [1, 2]) : parseCodex(stdout);
      const hash = u.inventory ? ambient(u) : null;
      const baseline = measured.find((m) => m.host === r.arm.host && m.kind === 'baseline');
      if (baseline && hash && baseline.ambientHash !== hash) throw new Error('Claude ambient inventory drift; measurement invalid');
      if (u.inventory && !r.servers.every((s) => u.inventory!.mcp.some((m) => m.name === s && m.status === 'connected'))) throw new Error('an MCP server did not connect; measurement invalid');
      if (u.inventory && u.inventory.mcp.length !== r.servers.length) throw new Error('unexpected MCP servers; measurement invalid');
      const fixture = r.arm.kind === 'native' ? catalogFacts(CONFIGS[r.arm.config!]) : null;
      const row: Row = { host: r.arm.host, kind: r.arm.kind, config: r.arm.config ?? null, toolSearch: r.arm.toolSearch ?? null, repeat: r.repeat, turn: (i + 1) as 1 | 2,
        model: u.model, requestedModel: MODELS[r.arm.host], input: u.input, uncached: u.uncached, cacheCreation: u.cacheCreation, cacheRead: u.cacheRead, output: u.output,
        mcp: u.inventory?.mcp ?? null, ambientHash: hash, toolsListed: tools?.length ?? null, mcpToolsListed: tools?.filter((t) => t.startsWith('mcp__')).length ?? null,
        toolSearchListed: tools ? tools.includes('ToolSearch') : null, renderedCharacters: null,
        fixture: fixture && { tools: fixture.tools, definitionChars: fixture.definitionChars, nameChars: fixture.nameChars, instructionChars: fixture.instructionChars } };
      measured.push(row);
      appendFileSync(join(out, 'rows.jsonl'), JSON.stringify(row) + '\n');
    }
  }
  return measured;
}

/** Free Codex checks, as in B1: the paid runs wait until unified_exec and the other features read disabled. */
async function codexPreflight(plan: Plan, run: (command: Command) => Promise<string>, out: string): Promise<boolean> {
  let ready = true;
  for (const r of plan.runs.filter((x) => x.free)) {
    const result: Record<string, unknown> = { arm: armId(r.arm), refusals: [] as string[] };
    try { result.renderedCharacters = parsePromptInput(await run(r.free!.prompt), r.first.cwd).renderedCharacters; }
    catch { (result.refusals as string[]).push('prompt-input collection failed (details suppressed)'); }
    try { validateFeatures(await run(r.free!.features)); }
    catch (error) { (result.refusals as string[]).push((error as Error).message); }
    if ((result.refusals as string[]).length) ready = false;
    appendFileSync(join(out, 'preflight.jsonl'), JSON.stringify(result) + '\n');
  }
  return ready;
}

export function summarize(rows: Row[]): string {
  const lines = ['B7 input tokens per request. Delta is over the same host\'s no-MCP baseline, same repeat and turn.',
    'Claude readings: tool search false = every definition loaded; default = host tool search on; auto = host decides. Deferral is not reported by the host: read it from the delta against the fixture characters.',
    '| Host | Arm | Config | Tool search | Repeat | Turn | Input | Delta | Uncached | Cache creation | Cache read | Tools listed (MCP) | ToolSearch listed |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |'];
  for (const r of rows) {
    const base = rows.find((b) => b.host === r.host && b.kind === 'baseline' && b.repeat === r.repeat && b.turn === r.turn);
    lines.push(`| ${r.host} | ${r.kind} | ${r.config ?? ''} | ${r.toolSearch ?? ''} | ${r.repeat} | ${r.turn} | ${r.input} | ${base ? r.input - base.input : 'unavailable'} | ${r.uncached} | ${r.cacheCreation} | ${r.cacheRead} | ${r.toolsListed === null ? 'n/a' : `${r.toolsListed} (${r.mcpToolsListed})`} | ${r.toolSearchListed ?? 'n/a'} |`);
  }
  lines.push('Sessions per arm are few: report ranges, not intervals. Tokens, not money. Not measured: tool use through the gateway (find, list, call), output quality, other models.');
  return lines.join('\n');
}

export async function main(args: string[], print: (s: string) => void = console.log) {
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
    for (const blocker of plan.blockers) print(`BLOCKED: ${blocker}`);
    if (!values.run) {
      for (const r of plan.runs) print(`PAID ${armId(r.arm)}/${r.repeat}: cwd=${JSON.stringify(r.first.cwd)} argv=${JSON.stringify([r.first.bin, ...r.first.args])}`);
      return;
    }
    const out = fileURLToPath(new URL(`./results/${new Date().toISOString().replace(/[:.]/g, '-')}-b7-mcp-overhead/`, import.meta.url));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'offline.json'), JSON.stringify(facts, null, 1));
    const rows = await runStudy(plan, out, facts);
    writeFileSync(join(out, 'summary.md'), summarize(rows) + '\n');
    print(`Raw metrics: ${out}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'mcp-overhead failed'); process.exitCode = 1; });
}
