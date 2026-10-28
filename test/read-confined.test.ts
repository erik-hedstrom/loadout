import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it.skipIf(process.platform === 'win32')('readConfined rejects FIFOs promptly and closes their descriptors', () => {
  const root = mkdtempSync(join(tmpdir(), 'loadout-confined-fifo-'));
  try {
    expect(spawnSync('mkfifo', [join(root, 'fifo')], { timeout: 5_000 }).status).toBe(0);
    const script = `import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { readConfined } from ${JSON.stringify(import.meta.resolve('../src/library.ts'))};
const before = process.platform === 'linux' ? readdirSync('/proc/self/fd').length : undefined;
for (let i = 0; i < 32; i++) assert.throws(() => readConfined(${JSON.stringify(root)}, 'fifo', 1024), /no such file/);
if (before !== undefined) assert.equal(readdirSync('/proc/self/fd').length, before);
console.log('FIFO rejected; descriptors closed');`;
    const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--input-type=module', '-e', script], { env: { ...process.env, HOME: root, USERPROFILE: root, LOADOUT_HOME: join(root, '.loadout') }, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL' });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('FIFO rejected; descriptors closed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
