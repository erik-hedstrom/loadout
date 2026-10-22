import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('retains partial chunks and handles boundaries', () => {
  const input = Object.freeze([1, 2, 3, 4, 5]);
  assert.deepEqual(api.chunks(input, 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(api.chunks(input, 9), [[1, 2, 3, 4, 5]]);
  assert.deepEqual(api.chunks([1, 2], 1), [[1], [2]]);
  assert.deepEqual(api.chunks([], 3), []);
  const mutable = [1, 2];
  const result = api.chunks(mutable, 2);
  result[0].push(3);
  assert.deepEqual(mutable, [1, 2]);
});
test('rejects invalid sizes including on empty input', () => {
  for (const size of [0, -1, 1.5, NaN, Infinity, '2']) assert.throws(() => api.chunks([], size), RangeError);
});
