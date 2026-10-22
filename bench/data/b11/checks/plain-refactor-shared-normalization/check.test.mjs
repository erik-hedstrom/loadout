import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = resolve(process.cwd(), 'index.mjs');
const api = await import(pathToFileURL(modulePath).href);

test('retains normalization and internal whitespace behavior', () => {
  assert.equal(api.tagsEqual('  Release\n', 'release'), true);
  assert.equal(api.tagsEqual('A B', 'a  b'), false);
  assert.equal(api.tagsEqual('   ', ''), true);
  assert.equal(api.includesTag(Object.freeze([' Bug ', 'Feature', 'A B']), '\tBUG '), true);
  assert.equal(api.includesTag(['a  b'], 'a b'), false);
  assert.equal(api.includesTag([], ''), false);
});
test('trim and case conversion each have one shared call site', () => {
  const source = readFileSync(modulePath, 'utf8');
  assert.equal((source.match(/\.\s*trim\s*\(/g) ?? []).length, 1);
  assert.equal((source.match(/\.\s*toLowerCase\s*\(/g) ?? []).length, 1);
});
