import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as config from '../src/config.js';
import * as jev from '../src/jev.js';
import { main } from '../bench/b11.js';

describe.runIf(process.platform === 'linux')('B11 runner lifecycle without provider calls', () => {
  let root: string, data: string, binary: string, out: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'b11-lifecycle-')); data = join(root, 'data'); binary = join(root, 'fake-opencode'); out = join(root, 'out');
    mkdirSync(join(data, 'workspaces', 'plain'), { recursive: true });
    mkdirSync(join(data, 'checks'), { recursive: true });
    mkdirSync(join(data, 'skills', 'needle'), { recursive: true });
    writeFileSync(join(data, 'skills', 'needle', 'SKILL.md'), '---\nname: needle\ndescription: Synthetic formatting policy for a local output file.\n---\nWrite yes to answer.txt.');
    writeFileSync(binary, `#!/bin/sh
if [ "$1" = "--version" ]; then printf '1.19.3\\n'; exit 0; fi
case "$*" in *expects-token*) [ -f "$HOME/mcp-token" ] || exit 3;; *) [ ! -e "$HOME/mcp-token" ] || exit 3;; esac
case "$*" in *slow*) sleep 0.4;; esac
printf yes > answer.txt
printf '%s\\n' '{"type":"step_finish","part":{"tokens":{"total":12,"input":10,"output":2,"reasoning":0,"cache":{"read":0,"write":0}}}}'
`);
    chmodSync(binary, 0o700);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(config, 'loadConfig').mockReturnValue(config.DEFAULT_CONFIG);
    vi.spyOn(config.paths, 'library').mockReturnValue(join(root, 'empty-library'));
    vi.spyOn(config, 'resolveApiKey').mockReturnValue('synthetic-test-key');
    vi.spyOn(jev, 'jevClient').mockReturnValue({ ask: async () => { throw new Error('fake provider unavailable'); } });
  });
  afterEach(() => { vi.restoreAllMocks(); rmSync(root, { recursive: true, force: true }); });
  const task = (id: string, prompt = 'Write answer.txt using the formatting policy.') => ({ id, kind: 'plain', prompt, workspace: 'plain', check: { type: 'files', path: 'answer.txt', all: ['yes'], none: [] }, needs: {} });
  function args(arm: string, tasks: unknown[], budget: string, concurrency = '1') {
    const file = join(data, 'tasks.jsonl'); writeFileSync(file, tasks.map(t => JSON.stringify(t)).join('\n') + '\n');
    return ['--run', '--tasks', file, '--opencode', binary, '--models', 'opencode/glm-5.3-flash-free', '--arms', arm, '--jev-budget', budget, '--concurrency', concurrency, '--timeout', '5', '--out', out];
  }
  const rows = (directory: string) => readFileSync(join(directory, 'rows.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  it('persists budget exhaustion and stops before the next session', async () => {
    await main(args('preselect', [task('first'), task('second')], '0'));
    expect(rows(out)).toMatchObject([{ taskId: 'first', result: 'invalid', invalidReason: 'budget-exhausted', jev: { calls: 0, costUsd: 0 }, selection: { skills: [], servers: [] } }]);
  });
  it('materializes an endpoint token only for sessions configured with MCP', async () => {
    await main(args('mcp-all', [task('mcp', 'expects-token: write yes to answer.txt')], '0'));
    expect(rows(out)).toMatchObject([{ taskId: 'mcp', result: 'pass' }]);
  });
  it('records unavailable routing as invalid provider attempts without evaluating keyword fallback', async () => {
    await main(args('preselect', [task('first')], '0.10'));
    expect(rows(out)).toMatchObject([{ result: 'invalid', invalidReason: 'provider-error', jev: { calls: 1 }, steps: [] }]);
  });
  it('waits for a sibling session before propagating a fixture failure', async () => {
    const broken = { ...task('broken'), check: { type: 'node-test', tests: 'missing-check-directory' } };
    await expect(main(args('bare', [broken, task('sibling', 'slow: write yes to answer.txt')], '0', '2'))).rejects.toThrow();
    expect(rows(out)).toMatchObject([{ taskId: 'sibling', result: 'pass' }]);
  });
  it('resume preserves valid rows and retries an invalid identity with a new order index', async () => {
    const successful = args('bare', [task('success')], '0');
    await main(successful);
    const saved = readFileSync(join(out, 'rows.jsonl'), 'utf8');
    await main([...successful, '--resume']);
    expect(readFileSync(join(out, 'rows.jsonl'), 'utf8')).toBe(saved);
    const invalidOut = join(root, 'invalid-out');
    const failing = args('preselect', [task('retry')], '0.10');
    failing[failing.indexOf('--out') + 1] = invalidOut;
    await main(failing);
    await main([...failing, '--resume']);
    expect(rows(invalidOut).map(row => [row.taskId, row.result, row.orderIndex])).toEqual([['retry', 'invalid', 0], ['retry', 'invalid', 1]]);
  });
});
