import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { deepEqual: strictAssert.deepEqual, equal: strictAssert.equal };
const { Map } = globalThis;

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('counts lowercase ASCII word runs in first-seen order', () => {
  assert.equal(typeof api.wordCounts, 'function', 'the requested export must exist');
  assert.deepEqual([...api.wordCounts('Blue, RED blue! red2green_blue')], [['blue', 3], ['red', 2], ['green', 1]]);
  assert.deepEqual([...api.wordCounts('constructor CONSTRUCTOR toString')], [['constructor', 2], ['tostring', 1]]);
  assert.deepEqual(api.words('A-b2C'), ['a', 'b', 'c']);
});
test('treats all non-ASCII letters as separators', () => {
  assert.equal(typeof api.wordCounts, 'function', 'the requested export must exist');
  assert.deepEqual([...api.wordCounts('ab?cd_9ef')], [['ab', 1], ['cd', 1], ['ef', 1]]);
  assert.deepEqual(api.wordCounts(''), new Map());
  assert.deepEqual(api.wordCounts('123_!?'), new Map());
  assert.deepEqual([...api.wordCounts('a\u0130b\u212Ac')], [['a', 1], ['b', 1], ['c', 1]]);
});
