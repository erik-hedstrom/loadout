/**
 * Generate held-out requests without supplying any skill-library content.
 *
 *   npx tsx bench/seeds.ts --prefix c1 --out bench/data/seeds-c1.jsonl [--backend codex|claude|files] [--model gpt-6.1-sol] [--effort high]
 */
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { backendOf, costLabel, modelFamily, modelJson, readJsonl } from './lib.js';

const CATEGORIES = [
  { category: 'web', count: 24, gloss: 'Creating and improving websites and browser-based experiences.' },
  { category: 'backend', count: 19, gloss: 'Building server-side behavior, storing information and handling requests.' },
  { category: 'integrations', count: 19, gloss: 'Connecting systems and moving information between them.' },
  { category: 'documents', count: 29, gloss: 'Creating, editing, converting and understanding documents.' },
  { category: 'business', count: 29, gloss: 'Planning work, understanding markets and making organizational decisions.' },
  { category: 'data', count: 19, gloss: 'Cleaning, analyzing and presenting collections of information.' },
  { category: 'ml', count: 14, gloss: 'Training, evaluating and applying models that learn from examples.' },
  { category: 'science', count: 10, gloss: 'Understanding research, planning experiments and explaining natural phenomena.' },
  { category: 'devops', count: 19, gloss: 'Deploying, operating and maintaining software environments.' },
  { category: 'security', count: 14, gloss: 'Protecting systems and information and assessing risks.' },
  { category: 'debug', count: 14, gloss: 'Finding and fixing unexpected behavior and failures.' },
  { category: 'everyday', count: 33, gloss: 'Getting practical help with ordinary daily situations and decisions.' },
  { category: 'media', count: 14, gloss: 'Creating, editing and understanding visual and audio material.' },
  { category: 'writing', count: 14, gloss: 'Drafting, revising and adapting written communication.' },
  { category: 'productivity', count: 10, gloss: 'Organizing time, priorities and recurring work.' },
  { category: 'apps', count: 10, gloss: 'Creating and improving applications for personal or shared use.' },
  { category: 'questions', count: 9, gloss: 'Asking for explanations, comparisons and answers to general questions.' },
] as const;

const SYSTEM = `Write distinct requests that people type to an AI assistant or coding agent.
- Write in the first person.
- Mix very terse and fairly specific requests, roughly 5-40 words each.
- Vary the register, from casual shorthand to more formal language.
- Include some requests a strong general assistant can handle fine without any special capability.
- Name tools, file formats or services only where a user naturally would.
- Never mention skills, plugins, MCP servers or the assistant's own capabilities.
- Make each request self-contained.
Return only the requested JSON object.`;
const schema = z.strictObject({ requests: z.array(z.string()) });

const { values } = parseArgs({ options: {
  prefix: { type: 'string' },
  out: { type: 'string' },
  backend: { type: 'string', default: 'codex' },
  model: { type: 'string', default: 'gpt-6.1-sol' },
  effort: { type: 'string' },
} });
// The prefix names the ids and the batch directory. Lowercase only, because on a
// case-insensitive filesystem C1 and c1 would share c1's batches (and answers).
if (!values.prefix || !/^[a-z0-9]+$/.test(values.prefix) || !values.out) throw new Error('usage: seeds.ts --prefix <lowercase letters and digits> --out <seeds.jsonl>');
const backend = backendOf(values.backend!, values.effort);
const model = values.model!;
const generatedBy: { backend: string; model: string; effort: string | null; family?: string; producer?: string } = { backend, model, effort: values.effort ?? null, ...(backend === 'files' ? { producer: 'unverified' } : { family: modelFamily(model) }) };
const records = existsSync(values.out) ? readJsonl<{ id: string; category: string; request: string; generatedBy?: typeof generatedBy }>(values.out) : [];
if (records.some((r) => !r.generatedBy || r.generatedBy.backend !== backend || r.generatedBy.model !== model || (r.generatedBy.effort ?? null) !== generatedBy.effort || r.generatedBy.family !== generatedBy.family || r.generatedBy.producer !== generatedBy.producer)) throw new Error('seed generator provenance differs; use a fresh output file');

const seen = new Set<string>();
function validate(requests: string[], category: string, count: number): string[] {
  const trimmed = requests.map((request) => request.trim());
  const normalized = trimmed.map((request) => request.toLowerCase());
  if (trimmed.length !== count || normalized.some((request) => !request || seen.has(request)) || new Set(normalized).size !== count) throw new Error(`invalid seeds for category ${category}`);
  normalized.forEach((request) => seen.add(request));
  return trimmed;
}

const idsFor = (category: string, count: number) => Array.from({ length: count }, (_, i) => `${values.prefix}-${category}-${String(i + 1).padStart(2, '0')}`);
if (records.some((r) => !CATEGORIES.some((c) => c.category === r.category))) throw new Error('stored seeds have an unknown category; use a fresh output file');
const done = new Set<string>();
for (const { category, count } of CATEGORIES) {
  const stored = records.filter((r) => r.category === category);
  if (!stored.length) continue;
  validate(stored.map((r) => r.request), category, count);
  // Ids fix the dev/test split, so a resumed file must carry exactly the ids this run would write.
  const ids = idsFor(category, count);
  if (stored.length !== count || stored.some((r, i) => r.id !== ids[i])) throw new Error(`invalid seeds for category ${category}`);
  done.add(category);
}

let cost = 0;
let pending = false;
for (const { category, count, gloss } of CATEGORIES) {
  if (done.has(category)) continue;
  const prompt = `Category: ${category}\nArea: ${gloss}\nGenerate exactly ${count} distinct requests.`;
  const res = await modelJson(prompt, schema, { backend, model, effort: values.effort, system: SYSTEM, out: join(dirname(values.out), values.prefix) }).catch((error: unknown) => {
    // Parse and schema errors can quote model output; backend failures carry loadout's own text.
    throw error instanceof SyntaxError || error instanceof z.ZodError ? new Error(`invalid seeds for category ${category}`) : error;
  });
  if (!res) { pending = true; continue; }
  const requests = validate(res.output.requests, category, count);
  const ids = idsFor(category, count);
  const rows = requests.map((request, i) => ({ id: ids[i]!, category, request, generatedBy }));
  mkdirSync(dirname(values.out), { recursive: true });
  appendFileSync(values.out, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  cost += res.costUsd ?? 0;
  console.log(`generated ${category}  ${costLabel(backend, cost)}`);
}
if (!pending) console.log(`done, ${costLabel(backend, cost)} → ${values.out}`);
