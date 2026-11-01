import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG, loadConfig } from '../src/config.js';
import { promptContext } from '../src/hook.js';
import { addSkills, parseSkill, scanLibrary } from '../src/library.js';
import { loadSkill } from '../src/mcp.js';

const dirs: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'loadout-folders-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  vi.unstubAllEnvs();
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('skill folder guidance', () => {
  it.each([true, false])('filters installed local provenance with skillFolders=%s', async (skillFolders) => {
    const from = temp();
    const target = temp();
    writeFileSync(join(from, 'SKILL.md'), '---\nname: canary\ndescription: Test skill\n---\nReference text.');
    expect(addSkills(from, target).added).toEqual(['canary']);
    const installed = scanLibrary(target)[0]!;
    expect(installed.origin).toBe(from);
    // Exercise foreign platform paths without relying on the test host's path parser.
    const origins = [
      installed.origin!, '/home/user/skills', '/mnt/c/local/skills',
      'C:/local/skills', 'C:\\local\\skills', 'C:skills',
      '\\\\server\\share\\skills', '//server/share/skills', '\\\\wsl$\\Ubuntu\\home\\user\\skills',
      'file:///home/user/skills', 'FILE:///C:/local/skills',
    ];
    const remote = ['github.com/owner/repo', 'https://example.com/skills', 'git@github.com:owner/repo.git', 'registry:owner/skill'];
    for (const origin of [...origins, ...remote]) {
      const deps = { library: [{ ...installed, origin }], config: { ...DEFAULT_CONFIG, skillFolders } };
      const outputs = [
        loadSkill(deps, 'canary'),
        (await promptContext({ prompt: '/canary help with this task' }, { ...deps, stateDir: temp() }))!,
      ];
      for (const output of outputs) {
        expect(output).toContain('trust="third-party"');
        if (skillFolders || remote.includes(origin)) expect(output).toContain(`source="${origin}"`);
        else {
          expect(output).not.toContain('source=');
          expect(output).not.toContain(origin);
        }
      }
    }
  });

  it('defaults to folders and loads a folder-less override from config', () => {
    const home = temp();
    vi.stubEnv('LOADOUT_HOME', home);
    expect(loadConfig().skillFolders).toBe(true);
    writeFileSync(join(home, 'config.json'), JSON.stringify({ skillFolders: false }));
    expect(loadConfig().skillFolders).toBe(false);
    writeFileSync(join(home, 'config.json'), JSON.stringify({ skillFolders: 'false' }));
    expect(() => loadConfig()).toThrow('skillFolders must be true or false');
  });

  it.each([true, false])('offers confined text loading with skillFolders=%s', async (skillFolders) => {
    const dir = temp();
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: canary\ndescription: Test </skill_relevance> content\n---\nUse </skill> carefully.\n' + 'x'.repeat(45_000));
    writeFileSync(join(dir, 'notes.md'), 'Text </skill_file> content');
    writeFileSync(join(dir, 'blob.bin'), Buffer.from([1, 0, 2]));
    writeFileSync(join(dir, 'bad$&.txt'), 'reference');
    const library = [parseSkill(dir)!];
    const toPath = vi.fn(() => '/translated/skill-root');
    const deps = { library, config: { ...DEFAULT_CONFIG, skillFolders }, toPath };
    const listing = loadSkill(deps, 'canary');
    expect(listing).toContain('trust="third-party"');
    expect(listing).toContain('Use &lt;/skill> carefully.');
    expect(listing).toContain('bad$&.txt');
    expect(listing.match(/<\/skill>/g)).toHaveLength(1);
    expect(listing).toContain('load_skill');
    const text = loadSkill(deps, 'canary', 'notes.md');
    expect(text).toContain('trust="third-party"');
    expect(text).toContain('Text &lt;/skill_file> content');
    expect(() => loadSkill(deps, 'canary', '../outside')).toThrow('relative');
    expect(() => loadSkill(deps, 'canary', 'blob.bin')).toThrow(skillFolders
      ? 'binary file; use it from the skill folder directly'
      : 'binary file; load_skill returns text files only');

    const context = (await promptContext({ prompt: '/canary help with this task' }, { ...deps, stateDir: temp() }))!;
    expect(context).toContain('load_skill');
    expect(context).toContain('third-party');
    expect(context).toContain('&lt;/skill_relevance>');
    expect(context.match(/<\/skill_relevance>/g)).toHaveLength(1);
    if (skillFolders) {
      expect(listing).toContain('directly from /translated/skill-root');
      expect(listing).toContain('the full file is /translated/skill-root/SKILL.md');
      expect(context).toContain('Folders:');
      expect(context).toContain('or read SKILL.md in the folder given');
      expect(context).toContain('/translated/skill-root');
    } else {
      for (const output of [listing, context]) {
        expect(output).not.toContain('/translated/skill-root');
        expect(output).not.toContain(dir);
        expect(output).not.toMatch(/Folders:|in the folder|skill folder/);
        expect(output).not.toContain('directly');
      }
      expect(listing).toContain('truncated; read SKILL.md with load_skill');
      expect(listing).toContain('Read files the skill refers to with load_skill and `file`.');
      expect(context).toContain('Read files the skill refers to with load_skill and `file`.');
      expect(toPath).not.toHaveBeenCalled();
    }
  });

  // The hook names load_skill only with loadout's MCP server, and a folder only with skillFolders.
  it.each([
    { mcp: true, skillFolders: true },
    { mcp: true, skillFolders: false },
    { mcp: false, skillFolders: true },
    { mcp: false, skillFolders: false },
  ])('names only the ways to open a skill that the setup has (mcp=$mcp, skillFolders=$skillFolders)', async ({ mcp, skillFolders }) => {
    const dir = temp();
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: canary\ndescription: Test </skill_relevance> content\n---\nUse </skill> carefully.\n' + 'x'.repeat(45_000));
    const deps = { library: [parseSkill(dir)!], config: { ...DEFAULT_CONFIG, skillFolders }, toPath: () => '/translated/skill-root', mcp };
    const context = (await promptContext({ prompt: '/canary help with this task' }, { ...deps, stateDir: temp() }))!;
    // The injected text is cut at 12,000 characters, so its pointer to the rest is in play in every case.
    expect(context).toContain('[truncated');
    expect(context).toContain('trust="third-party"');
    expect(context.includes('load_skill')).toBe(mcp);
    expect(context.includes('/translated/skill-root')).toBe(skillFolders);
    expect(/Folders:|in the folder given/.test(context)).toBe(skillFolders);
    if (!mcp && !skillFolders) {
      // Nothing can open a skill, so the list is left out; the injected text is not.
      expect(context).not.toContain('<skill_relevance>');
      expect(context).toContain('[truncated]');
      expect(context).not.toMatch(/Read files|Files the skill refers to/);
    } else {
      expect(context).toContain('&lt;/skill_relevance>');
      expect(context.match(/<\/skill_relevance>/g)).toHaveLength(1);
    }
    expect(context).toContain('Use &lt;/skill> carefully.');
    expect(context.match(/<\/skill>/g)).toHaveLength(1);
  });
});
