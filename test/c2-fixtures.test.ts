import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..', 'bench', 'fixtures', 'c2');
const MAX_BYTES = 50 * 1024;
// The protocol points the runner's scan at the same file.
const KEY_LIKE = (JSON.parse(readFileSync(join(root, 'scan-patterns.json'), 'utf8')) as { name: string; pattern: string; flags?: string }[]).map(
  (p) => ({ name: p.name, re: new RegExp(p.pattern, p.flags) }),
);

// Office files are zips of compressed XML, so a scan of the raw bytes sees nothing; read every entry's inflated bytes too.
function zipEntries(buf: Buffer): Buffer[] {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return [];
  const entries: Buffer[] = [];
  let at = buf.readUInt32LE(eocd + 16);
  for (let i = buf.readUInt16LE(eocd + 10); i > 0; i--) {
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const local = buf.readUInt32LE(at + 42);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    entries.push(method === 8 ? inflateRawSync(data) : data);
    at += 46 + buf.readUInt16LE(at + 28) + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
  }
  return entries;
}

const isZip = (buf: Buffer) => buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

const texts = (buf: Buffer) => [buf, ...(isZip(buf) ? zipEntries(buf) : [])].map((b) => b.toString('latin1'));

const hits = (buf: Buffer) => KEY_LIKE.filter(({ re }) => texts(buf).some((t) => re.test(t))).map(({ name }) => name);

const index: { id: string; inputs: string[] }[] = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'));
const files = readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => join(e.parentPath, e.name));
const taskDirs = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== 'smoke')
  .map((e) => e.name);

describe('C2 fixtures', () => {
  it('lists exactly 18 tasks, each with a directory, 4 of them controls', () => {
    const ids = index.map((t) => t.id);
    expect(ids.length).toBe(18);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...taskDirs].sort());
    expect(ids.filter((id) => id.startsWith('ctl-')).length).toBe(4);
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

  // The smoke run must not use a scored task, so its fixture stays outside the index and the key.
  it('keeps the smoke fixture out of the 18 scored tasks', () => {
    expect(readdirSync(join(root, 'smoke')).sort()).toEqual(['README.md', 'routes.txt', 'task.md']);
    expect(index.map((t) => t.id)).not.toContain('smoke');
    expect(readFileSync(join(root, 'KEY.md'), 'utf8')).not.toMatch(/^## smoke/m);
  });

  // The harness-owned probe for web-signup-form calls this interface, which only the task text tells the agent about.
  it('names the signup interface in the task, the key and the protocol', () => {
    for (const f of ['web-signup-form/task.md', 'KEY.md', 'PROTOCOL.md', 'CHECKS.md']) {
      expect(readFileSync(join(root, f), 'utf8'), f).toContain('validate({ email, password, confirm, terms })');
      expect(readFileSync(join(root, f), 'utf8'), f).toContain('validate.js');
    }
  });

  it(`keeps every file at ${MAX_BYTES} bytes or less`, () => {
    for (const f of files) expect(statSync(f).size, relative(root, f)).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('contains nothing that looks like a key, inside the office files too', () => {
    for (const f of files) expect(hits(readFileSync(f)), relative(root, f)).toEqual([]);
  });

  // A compressed stream would hide text from the scan; the generator writes the PDF uncompressed for this reason.
  it('holds no compressed stream outside zip files', () => {
    for (const f of files) {
      const buf = readFileSync(f);
      if (!isZip(buf)) expect(buf.toString('latin1'), relative(root, f)).not.toMatch(/\/Filter\b/);
    }
  });

  it('names no routing vendor or key variable', () => {
    for (const f of files) expect(texts(readFileSync(f)).some((t) => /typesafe/i.test(t)), relative(root, f)).toBe(false);
  });

  it('reads the text inside a committed office file', () => {
    expect(texts(readFileSync(join(root, 'docx-lease-amendment', 'lease.docx'))).join('\n')).toContain('Exhibit A');
  });

  // Key-shaped samples are assembled at run time so that no literal in the repo is one.
  it('flags a key inside a compressed zip entry, and every shape in the pattern file', () => {
    const name = Buffer.from('word/document.xml');
    const data = deflateRawSync(Buffer.from(`<w:t>${'sk-' + 'a1B2'.repeat(8)}</w:t>`));
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt16LE(name.length, 28);
    const body = Buffer.concat([local, name, data]);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(1, 10);
    end.writeUInt32LE(body.length, 16);
    expect(hits(Buffer.concat([body, central, name, end]))).toEqual(['sk- key']);

    const samples = [
      'sk-' + 'a1B2'.repeat(6),
      'AKIA' + 'ABCD1234'.repeat(2),
      'ghp_' + 'a1B2c3'.repeat(5),
      'xoxb-' + '1234567890',
      'AIza' + 'a1B2c3D4'.repeat(4),
      '-----BEGIN ' + 'RSA PRIVATE KEY-----',
      'eyJ' + 'hbGciOiJIUzI1NiJ9' + '.eyJ' + 'zdWIiOiIxMjM0NTY3ODkwIn0' + '.' + 'dBjftJeZ4CVPmB92K27uhbUJU1p1r',
      'Bearer ' + 'abcdEFGH1234567890-_.~+/=',
    ];
    expect(KEY_LIKE.length).toBe(samples.length);
    expect(samples.map((s) => hits(Buffer.from(s)).length)).toEqual(samples.map(() => 1));
  });
});
