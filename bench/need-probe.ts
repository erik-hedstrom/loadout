/**
 * Which "does this request need a skill?" questions separate gold tasks from
 * no-skill tasks? Asks candidate questions for every task in one Jev request,
 * using the 20k-library shortlists stored by a route-bench run for the
 * questions that look at candidates. Writes answers for offline analysis.
 *
 *   TYPESAFE_API_KEY=... npx tsx bench/need-probe.ts <route-bench results dir>
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { jevBaseUrl, loadConfig, resolveApiKey } from '../src/config.js';
import { jevClient, type Question } from '../src/jev.js';
import { loadCorpus, loadTasks, pool, readJsonl, RESULTS, splitOf, type Row } from './lib.js';

const STATE_QUESTIONS: Record<string, string> = {
  // current
  need_procedure:
    'Would an expert doing this request follow a specific documented procedure, tool, or service workflow, rather than general programming knowledge alone?',
  need_named: 'Does the request involve a specific product, platform, service, file format, framework, or project-specific process?',
  general_enough:
    'Could a strong general programmer complete this request well using only reading and editing code and running ordinary commands, without any special instructions?',
  // adversarial review (Codex)
  steps_unspecified: 'Does the requested action have a prescribed sequence of steps that is not specified in the request?',
  convention_unspecified: 'Does the requested action need to follow a project-specific convention that is not specified in the request?',
  external_service: 'Does carrying out the requested action require calling an external service?',
  // new
  domain_knowledge:
    "Does doing this request well depend on specialised knowledge outside general software engineering, such as a particular vendor's API, product, file format, or business domain?",
  tool_details: 'Does the request involve a specific tool, service, platform, or file format whose exact usage details matter for doing it correctly?',
};

const dir = process.argv[2];
if (!dir) throw new Error('usage: need-probe.ts <route-bench results dir>');
const rows = readJsonl<Row>(join(dir, 'rows.jsonl'))
  .filter((r) => r.arm === 'loadout' && r.size === 20000 && r.raw);
const byTask = new Map(rows.map((r) => [r.task, r]));
const corpus = new Map(loadCorpus().map((s) => [s.name, s]));
const tasks = loadTasks();

const config = loadConfig();
const apiKey = resolveApiKey(config);
if (!apiKey) throw new Error('needs TYPESAFE_API_KEY');
const client = jevClient({ apiKey, baseUrl: jevBaseUrl(config), model: config.jev.model, timeoutMs: 30_000 });

const out = join(RESULTS, `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-need-probe`);
mkdirSync(out, { recursive: true });
let cost = 0;

await pool(tasks, 4, async (task) => {
  const row = byTask.get(task.id);
  if (!row?.raw) return;
  const raw = row.raw;
  const describe = (name: string) => ({ name, description: corpus.get(name)?.description.slice(0, 400) ?? '' });
  const top = [...raw.shortlist].sort((a, b) => (raw.close.pick[b] ?? 0) - (raw.close.pick[a] ?? 0))[0]!;
  const state = {
    request: task.task,
    repository: { name: task.repo.name, top_level_files: task.repo.files, dependencies: task.repo.dependencies, languages: Object.keys(task.repo.languages) },
  };
  const questions: Record<string, Question> = Object.fromEntries(Object.entries(STATE_QUESTIONS).map(([id, text]) => [id, { type: 'noul', instructions: text }]));
  questions.instructions_available = {
    type: 'noul',
    instructions: { question: 'Would one of these skills provide concrete instructions for carrying out the requested action?', skills: raw.shortlist.map(describe) },
  };
  questions.top_specific = {
    type: 'noul',
    instructions: {
      question:
        'Is this skill specifically about something the request names or clearly involves (a product, service, tool, file format, framework, or project process), rather than a general coding practice?',
      skill: describe(top),
    },
  };
  const res = await client.ask(state, questions);
  cost += (res.usage.input_tokens / 1e6) * config.jev.inputPricePerMTok;
  const answers = Object.fromEntries(Object.entries(res.answers).map(([k, a]) => [k, a.type === 'noul' ? a.noul : null]));
  appendFileSync(
    join(out, 'answers.jsonl'),
    JSON.stringify({ task: task.id, split: splitOf(task.id), gold: task.gold, scope: task.scope, top, answers, model: res.model }) + '\n',
  );
});
console.log(`answers: ${out}/answers.jsonl  cost $${cost.toFixed(4)}`);
