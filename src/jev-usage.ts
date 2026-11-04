/** Private benchmark journal. The product never enables this on its own. */
import { appendFileSync, closeSync, constants, fstatSync, lstatSync, openSync } from 'node:fs';

export interface JevAttemptUsage { inputTokens: number | null; outputTokens: number | null }
export type JevUsageEvent = { type: 'call' | 'start' } | ({ type: 'finish' } & JevAttemptUsage);
export class JevUsageError extends Error {}

export function jevUsageJournal(price: number, source: 'hook' | 'router' = 'router'): ((event: JevUsageEvent) => void) | undefined {
  const file = process.env.LOADOUT_BENCH_JEV_USAGE;
  if (!file) return undefined;
  const write = (record: object) => {
    let fd: number | undefined;
    try {
      // The harness creates the file in its private temporary run root. Never create
      // a missing path, follow a link, or accept a device/FIFO supplied in its place.
      if (!lstatSync(file).isFile()) throw new Error();
      fd = openSync(file, constants.O_WRONLY | constants.O_APPEND | (constants.O_NOFOLLOW ?? 0));
      if (!fstatSync(fd).isFile() || fstatSync(fd).nlink !== 1) throw new Error();
      appendFileSync(fd, JSON.stringify(record) + '\n');
    } catch {
      throw new JevUsageError('benchmark Jev usage persistence failed (details suppressed)');
    } finally { if (fd !== undefined) closeSync(fd); }
  };
  write({ type: 'ready', source });
  return (event) => write(event.type === 'finish' ? { ...event, price } : event);
}
