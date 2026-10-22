import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as sandbox from '../bench/b11-sandbox.js';
import { listingFor, prepareSkills, validateNeeds } from '../bench/b11-listing.js';
import type { B11Task } from '../bench/b11-types.js';
import type { Canary } from '../bench/b11-mcp.js';
import type { Capability } from '../src/types.js';

const roots: string[] = [];
const temp = () => { const root = mkdtempSync(join(realpathSync(tmpdir()), 'b11-listing-')); roots.push(root); return root; };
afterEach(() => { vi.restoreAllMocks(); roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })); });
function skill(root: string, folder: string, name = folder): string {
  const source = join(root, folder);
  mkdirSync(source, { recursive: true });
  writeFileSync(join(source, 'SKILL.md'), `---\nname: ${name}\ndescription: synthetic task reference\n---\nReference </skill> text.\n`);
  return source;
}
const capability = (name: string, kind: Capability['kind'] = 'skill'): Capability => ({ name, kind, id: `${kind}:${name}`, description: 'synthetic', source: 'fixture' });
const canary = (server: string, tool = 'answer'): Canary => ({ server, tool, description: 'synthetic', inputSchema: { type: 'object' }, response: 'synthetic', args: {} });
const task = (needs: B11Task['needs']): B11Task => ({ id: 'b11-listing-task', kind: 'plain', prompt: 'synthetic', workspace: 'plain', check: { type: 'files', path: 'answer', all: [], none: [] }, needs });

describe('B11 prepared skill catalogue', () => {
  it('materializes sorted library skills followed by all planted skills and keeps manifest names', () => {
    const library = temp(), planted = temp(), destination = temp();
    skill(library, 'z-folder', 'z-library'); skill(library, 'a-folder', 'a-library');
    const plant = skill(planted, 'different-folder', 'required-skill');
    writeFileSync(join(plant, 'run.sh'), 'untrusted code');
    const result = prepareSkills(library, planted, destination);
    expect(result.skills.map(s => [s.name, s.kind, s.id])).toEqual([
      ['a-library', 'skill', 'skill:a-library'], ['z-library', 'skill', 'skill:z-library'], ['required-skill', 'skill', 'skill:required-skill'],
    ]);
    expect(result.plantedNames).toEqual(new Set(['required-skill']));
    expect(result.rejected).toBe(0);
    expect(readdirSync(result.skills[2]!.source)).toEqual(['SKILL.md']);
    expect(readFileSync(join(result.skills[2]!.source, 'SKILL.md'), 'utf8')).toContain('Third-party skill text.');
    expect(readFileSync(join(result.skills[2]!.source, 'SKILL.md'), 'utf8')).not.toContain('Reference </skill>');
  });

  it('counts malformed, missing, duplicate and linked library manifests without materializing them', () => {
    const library = temp(), planted = temp(), destination = temp(), outside = temp();
    skill(library, 'a-valid', 'valid'); skill(library, 'b-duplicate', 'valid');
    const malformed = skill(library, 'c-malformed'); writeFileSync(join(malformed, 'SKILL.md'), 'not a manifest');
    mkdirSync(join(library, 'd-missing'));
    skill(outside, 'outside-skill');
    symlinkSync(join(outside, 'outside-skill'), join(library, 'e-linked'), 'junction');
    writeFileSync(join(library, 'README.md'), 'not a skill directory');
    const result = prepareSkills(library, planted, destination);
    expect(result.rejected).toBe(4);
    expect(result.skills.map(s => s.name)).toEqual(['valid']);
    expect(readdirSync(destination)).toEqual(['valid']);
  });

  it('fails on a malformed planted manifest and on a planted collision with either catalogue', () => {
    const library = temp(), planted = temp();
    const source = skill(planted, 'plant'); writeFileSync(join(source, 'SKILL.md'), 'invalid planted manifest');
    expect(() => prepareSkills(library, planted, temp())).toThrow();
    writeFileSync(join(source, 'SKILL.md'), '---\nname: collision\ndescription: synthetic\n---\nbody');
    skill(library, 'library', 'collision');
    expect(() => prepareSkills(library, planted, temp())).toThrow(/duplicate|planted/i);
    rmSync(join(library, 'library'), { recursive: true });
    skill(planted, 'other-folder', 'collision');
    expect(() => prepareSkills(library, planted, temp())).toThrow(/duplicate|planted/i);
  });

  it('treats absent roots as empty and refuses non-directory roots', () => {
    const root = temp();
    expect(prepareSkills(join(root, 'missing-library'), join(root, 'missing-planted'), join(root, 'destination')))
      .toEqual({ skills: [], plantedNames: new Set(), rejected: 0 });
    const file = join(root, 'file'); writeFileSync(file, 'not a directory');
    expect(() => prepareSkills(file, temp(), temp())).toThrow();
    expect(() => prepareSkills(temp(), file, temp())).toThrow();
    expect(() => prepareSkills(temp(), temp(), file)).toThrow();
  });

  it('refuses source roots, source ancestors and destinations reached through directory links', () => {
    const root = temp(), outside = temp(); skill(outside, 'hidden');
    symlinkSync(outside, join(root, 'link'), 'junction');
    expect(() => prepareSkills(join(root, 'link'), temp(), temp())).toThrow();
    expect(() => prepareSkills(temp(), join(root, 'link'), temp())).toThrow();
    mkdirSync(join(outside, 'nested'));
    expect(() => prepareSkills(join(root, 'link', 'nested'), temp(), temp())).toThrow();
    expect(() => prepareSkills(temp(), temp(), join(root, 'link', 'destination'))).toThrow();
    expect(readdirSync(outside).sort()).toEqual(['hidden', 'nested']);
  });

  it('fails on linked planted directories without accepting their external manifest', () => {
    const planted = temp(), outside = temp(); skill(outside, 'hidden');
    symlinkSync(join(outside, 'hidden'), join(planted, 'linked'), 'junction');
    expect(() => prepareSkills(temp(), planted, temp())).toThrow();
  });

  it.skipIf(process.platform === 'win32')('never follows linked manifests, including links into the same skill folder', () => {
    const materialize = vi.spyOn(sandbox, 'materializeSkill');
    for (const planted of [false, true]) {
      const library = temp(), plants = temp(), root = planted ? plants : library;
      const source = skill(root, 'linked-manifest');
      writeFileSync(join(source, 'other.md'), readFileSync(join(source, 'SKILL.md')));
      rmSync(join(source, 'SKILL.md'));
      symlinkSync(join(source, 'other.md'), join(source, 'SKILL.md'));
      if (planted) expect(() => prepareSkills(library, plants, temp())).toThrow();
      else expect(prepareSkills(library, plants, temp())).toMatchObject({ skills: [], rejected: 1 });
    }
    // Reject before the materializer: O_NOFOLLOW also rejects these on Linux, but is not portable.
    expect(materialize).not.toHaveBeenCalled();
  });

  it('does not classify destination write failures as rejected library skills', () => {
    const library = temp(); skill(library, 'valid');
    vi.spyOn(sandbox, 'materializeSkill').mockImplementationOnce(() => { throw Object.assign(new Error('synthetic disk full'), { code: 'ENOSPC' }); });
    expect(() => prepareSkills(library, temp(), temp())).toThrow('synthetic disk full');
  });
});

describe('B11 per-arm native listing', () => {
  const skills = [...Array.from({ length: 300 }, (_, i) => capability(`library-${i}`)), capability('plant-a'), capability('plant-b')];
  const servers = Array.from({ length: 20 }, (_, i) => capability(`fixture-${i}`, 'mcp'));
  const plants = new Set(['plant-a', 'plant-b']);
  const canaries = [canary('fixture-0'), canary('fixture-12'), canary('fixture-12', 'second'), canary('fixture-19')];

  it('keeps every planted skill in addition to N library distractors in each skill sweep', () => {
    for (const [arm, count] of [['skills-50', 50], ['skills-250', 250]] as const) {
      const listing = listingFor(arm, skills, servers, plants, canaries);
      expect(listing.skills).toEqual([...skills.slice(0, count), ...skills.slice(-2)]);
      expect(listing.servers).toEqual([]);
    }
    expect(skills).toHaveLength(302);
    expect(listingFor('skills-50', [skills[0]!, ...skills.slice(-2)], servers, plants, canaries).skills)
      .toEqual([skills[0], ...skills.slice(-2)]);
  });

  it('unions all canary servers with the MCP prefix without duplicates and preserves base order', () => {
    expect(listingFor('mcp-1', skills, servers, plants, canaries)).toEqual({ skills: [], servers: [servers[0], servers[12], servers[19]] });
    expect(listingFor('mcp-5', skills, servers, plants, canaries)).toEqual({ skills: [], servers: [...servers.slice(0, 5), servers[12], servers[19]] });
  });

  it('selects whole native core inventories and leaves routed/bare inventories to their owners', () => {
    expect(listingFor('all', skills, servers, plants, canaries)).toEqual({ skills, servers });
    expect(listingFor('skills-all', skills, servers, plants, canaries)).toEqual({ skills, servers: [] });
    expect(listingFor('mcp-all', skills, servers, plants, canaries)).toEqual({ skills: [], servers });
    for (const arm of ['bare', 'gateway', 'preselect'] as const) expect(listingFor(arm, skills, servers, plants, canaries)).toEqual({ skills: [], servers: [] });
  });
});

describe('B11 declared task needs', () => {
  const skills = [capability('required')], canaries = [canary('fixture-a', 'lookup'), canary('fixture-b', 'other')];

  it('accepts plain tasks, materialized skills and exact planted server/tool pairs', () => {
    expect(() => validateNeeds([task({}), task({ skill: 'required' }), task({ server: 'fixture-a', tool: 'lookup' })], skills, canaries)).not.toThrow();
  });

  it('rejects a required skill that did not materialize', () => {
    expect(() => validateNeeds([task({ skill: 'missing' })], skills, canaries)).toThrow(/skill/i);
  });

  it('rejects a missing, mismatched or half-specified planted server/tool pair', () => {
    for (const needs of [{ server: 'fixture-c', tool: 'lookup' }, { server: 'fixture-a', tool: 'missing' }, { server: 'fixture-a', tool: 'other' }, { server: 'fixture-a' }, { tool: 'lookup' }]) {
      expect(() => validateNeeds([task(needs)], skills, canaries)).toThrow(/server|tool|canary/i);
    }
  });
});
