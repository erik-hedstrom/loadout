import { readFileSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { events, tokenUsage } from '../bench/usage.js';
import { claudeJson } from '../bench/lib.js';

vi.mock('node:child_process', async (original) => ({ ...await original<typeof import('node:child_process')>(), spawn: vi.fn() }));

const fixture = (host: string) => events(readFileSync(new URL(`./fixtures/request-usage/${host}.jsonl`, import.meta.url), 'utf8'));
const claudeResult = () => ({ ...fixture('claude').find((e) => e.type === 'result')!, structured_output: { winner: 'first' }, duration_ms: 1 });

function respond(stdout: string) {
  vi.mocked(spawn).mockImplementationOnce((_command, argv) => {
    expect(argv).toEqual(expect.arrayContaining(['--output-format', 'json']));
    expect(argv).not.toContain('--verbose');
    const child = new EventEmitter() as ChildProcess;
    child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.stdin.on('finish', () => {
      child.stdout!.emit('data', Buffer.from(stdout));
      queueMicrotask(() => child.emit('close', 0));
    });
    return child;
  });
}

describe('outcome host usage', () => {
  it('keeps Codex exec turn totals without inventing per-request usage', () => {
    expect(tokenUsage('codex', fixture('codex'))).toEqual({ inputTokens: 10135, cachedInputTokens: 7936, outputTokens: 5 });
  });

  it('uses Claude session totals, not partial assistant counters or last-request iterations', () => {
    expect(tokenUsage('claude', fixture('claude'))).toEqual({ inputTokens: 620, cachedInputTokens: 0, outputTokens: 4 });
  });

  it.each([undefined, null, [], [{ input_tokens: 1, output_tokens: 1 }]].map((iterations) => ({ iterations })))('ignores sampling iterations: $iterations', async ({ iterations }) => {
    const result = claudeResult();
    result.usage = { input_tokens: 5, cache_creation_input_tokens: 618, cache_read_input_tokens: 620, output_tokens: 10, iterations };
    respond(JSON.stringify(result));
    const answer = await claudeJson('r', {}, { model: 'fixture', system: 'rules' });
    expect(answer.output).toEqual({ winner: 'first' });
    expect(answer.usage).toEqual({ inputTokens: 1243, cachedInputTokens: 620, outputTokens: 10 });
    expect(answer.usageError).toBeUndefined();
  });

  it.each([undefined, null, {}, { input_tokens: 'private-invalid' }, { input_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: -1 }])('preserves a paid Claude answer with unavailable/invalid usage: %j', async (usage) => {
    respond(JSON.stringify({ ...claudeResult(), usage }));
    const answer = await claudeJson('r', {}, { model: 'fixture', system: 'rules' });
    expect(answer.output).toEqual({ winner: 'first' });
    expect(answer.costUsd).toBe(0.0001258);
    expect(answer.usage).toBeNull();
    expect(answer.usageError).toBe('Claude usage unavailable (contents suppressed)');
    expect(answer.usageError).not.toContain('private-invalid');
  });

  it.each([undefined, -1, 1.5, 'private-invalid', Infinity])('rejects invalid Codex counters: %s', (value) => {
    const records = fixture('codex');
    (records[0]!.usage as Record<string, unknown>).output_tokens = value;
    expect(() => tokenUsage('codex', records)).toThrow();
  });

  it('rejects cached tokens exceeding the input total', () => {
    expect(() => tokenUsage('codex', [{ type: 'turn.completed', usage: { input_tokens: 1, cached_input_tokens: 2, output_tokens: 0 } }])).toThrow(/cached input/);
  });

  it.each([[], [{ type: 'system' }]].map((records) => ({ records })))('rejects missing totals instead of silently returning zero: $records', ({ records }) => {
    expect(() => tokenUsage('codex', records)).toThrow();
  });

  it('rejects multiple total events rather than discarding usage', () => {
    const records = fixture('codex');
    expect(() => tokenUsage('codex', [...records, ...records])).toThrow(/multiple.*usage/);
  });

  it('uses the shared JSONL parser without exposing malformed line contents', () => {
    expect(events('\n{"type":"system"}\n\n')).toEqual([{ type: 'system' }]);
    expect(() => events('private-truncated-line')).toThrow('host emitted invalid JSONL (output suppressed)');
  });
});
