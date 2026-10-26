import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { equal: strictAssert.equal };
const { Object } = globalThis;

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('zero quantities do not become default quantities', () => {
  const items = Object.freeze([Object.freeze({ quantity: 0 }), Object.freeze({ quantity: 2 }), Object.freeze({})]);
  assert.equal(api.totalQuantity(items), 3);
  assert.equal(api.totalQuantity([{ quantity: 0 }]), 0);
});
test('defaults only omitted or undefined quantity', () => {
  assert.equal(api.totalQuantity([{ quantity: undefined }, { quantity: -2 }, { quantity: 0.5 }, {}]), 0.5);
  assert.equal(api.totalQuantity([]), 0);
});
