import { lstatSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Capability } from '../src/types.js';
import type { B11Row, B11Task } from './b11-types.js';
import type { Canary } from './b11-mcp.js';
import { confinedPath, materializeSkill } from './b11-sandbox.js';

/** Refuse linked ancestors as well as linked roots before reading or creating directories. */
function directoryRoot(root: string): boolean {
  const absolute = resolve(root);
  let present = false;
  for (let cursor = absolute; ; cursor = dirname(cursor)) {
    const stat = lstatSync(cursor, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink()) throw new Error('linked skill root');
    if (cursor === absolute) {
      present = stat !== undefined;
    }
    if (dirname(cursor) === cursor) return present;
  }
}

export function prepareSkills(libraryRoot: string, plantedRoot: string, destination: string): { skills: Capability[]; plantedNames: Set<string>; rejected: number } {
  directoryRoot(destination);
  mkdirSync(destination, { recursive: true });
  const skills: Capability[] = [], plantedNames = new Set<string>();
  let rejected = 0;
  for (const catalogue of [{ root: resolve(libraryRoot), planted: false }, { root: resolve(plantedRoot), planted: true }]) {
    if (!directoryRoot(catalogue.root)) continue;
    const names = readdirSync(catalogue.root, { withFileTypes: true })
      .filter(entry => entry.isDirectory() || entry.isSymbolicLink()).map(entry => entry.name).sort();
    for (const name of names) {
      try {
        const source = confinedPath(catalogue.root, name);
        confinedPath(source, 'SKILL.md');
        const skill = materializeSkill(source, destination);
        skills.push({ ...skill, id: `skill:${skill.name}`, kind: 'skill' });
        if (catalogue.planted) plantedNames.add(skill.name);
      } catch (error) {
        if (catalogue.planted) throw new Error('planted skill materialization failed', { cause: error });
        // Validation/read errors from materializeSkill are fixed diagnostics. Raw filesystem
        // failures during its writes must stop the run rather than change the measured library.
        if ((error as NodeJS.ErrnoException).code !== undefined) throw error;
        rejected++;
      }
    }
  }
  return { skills, plantedNames, rejected };
}

export function listingFor(arm: B11Row['arm'], skills: Capability[], servers: Capability[], plantedNames: Set<string>, canaries: Canary[], heavy?: { skills: number; servers: number }): { skills: Capability[]; servers: Capability[] } {
  switch (arm) {
    case 'all': return { skills, servers };
    case 'skills-all': return { skills, servers: [] };
    case 'mcp-all': return { skills: [], servers };
    case 'skills-50':
    case 'skills-250':
    case 'mcp-1':
    case 'mcp-5':
    case 'heavy-max': {
      if (arm === 'heavy-max' && !heavy) throw new Error('heavy-max requires a configuration');
      const skillCount = arm === 'heavy-max' ? heavy!.skills : arm === 'skills-50' ? 50 : arm === 'skills-250' ? 250 : 0;
      const serverCount = arm === 'heavy-max' ? heavy!.servers : arm === 'mcp-1' ? 1 : arm === 'mcp-5' ? 5 : 0;
      // Sizes count distractors; task references stay available and can increase the actual listing.
      const distractors = skills.filter(skill => !plantedNames.has(skill.name)).slice(0, skillCount);
      const names = new Set([...servers.slice(0, serverCount).map(server => server.name), ...canaries.map(canary => canary.server)]);
      return {
        skills: skillCount ? [...distractors, ...skills.filter(skill => plantedNames.has(skill.name))] : [],
        servers: serverCount ? servers.filter(server => names.has(server.name)) : [],
      };
    }
    case 'bare':
    case 'gateway':
    case 'preselect': return { skills: [], servers: [] };
  }
}

export function validateNeeds(tasks: B11Task[], skills: Capability[], canaries: Canary[]): void {
  const names = new Set(skills.map(skill => skill.name));
  for (const task of tasks) {
    if (task.needs.skill && !names.has(task.needs.skill)) throw new Error('task requires an unavailable skill');
    if ((task.needs.server || task.needs.tool) && !canaries.some(canary => canary.server === task.needs.server && canary.tool === task.needs.tool)) {
      throw new Error('task requires an unavailable planted server/tool pair');
    }
  }
}
