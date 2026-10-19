import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathTranslator, which } from '../src/launch.js';
import { capabilityKey } from '../src/library.js';
import { z } from 'zod';
import type { Capability, RawRouting, RepoSignals, RouteDecision, ScoredCapability } from '../src/types.js';
import type { SweepRow } from './sweep.js';

const BENCH = import.meta.dirname;
export const DATA = join(BENCH, 'data');
export const RESULTS = join(BENCH, 'results');

export interface CorpusSkill extends Capability {
  repo: string;
  stars: number;
  rank: number;
}

export interface Task {
  id: string;
  task: string;
  repo: RepoSignals;
  /** Skill names that should be selected; empty for tasks that need no skill. */
  gold: string[];
  /** 'repo': the skill is specific to one codebase; 'general': reusable; 'none': no skill needed. */
  scope: 'repo' | 'general' | 'none';
  /** Popularity bucket of the gold skill by corpus rank. */
  bucket?: 'popular' | 'head' | 'torso' | 'tail';
}

export function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) throw new Error(`missing ${file}; see bench/README.md`);
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

/** Rebuild a stored decision without routing again. Empty arms keep the row's tier so both arms of a pair run the same model: the comparison is about skills, not tier. */
export function decisionFor(row: SweepRow, library: Capability[], empty: boolean): RouteDecision {
  const byKey = new Map(library.map((c) => [capabilityKey(c), c]));
  const scored = (picks: SweepRow['loaded']): ScoredCapability[] =>
    picks.flatMap((p) => {
      const capability = byKey.get(p.key);
      return capability ? [{ capability, p: p.fit, exact: p.exact, share: p.share, ...(p.inject ? { inject: p.inject as 'clear' | 'mentioned' } : {}) }] : [];
    });
  return {
    tier: row.tier as RouteDecision['tier'],
    selected: empty ? [] : scored(row.loaded),
    suggested: empty ? [] : scored(row.offered),
    scored: [],
    // Empty arms get only the search hint, when search is enabled.
    router: empty ? 'lexical' : 'jev',
    stats: { librarySize: library.length, candidates: 0, ms: 0 },
  };
}

export function run(bin: string, args: string[], cwd: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    // Its own process group, so a timeout also stops what the CLI started (Codex's native
    // binary, the Windows process behind claude.exe), which would otherwise hold the pipes open.
    const child = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d: Buffer) => (stdout += d));
    child.stderr.on('data', (d: Buffer) => (stderr += d));
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });
  });
}

export function codexCli(directories: string[]): { bin: string; prefix: string[] } {
  if (process.platform === 'win32') {
    // Avoid cmd.exe so arbitrary temporary paths remain literal arguments.
    for (const dir of directories) {
      const entry = join(dir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (existsSync(entry)) return { bin: process.execPath, prefix: [entry] };
    }
  }
  return { bin: 'codex', prefix: [] };
}

export function loadCorpus(): CorpusSkill[] {
  return readJsonl<{ name: string; description: string; repo: string; path: string; stars: number; rank: number }>(
    join(DATA, 'corpus.jsonl'),
  ).map((r) => ({
    id: `skill:${r.name}`,
    kind: 'skill',
    name: r.name,
    description: r.description,
    source: `${r.repo}/${r.path}`,
    repo: r.repo,
    stars: r.stars,
    rank: r.rank,
  }));
}

export function loadTasks(): Task[] {
  return readJsonl<Task>(join(DATA, 'tasks.jsonl'));
}

/** Deterministic PRNG (mulberry32) so library samples are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sample<T>(items: T[], n: number, random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Rough token count (~4 chars per token) for context-cost estimates. */
export const approxTokens = (text: string) => Math.ceil(text.length / 4);

export async function pool<T, R>(items: T[], concurrency: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}

export interface ClaudeResult<T> {
  output: T;
  costUsd: number;
  inputTokens: number;
  ms: number;
}

export const modelFamily = (model: string): string => {
  if (/anthropic|claude|opus|sonnet|haiku/i.test(model)) return 'anthropic';
  if (/openai|gpt|codex|^o[134](?:-|$)/i.test(model)) return 'openai';
  return 'unknown';
};

export function backendOf(backend: string, effort?: string): string {
  if (!['claude', 'codex', 'files'].includes(backend)) throw new Error('--backend must be claude, codex or files');
  if (backend === 'claude' && effort !== undefined) throw new Error('--effort is not supported by the claude backend');
  return backend;
}

export const costLabel = (backend: string, cost: number): string => backend === 'claude' ? `$${cost.toFixed(2)}` : 'cost not reported (quota/cloud usage)';

/** 95% Wilson score interval for k successes out of n. */
export const wilson = (k: number, n: number): string => {
  if (!n) return '—';
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return `${(100 * Math.max(0, c - h)).toFixed(0)}–${(100 * Math.min(1, c + h)).toFixed(0)}%`;
};

let codexToolsChecked = false;

export async function modelJson<T>(prompt: string, schema: z.ZodType<T>, opts: {
  backend: string; model: string; system: string; out: string; effort?: string;
}): Promise<{ output: T; costUsd: number | null } | null> {
  backendOf(opts.backend, opts.effort);
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-07' });
  if (opts.backend === 'claude') {
    const res = await claudeJson<unknown>(prompt, jsonSchema, opts);
    return { output: schema.parse(res.output), costUsd: res.costUsd };
  }
  if (opts.backend === 'files') {
    const content = `Backend: ${opts.backend}\nModel: ${opts.model}\n\n## System\n\n${opts.system}\n\n## User\n\n${prompt}\n\n## JSON output schema\n\n${JSON.stringify(jsonSchema, null, 2)}\n`;
    const dir = join(opts.out, 'batches');
    mkdirSync(dir, { recursive: true });
    const prompts = readdirSync(dir).filter((f) => /^\d+\.prompt\.md$/.test(f)).sort();
    // Match by content so completed rows and retries cannot shift answers onto another batch.
    const existing = prompts.find((f) => readFileSync(join(dir, f), 'utf8') === content);
    const number = Math.max(0, ...prompts.map((f) => Number(f.split('.')[0]))) + 1;
    const file = existing ?? `${String(number).padStart(3, '0')}.prompt.md`;
    if (!existing) writeFileSync(join(dir, file), content, { flag: 'wx' });
    const answer = join(dir, file.replace('.prompt.md', '.answer.json'));
    const stat = lstatSync(answer, { throwIfNoEntry: false });
    if (!stat) {
      console.log(`pending batch ${file.replace('.prompt.md', '')}: ${answer}`);
      return null;
    }
    if (!stat.isFile()) throw new Error(`answer must be a regular file: ${answer}`);
    return { output: schema.parse(JSON.parse(readFileSync(answer, 'utf8'))), costUsd: null };
  }
  const content = `${prompt}\n\n## System\n\n${opts.system}\n\nUse only the supplied data; do not use tools. Return JSON matching this schema:\n${JSON.stringify(jsonSchema)}`;
  const dir = mkdtempSync(join(tmpdir(), 'loadout-bench-codex-'));
  try {
    const schemaFile = join(dir, 'schema.json');
    const answerFile = join(dir, 'answer.json');
    writeFileSync(schemaFile, JSON.stringify(jsonSchema));
    const config = [
      '-c', 'features.shell_tool=false', '-c', 'features.unified_exec=false', '-c', 'features.view_image=false',
      ...(opts.effort ? ['-c', `model_reasoning_effort=${JSON.stringify(opts.effort)}`] : []),
    ];
    const shim = process.platform === 'win32' ? which('codex') ?? which('codex.cmd') : undefined;
    const { bin, prefix } = codexCli(shim ? [dirname(shim)] : []);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/_(?:KEY|TOKEN|SECRET)$/i.test(key)));
    if (!codexToolsChecked) {
      const features = execFileSync(bin, [...prefix, ...config, 'features', 'list'], { cwd: dir, env, encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'ignore'] });
      if (!['shell_tool', 'unified_exec'].every((feature) => new RegExp(`^${feature}[\\t ]+\\S+[\\t ]+false[\\t ]*\\r?$`, 'm').test(features))) {
        throw new Error('Codex judging refused: features list must report shell_tool=false and unified_exec=false; read-only sandboxes permit credential file reads. Use --backend files or --backend claude.');
      }
      codexToolsChecked = true;
    }
    const args = [
      ...prefix,
      'exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check',
      '--sandbox', 'read-only', '--model', opts.model,
      ...config,
      '--output-schema', schemaFile, '--output-last-message', answerFile, '-',
    ];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(bin, args, { cwd: dir, env, stdio: ['pipe', 'ignore', 'ignore'] });
      const timer = setTimeout(() => child.kill(), 300_000);
      child.on('error', (err) => { clearTimeout(timer); reject(err); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`codex exited ${code}`));
      });
      child.stdin.on('error', reject);
      child.stdin.end(content);
    });
    return { output: schema.parse(JSON.parse(readFileSync(answerFile, 'utf8'))), costUsd: null };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * One structured-output call through the Claude Code CLI. The prompt goes on
 * stdin (the Windows claude.exe has a 32K command-line limit), and MCP servers,
 * tools and settings are stripped so they do not pollute cost measurements.
 */
export function claudeJson<T>(prompt: string, schema: object, opts: { model: string; system: string; timeoutMs?: number }): Promise<ClaudeResult<T>> {
  const args = [
    '-p',
    '--model', opts.model,
    '--output-format', 'json',
    '--json-schema', JSON.stringify(schema),
    ...systemPromptArgs(opts.system),
    '--tools', '',
    '--setting-sources', '',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
  ];
  return new Promise((resolve, reject) => {
    // Neutral cwd: the CLI otherwise tells the model about the directory it runs in.
    const child = spawn('claude', args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill(), opts.timeoutMs ?? 300_000);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d));
    child.stderr.on('data', (d: Buffer) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        const res = JSON.parse(stdout) as {
          is_error?: boolean;
          structured_output?: T;
          result?: string;
          total_cost_usd: number;
          duration_ms: number;
          usage: { input_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
        };
        if (res.is_error || res.structured_output === undefined) throw new Error(res.result ?? 'no structured output');
        const u = res.usage;
        resolve({
          output: res.structured_output,
          costUsd: res.total_cost_usd,
          inputTokens: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
          ms: res.duration_ms,
        });
      } catch (err) {
        reject(new Error(`claude exited ${code}: ${err instanceof Error ? err.message : err}\n${stderr.slice(-500)}`));
      }
    });
    child.stdin.end(prompt);
  });
}

/**
 * Long system prompts (a whole skill catalog) go through a file: command lines
 * are capped (E2BIG on Linux, 32K on Windows). The file is named by content,
 * so concurrent calls with the same prompt share it.
 */
function systemPromptArgs(system: string): string[] {
  if (system.length < 8_000) return ['--system-prompt', system];
  const dir = join(tmpdir(), 'loadout-bench');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `system-${createHash('sha256').update(system).digest('hex').slice(0, 16)}.txt`);
  if (!existsSync(file)) writeFileSync(file, system);
  return ['--system-prompt-file', pathTranslator(which('claude'))(file)];
}

/** Each task belongs to the dev split (tune policies here) or the test split (report here). */
export const splitOf = (taskId: string): 'dev' | 'test' => (hashSeed(`split:${taskId}`) % 3 === 0 ? 'dev' : 'test');

/** One benchmark observation: a task, at a library size, under an arm. */
export interface Row {
  task: string;
  split: 'dev' | 'test';
  size: number;
  arm: string;
  scope: Task['scope'];
  bucket?: Task['bucket'];
  gold: string[];
  /** All gold skills selected (undefined for tasks with no gold). */
  hit?: boolean;
  /** The first selected skill is gold. */
  top1?: boolean;
  /** 1-based rank of the first gold skill in the arm's ordering, if ranked. */
  goldRank?: number;
  selected: number;
  selectedNames?: string[];
  /** Tokens of skill descriptions this arm puts in the agent's context. */
  contextTokens: number;
  routerCostUsd: number;
  routerMs: number;
  tier?: string;
  need?: number;
  /** loadout only: raw Jev answers, trimmed (the wide pick keeps its top 30 plus gold). */
  raw?: Omit<RawRouting, 'candidates'> & { goldCandidateRank?: number };
}
