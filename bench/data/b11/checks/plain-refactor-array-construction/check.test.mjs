import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = resolve(process.cwd(), 'index.mjs');
const api = await import(pathToFileURL(modulePath).href);

test('preserves default, negative, zero and fractional steps', () => {
  assert.deepEqual(api.sequence(3, 4), [3, 4, 5, 6]);
  assert.deepEqual(api.sequence(3, 3, -2), [3, 1, -1]);
  assert.deepEqual(api.sequence(-1, 3, 0), [-1, -1, -1]);
  assert.deepEqual(api.sequence(0.5, 3, 0.25), [0.5, 0.75, 1]);
  assert.deepEqual(api.sequence(1, 0), []);
  assert.notEqual(api.sequence(1, 0), api.sequence(1, 0));
});
test('constructs with Array.from and has no push calls', () => {
  const source = readFileSync(modulePath, 'utf8');
  assert.match(source, /\bArray\s*\.\s*from\s*\(/);
  assert.doesNotMatch(source, /\.\s*push\s*\(/);
});
