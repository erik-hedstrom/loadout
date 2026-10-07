/**
 * Turn terse seed requests into the detailed prompts agents actually receive:
 * many users run their request through a model first ("improve this prompt"),
 * which adds context, requirements and acceptance criteria. The expander never
 * sees the skill library either.
 *
 *   npx tsx bench/expand.ts <seeds.jsonl> [--backend claude|codex|files] [--model claude-sonnet-5-5] [--out bench/data/requests.jsonl]
 *
 * seeds.jsonl: {"category": "...", "request": "..."} per line.
 * Output: {"id", "category", "seed", "request", "generatedBy"?, "expandedBy"} per line.
 */
import { appendFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { backendOf, costLabel, DATA, modelFamily, modelJson, pool, readJsonl } from './lib.js';
import { z } from 'zod';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    backend: { type: 'string', default: 'claude' },
    model: { type: 'string' },
    effort: { type: 'string' },
    out: { type: 'string', default: join(DATA, 'requests.jsonl') },
    batch: { type: 'string', default: '8' },
    concurrency: { type: 'string', default: '3' },
  },
});
const seedsFile = positionals[0];
if (!seedsFile) throw new Error('usage: expand.ts <seeds.jsonl>');
const backend = backendOf(values.backend!, values.effort);
const model = values.model ?? (values.backend === 'codex' ? 'gpt-6.1-sol' : 'claude-sonnet-5-5');
const expandedBy = { backend, model, effort: values.effort ?? null, family: backend === 'files' ? 'unverified' : modelFamily(model), ...(backend === 'files' ? { producer: 'unverified' } : {}) };

const counters = new Map<string, number>();
const seeds = readJsonl<{ category: string; request: string; generatedBy?: { model: string; family?: string } }>(seedsFile).map((s) => {
  const n = (counters.get(s.category) ?? 0) + 1;
  counters.set(s.category, n);
  return { id: `${s.category}-${String(n).padStart(2, '0')}`, ...s };
});
const records = existsSync(values.out!) ? readJsonl<{ id: string; expandedBy?: typeof expandedBy }>(values.out!) : [];
if (records.some((r) => r.expandedBy && (r.expandedBy.backend !== backend || r.expandedBy.model !== model || (r.expandedBy.effort ?? null) !== expandedBy.effort))) throw new Error(`expander provenance differs in ${values.out}; use a fresh output file`);
const done = new Set(records.map((r) => r.id));
const todo = seeds.filter((s) => !done.has(s.id));

const SYSTEM = `You are the prompt-improvement step a user runs before sending a request to their AI assistant or coding agent (Claude Code, Codex, Cursor, Claude Desktop, ChatGPT).
Rewrite each request into the detailed prompt the user will actually send:
- keep the user's intent, voice (first person) and every specific they gave;
- add the context a helpful rewrite would make explicit: the goal, the situation, requirements, constraints, the deliverable, how to know it is done;
- where the user left something open, make a reasonable assumption and say so, or ask the agent to check;
- name tools, frameworks, file formats and services only where the user did or where a careful rewrite naturally would;
- vary the length with the task: 60-120 words for small things, up to 250-350 words for big ones; use short sections or bullets when they help;
- never mention skills, plugins, MCP servers or tools the assistant may have, and never tell the assistant which of its own capabilities to use.
Return only the rewritten prompts.`;

const schema = z.strictObject({ results: z.array(z.strictObject({ id: z.string(), prompt: z.string() })) });

const size = Number(values.batch);
const batches = Array.from({ length: Math.ceil(todo.length / size) }, (_, i) => todo.slice(i * size, (i + 1) * size));
let cost = 0;
let pending = false;
await pool(batches, Number(values.concurrency), async (batch) => {
  const prompt = `Rewrite each request. Keep the ids.\n\n${batch.map((s) => `[${s.id}] ${s.request}`).join('\n\n')}`;
  const res = await modelJson(prompt, schema, { backend: values.backend!, model, effort: values.effort, system: SYSTEM, out: dirname(values.out!) });
  if (!res) { pending = true; return; }
  cost += res.costUsd ?? 0;
  for (const r of res.output.results) {
    const seed = batch.find((s) => s.id === r.id);
    if (seed) appendFileSync(values.out!, JSON.stringify({ id: seed.id, category: seed.category, seed: seed.request, request: r.prompt.trim(), generatedBy: seed.generatedBy, expandedBy }) + '\n');
  }
  console.log(`expanded ${batch[0]!.id}…  ${costLabel(backend, cost)}`);
});
if (!pending) console.log(`done, ${costLabel(backend, cost)} → ${values.out}`);
