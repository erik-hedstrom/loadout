import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const api = await import(pathToFileURL(resolve(process.cwd(), 'index.mjs')).href);

test('substitutes own values and leaves unknown tokens alone', () => {
  assert.equal(typeof api.fillTemplate, 'function', 'the requested export must exist');
  const fields = Object.freeze(Object.assign(Object.create({ inherited: 'secret' }), { name: 'Ada', zero: 0, empty: '', undef: undefined, nil: null }));
  assert.equal(api.fillTemplate('{name}/{name}/{zero}/{empty}/{undef}/{nil}/{missing}/{inherited}', fields), 'Ada/Ada/0//undefined/null/{missing}/{inherited}');
  assert.equal(api.hasField(fields, 'inherited'), false);
});
test('inserts replacement strings literally in a single pass', () => {
  assert.equal(typeof api.fillTemplate, 'function', 'the requested export must exist');
  assert.equal(api.fillTemplate('{x} {y} {bad-name} {2bad} {}', { x: '$&$1', y: '{x}' }), '$&$1 {x} {bad-name} {2bad} {}');
  assert.equal(api.fillTemplate('plain text', {}), 'plain text');
  const fields = Object.create(null);
  fields.__proto__ = 'own value';
  assert.equal(api.fillTemplate('{__proto__}', fields), 'own value');
});
