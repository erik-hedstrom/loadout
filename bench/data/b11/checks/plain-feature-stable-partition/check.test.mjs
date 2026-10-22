import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('partitions stably and evaluates once per value', () => {
  assert.equal(typeof api.partition, 'function', 'the requested export must exist');
  const input = Object.freeze([3, 1, 4, 2]);
  const calls = [];
  const result = api.partition(input, (value, index) => { calls.push([value, index]); return value > 2 ? 'yes' : ''; });
  assert.deepEqual(result, [[3, 4], [1, 2]]);
  assert.deepEqual(calls, [[3, 0], [1, 1], [4, 2], [2, 3]]);
  assert.deepEqual(api.select(input, x => x > 2), [3, 4]);
});
test('supports empty and uniform partitions with new arrays', () => {
  assert.equal(typeof api.partition, 'function', 'the requested export must exist');
  assert.deepEqual(api.partition([], () => { throw Error('unexpected'); }), [[], []]);
  const obj = {};
  const result = api.partition([obj], () => true);
  assert.equal(result[0][0], obj);
  assert.deepEqual(result[1], []);
  assert.notEqual(result[0], result[1]);
  assert.deepEqual(api.partition([1, 2], () => false), [[], [1, 2]]);
});
