import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = resolve(process.cwd(), 'index.mjs');
const api = await import(pathToFileURL(modulePath).href);

test('preserves active filtering, stable ties and identity', () => {
  const items = Object.freeze([Object.freeze({ price: 2 }), Object.freeze({ price: -4, archived: true }), Object.freeze({ price: 1 }), Object.freeze({ price: 1 }), Object.freeze({ price: 8, archived: 0 })]);
  assert.equal(api.cheapestActive(items), items[2]);
  assert.equal(api.cheapestActive([{ price: 0, archived: 'yes' }]), null);
  assert.equal(api.cheapestActive([]), null);
  assert.equal(api.cheapestActive([{ price: -3 }, { price: -1 }]).price, -3);
});
test('selection no longer sorts', () => {
  const source = readFileSync(modulePath, 'utf8');
  assert.doesNotMatch(source, /\.\s*(?:sort|toSorted)\s*\(/, 'use a linear selection scan rather than sorting');
});
