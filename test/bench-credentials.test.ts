import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SpawnOptions } from 'node:child_process';
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ cli: '' }));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: (_bin: string, args: string[], opts: SpawnOptions) => actual.spawn(process.execPath, [state.cli, ...args], opts) };
});
vi.mock('../src/launch.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/launch.js')>(), which: () => process.execPath,
}));
vi.mock('../bench/sweep.js', () => ({ keyOf: (c: { name: string }) => `mcp:${c.name}` }));

const temps: string[] = [];
const argv = process.argv;
afterEach(() => {
  process.argv = argv;
  vi.unstubAllEnvs();
  temps.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

it.each(['invoke', 'outcome'] as const)('%s forwards HTTP header tokens to the agent without exposing them in argv', async (entry) => {
  vi.resetModules();
  const home = mkdtempSync(join(tmpdir(), 'loadout-e9-bench-'));
  temps.push(home);
  mkdirSync(join(home, 'library'));
  writeFileSync(join(home, 'library', 'mcp.json'), JSON.stringify({ mcpServers: { header: { url: 'https://example.invalid/mcp', headers: { Authorization: 'e9-bench-secret' } } } }));
  writeFileSync(join(home, 'decisions.jsonl'), JSON.stringify({ id: 'canary', request: 'test credentials', tier: 'medium', loaded: [{ key: 'mcp:header', fit: 1 }], offered: [] }) + '\n');
  mkdirSync(join(home, 'outcome'));
  appendFileSync(join(home, 'outcome', 'verdicts.jsonl'), JSON.stringify({ id: 'canary', winner: 'tie' }) + '\n');
  const capture = join(home, 'capture.jsonl');
  state.cli = join(home, 'fake-codex.cjs');
  writeFileSync(state.cli, `
const fs = require('node:fs');
const headers = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^LOADOUT_MCP_.*_HEADER_TOKEN_/.test(name)));
fs.appendFileSync(process.env.E9_CAPTURE, JSON.stringify({ headers, args: process.argv.slice(2) }) + '\\n');
`);
  vi.stubEnv('LOADOUT_HOME', home);
  vi.stubEnv('E9_CAPTURE', capture);
  process.argv = [process.execPath, `bench/${entry}.ts`, home, '--ids', 'canary', '--agent', 'codex', ...(entry === 'outcome' ? ['--concurrency', '1'] : [])];
  if (entry === 'invoke') await import('../bench/invoke.js');
  else await import('../bench/outcome.js');
  const runs = readFileSync(capture, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { headers: Record<string, string>; args: string[] });
  const routed = runs.find((run) => run.args.some((arg) => arg.startsWith('mcp_servers.header=')))!;
  expect(Object.values(routed.headers)).toEqual(['e9-bench-secret']);
  expect(routed.args.join(' ')).not.toContain('e9-bench-secret');
  expect(routed.args.join(' ')).not.toContain('shell_environment_policy');
});
