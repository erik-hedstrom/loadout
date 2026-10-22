import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('preserves all value text after the first separator', () => {
  const input = Object.freeze([' token =a=b== ', 'blank=', ' =ignored', 'missing', 'token=last=one']);
  assert.deepEqual(api.parseAssignments(input), new Map([['token', 'last=one'], ['blank', '']]));
  assert.deepEqual(api.parseAssignments(['a= x = y ']), new Map([['a', ' x = y ']]));
  assert.deepEqual(api.parseAssignments([]), new Map());
});
test('handles unusual keys as ordinary map entries', () => {
  assert.deepEqual(api.parseAssignments(['__proto__=safe', ' constructor =yes']), new Map([['__proto__', 'safe'], ['constructor', 'yes']]));
});
