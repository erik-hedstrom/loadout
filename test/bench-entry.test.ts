import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it, type TestContext } from 'vitest';
import { isEntry } from '../bench/lib.js';

const root = join(import.meta.dirname, '..');
const scripts = ['judge', 'stability', 'sweep', 'hook-latency', 'overhead', 'mcp-overhead', 'need-audit', 'ab'];
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

  it('keeps module lookup errors strict', () => {
    const argv = process.argv;
    try {
      process.argv = [process.execPath, import.meta.filename];
      expect(() => isEntry(pathToFileURL(join(temp, 'missing-module.ts')).href)).toThrow(/ENOENT/);
    } finally {
      process.argv = argv;
    }
  });

  it('propagates unexpected argv lookup errors', () => {
    const argv = process.argv;
    try {
      process.argv = [process.execPath, '\0'];
      expect(() => isEntry(import.meta.url)).toThrow(/null bytes/);
    } finally {
      process.argv = argv;
    }
  });

  it.each(['none', 'existing', 'missing', 'stdin', 'not-directory', 'deleted'] as const)('imports guarded scripts without running main (entry: %s)', (entry) => {
    const imports = scripts.map((script) => `await import(${JSON.stringify(pathToFileURL(join(root, 'bench', `${script}.ts`)).href)});`).join('\n');
    const code = `${imports}\nconsole.log('imports completed');`;
    let args: string[];
    if (entry === 'deleted') {
      const importer = join(temp, 'deleted-importer.mjs');
      writeFileSync(importer, `import { unlinkSync } from 'node:fs';\nunlinkSync(import.meta.filename);\n${code}`);
      args = [importer];
    } else {
      const entries = {
        none: [], existing: [import.meta.filename], missing: [join(temp, 'missing-entry.ts')],
        stdin: ['-'], 'not-directory': [join(import.meta.filename, 'child')],
      };
      args = ['--input-type=module', '-e', code, ...entries[entry]];
    }
    const result = run(args);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe('imports completed\n');
    expect(result.stderr).toBe('');
  });
});
