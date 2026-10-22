import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { deepEqual: strictAssert.deepEqual };
const { Object } = globalThis;

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('merges touching chains as well as overlaps', () => {
  const input = Object.freeze([Object.freeze([4, 7]), Object.freeze([1, 2]), Object.freeze([2, 4]), Object.freeze([9, 9])]);
  assert.deepEqual(api.mergeIntervals(input), [[1, 7], [9, 9]]);
  assert.deepEqual(api.mergeIntervals([[0, 10], [2, 3], [10, 11], [-2, 0]]), [[-2, 11]]);
});
test('keeps gaps, empty inputs, and pair independence', () => {
  assert.deepEqual(api.mergeIntervals([]), []);
  assert.deepEqual(api.mergeIntervals([[3, 4], [-1, 0]]), [[-1, 0], [3, 4]]);
  const pair = [1, 2];
  const result = api.mergeIntervals([pair]);
  result[0][0] = 0;
  assert.deepEqual(pair, [1, 2]);
});
