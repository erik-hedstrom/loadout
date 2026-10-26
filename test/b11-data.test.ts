import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { serverSpecs, serverTools } from '../bench/mcp-fixtures.js';
import { escapeSkillTags } from '../src/launch.js';
import { parseFrontmatter, readConfined } from '../src/library.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = join(root, 'bench/data/b11');
const relativePath = z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[a-zA-Z0-9_./-]+$/);
const taskSchema = z.object({
  id: z.string().regex(/^b11-[a-z0-9-]+$/),
  kind: z.enum(['skill-needle', 'mcp-needle', 'plain']),
  prompt: z.string().min(40),
  workspace: relativePath.regex(/^bench\/data\/b11\/workspaces\/[a-z0-9-]+$/),
  check: z.discriminatedUnion('type', [
    z.object({ type: z.literal('files'), path: relativePath, all: z.array(z.string().min(1)).min(1), none: z.array(z.string().min(1)) }).strict(),
    z.object({ type: z.literal('node-test'), tests: relativePath.regex(/^bench\/data\/b11\/checks\/[a-z0-9-]+$/) }).strict(),
  ]),
  needs: z.object({ skill: z.string().min(1).optional(), server: z.string().min(1).optional(), tool: z.string().min(1).optional() }).strict(),
}).strict();
type Task = z.infer<typeof taskSchema>;
const tasks = readFileSync(join(data, 'tasks.jsonl'), 'utf8').trimEnd().split('\n').map((line) => taskSchema.parse(JSON.parse(line)));
const canaries = z.array(z.object({
  server: z.string().min(1), tool: z.string().min(1), description: z.string().min(40),
  inputSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.string(), z.object({ type: z.enum(['string', 'integer', 'boolean']), description: z.string().optional(), enum: z.array(z.string()).optional() }).strict()),
    required: z.array(z.string()), additionalProperties: z.literal(false),
  }).strict(),
  args: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])), response: z.string().min(1),
}).strict()).parse(JSON.parse(readFileSync(join(data, 'mcp-canaries.json'), 'utf8')));

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

function check(task: Task, workspace: string): { passed: boolean; output: string } {
  if (task.check.type === 'files') {
    const path = join(workspace, task.check.path);
    const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
    return { passed: task.check.all.every((s) => text.includes(s)) && task.check.none.every((s) => !text.includes(s)), output: text };
  }
  const tests = files(resolve(root, task.check.tests)).filter((path) => path.endsWith('.test.mjs'));
  expect(tests.length).toBeGreaterThan(0);
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...tests], { cwd: workspace, encoding: 'utf8', timeout: 10_000 });
  if (result.error) throw result.error;
  const output = result.stdout + result.stderr;
  expect(output).toMatch(/# tests [1-9]\d*/);
  expect(output).not.toMatch(/ERR_MODULE_NOT_FOUND|SyntaxError/);
  return { passed: result.status === 0, output };
}

describe('B11 task data', () => {
  it('contains 72 unique tasks, 24 of each kind, with confined and separate fixtures', () => {
    expect(tasks).toHaveLength(72);
    expect(new Set(tasks.map((task) => task.id)).size).toBe(72);
    expect(new Set(tasks.map((task) => task.workspace)).size).toBe(72);
    for (const kind of ['skill-needle', 'mcp-needle', 'plain']) expect(tasks.filter((task) => task.kind === kind)).toHaveLength(24);
    for (const task of tasks) {
      expect(statSync(resolve(root, task.workspace)).isDirectory()).toBe(true);
      expect(statSync(join(data, 'solutions', task.id)).isDirectory()).toBe(true);
      expect(files(resolve(root, task.workspace)).some((path) => /solutions|checks|SKILL\.md/.test(path.slice(resolve(root, task.workspace).length)))).toBe(false);
      if (task.check.type === 'node-test') expect(statSync(resolve(root, task.check.tests)).isDirectory()).toBe(true);
      else expect(statSync(join(root, task.workspace, task.check.path)).isFile()).toBe(true);
      if (task.kind === 'plain') {
        expect(task.needs).toEqual({});
        expect(task.check.type).toBe('node-test');
        expect(files(resolve(root, task.workspace)).reduce((n, path) => n + readFileSync(path, 'utf8').split('\n').length, 0)).toBeLessThan(150);
      } else expect(task.check.type).toBe('files');
    }
    for (const subtype of ['bug', 'feature', 'refactor']) expect(tasks.filter((task) => task.id.startsWith(`b11-plain-${subtype}-`))).toHaveLength(8);
  });

  it('resolves skill targets with explicit metadata and unchanged escaped text', () => {
    const skillTasks = tasks.filter((task) => task.kind === 'skill-needle');
    const names = readdirSync(join(data, 'skills'));
    expect(names).toHaveLength(24);
    expect(new Set(skillTasks.map((task) => task.needs.skill))).toEqual(new Set(names));
    for (const task of skillTasks) {
      expect(Object.keys(task.needs)).toEqual(['skill']);
      const name = task.needs.skill!;
      const body = readConfined(join(data, 'skills', name), 'SKILL.md', 64_000).toString('utf8');
      const meta = parseFrontmatter(body);
      expect(meta.name).toBe(name);
      expect(typeof meta.description).toBe('string');
      expect((meta.description as string).length).toBeGreaterThan(60);
      expect(escapeSkillTags(body)).toBe(body);
      expect(task.prompt).not.toContain(name);
    }
  });

  it('resolves one canary per MCP task across all 20 B7 servers without tool collisions', () => {
    const specs = serverSpecs(20);
    expect(canaries).toHaveLength(24);
    const keys = canaries.map((c) => `${c.server}/${c.tool}`);
    expect(new Set(keys).size).toBe(24);
    expect(new Set(canaries.map((c) => c.server))).toEqual(new Set(specs.map((s) => s.name)));
    const mcpTasks = tasks.filter((task) => task.kind === 'mcp-needle');
    expect(new Set(mcpTasks.map((task) => `${task.needs.server}/${task.needs.tool}`))).toEqual(new Set(keys));
    for (const task of mcpTasks) {
      expect(Object.keys(task.needs).sort()).toEqual(['server', 'tool']);
      expect(task.prompt).not.toContain(task.needs.tool!);
      const canary = canaries.find((c) => c.server === task.needs.server && c.tool === task.needs.tool)!;
      if (task.check.type !== 'files') throw new Error('MCP needles require a file check');
      for (const fact of task.check.all) {
        expect(canary.response).toContain(fact);
        expect(task.prompt).not.toContain(fact);
      }
    }
    for (const canary of canaries) {
      const spec = specs.find((s) => s.name === canary.server);
      expect(spec).toBeDefined();
      expect(serverTools(spec!).some((tool) => tool.name === canary.tool)).toBe(false);
      const { properties, required } = canary.inputSchema;
      expect(Object.keys(canary.args).sort()).toEqual([...required].sort());
      for (const [key, value] of Object.entries(canary.args)) {
        const { type, enum: choices } = properties[key]!;
        expect(type === 'integer' ? Number.isInteger(value) : typeof value === type).toBe(true);
        if (choices) expect(choices).toContain(value);
      }
      expect(escapeSkillTags(JSON.stringify(canary))).toBe(JSON.stringify(canary));
    }
  });

  it.each(tasks)('$id rejects the untouched workspace and accepts the reference solution', (task) => {
    const workspace = mkdtempSync(join(tmpdir(), 'loadout-b11-data-'));
    try {
      cpSync(resolve(root, task.workspace), workspace, { recursive: true });
      const untouched = check(task, workspace);
      expect(untouched.passed, untouched.output).toBe(false);
      cpSync(join(data, 'solutions', task.id), workspace, { recursive: true });
      const reference = check(task, workspace);
      expect(reference.passed, reference.output).toBe(true);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('rejects all six decoy solutions, including correct output contaminated by decoy traces', () => {
    const decoys = readdirSync(join(data, 'decoys'));
    expect(decoys).toHaveLength(6);
    for (const id of decoys) {
      const task = tasks.find((task) => task.id === id)!;
      expect(task.kind).toBe('skill-needle');
      expect(task.check.type).toBe('files');
      if (task.check.type !== 'files') throw new Error('Decoys require a file check');
      const decoyPath = join(data, 'decoys', id, task.check.path);
      expect(check(task, join(data, 'decoys', id)).passed).toBe(false);
      const decoy = readFileSync(decoyPath, 'utf8');
      expect(task.check.none.some((trace) => decoy.includes(trace))).toBe(true);
      const reference = readFileSync(join(data, 'solutions', id, task.check.path), 'utf8');
      const workspace = mkdtempSync(join(tmpdir(), 'loadout-b11-decoy-'));
      try {
        cpSync(join(data, 'solutions', id), workspace, { recursive: true });
        writeFileSync(join(workspace, task.check.path), reference + decoy);
        expect(check(task, workspace).passed).toBe(false);
      } finally {
        rmSync(workspace, { recursive: true, force: true });
      }
    }
  });
});
