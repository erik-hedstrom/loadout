/**
 * Do agents use what loadout gives them? Runs the real CLI headless on swept
 * requests (bench/sweep.ts) and records which skills it invokes and whether it
 * searches the library.
 *
 *   routed  the sweep's decision as loadout would launch it: did the agent
 *           invoke a loaded skill (Claude's Skill tool / reading SKILL.md)?
 *   search  nothing preloaded, only the find_tools server attached: does the
 *           agent search on its own, and load something useful?
 *   hook    (Claude) nothing preloaded; `loadout hook claude` routes the prompt
 *           and the loadout MCP server is attached, as after `loadout setup
 *           claude-code`: does the agent open what the hook suggests?
 *   plugin  (Claude) the shipped hook-only plugin; nothing preloaded and no
 *           MCP server: does the agent open what the hook suggests?
 * Ambient hooks that call loadout by absolute path bypass PATH; only their context
 * shows, so a silent one is not detected.
 *
 * Each run is capped (Claude --max-turns, a timeout), since only the agent's
 * first moves matter here. It starts in an empty folder where the agent may
 * edit files (Claude acceptEdits, Codex's workspace-write sandbox) but runs no
 * unapproved commands. Requests often mention attachments, so a note tells the
 * agent to make up small sample inputs; otherwise it stops to ask before
 * reaching the point where it would open a skill.
 *
 *   npx tsx bench/invoke.ts <sweep dir> --agent claude|codex --mode routed|search|hook|plugin --ids a,b,c [--max-turns 6]
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig, paths } from '../src/config.js';
import { claudeArgs, claudeHookBlock, codexArgs, hookCommand, materialize, pathTranslator, which, type Agent } from '../src/launch.js';
import { capabilityKey, scanLibrary } from '../src/library.js';
import { decisionFor, readJsonl, run } from './lib.js';
import { hookShim, toolEvents, type Inventory } from './stream.js';
import type { SweepRow } from './sweep.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    agent: { type: 'string', default: 'claude' },
    mode: { type: 'string', default: 'routed' },
    ids: { type: 'string' },
    'max-turns': { type: 'string', default: '6' },
    'timeout-s': { type: 'string', default: '300' },
    model: { type: 'string' },
  },
});
const dir = positionals[0];
if (!dir || !values.ids) throw new Error('usage: invoke.ts <sweep dir> --agent claude|codex --mode routed|search|hook|plugin --ids a,b');
const agent = values.agent as Agent;
const mode = values.mode as 'routed' | 'search' | 'hook' | 'plugin';
if ((mode === 'hook' || mode === 'plugin') && agent !== 'claude') throw new Error(`${mode} mode is Claude Code only`);
const rows = new Map(readJsonl<SweepRow>(join(dir, 'decisions.jsonl')).map((r) => [r.id, r]));
const library = scanLibrary(paths.library());
const byKey = new Map(library.map((c) => [capabilityKey(c), c]));
const config = { ...loadConfig(), search: mode !== 'plugin' };
const bin = which(agent);
if (!bin) throw new Error(`${agent} not on PATH`);
const toPath = pathTranslator(bin);
const windowsAgent = toPath('/') !== '/';
const sessions = mkdtempSync(join(tmpdir(), 'loadout-invoke-'));
// A Windows agent under WSL needs its working folder on the Windows side (its shell cannot use \\wsl.localhost paths).
const workRoot = windowsAgent ? execFileSync('wslpath', ['-u', execFileSync('cmd.exe', ['/c', 'echo %TEMP%'], { encoding: 'utf8' }).trim()], { encoding: 'utf8' }).trim() : tmpdir();
const repo = join(import.meta.dirname, '..');
let shimDir: string | undefined;
let childEnv: NodeJS.ProcessEnv | undefined;
if (agent === 'claude') {
  shimDir = mkdtempSync(join(workRoot, 'loadout-bin-'));
  childEnv = { ...process.env, PATH: `${shimDir}${delimiter}${process.env.PATH ?? ''}` };
  // The `claude` we start is a launcher script run inside WSL, so PATH stays a Linux list; PATH/l
  // translates it, shim folder first, for the Windows claude.exe and the hook shell it starts.
  if (windowsAgent) childEnv.WSLENV = [...(process.env.WSLENV ?? '').split(':').filter((s) => s && !/^PATH(?:\/.*)?$/.test(s)), 'PATH/l'].join(':');
}
const NOTE = '\n\n(Test run: nothing is attached and the folder is empty. Where the request refers to files or data you do not have, create small realistic sample inputs and carry on.)';
const out = join(dir, `invoke-${agent}-${mode}.jsonl`);

const isLoadout = (name: string) => /^loadout(?:@|$)/i.test(name);

function checkInventory(inventory: Inventory | undefined, hookInvocations: number, uncountedContext: number, pluginDir?: string): string | undefined {
  if (!inventory) return 'no startup inventory';
  const normalize = (p: string) => {
    const path = p.replace(/\\/g, '/').replace(/\/$/, '');
    return windowsAgent || process.platform === 'win32' ? path.toLowerCase() : path;
  };
  let ownPlugins = 0;
  for (const plugin of inventory.plugins) {
    if (!isLoadout(plugin.name)) continue;
    if (!pluginDir || typeof plugin.path !== 'string' || normalize(plugin.path) !== normalize(toPath(pluginDir)) || ++ownPlugins > 1) return 'ambient loadout plugin; measurement invalid';
  }
  if (mode === 'plugin' && ownPlugins !== 1) return 'missing loadout plugin; measurement invalid';
  if (mode === 'plugin' || mode === 'hook') {
    if (hookInvocations !== 1) return 'expected exactly one loadout UserPromptSubmit hook; measurement invalid';
  } else if (hookInvocations) return 'unexpected loadout UserPromptSubmit hook; measurement invalid';
  // A hook that calls loadout by absolute path bypasses the shim; its context is still visible.
  if (uncountedContext > 0) return 'uncounted loadout hook context; measurement invalid';
  return undefined;
}

let invalidRun: string | undefined;
for (const id of values.ids.split(',')) {
  const row = rows.get(id);
  if (!row) throw new Error(`no sweep row ${id}`);
  const decision = decisionFor(row, library, mode !== 'routed');
  const session = materialize(decision, agent, config, sessions, toPath);
  if (values.model) session.model = values.model;
  if (mode === 'hook' || mode === 'plugin') session.relevance = undefined;
  if (mode === 'plugin') session.pluginDir = join(repo, 'plugins', 'loadout');
  const hookArgs = mode === 'hook' ? ['--settings', JSON.stringify(claudeHookBlock('loadout hook claude'))] : [];
  const cwd = mkdtempSync(join(workRoot, 'loadout-work-'));
  // Outside cwd: the agent is told its folder is empty, and the hook routes on cwd's file names.
  const marker = shimDir ? join(shimDir, `${id}.invocations`) : '';
  if (shimDir) {
    writeFileSync(marker, '');
    const markerPath = windowsAgent || process.platform === 'win32' ? toPath(marker).replace(/\\/g, '/') : marker;
    writeFileSync(join(shimDir, 'loadout'), hookShim(markerPath, hookCommand('claude', windowsAgent)), { mode: 0o700 });
  }
  const task = row.request + NOTE;
  const args =
    agent === 'claude'
      ? claudeArgs(session, task, ['--output-format', 'stream-json', '--verbose', '--include-hook-events', '--no-session-persistence', '--max-turns', values['max-turns']!, '--strict-mcp-config', '--permission-mode', 'acceptEdits', ...hookArgs], { headless: true, toPath })
      : codexArgs(session, task, ['--json', '-s', 'workspace-write', '--skip-git-repo-check'], { headless: true });
  const started = Date.now();
  const proc = await run(bin, args, cwd, Number(values['timeout-s']) * 1000, childEnv);
  const { events, hooks, costUsd, inventory, failedBeforeModel, result: outcome } = toolEvents(proc.stdout);
  const marks = shimDir ? readFileSync(marker, 'utf8').split('\n') : [];
  if (shimDir) rmSync(marker);
  const hookInvocations = marks.filter((l) => l === 'invoked').length;
  const contextResponses = hooks.filter((h) => h.context).length;
  const invalid = agent !== 'claude' ? undefined : failedBeforeModel ? 'agent failed before the model ran' : checkInventory(inventory, hookInvocations, contextResponses - marks.filter((l) => l === 'context').length, session.pluginDir);

  // Which library skills did the agent actually open?
  const folders = new Set(session.skills.map((c) => basename(c.source)));
  const invoked = new Set<string>();
  for (const e of events) {
    if (!e.ok) continue;
    if (e.tool === 'Skill') {
      const name = (JSON.parse(e.detail).skill ?? '').replace(/^loadout:/, '');
      const c = session.skills.find((s) => s.name === name);
      if (c) invoked.add(basename(c.source));
    }
    for (const f of folders) if (/SKILL\.md/.test(e.detail) && e.detail.includes(f)) invoked.add(f);
    // Library skills read straight from the library (the hook and load_skill point there).
    for (const m of e.detail.matchAll(/skills(?:\\\\|\\|\/)+([\w.-]+)(?:\\\\|\\|\/)+SKILL\.md/g)) if (byKey.has(m[1]!)) invoked.add(m[1]!);
    const loadedKey = e.tool.endsWith('__load_skill') ? JSON.parse(e.detail).skill : undefined;
    if (typeof loadedKey === 'string' && byKey.has(loadedKey)) invoked.add(loadedKey);
  }
  const searches = events.filter((e) => e.ok && e.tool.endsWith('__find_tools')).map((e) => JSON.parse(e.detail));
  const result = {
    id,
    agent,
    mode,
    model: session.model,
    inventory: inventory ? { loadoutPlugins: inventory.plugins.filter((p) => isLoadout(p.name)).map((p) => p.name), otherPlugins: inventory.plugins.filter((p) => !isLoadout(p.name)).length } : null,
    hooks,
    hookInvocations,
    ...(invalid ? { invalid } : {}),
    // What the session actually carried (search mode carries nothing).
    loaded: decision.selected.map((s) => capabilityKey(s.capability)),
    injected: decision.selected.filter((s) => s.inject).map((s) => capabilityKey(s.capability)),
    offered: decision.suggested.map((s) => capabilityKey(s.capability)),
    invoked: [...invoked],
    searches,
    tools: events.map((e) => (e.ok ? e.tool : `${e.tool} (failed)`)),
    exit: proc.code,
    timedOut: proc.timedOut,
    ...(proc.code !== 0 && !proc.timedOut ? { stderr: proc.stderr.slice(-400) } : {}),
    costUsd,
    outcome,
    ms: Date.now() - started,
  };
  appendFileSync(out, JSON.stringify(result) + '\n');
  const status = invalid ?? (proc.timedOut ? 'timed out' : proc.code === 0 ? 'ok' : `exit ${proc.code}`);
  console.log(`${id}: invoked ${result.invoked.join(', ') || '—'}; searched ${searches.length}×; ${events.length} tool calls; ${(result.ms / 1000).toFixed(0)} s, ${status}`);
  // Best effort: a Windows process killed on timeout can hold files for a moment.
  try {
    rmSync(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
  } catch {
    console.error(`  could not remove ${cwd}`);
  }
  if (invalid) {
    invalidRun = invalid;
    break;
  }
}
rmSync(sessions, { recursive: true, force: true });
if (shimDir) rmSync(shimDir, { recursive: true, force: true });
if (invalidRun) throw new Error(invalidRun);
