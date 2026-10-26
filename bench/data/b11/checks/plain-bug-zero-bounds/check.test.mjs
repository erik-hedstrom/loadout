import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { equal: strictAssert.equal };

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('zero bounds are applied inclusively', () => {
  assert.equal(api.clamp(-3, 0, 10), 0);
  assert.equal(api.clamp(3, -10, 0), 0);
  assert.equal(api.clamp(9, 0, 0), 0);
  assert.equal(api.clamp(-9, 0, 0), 0);
});
test('ordinary bounds and fractional inputs retain their behavior', () => {
  assert.equal(api.clamp(2.5, 1, 4), 2.5);
  assert.equal(api.clamp(-5, -4, -1), -4);
  assert.equal(api.clamp(5, 1, 4), 4);
  assert.equal(api.clamp(1, 1, 4), 1);
  assert.equal(api.clamp(4, 1, 4), 4);
});
