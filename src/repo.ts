import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import type { RepoSignals } from './types.js';
import { withoutKey } from './config.js';

const MAX_FILES = 40;
const MAX_DEPS = 60;

function gitFiles(cwd: string): string[] {
  try {
    return execFileSync('git', ['ls-files'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024, env: withoutKey() })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function dependencies(cwd: string): string[] {
  const deps: string[] = [];
  const pkg = join(cwd, 'package.json');
  if (existsSync(pkg)) {
    try {
      const json = JSON.parse(readFileSync(pkg, 'utf8')) as Record<string, Record<string, string> | undefined>;
      deps.push(...Object.keys({ ...json.dependencies, ...json.devDependencies }));
    } catch {
      // Unparseable package.json: skip.
    }
  }
  for (const file of ['requirements.txt', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'Gemfile']) {
    if (existsSync(join(cwd, file))) deps.push(file);
  }
  return deps.slice(0, MAX_DEPS);
}

/** Cheap, local signals about the repo so the router can favour repo-specific capabilities. */
export function repoSignals(cwd: string): RepoSignals {
  const tracked = gitFiles(cwd);
  const languages: Record<string, number> = {};
  for (const file of tracked) {
    const ext = extname(file).slice(1).toLowerCase();
    if (ext) languages[ext] = (languages[ext] ?? 0) + 1;
  }
  const topLanguages = Object.fromEntries(
    Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
  );
  let files: string[];
  try {
    files = readdirSync(cwd).filter((f) => !f.startsWith('.git') && f !== 'node_modules');
  } catch {
    files = [];
  }
  return { name: basename(cwd), files: files.slice(0, MAX_FILES), dependencies: dependencies(cwd), languages: topLanguages };
}

export function repoQueryText(repo: RepoSignals): string {
  return [repo.name, ...repo.files, ...repo.dependencies, ...Object.keys(repo.languages)].join(' ');
}
