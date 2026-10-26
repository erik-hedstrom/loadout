import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { equal: strictAssert.equal };
const { Object } = globalThis;

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('orders numerically rather than by printed digits', () => {
  assert.equal(api.median(Object.freeze([2, 10, 3])), 3);
  assert.equal(api.median([11, 2, 1, 20]), 6.5);
  assert.equal(api.median([-2, -10, -3]), -3);
  assert.equal(api.median([0.7, 0.12, 0.3]), 0.3);
});
test('preserves the empty and singleton contracts', () => {
  assert.equal(api.median([]), null);
  assert.equal(api.median([8]), 8);
  assert.equal(api.median([4, 4, 4, 4]), 4);
});
