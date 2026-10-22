import { readFileSync } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { parseHostEvents, requestUsage } from '../bench/usage.js';
import { claudeJson } from '../bench/lib.js';

vi.mock('node:child_process', async (original) => ({ ...await original<typeof import('node:child_process')>(), spawn: vi.fn() }));

const fixture = (host: string) => parseHostEvents(readFileSync(new URL(`./fixtures/request-usage/${host}.jsonl`, import.meta.url), 'utf8'));

describe('outcome host usage', () => {
  it('keeps Codex turn totals without inventing per-request usage', () => {
    expect(requestUsage('codex', fixture('codex'))).toEqual({
      requestSource: null, requests: null,
      totals: { inputTokens: 10135, cachedInputTokens: 7936, outputTokens: 5 },
    });
  });

  it('uses Claude result iterations, not the partial assistant counters', () => {
    const usage = requestUsage('claude', fixture('claude'));
    expect(usage).toEqual({
      requestSource: 'result.usage.iterations',
      requests: [{ inputTokens: 620, cachedInputTokens: 0, outputTokens: 4 }],
      totals: { inputTokens: 620, cachedInputTokens: 0, outputTokens: 4 },
    });
    expect(usage.requests!.reduce((n, row) => n + row.outputTokens, 0)).toBe(usage.totals!.outputTokens);
  });

  it('keeps multiple Claude requests in order and retains host totals', () => {
    const events = fixture('claude');
    const result = events.find((e) => e.type === 'result')!;
    result.usage = { input_tokens: 5, cache_creation_input_tokens: 618, cache_read_input_tokens: 620, output_tokens: 10,
      iterations: [
        { input_tokens: 2, cache_creation_input_tokens: 618, cache_read_input_tokens: 0, output_tokens: 4 },
        { input_tokens: 3, cache_creation_input_tokens: 0, cache_read_input_tokens: 620, output_tokens: 6 },
      ] };
    const usage = requestUsage('claude', events);
    expect(usage.requests).toEqual([
      { inputTokens: 620, cachedInputTokens: 0, outputTokens: 4 },
      { inputTokens: 623, cachedInputTokens: 620, outputTokens: 6 },
    ]);
    for (const key of ['inputTokens', 'cachedInputTokens', 'outputTokens'] as const) {
      expect(usage.requests!.reduce((n, row) => n + row[key], 0)).toBe(usage.totals![key]);
    }
  });

  it.each(['codex', 'claude'] as const)('marks missing %s usage as unavailable, not zero', (host) => {
    expect(requestUsage(host, parseHostEvents('{"type":"system"}\n\n'))).toEqual({ requestSource: null, requests: null, totals: null });
  });

  it('retains Claude totals when the host omits iterations', () => {
    const events = fixture('claude').filter((e) => e.type === 'result');
    delete (events[0]!.usage as Record<string, unknown>).iterations;
    expect(requestUsage('claude', events)).toEqual({ requestSource: null, requests: null,
      totals: { inputTokens: 620, cachedInputTokens: 0, outputTokens: 4 } });
  });

  it.each(['{private-invalid', 'null', '[]', '1', '{}'])('rejects malformed events without echoing their contents: %s', (line) => {
    expect(() => parseHostEvents(`\n${line}\n`)).toThrow('invalid host event at line 2');
    if (line.includes('private')) {
      try { parseHostEvents(line); } catch (error) { expect(String(error)).not.toContain(line); }
    }
  });

  it.each([undefined, -1, 1.5, '4', Infinity])('rejects invalid counters: %s', (value) => {
    const events = fixture('codex');
    (events[0]!.usage as Record<string, unknown>).output_tokens = value;
    expect(() => requestUsage('codex', events)).toThrow(/invalid.*usage/);
  });

  it('rejects cached tokens exceeding the input total', () => {
    expect(() => requestUsage('codex', [{ type: 'turn.completed', usage: { input_tokens: 1, cached_input_tokens: 2, output_tokens: 0 } }])).toThrow(/cached input/);
  });

  it.each([null, {}, [null], [{ input_tokens: 1 }]])('rejects malformed Claude iterations: %j', (iterations) => {
    const events = fixture('claude');
    (events.find((e) => e.type === 'result')!.usage as Record<string, unknown>).iterations = iterations;
    expect(() => requestUsage('claude', events)).toThrow(/invalid.*usage/);
  });

  it('rejects multiple total events rather than discarding usage', () => {
    const events = fixture('codex');
    expect(() => requestUsage('codex', [...events, ...events])).toThrow(/multiple.*usage/);
  });

  it('carries streamed Claude request usage through claudeJson while retaining task totals', async () => {
    vi.mocked(spawn).mockImplementationOnce((_command, argv) => {
      expect(argv).toEqual(expect.arrayContaining(['--output-format', 'stream-json', '--verbose']));
      const child = new EventEmitter() as ChildProcess;
      child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.stdin.on('finish', () => {
        const events = fixture('claude');
        Object.assign(events.find((e) => e.type === 'result')!, { structured_output: { winner: 'first' }, duration_ms: 1 });
        child.stdout!.emit('data', Buffer.from(events.map((e) => JSON.stringify(e)).join('\n')));
        queueMicrotask(() => child.emit('close', 0));
      });
      return child;
    });
    const result = await claudeJson('r', {}, { model: 'fixture', system: 'rules' });
    expect(result.output).toEqual({ winner: 'first' });
    expect(result.inputTokens).toBe(620);
    expect(result.costUsd).toBe(0.0001258);
    expect(result.usage.requests).toEqual([{ inputTokens: 620, cachedInputTokens: 0, outputTokens: 4 }]);
  });

  it.each([
    ['{"type":"system"}', 'no Claude result'],
    ['{"type":"result","structured_output":{}}', 'no Claude usage totals'],
    ['private-malformed-line', 'invalid host event at line 1'],
  ])('rejects missing or malformed Claude reports: %s', async (stdout, message) => {
    vi.mocked(spawn).mockImplementationOnce(() => {
      const child = new EventEmitter() as ChildProcess;
      child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.stdin.on('finish', () => {
        child.stdout!.emit('data', Buffer.from(stdout));
        queueMicrotask(() => child.emit('close', 0));
      });
      return child;
    });
    await expect(claudeJson('r', {}, { model: 'fixture', system: 'rules' })).rejects.toThrow(message);
  });
});
