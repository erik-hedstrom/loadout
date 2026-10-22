import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareB11Library } from '../bench/b11-library.js';
import { HarnessError } from '../bench/b11-errors.js';

const roots: string[] = [];
const temp = () => { const p = mkdtempSync(join(realpathSync(tmpdir()), 'b11-library-')); roots.push(p); return p; };
afterEach(() => roots.splice(0).forEach(p => rmSync(p, { recursive: true, force: true })));
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const hash = (value: unknown) => digest(JSON.stringify(value));
const revision = 'a'.repeat(40);
const source = (path = 'skills/example', origin = 'github.com/obra/superpowers') => ({ origin, path, revision, addedAt: '2026-10-22T00:00:00Z' });
function fixture() {
  const library = temp(), planted = temp(), destination = temp();
  mkdirSync(join(library, 'skills'));
  const add = (folder: string, name = folder, metadata: unknown = source()) => {
    const p = join(library, 'skills', folder); mkdirSync(p);
    writeFileSync(join(p, 'SKILL.md'), `---\nname: ${name}\ndescription: synthetic reference\n---\nReference </skill> text.\n`);
    if (metadata !== null) writeFileSync(join(p, '.loadout-source.json'), JSON.stringify(metadata));
    return p;
  };
  return { library, planted, destination, add, run: () => prepareB11Library(library, planted, destination) };
}

describe('B11 public distractor corpus', () => {
  it('records prepared distractor counts and public source commits without paths or names', () => {
    const f = fixture();
    f.add('z-folder', 'a-reference'); f.add('a-folder', 'z-reference');
    const bad = f.add('bad'); writeFileSync(join(bad, 'SKILL.md'), 'malformed');
    const plant = join(f.planted, 'plant'); mkdirSync(plant);
    writeFileSync(join(plant, 'SKILL.md'), '---\nname: planted-reference\ndescription: synthetic\n---\nplant');
    const result = f.run();
    expect(result.skills.map(s => s.name)).toEqual(['z-reference', 'a-reference', 'planted-reference']);
    expect(result.provenance).toMatchObject({
      corpus: 'bench/data/library.sh', accepted: 2, rejected: 1,
      namesSha256: hash(['a-reference', 'z-reference']),
      sources: [{ source: 'https://github.com/obra/superpowers', revision, accepted: 2 }],
    });
    const text = JSON.stringify(result.provenance);
    for (const privateValue of [f.library, f.destination, 'a-reference', 'z-reference', 'planted-reference', 'skills/example']) expect(text).not.toContain(privateValue);
    expect(readFileSync(join(result.skills[0]!.source, 'SKILL.md'), 'utf8')).toContain('Third-party skill text.');
  });

  it('is stable across creation order and host paths but fingerprints names, accepted text and source associations', () => {
    const run = (reverse = false, text = 'body', rev = revision, swap = false, rename = false) => {
      const f = fixture();
      for (const folder of reverse ? ['z', 'a'] : ['a', 'z']) {
        const p = f.add(folder, rename && folder === 'z' ? 'renamed' : folder, { ...source(swap ? `other/${folder}` : `skills/${folder}`), revision: rev });
        writeFileSync(join(p, 'SKILL.md'), `---\nname: ${rename && folder === 'z' ? 'renamed' : folder}\ndescription: synthetic\n---\n${text}`);
      }
      return f.run().provenance;
    };
    const baseline = run();
    expect(run(true)).toEqual(baseline);
    expect(run(false, 'changed').contentSha256).not.toBe(baseline.contentSha256);
    expect(run(false, 'body', 'b'.repeat(40)).sourcesSha256).not.toBe(baseline.sourcesSha256);
    expect(run(false, 'body', revision, true).sourcesSha256).not.toBe(baseline.sourcesSha256);
    expect(run(false, 'body', revision, false, true).namesSha256).not.toBe(baseline.namesSha256);
  });

  it.each([
    source('skills/example', 'github.com/private-owner/private-repo'),
    source('skills/example', '/private/local/source'),
    source('skills/example', 'https://github.com/obra/superpowers'),
    source('skills/example', 'github.com/obra/superpowers.evil'),
    source('skills/example', 'github.com/obra/superpowers/extra'),
    source('../private'), source('/private'), source('skills\\private'), source('skills//private'),
    { ...source(), revision: 'private revision' }, { ...source(), revision: '' },
    { ...source(), revision: 123 }, { origin: source().origin }, [], null,
  ])('fails closed on unproven source metadata %# before materializing', metadata => {
    const f = fixture(); f.add('private-name', 'private-name', metadata);
    let error: unknown;
    try { f.run(); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(HarnessError);
    expect((error as Error).message).toBe('B11 library provenance validation failed');
    expect(() => readFileSync(join(f.destination, 'private-name', 'SKILL.md'))).toThrow();
  });

  it('enforces the corpus subpath restriction, rather than trusting the whole Composio repository', () => {
    for (const path of ['connectors/private', 'changelog-generator-evil', '.']) {
      const f = fixture(); f.add('example', 'example', source(path, 'github.com/ComposioHQ/awesome-claude-skills'));
      expect(() => f.run()).toThrow('B11 library provenance validation failed');
    }
    const f = fixture(); f.add('example', 'example', source('changelog-generator', 'github.com/ComposioHQ/awesome-claude-skills'));
    expect(f.run().provenance.sources[0]!.source).toBe('https://github.com/ComposioHQ/awesome-claude-skills/tree/master/changelog-generator');
  });

  it('records unavailable revisions as unknown and ignores unrelated root configuration', () => {
    const f = fixture(); const { revision: _revision, ...metadata } = source(); f.add('example', 'example', metadata);
    writeFileSync(join(f.library, 'config.json'), 'not JSON: must not be read');
    expect(f.run().provenance.sources[0]!.revision).toBeNull();
  });

  it.each([undefined, '', ' ', 0])('associates accepted text with the valid source after a rejected same-name manifest %#', description => {
    const f = fixture(), invalid = f.add('a-rejected', 'shared-name', source('rejected', 'github.com/openai/skills'));
    writeFileSync(join(invalid, 'SKILL.md'), `---\nname: shared-name\n${description === undefined ? '' : `description: ${JSON.stringify(description)}\n`}---\ninvalid description`);
    f.add('b-accepted', 'shared-name');
    expect(f.run().provenance).toMatchObject({ accepted: 1, rejected: 1,
      sources: [{ source: 'https://github.com/obra/superpowers', revision, accepted: 1 }] });
  });

  it('counts oversized installed skill text as rejected without accepting its source', () => {
    const f = fixture(), p = f.add('oversized');
    writeFileSync(join(p, 'SKILL.md'), 'x'.repeat(256 * 1024 + 1));
    expect(f.run().provenance).toMatchObject({ accepted: 0, rejected: 1, sources: [], namesSha256: hash([]) });
  });

  it('bounds source metadata reads before parsing', () => {
    const f = fixture(), p = f.add('oversized', 'oversized', { ...source(), addedAt: 'x'.repeat(16 * 1024) });
    expect(readFileSync(join(p, '.loadout-source.json')).length).toBeGreaterThan(16 * 1024);
    expect(() => f.run()).toThrow('B11 library provenance validation failed');
  });

  it('rejects missing roots and malformed installed metadata', () => {
    const f = fixture(), p = f.add('folder');
    writeFileSync(join(p, '.loadout-source.json'), '{broken');
    expect(() => f.run()).toThrow('B11 library provenance validation failed');
    expect(() => prepareB11Library(join(temp(), 'missing'), temp(), temp())).toThrow('B11 library provenance validation failed');
  });

  it('refuses linked library roots, skill folders and source metadata', () => {
    const f = fixture(), outside = fixture(); outside.add('example');
    const link = join(temp(), 'linked'); symlinkSync(outside.library, link, 'junction');
    expect(() => prepareB11Library(link, f.planted, f.destination)).toThrow('B11 library provenance validation failed');
    symlinkSync(join(outside.library, 'skills', 'example'), join(f.library, 'skills', 'linked'), 'junction');
    expect(() => f.run()).toThrow('B11 library provenance validation failed');
  });

  it.skipIf(process.platform === 'win32')('refuses linked metadata and FIFO metadata before opening', async () => {
    const { execFileSync, spawnSync } = await import('node:child_process');
    for (const fifo of [false, true]) {
      const f = fixture(), p = f.add('example');
      rmSync(join(p, '.loadout-source.json'));
      if (fifo) execFileSync('mkfifo', [join(p, '.loadout-source.json')]);
      else symlinkSync(join(f.library, 'skills', 'example', 'SKILL.md'), join(p, '.loadout-source.json'));
      if (fifo) {
        const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
          `import { prepareB11Library } from './bench/b11-library.ts'; prepareB11Library(...JSON.parse(process.argv[1]));`,
          JSON.stringify([f.library, f.planted, f.destination])], { encoding: 'utf8', timeout: 3000 });
        expect(child.error).toBeUndefined();
        expect(child.status).toBe(1);
        expect(child.stderr).toContain('B11 library provenance validation failed');
      } else expect(() => f.run()).toThrow('B11 library provenance validation failed');
    }
  });
});
