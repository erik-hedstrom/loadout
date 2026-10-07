/**
 * Minimal client for TypeSafe's System One API (POST /v1/systemone).
 * Uses fetch directly so the router has no SDK dependency.
 */
import { safeDetail } from './errors.js';

/** Instructions and criteria accept plain text or JSON structure (labelled fields, lists). */
export type Text = string | string[] | Record<string, unknown>;

export type Question =
  | { type: 'noul'; instructions: Text }
  | { type: 'choice'; instructions: Text; criteria: Record<string, Text> }
  | { type: 'score'; instructions: Text; criteria: Text[] };

export type Answer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: 'score'; score: number; confidence: number; probabilities: Record<string, number> };

export interface SystemOneResponse {
  model: string;
  answers: Record<string, Answer>;
  usage: { input_tokens: number; output_tokens: number };
}

export interface SystemOneClient {
  ask(state: unknown, questions: Record<string, Question>): Promise<SystemOneResponse>;
}

export class JevError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Worth retrying: rate limits, server errors. Malformed answers and auth errors are not. */
    readonly retryable = status === 429 || (status !== undefined && status >= 500),
  ) {
    super(message);
  }
}

/** Probabilities over a distribution may be rounded by the API; anything further off is malformed. */
const SUM_TOLERANCE = 0.05;

/**
 * Check that every question came back with an answer of the right shape: a
 * probability for a Noul, and for a Choice or Score a non-empty distribution
 * over the options or levels that were asked, summing to ~1.
 */
export function validateResponse(body: unknown, questions: Record<string, Question>): SystemOneResponse {
  const fail = (why: string): never => {
    throw new JevError(`malformed TypeSafe response: ${why}`, undefined, false);
  };
  if (!body || typeof body !== 'object') fail('not an object');
  const { answers, usage, model } = body as Partial<SystemOneResponse>;
  if (!answers || typeof answers !== 'object') fail('no answers');
  const isProb = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
  for (const [id, q] of Object.entries(questions)) {
    const a = (answers as Record<string, Answer | undefined>)[id];
    if (!a || a.type !== q.type) fail(`missing or mistyped answer "${id}"`);
    if (a!.type === 'noul') {
      if (!isProb(a!.noul)) fail(`bad probability in "${id}"`);
      continue;
    }
    const dist = a!.probabilities;
    if (!dist || typeof dist !== 'object' || Array.isArray(dist)) fail(`no distribution in "${id}"`);
    const allowed = new Set(q.type === 'choice' ? Object.keys(q.criteria) : (q as { criteria: unknown[] }).criteria.map((_, i) => String(i)));
    const entries = Object.entries(dist);
    if (!entries.length) fail(`empty distribution in "${id}"`);
    for (const [k, v] of entries) {
      if (!allowed.has(k)) fail(`unknown option "${k}" in "${id}"`);
      if (!isProb(v)) fail(`bad probability for "${k}" in "${id}"`);
    }
    const sum = entries.reduce((t, [, v]) => t + v, 0);
    if (Math.abs(sum - 1) > SUM_TOLERANCE) fail(`distribution in "${id}" sums to ${sum.toFixed(3)}`);
  }
  const finite = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
  return {
    model: typeof model === 'string' ? model : 'unknown',
    answers: answers!,
    usage: { input_tokens: finite(usage?.input_tokens), output_tokens: finite(usage?.output_tokens) },
  };
}

export function jevClient(opts: { apiKey: string; baseUrl: string; model: string; timeoutMs?: number; retries?: number }): SystemOneClient {
  const once = async (state: unknown, questions: Record<string, Question>) => {
    const res = await fetch(`${opts.baseUrl.replace(/\/$/, '')}/v1/systemone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: opts.model, state, questions }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 12_000),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { detail?: unknown; message?: unknown };
    if (!res.ok) {
      const detail = typeof body.detail === 'string' ? body.detail : typeof body.message === 'string' ? body.message : JSON.stringify(body.detail ?? body);
      throw new JevError(`TypeSafe API ${res.status}: ${detail}`, res.status);
    }
    return validateResponse(body, questions);
  };
  return {
    async ask(state, questions) {
      for (let attempt = 0; ; attempt++) {
        try {
          return await once(state, questions);
        } catch (err) {
          if (err instanceof Error) {
            // Validation and transport errors can also contain upstream text.
            const message = safeDetail(err.message, [opts.apiKey]);
            err = err instanceof JevError ? new JevError(message, err.status, err.retryable) : new Error(message);
          }
          // Network errors and timeouts are not JevErrors and are worth one more try.
          const retryable = err instanceof JevError ? err.retryable : true;
          if (!retryable || attempt >= (opts.retries ?? 1)) throw err;
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        }
      }
    },
  };
}
