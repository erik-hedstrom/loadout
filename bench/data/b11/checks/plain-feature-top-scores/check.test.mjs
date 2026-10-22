import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('orders by score with stable ties and original references', () => {
  assert.equal(typeof api.topScores, 'function', 'the requested export must exist');
  const items = Object.freeze([Object.freeze({ id: 'a', score: 2 }), Object.freeze({ id: 'b', score: 9 }), Object.freeze({ id: 'c', score: 9 }), Object.freeze({ id: 'd', score: -1 })]);
  const result = api.topScores(items, 2);
  assert.deepEqual(result, [items[1], items[2]]);
  assert.equal(result[0], items[1]);
  assert.deepEqual(api.topScores(items, 10), [items[1], items[2], items[0], items[3]]);
  assert.deepEqual(api.topScores(items, 0), []);
  assert.equal(api.maxScore(items), 9);
  assert.equal(api.maxScore([]), null);
});
test('handles empty input and rejects invalid limits', () => {
  assert.equal(typeof api.topScores, 'function', 'the requested export must exist');
  assert.deepEqual(api.topScores([], 2), []);
  for (const limit of [-1, 1.5, NaN, Infinity, '2']) assert.throws(() => api.topScores([], limit), RangeError);
});
