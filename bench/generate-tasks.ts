/**
 * Generate benchmark tasks: for each sampled skill, a realistic request a
 * developer would type into a coding agent where that skill would help,
 * without naming it. Plus tasks that need no skill at all.
 *
 *   npx tsx bench/generate-tasks.ts [--model sonnet] [--seed 7]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { claudeJson, DATA, loadCorpus, pool, readJsonl, rng, sample, type CorpusSkill, type Task } from './lib.js';

const { values } = parseArgs({
  options: {
    model: { type: 'string', default: 'sonnet' },
    seed: { type: 'string', default: '7' },
    popular: { type: 'string', default: '20' },
    perBucket: { type: 'string', default: '50' },
    none: { type: 'string', default: '30' },
    batch: { type: 'string', default: '10' },
    concurrency: { type: 'string', default: '4' },
  },
});
const BATCH = Number(values.batch);

const REPO_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    files: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    dependencies: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    languages: { type: 'array', items: { type: 'string' }, maxItems: 4 },
  },
  required: ['name', 'files', 'dependencies', 'languages'],
};

const SKILL_TASKS_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          scope: { type: 'string', enum: ['repo', 'general'] },
          task: { type: 'string' },
          repo: REPO_SCHEMA,
        },
        required: ['name', 'scope', 'task', 'repo'],
      },
    },
  },
  required: ['tasks'],
};

const NONE_TASKS_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: { type: 'object', properties: { task: { type: 'string' }, repo: REPO_SCHEMA }, required: ['task', 'repo'] },
    },
  },
  required: ['tasks'],
};

const SYSTEM = 'You write realistic evaluation data for a system that routes coding-agent requests to agent skills. Output only the requested JSON.';

const REPO_RULES = `"repo" describes the repository the developer is working in, as cheap signals: its name, 5-10 top-level files/dirs, up to 10 package dependencies, and 1-4 file extensions (e.g. "ts", "py").`;

function skillPrompt(skills: CorpusSkill[]): string {
  const list = skills.map((s) => `- name: ${s.name}\n  source repo: ${s.repo}\n  description: ${s.description}`).join('\n');
  return `For EACH skill below, write one task: the message a developer would type into a coding agent (Claude Code, Codex) in a situation where this skill would clearly help.

Rules for "task":
- 1-3 sentences, first person or imperative, the way real users write. Concrete: mention files, symptoms, data, or goals.
- Never mention the skill's name, and do not copy distinctive phrases from its description. Describe the problem or goal, not the tool.
- If the description is not in English, still write the task in English.

"scope": "repo" if the skill only makes sense inside its specific source repository/project (e.g. a release script for one codebase); "general" if anyone could use it.
${REPO_RULES} For "repo" scope, use the source repository. For "general" scope, invent a plausible repository where this task would come up.

Echo each skill's "name" exactly. Return exactly ${skills.length} tasks, in order.

Skills:
${list}`;
}

function nonePrompt(n: number): string {
  return `Write ${n} everyday tasks a developer would type into a coding agent that need NO specialised skill or tool: a strong agent that can read and edit code and run shell commands handles them fine (e.g. fix an off-by-one, rename a symbol, add a unit test, explain a function, tweak a config value). Vary languages, frameworks and phrasing; 1-3 sentences each, concrete.
${REPO_RULES}`;
}

const isEnglish = (text: string) => text.replace(/[\x00-\x7f]/g, '').length / text.length < 0.03;

function bucket(rank: number): Task['bucket'] {
  return rank <= 2000 ? 'head' : rank <= 8000 ? 'torso' : 'tail';
}

function toRepo(r: { name: string; files: string[]; dependencies: string[]; languages: string[] }): Task['repo'] {
  return { name: r.name, files: r.files, dependencies: r.dependencies, languages: Object.fromEntries(r.languages.map((l) => [l.replace(/^\./, ''), 1])) };
}

async function main() {
  const corpus = loadCorpus();
  const random = rng(Number(values.seed));
  const popularNames = new Set(readJsonl<{ name: string }>(join(DATA, 'popular.jsonl')).slice(0, 50).map((p) => p.name));
  const eligible = corpus.filter((s) => s.description.length >= 60 && isEnglish(s.description));

  const targets: { skill: CorpusSkill; bucket: Task['bucket'] }[] = [
    ...sample(eligible.filter((s) => popularNames.has(s.name)), Number(values.popular), random).map((skill) => ({ skill, bucket: 'popular' as const })),
  ];
  const taken = new Set(targets.map((t) => t.skill.name));
  for (const b of ['head', 'torso', 'tail'] as const) {
    const candidates = eligible.filter((s) => bucket(s.rank) === b && !taken.has(s.name) && !popularNames.has(s.name));
    targets.push(...sample(candidates, Number(values.perBucket), random).map((skill) => ({ skill, bucket: b })));
  }

  const batches: (typeof targets)[] = [];
  for (let i = 0; i < targets.length; i += BATCH) batches.push(targets.slice(i, i + BATCH));
  const noneBatches = Array.from({ length: Math.ceil(Number(values.none) / BATCH) }, (_, i) => Math.min(BATCH, Number(values.none) - i * BATCH));

  let cost = 0;
  let done = 0;
  const jobs = [...batches.map((b) => ({ kind: 'skill' as const, b })), ...noneBatches.map((n) => ({ kind: 'none' as const, n }))];
  const tasks: Task[] = [];
  let leaked = 0;

  await pool(jobs, Number(values.concurrency), async (job) => {
    if (job.kind === 'skill') {
      const res = await claudeJson<{ tasks: { name: string; scope: 'repo' | 'general'; task: string; repo: Parameters<typeof toRepo>[0] }[] }>(
        skillPrompt(job.b.map((t) => t.skill)),
        SKILL_TASKS_SCHEMA,
        { model: values.model!, system: SYSTEM },
      );
      cost += res.costUsd;
      for (const t of job.b) {
        const out = res.output.tasks.find((o) => o.name === t.skill.name);
        if (!out) continue;
        // Drop tasks that leak a multi-word skill name, with hyphens or spaces ("write behat scenarios").
        const parts = t.skill.name.split('-').filter(Boolean);
        const leak = new RegExp(`(?<![a-z0-9])${parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[- ]')}(?![a-z0-9])`);
        if (parts.length >= 2 && leak.test(out.task.toLowerCase())) {
          leaked++;
          continue;
        }
        tasks.push({ id: '', task: out.task, repo: toRepo(out.repo), gold: [t.skill.name], scope: out.scope, bucket: t.bucket });
      }
    } else {
      const res = await claudeJson<{ tasks: { task: string; repo: Parameters<typeof toRepo>[0] }[] }>(nonePrompt(job.n), NONE_TASKS_SCHEMA, {
        model: values.model!,
        system: SYSTEM,
      });
      cost += res.costUsd;
      for (const out of res.output.tasks) tasks.push({ id: '', task: out.task, repo: toRepo(out.repo), gold: [], scope: 'none' });
    }
    console.error(`  ${++done}/${jobs.length} batches, $${cost.toFixed(3)}`);
  });

  // Stable order and ids: by bucket, then gold name.
  const order = { popular: 0, head: 1, torso: 2, tail: 3, undefined: 4 } as Record<string, number>;
  tasks.sort((a, b) => order[String(a.bucket)]! - order[String(b.bucket)]! || (a.gold[0] ?? a.task).localeCompare(b.gold[0] ?? b.task));
  tasks.forEach((t, i) => (t.id = `t${String(i + 1).padStart(3, '0')}`));

  writeFileSync(join(DATA, 'tasks.jsonl'), tasks.map((t) => JSON.stringify(t)).join('\n') + '\n');
  console.log(`wrote ${tasks.length} tasks (${leaked} dropped for leaking the skill name), generation cost $${cost.toFixed(3)}`);
}

await main();
