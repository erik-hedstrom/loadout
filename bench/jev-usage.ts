import { counter, events } from './usage.js';
import { readdirSync } from 'node:fs';
import { JEV_USAGE_MARKER } from '../src/jev-usage.js';
import { readConfined } from '../src/library.js';

export interface JevRunUsage {
  calls: number | null;
  attempts: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  usageMissing: boolean;
  /** Configured input-price estimate for observed input only, never a total bill. Output has no configured price. */
  reportedInputCostUsd: number | null;
  /** Unknown when usage is incomplete or nonzero output is unpriced. */
  costUsd: number | null;
}

/** A capture failure must not discard the host row that has already been paid for. */
export function readJevUsage(dir: string, requiredSources: ('hook' | 'router')[]): JevRunUsage {
  try {
    const files = readdirSync(dir).filter((name) => name !== JEV_USAGE_MARKER);
    if (!files.length || files.some((name) => !/^jev-[a-f0-9-]+\.jsonl$/.test(name))) throw new Error();
    return jevRunUsage(files.sort().map((name) => readConfined(dir, name, 4096)).join('\n'), requiredSources);
  } catch {
    return { calls: null, attempts: null, inputTokens: null, outputTokens: null, usageMissing: true, reportedInputCostUsd: null, costUsd: null };
  }
}

export function jevRunUsage(text: string, requiredSources: ('hook' | 'router')[] = []): JevRunUsage {
  let calls = 0, attempts = 0, finished = 0, ready = false, unknown = false, reportedInputCostUsd = 0, inputTokens = 0, outputTokens = 0;
  const sources = new Set<string>();
  try {
    for (const e of events(text)) {
      if (e?.type === 'ready') { ready = true; sources.add(e.source); }
      else if (e?.type === 'call') calls++;
      else if (e?.type === 'start') attempts++;
      else if (e?.type === 'finish') {
        finished++;
        if (e.inputTokens === null || e.outputTokens === null) unknown = true;
        if (e.outputTokens !== null) outputTokens += counter(e.outputTokens, 'Jev output');
        if (e.inputTokens === null) unknown = true;
        else {
          const input = counter(e.inputTokens, 'Jev input');
          if (typeof e.price !== 'number' || !Number.isFinite(e.price) || e.price < 0) throw new Error();
          inputTokens += input;
          reportedInputCostUsd += input * e.price / 1e6;
        }
      } else throw new Error();
    }
    if (finished > attempts || !Number.isFinite(reportedInputCostUsd)) throw new Error();
    const usageMissing = !ready || requiredSources.some((s) => !sources.has(s)) || unknown || attempts !== finished;
    return { calls, attempts, inputTokens: usageMissing ? null : inputTokens, outputTokens: usageMissing ? null : outputTokens, usageMissing,
      reportedInputCostUsd, costUsd: usageMissing || outputTokens > 0 ? null : reportedInputCostUsd };
  } catch { throw new Error('benchmark Jev usage invalid (contents suppressed)'); }
}
