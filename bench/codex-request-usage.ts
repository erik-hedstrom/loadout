/** Offline C11 source prototype. Accepts supplied text; never discovers or reads a Codex home. */
import { counter } from './usage.js';

export interface CodexRequest {
  n: number;
  at: string | null;
  input: number;
  uncached: number | null;
  cacheRead: number;
  cacheWrite: number | null;
  output: number;
}

/** token_count and app-server updates can repeat on rate-limit notifications.
 * Count only a reconciled increment; context estimates/compaction are not requests. */
export function codexRequests(text: string, source: 'rollout' | 'app-server', threadId: string) {
  const requests: CodexRequest[] = [], unreconciled: string[] = [];
  let previous: number[] = [0, 0, 0], lastSignature: string | undefined;
  let matchedSession = source === 'app-server';
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  try {
    for (let i = 0; i < lines.length; i++) {
      let e: any;
      try { e = JSON.parse(lines[i]!); }
      catch {
        if (i !== lines.length - 1) throw new Error();
        unreconciled.push('truncated final event');
        break;
      }
      if (source === 'rollout' && e?.type === 'session_meta') {
        if (matchedSession || e.payload?.id !== threadId) throw new Error();
        matchedSession = true;
        continue;
      }
      const info = source === 'rollout'
        ? e?.type === 'event_msg' && e.payload?.type === 'token_count' ? e.payload.info : undefined
        : e?.method === 'thread/tokenUsage/updated' && e.params?.threadId === threadId ? e.params.tokenUsage : undefined;
      if (info == null) continue;
      if (!matchedSession) throw new Error();
      const last = source === 'rollout' ? info.last_token_usage : info.last;
      const total = source === 'rollout' ? info.total_token_usage : info.total;
      const keys = source === 'rollout' ? ['input_tokens', 'cached_input_tokens', 'output_tokens'] : ['inputTokens', 'cachedInputTokens', 'outputTokens'];
      const current = keys.map((k) => counter(total?.[k], 'Codex total'));
      const values = keys.map((k) => counter(last?.[k], 'Codex request'));
      if (values[1]! > values[0]! || current[1]! > current[0]!) throw new Error();
      const signature = JSON.stringify([current, values]);
      if (signature === lastSignature) continue;
      lastSignature = signature;
      // A rate-limit or synthetic context-window update can carry unchanged
      // counters. It does not establish that a model request completed.
      if (current.every((n, j) => n === previous[j])) continue;
      if (current.some((n, j) => n - previous[j]! !== values[j])) {
        unreconciled.push('usage increment does not match last request');
        previous = current;
        continue;
      }
      previous = current;
      const writeValue = last?.[source === 'rollout' ? 'cache_write_input_tokens' : 'cacheWriteInputTokens'];
      const cacheWrite = writeValue === undefined ? null : counter(writeValue, 'Codex write');
      if (cacheWrite !== null && cacheWrite + values[1]! > values[0]!) throw new Error();
      const at = source === 'rollout' && typeof e.timestamp === 'string' && Number.isFinite(Date.parse(e.timestamp)) ? e.timestamp : null;
      requests.push({ n: requests.length + 1, at, input: values[0]!,
        uncached: cacheWrite === null ? null : values[0]! - values[1]! - cacheWrite, cacheRead: values[1]!, cacheWrite,
        output: values[2]! });
    }
    if (!matchedSession || !requests.length) unreconciled.push('no request usage for the requested session');
    return { requests, unreconciled };
  } catch { throw new Error('Codex request usage invalid (contents suppressed)'); }
}
