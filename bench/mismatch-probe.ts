/**
 * Probe: does a per-candidate "platform mismatch" question separate loads the
 * judge rated helpful from neutral and misleading ones? The misleading loads in
 * the v4 sweep all assume a product or stack the request never mentions
 * (lark-calendar for generic scheduling, a RAPIDS skill for PyTorch OOM).
 *
 *   npx tsx bench/mismatch-probe.ts <judged sweep dir> [--blind-from <dir>]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig, paths, resolveApiKey } from '../src/config.js';
import { jevClient, type Question } from '../src/jev.js';
import { capabilityKey, scanLibrary } from '../src/library.js';
import { pool, readJsonl } from './lib.js';
import type { SweepRow } from './sweep.js';

const MISMATCH_QUESTIONS = {
  mismatch:
    'Does this skill depend on a specific product, platform, vendor or technology stack that the request does not mention and does not clearly involve?',
  wrong_stack:
    'Would following this skill push the work onto a different tool, platform or stack than the one the request is about?',
} as const;

const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'blind-from': { type: 'string' } } });
const dir = positionals[0];
if (!dir) throw new Error('usage: mismatch-probe.ts <judged sweep dir>');
const rows = readJsonl<SweepRow>(join(dir, 'decisions.jsonl'));
const blind = new Map(readJsonl<{ id: string; useful: string[] }>(join(values['blind-from'] ?? dir, 'judge-blind.jsonl')).map((b) => [b.id, b]));
const verdicts = new Map(readJsonl<{ id: string; loaded: { key: string; rating: string }[] }>(join(dir, 'judge-verdicts.jsonl')).map((v) => [v.id, v]));
const config = loadConfig();
const client = jevClient({ apiKey: resolveApiKey(config)!, baseUrl: config.jev.baseUrl, model: config.jev.model });
const byKey = new Map(scanLibrary(paths.library()).map((c) => [capabilityKey(c), c]));

type Label = 'helpful' | 'neutral' | 'misleading';
const label = (id: string, key: string): Label => {
  const rated = verdicts.get(id)?.loaded.find((l) => l.key === key)?.rating as Label | undefined;
  return rated ?? (blind.get(id)?.useful.includes(key) ? 'helpful' : 'neutral');
};

interface Obs { id: string; key: string; label: Label; scores: Record<string, number> }
const obs: Obs[] = [];
let tokens = 0;
await pool(rows.filter((r) => r.loaded.length), 4, async (r) => {
  const questions: Record<string, Question> = {};
  r.loaded.forEach((p, i) => {
    const c = byKey.get(p.key);
    if (!c) return;
    for (const [q, text] of Object.entries(MISMATCH_QUESTIONS)) {
      questions[`${q}_${i}`] = { type: 'noul', instructions: { question: text, skill: { name: c.name, description: c.description.slice(0, 700) } } };
    }
  });
  const res = await client.ask({ request: r.request }, questions);
  tokens += res.usage.input_tokens;
  r.loaded.forEach((p, i) => {
    const scores = Object.fromEntries(Object.keys(MISMATCH_QUESTIONS).map((q) => {
      const a = res.answers[`${q}_${i}`];
      return [q, a?.type === 'noul' ? a.noul : NaN];
    }));
    obs.push({ id: r.id, key: p.key, label: label(r.id, p.key), scores });
  });
});

const auc = (pos: number[], neg: number[]) => {
  let s = 0;
  for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
  return pos.length && neg.length ? s / (pos.length * neg.length) : NaN;
};
const lines: string[] = [`${obs.length} loads, ${tokens} tokens ($${((tokens / 1e6) * config.jev.inputPricePerMTok).toFixed(4)})`];
for (const q of Object.keys(MISMATCH_QUESTIONS)) {
  const of = (l: Label) => obs.filter((o) => o.label === l).map((o) => o.scores[q]!);
  const mean = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3);
  lines.push(`${q}: mean helpful ${mean(of('helpful'))} (n=${of('helpful').length}), neutral ${mean(of('neutral'))} (n=${of('neutral').length}), misleading ${mean(of('misleading'))} (n=${of('misleading').length})`);
  lines.push(`  AUC misleading vs helpful ${auc(of('misleading'), of('helpful')).toFixed(3)}; not-helpful vs helpful ${auc([...of('neutral'), ...of('misleading')], of('helpful')).toFixed(3)}`);
  for (const t of [0.5, 0.7, 0.8, 0.9]) {
    const veto = (l: Label) => of(l).filter((x) => x >= t).length;
    lines.push(`  veto at ≥${t}: removes ${veto('misleading')}/${of('misleading').length} misleading, ${veto('neutral')}/${of('neutral').length} neutral, ${veto('helpful')}/${of('helpful').length} helpful`);
  }
}
for (const o of obs.filter((o) => o.label === 'misleading' || o.scores.mismatch! >= 0.7)) lines.push(`  ${o.label.padEnd(10)} ${o.id} ${o.key} ${JSON.stringify(o.scores)}`);
writeFileSync(join(dir, 'mismatch-probe.txt'), lines.join('\n') + '\n');
writeFileSync(join(dir, 'mismatch-probe.jsonl'), obs.map((o) => JSON.stringify(o)).join('\n') + '\n');
console.log(lines.join('\n'));
