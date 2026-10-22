import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isUsageLimit, parseEvents, parseRow, taskSchema, type B11Row } from '../bench/b11-types.js';

// OpenCode 1.19.3 pilot row orderIndex 2, first request. All non-counter fields removed.
const recorded = readFileSync(new URL('./fixtures/b11-events.jsonl', import.meta.url), 'utf8');
const event = (tokens: unknown) => JSON.stringify({ type: 'step_finish', part: { tokens } });
const tokens = { total: 36, input: 10, cache: { read: 20, write: 2 }, output: 3, reasoning: 1 };
const jsonl = (...events: unknown[]) => events.map((value) => JSON.stringify(value)).join('\n');
function row(): B11Row {
  return { taskId: 'b11-plain-01', kind: 'plain', split: 'test', model: 'opencode/glm-5.3-flash-free', arm: 'bare', rep: 0,
    orderIndex: 0, startedAt: '2026-10-22T10:00:00.000Z', opencodeVersion: '1.19.3',
    steps: [{ input: 10, cacheRead: 20, cacheWrite: 2, output: 3, reasoning: 1 }],
    totals: { input: 10, cacheRead: 20, cacheWrite: 2, output: 3, reasoning: 1 },
    toolCalls: [], skillsLoaded: [], listing: { skills: 0, servers: 0, tools: 0 }, result: 'pass', wallMs: 100, jev: { calls: 0, costUsd: 0 } };
}

describe('B11 event projection', () => {
  it.each([
    ['free usage limit', true], ['Provider: FREE USAGE LIMIT reached.', true],
    ['free daily usage limit', false], ['free usage limitation', false], ['notfree usage limit', false],
    ['free usage limits', false], ['rate limit exceeded', false],
  ])('recognizes only the observed persistent usage-cap marker (%s)', (message, expected) => {
    expect(isUsageLimit(message)).toBe(expected);
  });
  it('projects a typed API usage-cap error without retaining provider diagnostics', () => {
    const parsed = parseEvents(jsonl({ type: 'error', error: { name: 'APIError', data: { statusCode: 429, message: 'free usage limit PRIVATE PROVIDER DATA' } } }));
    expect(parsed).toEqual({ steps: [], totals: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }, toolCalls: [], skillsLoaded: [], invalidReason: 'usage-limit' });
    expect(JSON.stringify(parsed)).not.toContain('PRIVATE');
  });
  it('preserves completed counters when stderr reports a usage cap before any CLI error event', () => {
    const parsed = parseEvents(recorded + '\n' + JSON.stringify({ type: 'step_start' }), 'usage-limit');
    expect(parsed.steps).toEqual([{ input: 6657, cacheRead: 0, cacheWrite: 0, output: 26, reasoning: 15 }]);
    expect(parsed.invalidReason).toBe('usage-limit');
    expect(parseEvents('', 'usage-limit').invalidReason).toBe('usage-limit');
  });
  it.each([
    { name: 'APIError', data: { statusCode: 429, message: 'PRIVATE rate limit' } },
    { name: 'ContextOverflowError', data: { message: 'PRIVATE context limit' } },
    { name: 'AI_RetryError', message: 'PRIVATE failed after three attempts' },
  ])('keeps usage-cap classification stronger than other errors in either order (%#)', (other) => {
    const usage = { type: 'error', error: { name: 'AI_APICallError', message: 'FREE USAGE LIMIT PRIVATE' } };
    for (const events of [[usage, { type: 'error', error: other }], [{ type: 'error', error: other }, usage]]) {
      const parsed = parseEvents(jsonl(...events));
      expect(parsed.invalidReason).toBe('usage-limit');
      expect(JSON.stringify(parsed)).not.toContain('PRIVATE');
    }
  });
  it('accepts optional scrubbed timing and rejects mismatched or negative durations', () => {
    const value = row();
    value.latency = { startupMs: 20, stepsMs: [50] };
    expect(() => parseRow({ ...value, timeoutMs: -1 })).toThrow();
    expect(parseRow({ ...value, timeoutMs: 1200000 }).timeoutMs).toBe(1200000);
    expect(parseRow(value).latency).toEqual(value.latency);
    expect(() => parseRow({ ...value, latency: { startupMs: 20, stepsMs: [] } })).toThrow('timings');
    expect(() => parseRow({ ...value, latency: { startupMs: -1, stepsMs: [50] } })).toThrow();
    expect(() => parseRow({ ...value, latency: { startupMs: null, stepsMs: [-1] } })).toThrow();
    expect(parseRow({ ...value, latency: { startupMs: null, stepsMs: [null] } }).latency?.stepsMs).toEqual([null]);
  });
  it('reads recorded counters and sums uncached and cached input separately', () => {
    expect(parseEvents(recorded + '\n' + event(tokens))).toEqual({
      steps: [{ input: 6657, cacheRead: 0, cacheWrite: 0, output: 26, reasoning: 15 },
        { input: 10, cacheRead: 20, cacheWrite: 2, output: 3, reasoning: 1 }],
      totals: { input: 6667, cacheRead: 20, cacheWrite: 2, output: 29, reasoning: 16 }, toolCalls: [], skillsLoaded: [],
    });
  });
  it('retains tool names/status and successful skill names without arguments, outputs, or text', () => {
    const parsed = parseEvents(recorded + '\n' + jsonl(
      { type: 'text', part: { text: 'PRIVATE TRANSCRIPT' } },
      { type: 'tool_use', part: { tool: 'skill', state: { status: 'completed', input: { name: 'needle', extra: 'PRIVATE ARG' }, output: 'PRIVATE OUTPUT' } } },
      { type: 'tool_use', part: { tool: 'loadout_load_skill', state: { status: 'completed', input: { skill: 'gateway-needle' }, output: 'PRIVATE' } } },
      { type: 'tool_use', part: { tool: 'skill', state: { status: 'error', input: { name: 'missing' }, error: 'PRIVATE ERROR' } } },
      { type: 'tool_use', part: { tool: 'read', state: { status: 'completed', input: { name: 'not-a-skill' }, output: 'PRIVATE' } } },
    ));
    expect(parsed.toolCalls).toEqual([{ name: 'skill', status: 'completed' }, { name: 'loadout_load_skill', status: 'completed' }, { name: 'skill', status: 'error' }, { name: 'read', status: 'completed' }]);
    expect(parsed.skillsLoaded).toEqual(['needle', 'gateway-needle']);
    expect(JSON.stringify(parsed)).not.toContain('PRIVATE');
  });
  it.each([
    '{PRIVATE', '{}', 'null', JSON.stringify({ type: 'step_finish' }), event({ ...tokens, input: undefined }),
    event({ ...tokens, input: -1 }), event({ ...tokens, input: 1.5 }), event({ ...tokens, input: '10' }),
    event({ ...tokens, cache: { read: 20 } }), event({ ...tokens, total: 34 }), event({ ...tokens, total: null }),
    event({ ...tokens, reasoning: -1 }), event({ ...tokens, cache: { read: 20, write: -1 } }),
    JSON.stringify({ type: 'tool_use', part: { tool: 'read', state: { status: 'unexpected' } } }),
    JSON.stringify({ type: 'tool_use', part: { tool: 'read PRIVATE TEXT', state: { status: 'completed' } } }),
    JSON.stringify({ type: 'tool_use', part: { tool: 'skill', state: { status: 'completed', input: { name: 'PRIVATE TEXT' } } } }),
    JSON.stringify({ type: 'tool_use', part: { tool: 'loadout_load_skill', state: { status: 'completed', input: { name: 'wrong-field' } } } }),
    JSON.stringify({ type: 'tool_use', part: { tool: 'read', state: { status: 'running' } } }),
    event({ ...tokens, input: Number.MAX_SAFE_INTEGER + 1 }),
  ])('rejects malformed telemetry without printing its content (%#)', (text) => {
    expect(() => parseEvents(recorded + '\n' + text)).toThrow('malformed-events');
    try { parseEvents(recorded + '\n' + text); } catch (error) { expect(String(error)).not.toContain('PRIVATE'); }
  });
  it('keeps context-limit errors explicit and scrubbed, with rate limits taking precedence', () => {
    for (const error of [{ name: 'ContextOverflowError', data: { message: 'PRIVATE' } }, { message: 'maximum context length exceeded PRIVATE' }]) {
      const parsed = parseEvents(jsonl({ type: 'error', error }, { type: 'error', error: { message: 'PRIVATE' } }));
      expect(parsed.invalidReason).toBe('context-limit');
      expect(JSON.stringify(parsed)).not.toContain('PRIVATE');
    }
    const parsed = parseEvents(jsonl({ type: 'error', error: { data: { statusCode: 429 } } }, { type: 'error', error: { name: 'ContextOverflowError' } }));
    expect(parsed.invalidReason).toBe('rate-limit');
  });
  it('rejects a session with no completed model usage', () => {
    expect(() => parseEvents('')).toThrow('malformed-events');
    expect(() => parseEvents(JSON.stringify({ type: 'text', part: { text: 'PRIVATE' } }))).toThrow('malformed-events');
  });
  it('rejects an unfinished final model request rather than undercounting it', () => {
    expect(() => parseEvents(recorded + '\n' + JSON.stringify({ type: 'step_start' }))).toThrow('malformed-events');
  });
  it('preserves completed usage from a timed-out session without treating it as quality evidence', () => {
    const parsed = parseEvents(recorded + '\n' + JSON.stringify({ type: 'step_start' }), 'timeout');
    expect(parsed.steps).toHaveLength(1);
    expect(parsed.invalidReason).toBe('timeout');
  });
  it('rejects an overflowing aggregate rather than rounding token totals', () => {
    const huge = event({ total: Number.MAX_SAFE_INTEGER, input: Number.MAX_SAFE_INTEGER, output: 0, reasoning: 0, cache: { read: 0, write: 0 } });
    expect(() => parseEvents(huge + '\n' + huge)).toThrow('malformed-events');
  });
  it.each([[429, 'rate-limit'], [500, 'provider-error']])('classifies HTTP %i without retaining provider diagnostics', (statusCode, expected) => {
    const parsed = parseEvents(jsonl({ type: 'error', error: { name: 'APIError', data: { statusCode, message: 'PRIVATE KEY' } } }));
    expect(parsed.invalidReason).toBe(expected);
    expect(parsed.steps).toEqual([]);
    expect(JSON.stringify(parsed)).not.toContain('PRIVATE');
  });
  it('keeps the rate-limit classification when a subsequent generic error arrives', () => {
    const parsed = parseEvents(jsonl(
      { type: 'error', error: { data: { message: 'Too many requests: PRIVATE' } } },
      { type: 'error', error: { message: 'PRIVATE provider failed' } },
    ));
    expect(parsed.invalidReason).toBe('rate-limit');
  });
});

describe('B11 persisted rows', () => {
  it('accepts a complete row and a counters-only invalid attempt', () => {
    expect(parseRow(row())).toEqual(row());
    const invalid = { ...row(), steps: [], totals: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }, result: 'invalid', invalidReason: 'timeout' };
    expect(parseRow(invalid).result).toBe('invalid');
  });
  it('accepts a counters-only usage-cap attempt as invalid rather than a quality failure', () => {
    const invalid = { ...row(), steps: [], totals: { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }, result: 'invalid', invalidReason: 'usage-limit' };
    expect(parseRow(invalid).invalidReason).toBe('usage-limit');
    expect(() => parseRow({ ...invalid, result: 'fail' })).toThrow('classification');
  });
  it.each([
    (r: any) => { r.transcript = 'PRIVATE'; },
    (r: any) => { r.toolCalls = [{ name: 'read', status: 'completed', input: 'PRIVATE' }]; },
    (r: any) => { r.steps[0].prompt = 'PRIVATE'; },
    (r: any) => { r.jev.key = 'PRIVATE'; },
    (r: any) => { r.jev.costUsd = -1; },
    (r: any) => { r.listing.prompt = 'PRIVATE'; },
    (r: any) => { r.listing.skills = -1; },
    (r: any) => { r.totals.input = 11; },
    (r: any) => { r.totals.cacheRead = 21; },
    (r: any) => { r.totals.cacheWrite = 3; },
    (r: any) => { r.totals.output = 4; },
    (r: any) => { r.totals.reasoning = 2; },
    (r: any) => { r.steps = []; r.totals = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 }; },
    (r: any) => { r.result = 'invalid'; },
    (r: any) => { r.invalidReason = 'timeout'; },
    (r: any) => { r.result = 'invalid'; r.invalidReason = 'PRIVATE PROVIDER ERROR'; },
    (r: any) => { r.wallMs = -1; },
    (r: any) => { r.steps[0].input = Number.MAX_SAFE_INTEGER + 1; },
    (r: any) => { r.skillsLoaded = ['bad name']; },
    (r: any) => { r.skillsLoaded = ['x'.repeat(201)]; },
    (r: any) => { r.split = 'validation'; },
    (r: any) => { r.arm = 'unsupported'; },
    (r: any) => { r.startedAt = 'today'; },
    (r: any) => { r.opencodeVersion = 'unknown'; },
  ])('rejects transcript fields, inconsistent counters and invalid classifications (%#)', (mutate) => {
    const value = row(); mutate(value);
    expect(() => parseRow(value)).toThrow();
  });
  it('requires selection exactly for preselect rows', () => {
    expect(() => parseRow({ ...row(), arm: 'preselect' })).toThrow();
    expect(parseRow({ ...row(), arm: 'preselect', selection: { skills: ['needle'], servers: ['tracker'] } }).selection).toEqual({ skills: ['needle'], servers: ['tracker'] });
    expect(() => parseRow({ ...row(), selection: { skills: [], servers: [] } })).toThrow();
    expect(() => parseRow({ ...row(), arm: 'preselect', selection: { skills: [], servers: [], transcript: 'PRIVATE' } })).toThrow();
  });
  it('records the requested heavy-max configuration separately from the actual listing', () => {
    const heavy = { ...row(), arm: 'heavy-max', heavyConfig: { skills: 250, servers: 5 }, listing: { skills: 274, servers: 20, tools: 509 } };
    expect(parseRow(heavy).heavyConfig).toEqual({ skills: 250, servers: 5 });
    expect(parseRow(heavy).listing).toEqual({ skills: 274, servers: 20, tools: 509 });
    expect(parseRow({ ...heavy, heavyConfig: { skills: 500, servers: 10 } }).heavyConfig).toEqual({ skills: 500, servers: 10 });
  });
  it('requires heavy-max configuration exactly for heavy-max rows', () => {
    expect(() => parseRow({ ...row(), arm: 'heavy-max' })).toThrow();
    expect(() => parseRow({ ...row(), heavyConfig: { skills: 250, servers: 5 } })).toThrow();
    expect(() => parseRow({ ...row(), arm: 'heavy-max', result: 'invalid', invalidReason: 'timeout' })).toThrow();
  });
  it.each([
    { skills: 0, servers: 5 }, { skills: -1, servers: 5 }, { skills: 2.5, servers: 5 },
    { skills: 250, servers: 0 }, { skills: 250, servers: -1 }, { skills: 250, servers: 2.5 }, { skills: 250, servers: 21 },
    { skills: 250 }, { servers: 5 }, { skills: 250, servers: 5, transcript: 'PRIVATE' },
  ])('rejects an unsupported or transcript-bearing heavy configuration (%#)', (heavyConfig) => {
    expect(() => parseRow({ ...row(), arm: 'heavy-max', heavyConfig })).toThrow();
  });
});

describe('B11 task contract', () => {
  const task = { id: 'b11-plain-01', kind: 'plain', prompt: 'Write the output file.', workspace: 'plain-01', check: { type: 'files', path: 'answer.txt', all: ['yes'], none: ['no'] }, needs: {} };
  it('accepts both file and hidden node test tasks without inventing a stored split', () => {
    expect(taskSchema.parse(task)).toEqual(task);
    expect(taskSchema.parse({ ...task, kind: 'skill-needle', check: { type: 'node-test', tests: 'skill-01' }, needs: { skill: 'needle' } }).check.type).toBe('node-test');
  });
  it.each([
    { ...task, split: 'test' }, { ...task, kind: 'other' }, { ...task, prompt: '' },
    { ...task, workspace: '' },
    { ...task, check: { type: 'files', path: '', all: ['yes'], none: [] } },
    { ...task, check: { type: 'node-test', tests: '' } },
    { ...task, check: { type: 'files', path: 'answer.txt', all: ['yes'] } },
    { ...task, check: { type: 'files', path: 'answer.txt', all: [], none: [], command: 'PRIVATE' } },
    { ...task, check: { type: 'node-test', tests: 'plain-01', command: 'PRIVATE' } },
    { ...task, needs: { secret: 'PRIVATE' } },
  ])('rejects out-of-contract tasks (%#)', (value) => expect(() => taskSchema.parse(value)).toThrow());
});
