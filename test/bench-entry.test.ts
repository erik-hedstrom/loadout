import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it, type TestContext } from 'vitest';
import { isEntry } from '../bench/lib.js';

const root = join(import.meta.dirname, '..');
const scripts = ['judge', 'stability', 'sweep', 'hook-latency', 'overhead', 'mcp-overhead', 'need-audit'];
const temp = mkdtempSync(join(tmpdir(), 'loadout-bench-entry-'));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

function run(args: string[]) {
  return spawnSync(process.execPath, ['--import', 'tsx', ...args], {
    cwd: root, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, LOADOUT_HOME: temp },
  });
}

function linkScript(script: string, context: TestContext): string {
  const link = join(mkdtempSync(join(temp, 'link-')), `${script}.ts`);
  try {
    symlinkSync(join(root, 'bench', `${script}.ts`), link, 'file');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'EACCES' || code === 'ENOTSUP') {
      context.skip(`symlink creation denied on ${process.platform}: ${code}`);
    }
    throw error;
  }
  return link;
}

describe('bench entry points', () => {
  it.each(scripts)('runs %s directly and rejects invalid arguments before any model calls', (script) => {
    const result = run([join('bench', `${script}.ts`), '--unknown-entry-option']);
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/Unknown option|usage: stability\.ts/);
  });

  it.for(scripts)('runs %s through a symlink', (script, context) => {
    const link = linkScript(script, context);
    const result = run([link, '--unknown-entry-option']);
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toMatch(/Unknown option|usage: stability\.ts/);
  });

  it('canonicalizes the module URL as well as the entry path', (context) => {
    const link = linkScript('lib', context);
    const argv = process.argv;
    try {
      process.argv = [process.execPath, join(root, 'bench', 'lib.ts')];
      expect(isEntry(pathToFileURL(link).href)).toBe(true);
    } finally {
      process.argv = argv;
    }
  });

  it('prints the same stability report through a symlink as a direct invocation', (context) => {
    const link = linkScript('stability', context);
    writeFileSync(join(temp, 'decisions.jsonl'), JSON.stringify({
      id: 'a', request: 'Fixture', loaded: [], offered: [], ms: 1, costUsd: 0,
    }) + '\n');
    const direct = run([join('bench', 'stability.ts'), temp, temp]);
    const linked = run([link, temp, temp]);
    expect(direct.status, direct.stderr).toBe(0);
    expect(linked.status, linked.stderr).toBe(0);
    expect(direct.stdout).toContain('# Sweep stability');
    expect(linked.stdout).toBe(direct.stdout);
  });

  it.each([false, true])('imports guarded scripts without running main (existing argv entry: %s)', (entry) => {
    const imports = scripts.map((script) => `await import('./bench/${script}.ts');`).join('\n');
    const argv = entry ? `process.argv[1] = ${JSON.stringify(import.meta.filename)};` : '';
    const result = run(['--input-type=module', '-e', `${argv}\n${imports}\nconsole.log('imports completed');`]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe('imports completed\n');
    expect(result.stderr).toBe('');
  });
});
