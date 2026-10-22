import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import type { B11Row } from '../bench/b11-types.js';
import { PRICE_SHEETS, pricedUsage, reportFiles, renderReport, sizeSweep, summarizeRows } from '../bench/b11-report.js';

const temps: string[] = [];
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'loadout-b11-report-')); temps.push(dir); return dir; };
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const tokens = (input = 100, cacheRead = 900) => ({ input, cacheRead, cacheWrite: 0, output: 20, reasoning: 5 });
const row = (overrides: Partial<B11Row> = {}): B11Row => ({
  taskId: 'b11-report-task', kind: 'plain', split: 'test', model: 'opencode/glm-5.3-flash-free',
  arm: 'bare', rep: 0, orderIndex: 0, startedAt: '2026-10-22T00:00:00.000Z', opencodeVersion: '1.19.3',
  steps: [tokens()], totals: tokens(), toolCalls: [], skillsLoaded: [], result: 'pass', wallMs: 100,
  jev: { calls: 0, costUsd: 0 }, listing: { skills: 0, servers: 0, tools: 0 }, ...overrides,
});

describe('B11 report math', () => {
  it('counts valid completion per attempt, with 90% inclusive and timeouts outside quality failures', () => {
    const rows = Array.from({ length: 10 }, (_, rep) => row({ rep, result: rep < 8 ? 'pass' : rep === 8 ? 'fail' : 'invalid', ...(rep === 9 ? { invalidReason: 'timeout' as const } : {}) }));
    expect(summarizeRows(rows)[0]).toMatchObject({ attempts: 10, valid: 9, pass: 8, fail: 1, invalid: 1, completionRate: 0.9, belowCompletionThreshold: false });
    const retry = row({ result: 'invalid', invalidReason: 'timeout' });
    expect(summarizeRows([retry, retry, row()])[0]).toMatchObject({ attempts: 3, valid: 1, fail: 0, completionRate: 1 / 3, belowCompletionThreshold: true });
    expect(summarizeRows([retry])[0]).toMatchObject({ attempts: 1, valid: 0, pass: 0, fail: 0, completionRate: 0, belowCompletionThreshold: true });
  });

  it('reports Wilson 95% intervals for valid outcomes and leaves all-invalid quality undefined', () => {
    const rows = Array.from({ length: 10 }, (_, rep) => row({ rep, result: rep < 5 ? 'pass' : 'fail' }));
    const [group] = summarizeRows(rows);
    expect(group).toMatchObject({ pass: 5, fail: 5, invalid: 0, successInterval: '24–76%' });
    expect(summarizeRows([row({ result: 'invalid', invalidReason: 'timeout', steps: [], totals: tokens(0, 0) })])[0])
      .toMatchObject({ pass: 0, fail: 0, invalid: 1, successInterval: 'not shown' });
  });

  it('keeps test/dev and models/arms separate, including invalid attempts without counting them as failures', () => {
    const invalid = row({ result: 'invalid', invalidReason: 'rate-limit', totals: tokens(50000, 0), steps: [tokens(50000, 0)], jev: { calls: 1, costUsd: 0.001 } });
    const groups = summarizeRows([
      invalid, row(), row({ rep: 1, result: 'fail' }), row({ split: 'dev', taskId: 'b11-dev' }),
      row({ model: 'opencode/deepseek-v4.1-flash-free' }), row({ arm: 'all' }),
    ]);
    expect(groups).toHaveLength(4);
    const test = groups.find((g) => g.split === 'test' && g.arm === 'bare' && g.model.includes('glm'))!;
    expect(test).toMatchObject({ pass: 1, fail: 1, invalid: 1, totals: { input: 200, cacheRead: 1800 }, steps: 2, jev: { calls: 1, costUsd: 0.001 } });
    expect(test.cache).toEqual([{ step: 1, requests: 2, input: 200, cacheRead: 1800, cacheWrite: 0, hitRatio: 0.9 }]);
  });

  it('rejects duplicate completed sessions while retaining multiple invalid retries', () => {
    expect(() => summarizeRows([row(), row({ result: 'fail' })])).toThrow(/duplicate valid session/i);
    expect(summarizeRows([row({ result: 'invalid', invalidReason: 'timeout' }), row({ result: 'invalid', invalidReason: 'timeout' }), row()])[0])
      .toMatchObject({ pass: 1, invalid: 2 });
  });

  it('computes each request cache ratio from pooled input, read and write counters, separating the first request', () => {
    const first = tokens(100, 900), next = { ...tokens(200, 600), cacheWrite: 200 };
    const group = summarizeRows([row({ steps: [first, next], totals: { input: 300, cacheRead: 1500, cacheWrite: 200, output: 40, reasoning: 10 } })])[0]!;
    expect(group.cache).toEqual([
      { step: 1, requests: 1, input: 100, cacheRead: 900, cacheWrite: 0, hitRatio: 0.9 },
      { step: 2, requests: 1, input: 200, cacheRead: 600, cacheWrite: 200, hitRatio: 0.6 },
    ]);
    expect(summarizeRows([row({ steps: [tokens(0, 0)] })])[0]!.cache[0]!.hitRatio).toBeNull();
  });

  it('pins official named rate sheets and prices cache writes and reasoning without losing counters', () => {
    expect(PRICE_SHEETS.map((p) => p.id)).toEqual(['deepseek-flash-off-peak', 'deepseek-flash-peak', 'glm-5.3-flash', 'claude-sonnet-5.5-5m', 'gpt-6.1-sol-30m']);
    for (const sheet of PRICE_SHEETS) {
      expect(sheet.source).toMatch(/^https:\/\/(api-docs\.deepseek\.com|docs\.z\.ai|platform\.claude\.com|developers\.openai\.com)\//);
      expect(sheet.retrieved).toBe('2026-10-22');
    }
    const usage = { input: 100, cacheRead: 1000, cacheWrite: 20, output: 30, reasoning: 10 };
    expect(pricedUsage(usage, PRICE_SHEETS[0]!).weightedInput).toBe(140);
    expect(pricedUsage(usage, PRICE_SHEETS[0]!).inputUsd).toBeCloseTo(0.000021, 12);
    expect(pricedUsage(usage, PRICE_SHEETS[0]!).outputUsd).toBeCloseTo(0.000024, 12);
    expect(pricedUsage(usage, PRICE_SHEETS[0]!).totalUsd).toBeCloseTo(0.000045, 12);
    expect(pricedUsage(usage, PRICE_SHEETS[2]!).weightedInput).toBe(320);
    expect(pricedUsage(usage, PRICE_SHEETS[3]!).weightedInput).toBe(175);
    expect(pricedUsage(usage, PRICE_SHEETS[4]!).weightedInput).toBe(175);
  });
});

describe('B11 event-arrival timing', () => {
  it('aggregates known startup and per-step samples from valid and invalid attempts without zero-filling unknowns', () => {
    const twoSteps = [tokens(), tokens()];
    const totals = { input: 200, cacheRead: 1800, cacheWrite: 0, output: 40, reasoning: 10 };
    const summary = summarizeRows([
      row({ steps: twoSteps, totals, wallMs: 1000, latency: { startupMs: 0, stepsMs: [10, null] } }),
      row({ rep: 1, result: 'fail', steps: twoSteps, totals, wallMs: 2000, latency: { startupMs: 100, stepsMs: [30, 50] } }),
      row({ rep: 2, result: 'invalid', invalidReason: 'timeout', wallMs: 9000, latency: { startupMs: 200, stepsMs: [20] } }),
      row({ rep: 3, wallMs: 4000 }),
    ])[0]!;
    expect(summary.timing).toEqual({
      wall: { samples: 4, meanMs: 4000, medianMs: 3000, maxMs: 9000 },
      startup: { samples: 3, meanMs: 100, medianMs: 100, maxMs: 200 },
      steps: [{ step: 1, samples: 3, meanMs: 20, medianMs: 20, maxMs: 30 }, { step: 2, samples: 1, meanMs: 50, medianMs: 50, maxMs: 50 }],
    });
  });

  it('leaves historical and explicitly unknown timing unmeasured, and retains real zero durations', () => {
    const unknown = summarizeRows([row(), row({ rep: 1, latency: { startupMs: null, stepsMs: [null] } })])[0]!;
    expect(unknown.timing).toEqual({ wall: { samples: 2, meanMs: 100, medianMs: 100, maxMs: 100 }, startup: { samples: 0, meanMs: null, medianMs: null, maxMs: null }, steps: [{ step: 1, samples: 0, meanMs: null, medianMs: null, maxMs: null }] });
    expect(summarizeRows([row({ latency: { startupMs: 0, stepsMs: [0] } })])[0]!.timing)
      .toEqual({ wall: { samples: 1, meanMs: 100, medianMs: 100, maxMs: 100 }, startup: { samples: 1, meanMs: 0, medianMs: 0, maxMs: 0 }, steps: [{ step: 1, samples: 1, meanMs: 0, medianMs: 0, maxMs: 0 }] });
    const report = renderReport([row()]);
    expect(report).toContain('| Startup | 0 | not shown | not shown |');
    expect(report).toContain('| Step 1 | 0 | not shown | not shown |');
    expect(report).toContain('event-arrival');
    expect(report).toContain('first step_start');
    expect(report).toContain('not proof of MCP discovery');
    expect(report).toContain('unfinished');
    const invalid = renderReport([row({ result: 'invalid', invalidReason: 'timeout', wallMs: 9000, latency: { startupMs: 25, stepsMs: [10] } })]);
    expect(invalid).toContain('| Session wall | 1 | 9000.00 | 9000.00 | 9000.00 |');
    expect(invalid).toContain('| Step 1 | 1 | 10.00 | 10.00 | 10.00 |');
  });
});

describe('B11 size sweep', () => {
  const sweep = () => [
    row({ arm: 'gateway', totals: tokens(100, 0) }),
    row({ arm: 'gateway', rep: 1, totals: tokens(200, 0) }),
    ...([50, 250] as const).flatMap((size) => [0, 1].map((rep) => row({ arm: `skills-${size}`, rep, listing: { skills: size + 3, servers: 0, tools: 0 }, totals: tokens(size, 0) }))),
  ];

  it('does not infer a size sweep from a single measured listing size', () => {
    const oneSize = [row({ arm: 'gateway' }), row({ arm: 'mcp-all', listing: { skills: 0, servers: 20, tools: 488 } })];
    expect(sizeSweep(oneSize, PRICE_SHEETS[0]!)).toEqual([]);
    expect(sizeSweep([...oneSize, row({ arm: 'mcp-5', listing: { skills: 0, servers: 20, tools: 488 } })], PRICE_SHEETS[0]!)).toEqual([]);
  });

  it('compares matching task/repetition sets and uses recorded listing sizes with horizontal gateway bounds', () => {
    const points = sizeSweep([...sweep(), row({ taskId: 'unpaired', arm: 'skills-50', listing: { skills: 53, servers: 0, tools: 0 }, totals: tokens(1000000, 0) })], PRICE_SHEETS[0]!);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ family: 'skills', pairs: 2, breakEvenSize: 253, points: [{ size: 53 }, { size: 253 }] });
    expect(points[0]!.gateway.low).toBeLessThan(points[0]!.gateway.mean);
    expect(points[0]!.gateway.high).toBeGreaterThan(points[0]!.gateway.mean);
  });

  it('requires a common panel for actual listing sizes even when inventory varies within an arm', () => {
    const rows = sweep().map((r) => r.arm === 'skills-50' && r.rep === 1 ? { ...r, listing: { skills: 54, servers: 0, tools: 0 } } : r);
    expect(sizeSweep(rows, PRICE_SHEETS[0]!)).toEqual([]);
  });

  it('renders measured cost points and constant gateway mean/bounds in the exported report', () => {
    const report = renderReport(sweep());
    expect(report).toContain('x-axis "Skills" [53, 253]');
    expect(report).toContain('line [0.000022500, 0.000052500]');
    expect(report).toContain('line [0.000037500, 0.000037500]');
    expect(report).toContain('line [0.000030000, 0.000030000]');
    expect(report).toContain('line [0.000045000, 0.000045000]');
    expect(report).toContain('First measured size at/above gateway: 253');
    expect(report).toContain('not a confidence interval');
    expect(report.endsWith('\n')).toBe(true);
    expect(report.endsWith('\n\n')).toBe(false);
    const devReport = renderReport(sweep().map(r => ({ ...r, split: 'dev' as const })));
    expect(devReport.endsWith('\n\n')).toBe(false);
  });

  it('does not invent break-even evidence when gateway or shared tasks are absent', () => {
    expect(sizeSweep(sweep().filter((r) => r.arm !== 'gateway'), PRICE_SHEETS[0]!)).toEqual([]);
    expect(sizeSweep([row({ arm: 'gateway' })], PRICE_SHEETS[0]!)).toEqual([]);
    expect(sizeSweep(sweep().map((r) => r.arm === 'gateway' ? { ...r, taskId: 'other' } : r), PRICE_SHEETS[0]!)).toEqual([]);
    expect(sizeSweep(sweep().map((r) => r.arm === 'gateway' ? { ...r, totals: tokens(10000, 0) } : r), PRICE_SHEETS[0]!)[0]!.breakEvenSize).toBeNull();
  });

  it('includes actual Jev cost in session comparisons and keeps MCP listing units distinct', () => {
    const points = sizeSweep([
      row({ arm: 'gateway', totals: tokens(0, 0), jev: { calls: 1, costUsd: 0.1 } }),
      row({ arm: 'mcp-1', listing: { skills: 0, servers: 1, tools: 11 }, totals: tokens(1000, 0) }),
      row({ arm: 'mcp-5', listing: { skills: 0, servers: 5, tools: 111 }, totals: tokens(2000, 0) }),
    ], PRICE_SHEETS[0]!);
    expect(points[0]).toMatchObject({ family: 'mcp', breakEvenSize: null, points: [{ size: 11 }, { size: 111 }] });
    expect(points[0]!.gateway.mean).toBeGreaterThan(0.1);
  });
});

describe('B11 report input/output', () => {
  it('shows pooled operational completion and separate split flags, including unusable arms and survivor-bias caveats', () => {
    const rows = [
      ...Array.from({ length: 9 }, (_, rep) => row({ rep })),
      row({ rep: 9, result: 'invalid', invalidReason: 'timeout' }),
      row({ arm: 'all', result: 'invalid', invalidReason: 'timeout' }),
      row({ arm: 'all', model: 'opencode/deepseek-v4.1-flash-free', split: 'dev', taskId: 'dev-task' }),
    ];
    const report = renderReport(rows);
    const pooled = report.split('## Price snapshots')[0]!;
    expect(pooled).toContain('| bare | 9 | 10 | 90.00% | at least 90% |');
    expect(pooled).toContain('| all | 1 | 2 | 50.00% | UNDER 90% |');
    const test = report.split('## Test split')[1]!.split('## Dev split')[0]!;
    expect(test).toContain('| all | 0 | 0 | 1 | 0.00% | UNDER 90%: not usable in observed attempts |');
    expect(test).toContain('survivor bias');
    expect(test).toContain('quality and cost');
    expect(report).toContain('Timeouts are invalid attempts, never quality failures');
    expect(report).toContain('retries remain separate attempts');
  });

  it('renders independent test/dev sections, first/later cache tables, official sources and hypothetical cost labels', () => {
    const report = renderReport([row(), row({ split: 'dev', taskId: 'dev-task', result: 'fail' })]);
    expect(report).toContain('## Test split');
    expect(report).toContain('## Dev split');
    expect(report).toContain('Wilson 95%');
    expect(report).toContain('first / cross-session');
    expect(report).toContain('Hypothetical');
    expect(report).toContain('tokenizers');
    expect(report).toContain('not shown');
    expect(report).toContain('https://docs.z.ai/guides/overview/pricing');
    expect(report).toContain('2026-10-22');
  });

  it('does not render raw metadata as Markdown or HTML instructions', () => {
    const report = renderReport([row({ model: '<script>\n```\n| bad &entity;' })]);
    expect(report).not.toContain('<script>');
    expect(report).not.toContain('\n```\n');
    expect(report).toContain('&lt;script&gt; &#96;&#96;&#96; &#124; bad &amp;entity;');
    expect(report).toContain('## Dev split\n\nnot shown: no rows.');
  });

  it('rejects empty input and malformed rows with line numbers without echoing raw contents', () => {
    const dir = temp(), path = join(dir, 'rows.jsonl');
    expect(() => reportFiles([])).toThrow(/usage/i);
    writeFileSync(path, '\n');
    expect(() => reportFiles([path])).toThrow(/no rows/i);
    for (const content of ['{SECRET-CANARY', JSON.stringify({ taskId: 'SECRET-CANARY' })]) {
      writeFileSync(path, '\n' + content);
      let message = '';
      try { reportFiles([path]); } catch (error) { message = (error as Error).message; }
      expect(message).toContain('line 2');
      expect(message).not.toContain('SECRET-CANARY');
    }
  });

  it('runs the real CLI offline against raw JSONL and emits reproducible Markdown', () => {
    const path = join(temp(), 'rows.jsonl');
    const timed = row({ latency: { startupMs: 12, stepsMs: [34] } });
    writeFileSync(path, JSON.stringify(timed) + '\n');
    const expected = reportFiles([path]);
    const result = spawnSync(process.execPath, ['--import', 'tsx', join(import.meta.dirname, '../bench/b11-report.ts'), path], { encoding: 'utf8', timeout: 30000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(expected);
    expect(result.stdout).toContain('| Startup | 1 | 12.00 | 12.00 |');
    expect(result.stdout).toContain('| Step 1 | 1 | 34.00 | 34.00 |');
    expect(readFileSync(path, 'utf8')).toBe(JSON.stringify(timed) + '\n');
  });
});
