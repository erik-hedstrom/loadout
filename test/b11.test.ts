import { describe, expect, it } from 'vitest';
import { blocks, rowKey, options, JevBudget, fixturePath, classifyRun, sweepTasks } from '../bench/b11.js';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG } from '../src/config.js';

describe('B11 study', () => {
  it('keeps each model/arm task batch together and rotates arms in later batches', () => {
    const tasks = Array.from({ length: 3 }, (_, i) => ({ id: `task-${i}` }));
    const result = blocks(tasks, ['m1', 'm2'], ['bare', 'all'], 2, 2);
    expect(result.slice(0, 2).map(b => [b.model, b.arm, b.tasks.map(t => t.id)])).toEqual([
      ['m1', 'bare', ['task-0', 'task-1']], ['m1', 'all', ['task-0', 'task-1']],
    ]);
    expect(result[4]?.arm).toBe('all');
    expect(result.map(b => b.tasks.length).reduce((a,b) => a+b, 0)).toBe(24);
  });
  it('requires explicit runs, supported free models, bounded counts and a Jev budget', () => {
    expect(options([]).run).toBe(false);
    for (const args of [['--concurrency', '0'], ['--arms', 'typo'], ['--models', 'paid/model'], ['--run', '--plan'], ['--jev-budget=-1']]) expect(() => options(args)).toThrow();
    expect(options(['--run', '--resume']).resume).toBe(true);
  });
  it('resume keys distinguish task, model, arm and repetition', () => {
    const r = { taskId: 'a', model: 'm', arm: 'bare' as const, rep: 1 };
    expect(rowKey(r)).not.toBe(rowKey({ ...r, rep: 2 }));
  });
  it('uses a fixed per-kind subset for size sweeps', () => {
    expect([...sweepTasks([{ kind: 'plain', id: 'p1' }, { kind: 'skill', id: 's1' }, { kind: 'plain', id: 'p2' }], 1)]).toEqual(['p1', 's1']);
  });
  it('confines dataset repository paths and short test-fixture paths to the same root', () => {
    const root = mkdtempSync(join(tmpdir(), 'b11-path-'));
    mkdirSync(join(root, 'workspaces'));
    try {
      expect(fixturePath(root, 'workspaces', 'bench/data/b11/workspaces/plain')).toBe(join(root, 'workspaces', 'plain'));
      expect(fixturePath(root, 'workspaces', 'plain')).toBe(join(root, 'workspaces', 'plain'));
      expect(() => fixturePath(root, 'workspaces', 'bench/data/b11/workspaces/../../outside')).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it('reserves cost before Jev and refuses exhausted budgets without a call', async () => {
    const budget = new JevBudget(0, DEFAULT_CONFIG, { ask: async () => { throw new Error('must not call'); } });
    const meter = budget.meter();
    await expect(meter.client.ask({}, {})).rejects.toThrow('budget');
    expect(meter.usage.calls).toBe(0);
    expect(meter.failed).toBe(true);
  });
  it('waits for pending Jev usage before the session can persist its ledger', async () => {
    const budget = new JevBudget(0.1, DEFAULT_CONFIG, { ask: async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return { model: 'fake', answers: {}, usage: { input_tokens: 100, output_tokens: 0 } };
    } });
    const meter = budget.meter();
    const call = meter.client.ask({}, {});
    await meter.settle();
    expect(meter.usage.calls).toBe(1);
    expect(meter.usage.costUsd).toBeCloseTo(100 / 1e6 * DEFAULT_CONFIG.jev.inputPricePerMTok, 10);
    expect(budget.spent).toBeCloseTo(meter.usage.costUsd, 10);
    await call;
  });
  it('classifies telemetry, timeout, sandbox and rate limits without confusing port numbers with HTTP status', () => {
    const stdout = JSON.stringify({ type: 'step_finish', part: { tokens: { total: 15, input: 5, cache: { read: 8, write: 0 }, output: 2, reasoning: 0 } } }) + '\n';
    const run = { stdout, stderr: 'connected http://127.0.0.1:42917', code: 0, timedOut: false };
    expect(classifyRun(run).invalidReason).toBeUndefined();
    expect(classifyRun({ ...run, stderr: 'HTTP status 429' }).invalidReason).toBe('rate-limit');
    expect(classifyRun({ ...run, timedOut: true }).invalidReason).toBe('timeout');
    expect(classifyRun({ ...run, timedOut: true }).events.steps).toHaveLength(1);
    expect(classifyRun({ ...run, stdout: '{bad}\n' }).invalidReason).toBe('malformed-events');
    expect(classifyRun({ ...run, stdout: '', stderr: 'bwrap: mount failed', code: 1 }).invalidReason).toBe('sandbox-failure');
    expect(classifyRun({ ...run, code: 1 }).invalidReason).toBe('provider-error');
    expect(classifyRun(run, true).invalidReason).toBe('provider-error');
  });
});
