import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { deepEqual: strictAssert.deepEqual, equal: strictAssert.equal, notEqual: strictAssert.notEqual, ok: strictAssert.ok };
const { Number, Object } = globalThis;

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('deduplicates numbers including NaN and signed zero', () => {
  const input = Object.freeze([NaN, 2, NaN, -0, 0, 2, 1]);
  const actual = api.uniqueValues(input);
  assert.equal(actual.length, 4);
  assert.ok(Number.isNaN(actual[0]));
  assert.equal(actual[1], 2);
  assert.ok(actual[2] === 0);
  assert.equal(actual[3], 1);
});
test('keeps identity, order, and a fresh result', () => {
  const first = {}, second = {};
  const input = Object.freeze([first, second, first, 'x', 'x', null, null]);
  assert.deepEqual(api.uniqueValues(input), [first, second, 'x', null]);
  assert.deepEqual(api.uniqueValues([]), []);
  const single = [first];
  assert.notEqual(api.uniqueValues(single), single);
});
