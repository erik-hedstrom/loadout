/**
 * Hand-written requests against your real loadout library (~/.loadout or
 * LOADOUT_HOME). Each request lists the skills that count as a right answer.
 * Not a benchmark (small, library-specific), but free of the vocabulary bias of
 * generated tasks.
 *
 *   npx tsx bench/handwritten.ts
 */
import { join } from 'node:path';
import { jevBaseUrl, loadConfig, paths, resolveApiKey } from '../src/config.js';
import { jevClient } from '../src/jev.js';
import { scanLibrary, skillExcerpt } from '../src/library.js';
import { route } from '../src/route.js';
import { DATA, readJsonl } from './lib.js';

interface Case { kind: 'niche' | 'several' | 'none' | 'mention'; accept: string[]; task: string }
const cases = readJsonl<Case>(join(DATA, 'handwritten.jsonl'));
const config = loadConfig();
const apiKey = resolveApiKey(config);
if (!apiKey) throw new Error('needs a TypeSafe key');
const client = jevClient({ apiKey, baseUrl: jevBaseUrl(config), model: config.jev.model });
const library = scanLibrary(paths.library());
const repo = { name: 'app', files: [], dependencies: [], languages: {} };

let pass = 0;
let cost = 0;
for (const c of cases) {
  const d = await route({ task: c.task, repo, library, config, client, excerpt: skillExcerpt });
  cost += d.stats.costUsd ?? 0;
  const loaded = d.selected.map((s) => s.capability.name);
  const injected = d.selected.filter((s) => s.inject).map((s) => s.capability.name);
  const ok =
    c.kind === 'none' ? loaded.length === 0 : c.kind === 'mention' ? injected.some((n) => c.accept.includes(n)) : loaded.some((n) => c.accept.includes(n));
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.kind.padEnd(7)} need ${d.need?.toFixed(2) ?? ' -  '}  loaded: ${loaded.join(', ') || '—'}${injected.length ? `  injected: ${injected.join(', ')}` : ''}`);
}
console.log(`\n${pass}/${cases.length} pass on ${library.length} skills, $${cost.toFixed(4)}`);
