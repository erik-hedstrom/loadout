import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = resolve(process.cwd(), 'index.mjs');
const api = await import(pathToFileURL(modulePath).href);

test('preserves leaf order and reference identity without changing arrays', () => {
  const leaf = {};
  const input = Object.freeze([Object.freeze([1, Object.freeze([null, undefined])]), 'xy', leaf, Object.freeze([]), 2]);
  assert.deepEqual(api.flatten(input), [1, null, undefined, 'xy', leaf, 2]);
  assert.deepEqual(api.flatten([]), []);
});
test('handles deep nesting with no self call or flattening built-ins', () => {
  const source = readFileSync(modulePath, 'utf8');
  const withoutDeclaration = source.replace(/\bfunction\s+flatten\s*\(/g, 'function(');
  assert.doesNotMatch(withoutDeclaration, /\bflatten\s*\(/, 'flatten must not call itself');
  assert.doesNotMatch(source, /\.\s*(?:flat|flatMap)\s*\(/);
  let input = ['leaf'];
  for (let depth = 0; depth < 20000; depth++) input = [input];
  assert.deepEqual(api.flatten(input), ['leaf']);
});
