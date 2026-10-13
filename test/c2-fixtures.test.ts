import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', 'bench', 'fixtures', 'c2');
const MAX_BYTES = 50 * 1024;
// Office files are compressed, so a scan cannot see inside them; make_inputs.py, which writes every word in them, is scanned instead.
const KEY_LIKE = [/\bsk-[A-Za-z0-9_-]{8,}/, /TYPESAFE/i, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /\bxox[baprs]-/, /\bAIza[0-9A-Za-z_-]{30,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];

const index: { id: string; inputs: string[] }[] = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'));
const files = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => join(e.parentPath, e.name));
const taskDirs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

describe('C2 fixtures', () => {
  it('lists 15 to 20 tasks, each with a directory, and 3 to 4 controls', () => {
    const ids = index.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(15);
    expect(ids.length).toBeLessThanOrEqual(20);
    expect([...ids].sort()).toEqual([...taskDirs].sort());
    const controls = ids.filter((id) => id.startsWith('ctl-'));
    expect(controls.length).toBeGreaterThanOrEqual(3);
    expect(controls.length).toBeLessThanOrEqual(4);
  });

  it('gives every task a non-empty task.md and an entry in the answer key', () => {
    const keyLines = readFileSync(join(root, 'KEY.md'), 'utf8').split(/\r?\n/);
    for (const { id } of index) {
      expect(readFileSync(join(root, id, 'task.md'), 'utf8').trim().length, id).toBeGreaterThan(20);
      expect(keyLines, id).toContain(`## ${id}`);
    }
  });

  // A file the repo ignores exists locally but not in a clone; the list catches that in CI.
  it('ships exactly the listed inputs next to task.md', () => {
    for (const { id, inputs } of index) {
      const dir = join(root, id);
      const present = files.filter((f) => !relative(dir, f).startsWith('..') && relative(dir, f) !== 'task.md');
      expect(present.map((f) => relative(dir, f).split('\\').join('/')).sort(), id).toEqual([...inputs].sort());
      expect(inputs.length, id).toBeGreaterThan(0);
    }
  });

  it(`keeps every file at ${MAX_BYTES} bytes or less`, () => {
    for (const f of files) expect(statSync(f).size, relative(root, f)).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('contains nothing that looks like a key', () => {
    for (const f of files) {
      const text = readFileSync(f, 'latin1');
      for (const pattern of KEY_LIKE) expect(pattern.test(text), `${relative(root, f)} matches ${pattern}`).toBe(false);
    }
  });
});
