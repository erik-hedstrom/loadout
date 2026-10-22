import { lstatSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { readConfined } from '../src/library.js';
import { checkFiles, confinedPath, copyTree, executeSandbox, type Sandbox } from './b11-sandbox.js';
import type { B11Task } from './b11-types.js';
import { HarnessError } from './b11-errors.js';

export function fixturePath(root: string, category: 'workspaces' | 'checks', reference: string): string {
  const prefix = `bench/data/b11/${category}/`;
  return confinedPath(join(root, category), reference.startsWith(prefix) ? reference.slice(prefix.length) : reference);
}

/** Inventory the trusted fixture, without importing agent code to discover its tests. */
function cases(source: string, file: string): { file: string; name: string; line: number; column: number }[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const names = new Set<string>();
  for (const statement of tree.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === 'node:test') {
      const clause = statement.importClause;
      if (clause?.name) names.add(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
        if ((binding.propertyName ?? binding.name).text === 'test') names.add(binding.name.text);
      }
    }
  }
  const result: ReturnType<typeof cases> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)) {
      const [name, body] = node.arguments;
      // B11 fixtures declare literal, unconditional top-level cases with no options or subtests.
      if (!ts.isExpressionStatement(node.parent) || node.parent.parent !== tree || node.arguments.length !== 2 || !name || !ts.isStringLiteral(name) || !body || !(ts.isArrowFunction(body) || ts.isFunctionExpression(body))) throw new HarnessError('unsupported hidden test declaration');
      const position = tree.getLineAndCharacterOfPosition(node.getStart(tree));
      result.push({ file, name: name.text, line: position.line + 1, column: position.character + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (!result.length) throw new HarnessError('no hidden test cases');
  return result;
}

function runner(expected: ReturnType<typeof cases>, files: string[]): string {
  // Only the test-runner parent loads this file. run() imports agent code in isolated children.
  // The nonce is generated in that parent's memory, not stored in agent-readable source or files.
  return `const { randomBytes } = require('node:crypto');
const { run } = require('node:test');
const write = process.stdout.write.bind(process.stdout);
const nonce = randomBytes(32).toString('hex');
write('B11_CHECK_STARTED:' + nonce + '\\n');
const expected = ${JSON.stringify(expected)};
const key = data => JSON.stringify([data.file, data.name, data.line, data.column]);
const remaining = new Set(expected.map(key));
let failed = false;
const stream = run({ files: ${JSON.stringify(files)}, execArgv: [], concurrency: 1 });
stream.on('data', event => {
  if (event.type === 'test:fail') failed = true;
  if (event.type === 'test:pass') {
    const data = event.data;
    if (data.skip || data.todo || !remaining.delete(key(data))) failed = true;
  }
});
stream.on('error', () => { failed = true; });
stream.on('end', () => {
  write('B11_CHECK_' + (!failed && remaining.size === 0 ? 'PASS' : 'FAIL') + ':' + nonce + '\\n');
});
`;
}

export async function runCheck(task: B11Task, s: Sandbox, data: string): Promise<'pass' | 'fail' | 'sandbox-failure'> {
  if (task.check.type === 'files') {
    try { return checkFiles(s.workspace, task.check) ? 'pass' : 'fail'; } catch { return 'fail'; }
  }
  const destination = join(s.workspace, '.b11-checks');
  if (lstatSync(destination, { throwIfNoEntry: false })) return 'fail';
  copyTree(fixturePath(data, 'checks', task.check.tests), destination);
  const files = readdirSync(destination).filter(file => /\.(?:mjs|cjs|js)$/.test(file)).sort();
  if (!files.length) throw new HarnessError('no hidden node tests');
  const expected = files.flatMap(file => cases(readConfined(destination, file, 1024 * 1024).toString('utf8'), `/work/.b11-checks/${file}`));
  const scratch = mkdtempSync(join(realpathSync(tmpdir()), 'b11-check-runner-'));
  try {
    const script = join(scratch, 'runner.cjs');
    writeFileSync(script, runner(expected, files.map(file => `/work/.b11-checks/${file}`)));
    const checkSandbox: Sandbox & { readonlyMounts: { source: string; destination: string }[] } = {
      ...s, readonlyMounts: [
        { source: destination, destination: '/work/.b11-checks' },
        { source: script, destination: '/b11-check-runner.cjs' },
      ],
    };
    const result = await executeSandbox(checkSandbox, ['/usr/bin/node', '/b11-check-runner.cjs'], 15000, false);
    if (!/^B11_CHECK_STARTED:[a-f0-9]{64}\n/.test(result.stdout)) return 'sandbox-failure';
    return !result.timedOut && result.code === 0 && /^B11_CHECK_STARTED:([a-f0-9]{64})\nB11_CHECK_PASS:\1\n$/.test(result.stdout) ? 'pass' : 'fail';
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
