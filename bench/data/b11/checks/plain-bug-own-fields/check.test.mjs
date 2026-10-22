import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('excludes inherited fields and includes own undefined values', () => {
  const nested = {};
  const record = Object.assign(Object.create({ inherited: 4 }), { own: nested, missingValue: undefined, hasOwnProperty: 'field' });
  Object.freeze(record);
  const result = api.pickOwn(record, Object.freeze(['inherited', 'own', 'missingValue', 'absent', 'hasOwnProperty', 'toString']));
  assert.deepEqual(result, { own: nested, missingValue: undefined, hasOwnProperty: 'field' });
  assert.equal(result.own, nested);
  assert.ok(Object.hasOwn(result, 'missingValue'));
});
test('supports null-prototype inputs and empty selections', () => {
  assert.deepEqual(api.pickOwn(Object.assign(Object.create(null), { x: 0 }), ['x', 'y']), { x: 0 });
  assert.deepEqual(api.pickOwn({ a: 1 }, []), {});
});
