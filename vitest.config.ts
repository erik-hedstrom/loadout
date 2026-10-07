import { defineConfig } from 'vitest/config';

// Only the project's own tests: bench/results holds agents' outputs, test files included.
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
