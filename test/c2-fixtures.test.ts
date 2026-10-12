import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', 'bench', 'fixtures', 'c2');
const MAX_BYTES = 50 * 1024;
// Office files are compressed, so a scan cannot see inside them; make_inputs.py, which writes every word in them, is scanned instead.
const KEY_LIKE = [/\bsk-[A-Za-z0-9_-]{8,}/, /TYPESAFE/i, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /\bxox[baprs]-/, /\bAIza[0-9A-Za-z_-]{30,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];

const index: { id: string; area: string; control: boolean }[] = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'));
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
    const controls = index.filter((t) => t.control);
    expect(controls.length).toBeGreaterThanOrEqual(3);
    expect(controls.length).toBeLessThanOrEqual(4);
    expect(controls.every((t) => t.id.startsWith('ctl-'))).toBe(true);
    expect(index.filter((t) => !t.control).some((t) => t.id.startsWith('ctl-'))).toBe(false);
  });

  it('gives every task a non-empty task.md and an entry in the answer key', () => {
    const key = readFileSync(join(root, 'KEY.md'), 'utf8');
    for (const { id } of index) {
      expect(readFileSync(join(root, id, 'task.md'), 'utf8').trim().length, id).toBeGreaterThan(20);
      expect(key, id).toContain(`\n## ${id}\n`);
    }
  });

  it('ships at least one input file next to task.md', () => {
    for (const { id } of index) {
      const inputs = files.filter((f) => f.startsWith(join(root, id) + sep) && !f.endsWith('task.md'));
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

  it('detects key-shaped strings and leaves ordinary text alone', () => {
    const hit = (s: string) => KEY_LIKE.some((p) => p.test(s));
    for (const s of ['sk-ant-api03-abcdefghijkl', 'TYPESAFE_API_KEY=abc', 'ghp_' + 'a'.repeat(30), 'AKIA' + 'A'.repeat(16), '-----BEGIN RSA PRIVATE KEY-----']) {
      expect(hit(s), s).toBe(true);
    }
    for (const s of ['task-id and risk-free desk-top', 'secrets.REGISTRY_TOKEN', 'password: example']) expect(hit(s), s).toBe(false);
  });
});
