import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('sorts, removes duplicates, and joins only consecutive integers', () => {
  assert.equal(typeof api.integerRanges, 'function', 'the requested export must exist');
  assert.deepEqual(api.integerRanges(Object.freeze([5, 2, 3, 3, 8])), [[2, 3], [5, 5], [8, 8]]);
  assert.deepEqual(api.integerRanges([10, -2, 0, -1, 2, 11]), [[-2, 0], [2, 2], [10, 11]]);
  assert.deepEqual(api.integerRanges([4, 4]), [[4, 4]]);
});
test('handles empty input and safe-integer extremes', () => {
  assert.equal(typeof api.integerRanges, 'function', 'the requested export must exist');
  assert.deepEqual(api.integerRanges([]), []);
  assert.deepEqual(api.integerRanges([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1]), [[Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER]]);
  assert.equal(api.isInteger(1.5), false);
  assert.equal(api.isInteger(3), true);
});
