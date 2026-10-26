import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { deepEqual: strictAssert.deepEqual, equal: strictAssert.equal, throws: strictAssert.throws };
const { Object, RangeError } = globalThis;

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('averages full windows without changing input', () => {
  assert.equal(typeof api.movingAverage, 'function', 'the requested export must exist');
  assert.deepEqual(api.movingAverage(Object.freeze([2, 4, 8, 10]), 2), [3, 6, 9]);
  assert.deepEqual(api.movingAverage([-3, 0, 3, 6], 3), [0, 3]);
  assert.deepEqual(api.movingAverage([1.5, 2.5], 1), [1.5, 2.5]);
  assert.deepEqual(api.movingAverage([1, 2], 2), [1.5]);
  assert.deepEqual(api.movingAverage([1], 2), []);
  assert.deepEqual(api.movingAverage([], 1), []);
  assert.equal(api.mean([]), null);
  assert.equal(api.mean([1, 3]), 2);
});
test('rejects invalid widths', () => {
  assert.equal(typeof api.movingAverage, 'function', 'the requested export must exist');
  for (const width of [0, -2, 0.5, Infinity, NaN, '2']) assert.throws(() => api.movingAverage([], width), RangeError);
});
