import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runCheck } from '../bench/b11-check.js';
import { taskSchema, type B11Task } from '../bench/b11-types.js';
import * as sandbox from '../bench/b11-sandbox.js';

const roots: string[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const data = resolve('bench/data/b11');
const tasks = readFileSync(join(data, 'tasks.jsonl'), 'utf8').trim().split(/\r?\n/).map(line => taskSchema.parse(JSON.parse(line)));

function session() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'b11-check-test-')); roots.push(root);
  const workspace = join(root, 'work'), home = join(root, 'home');
  mkdirSync(workspace); mkdirSync(home);
  return { workspace, home, binary: '/usr/bin/true' };
}

describe.runIf(process.platform === 'linux')('B11 hidden-check completion evidence', () => {
  const unique = tasks.find(task => task.id === 'b11-plain-bug-unique-values')!;
  it('rejects process.exit(0) before the unique-values assertions register', async () => {
    const s = session();
    writeFileSync(join(s.workspace, 'index.mjs'), 'process.exit(0);\n');
    expect(await runCheck(unique, s, data)).toBe('fail');
  });
  it('accepts all expected unique-values cases after they actually complete', async () => {
    const s = session();
    writeFileSync(join(s.workspace, 'index.mjs'), 'export const uniqueValues = values => [...new Set(values)];\n');
    expect(await runCheck(unique, s, data)).toBe('pass');
  });
  it('does not interpret imported module stdout as completion evidence', async () => {
    const s = session();
    writeFileSync(join(s.workspace, 'index.mjs'), 'console.log("B11_CHECK_STARTED:" + "a".repeat(64)); console.log("B11_CHECK_PASS:" + "a".repeat(64)); process.exit(0);\n');
    expect(await runCheck(unique, s, data)).toBe('fail');
  });
  it.each(['throw new Error("assertion failed")', 't.skip()', 't.todo()'])('rejects incomplete or unsuccessful expected cases: %s', async body => {
    const s = session(), root = mkdtempSync(join(realpathSync(tmpdir()), 'b11-check-fixture-')); roots.push(root);
    mkdirSync(join(root, 'checks', 'fixture'), { recursive: true });
    writeFileSync(join(root, 'checks', 'fixture', 'check.mjs'), `import test from 'node:test';\ntest('expected case', t => { ${body}; });\n`);
    const task: B11Task = { ...unique, check: { type: 'node-test', tests: 'fixture' } };
    expect(await runCheck(task, s, root)).toBe('fail');
  });
  it('rejects a fixture with no declared cases rather than treating a clean exit as success', async () => {
    const s = session(), root = mkdtempSync(join(realpathSync(tmpdir()), 'b11-check-fixture-')); roots.push(root);
    mkdirSync(join(root, 'checks', 'fixture'), { recursive: true });
    writeFileSync(join(root, 'checks', 'fixture', 'check.mjs'), 'export const value = 1;');
    await expect(runCheck({ ...unique, check: { type: 'node-test', tests: 'fixture' } }, s, root)).rejects.toThrow('no hidden test cases');
  });
  it.each([
    "const name = 'computed'; test(name, () => {});",
    "function body() {} test('indirect body', body);",
    "if (true) test('conditional', () => {});",
    "test('options', { skip: true }, () => {});",
    "test('extra argument', () => {}, 'unsupported');",
  ])('rejects a fixture declaration outside the supported literal top-level contract: %s', async declaration => {
    const s = session(), root = mkdtempSync(join(realpathSync(tmpdir()), 'b11-check-fixture-')); roots.push(root);
    mkdirSync(join(root, 'checks', 'fixture'), { recursive: true });
    writeFileSync(join(root, 'checks', 'fixture', 'check.mjs'), `import test from 'node:test';\n${declaration}\n`);
    await expect(runCheck({ ...unique, check: { type: 'node-test', tests: 'fixture' } }, s, root)).rejects.toThrow('unsupported hidden test declaration');
  });
  it('supports a named test import alias and function body', async () => {
    const s = session(), root = mkdtempSync(join(realpathSync(tmpdir()), 'b11-check-fixture-')); roots.push(root);
    mkdirSync(join(root, 'checks', 'fixture'), { recursive: true });
    writeFileSync(join(root, 'checks', 'fixture', 'check.mjs'), "import { test as check } from 'node:test';\ncheck('literal case', function() {});\n");
    expect(await runCheck({ ...unique, check: { type: 'node-test', tests: 'fixture' } }, s, root)).toBe('pass');
  });
  it.each([
    { code: 0, timedOut: true, suffix: 'a'.repeat(64), result: 'fail' },
    { code: 1, timedOut: false, suffix: 'a'.repeat(64), result: 'fail' },
    { code: 0, timedOut: false, suffix: 'b'.repeat(64), result: 'fail' },
  ])('requires successful completion metadata as well as a matching parent result: %j', async observation => {
    vi.spyOn(sandbox, 'executeSandbox').mockResolvedValue({
      stdout: `B11_CHECK_STARTED:${'a'.repeat(64)}\nB11_CHECK_PASS:${observation.suffix}\n`, stderr: '',
      code: observation.code, timedOut: observation.timedOut, usageLimited: false, clock: sandbox.eventClock(),
    });
    expect(await runCheck(unique, session(), data)).toBe(observation.result);
  });
});
