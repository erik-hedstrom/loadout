/** Cache-aware OpenCode study. See bench/README.md for the offline plan and explicit execution commands. */
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { DEFAULT_CONFIG, jevBaseUrl, loadConfig, resolveApiKey, type Config } from '../src/config.js';
import { jevClient, type SystemOneClient } from '../src/jev.js';
import { readConfined, skillExcerpt } from '../src/library.js';
import { createServer } from '../src/mcp.js';
import { route } from '../src/route.js';
import type { Capability } from '../src/types.js';
import { isEntry, splitOf } from './lib.js';
import { ARMS, CORE_ARMS, DEFAULT_MODELS, OPENCODE_VERSION, parseEvents, parseRow, taskSchema, type B11Row, type B11Task } from './b11-types.js';
import { HarnessError, failureMessage } from './b11-errors.js';
import { copyTree, executeSandbox, OPENCODE_CONFIG, removeSession, requireNetwork, sandboxCheck, type Sandbox } from './b11-sandbox.js';
import { canariesSchema, endpoint, fixtureServer, fixtureTools, type Canary } from './b11-mcp.js';
import { MAX_SERVERS, serverSpecs } from './mcp-fixtures.js';
import { listingFor, validateNeeds } from './b11-listing.js';
import { prepareB11Library } from './b11-library.js';
import { fixturePath, runCheck } from './b11-check.js';
export { fixturePath, runCheck } from './b11-check.js';
const PROTOCOL_VERSION = 2;

export function options(args: string[]) {
  const { values: v } = parseArgs({ args, options: {
    plan: { type: 'boolean' }, run: { type: 'boolean' }, resume: { type: 'boolean' },
    tasks: { type: 'string', default: 'bench/data/b11/tasks.jsonl' },
    opencode: { type: 'string' }, library: { type: 'string' },
    arms: { type: 'string', default: CORE_ARMS.filter(arm => arm !== 'skills-all' && arm !== 'all').join(',') }, models: { type: 'string', default: DEFAULT_MODELS.join(',') },
    reps: { type: 'string', default: '1' }, 'batch-size': { type: 'string', default: '9' }, concurrency: { type: 'string', default: '2' },
    'per-kind': { type: 'string' }, timeout: { type: 'string', default: '300' },
    'sweep-per-kind': { type: 'string', default: '3' },
    'heavy-skills': { type: 'string' }, 'heavy-servers': { type: 'string' },
    'jev-budget': { type: 'string', default: '0.10' }, out: { type: 'string' },
  } });
  const count = (s: string, max: number) => { const n = Number(s); if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new HarnessError('count out of range'); return n; };
  const arms = v.arms!.split(',') as B11Row['arm'][];
  const models = v.models!.split(',');
  if (arms.some(a => !ARMS.includes(a)) || new Set(arms).size !== arms.length) throw new HarnessError('unknown or repeated arm');
  if (models.some(m => !(DEFAULT_MODELS as readonly string[]).includes(m)) || new Set(models).size !== models.length) throw new HarnessError('only declared free models are allowed');
  const hasHeavy = arms.includes('heavy-max');
  if (hasHeavy !== (v['heavy-skills'] !== undefined && v['heavy-servers'] !== undefined) || (!hasHeavy && (v['heavy-skills'] !== undefined || v['heavy-servers'] !== undefined))) throw new HarnessError('heavy-max requires both explicit size limits');
  const heavy = hasHeavy ? { skills: count(v['heavy-skills']!, 10000), servers: count(v['heavy-servers']!, MAX_SERVERS) } : undefined;
  if (v.plan && v.run) throw new HarnessError('choose plan or run');
  const budget = Number(v['jev-budget']);
  if (!Number.isFinite(budget) || budget < 0) throw new HarnessError('invalid Jev budget');
  if (v.run && !v.library) throw new HarnessError('runs require --library with an explicit public corpus');
  return { run: v.run ?? false, resume: v.resume ?? false, tasks: resolve(v.tasks!), binary: v.opencode ? realpathSync(v.opencode) : undefined,
    library: v.library ? resolve(v.library) : undefined, arms, models, heavy, reps: count(v.reps!, 100), batchSize: count(v['batch-size']!, 10000),
    concurrency: count(v.concurrency!, 16), perKind: v['per-kind'] ? count(v['per-kind'], 10000) : undefined,
    sweepPerKind: count(v['sweep-per-kind']!, 10000),
    timeoutMs: count(v.timeout!, 3600) * 1000, budget, out: v.out ? resolve(v.out) : undefined };
}

export function blocks<T>(tasks: T[], models: string[], arms: string[], reps: number, batchSize: number) {
  const result: { model: string; arm: string; rep: number; tasks: T[] }[] = [];
  for (let rep = 1; rep <= reps; rep++) for (let start = 0; start < tasks.length; start += batchSize) {
    const rotate = (Math.floor(start / batchSize) + rep - 1) % arms.length;
    const order = [...arms.slice(rotate), ...arms.slice(0, rotate)];
    for (const model of models) for (const arm of order) result.push({ model, arm, rep, tasks: tasks.slice(start, start + batchSize) });
  }
  return result;
}
export const rowKey = (r: Pick<B11Row, 'taskId' | 'model' | 'arm' | 'rep' | 'heavyConfig'>) => JSON.stringify([r.taskId, r.model, r.arm, r.rep, ...(r.arm === 'heavy-max' ? [r.heavyConfig] : [])]);

/** Pin routing policy; only the established credential/endpoint settings come from the user. */
export function studyConfig(user: Config): Config {
  return { ...DEFAULT_CONFIG, router: 'jev', embeddings: false, skillFolders: false,
    jev: { ...DEFAULT_CONFIG.jev, baseUrl: user.jev.baseUrl, apiKeyFile: user.jev.apiKeyFile } };
}

export function sweepTasks<T extends { kind: string; id: string }>(tasks: T[], perKind: number): Set<string> {
  const counts = new Map<string, number>();
  return new Set(tasks.filter(task => { const n = counts.get(task.kind) ?? 0; counts.set(task.kind, n + 1); return n < perKind; }).map(task => task.id));
}

/** Reserve a conservative byte-based ceiling before each request; failed requests retain their reservation. */
export class JevBudget {
  spent = 0;
  constructor(readonly limit: number, readonly config: Config, readonly client: SystemOneClient) {}
  meter() {
    const pending = new Set<Promise<unknown>>();
    const meter = { usage: { calls: 0, costUsd: 0 }, failed: false, exhausted: false, client: undefined as unknown as SystemOneClient,
      settle: async () => { await Promise.allSettled([...pending]); } };
    meter.client = { ask: (state, questions, signal) => {
      const call = (async () => {
      const reservation = (Buffer.byteLength(JSON.stringify({ state, questions }), 'utf8') + 8192) / 1e6 * this.config.jev.inputPricePerMTok;
      if (this.spent + reservation > this.limit) { meter.failed = true; meter.exhausted = true; throw new HarnessError('Jev budget exhausted'); }
      this.spent += reservation; meter.usage.calls++;
      try {
        const response = await this.client.ask(state, questions, signal);
        const cost = response.usage.input_tokens / 1e6 * this.config.jev.inputPricePerMTok;
        this.spent += cost - reservation; meter.usage.costUsd += cost;
        return response;
      } catch (e) { meter.failed = true; meter.usage.costUsd += reservation; throw e; }
      })();
      pending.add(call);
      void call.then(() => pending.delete(call), () => pending.delete(call));
      return call;
    } };
    return meter;
  }
}

export function classifyRun(run: { stdout: string; stderr: string; code: number | null; timedOut: boolean; usageLimited?: boolean }, routingFailed = false) {
  let events: ReturnType<typeof parseEvents> = { steps: [], totals: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }, toolCalls: [], skillsLoaded: [] };
  let invalidReason: B11Row['invalidReason'];
  const complete = (run.timedOut || run.usageLimited) && !run.stdout.endsWith('\n') ? run.stdout.slice(0, run.stdout.lastIndexOf('\n') + 1) : run.stdout;
  try { events = parseEvents(complete, run.usageLimited ? 'usage-limit' : run.timedOut ? 'timeout' : undefined); invalidReason = events.invalidReason; }
  catch { invalidReason = 'malformed-events'; }
  if (routingFailed || (run.code !== 0 && !run.timedOut && invalidReason === undefined)) invalidReason = 'provider-error';
  if (/^bwrap:/m.test(run.stderr)) invalidReason = 'sandbox-failure';
  if (/\b(?:HTTP(?:\s+status)?|status(?:Code)?)\s*[:=]?\s*429\b|rate[ -]?limit(?:ed| exceeded)|too many requests/i.test(run.stderr) || events.invalidReason === 'rate-limit') invalidReason = 'rate-limit';
  if (run.usageLimited || events.invalidReason === 'usage-limit') invalidReason = 'usage-limit';
  return { events, invalidReason };
}

class RoutingUnavailable extends Error {}

function tasksAt(file: string, perKind?: number): { tasks: B11Task[]; root: string; canaries: Canary[] } {
  const root = resolve(file, '..');
  const all = readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => taskSchema.parse(JSON.parse(line)));
  if (new Set(all.map(t => t.id)).size !== all.length || !all.length) throw new HarnessError('empty or duplicate tasks');
  const subset = perKind ? sweepTasks(all, perKind) : undefined;
  const tasks = subset ? all.filter(t => subset.has(t.id)) : all;
  for (const t of tasks) {
    fixturePath(root, 'workspaces', t.workspace);
    if (t.check.type === 'node-test') fixturePath(root, 'checks', t.check.tests);
  }
  const canaryFile = join(root, 'mcp-canaries.json');
  const canaries = existsSync(canaryFile) ? canariesSchema.parse(JSON.parse(readFileSync(canaryFile, 'utf8'))) : [];
  return { tasks, root, canaries };
}

export async function main(args: string[]) {
  const o = options(args);
  if (process.platform !== 'linux') throw new HarnessError('B11 requires Linux bubblewrap; use an LF WSL checkout');
  if (!o.binary) throw new HarnessError('pass --opencode with the pinned binary path');
  const data = tasksAt(o.tasks, o.perKind);
  const subset = sweepTasks(data.tasks, o.sweepPerKind);
  const sweepCanaries = data.canaries.filter(c => data.tasks.some(task => subset.has(task.id) && task.needs.server === c.server));
  const plan = blocks(data.tasks, o.models, o.arms, o.reps, o.batchSize).map(block => ({ ...block,
    tasks: (CORE_ARMS as readonly string[]).includes(block.arm) || block.arm === 'heavy-max' ? block.tasks : block.tasks.filter(task => subset.has(task.id)),
  }));
  const runs = plan.reduce((n, b) => n + b.tasks.length, 0);
  const root = mkdtempSync(join(tmpdir(), 'b11-study-'));
  const endpoints: Awaited<ReturnType<typeof endpoint>>[] = [];
  try {
    const skillsDir = join(root, 'library-skills'); mkdirSync(skillsDir);
    const prepared = o.library ? prepareB11Library(o.library, join(data.root, 'skills'), skillsDir) : undefined;
    if (prepared) validateNeeds(data.tasks, prepared.skills, data.canaries);
    console.log(JSON.stringify({ mode: o.run ? 'run' : 'plan', opencodeVersion: OPENCODE_VERSION, arms: o.arms, tasks: data.tasks.length,
      taskCounts: Object.fromEntries(['plain', 'skill-needle', 'mcp-needle'].map(k => [k, data.tasks.filter(t => t.kind === k).length])),
      runs, ...(o.heavy ? { heavyMax: o.heavy } : {}), expectedJevCalls: { preselect: data.tasks.length * o.models.length * o.reps * (o.arms.includes('preselect') ? 2 : 0), gatewayAtOneSearchPerStep: data.tasks.length * o.models.length * o.reps * (o.arms.includes('gateway') ? 40 : 0) },
      jevBudgetUsd: o.run ? o.budget : 0, requestedRunBudgetUsd: o.budget, expectedJevCostUsd: { plan: 0, runRange: [0, o.budget] }, modelCostUsd: 0, concurrency: o.concurrency, timeoutSeconds: o.timeoutMs / 1000,
      sessionDeadlineScheduleSeconds: plan.reduce((seconds, block) => seconds + Math.ceil(block.tasks.length / o.concurrency) * o.timeoutMs / 1000, 0),
      library: prepared?.provenance ?? null,
      documentation: 'bench/README.md#b11-opencode-sessions',
    }, null, 2));
    await sandboxCheck(o.binary);
    console.log('Sandbox preflight passed.');
    if (!o.run) return;
    requireNetwork();
    const versionHome = join(root, 'version-home'), versionWork = join(root, 'version-work'); mkdirSync(versionHome); mkdirSync(versionWork);
    const version = await executeSandbox({ home: versionHome, workspace: versionWork, binary: o.binary }, ['/opt/opencode', '--version'], 15000, false);
    if (version.code !== 0 || version.stdout.trim() !== OPENCODE_VERSION) throw new HarnessError('OpenCode version does not match pin');
    const out = o.out ?? join('bench/results', `${new Date().toISOString().replace(/[:.]/g, '-')}-b11`);
    mkdirSync(out, { recursive: true });
    const rowsFile = join(out, 'rows.jsonl');
    const previous: B11Row[] = existsSync(rowsFile) ? readFileSync(rowsFile, 'utf8').trim().split('\n').filter(Boolean).map(l => parseRow(JSON.parse(l))) : [];
    if (previous.length && !o.resume) throw new HarnessError('results exist; pass --resume');
    if (previous.some(r => r.opencodeVersion !== OPENCODE_VERSION)) throw new HarnessError('resume OpenCode version mismatch');
    if (o.heavy && previous.some(r => r.arm === 'heavy-max' && (r.heavyConfig?.skills !== o.heavy!.skills || r.heavyConfig?.servers !== o.heavy!.servers))) throw new HarnessError('resume heavy-max size mismatch');
    const done = new Set(previous.filter(r => r.result !== 'invalid').map(rowKey));
    const config = studyConfig(loadConfig());
    const needsJev = o.arms.some(a => a === 'gateway' || a === 'preselect');
    const key = needsJev ? resolveApiKey(config) : undefined;
    if (needsJev && !key) throw new HarnessError('Jev arms require a key resolved by loadout');
    const budget = new JevBudget(o.budget, config, key ? jevClient({ apiKey: key, baseUrl: jevBaseUrl(config), model: config.jev.model, retries: 0 }) : { ask: async () => { throw new HarnessError('Jev disabled'); } });
    budget.spent = previous.reduce((n, r) => n + r.jev.costUsd, 0);
    const { skills, plantedNames } = prepared!;
    const protocolFile = join(out, 'protocol.json');
    if (previous.length) {
      const prior = existsSync(protocolFile) ? JSON.parse(readFileSync(protocolFile, 'utf8')) : undefined;
      if (prior?.harnessVersion !== PROTOCOL_VERSION || !isDeepStrictEqual(prior.library, prepared!.provenance)) throw new HarnessError('resume requires matching library provenance and harness version; use a fresh output directory for legacy rows');
    }
    writeFileSync(protocolFile, JSON.stringify({ harnessVersion: PROTOCOL_VERSION, opencodeVersion: OPENCODE_VERSION,
      arms: o.arms, models: o.models, reps: o.reps, batchSize: o.batchSize, sweepPerKind: o.sweepPerKind, ...(o.heavy ? { heavyMax: o.heavy } : {}),
      library: prepared!.provenance, taskCounts: Object.fromEntries(['plain', 'skill-needle', 'mcp-needle'].map(k => [k, data.tasks.filter(t => t.kind === k).length])),
      plannedSessions: runs, concurrency: o.concurrency, timeoutSeconds: o.timeoutMs / 1000,
    }, null, 2) + '\n');
    const fixtureToken = randomBytes(32).toString('hex');
    const servers: Capability[] = [];
    for (const spec of serverSpecs(MAX_SERVERS)) {
      const e = await endpoint(() => ({ server: fixtureServer(spec, data.canaries) }), fixtureToken); endpoints.push(e);
      servers.push({ id: `mcp:${spec.name}`, kind: 'mcp', name: spec.name, description: `Third-party fixture ${spec.archetype}. ${fixtureTools(spec, data.canaries).map(t => `${t.name}: ${t.description}`).join('; ')}`, source: 'b11-fixture', gateway: true,
        tools: fixtureTools(spec, data.canaries).map(t => ({ name: t.name, description: t.description })), server: { url: e.url, headers: { Authorization: `Bearer ${fixtureToken}` } } });
    }
    let orderIndex = Math.max(-1, ...previous.map(r => r.orderIndex)) + 1;
    let rateLimitedUntil = 0, stopped = false, written = 0;
    let stopReason: 'budget exhausted' | 'free usage limit reached' | undefined;
    // A single queue per block preserves the static arm's cross-session cache opportunity.
    for (const block of plan) {
      if (stopped) break;
      let next = 0;
      const queue = block.tasks.filter(task => !done.has(rowKey({ taskId: task.id, model: block.model, arm: block.arm as B11Row['arm'], rep: block.rep, ...(block.arm === 'heavy-max' ? { heavyConfig: o.heavy } : {}) })));
      const workers = await Promise.allSettled(Array.from({ length: Math.min(o.concurrency, queue.length) }, async () => {
        while (!stopped && next < queue.length) {
          const task = queue[next++]!;
          if (Date.now() < rateLimitedUntil) await delay(rateLimitedUntil - Date.now());
          if (stopped) break;
          const index = orderIndex++, startedAt = new Date().toISOString(), start = Date.now();
          const sessionRoot = mkdtempSync(join(root, 'session-')), home = join(sessionRoot, 'home'), workspace = join(sessionRoot, 'work');
          mkdirSync(home); mkdirSync(workspace);
          const s: Sandbox = { workspace, home, binary: o.binary! };
          const meter = budget.meter();
          const token = block.arm === 'gateway' ? randomBytes(32).toString('hex') : fixtureToken;
          let gateway: Awaited<ReturnType<typeof endpoint>> | undefined;
          const row: B11Row = { taskId: task.id, kind: task.kind, split: splitOf(task.id), model: block.model as B11Row['model'], arm: block.arm as B11Row['arm'], rep: block.rep, orderIndex: index, startedAt, opencodeVersion: OPENCODE_VERSION,
            timeoutMs: o.timeoutMs, steps: [], totals: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }, toolCalls: [], skillsLoaded: [], result: 'invalid', invalidReason: 'provider-error', wallMs: 0, jev: meter.usage, listing: { skills: 0, servers: 0, tools: 0 } };
          if (block.arm === 'heavy-max') row.heavyConfig = o.heavy!;
          if (block.arm === 'preselect') row.selection = { skills: [], servers: [] };
          try {
            copyTree(fixturePath(data.root, 'workspaces', task.workspace), workspace);
            writeFileSync(join(workspace, 'AGENTS.md'), '');
            const sizeArm = !(CORE_ARMS as readonly string[]).includes(block.arm) && block.arm !== 'heavy-max';
            const listing = listingFor(block.arm as B11Row['arm'], skills, servers, plantedNames, sizeArm ? sweepCanaries : data.canaries, o.heavy);
            let selectedSkills = listing.skills, selectedServers = listing.servers;
            if (block.arm === 'preselect') {
              const d = await route({ task: task.prompt, repo: { name: 'b11', files: [], languages: {}, dependencies: [] }, library: [...skills, ...servers], config, client: meter.client, excerpt: skillExcerpt });
              if (d.router !== 'jev' || meter.failed) throw new RoutingUnavailable();
              selectedSkills = d.selected.filter(c => c.capability.kind === 'skill').map(c => c.capability);
              selectedServers = d.selected.filter(c => c.capability.kind === 'mcp').map(c => c.capability);
              row.selection = { skills: selectedSkills.map(s => s.name), servers: selectedServers.map(s => s.name) };
            }
            const nativeSkills = join(workspace, '.opencode', 'skills');
            for (const skill of selectedSkills) {
              const dst = join(nativeSkills, skill.name); mkdirSync(dst, { recursive: true });
              writeFileSync(join(dst, 'SKILL.md'), readConfined(skill.source, 'SKILL.md', 256 * 1024));
            }
            const mcp: Record<string, unknown> = Object.fromEntries(selectedServers.map(c => [c.name, { type: 'remote', url: c.server!.url, oauth: false, headers: { Authorization: 'Bearer {file:/home/bench/mcp-token}' }, timeout: 15000 }]));
            if (block.arm === 'gateway') {
              gateway = await endpoint(() => { const g = createServer({ library: [...skills, ...servers], config, client: meter.client }); return { server: g.server, close: () => g.gateway.close() }; }, token);
              mcp.loadout = { type: 'remote', url: gateway.url, oauth: false, headers: { Authorization: 'Bearer {file:/home/bench/mcp-token}' }, timeout: 30000 };
            }
            s.ports = Object.values(mcp).map(value => Number(new URL((value as { url: string }).url).port));
            if (Object.keys(mcp).length) writeFileSync(join(home, 'mcp-token'), token, { mode: 0o600 });
            row.listing = { skills: selectedSkills.length, servers: selectedServers.length, tools: selectedServers.reduce((n, c) => n + (c.tools?.length ?? 0), 0) };
            writeFileSync(join(workspace, 'opencode.json'), JSON.stringify({ ...OPENCODE_CONFIG, mcp }));
            // Another worker may stop the run while routing or gateway setup awaits.
            if (stopped) {
              row.invalidReason = stopReason === 'free usage limit reached' ? 'usage-limit' : stopReason === 'budget exhausted' ? 'budget-exhausted' : 'provider-error';
            } else {
              const run = await executeSandbox(s, ['/opt/opencode', 'run', '--pure', '--print-logs', '--log-level', 'ERROR', '-m', block.model, '--format', 'json', task.prompt], o.timeoutMs, true, true);
              const classified = classifyRun(run, meter.failed); Object.assign(row, classified.events);
              row.latency = run.clock.snapshot(row.steps.length);
              row.invalidReason = classified.invalidReason;
              if (row.invalidReason === 'usage-limit') { stopped = true; stopReason = 'free usage limit reached'; }
              if (!row.invalidReason) {
                const checked = await runCheck(task, s, data.root);
                if (checked === 'sandbox-failure') row.invalidReason = checked;
                else { row.result = checked; delete row.invalidReason; }
              }
              if (row.invalidReason === 'rate-limit') rateLimitedUntil = Date.now() + 60000;
            }
          } catch (error) {
            if (!(error instanceof RoutingUnavailable)) { stopped = true; throw error; }
          }
          finally {
            if (gateway) await gateway.close();
            await meter.settle();
            if (meter.failed) {
              row.result = 'invalid';
              if (row.invalidReason !== 'usage-limit') row.invalidReason = meter.exhausted ? 'budget-exhausted' : 'provider-error';
            }
            row.wallMs = Date.now() - start;
            // OpenCode's private databases/logs and generated files never enter public results.
            removeSession(sessionRoot);
          }
          appendFileSync(rowsFile, JSON.stringify(parseRow(row)) + '\n');
          written++;
          if (meter.exhausted) { stopped = true; stopReason ??= 'budget exhausted'; }
          console.log(`${row.orderIndex} ${row.model} ${row.arm} ${row.taskId}: ${row.result}${row.invalidReason ? ` (${row.invalidReason})` : ''}`);
        }
      }).map(worker => worker.catch(error => { stopped = true; throw error; })));
      const rejected = workers.find((worker): worker is PromiseRejectedResult => worker.status === 'rejected');
      if (rejected) throw rejected.reason;
    }
    console.log(`Jev reserved/observed cost: $${budget.spent.toFixed(6)}; new rows: ${written} of ${runs} planned sessions${stopReason ? `; ${stopReason}` : ''}`);
  } finally { await Promise.all(endpoints.map(e => e.close())); rmSync(root, { recursive: true, force: true }); }
}

if (isEntry(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(failureMessage(error)); process.exitCode = 1; });
