import { randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { loadoutHome } from './config.js';

// Cache and state files under the loadout home. They refuse links planted before loadout runs; scope in DESIGN.md, "Cache and state files".

/**
 * False when a link, or anything but a folder, stands where a folder of the loadout home should be. The home
 * itself may be a link unless checkHome is set (config writes refuse it). Where loadout keeps its cache
 * is the user's choice, while a link below it is not something loadout created. Folders outside the home are not checked.
 */
export function isPlainFolder(dir: string, checkHome = false): boolean {
  const rel = relative(loadoutHome(), dir);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return true;
  let current = loadoutHome();
  const parts = rel ? rel.split(sep) : [];
  if (checkHome) parts.unshift('.');
  for (const part of parts) {
    current = join(current, part);
    try {
      if (!lstatSync(current).isDirectory()) return false;
    } catch (err) {
      // Not created yet: creating it makes a real folder.
      return (err as NodeJS.ErrnoException).code === 'ENOENT';
    }
  }
  return true;
}

/** Write a cache file next to its siblings: an exclusive, owner-only temp file, then one atomic rename. Never throws. */
export function writeCacheFile(dir: string, file: string, body: string | Buffer, what: string): void {
  const tmp = join(dir, `${file}.${randomUUID()}.tmp`);
  try {
    if (!isPlainFolder(dir)) throw new Error('folder is a link');
    mkdirSync(dir, { recursive: true });
    writeFileSync(tmp, body, { flag: 'wx', mode: 0o600 });
    renameSync(tmp, join(dir, file));
  } catch (err) {
    // Cache persistence cannot prevent routing, and errors may quote untrusted paths or contents.
    const code = (err as NodeJS.ErrnoException).code;
    // Another Windows hook may still hold the destination open; a later scan can retry quietly.
    if (code !== 'EPERM' && code !== 'EBUSY') console.error(`loadout: ${what} cache could not be saved`);
    // The failure is reported once above. A cleanup error (ENOTDIR on Linux when the index
    // path is a file) adds nothing, and a leftover temp file has a unique name.
    try {
      rmSync(tmp, { force: true });
    } catch {}
  }
}
