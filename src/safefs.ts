import { randomUUID } from 'node:crypto';
import { closeSync, constants, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { loadoutHome } from './config.js';

/*
 * Cache and state files under the loadout home (scan cache, tool index, embeddings, hook state).
 *
 * Threat model: anyone who can plant a link in the loadout home can already edit library/mcp.json,
 * which names commands the gateway runs. These checks are not a privilege boundary. They stop a link that
 * was planted earlier, or left by accident, from redirecting a write or trusting a read, and they keep a
 * link swapped in during the check-then-use gap (Node has no openat to pin a folder) from truncating a file
 * or deleting one loadout did not write: temp files are created exclusively (a link already at the name is
 * refused), final files are read without following a link, and deletions match only the exact names loadout
 * writes. A swapped folder can still receive one new file with a random temp name, and have a cache file of
 * the same name replaced by the rename.
 */

/**
 * False when a link, or anything but a folder, stands where a folder of the loadout home should be. The home
 * itself may be a link: where loadout keeps its data is the user's own choice (a dotfiles repo, another
 * disk), while a link below it is not something loadout created. Folders outside the home are not checked.
 */
export function isPlainFolder(dir: string): boolean {
  const rel = relative(loadoutHome(), dir);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return true;
  let current = loadoutHome();
  for (const part of rel.split(sep)) {
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

/** Read a file whose last component must not be a link. Windows has no O_NOFOLLOW, so it checks with lstat there. */
export function readNoFollow(file: string): Buffer {
  if (constants.O_NOFOLLOW === undefined && lstatSync(file).isSymbolicLink()) throw new Error('file is a link');
  const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
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
