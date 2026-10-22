interface TokenUsage {
  /** Input includes cache creation and cache reads for Claude. */
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export interface RequestUsage {
  /** Neither result.usage nor exec --json exposes a list of model requests. */
  requests: null;
  totals: TokenUsage | null;
}

export function events(stdout: string): any[] {
  try { return stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
  catch { throw new Error('host emitted invalid JSONL (output suppressed)'); }
}
export function counter(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`missing or invalid ${name}`);
  return value as number;
}

export function requestUsage(host: 'claude' | 'codex', records: any[]): RequestUsage {
  const results = records.filter((e) => e?.type === (host === 'claude' ? 'result' : 'turn.completed'));
  if (results.length !== 1) throw new Error('missing or multiple host usage totals');
  const u = results[0].usage;
  const cachedInputTokens = counter(host === 'claude' ? u?.cache_read_input_tokens : u?.cached_input_tokens, 'cached input');
  const inputTokens = counter(u?.input_tokens, 'input tokens')
    + (host === 'claude' ? counter(u?.cache_creation_input_tokens, 'cache creation') + cachedInputTokens : 0);
  if (cachedInputTokens > inputTokens) throw new Error('host usage cached input exceeds input');
  // Claude's iterations describe sampling within the last request, not the session's requests.
  return { requests: null, totals: { inputTokens, cachedInputTokens, outputTokens: counter(u?.output_tokens, 'output tokens') } };
}