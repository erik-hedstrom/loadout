import fs, { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addSkills, parseSkill, scanLibrary } from '../src/library.js';

describe('library metadata cache', () => {
  let home: string;
  let library: string;
  let file: string;
  const skill = (folder: string, description = 'Playwright browser testing', root = library) => {
    const dir = join(root, 'skills', folder);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${folder}\ndescription: ${description}\n---\nInstructions.`);
    return dir;
  };

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'loadout-scan-'));
    library = join(home, 'library');
    file = join(home, 'index', 'library-scan.json');
    vi.stubEnv('LOADOUT_HOME', home);
    skill('browser');
    vi.useFakeTimers();
    // Keep ordinary fixtures outside the race window even on a slow runner; race tests set explicit ticks.
    vi.setSystemTime(Date.now() + 60_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(home, { recursive: true, force: true });
  });

  it('reuses metadata without rewriting a valid cache or reading the manifest', () => {
    skill('database', 'Postgres migrations');
    const fresh = scanLibrary(library, { cache: true });
    const modified = statSync(file).mtimeMs;
    const reads = vi.spyOn(fs, 'openSync');
    syncBuiltinESMExports();
    try {
      expect(scanLibrary(library, { cache: true })).toEqual(fresh);
      expect(reads.mock.calls.filter(([p]) => String(p).endsWith('SKILL.md'))).toEqual([]);
      expect(statSync(file).mtimeMs).toBe(modified);
    } finally {
      reads.mockRestore();
      syncBuiltinESMExports();
    }
  });

  it.each(['missing', 'oversized'])('does not rewrite the cache for an uncached %s manifest', type => {
    const dir = join(library, 'skills', 'invalid');
    mkdirSync(dir);
    if (type === 'oversized') writeFileSync(join(dir, 'SKILL.md'), 'x'.repeat(256 * 1024 + 1));
    scanLibrary(library, { cache: true });
    const before = statSync(file, { bigint: true });
    vi.advanceTimersByTime(1_000);
    scanLibrary(library, { cache: true });
    expect(statSync(file, { bigint: true }).mtimeNs).toBe(before.mtimeNs);
    expect(statSync(file, { bigint: true }).ino).toBe(before.ino);
  });

  it.each(['mtimeNs', 'ctimeNs'] as const)('parses entries fresh while %s is within the timestamp race window', field => {
    const manifest = join(library, 'skills', 'browser', 'SKILL.md');
    const st = statSync(manifest, { bigint: true });
    st.mtimeNs = st.ctimeNs = BigInt(Date.now() - 10_000) * 1_000_000n;
    st[field] = BigInt(Date.now()) * 1_000_000n;
    const stamps = vi.spyOn(fs, 'lstatSync').mockReturnValue(st);
    syncBuiltinESMExports();
    try {
      scanLibrary(library, { cache: true });
      expect(JSON.parse(readFileSync(file, 'utf8')).skills).toEqual([]);
      writeFileSync(manifest, readFileSync(manifest, 'utf8').replace('browser testing', 'schema analysis'));
      expect(scanLibrary(library, { cache: true })[0]?.description).toBe('Playwright schema analysis');
      vi.advanceTimersByTime(2_001);
      scanLibrary(library, { cache: true });
      expect(JSON.parse(readFileSync(file, 'utf8')).skills).toHaveLength(1);
    } finally {
      stamps.mockRestore();
      syncBuiltinESMExports();
    }
  });

  it.each(['EPERM', 'EBUSY', 'EIO'])('handles cache rename failure %s without blocking routing', code => {
    scanLibrary(library, { cache: true });
    skill('database', 'Postgres migrations');
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw Object.assign(new Error('CACHE-CANARY'), { code }); });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    syncBuiltinESMExports();
    try {
      expect(scanLibrary(library, { cache: true })).toHaveLength(2);
      expect(errors.mock.calls).toEqual(code === 'EIO' ? [['loadout: library metadata cache could not be saved']] : []);
      expect(readdirSync(join(home, 'index'))).toEqual(['library-scan.json']);
    } finally {
      rename.mockRestore();
      syncBuiltinESMExports();
    }
    scanLibrary(library, { cache: true });
    expect(JSON.parse(readFileSync(file, 'utf8')).skills).toHaveLength(2);
  });

  it('contains cleanup failures so they cannot abort routing', () => {
    const remove = vi.spyOn(fs, 'rmSync').mockImplementation(() => { throw Object.assign(new Error('CACHE-CANARY'), { code: 'EACCES' }); });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    syncBuiltinESMExports();
    try {
      expect(scanLibrary(library, { cache: true })).toHaveLength(1);
      expect(errors.mock.calls).toEqual([['loadout: library metadata cache could not be saved']]);
    } finally {
      remove.mockRestore();
      syncBuiltinESMExports();
    }
  });

  it('default scans ignore existing caches and never create or refresh them', () => {
    const fresh = scanLibrary(library);
    expect(fs.existsSync(file)).toBe(false);
    scanLibrary(library, { cache: true });
    const cache = JSON.parse(readFileSync(file, 'utf8'));
    cache.skills[0][3] = 'Cached metadata must not feed read-only scans';
    writeFileSync(file, JSON.stringify(cache));
    const saved = readFileSync(file);
    expect(scanLibrary(library)).toEqual(fresh);
    expect(readFileSync(file)).toEqual(saved);
  });

  it('discovers manual additions and removals', () => {
    scanLibrary(library, { cache: true });
    skill('database', 'Postgres migrations');
    expect(scanLibrary(library, { cache: true }).map(c => c.id)).toEqual(['skill:browser', 'skill:database']);
    rmSync(join(library, 'skills', 'browser'), { recursive: true });
    expect(scanLibrary(library, { cache: true }).map(c => c.id)).toEqual(['skill:database']);
  });

  it('invalidates same-size edits even when the modification time is restored', () => {
    scanLibrary(library, { cache: true });
    const manifest = join(library, 'skills', 'browser', 'SKILL.md');
    const previous = statSync(manifest);
    writeFileSync(manifest, readFileSync(manifest, 'utf8').replace('browser testing', 'schema analysis'));
    utimesSync(manifest, previous.atime, previous.mtime);
    expect(scanLibrary(library, { cache: true })[0]?.description).toBe('Playwright schema analysis');
  });

  it('invalidates loadout add replacements', () => {
    const source = join(home, 'source');
    skill('added', 'First description', source);
    addSkills(source, library);
    scanLibrary(library, { cache: true });
    skill('added', 'Updated description', source);
    addSkills(source, library);
    expect(scanLibrary(library, { cache: true }).find(c => c.name === 'added')?.description).toBe('Updated description');
  });

  it('rejects a cache copied from a different library path', () => {
    scanLibrary(library, { cache: true });
    const otherHome = join(home, 'other');
    skill('different', 'Different library', join(otherHome, 'library'));
    mkdirSync(join(otherHome, 'index'));
    writeFileSync(join(otherHome, 'index', 'library-scan.json'), readFileSync(file));
    vi.stubEnv('LOADOUT_HOME', otherHome);
    expect(scanLibrary(join(otherHome, 'library'), { cache: true }).map(c => c.id)).toEqual(['skill:different']);
  });

  it('uses current provenance and MCP config on a hit', () => {
    scanLibrary(library, { cache: true });
    writeFileSync(join(library, 'skills', 'browser', '.loadout-source.json'), JSON.stringify({ origin: 'new-origin' }));
    writeFileSync(join(library, 'mcp.json'), JSON.stringify({ mcpServers: { database: { description: 'SQL', command: 'local' } } }));
    const current = scanLibrary(library, { cache: true });
    expect(current[0]?.origin).toBe('new-origin');
    expect(current[1]?.server).toEqual({ command: 'local' });
    writeFileSync(join(library, 'mcp.json'), '{');
    expect(() => scanLibrary(library, { cache: true })).toThrow('library mcp.json is not valid JSON');
  });

  it.each(['{CACHE-CANARY', 'null', '{"version":1,"skills":{}}'])('falls back on malformed cache %s without logging contents', text => {
    scanLibrary(library, { cache: true });
    writeFileSync(file, text);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(scanLibrary(library, { cache: true })[0]?.description).toBe('Playwright browser testing');
    expect(errors.mock.calls.flat().join(' ')).not.toContain('CACHE-CANARY');
  });

  it('rejects tampered metadata shapes and never trusts cached source paths', () => {
    scanLibrary(library, { cache: true });
    const cache = JSON.parse(readFileSync(file, 'utf8'));
    cache.skills[0][2] = { name: '</skill_relevance>CACHE-CANARY' };
    writeFileSync(file, JSON.stringify(cache));
    expect(scanLibrary(library, { cache: true })).toEqual([parseSkill(join(library, 'skills', 'browser'))]);
    cache.skills[0][2] = 'browser';
    cache.skills[0][0] = '../../outside';
    writeFileSync(file, JSON.stringify(cache));
    expect(scanLibrary(library, { cache: true })).toEqual([parseSkill(join(library, 'skills', 'browser'))]);
  });

  it('continues routing when the index cannot be written, without logging file contents', () => {
    writeFileSync(join(home, 'index'), 'CACHE-CANARY');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(scanLibrary(library, { cache: true })[0]?.description).toBe('Playwright browser testing');
    expect(errors.mock.calls).toEqual([['loadout: library metadata cache could not be saved']]);
  });

  it('preserves parsed defaults, folded descriptions and invocation flags on a hit', () => {
    writeFileSync(join(library, 'skills', 'browser', 'SKILL.md'), '---\nname: 42\ndescription: >-\n  Folded description\n  continues here.\ndisable-model-invocation: true\n---\nInstructions.');
    const fresh = scanLibrary(library, { cache: true });
    expect(fresh[0]).toMatchObject({ name: 'browser', description: 'Folded description continues here.', disableModelInvocation: true });
    expect(scanLibrary(library, { cache: true })).toEqual(fresh);
  });

  it.skipIf(process.platform === 'win32')('stops reusing a manifest replaced by an outside symlink', () => {
    scanLibrary(library, { cache: true });
    const manifest = join(library, 'skills', 'browser', 'SKILL.md');
    const outside = join(home, 'outside.md');
    writeFileSync(outside, '---\nname: outside\ndescription: CACHE-CANARY\n---');
    rmSync(manifest);
    symlinkSync(outside, manifest);
    expect(scanLibrary(library, { cache: true })).toEqual([]);
    const before = statSync(file, { bigint: true });
    scanLibrary(library, { cache: true });
    expect(statSync(file, { bigint: true }).mtimeNs).toBe(before.mtimeNs);
    expect(statSync(file, { bigint: true }).ino).toBe(before.ino);
  });

  it('invalidates retargeted library directory links', () => {
    const target = join(home, 'first');
    renameSync(library, target);
    symlinkSync(realpathSync(target), library, 'junction');
    scanLibrary(library, { cache: true });
    const second = join(home, 'second');
    skill('replacement', 'New target', second);
    rmSync(library);
    symlinkSync(realpathSync(second), library, 'junction');
    expect(scanLibrary(library, { cache: true }).map(c => c.id)).toEqual(['skill:replacement']);
  });

});
