import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const modulePath = resolve(process.cwd(), 'index.mjs');
const api = await import(pathToFileURL(modulePath).href);

test('preserves zero padding, leap days and year boundaries', () => {
  assert.equal(api.formatDay('2024-02-29'), '29/02/2024');
  assert.equal(api.formatDay('2000-01-01'), '01/01/2000');
  assert.equal(api.formatDay('2099-12-31'), '31/12/2099');
  for (let month = 1; month <= 12; month++) {
    const text = String(month).padStart(2, '0');
    assert.equal(api.formatDay('2031-' + text + '-09'), '09/' + text + '/2031');
  }
});
test('has no Date dependency', () => {
  assert.doesNotMatch(readFileSync(modulePath, 'utf8'), /\bDate\b/);
});
