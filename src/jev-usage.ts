/** Private benchmark journal. The product never enables this on its own. */
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join } from 'node:path';

export const JEV_USAGE_MARKER = '.loadout-jev-usage-v1';
export const JEV_USAGE_MARKER_TEXT = 'loadout Jev usage v1\n';

export interface JevAttemptUsage { inputTokens: number | null; outputTokens: number | null }
export type JevUsageEvent = { type: 'call' | 'start' } | ({ type: 'finish' } & JevAttemptUsage);
export class JevUsageError extends Error {}

export function jevUsageJournal(price: number, source: 'hook' | 'router' = 'router'): ((event: JevUsageEvent) => void) | undefined {
  const dir = process.env.LOADOUT_BENCH_JEV_USAGE;
  if (!dir) return undefined;
  const fail = () => new JevUsageError('benchmark Jev usage persistence failed (details suppressed)');
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) throw fail();
  const write = (record: object) => {
    let fd: number | undefined;
    try {
      if (!isAbsolute(dir) || realpathSync(dir) !== dir) throw fail();
      for (let p = dir; ; p = dirname(p)) {
        const stat = lstatSync(p);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw fail();
        if (dirname(p) === p) break;
      }
      if (process.platform !== 'win32' && (lstatSync(dir).mode & 0o777) !== 0o700) throw fail();
      fd = openSync(join(dir, JEV_USAGE_MARKER), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const stat = fstatSync(fd);
      const marker = Buffer.alloc(Buffer.byteLength(JEV_USAGE_MARKER_TEXT));
      if (!stat.isFile() || stat.nlink !== 1 || stat.size !== marker.length
        || readSync(fd, marker, 0, marker.length, 0) !== marker.length || marker.toString() !== JEV_USAGE_MARKER_TEXT) throw fail();
      closeSync(fd); fd = undefined;
      // No existing file is ever opened for writing. A directory swap after the
      // checks can create a new stray record, but cannot overwrite a victim file.
      fd = openSync(join(dir, `jev-${randomUUID()}.jsonl`), 'wx', 0o600);
      writeFileSync(fd, JSON.stringify(record) + '\n');
    } catch {
      throw fail();
    } finally {
      if (fd !== undefined) {
        try { closeSync(fd); } catch { throw fail(); }
      }
    }
  };
  write({ type: 'ready', source });
  return (event) => write(event.type === 'finish' ? { ...event, price } : event);
}
