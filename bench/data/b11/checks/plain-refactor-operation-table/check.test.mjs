import test from 'node:test';
import strictAssert from 'node:assert/strict';
import { readFileSync as nodeReadFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Capture trusted dependencies before importing the generated module.
const assert = { doesNotMatch: strictAssert.doesNotMatch, equal: strictAssert.equal, ok: strictAssert.ok, throws: strictAssert.throws };
const { Number, RangeError } = globalThis;
const readFileSync = nodeReadFileSync;

const modulePath = resolve(process.cwd(), 'index.mjs');
const api = await import(pathToFileURL(modulePath).href);

test('retains numeric operations including nonfinite results', () => {
  assert.equal(api.calculate('add', 4, 2), 6);
  assert.equal(api.calculate('subtract', 2, 4), -2);
  assert.equal(api.calculate('multiply', -2, 3), -6);
  assert.equal(api.calculate('divide', 3, 2), 1.5);
  assert.equal(api.calculate('divide', 1, 0), Infinity);
  assert.ok(Number.isNaN(api.calculate('divide', 0, 0)));
});
test('unknown operations retain exact errors and switch dispatch is removed', () => {
  for (const name of ['', 'power', 'toString', '__proto__']) {
    assert.throws(() => api.calculate(name, 1, 2), { name: 'RangeError', message: 'Unknown operation: ' + name });
  }
  assert.doesNotMatch(readFileSync(modulePath, 'utf8'), /\bswitch\s*\(/);
});
