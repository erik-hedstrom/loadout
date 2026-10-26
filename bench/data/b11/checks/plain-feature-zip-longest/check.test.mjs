import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { deepEqual: strictAssert.deepEqual, equal: strictAssert.equal };
const { Object } = globalThis;

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('fills only missing positions on either side', () => {
  assert.equal(typeof api.zipLongest, 'function', 'the requested export must exist');
  assert.deepEqual(api.zipLongest(Object.freeze([1, undefined, 3]), Object.freeze(['a'])), [[1, 'a'], [undefined, null], [3, null]]);
  assert.deepEqual(api.zipLongest([1], ['a', 'b'], 0), [[1, 'a'], [0, 'b']]);
  const fill = {};
  assert.equal(api.zipLongest([], [1], fill)[0][0], fill);
});
test('supports empty and equal lengths and preserves zipShortest', () => {
  assert.equal(typeof api.zipLongest, 'function', 'the requested export must exist');
  assert.deepEqual(api.zipLongest([], []), []);
  assert.deepEqual(api.zipLongest([1], [2]), [[1, 2]]);
  assert.deepEqual(api.zipLongest([1], []), [[1, null]]);
  assert.deepEqual(api.zipShortest([1, 2], ['a']), [[1, 'a']]);
});
