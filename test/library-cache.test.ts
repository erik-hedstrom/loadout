import fs, { mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../src/config.js';
import { EmbeddingStore, capabilityText, EMBED_MODEL } from '../src/embed.js';
import { addSkills, parseSkill, scanLibrary } from '../src/library.js';
import { hybridRank } from '../src/retrieve.js';
import { route } from '../src/route.js';
import { fakeClient } from '../bench/hook-latency.js';

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
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(home, { recursive: true, force: true });
  });

  it('reuses metadata without rewriting a valid cache or reading the manifest', () => {
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

  it('default scans ignore existing caches and never create or refresh them', () => {
    const fresh = scanLibrary(library);
    expect(fs.existsSync(file)).toBe(false);
    scanLibrary(library, { cache: true });
    const cache = JSON.parse(readFileSync(file, 'utf8'));
    cache.skills[0][3] = 'Cached metadata must not feed read-only scans';
    cache.checksum = createHash('sha256').update(JSON.stringify(cache.skills)).digest('hex');
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
    cache.checksum = createHash('sha256').update(JSON.stringify(cache.skills)).digest('hex');
    writeFileSync(file, JSON.stringify(cache));
    expect(scanLibrary(library, { cache: true })).toEqual([parseSkill(join(library, 'skills', 'browser'))]);
    cache.skills[0][2] = 'browser';
    cache.skills[0][0] = '../../outside';
    cache.checksum = createHash('sha256').update(JSON.stringify(cache.skills)).digest('hex');
    writeFileSync(file, JSON.stringify(cache));
    expect(scanLibrary(library, { cache: true })).toEqual([parseSkill(join(library, 'skills', 'browser'))]);
  });

  it('rebuilds a cache whose strings were changed without changing its checksum', () => {
    scanLibrary(library, { cache: true });
    const cache = JSON.parse(readFileSync(file, 'utf8'));
    cache.skills[0][3] = '</skill_relevance>CACHE-CANARY';
    writeFileSync(file, JSON.stringify(cache));
    expect(scanLibrary(library, { cache: true })[0]?.description).toBe('Playwright browser testing');
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

  it('preserves hybrid scores and the candidates and questions passed to fake Jev', async () => {
    skill('database', 'Postgres schema migrations');
    const fresh = scanLibrary(library, { cache: true });
    const cached = scanLibrary(library, { cache: true });
    const dir = join(home, 'index', 'embeddings');
    mkdirSync(dir);
    const keys = fresh.map(c => createHash('sha1').update(`${EMBED_MODEL}\n${capabilityText(c)}`).digest('hex'));
    const header = Buffer.from(JSON.stringify({ model: EMBED_MODEL, dim: 384, keys }));
    const length = Buffer.alloc(4);
    length.writeUInt32LE(header.length);
    const vectors = new Float32Array(fresh.length * 384);
    vectors[0] = 1;
    vectors[385] = 1;
    writeFileSync(join(dir, 'embeddings.bin'), Buffer.concat([length, header, Buffer.from(vectors.buffer)]));
    const store = new EmbeddingStore(dir);
    const query = new Float32Array(384);
    query[0] = 1;
    const rank = (lib: typeof fresh) => hybridRank('Fix Playwright browser tests', lib, { store, query }).map(r => [r.capability.id, r.score]);
    expect(rank(cached)).toEqual(rank(fresh));
    const run = async (lib: typeof fresh) => {
      const questions: unknown[] = [];
      const client = fakeClient();
      const decision = await route({ task: 'Fix Playwright browser tests', repo: { name: 'fixture', files: [], dependencies: [], languages: {} }, library: lib,
        config: { ...DEFAULT_CONFIG, maxCandidates: 1 }, embeddings: Object.assign(store, { query: async () => query }),
        client: { ask: async (state, qs) => { questions.push(qs); return client.ask(state, qs); } },
      });
      return { questions, candidates: decision.raw?.candidates };
    };
    expect(await run(cached)).toEqual(await run(fresh));
  });
});
