import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathTranslator, which } from '../src/launch.js';
import type { Capability, RawRouting, RepoSignals } from '../src/types.js';

export const BENCH = import.meta.dirname;
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
