import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { readFileSync as nodeReadFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { deepEqual: strictAssert.deepEqual, doesNotMatch: strictAssert.doesNotMatch, match: strictAssert.match, notEqual: strictAssert.notEqual };
const { Object } = globalThis;
const readFileSync = nodeReadFileSync;

const modulePath = resolve(process.cwd(), 'index.mjs');
const api = await import(pathToFileURL(modulePath).href);

test('preserves membership, order, duplicates and identity', () => {
  const first = {}, second = {};
  const values = Object.freeze([2, NaN, first, 2, second, 0, '2']);
  const allowed = Object.freeze([first, NaN, 2, -0]);
  assert.deepEqual(api.allowedValues(values, allowed), [2, NaN, first, 2, 0]);
  assert.deepEqual(api.allowedValues([], allowed), []);
  assert.deepEqual(api.allowedValues(values, []), []);
  assert.notEqual(api.allowedValues(values, allowed), values);
});
test('precomputes membership using Set without includes', () => {
  const source = readFileSync(modulePath, 'utf8');
  assert.doesNotMatch(source, /\.\s*includes\s*\(/);
  assert.match(source, /new\s+Set\s*\(/, 'create the membership set once per call');
});
