/**
 * C14: three prompts, each run with and without loadout in the stock CLIs, on the path a user installs
 * (the Claude Code plugin and MCP server, the Codex MCP server and hook), recording the host's own token usage per
 * request and judging the deliverables blind. Nothing is spent without `--run`; method and caveats are in
 * docs/loop/BACKLOG.md (C14) and bench/RESULTS.md.
 *
 *   npx tsx bench/ab.ts                                   # --plan: prompts, argv, env names, writes, estimate; $0
 *   npx tsx bench/ab.ts --run [--repeats 2] [--hosts claude,codex] [--ids a,b] [--out <dir>]   # resumable
 *   npx tsx bench/ab.ts --judge-only <dir>
 *
 * The cache is the confound. Each arm has its own prefix and so its own cache entry: a cold first run would charge
 * the cache writes to whichever arm ran first. So every host and arm starts with one recorded warm-up run (excluded from
 * the comparisons, reported as the cold start), and the measured runs alternate between the arms.
 */
import { appendFileSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { delimiter, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { DEFAULT_CONFIG, loadConfig, paths, resolveApiKey } from '../src/config.js';
import { JEV_FALLBACK_NOTE, NO_KEY_WARNING } from '../src/hook.js';
import { hookCommand, SEARCH_SERVER, SEARCH_TOOLS, searchServer, toToml } from '../src/launch.js';
import { capabilityKey, readManifest, scanLibrary } from '../src/library.js';
import { CREDENTIAL_SHAPE, persistJson, redact, report, TOKEN_ANYWHERE, type Leak, type RunRow, type Verdict } from './ab-report.js';
import { codexJudgeRefusal, DATA, modelJson, readJsonl, RESULTS, run } from './lib.js';
import { CLAUDE_MANAGED_PRECONDITION, CLAUDE_SCRUB_PRECONDITION, CLAUDE_SETTINGS, CLAUDE_SWITCH_PRECONDITION, CODEX_CLOUD_PRECONDITION, childEnv, claudeEnv, envAllowlist, hostWrites, redacted, refusedFiles, resetWork } from './mcp-overhead.js';
import { assertTemporary, claudeIsolation, cli, execute, validateFeatures, type Command, type Host } from './overhead.js';
import { deliverableFiles, deliverables, JUDGE_MAX_BYTES, judgePair, JUDGE_SYSTEM, NOTE, PrefSchema, type Arm } from './pairwise.js';
import { hookShim, toolEvents, type Event, type HookExecution, type Inventory } from './stream.js';
import { claudeUsage, codexUsage, effectiveInput, sumUsage, type RunUsage } from './usage.js';

const ARMS: Arm[] = ['bare', 'loadout'];
/** Held-out C1 test rows where all three 2026-10-16 Jev reruns loaded the same set and the C1 judge rated a loaded skill useful: one copy, one document, one code task. */
const PILOT = [
  { id: 'c1-web-14', kind: 'copy' },
  { id: 'c1-apps-08', kind: 'document' },
  { id: 'c1-debug-13', kind: 'code', fixture: 'c1-debug-13', hidden: 'c1-debug-13.hidden.test.mjs' },
] as const;
type PromptSpec = { id: string; kind: string; fixture?: string; hidden?: string };
/** Three or more words, or the hook treats it as a follow-up and adds nothing. */
const WARMUP_PROMPT = 'Reply with the single word READY and nothing else. Do not use any tools.';
export const AB_MODELS: Record<Host, string> = { claude: 'sonnet', codex: 'gpt-6.1-sol' };
/** Cross-family (AGENTS.md): Codex outputs are judged by Claude, Claude outputs by Codex. */
const JUDGES: Record<Host, { backend: 'claude' | 'codex'; model: string }> = { claude: { backend: 'codex', model: 'gpt-6.1-sol' }, codex: { backend: 'claude', model: 'opus' } };
/** Beyond the allowlist, only the loadout arm gets these: the hook and the MCP server read the key and the home. */
const LOADOUT_ENV = ['TYPESAFE_API_KEY', 'LOADOUT_HOME'];
const CACHE_TTL_MS = 5 * 60_000;
const FIXTURES = join(DATA, 'ab-fixtures');
const REPO = resolve(DATA, '..', '..');

export interface Job { host: Host; arm: Arm; prompt: string; repeat: number; warmup: boolean; seq: number }
const jobId = (j: Pick<Job, 'host' | 'arm' | 'prompt' | 'repeat'>) => `${j.host}/${j.arm}/${j.prompt}/${j.repeat}`;

/**
 * Per host: one warm-up run per arm, then the measured runs with the arms alternating, the arm that goes first
 * alternating too (by prompt and repeat), so neither arm always follows the other.
 */
export function schedule(hosts: Host[], prompts: string[], repeats: number): Job[] {
  const jobs: Omit<Job, 'seq'>[] = [];
  for (const host of hosts) {
    for (const arm of ARMS) jobs.push({ host, arm, prompt: 'warmup', repeat: 0, warmup: true });
    for (let repeat = 1; repeat <= repeats; repeat++) {
      prompts.forEach((prompt, i) => {
        for (const arm of (i + repeat) % 2 === 0 ? ARMS : [...ARMS].reverse()) jobs.push({ host, arm, prompt, repeat, warmup: false });
      });
    }
  }
  return jobs.map((j, seq) => ({ ...j, seq }));
}

export function promptText(spec: PromptSpec): string {
  const request = readJsonl<{ id: string; request: string }>(join(DATA, 'requests-c1.jsonl')).find((r) => r.id === spec.id)?.request;
  if (!request) throw new Error(`no request ${spec.id} in requests-c1.jsonl`);
  // The shared note says the folder is empty; a fixture prompt's folder is not.
  return request + (spec.fixture ? NOTE.replace('nothing is attached and the folder is empty', 'the project is in this folder') : NOTE);
}

export interface Ctx {
  work: string;
  shimDir: string;
  /** Claude's fresh home for this run. */
  configDir: string;
  /** The environment the harness itself runs in; a run gets only the allowlisted part. */
  env: NodeJS.ProcessEnv;
  models: Record<Host, string>;
  maxTurns: number;
  codexHook: boolean;
}

/** `Bash(node --test)` and its arguments: how the agent checks a fix. Both arms, so the permission policy is not a difference. */
const ALLOWED = ['Bash(node --test)', 'Bash(node --test *)'];
const { disableAllHooks: _hooksOff, ...CLAUDE_AB_SETTINGS } = CLAUDE_SETTINGS;

/** Claude's server entry as `loadout setup claude-code` registers it; the same server for Codex plus what its plugin's .mcp.json adds. */
const claudeServer = () => searchServer(false);
const codexServer = () => ({ ...searchServer(false), required: true, env_vars: ['TYPESAFE_API_KEY'], tools: Object.fromEntries(SEARCH_TOOLS.map((t) => [t, { approval_mode: 'approve' }])) });
const CODEX_HOOK = [{ hooks: [{ type: 'command', command: 'loadout hook codex', timeout: 30 }] }];
/** Codex features off in an arm: no plugins and no skill MCP installs anywhere, and no hooks unless this is the loadout arm with its hook. */
const featuresOff = (arm: Arm, codexHook: boolean) => ['plugins', 'skill_mcp_dependency_install', ...(arm === 'loadout' && codexHook ? [] : ['hooks'])];

/**
 * The environment of one run, by allowlist (B7's, so no API key and no ambient override reaches a host). The shim
 * directory leads PATH in both arms: the plugin's hook calls `loadout` by name, and the bare arm proves it never does.
 */
export function runEnv(job: Pick<Job, 'host' | 'arm'>, ctx: Pick<Ctx, 'shimDir' | 'configDir' | 'env'>): NodeJS.ProcessEnv {
  const env = childEnv(ctx.env, job.host);
  if (job.arm === 'loadout') for (const name of LOADOUT_ENV) if (ctx.env[name]) env[name] = ctx.env[name];
  env.PATH = `${ctx.shimDir}${delimiter}${env.PATH ?? ''}`;
  return job.host === 'claude' ? { ...claudeEnv(env), CLAUDE_CONFIG_DIR: ctx.configDir } : env;
}

export function buildCommand(job: Job, prompt: string, ctx: Ctx): Command {
  const binary = cli(job.host);
  const env = runEnv(job, ctx);
  if (job.host === 'claude') {
    const servers = job.arm === 'loadout' ? { [SEARCH_SERVER]: claudeServer() } : {};
    const trusted = job.arm === 'loadout' ? SEARCH_TOOLS.map((t) => `mcp__${SEARCH_SERVER}__${t}`) : [];
    const args = [...claudeIsolation(servers, CLAUDE_AB_SETTINGS, { restricted: false, prompt }), '--include-hook-events', '--max-turns', String(ctx.maxTurns), '--model', ctx.models.claude, '--permission-mode', 'acceptEdits',
      '--allowedTools', ...ALLOWED, ...trusted, ...(job.arm === 'loadout' ? ['--plugin-dir', join(REPO, 'plugins', 'loadout')] : [])];
    return { bin: binary.bin, args: [...binary.prefix, ...args], cwd: ctx.work, env };
  }
  const hook = job.arm === 'loadout' && ctx.codexHook;
  const args = ['exec', '--json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '-s', 'workspace-write', '-m', ctx.models.codex,
    ...featuresOff(job.arm, ctx.codexHook).flatMap((f) => ['--disable', f]),
    ...(job.arm === 'loadout' ? ['-c', `mcp_servers.${SEARCH_SERVER}=${toToml(codexServer())}`] : []),
    ...(hook ? ['--dangerously-bypass-hook-trust', '-c', `hooks.UserPromptSubmit=${toToml(CODEX_HOOK)}`] : []), prompt];
  return { bin: binary.bin, args: [...binary.prefix, ...args], cwd: ctx.work, env };
}

// --- What a run shows ----------------------------------------------------------------------

const isBuiltin = (p: { path?: string; source?: string }) => p.path === 'builtin' || /@builtin$/.test(p.source ?? '');
const normalize = (p: string) => {
  let real = p;
  try { real = realpathSync(p); } catch { /* not on disk: compare as given */ }
  return real.replace(/\\/g, '/').replace(/\/$/, '');
};

/** One line of the shim's capture per hook invocation: the hook's JSON output (empty when it stayed silent). */
const hookOutputs = (captured: string): any[] =>
  captured.split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; } // not a hook output
  });

export function hookFacts(captured: string): { contextChars: number; listed: string[]; injected: string[] } {
  const text = hookOutputs(captured).map((o) => o.hookSpecificOutput?.additionalContext ?? '').join('');
  return { contextChars: text.length, listed: [...text.matchAll(/^- "([^"]+)" \(fit/gm)].map((m) => m[1]!), injected: [...text.matchAll(/<skill name="([^"]*)"/g)].map((m) => m[1]!) };
}

/**
 * Whether the loadout arm routed by keyword instead of Jev: the hook said it has no key or that Jev failed, or a find_tools
 * result is tagged as a keyword match. Such a run measures a setup nobody installs, so it cannot count.
 */
export function routedByKeyword(captured: string, hookStderr: string, events: Event[]): boolean {
  return hookOutputs(captured).some((o) => o.systemMessage === NO_KEY_WARNING) || hookStderr.includes(JEV_FALLBACK_NOTE)
    || events.some((e) => e.ok && e.tool.startsWith(`mcp__${SEARCH_SERVER}__`) && /\(keyword match[,)]|used keyword ranking\)/.test(e.result ?? ''));
}

/** Names of the skills the agent opened: the Skill tool, loadout's load_skill, or a read of a SKILL.md. */
export function openedSkills(events: Event[]): string[] {
  const names = new Set<string>();
  for (const e of events) {
    if (!e.ok) continue;
    let input: any = {};
    try { input = JSON.parse(e.detail); } catch { /* a shell command is plain text */ }
    if ((e.tool === 'Skill' || e.tool.endsWith('__load_skill')) && typeof (input.skill ?? input.key) === 'string') names.add(String(input.skill ?? input.key).replace(/^loadout:/, ''));
    for (const m of e.detail.matchAll(/skills(?:\\\\|\\|\/)+([\w.-]+)(?:\\\\|\\|\/)+SKILL\.md/g)) names.add(m[1]!);
  }
  return [...names];
}

export interface Evidence { usage: RunUsage | null; hooks: HookExecution[]; inventory?: Inventory; failedBeforeModel: boolean; hookInvocations: number; /** Exit status the shim recorded for each invocation that finished. */ hookExits: number[]; uncountedContext: number; keywordRouted: boolean; pluginDir: string; codexHook: boolean; requestedModel: string }

/** The reason this run cannot count, or undefined. A hard failure stops the batch: the arms did not differ the way the study says. */
export function checkRun(job: Pick<Job, 'host' | 'arm'>, e: Evidence): string | undefined {
  const expected = job.arm === 'loadout' && (job.host === 'claude' || e.codexHook) ? 1 : 0;
  if (e.hookInvocations !== expected) return `expected ${expected} loadout hook invocation(s), saw ${e.hookInvocations}; measurement invalid`;
  // A hook that succeeds with no context is fine (exit 0); one that failed or never finished is not, on either host.
  if (e.hookExits.length !== e.hookInvocations || e.hookExits.some((code) => code !== 0)) return `the loadout hook did not finish successfully (${e.hookInvocations} started, exits ${JSON.stringify(e.hookExits)}); measurement invalid`;
  if (e.uncountedContext > 0) return 'uncounted loadout hook context; measurement invalid';
  if (job.arm === 'loadout' && e.keywordRouted) return 'the loadout arm routed by keyword (no TypeSafe key reached it, or Jev failed); measurement invalid';
  if (e.failedBeforeModel) return 'agent failed before the model ran';
  if (job.host === 'codex') return undefined;
  if (!e.inventory) return 'no startup inventory';
  const foreign = e.inventory.plugins.filter((p) => !isBuiltin(p));
  if (job.arm === 'bare' && foreign.length) return 'ambient plugin in the bare arm; measurement invalid';
  if (job.arm === 'loadout' && (foreign.length !== 1 || foreign[0]!.name !== 'loadout' || normalize(foreign[0]!.path ?? '') !== normalize(e.pluginDir))) return 'the loadout plugin is not present exactly once, or another plugin is; measurement invalid';
  const servers = e.inventory.mcpServers;
  if (job.arm === 'bare' && servers.length) return 'MCP server in the bare arm; measurement invalid';
  if (job.arm === 'loadout' && !(servers.length === 1 && servers[0]!.name === SEARCH_SERVER && servers[0]!.status === 'connected')) return 'loadout MCP server missing or not connected; measurement invalid';
  if (e.hooks.length !== expected) return `the host ran ${e.hooks.length} UserPromptSubmit hook(s), expected ${expected}; measurement invalid`;
  if (e.hooks.some((h) => h.exit_code !== 0 || h.outcome !== 'success')) return 'the host reported the loadout hook as failed or unfinished; measurement invalid';
  if (e.usage?.model && !e.usage.model.toLowerCase().includes(e.requestedModel.toLowerCase())) return `the host resolved model ${e.usage.model}, not ${e.requestedModel}; measurement invalid`;
  return undefined;
}

// --- Deliverables -----------------------------------------------------------------------------

const SKIP_DIRS = /[/\\](node_modules|\.git|\.venv|venv|__pycache__)([/\\]|$)/;

/** Text a public row may carry: this machine's folders, as variables. */
export function scrub(text: string, folders: [string, string][]): string {
  return folders.reduce((t, [from, to]) => t.split(from).join(to).split(from.replace(/\\/g, '/')).join(to), text);
}

const CREDENTIAL_IN_OUTPUT = 'credential in output';

const holdsSecret = (text: string | Buffer, secrets: string[]): boolean => secrets.some((s) => text.includes(s));

function heldSecretLeak(work: string, secrets: string[], dir = work): Leak | null {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    const file = relative(work, p).replace(/\\/g, '/');
    if (holdsSecret(file, secrets)) return { file: '<credential-bearing path>', rule: 'held secret' };
    if (entry.isDirectory()) {
      const leak = heldSecretLeak(work, secrets, p);
      if (leak) return leak;
    } else if (entry.isFile() && holdsSecret(readFileSync(p), secrets)) {
      return { file, rule: 'held secret' };
    }
  }
  return null;
}

/**
 * Held secrets stop any run; token shapes stop only files that would reach the judge. The copy is the judge's view
 * (`deliverables` in pairwise.ts): binary files and files over JUDGE_MAX_BYTES are left out there, so they are here too.
 */
export function copyOutputs(work: string, dest: string, folders: [string, string][], secrets: string[]): Leak | null {
  rmSync(dest, { recursive: true, force: true });
  const leak = heldSecretLeak(work, secrets);
  if (leak) return leak;
  const files = deliverableFiles(work).flatMap((p) => {
    if (statSync(p).size > JUDGE_MAX_BYTES) return [];
    const buf = readFileSync(p);
    return buf.includes(0) ? [] : [{ file: relative(work, p), text: buf.toString('utf8') }];
  });
  for (const { file, text } of files) {
    const pathHit = CREDENTIAL_SHAPE.test(file);
    if (pathHit || CREDENTIAL_SHAPE.test(text)) return { file: pathHit ? '<credential-bearing path>' : file.replace(/\\/g, '/'), rule: 'token shape' };
  }
  for (const { file, text } of files) {
    const to = join(dest, file);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, scrub(text, folders));
  }
  mkdirSync(dest, { recursive: true });
  return null;
}

/** Runs the harness's own test against a copy of the agent's folder; the test is never in the folder the agent works in. */
export function hiddenResult(folder: string, hiddenTest: string): { passed: boolean; tests: number; failed: number } {
  const dir = mkdtempSync(join(tmpdir(), 'loadout-ab-hidden-'));
  try {
    cpSync(folder, dir, { recursive: true, filter: (src) => !SKIP_DIRS.test(src) });
    copyFileSync(hiddenTest, join(dir, 'hidden.test.mjs'));
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'hidden.test.mjs'], { cwd: dir, encoding: 'utf8', timeout: 60_000, env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT } });
    const n = (k: string) => Number(new RegExp(`^# ${k} (\\d+)`, 'm').exec(r.stdout ?? '')?.[1] ?? 0);
    return { passed: r.status === 0 && n('fail') === 0 && n('tests') > 0, tests: n('tests'), failed: n('fail') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Skill names that would show which arm wrote a file; replaced the same way in both arms' files. */
export function redactNames(text: string, names: string[]): { text: string; count: number } {
  let count = 0;
  const variants = [...new Set(names.flatMap((n) => [n, n.split('--')[0]!]))].filter((n) => n.length > 2).sort((a, b) => b.length - a.length);
  for (const n of variants) text = text.replace(new RegExp(`(?<![\\w-])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'gi'), () => (count++, '[skill]'));
  return { text, count };
}

// --- Plan -------------------------------------------------------------------------------------

export interface Options { hosts: Host[]; ids: string[]; repeats: number; models: Record<Host, string>; maxTurns: number; timeoutS: number; codexHook: boolean }

/** Set only by the harness's stand-in test; a real study never sets it. */
const SELF_TEST = 'LOADOUT_AB_SELF_TEST';

export function blockers(o: Options, env: NodeJS.ProcessEnv = process.env): string[] {
  const out: string[] = [];
  if (o.hosts.includes('claude')) {
    const managed = refusedFiles('claude');
    if (managed.length) out.push(`Claude state the study cannot isolate exists (${managed.map((f) => redacted(f)).join(', ')}): managed settings override --settings`);
    if (!env.CLAUDE_CODE_OAUTH_TOKEN) out.push('Claude arms require CLAUDE_CODE_OAUTH_TOKEN (personal subscription) on a fresh empty Claude home');
  }
  if (o.hosts.includes('codex')) {
    const refused = refusedFiles('codex');
    if (refused.length) out.push(`Codex state the study cannot isolate exists (${refused.map((f) => redacted(f)).join(', ')})`);
    const codexHome = env.CODEX_HOME || join(homedir(), '.codex');
    const hooksJson = join(codexHome, 'hooks.json');
    if (o.codexHook && existsSync(hooksJson)) out.push(`${redacted(hooksJson)} exists: the loadout arm bypasses hook trust for this invocation, which would run it. Move it away or pass --no-codex-hook`);
    // Codex reads the first non-empty of these into every run's prompt (codex-rs/codex-home/src/instructions/mod.rs, rust-v0.160.1),
    // and --ignore-user-config does not skip them. lstat: a symlink to a global instructions file counts, as it is how one is shared.
    for (const name of ['AGENTS.override.md', 'AGENTS.md']) {
      const file = join(codexHome, name);
      if (lstatSync(file, { throwIfNoEntry: false })) out.push(`${redacted(file)} exists: Codex loads global instructions into every run of both arms, which steers the agent and its searches. Move it aside for the study`);
    }
  }
  let config;
  try { config = loadConfig(); } catch { out.push('the loadout config is invalid (loadout doctor)'); }
  // Lexical routing makes the hook stay quiet and skips the key checks below, so the loadout arm would
  // look valid while measuring next to nothing: the study is a Jev study or it does not run. The one exception
  // is this harness's own stand-in test (test/ab.test.ts), which runs the real hook and must not reach Jev's network.
  if (config && config.router !== 'jev' && env[SELF_TEST] !== 'lexical') out.push(`the loadout config sets "router": "${config.router}": the loadout arm would not route with Jev. Set "router": "jev" for the study`);
  if (config) {
    const library = scanLibrary(paths.library());
    if (!library.length) out.push(`the loadout library is empty (${redacted(paths.library())}): the hook would route over nothing`);
    const unblindable = library.filter((c) => TOKEN_ANYWHERE.test(c.name) || TOKEN_ANYWHERE.test(capabilityKey(c))).length;
    if (unblindable) out.push(`library capability names requiring redaction: ${unblindable}; blind judging is not possible`);
  }
  if (config?.router === 'jev' && !resolveApiKey(config)) out.push('the loadout arm needs a TypeSafe key (TYPESAFE_API_KEY or `loadout init --key-file`), or it measures keyword routing');
  // Claude can strip the variable from the MCP server (its environment allowlist) and the hook (its subprocess scrub), but not a key file the config names.
  if (o.hosts.includes('claude') && config?.router === 'jev' && !config.jev.apiKeyFile) out.push('the Claude loadout arm needs the key through a key file (`loadout init --key-file`): TYPESAFE_API_KEY alone may not reach its MCP server or hook, and a loadout arm that routes by keyword is invalid');
  return out;
}

/**
 * Free: each judge the hosts need can run. The judging comes after every agent run, so a judge that cannot run would
 * otherwise be found only after the quota is spent. Claude's outputs go to Codex, which cannot run tool-less on the
 * codex-cli versions seen so far (E12); Codex's outputs go to Claude.
 */
export function judgeProblems(o: Options): string[] {
  const out: string[] = [];
  for (const host of o.hosts) {
    const { backend } = JUDGES[host];
    if (backend === 'codex') {
      const refusal = codexJudgeRefusal();
      if (refusal) out.push(`${host} outputs are judged by Codex and it cannot: ${refusal}`);
    } else {
      try { version('claude'); } catch { out.push(`${host} outputs are judged by Claude, and \`claude --version\` failed`); }
    }
  }
  return out;
}

export function planLines(o: Options, env: NodeJS.ProcessEnv = process.env, root = '<work root>'): string[] {
  const jobs = schedule(o.hosts, o.ids, o.repeats);
  const specs = o.ids.map((id) => PILOT.find((p) => p.id === id) as PromptSpec);
  const lines: string[] = [];
  const loadoutRuns = jobs.filter((j) => j.arm === 'loadout').length;
  const claudeRuns = jobs.filter((j) => j.host === 'claude').length;
  lines.push(`${jobs.length} paid runs (${jobs.filter((j) => j.warmup).length} warm-ups): ${o.hosts.map((h) => `${h} ${jobs.filter((j) => j.host === h).length}`).join(', ')}; ${o.ids.length} prompts x 2 arms x ${o.repeats} repeats per host, plus one warm-up per arm. Nothing runs without --run.`);
  lines.push(`Estimate (assumptions, not measurements): Claude ${claudeRuns * 2} to ${claudeRuns * o.maxTurns} requests, each carrying roughly 15k to 40k input tokens that are mostly cache reads; Codex one thread total per run; up to ${Math.round(jobs.length * o.timeoutS / 60)} minutes at the timeout, typically a third of that. Subscription quota, not cash. Jev: about ${loadoutRuns} routing calls (under $0.05, RESULTS sweeps run near $0.001 each) plus any find_tools. Judging: ${o.hosts.length * o.ids.length * o.repeats * 2} calls, sequential (Claude Opus on Codex outputs, Sol on Claude outputs).`);
  for (const s of specs) lines.push(`PROMPT ${s.id} (${s.kind}): ${promptText(s).length} characters with the note${s.fixture ? `; fixture ${s.fixture}, hidden test ${s.hidden}` : ''}`);
  for (const host of o.hosts) lines.push(`SCHEDULE ${host} (arm/prompt/repeat; warm-ups are repeat 0): ${jobs.filter((j) => j.host === host).map((j) => `${j.arm}/${j.prompt}/${j.repeat}`).join('  ')}`);
  const ctx: Ctx = { work: join(root, 'work'), shimDir: join(root, 'shim', '<host>'), configDir: '<fresh CLAUDE_CONFIG_DIR per run>', env, models: o.models, maxTurns: o.maxTurns, codexHook: o.codexHook };
  for (const host of o.hosts) for (const arm of ARMS) {
    const c = buildCommand({ host, arm, prompt: o.ids[0]!, repeat: 1, warmup: false, seq: 0 }, '<prompt>', ctx);
    lines.push(`ARGV ${host}/${arm}: cwd=${JSON.stringify(c.cwd)} argv=${JSON.stringify([c.bin, ...c.args])}`);
    lines.push(`ENV ${host}/${arm} (names only): ${Object.keys(c.env ?? {}).join(', ')}${host === 'claude' ? ', CLAUDE_CODE_OAUTH_TOKEN (injected at launch)' : ''}`);
  }
  lines.push(`ENV allowlist: claude: ${envAllowlist('claude').join(', ')}; codex: ${envAllowlist('codex').join(', ')}; loadout arm also: ${LOADOUT_ENV.join(', ')} when set.`);
  for (const write of hostWrites(env)) lines.push(`HOST STATE: ${write}`);
  lines.push(`HOST STATE: the loadout arm's hook and MCP server write under the loadout home (${redacted(paths.sessions())}/hook state, the library scan cache), as in a user's install. Every run's folder, the shim directory and Claude's fresh homes are under one temporary work root, removed at the end.`);
  for (const p of [CODEX_CLOUD_PRECONDITION, CLAUDE_MANAGED_PRECONDITION, CLAUDE_SCRUB_PRECONDITION, CLAUDE_SWITCH_PRECONDITION]) lines.push(`PRECONDITION: ${p}`);
  lines.push('DIFFERS from B7: Claude keeps its built-in tools (no --restricted) and its hooks (no disableAllHooks), because the agents edit files, run `node --test` and the loadout plugin is a hook; Codex keeps its shell and, in the loadout arm, the hooks feature. The Codex MCP server is `required = true`, as `loadout setup codex` writes it, so a failed start stops the run; the plugin install leaves it out on purpose (comment above `required = true` in src/launch.ts). Unlike B7, which records a global AGENTS.md in CODEX_HOME as identical across arms, this study refuses one: it is in the prompt of every run and steers the agent and its find_tools queries, which a token-delta baseline never notices. Both arms of a host share every other flag.');
  lines.push('UNVERIFIED offline (the pilot checks): --max-turns is not in `claude --help` 2.1.281 (B7 and C8 use it); whether the allowlist rule `Bash(node --test *)` matches the agent\'s test command (a denied command shows as a tool error on the row); whether `loadout mcp` and the plugin\'s hook see the TypeSafe key under Claude\'s MCP environment allowlist and subprocess scrub (the study requires a key file in the loadout config; whether HOME and a non-default LOADOUT_HOME reach them is untested, and a loadout run routed by keyword stops the batch); that `-c hooks.UserPromptSubmit` plus --dangerously-bypass-hook-trust registers the hook in `codex exec` 0.160.1 (discovery.rs reads `hooks` from every config layer, the session-flags layer included; the shim count proves it, and a run without the hook stops the batch); that Codex\'s stream carries no per-request usage (codex-rs exec_events.rs at rust-v0.160.1: it does not).');
  return lines;
}

// --- Run ---------------------------------------------------------------------------------------

function version(host: Host): string {
  const c = cli(host);
  const text = execFileSync(c.bin, [...c.prefix, '--version'], { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  return /\d+\.\d+\.\d+\S*/.exec(text)?.[0] ?? text;
}


interface Study { out: string; previous: RunRow[]; token?: string; secrets: string[]; versions: Record<string, string> }

async function execute1(job: Job, prompt: string, spec: PromptSpec | undefined, ctx: Ctx, o: Options, study: Study): Promise<RunRow> {
  const { out, previous, token, secrets, versions } = study;
  resetWork(ctx.work);
  if (spec?.fixture) cpSync(join(FIXTURES, spec.fixture), ctx.work, { recursive: true });
  const id = jobId(job);
  const marker = join(ctx.shimDir, `${id.replace(/\//g, '_')}.invocations`);
  const capture = `${marker}.out`;
  writeFileSync(marker, '');
  writeFileSync(capture, '');
  writeFileSync(`${capture}.err`, '');
  writeFileSync(join(ctx.shimDir, 'loadout'), hookShim(marker, hookCommand(job.host, false), capture), { mode: 0o700 });
  const command = buildCommand(job, prompt, ctx);
  if (job.host === 'claude') command.env = { ...command.env, CLAUDE_CODE_OAUTH_TOKEN: token };
  const startedAt = Date.now();
  const proc = await run(command.bin, command.args, ctx.work, o.timeoutS * 1000, command.env);
  const endedAt = Date.now();

  const folders: [string, string][] = [[ctx.work, '<work>'], [homedir(), '~'], [tmpdir(), '<tmp>']];
  const dest = join(out, 'outputs', job.host, job.prompt, `${job.arm}-${job.repeat}`);
  const capturedRaw = readFileSync(capture, 'utf8');
  const hookStderr = readFileSync(`${capture}.err`, 'utf8');
  const streamLeak = holdsSecret([proc.stdout, proc.stderr, capturedRaw, hookStderr].join('\n'), secrets);
  const leak: Leak | null = streamLeak ? { file: '<stream>', rule: 'held secret' }
    : job.warmup ? heldSecretLeak(ctx.work, secrets) : copyOutputs(ctx.work, dest, folders, secrets);
  const stream = toolEvents(proc.stdout);
  let usage: RunUsage | null = null;
  try { usage = (job.host === 'claude' ? claudeUsage : codexUsage)(proc.stdout); } catch { /* checkRun says why */ }
  const marks = readFileSync(marker, 'utf8').split('\n');
  const hook = { invocations: marks.filter((l) => l === 'invoked').length, ...hookFacts(capturedRaw) };
  const failedBeforeModel = job.host === 'claude' ? stream.failedBeforeModel : usage === null && !proc.timedOut;
  const broken = checkRun(job, { usage, hooks: stream.hooks, inventory: stream.inventory, failedBeforeModel, hookInvocations: hook.invocations, hookExits: marks.filter((l) => l.startsWith('exit ')).map((l) => Number(l.slice(5))), keywordRouted: routedByKeyword(capturedRaw, hookStderr, stream.events),
    uncountedContext: stream.hooks.filter((h) => h.context).length - marks.filter((l) => l === 'context').length, pluginDir: join(REPO, 'plugins', 'loadout'), codexHook: o.codexHook, requestedModel: o.models[job.host] });

  // Request gaps: since this host and arm last made a request (completion to completion inside a run, which counts the request's
  // own time; the run's start for request 1). Over five minutes the provider's default cache entry may have expired.
  const before = previous.filter((r) => r.host === job.host && r.arm === job.arm && !r.invalid);
  const lastDone = before.length ? Math.max(...before.map((r) => Date.parse(r.requests.at(-1)?.at ?? r.endedAt))) : null;
  let prevAt = lastDone;
  const requests = (usage?.requests ?? []).map((r, i) => {
    const at = r.at ? Date.parse(r.at) : null;
    const gapMs = prevAt === null ? null : (i === 0 ? startedAt : at ?? endedAt) - prevAt;
    prevAt = at ?? endedAt;
    return { ...r, gapMs };
  });
  const total = sumUsage(requests);
  const invalid = leak ? CREDENTIAL_IN_OUTPUT : broken;
  const hiddenTest = spec?.hidden && !job.warmup && !leak ? hiddenResult(ctx.work, join(FIXTURES, spec.hidden)) : null;
  // Skill text can contain placeholder tokens: withhold such streams without losing a valid measurement.
  const streamWithheld = !leak && TOKEN_ANYWHERE.test(proc.stdout);
  if (!leak && !streamWithheld) {
    mkdirSync(join(out, 'streams'), { recursive: true });
    writeFileSync(join(out, 'streams', `${id.replace(/\//g, '_')}.jsonl`), proc.stdout);
  }
  const tools = stream.events.map((e) => (e.ok ? e.tool : `${e.tool} (failed)`));

  return {
    id, host: job.host, arm: job.arm, prompt: job.prompt, repeat: job.repeat, warmup: job.warmup, seq: job.seq,
    startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString(), ms: endedAt - startedAt,
    hostVersion: usage?.version ?? versions[job.host] ?? null, requestedModel: o.models[job.host], model: usage?.model ?? null, exit: proc.code, timedOut: proc.timedOut, stop: stream.result?.subtype ?? null,
    granularity: usage?.granularity ?? 'request', requests,
    totals: { ...total, effectiveInput: job.host === 'claude' && requests.length ? requests.reduce((n, r) => n + effectiveInput(r), 0) : null, costUsd: usage?.costUsd ?? null, turns: usage?.turns ?? null },
    unreconciled: usage?.unreconciled ?? [], modelUsage: usage?.modelUsage ?? null,
    coldCacheRisk: requests.some((r) => (r.gapMs ?? 0) > CACHE_TTL_MS),
    toolCalls: tools.length, toolErrors: tools.filter((t) => t.endsWith('(failed)')).length, loadoutTools: [...new Set(tools.filter((t) => t.startsWith(`mcp__${SEARCH_SERVER}__`)))],
    skillsOpened: openedSkills(stream.events), hook, hiddenTest, ...(leak ? { leak } : {}), ...(streamWithheld ? { streamWithheld: 'token shape' as const } : {}),
    // A Codex run that timed out reports no usage: it cannot count, but it is not a broken arm.
    ...(invalid ? { invalid } : !usage ? { invalid: proc.timedOut ? UNUSABLE[0] : UNUSABLE[1] } : {}),
  };
}

/** Why a run cannot count although its arm is intact: the batch goes on. Any other `invalid` stops it. */
const UNUSABLE = ['timed out before the host reported usage', 'no usage in the stream'];

function completed(file: string): RunRow[] {
  return existsSync(file) ? readJsonl<RunRow>(file) : [];
}

/** What is under test, beyond the options: loadout's own code (hook, router, MCP server) and the library it routes over. */
export interface Provenance { commit: string; library: string }

/** Tracked changes count as a different commit; untracked files (this study's own results) do not. */
export function provenance(): Provenance {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const head = git('rev-parse', 'HEAD');
  const diff = git('diff', '--no-ext-diff', '--no-textconv', 'HEAD');
  // Each capability's key, name and description, and a skill's SKILL.md text (read through readConfined), hashed and never
  // shown: editing a skill without renaming it still changes what the hook injects.
  const library = scanLibrary(paths.library()).map((c) => [capabilityKey(c), c.name, c.description, c.kind === 'skill' ? readManifest(c.source) ?? '' : ''].join('\0')).sort();
  return { commit: diff ? `${head}+dirty-${createHash('sha256').update(diff).digest('hex').slice(0, 12)}` : head, library: `${library.length} capabilities, ${createHash('sha256').update(library.join('\n')).digest('hex').slice(0, 12)}` };
}

const studySettings = (s: Options & Partial<Provenance>) => ({ hosts: s.hosts, ids: s.ids, repeats: s.repeats, models: s.models, maxTurns: s.maxTurns, timeoutS: s.timeoutS, codexHook: s.codexHook, commit: s.commit, library: s.library });

/** An --out folder is one study: resuming it with other settings (another model, other code or library) would pair rows measured under different ones. */
export function refuseOtherSettings(out: string, o: Options, p: Provenance, secrets: string[]): void {
  const file = join(out, 'config.json');
  if (!existsSync(file)) return;
  const [was, now] = [studySettings(JSON.parse(readFileSync(file, 'utf8')) as Options & Provenance), studySettings({ ...o, ...p })];
  const differs = (Object.keys(now) as (keyof typeof now)[]).filter((k) => JSON.stringify(was[k]) !== persistJson(now[k], secrets));
  if (differs.length) throw new Error(`${redacted(out)} was started with other settings (${differs.join(', ')}): resume it with the same options, or start a new --out`);
}

/** A persisted row that stopped the batch ends the study: its rows are not a result, and resuming would skip the row and go on. */
export function refuseStopped(out: string): void {
  const bad = completed(join(out, 'rows.jsonl')).find((r) => r.invalid && !UNUSABLE.includes(r.invalid));
  if (bad) throw new Error(`${bad.id} stopped this study (${bad.invalid}): delete ${redacted(out)} and start a new one`);
}

async function runAll(o: Options, out: string, deps: { token?: string; print: (s: string) => void; env: NodeJS.ProcessEnv; provenance: Provenance; secrets: string[] }): Promise<void> {
  // Derived from --out, not random: a resumed study then works in the same folder, and the folder is in the prefix the cache keys on.
  // The base is resolved once: tmpdir() can itself be a link (macOS without TMPDIR is /tmp -> /private/tmp), and assertTemporary
  // refuses a link as the nearest existing ancestor of a root that does not exist yet. Links below the base are still refused.
  const root = join(realpathSync(tmpdir()), `loadout-ab-${createHash('sha256').update(out).digest('hex').slice(0, 12)}`);
  assertTemporary(root);
  rmSync(root, { recursive: true, force: true });
  // Not recursive, and private: the name is predictable in a shared tmpdir, so anything that appears there between the
  // remove and this call (a link included) fails with EEXIST instead of being used, and other users cannot read the hook's text.
  mkdirSync(root, { mode: 0o700 });
  try {
    const rowsFile = join(out, 'rows.jsonl');
    const specs = o.ids.map((id) => PILOT.find((p) => p.id === id) as PromptSpec);
    const versions = Object.fromEntries(o.hosts.map((h) => [h, version(h)]));
    const secrets = deps.secrets;
    const configFile = join(out, 'config.json');
    if (!existsSync(configFile)) writeFileSync(configFile, persistJson({ ...studySettings({ ...o, ...deps.provenance }), versions, schedule: schedule(o.hosts, o.ids, o.repeats).map(jobId) }, secrets) + '\n');
    if (o.hosts.includes('codex')) await codexPreflight(o, root);
    const shims = Object.fromEntries(o.hosts.map((h) => [h, join(root, 'shim', h)]));
    for (const dir of Object.values(shims)) mkdirSync(dir, { recursive: true });
    for (const job of schedule(o.hosts, o.ids, o.repeats)) {
      const previous = completed(rowsFile);
      if (previous.some((r) => r.id === jobId(job))) continue;
      const spec = specs.find((s) => s.id === job.prompt);
      mkdirSync(join(root, 'claude-homes'), { recursive: true });
      const configDir = job.host === 'claude' ? mkdtempSync(join(root, 'claude-homes', 'run-')) : '';
      const ctx: Ctx = { work: join(root, 'work'), shimDir: shims[job.host]!, configDir, env: deps.env, models: o.models, maxTurns: o.maxTurns, codexHook: o.codexHook };
      const row = await execute1(job, spec ? promptText(spec) : WARMUP_PROMPT, spec, ctx, o, { out, previous, token: deps.token, secrets, versions });
      if (configDir) rmSync(configDir, { recursive: true, force: true });
      if (previous.some((r) => r.host === row.host && r.hostVersion && row.hostVersion && r.hostVersion !== row.hostVersion)) row.invalid ??= `${row.host} version changed during the study; measurement invalid`;
      appendFileSync(rowsFile, persistJson(row, secrets) + '\n');
      deps.print(`${row.id}: ${row.invalid ?? (row.timedOut ? 'timed out' : row.exit === 0 ? 'ok' : `exit ${row.exit}`)}; ${row.requests.length} request(s), ${row.totals.cacheRead} cache-read tokens, ${(row.ms / 1000).toFixed(0)} s${row.coldCacheRisk ? ' (coldCacheRisk)' : ''}`);
      if (row.invalid && !UNUSABLE.includes(row.invalid)) throw new Error(`${row.id}: ${row.invalid}${row.leak ? ` (${row.leak.file}, ${row.leak.rule})` : ''}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** Free: the features Codex reports for each arm's flags, on an empty home so nothing of the user's is read or written. */
async function codexPreflight(o: Options, root: string): Promise<void> {
  const c = cli('codex');
  for (const arm of ARMS) {
    const home = join(root, 'codex-home', arm);
    mkdirSync(home, { recursive: true });
    const off = featuresOff(arm, o.codexHook);
    const text = await execute({ bin: c.bin, args: [...c.prefix, 'features', 'list', ...off.flatMap((f) => ['--disable', f])], cwd: root, env: { ...childEnv(process.env, 'codex'), CODEX_HOME: home } });
    validateFeatures(text, off);
  }
}

// --- Judge --------------------------------------------------------------------------------------

async function judgeAll(out: string, print: (s: string) => void, secrets: string[]): Promise<Verdict[]> {
  const rows = completed(join(out, 'rows.jsonl')).filter((r) => !r.warmup && !r.invalid);
  const file = join(out, 'verdicts.jsonl');
  const done = completed(file) as unknown as Verdict[];
  const requests = readJsonl<{ id: string; request: string }>(join(DATA, 'requests-c1.jsonl'));
  for (const host of [...new Set(rows.map((r) => r.host))]) for (const prompt of [...new Set(rows.map((r) => r.prompt))]) for (const repeat of [...new Set(rows.map((r) => r.repeat))]) {
    const [bare, loadout] = ARMS.map((arm) => rows.find((r) => r.host === host && r.prompt === prompt && r.repeat === repeat && r.arm === arm));
    if (!bare || !loadout || done.some((v) => v.host === host && v.prompt === prompt && v.repeat === repeat)) continue;
    const names = [...bare.hook.listed, ...bare.hook.injected, ...loadout.hook.listed, ...loadout.hook.injected, ...bare.skillsOpened, ...loadout.skillsOpened];
    if (names.some((name) => name.includes('<credential>'))) throw new Error('skill names were redacted: blind judging is not possible');
    const dir = (r: RunRow) => join(out, 'outputs', r.host, r.prompt, `${r.arm}-${r.repeat}`);
    const bareFiles = redactNames(deliverables(dir(bare)), names);
    const loadoutFiles = redactNames(deliverables(dir(loadout)), names);
    const judge = JUDGES[host];
    const verdict = await judgePair(requests.find((r) => r.id === prompt)!.request, { bare: bareFiles.text, loadout: loadoutFiles.text }, async (p) => {
      const res = await modelJson(p, PrefSchema, { backend: judge.backend, model: judge.model, system: JUDGE_SYSTEM, out });
      if (!res) throw new Error('the judge backend returned no answer');
      return res.output;
    });
    const v: Verdict = { host, prompt, repeat, winner: verdict.winner, judge, redactions: { bare: bareFiles.count, loadout: loadoutFiles.count } };
    appendFileSync(file, persistJson({ ...v, orders: verdict.orders }, secrets) + '\n');
    print(`${host}/${prompt}/${repeat}: ${v.winner} (${verdict.orders.map((x) => x.winner).join(' / ')}); ${judge.backend} ${judge.model}`);
  }
  return completed(file) as unknown as Verdict[];
}

// --- CLI ----------------------------------------------------------------------------------------

export async function main(args: string[], deps: { print?: (s: string) => void; env?: NodeJS.ProcessEnv } = {}): Promise<void> {
  const env = deps.env ?? process.env;
  const secrets = [env.CLAUDE_CODE_OAUTH_TOKEN].filter((s): s is string => !!s);
  try {
    let config;
    try { config = loadConfig(); } catch { /* blockers reports an invalid config; judge-only still works from saved rows */ }
    const key = resolveApiKey(config ?? DEFAULT_CONFIG);
    if (key) secrets.push(key);
    await mainImpl(args, (s) => (deps.print ?? console.log)(redact(s, secrets)), env, secrets);
  } catch (error) {
    throw new Error(redact(error instanceof Error ? error.message : 'ab failed', secrets));
  }
}

async function mainImpl(args: string[], print: (s: string) => void, env: NodeJS.ProcessEnv, secrets: string[]): Promise<void> {
  const { values } = parseArgs({ args, options: { plan: { type: 'boolean' }, run: { type: 'boolean' }, 'judge-only': { type: 'string' }, hosts: { type: 'string' }, ids: { type: 'string' }, repeats: { type: 'string' }, out: { type: 'string' },
    'claude-model': { type: 'string' }, 'codex-model': { type: 'string' }, 'max-turns': { type: 'string' }, 'timeout-s': { type: 'string' }, 'no-codex-hook': { type: 'boolean' } } });
  const list = <T extends string>(text: string | undefined, allowed: readonly T[], fallback: T[]) => text?.split(',').map((x) => { if (!allowed.includes(x as T)) throw new Error(`unknown value ${x}`); return x as T; }) ?? fallback;
  const positive = (text: string | undefined, fallback: number, name: string) => { const n = text === undefined ? fallback : Number(text); if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer`); return n; };
  const o: Options = {
    hosts: list(values.hosts, ['claude', 'codex'], ['claude', 'codex']), ids: list(values.ids, PILOT.map((p) => p.id), PILOT.map((p) => p.id)), repeats: positive(values.repeats, 2, 'repeats'),
    models: { claude: values['claude-model'] ?? AB_MODELS.claude, codex: values['codex-model'] ?? AB_MODELS.codex }, maxTurns: positive(values['max-turns'], 30, 'max-turns'), timeoutS: positive(values['timeout-s'], 600, 'timeout-s'), codexHook: !values['no-codex-hook'],
  };
  if (values['judge-only'] !== undefined) {
    const dir = resolve(values['judge-only']);
    refuseStopped(dir);
    const verdicts = await judgeAll(dir, print, secrets);
    const rows = completed(join(dir, 'rows.jsonl'));
    writeFileSync(join(dir, 'report.md'), report(rows, verdicts, secrets));
    // Judging an unfinished study leaves it marked: the marker goes only once every scheduled run has a row.
    const scheduled: string[] = existsSync(join(dir, 'config.json')) ? JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).schedule : [];
    if (scheduled.length && scheduled.every((id) => rows.some((r) => r.id === id))) rmSync(join(dir, 'INCOMPLETE'), { force: true });
    return;
  }
  const found = [...blockers(o, env), ...judgeProblems(o)];
  if (!values.run) {
    for (const line of planLines(o, env)) print(line);
    for (const b of found) print(`BLOCKED: ${b}`);
    return;
  }
  if (found.length) throw new Error(`blocked: ${found.join('; ')}`);
  if (process.platform === 'win32') throw new Error('--run needs a Linux or macOS shell: the hook shim is a POSIX script (run from WSL with the Linux CLIs)');
  const out = resolve(values.out ?? join(RESULTS, `${new Date().toISOString().replace(/[:.]/g, '-')}-ab-pilot`));
  const p = provenance();
  refuseOtherSettings(out, o, p, secrets);
  refuseStopped(out);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'INCOMPLETE'), 'This run did not finish: resume it with --out, or delete the folder. Its rows are not a result.\n');
  await runAll(o, out, { token: env.CLAUDE_CODE_OAUTH_TOKEN, print, env, provenance: p, secrets });
  const verdicts = await judgeAll(out, print, secrets);
  writeFileSync(join(out, 'report.md'), report(completed(join(out, 'rows.jsonl')), verdicts, secrets));
  rmSync(join(out, 'INCOMPLETE'));
  print(`Raw rows and report: ${redacted(out)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'ab failed'); process.exitCode = 1; });
}
