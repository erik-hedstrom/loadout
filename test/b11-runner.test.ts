import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as config from '../src/config.js';
import * as jev from '../src/jev.js';
import { main } from '../bench/b11.js';

// Keep the real cooldown ordering without waiting a minute in offline lifecycle tests.
vi.mock('node:timers/promises', () => ({ setTimeout: async () => new Promise(resolve => setTimeout(resolve, 600)) }));

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
case "$*" in *rate-first*) printf '%s\\n' '{"type":"error","error":{"name":"APIError","data":{"statusCode":429,"message":"rate limit exceeded"}}}'; exit 1;; esac
case "$*" in *quota-delayed*) sleep 0.2; printf '%s\\n' 'AI_APICallError: Free usage limit reached PRIVATE' >&2; sleep 3; exit 9;; esac
case "$*" in *quota-stop*) printf '%s\\n' 'AI_APICallError: Free usage limit reached PRIVATE' >&2; sleep 3; exit 9;; esac
case "$*" in *quota-quote*) printf '%s\\n' 'Free usage limit reached PRIVATE' >&2;; esac
case "$*" in *slow*) sleep 0.4;; esac
case "$*" in *lock-output*) mkdir locked; chmod 000 locked;; esac
printf '%s\\n' '{"type":"step_start"}'
sleep 0.02
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
  it('prints the session-deadline schedule with concurrency and block barriers', async () => {
    const a = args('bare', [task('first'), task('second'), task('third')], '0', '2');
    a[a.indexOf('--run')] = '--plan';
    await main(a);
    const plan = JSON.parse(vi.mocked(console.log).mock.calls[0]![0]);
    expect(plan).toMatchObject({ runs: 3, concurrency: 2, timeoutSeconds: 5, sessionDeadlineScheduleSeconds: 10 });
  });
  it('persists a provider usage cap promptly and stops before another session', async () => {
    const start = Date.now();
    await main(args('bare', [task('limited', 'quota-stop'), task('not-started')], '0'));
    expect(Date.now() - start).toBeLessThan(2500);
    expect(rows(out)).toMatchObject([{ taskId: 'limited', result: 'invalid', invalidReason: 'usage-limit', steps: [] }]);
    expect(rows(out)).toHaveLength(1);
    expect(JSON.stringify(rows(out))).not.toContain('PRIVATE');
    expect(vi.mocked(console.log).mock.calls.at(-1)![0]).toContain('free usage limit reached');
  });
  it('does not launch a cooldown sleeper after a sibling reaches the persistent usage cap', async () => {
    await main(args('bare', [task('rate-first', 'rate-first'), task('quota-delayed', 'quota-delayed'), task('not-started')], '0', '2'));
    expect(rows(out).map(row => [row.taskId, row.invalidReason])).toEqual([
      ['rate-first', 'rate-limit'], ['quota-delayed', 'usage-limit'],
    ]);
  });
  it('records routing usage without launching when a sibling reaches the cap during preselection', async () => {
    let release!: () => void;
    const routedAfterStop = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(console.log).mockImplementation(value => { if (String(value).includes('limited: invalid (usage-limit)')) release(); });
    vi.mocked(jev.jevClient).mockReturnValue({ ask: async state => {
      if (JSON.stringify(state).includes('late-route')) await routedAfterStop;
      return { model: 'jev-test', answers: {}, usage: { input_tokens: 1000, output_tokens: 0 } };
    } });
    await main(args('preselect', [task('limited', 'quota-stop'), task('routed', 'late-route')], '0.10', '2'));
    const routed = rows(out).find(row => row.taskId === 'routed');
    expect(routed).toMatchObject({ result: 'invalid', invalidReason: 'usage-limit', steps: [], jev: { calls: 2 } });
    expect(routed.jev.costUsd).toBeGreaterThan(0);
    expect(routed.latency).toBeUndefined();
  });
  it('does not treat a quoted quota phrase without an API error as a persistent provider cap', async () => {
    await main(args('bare', [task('quoted', 'quota-quote')], '0'));
    expect(rows(out)).toMatchObject([{ taskId: 'quoted', result: 'pass' }]);
  });
  it('persists budget exhaustion and stops before the next session', async () => {
    await main(args('preselect', [task('first'), task('second')], '0'));
    expect(rows(out)).toMatchObject([{ taskId: 'first', result: 'invalid', invalidReason: 'budget-exhausted', jev: { calls: 0, costUsd: 0 }, selection: { skills: [], servers: [] } }]);
  });
  it('materializes an endpoint token only for sessions configured with MCP', async () => {
    await main(args('mcp-all', [task('mcp', 'expects-token: write yes to answer.txt')], '0'));
    expect(rows(out)).toMatchObject([{ taskId: 'mcp', result: 'pass' }]);
    expect(rows(out)[0].timeoutMs).toBe(5000);
    expect(rows(out)[0].latency.startupMs).toBeGreaterThanOrEqual(0);
    expect(rows(out)[0].latency.stepsMs).toHaveLength(1);
    expect(rows(out)[0].latency.stepsMs[0]).toBeGreaterThan(0);
  });
  it('records the heavy-max limits, resumes them and rejects a changed comparator', async () => {
    const a = [...args('heavy-max', [task('heavy', 'expects-token: write yes')], '0'), '--heavy-skills', '250', '--heavy-servers', '5'];
    await main(a);
    expect(rows(out)).toMatchObject([{ arm: 'heavy-max', result: 'pass', heavyConfig: { skills: 250, servers: 5 } }]);
    await main([...a, '--resume']);
    expect(rows(out)).toHaveLength(1);
    const changed = [...a]; changed[changed.indexOf('--heavy-skills') + 1] = '500';
    await expect(main([...changed, '--resume'])).rejects.toThrow('size mismatch');
  });
  it('retains fixed-subset target servers for sweeps and all targets/tasks for heavy-max', async () => {
    const canary = (server: string) => ({ server, tool: 'needle', description: 'Synthetic fact for a named output.', inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false }, args: {}, response: 'yes' });
    writeFileSync(join(data, 'mcp-canaries.json'), JSON.stringify([canary('database'), canary('browser')]));
    const tasks = ['database', 'browser'].map((server, i) => ({ ...task('target-' + i, 'expects-token: write yes'), kind: 'mcp-needle', needs: { server, tool: 'needle' } }));
    await main([...args('mcp-1', tasks, '0'), '--sweep-per-kind', '1']);
    expect(rows(out)).toMatchObject([{ taskId: 'target-0', listing: { servers: 2 } }]);
    expect(rows(out)).toHaveLength(1);
    const a = [...args('heavy-max', tasks, '0'), '--sweep-per-kind', '1', '--heavy-skills', '250', '--heavy-servers', '1'];
    const heavyOut = out + '-heavy'; a[a.indexOf('--out') + 1] = heavyOut;
    await main(a);
    expect(rows(heavyOut)).toHaveLength(2);
    expect(rows(heavyOut).map(r => r.listing.servers)).toEqual([3, 3]);
  });
  it('cleans directories made unreadable by the agent before persisting the row', async () => {
    await main(args('bare', [task('permissions', 'lock-output: write yes to answer.txt')], '0'));
    expect(rows(out)).toMatchObject([{ taskId: 'permissions', result: 'pass' }]);
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
