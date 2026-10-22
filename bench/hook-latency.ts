/**
 * npx tsx bench/hook-latency.ts [--limit 10]
 * Uses LOADOUT_HOME's library/config and dev requests only. Missing key means
 * fake Jev, including replayed answers in the CLI subprocess (no Jev traffic).
 * Prompts omit session_id so repeat measurements neither reuse nor write state.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { jevBaseUrl, loadConfig, paths, resolveApiKey } from '../src/config.js';
import { cachedEmbeddings } from '../src/embed.js';
import { hookOutput, promptContext } from '../src/hook.js';
import { jevClient, type Answer, type SystemOneClient, type SystemOneResponse } from '../src/jev.js';
import { scanLibrary } from '../src/library.js';
import { repoSignals } from '../src/repo.js';
import { NONE } from '../src/route.js';
import { DATA, isEntry, readJsonl, RESULTS, splitOf } from './lib.js';

export function percentile(samples: number[], p: number): number {
  return [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * p) - 1]!;
}

export function fakeClient(): SystemOneClient {
  return {
    async ask(_state, questions) {
      const answers: Record<string, Answer> = {};
      for (const [id, q] of Object.entries(questions)) {
        if (q.type === 'choice') {
          const keys = Object.keys(q.criteria);
          const choice = id === 'model_tier' ? 'medium' : keys.find((k) => k !== NONE)!;
          answers[id] = { type: 'choice', choice, confidence: 1, probabilities: Object.fromEntries(keys.map((k) => [k, k === choice ? 1 : 0])) };
        } else if (q.type === 'score') {
          answers[id] = { type: 'score', score: 3, confidence: 1, probabilities: { '0': 0.01, '3': 0.99 } };
        } else {
          answers[id] = { type: 'noul', noul: id === 'general_enough' ? 0.01 : 0.99 };
        }
      }
      return { model: 'jev-fake', answers, usage: { input_tokens: 0, output_tokens: 0 } };
    },
  };
}

/** Replay only our Jev answers: the standalone CLI still validates and routes them. */
export function replayPreload(replies: SystemOneResponse[], endpoint: string): string {
  const code = `
    const replies = JSON.parse(${JSON.stringify(JSON.stringify(replies))});
    globalThis.fetch = async (url) => {
      if (String(url) !== ${JSON.stringify(endpoint)}) throw new Error('offline benchmark blocks network');
      if (!replies.length) throw new Error('fake Jev replies exhausted');
      return Response.json(replies.shift());
    };
  `;
  return code;
}

if (isEntry(import.meta.url)) {
  const { values } = parseArgs({ options: { limit: { type: 'string', default: '10' } } });
  const limit = Number(values.limit);
  const dev = readJsonl<{ id: string; request: string }>(join(DATA, 'requests.jsonl')).filter((r) => splitOf(r.id) === 'dev');
  if (!Number.isInteger(limit) || limit < 1 || limit > dev.length) throw new Error(`--limit must be an integer in 1..${dev.length}`);
  const requests = dev.slice(0, limit);
  const config = loadConfig();
  if (config.router !== 'jev') throw new Error('latency measurement needs router "jev" to exercise both requests');
  const apiKey = resolveApiKey(config);
  const mode = apiKey ? 'real Jev' : 'fake client (no key; subprocess replays fake answers)';
  console.log(`Expected Jev cost: 2 requests/prompt, about $0.0011/decision (RESULTS v4).`);
  console.log(`Two passes (in-process + subprocess): up to ${4 * limit} requests, ~$${(0.0022 * limit).toFixed(4)} real; fake $0.`);
  console.log(`Mode: ${mode}; ${limit} dev prompts.`);

  const root = join(import.meta.dirname, '..');
  const cli = join(root, 'dist', 'cli.js');
  if (!existsSync(cli)) throw new Error('run npm run build first');

  const steps = ['config load', 'scanLibrary', 'cachedEmbeddings', 'Jev wide', 'Jev close', 'promptContext total', 'CLI wall clock'] as const;
  type Step = typeof steps[number];
  const rows: { id: string; ms: Partial<Record<Step, number>> }[] = [];
  const dir = join(RESULTS, `${new Date().toISOString().replace(/[:.]/g, '-')}-hook-latency`);
  mkdirSync(dir, { recursive: true });
  const client = apiKey ? jevClient({ apiKey, baseUrl: jevBaseUrl(config), model: config.jev.model, timeoutMs: 8_000, retries: 0 }) : fakeClient();
  const endpoint = `${jevBaseUrl(config).replace(/\/$/, '')}/v1/systemone`;
  for (const request of requests) {
    const ms: Partial<Record<Step, number>> = {};
    const time = async <T>(step: Step, run: () => T | Promise<T>): Promise<T> => {
      const start = performance.now();
      try { return await run(); }
      finally { ms[step] = performance.now() - start; }
    };
    const current = await time('config load', loadConfig);
    const library = await time('scanLibrary', () => scanLibrary(paths.library(), { cache: true }));
    if (!library.some((c) => c.kind === 'skill') || !current.maxCandidates || !current.shortlist) throw new Error('needs a nonempty skill library and nonzero candidate/shortlist limits');
    const embeddings = current.embeddings ? await time('cachedEmbeddings', () => cachedEmbeddings(paths.embeddings())) : undefined;
    const replies: SystemOneResponse[] = [];
    const timed: SystemOneClient = {
      async ask(state, questions) {
        const reply = await time(replies.length === 0 ? 'Jev wide' : 'Jev close', () => client.ask(state, questions));
        replies.push(reply);
        return reply;
      },
    };
    const input = { prompt: request.request, cwd: root };
    const context = await time('promptContext total', () => promptContext(input, {
      config: current, library, embeddings, client: timed,
      repo: repoSignals(root), stateDir: join(paths.sessions(), 'hook'),
    }));
    if (replies.length !== 2) throw new Error('hook did not complete both Jev requests; no latency summary written');
    // A file avoids Windows' command-line limit when the wide answer has many keys.
    const preload = join(dir, 'fake-preload.mjs');
    if (!apiKey) writeFileSync(preload, replayPreload(replies, endpoint));
    const args = [...(!apiKey ? ['--import', pathToFileURL(preload).href] : []), cli, 'hook', 'claude'];
    const child = await time('CLI wall clock', () => spawnSync(process.execPath, args, {
      cwd: root, input: JSON.stringify(input), encoding: 'utf8', timeout: 30_000,
      env: { ...process.env, ...(!apiKey ? { TYPESAFE_API_KEY: 'hook-latency-fake' } : {}) },
    })).finally(() => { if (!apiKey) unlinkSync(preload); });
    // Hooks exit 0 even on failure; stderr must be checked before counting a sample.
    if (child.error || child.status !== 0 || child.stderr.trim()) throw new Error('CLI hook failed or reported a diagnostic; no latency summary written');
    if (!apiKey && child.stdout.trim() !== (context ? hookOutput(context) : '')) throw new Error('fake subprocess context differs from the in-process hook');
    rows.push({ id: request.id, ms });
  }

  console.log('Step (ms)                 p50       p95');
  for (const step of steps) {
    const samples = rows.flatMap((r) => r.ms[step] === undefined ? [] : [r.ms[step]!]);
    console.log(samples.length ? `${step.padEnd(24)} ${percentile(samples, 0.5).toFixed(2).padStart(8)} ${percentile(samples, 0.95).toFixed(2).padStart(9)}` : `${step.padEnd(24)} skipped (disabled)`);
  }
  writeFileSync(join(dir, 'latency.json'), JSON.stringify({ mode, node: process.version, limit, rows }, null, 2) + '\n');
  console.log(`Raw samples: ${join(dir, 'latency.json')}`);
}
