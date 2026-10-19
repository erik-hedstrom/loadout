/**
 * Token usage per model request, from the host's own usage report (no proxy: AGENTS.md rule 1). The four
 * counters stay apart everywhere: uncached input, cache writes, cache reads and output are billed at
 * different rates, and a cold cache moves tokens from reads to writes.
 *
 * Claude Code, `--output-format stream-json`: every assistant event has `message.id` and `message.usage`; a message
 * with several content blocks arrives as several events with the same id, so requests are deduplicated by id.
 * `<synthetic>` messages (a login error) are not requests. Verified against a recorded 2.1.281 stream.
 *
 * Codex, `exec --json`: `turn.completed.usage` is the thread's running total (codex-rs/exec/src/event_processor_with_jsonl_output.rs
 * at rust-v0.160.1, `usage_from_last_total`), so it is one entry per run: there is no per-request usage in this stream.
 */

export interface RequestUsage {
  /** 1-based; always 1 for a Codex run, whose total covers every request of the turn. */
  n: number;
  /** The host's own timestamp (Claude) when the request finished; null where the stream has none. */
  at: string | null;
  model: string | null;
  uncached: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
  /** Claude's split of `cacheWrite` by cache lifetime, when the stream gives it. */
  cacheWrite5m: number | null;
  cacheWrite1h: number | null;
  /** Codex's reasoning tokens, already inside `output`. */
  reasoning: number | null;
}

export interface RunUsage {
  granularity: 'request' | 'turn';
  requests: RequestUsage[];
  /** Claude's total_cost_usd (nominal API price, not what a subscription pays); null where the stream has none. */
  costUsd: number | null;
  turns: number | null;
  model: string | null;
  version: string | null;
  /** Counters that differ between the summed requests and the result event's own total (Claude), or []. */
  unreconciled: string[];
}

export const sumUsage = (rs: RequestUsage[]) => ({
  uncached: rs.reduce((n, r) => n + r.uncached, 0),
  cacheWrite: rs.reduce((n, r) => n + r.cacheWrite, 0),
  cacheRead: rs.reduce((n, r) => n + r.cacheRead, 0),
  output: rs.reduce((n, r) => n + r.output, 0),
});

/** Anthropic's published prompt-caching multipliers on the base input price: 5-minute write 1.25, 1-hour write 2, read 0.1. */
const CLAUDE_WEIGHTS = { write5m: 1.25, write1h: 2, read: 0.1 };

/** Input as base-price tokens (Claude only): uncached + weighted writes + weighted reads. Compare with the stream's cost; the multipliers are Anthropic's, not read from the stream. */
export function effectiveInput(u: Pick<RequestUsage, 'uncached' | 'cacheWrite' | 'cacheRead' | 'cacheWrite5m' | 'cacheWrite1h'>): number {
  const w1h = u.cacheWrite1h ?? 0;
  const w5m = u.cacheWrite5m ?? u.cacheWrite - w1h;
  return u.uncached + CLAUDE_WEIGHTS.write5m * w5m + CLAUDE_WEIGHTS.write1h * w1h + CLAUDE_WEIGHTS.read * u.cacheRead;
}

function counter(v: unknown, name: string): number {
  if (!Number.isSafeInteger(v) || (v as number) < 0) throw new Error(`missing or invalid ${name}`);
  return v as number;
}

const events = (stdout: string): any[] =>
  stdout.split('\n').flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });

export function claudeUsage(stdout: string): RunUsage {
  const byId = new Map<string, RequestUsage>();
  let model: string | null = null;
  let version: string | null = null;
  let result: any;
  for (const e of events(stdout)) {
    if (e.type === 'system' && e.subtype === 'init') {
      model = typeof e.model === 'string' ? e.model : null;
      version = typeof e.claude_code_version === 'string' ? e.claude_code_version : null;
    } else if (e.type === 'assistant' && e.message?.model !== '<synthetic>') {
      const m = e.message;
      const u = m?.usage;
      const id = String(m?.id ?? '');
      if (!id) throw new Error('assistant message without an id');
      const next: RequestUsage = {
        n: 0,
        at: typeof e.timestamp === 'string' ? e.timestamp : null,
        model: typeof m.model === 'string' ? m.model : null,
        uncached: counter(u?.input_tokens, 'input_tokens'),
        cacheWrite: counter(u?.cache_creation_input_tokens, 'cache_creation_input_tokens'),
        cacheRead: counter(u?.cache_read_input_tokens, 'cache_read_input_tokens'),
        output: counter(u?.output_tokens, 'output_tokens'),
        cacheWrite5m: Number.isSafeInteger(u?.cache_creation?.ephemeral_5m_input_tokens) ? u.cache_creation.ephemeral_5m_input_tokens : null,
        cacheWrite1h: Number.isSafeInteger(u?.cache_creation?.ephemeral_1h_input_tokens) ? u.cache_creation.ephemeral_1h_input_tokens : null,
        reasoning: null,
      };
      // Later blocks of one message repeat the usage and may carry its final output count: keep the largest.
      const prev = byId.get(id);
      byId.set(id, prev ? { ...next, output: Math.max(prev.output, next.output) } : next);
    } else if (e.type === 'result') result = e;
  }
  const requests = [...byId.values()].map((r, i) => ({ ...r, n: i + 1 }));
  const total = sumUsage(requests);
  const reported = result?.usage;
  const unreconciled = !reported ? ['no result usage'] : ([
    ['uncached', reported.input_tokens, total.uncached], ['cacheWrite', reported.cache_creation_input_tokens, total.cacheWrite],
    ['cacheRead', reported.cache_read_input_tokens, total.cacheRead], ['output', reported.output_tokens, total.output],
  ] as const).filter(([, said, summed]) => said !== summed).map(([name]) => name);
  return {
    granularity: 'request', requests,
    costUsd: typeof result?.total_cost_usd === 'number' ? result.total_cost_usd : null,
    turns: typeof result?.num_turns === 'number' ? result.num_turns : null,
    model, version, unreconciled,
  };
}

export function codexUsage(stdout: string): RunUsage {
  const completed = events(stdout).filter((e) => e.type === 'turn.completed');
  const last = completed.at(-1)?.usage;
  if (!last) throw new Error('Codex produced no completed turn');
  const input = counter(last.input_tokens, 'input_tokens');
  const cacheRead = counter(last.cached_input_tokens, 'cached_input_tokens');
  const cacheWrite = counter(last.cache_write_input_tokens ?? 0, 'cache_write_input_tokens');
  if (cacheRead + cacheWrite > input) throw new Error('cached input exceeds input');
  return {
    granularity: 'turn',
    requests: [{ n: 1, at: null, model: null, uncached: input - cacheRead - cacheWrite, cacheWrite, cacheRead, output: counter(last.output_tokens, 'output_tokens'), cacheWrite5m: null, cacheWrite1h: null, reasoning: Number.isSafeInteger(last.reasoning_output_tokens) ? last.reasoning_output_tokens : null }],
    costUsd: null, turns: null, model: null, version: null, unreconciled: [],
  };
}
