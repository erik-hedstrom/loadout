import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';
import { afterAll, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config.js';
import { materialize } from '../src/launch.js';
import type { Capability } from '../src/types.js';
import { decisionFor } from '../bench/lib.js';
import type { SweepRow } from '../bench/sweep.js';

const temps: string[] = [];
afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('bench/outcome.ts judging', () => {
  // The stand-in `claude` is a shell script, which Windows cannot run from PATH.
  it.skipIf(process.platform === 'win32')('runs one judge call at a time, so the cached prompt stays warm', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'loadout-outcome-test-'));
    temps.push(dir);
    const ids = ['a', 'b', 'c'];
    const sweep = join(dir, 'sweep');
    for (const id of ids) {
      for (const arm of ['bare', 'loadout']) {
        mkdirSync(join(sweep, 'outcome', id, arm), { recursive: true });
        writeFileSync(join(sweep, 'outcome', id, `${arm}.json`), JSON.stringify({ arm }));
      }
    }
    writeFileSync(join(sweep, 'decisions.jsonl'), ids.map((id) => JSON.stringify({ id, request: 'r', tier: 'medium', loaded: [], offered: [] })).join('\n') + '\n');

    // A stand-in for `claude -p` that logs when each call starts and ends.
    const bin = join(dir, 'bin');
    const log = join(dir, 'calls.log');
    mkdirSync(bin);
    writeFileSync(
      join(bin, 'claude'),
      `#!/bin/sh\ncat >/dev/null\necho start >> "${log}"\nsleep 0.2\necho end >> "${log}"\nprintf '{"structured_output":{"winner":"first","confidence":"high","reasons":"x"},"total_cost_usd":0,"duration_ms":1,"usage":{"input_tokens":1}}'\n`,
    );
    chmodSync(join(bin, 'claude'), 0o755);

    const code = await new Promise<number | null>((resolve) => {
      const child = spawn(process.execPath, ['--import', 'tsx', 'bench/outcome.ts', sweep, '--ids', ids.join(','), '--judge-only'], {
        cwd: join(import.meta.dirname, '..'),
        env: { ...process.env, LOADOUT_HOME: dir, PATH: `${bin}${delimiter}${process.env.PATH}` },
        stdio: 'ignore',
      });
      child.on('close', resolve);
    });

    expect(code).toBe(0);
    // Two orders per request: overlapping calls would show "start" twice in a row.
    expect(readFileSync(log, 'utf8').trim().split('\n')).toEqual(Array(ids.length * 2).fill(['start', 'end']).flat());
  }, 60_000);
});

describe('bench decisionFor', () => {
  it('gives the bare and loadout arms the same model, the row\'s tier', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loadout-outcome-test-'));
    temps.push(dir);
    const skillDir = join(dir, 'pdf');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: pdf\ndescription: d\n---\nbody\n');
    const library: Capability[] = [{ id: 'skill:pdf', kind: 'skill', name: 'pdf', description: 'd', source: skillDir }];
    const row: SweepRow = { id: 'a', category: 'c', request: 'r', tier: 'small', loaded: [{ key: 'pdf', fit: 0.9 }], offered: [], shortlist: [], costUsd: 0, ms: 0 };
    // The default tier is medium, so a bare arm that dropped the row's tier would show it.
    expect(DEFAULT_CONFIG.tiers.codex.small).not.toEqual(DEFAULT_CONFIG.tiers.codex[DEFAULT_CONFIG.defaultTier]);

    for (const agent of ['claude', 'codex'] as const) {
      const bare = materialize(decisionFor(row, library, true), agent, DEFAULT_CONFIG, join(dir, 'sessions'));
      const loadout = materialize(decisionFor(row, library, false), agent, DEFAULT_CONFIG, join(dir, 'sessions'));
      expect(bare.skills).toEqual([]);
      expect(loadout.skills.map((c) => c.name)).toEqual(['pdf']);
      expect(bare.model).toBe(loadout.model);
      expect(bare.effort).toBe(loadout.effort);
    }
    expect(materialize(decisionFor(row, library, true), 'codex', DEFAULT_CONFIG, join(dir, 'sessions')).model).toBe('gpt-5.6-luna');
  });
});
