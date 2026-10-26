import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { readFileSync as nodeReadFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { deepEqual: strictAssert.deepEqual, doesNotMatch: strictAssert.doesNotMatch, equal: strictAssert.equal, notEqual: strictAssert.notEqual };
const { Object } = globalThis;
const readFileSync = nodeReadFileSync;

const modulePath = resolve(process.cwd(), 'index.mjs');
const api = await import(pathToFileURL(modulePath).href);

test('copies supported values and every mutable layer', () => {
  const order = Object.freeze({ id: 'O-12', lines: Object.freeze([Object.freeze({ sku: 'A', quantity: 0 }), Object.freeze({ sku: 'B', quantity: 2.5 })]), address: Object.freeze({ city: 'Harbor', postal: '0012' }) });
  const copied = api.copyOrder(order);
  assert.deepEqual(copied, order);
  assert.notEqual(copied, order);
  assert.notEqual(copied.lines, order.lines);
  assert.notEqual(copied.lines[0], order.lines[0]);
  assert.notEqual(copied.lines[1], order.lines[1]);
  assert.notEqual(copied.address, order.address);
  copied.lines[0].quantity = 9;
  copied.address.city = 'Elsewhere';
  assert.equal(order.lines[0].quantity, 0);
  assert.equal(order.address.city, 'Harbor');
  const negativeZero = { id: 'O-0', lines: [{ sku: 'Z', quantity: -0 }], address: { city: '', postal: '' } };
  assert.equal(api.copyOrder(negativeZero).lines[0].quantity, 0);
  assert.deepEqual(api.copyOrder({ id: '', lines: [], address: { city: '', postal: '' } }), { id: '', lines: [], address: { city: '', postal: '' } });
});
test('does not serialize or deserialize through JSON', () => {
  assert.doesNotMatch(readFileSync(modulePath, 'utf8'), /\bJSON\s*\.\s*(?:parse|stringify)\s*\(/);
});
