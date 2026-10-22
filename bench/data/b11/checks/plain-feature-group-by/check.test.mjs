import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('groups in stable order and calls the selector once', () => {
  assert.equal(typeof api.groupBy, 'function', 'the requested export must exist');
  const input = Object.freeze([{ kind: 'b', n: 1 }, { kind: 'a', n: 2 }, { kind: 'b', n: 3 }]);
  const calls = [];
  const result = api.groupBy(input, (item, index) => { calls.push([item, index]); return item.kind; });
  assert.deepEqual([...result], [['b', [input[0], input[2]]], ['a', [input[1]]]]);
  assert.deepEqual(calls, input.map((item, index) => [item, index]));
  assert.equal(api.count(input), 3);
});
test('supports non-string keys and empty input', () => {
  assert.equal(typeof api.groupBy, 'function', 'the requested export must exist');
  const key = {};
  assert.deepEqual(api.groupBy([1, 2], () => key), new Map([[key, [1, 2]]]));
  assert.deepEqual(api.groupBy([NaN, NaN], x => x), new Map([[NaN, [NaN, NaN]]]));
  assert.deepEqual(api.groupBy([], () => { throw Error('unexpected'); }), new Map());
});
