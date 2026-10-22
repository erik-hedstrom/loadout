import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { parseGitHub, readConfined } from '../src/library.js';
import { directoryRoot, prepareSkills } from './b11-listing.js';
import { confinedPath } from './b11-sandbox.js';
import { HarnessError } from './b11-errors.js';

export interface B11LibraryProvenance {
  corpus: 'bench/data/library.sh';
  accepted: number;
  rejected: number;
  namesSha256: string;
  contentSha256: string;
  sourcesSha256: string;
  sources: { source: string; revision: string | null; corpusCommit: string | null; accepted: number }[];
}

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const hash = (value: unknown) => sha256(JSON.stringify(value));
const sourceSchema = z.object({
  origin: z.string(),
  path: z.string().refine(p => p === '.' || p.split('/').every(part => !!part && part !== '.' && part !== '..') && !/[\\\x00-\x1f:]/.test(p)),
  revision: z.string().regex(/^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/).optional(),
});

function regularFile(root: string, file: string, limit: number): Buffer {
  const path = confinedPath(root, file);
  // A FIFO blocks open() before readConfined can inspect its descriptor.
  if (!lstatSync(path).isFile()) throw new Error('regular library file required');
  return readConfined(root, file, limit);
}

/** Validate the explicit public corpus before any distractor is materialized for a provider. */
export function prepareB11Library(
  libraryRoot: string,
  plantedRoot: string,
  destination: string,
): ReturnType<typeof prepareSkills> & { provenance: B11LibraryProvenance } {
  const candidates = new Map<string, { source: string; path: string; revision: string | null; corpusCommit: string | null }>();
  const skillsRoot = resolve(libraryRoot, 'skills');
  try {
    directoryRoot(skillsRoot);
    // This repository file is policy, never shell input. Keep its Composio subpath restrictions.
    const corpus = readFileSync(new URL('./data/library.sh', import.meta.url), 'utf8');
    const allowed = [...corpus.matchAll(/^loadout add (https:\/\/github\.com\/\S+)([^\n]*)/gm)].map(match => {
      const spec = match[1]!, gh = parseGitHub(spec)!;
      return { spec, origin: `github.com/${gh.owner}/${gh.repo}`, path: gh.subpath, corpusCommit: match[2]?.match(/@ ([a-f0-9]{12,64})\b/)?.[1] ?? null };
    });
    const folders = readdirSync(skillsRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory() || entry.isSymbolicLink()).map(entry => entry.name).sort();
    for (const folder of folders) {
      const skillRoot = confinedPath(skillsRoot, folder);
      const metadata = sourceSchema.parse(JSON.parse(regularFile(skillRoot, '.loadout-source.json', 16 * 1024).toString('utf8')));
      const publicSource = allowed.find(entry => entry.origin === metadata.origin &&
        (entry.path === undefined || metadata.path === entry.path || metadata.path.startsWith(`${entry.path}/`)));
      if (!publicSource) throw new Error('source outside public corpus');
      candidates.set(skillRoot, {
        source: publicSource.spec, path: metadata.path, revision: metadata.revision?.toLowerCase() ?? null, corpusCommit: publicSource.corpusCommit });
    }
  } catch {
    // Filesystem errors and metadata can contain host paths or private skill names.
    throw new HarnessError('B11 library provenance validation failed');
  }

  const prepared = prepareSkills(skillsRoot, plantedRoot, destination);
  const distractors = prepared.skills.filter(skill => !prepared.plantedNames.has(skill.name));
  const accepted = distractors.map(skill => {
    const candidate = candidates.get(prepared.originalSources.get(skill.name)!)!;
    return { name: skill.name, source: candidate.source, path: candidate.path, revision: candidate.revision, corpusCommit: candidate.corpusCommit,
      textSha256: sha256(readConfined(skill.source, 'SKILL.md', 512 * 1024)) };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const groups = new Map<string, B11LibraryProvenance['sources'][number]>();
  for (const entry of accepted) {
    const key = JSON.stringify([entry.source, entry.revision]);
    const group = groups.get(key) ?? { source: entry.source, revision: entry.revision, corpusCommit: entry.corpusCommit, accepted: 0 };
    group.accepted++;
    groups.set(key, group);
  }
  return { ...prepared, provenance: {
    corpus: 'bench/data/library.sh', accepted: accepted.length, rejected: prepared.rejected,
    namesSha256: hash(accepted.map(entry => entry.name)),
    contentSha256: hash(accepted.map(entry => [entry.name, entry.textSha256])),
    sourcesSha256: hash(accepted.map(entry => [entry.name, entry.source, entry.path, entry.revision, entry.corpusCommit])),
    sources: [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, group]) => group),
  } };
}
