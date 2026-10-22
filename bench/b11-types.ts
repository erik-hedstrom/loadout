import { z } from 'zod';

export const CORE_ARMS = ['bare', 'skills-all', 'mcp-all', 'all', 'gateway', 'preselect'] as const;
export const ARMS = [...CORE_ARMS, 'skills-50', 'skills-250', 'mcp-1', 'mcp-5'] as const;
export const DEFAULT_MODELS = ['opencode/glm-5.3-flash-free', 'opencode/deepseek-v4.1-flash-free'] as const;

const count = z.number().int().nonnegative();
const name = z.string().regex(/^[\w./:@-]{1,200}$/);
const kind = z.enum(['skill-needle', 'mcp-needle', 'plain']);
const invalidReason = z.enum(['rate-limit', 'provider-error', 'timeout', 'sandbox-failure', 'malformed-events']);
const toolStatus = z.enum(['completed', 'error']);
const tokensSchema = z.strictObject({ input: count, cacheRead: count, cacheWrite: count, output: count, reasoning: count });
export type B11Tokens = z.infer<typeof tokensSchema>;

export const taskSchema = z.strictObject({
  id: name, kind, prompt: z.string().min(1), workspace: z.string().min(1),
  check: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('files'), path: z.string().min(1), all: z.array(z.string()), none: z.array(z.string()) }),
    z.strictObject({ type: z.literal('node-test'), tests: z.string().min(1) }),
  ]),
  needs: z.strictObject({ skill: name.optional(), server: name.optional(), tool: name.optional() }),
});
export type B11Task = z.infer<typeof taskSchema>;

const rowSchema = z.strictObject({
  taskId: name, kind, split: z.enum(['dev', 'test']), model: name, arm: z.enum(ARMS), rep: count, orderIndex: count,
  startedAt: z.iso.datetime(), opencodeVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  steps: z.array(tokensSchema), totals: tokensSchema,
  toolCalls: z.array(z.strictObject({ name, status: toolStatus })), skillsLoaded: z.array(name),
  listing: z.strictObject({ skills: count, servers: count, tools: count }),
  result: z.enum(['pass', 'fail', 'invalid']), invalidReason: invalidReason.optional(),
  wallMs: z.number().nonnegative(), jev: z.strictObject({ calls: count, costUsd: z.number().nonnegative() }),
  selection: z.strictObject({ skills: z.array(name), servers: z.array(name) }).optional(),
});
export type B11Row = z.infer<typeof rowSchema>;

function sum(steps: B11Tokens[]): B11Tokens {
  const totals = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 };
  for (const step of steps) for (const key of Object.keys(totals) as (keyof B11Tokens)[]) totals[key] += step[key];
  return tokensSchema.parse(totals);
}

export function parseRow(value: unknown): B11Row {
  const row = rowSchema.parse(value);
  if ((row.result === 'invalid') !== (row.invalidReason !== undefined)) throw new Error('Invalid result classification');
  if (row.result !== 'invalid' && row.steps.length === 0) throw new Error('Missing session usage');
  if ((row.arm === 'preselect') !== (row.selection !== undefined)) throw new Error('Invalid selection classification');
  const totals = sum(row.steps);
  if (Object.keys(totals).some((key) => totals[key as keyof B11Tokens] !== row.totals[key as keyof B11Tokens])) {
    throw new Error('Inconsistent session totals');
  }
  return row;
}

const eventSchema = z.object({ type: z.string() });
const stepSchema = z.object({ part: z.object({ tokens: z.object({
  total: count, input: count, output: count, reasoning: count, cache: z.object({ read: count, write: count }),
}) }) });
const toolSchema = z.object({ part: z.object({ tool: name, state: z.object({ status: toolStatus, input: z.unknown().optional() }) }) });
const errorSchema = z.object({ error: z.object({
  name: z.string().optional(), message: z.string().optional(),
  data: z.object({ statusCode: z.number().optional(), message: z.string().optional() }).optional(),
}) });

export interface B11Events {
  steps: B11Tokens[];
  totals: B11Tokens;
  toolCalls: B11Row['toolCalls'];
  skillsLoaded: string[];
  invalidReason?: z.infer<typeof invalidReason>;
}

export function parseEvents(text: string): B11Events {
  const steps: B11Tokens[] = [], toolCalls: B11Row['toolCalls'] = [], skillsLoaded = new Set<string>();
  let reason: B11Events['invalidReason'], starts = 0;
  try {
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const value: unknown = JSON.parse(line);
      const event = eventSchema.parse(value);
      if (event.type === 'step_start') starts++;
      if (event.type === 'step_finish') {
        const { tokens } = stepSchema.parse(value).part;
        // This equation held in the free-model probe (cache writes were zero); fail if the contract changes.
        if (tokens.total !== tokens.input + tokens.output + tokens.reasoning + tokens.cache.read) throw new Error();
        steps.push({ input: tokens.input, cacheRead: tokens.cache.read, cacheWrite: tokens.cache.write, output: tokens.output, reasoning: tokens.reasoning });
      }
      if (event.type === 'tool_use') {
        const { tool, state } = toolSchema.parse(value).part;
        toolCalls.push({ name: tool, status: state.status });
        if (state.status === 'completed' && (tool === 'skill' || /(?:^|_)load_skill$/.test(tool))) {
          const loaded = tool === 'skill' ? z.object({ name }).parse(state.input).name : z.object({ skill: name }).parse(state.input).skill;
          skillsLoaded.add(loaded);
        }
      }
      if (event.type === 'error') {
        const { error } = errorSchema.parse(value);
        const message = error.data?.message ?? error.message ?? '';
        const category = error.data?.statusCode === 429 || /rate.?limit|too many requests/i.test(message) ? 'rate-limit' : 'provider-error';
        if (reason !== 'rate-limit') reason = category;
      }
    }
    if (!reason && (steps.length === 0 || starts > steps.length)) throw new Error();
    return { steps, totals: sum(steps), toolCalls, skillsLoaded: [...skillsLoaded], ...(reason ? { invalidReason: reason } : {}) };
  } catch {
    // JSON/Zod diagnostics can contain provider output or tool arguments.
    throw new Error('malformed-events');
  }
}
