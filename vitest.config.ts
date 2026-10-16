import { defineConfig } from 'vitest/config';

// Only the project's own tests: bench/results holds agents' outputs, test files included.
// Many tests spawn `node --import tsx`, which takes about 1 s idle and over 5 s on
// a loaded Windows runner, so vitest's 5 s default failed them at random (E15).
// A slow test still fails at 30 s, but vitest checks a synchronous test only after it
// returns, so a spawnSync without its own `timeout` can still hang the run.
// Tests that need longer set their own timeout.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 30_000 } });
