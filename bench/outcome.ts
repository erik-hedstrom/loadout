/**
 * Outcome evaluation: is the work better with loadout's skills? For each
 * request, the agent runs twice in fresh folders: once bare, once with the
 * sweep's selection (skills listed or injected, as `loadout codex` would). A
 * frontier judge then compares the two sets of output files blind, twice with
 * the order swapped. A preference that holds in both orders counts; a split
 * verdict is reported as such.
 *
 * Limits: each arm makes up its own sample inputs (the requests mention files
 * that do not exist), and both run with the user's own Codex configuration.
 * Outputs can still reveal the treatment, e.g. when a skill's own template
 * shows in the deliverable.
 *
 *   npx tsx bench/outcome.ts <sweep dir> --ids a,b,c [--timeout-s 360] [--judge opus]
 *
 * Text deliverables only (Markdown, code, JSON, CSV…): binaries are listed by
 * name but not compared. Runs use real subscriptions and take minutes each.
 */
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { loadConfig, paths } from '../src/config.js';
import { capabilityKey, scanLibrary } from '../src/library.js';
import { codexArgs, materialize, which } from '../src/launch.js';
import { claudeJson, decisionFor, pool, readJsonl, run } from './lib.js';
import { deliverables, judgePair, JUDGE_SYSTEM, NOTE, PrefSchema, type Arm, type Pref } from './pairwise.js';
import type { SweepRow } from './sweep.js';
import { events, tokenUsage, type TokenUsage } from './usage.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    ids: { type: 'string' },
    'timeout-s': { type: 'string', default: '360' },
    judge: { type: 'string', default: 'opus' },
    concurrency: { type: 'string', default: '2' },
    'judge-only': { type: 'boolean', default: false },
  },
});
const dir = positionals[0];
if (!dir || !values.ids) throw new Error('usage: outcome.ts <sweep dir> --ids a,b,c');
const rows = new Map(readJsonl<SweepRow>(join(dir, 'decisions.jsonl')).map((r) => [r.id, r]));
const ids = values.ids.split(',');
const library = scanLibrary(paths.library());
// The comparison is about skills: no mid-session search in either arm.
const config = { ...loadConfig(), search: false };
const out = join(dir, 'outcome');
mkdirSync(out, { recursive: true });

// 1. Runs.
if (!values['judge-only']) {
  const bin = which('codex');
  if (!bin) throw new Error('codex not on PATH');
  const sessions = mkdtempSync(join(tmpdir(), 'loadout-outcome-'));
  const jobs = ids.flatMap((id) => (['bare', 'loadout'] as Arm[]).map((arm) => ({ id, arm })));
  await pool(jobs, Number(values.concurrency), async ({ id, arm }) => {
    const row = rows.get(id);
    if (!row) throw new Error(`no sweep row ${id}`);
    const target = join(out, id, arm);
    // Run metadata lives next to the outputs, never among them: the judge must not see which arm is which.
    const meta = join(out, id, `${arm}.json`);
    if (existsSync(meta)) return;
    const session = materialize(decisionFor(row, library, arm === 'bare'), 'codex', config, sessions);
    const cwd = mkdtempSync(join(tmpdir(), 'loadout-outcome-work-'));
    const started = Date.now();
    const res = await run(bin, codexArgs(session, row.request + NOTE, ['-s', 'workspace-write', '--skip-git-repo-check', '--json'], { headless: true }), cwd, Number(values['timeout-s']) * 1000);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    cpSync(cwd, target, { recursive: true, filter: (src) => !/[/\\](node_modules|\.git|\.venv|venv|__pycache__)([/\\]|$)/.test(src) });
    const metadata = { arm, model: session.model, skills: session.skills.map((c) => capabilityKey(c)), injected: session.injected.length, code: res.code, timedOut: res.timedOut, ms: Date.now() - started,
      usage: null as TokenUsage | null, usageError: undefined as string | undefined };
    // A truncated stream must not prevent saving paid deliverables and metadata.
    try { metadata.usage = tokenUsage('codex', events(res.stdout)); }
    catch { metadata.usageError = 'Codex usage unavailable (contents suppressed)'; }
    writeFileSync(meta, JSON.stringify(metadata));
    rmSync(cwd, { recursive: true, force: true });
    console.log(`${id} ${arm}: ${res.timedOut ? 'timed out' : `exit ${res.code}`} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  });
  rmSync(sessions, { recursive: true, force: true });
}

// 2. Blind pairwise judging, both orders.
const schema = z.toJSONSchema(PrefSchema, { target: 'draft-07' });
const verdictFile = join(out, 'verdicts.jsonl');
const judged = new Set(existsSync(verdictFile) ? readJsonl<{ id: string }>(verdictFile).map((v) => v.id) : []);
let cost = 0;
// One at a time, so the judge's system prompt stays in the cache (AGENTS.md rule 6).
for (const id of ids.filter((id) => !judged.has(id) && existsSync(join(out, id, 'bare.json')) && existsSync(join(out, id, 'loadout.json')))) {
  const row = rows.get(id)!;
  const files = { bare: deliverables(join(out, id, 'bare')), loadout: deliverables(join(out, id, 'loadout')) };
  const { winner, orders: [a, b] } = await judgePair(row.request, files, async (prompt) => {
    const res = await claudeJson<Pref>(prompt, schema, { model: values.judge!, system: JUDGE_SYSTEM });
    cost += res.costUsd;
    return { ...res.output, usage: res.usage, usageError: res.usageError };
  });
  const meta = (arm: Arm) => JSON.parse(readFileSync(join(out, id, `${arm}.json`), 'utf8'));
  appendFileSync(verdictFile, JSON.stringify({ id, winner, orders: [a, b], bare: meta('bare'), loadout: meta('loadout') }) + '\n');
  console.log(`${id}: ${winner} (${a.winner} / ${b.winner})`);
}

const verdicts = existsSync(verdictFile) ? readJsonl<{ id: string; winner: string }>(verdictFile).filter((v) => ids.includes(v.id)) : [];
const count = (w: string) => verdicts.filter((v) => v.winner === w).length;
console.log(`\nloadout better ${count('loadout')}, bare better ${count('bare')}, tie ${count('tie')}, split ${count('split')} (of ${verdicts.length}); judge $${cost.toFixed(2)}`);
