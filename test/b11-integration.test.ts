import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { fixturePath, runCheck } from '../bench/b11.js';
import { copyTree } from '../bench/b11-sandbox.js';
import { taskSchema } from '../bench/b11-types.js';

it.runIf(process.platform === 'linux')('consumes real dataset paths without exposing sibling checks or solutions to the solver', async () => {
  const repo = fileURLToPath(new URL('..', import.meta.url)), data = join(repo, 'bench/data/b11');
  const tasks = readFileSync(join(data, 'tasks.jsonl'), 'utf8').trim().split('\n').map(line => taskSchema.parse(JSON.parse(line)));
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'b11-contract-'));
  try {
    for (const task of tasks) {
      const source = fixturePath(data, 'workspaces', task.workspace);
      expect(source).toBe(resolve(repo, task.workspace));
      if (task.check.type === 'node-test') expect(fixturePath(data, 'checks', task.check.tests)).toBe(resolve(repo, task.check.tests));
      const workspace = join(root, task.id), home = join(root, task.id + '-home');
      mkdirSync(home); copyTree(source, workspace);
      for (const name of ['solutions', 'checks', 'decoys', '.b11-checks']) expect(existsSync(join(workspace, name))).toBe(false);
      if (task.check.type === 'node-test') expect(await runCheck(task, { workspace, home, binary: '/usr/bin/true' }, data)).toBe('fail');
    }
    const plain = tasks.find(task => task.kind === 'plain')!;
    const workspace = join(root, plain.id);
    expect(existsSync(join(workspace, '.b11-checks'))).toBe(true);
    expect(existsSync(join(workspace, 'solutions'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
