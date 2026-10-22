export interface TokenUsage {
  /** Includes cache reads and cache creation, matching ClaudeResult.inputTokens. */
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface RequestUsage {
  requestSource: 'result.usage.iterations' | null;
  /** Null means the host did not report request counters; never infer them from a turn. */
  requests: TokenUsage[] | null;
  totals: TokenUsage | null;
}

export function parseHostEvents(stdout: string): Record<string, unknown>[] {
  return stdout.split('\n').flatMap((line, index) => {
    if (!line.trim()) return [];
    let event;
    try { event = JSON.parse(line); } catch { throw new Error(`invalid host event at line ${index + 1}`); }
    // Do not include the line in diagnostics: host output can contain private task data.
    if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.type !== 'string') {
      throw new Error(`invalid host event at line ${index + 1}`);
    }
    return [event];
  });
}

function counters(value: unknown, host: 'claude' | 'codex'): TokenUsage {
  if (!value || typeof value !== 'object') throw new Error('invalid host usage');
  const u = value as Record<string, unknown>;
  const count = (key: string): number => {
    const n = u[key];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) throw new Error(`invalid host usage counter: ${key}`);
    return n;
  };
  const cachedInputTokens = count(host === 'claude' ? 'cache_read_input_tokens' : 'cached_input_tokens');
  const inputTokens = count('input_tokens') + (host === 'claude' ? count('cache_creation_input_tokens') + cachedInputTokens : 0);
  if (cachedInputTokens > inputTokens) throw new Error('host usage cached input exceeds input');
  return { inputTokens, cachedInputTokens, outputTokens: count('output_tokens') };
}

export function requestUsage(host: 'claude' | 'codex', events: Record<string, unknown>[]): RequestUsage {
  const results = events.filter((e) => e.type === (host === 'claude' ? 'result' : 'turn.completed'));
  if (results.length > 1) throw new Error('multiple host usage totals');
  const usage = results[0]?.usage;
  if (usage === undefined) return { requestSource: null, requests: null, totals: null };
  const totals = counters(usage, host);
  const iterations = (usage as Record<string, unknown>).iterations;
  if (host === 'codex' || iterations === undefined) return { requestSource: null, requests: null, totals };
  if (!Array.isArray(iterations)) throw new Error('invalid host usage iterations');
  // Assistant events can contain partial output counts; the final result has completed iterations.
  return { requestSource: 'result.usage.iterations', requests: iterations.map((u) => counters(u, host)), totals };
}
