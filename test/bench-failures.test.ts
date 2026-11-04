import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, it, vi } from 'vitest';
import ts from 'typescript';

const secret = 'FAKE-diagnostic/key+value';
const previousExitCode = process.exitCode;
const roots: string[] = [];
const temp = () => { const root = mkdtempSync(join(tmpdir(), 'loadout-failure-')); roots.push(root); return root; };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); process.exitCode = previousExitCode; for (const root of roots) rmSync(root, { recursive: true, force: true }); roots.length = 0; });

it.each([secret, secret.replaceAll('-', '%2d'), Buffer.from(secret).toString('base64url')])('sanitizes judge and B7 thrown diagnostics (%s)', (value) => {
  const root = temp(); mkdirSync(join(root, 'library', 'skills'), { recursive: true });
  writeFileSync(join(root, 'decisions.jsonl'), [1, 2].map(() => JSON.stringify({ id: value, request: 'safe', loaded: [], offered: [], shortlist: [] })).join('\n'));
  for (const [file, args] of [['judge', [root, '--backend', 'files']], ['mcp-overhead', ['--' + value]]] as const) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', `bench/${file}.ts`, ...args], {
      encoding: 'utf8', timeout: 20_000, env: { ...process.env, LOADOUT_HOME: root, TYPESAFE_API_KEY: secret, PGPASSWORD: 'FAKE-test-postgres-key' },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('<credential>');
    expect(result.stdout + result.stderr).not.toContain(value);
    expect(result.stdout + result.stderr).not.toContain(secret);
    expect(result.stderr).not.toMatch(/\n\s+at |\[cause\]/);
  }
});

it('every benchmark entrypoint routes its top-level failures through the shared helper', () => {
  const entries: string[] = [];
  for (const file of readdirSync('bench').filter((file) => file.endsWith('.ts'))) {
    const text = readFileSync(join('bench', file), 'utf8'), source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    let entry = false, boundary = false;
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) return;
      if (ts.isAwaitExpression(node)) entry = true;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        entry ||= ['isEntry', 'parseArgs'].includes(node.expression.text);
        boundary ||= node.expression.text === 'benchmarkFailure';
      }
      if (ts.isPropertyAccessExpression(node)) entry ||= node.getText(source) === 'process.argv';
      // .catch(benchmarkFailure) passes the boundary as a callback.
      if (ts.isIdentifier(node) && node.text === 'benchmarkFailure' && ts.isCallExpression(node.parent)) boundary = true;
      ts.forEachChild(node, visit);
    };
    source.statements.filter((node) => !ts.isImportDeclaration(node)).forEach(visit);
    if (entry) { entries.push(file); expect(boundary, file).toBe(true); }
  }
  expect(entries).toEqual(expect.arrayContaining(['judge.ts', 'mcp-overhead.ts', 'invoke.ts', 'scan-secrets.ts', 'b11.ts', 'handwritten.ts']));
  expect(entries.length).toBeGreaterThan(20);
});

it('never prints an error stack or cause and fails closed if credential resolution fails', async () => {
  const config = await import('../src/config.js');
  const { benchmarkFailure } = await import('../bench/redact.js');
  const print = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubEnv('LOADOUT_HOME', temp()); vi.stubEnv('TYPESAFE_API_KEY', secret);
  const error = new Error('safe diagnostic', { cause: new Error(Buffer.from(secret).toString('base64')) });
  error.stack = secret;
  benchmarkFailure(error);
  expect(print).toHaveBeenLastCalledWith('safe diagnostic');
  vi.spyOn(config, 'loadConfig').mockImplementation(() => { throw new Error(secret); });
  benchmarkFailure(new Error(secret));
  expect(print).toHaveBeenLastCalledWith('Benchmark failed; details suppressed.');
  expect(process.exitCode).toBe(1);
});
