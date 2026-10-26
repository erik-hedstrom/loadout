import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import type { Capability } from '../src/types.js';
import { decisionFor } from '../bench/lib.js';
import type { SweepRow } from '../bench/sweep.js';

const temps: string[] = [];
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const ids = ['a', 'b', 'c'];

/** Runs `outcome.ts --judge-only` with a stand-in `claude` as the only thing on PATH, so a real one can never be reached. */
async function judge(standInMode: number, runArms: false | 'valid' | 'truncated' = false) {
  const dir = mkdtempSync(join(tmpdir(), 'loadout-outcome-test-'));
  temps.push(dir);
  const sweep = join(dir, 'sweep');
  for (const id of ids) {
    for (const arm of ['bare', 'loadout']) {
      mkdirSync(join(sweep, 'outcome', id, arm), { recursive: true });
      writeFileSync(join(sweep, 'outcome', id, `${arm}.json`), JSON.stringify({ arm }));
    }
  }
  writeFileSync(join(sweep, 'decisions.jsonl'), ids.map((id) => JSON.stringify({ id, request: 'r', tier: 'medium', loaded: [], offered: [] })).join('\n') + '\n');

  const bin = join(dir, 'bin');
  const log = join(dir, 'calls.log');
  const promptLog = join(dir, 'judge-prompt.txt');
  const codexHome = join(dir, 'ambient-home');
  mkdirSync(bin);
  if (runArms) {
    for (const arm of ['bare', 'loadout']) rmSync(join(sweep, 'outcome', 'a', `${arm}.json`));
    const usage = readFileSync(new URL('./fixtures/request-usage/codex.jsonl', import.meta.url), 'utf8');
    const stdout = runArms === 'truncated' ? '{"type":"turn.completed","private":"truncated-private' : usage.trim();
    writeFileSync(join(bin, 'codex'), `#!/bin/sh\ncase " $* " in *' --json '*) ;; *) exit 9 ;; esac\nprintf '%s' "$CODEX_HOME" > deliverable.txt\nprintf '%s' '${stdout}'\n`, { mode: 0o755 });
  }
  writeFileSync(
    join(bin, 'claude'),
    `#!/bin/sh\n/bin/cat >> "${promptLog}"\necho start >> "${log}"\n/bin/sleep 0.2\necho end >> "${log}"\nprintf '{"type":"result","structured_output":{"winner":"first","confidence":"high","reasons":"x"},"total_cost_usd":0,"duration_ms":1,"usage":{"input_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":1,"iterations":[{"input_tokens":1,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":1}]}}'\n`,
    { mode: standInMode },
  );

  const code = await new Promise<number | null>((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'bench/outcome.ts', sweep, '--ids', ids.join(','), ...(runArms ? [] : ['--judge-only'])], {
      cwd: join(import.meta.dirname, '..'),
      env: { ...process.env, LOADOUT_HOME: dir, PATH: bin, CODEX_HOME: codexHome },
      stdio: 'ignore',
    });
    child.on('close', resolve);
  });
  return { code, log, promptLog, codexHome, output: join(sweep, 'outcome', 'a'), verdicts: join(sweep, 'outcome', 'verdicts.jsonl') };
}

// The stand-in `claude` is a shell script, which Windows cannot run from PATH.
describe.skipIf(process.platform === 'win32')('bench/outcome.ts judging', () => {
  it('runs one judge call at a time, so the cached prompt stays warm', async () => {
    const { code, log, verdicts } = await judge(0o755);
    expect(code).toBe(0);
    // Two orders per request: overlapping calls would show "start" twice in a row.
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual(Array(ids.length * 2).fill(['start', 'end']).flat());
    expect(readFileSync(verdicts, 'utf8').trim().split('\n')).toHaveLength(ids.length);
    const row = JSON.parse(readFileSync(verdicts, 'utf8').trim().split('\n')[0]!);
    expect(row.orders.map((order: { usage: unknown }) => order.usage)).toEqual(Array(2).fill({
      inputTokens: 1, cachedInputTokens: 0, outputTokens: 1,
    }));
  }, 60_000);

  it('persists host totals and unavailable Codex requests through metadata and verdicts', async () => {
    const { code, verdicts, output, codexHome } = await judge(0o755, 'valid');
    expect(code).toBe(0);
    const row = JSON.parse(readFileSync(verdicts, 'utf8').trim().split('\n')[0]!);
    for (const arm of ['bare', 'loadout']) {
      expect(row[arm].code).toBe(0);
      expect(row[arm].usage).toEqual({ inputTokens: 10135, cachedInputTokens: 7936, outputTokens: 5 });
      expect(readFileSync(join(output, arm, 'deliverable.txt'), 'utf8')).toBe(codexHome);
      expect(existsSync(codexHome)).toBe(false);
    }
  }, 60_000);

  it('preserves paid deliverables and metadata when Codex JSONL is truncated', async () => {
    const { code, verdicts, output, codexHome, promptLog } = await judge(0o755, 'truncated');
    expect(code).toBe(0);
    const row = JSON.parse(readFileSync(verdicts, 'utf8').trim().split('\n')[0]!);
    for (const arm of ['bare', 'loadout']) {
      const meta = JSON.parse(readFileSync(join(output, `${arm}.json`), 'utf8'));
      expect(meta).toMatchObject({ code: 0, usage: null, usageError: 'Codex usage unavailable (contents suppressed)' });
      expect(meta.usageError).not.toContain('truncated-private');
      expect(row[arm]).toEqual(meta);
      expect(readFileSync(join(output, arm, 'deliverable.txt'), 'utf8')).toBe(codexHome);
    }
    expect(readFileSync(promptLog, 'utf8')).not.toContain('truncated-private');
  }, 60_000);

  it.each(['valid', 'truncated'] as const)('writes only expected deliverables and metadata, with no raw stdout: %s', async (mode) => {
    const { code, output } = await judge(0o755, mode);
    expect(code).toBe(0);
    const root = join(output, '..');
    const files = readdirSync(root, { recursive: true, encoding: 'utf8' }).filter((name) => statSync(join(root, name)).isFile());
    expect(files.sort()).toEqual([
      'verdicts.jsonl',
      ...ids.flatMap((id) => [join(id, 'bare.json'), join(id, 'loadout.json')]),
      join('a', 'bare', 'deliverable.txt'), join('a', 'loadout', 'deliverable.txt'),
    ].sort());
  }, 60_000);

  it('fails, and calls nothing else, when the stand-in cannot run', async () => {
    const { code, log } = await judge(0o644);
    expect(code).not.toBe(0);
    expect(existsSync(log)).toBe(false);
  }, 60_000);
});

describe('bench decisionFor', () => {
  it("keeps the row's tier for the bare arm and carries no skills", () => {
    const library: Capability[] = [{ id: 'skill:pdf', kind: 'skill', name: 'pdf', description: 'd', source: '/x/pdf' }];
    const row: SweepRow = { id: 'a', category: 'c', request: 'r', tier: 'small', loaded: [{ key: 'pdf', fit: 0.9 }], offered: [{ key: 'pdf', fit: 0.5 }], shortlist: [], costUsd: 0, ms: 0 };
    expect(decisionFor(row, library, false).selected).toHaveLength(1);
    const bare = decisionFor(row, library, true);
    expect(bare.tier).toBe(row.tier);
    expect(bare.selected).toEqual([]);
    expect(bare.suggested).toEqual([]);
  });
});
