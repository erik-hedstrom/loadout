import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audit } from '../src/audit.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { doctor } from '../src/doctor.js';
import { scanLibrary } from '../src/library.js';

describe('read-only library consumers', () => {
  let root: string;
  let home: string;
  let project: string;
  const snapshot = (dir: string): unknown[] => {
    if (!existsSync(dir)) return [];
    const st = statSync(dir, { bigint: true });
    return [st.mode, st.mtimeNs, st.ctimeNs, st.isDirectory()
      ? readdirSync(dir).sort().map(name => [name, snapshot(join(dir, name))])
      : readFileSync(dir)];
  };
  const prepare = (state: string) => {
    if (state === 'absent home') return;
    const skill = join(home, 'library', 'skills', 'browser');
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, 'SKILL.md'), '---\nname: browser\ndescription: Browser testing\n---\nInstructions.');
    if (state === 'present cache' || state === 'stale cache') scanLibrary(join(home, 'library'), { cache: true });
    if (state === 'stale cache') writeFileSync(join(skill, 'SKILL.md'), '---\nname: browser\ndescription: Updated browser testing\n---\nInstructions.');
  };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'loadout-read-only-'));
    home = join(root, '.loadout');
    project = join(root, 'repo');
    mkdirSync(join(project, '.git'), { recursive: true });
    mkdirSync(join(root, 'bin'));
    vi.stubEnv('HOME', root);
    vi.stubEnv('USERPROFILE', root);
    vi.stubEnv('LOADOUT_HOME', home);
    vi.stubEnv('CLAUDE_CONFIG_DIR', join(root, 'claude'));
    vi.stubEnv('CODEX_HOME', join(root, 'codex'));
    vi.stubEnv('XDG_CONFIG_HOME', join(root, '.config'));
    vi.stubEnv('PATH', join(root, 'bin'));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  const states = ['absent home', 'absent cache', 'present cache', 'stale cache'];
  it.each(states)('audit leaves LOADOUT_HOME untouched with %s', async state => {
    prepare(state);
    const before = snapshot(home);
    await audit(project);
    expect(snapshot(home)).toEqual(before);
  });
  it.each(states)('doctor leaves LOADOUT_HOME untouched with %s', async state => {
    prepare(state);
    const before = snapshot(home);
    await doctor({ ...DEFAULT_CONFIG, router: 'lexical', embeddings: false }, () => { throw new Error('unexpected Jev call'); });
    expect(snapshot(home)).toEqual(before);
  });
});
