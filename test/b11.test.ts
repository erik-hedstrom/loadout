import { describe, expect, it } from 'vitest';
import { blocks, rowKey, options, JevBudget } from '../bench/b11.js';
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
    for (const args of [['--concurrency', '0'], ['--arms', 'typo'], ['--models', 'paid/model'], ['--run', '--plan'], ['--jev-budget', '-1']]) expect(() => options(args)).toThrow();
    expect(options(['--run', '--resume']).resume).toBe(true);
  });
  it('resume keys distinguish task, model, arm and repetition', () => {
    const r = { taskId: 'a', model: 'm', arm: 'bare' as const, rep: 1 };
    expect(rowKey(r)).not.toBe(rowKey({ ...r, rep: 2 }));
  });
  it('reserves cost before Jev and refuses exhausted budgets without a call', async () => {
    const budget = new JevBudget(0, DEFAULT_CONFIG, { ask: async () => { throw new Error('must not call'); } });
    const meter = budget.meter();
    await expect(meter.client.ask({}, {})).rejects.toThrow('budget');
    expect(meter.usage.calls).toBe(0);
    expect(meter.failed).toBe(true);
  });
});
