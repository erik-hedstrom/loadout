/**
 * Do agents use what loadout gives them? Runs the real CLI headless on swept
 * requests (bench/sweep.ts) and records which skills it invokes and whether it
 * searches the library.
 *
 *   routed  the sweep's decision as loadout would launch it: did the agent
 *           invoke a loaded skill (Claude's Skill tool / reading SKILL.md)?
 *   search  nothing preloaded, only the find_skills server attached: does the
 *           agent search on its own, and load something useful?
 *   hook    (Claude) nothing preloaded; `loadout hook claude` routes the prompt
 *           and the loadout MCP server is attached, as after `loadout setup
 *           claude-code`: does the agent open what the hook suggests?
 *
 * Each run is capped (Claude --max-turns, a timeout), since only the agent's
 * first moves matter here. It starts in an empty folder where the agent may
 * edit files (Claude acceptEdits, Codex's workspace-write sandbox) but runs no
 * unapproved commands. Requests often mention attachments, so a note tells the
 * agent to make up small sample inputs; otherwise it stops to ask before
 * reaching the point where it would open a skill.
 *
 *   npx tsx bench/invoke.ts <sweep dir> --agent claude|codex --mode routed|search --ids a,b,c [--max-turns 6]
 */
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig, paths } from '../src/config.js';
import { claudeArgs, claudeHookSettings, codexArgs, materialize, mergeEnvironment, pathTranslator, which, type Agent } from '../src/launch.js';
import { scanLibrary } from '../src/library.js';
import type { RouteDecision, ScoredCapability } from '../src/types.js';
import { readJsonl } from './lib.js';
import { keyOf, type SweepRow } from './sweep.js';

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
if (!dir || !values.ids) throw new Error('usage: invoke.ts <sweep dir> --agent claude|codex --mode routed|search --ids a,b');
const agent = values.agent as Agent;
const mode = values.mode as 'routed' | 'search' | 'hook';
if (mode === 'hook' && agent !== 'claude') throw new Error('hook mode is Claude Code only');
const rows = new Map(readJsonl<SweepRow>(join(dir, 'decisions.jsonl')).map((r) => [r.id, r]));
const library = scanLibrary(paths.library());
const byKey = new Map(library.map((c) => [keyOf(c), c]));
const config = { ...loadConfig(), search: true };
const bin = which(agent);
if (!bin) throw new Error(`${agent} not on PATH`);
const toPath = pathTranslator(bin);
const sessions = mkdtempSync(join(tmpdir(), 'loadout-invoke-'));
// A Windows agent under WSL needs its working folder on the Windows side (its shell cannot use \\wsl.localhost paths).
const workRoot = toPath('/') !== '/' ? execFileSync('wslpath', ['-u', execFileSync('cmd.exe', ['/c', 'echo %TEMP%'], { encoding: 'utf8' }).trim()], { encoding: 'utf8' }).trim() : tmpdir();
const NOTE = '\n\n(Test run: nothing is attached and the folder is empty. Where the request refers to files or data you do not have, create small realistic sample inputs and carry on.)';
const out = join(dir, `invoke-${agent}-${mode}.jsonl`);

/** Rebuild the sweep's decision (no new routing), or an empty one for search mode. */
function decisionFor(row: SweepRow): RouteDecision {
  const scored = (picks: SweepRow['loaded']): ScoredCapability[] =>
    picks.flatMap((p) => {
      const capability = byKey.get(p.key);
      return capability ? [{ capability, p: p.fit, exact: p.exact, share: p.share, ...(p.inject ? { inject: p.inject as 'clear' | 'mentioned' } : {}) }] : [];
    });
  const empty = mode !== 'routed';
  return {
    tier: row.tier as RouteDecision['tier'],
    selected: empty ? [] : scored(row.loaded),
    suggested: empty ? [] : scored(row.offered),
    scored: [],
    // 'lexical' keeps the relevance note to the search hint alone in search mode.
    router: empty ? 'lexical' : 'jev',
    stats: { librarySize: library.length, candidates: 0, ms: 0 },
  };
}

/** One tool call; `ok` is false when the call itself failed (a failed call is not an invocation). */
interface Event { tool: string; detail: string; ok: boolean; id?: string }

function run(bin: string, args: string[], cwd: string, timeoutMs: number, env?: Record<string, string>): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    // Its own process group, so a timeout also stops what the CLI started (Codex's native
    // binary, the Windows process behind claude.exe), which would otherwise hold the pipes open.
    const child = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: mergeEnvironment(process.env, env) });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d: Buffer) => (stdout += d));
    child.stderr.on('data', (d: Buffer) => (stderr += d));
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });
  });
}

/** Tool calls from Claude's stream-json or Codex's --json event stream. */
function toolEvents(stream: string): { events: Event[]; costUsd?: number } {
  const events: Event[] = [];
  let costUsd: number | undefined;
  for (const line of stream.split('\n')) {
    let e: any;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type === 'assistant') {
      // A call only counts once its result arrives without an error.
      for (const b of e.message?.content ?? []) if (b.type === 'tool_use') events.push({ tool: b.name, detail: JSON.stringify(b.input), ok: false, id: b.id });
    } else if (e.type === 'user') {
      // Claude reports each tool result in the next user message.
      for (const b of e.message?.content ?? []) {
        if (b.type === 'tool_result' && !b.is_error) for (const ev of events) if (ev.id === b.tool_use_id) ev.ok = true;
      }
    } else if (e.type === 'result') {
      costUsd = e.total_cost_usd;
    } else if (e.type === 'item.completed') {
      const it = e.item ?? {};
      const toolError = it.result?.isError === true || it.result?.is_error === true;
      const ok = it.status === 'completed' && !it.error && !toolError && (it.exit_code === undefined || it.exit_code === null || it.exit_code === 0);
      if (it.type === 'command_execution') events.push({ tool: 'shell', detail: String(it.command ?? ''), ok });
      if (it.type === 'mcp_tool_call') events.push({ tool: `mcp__${it.server}__${it.tool}`, detail: JSON.stringify(it.arguments ?? {}), ok });
    }
  }
  return { events, costUsd };
}

for (const id of values.ids.split(',')) {
  const row = rows.get(id);
  if (!row) throw new Error(`no sweep row ${id}`);
  const decision = decisionFor(row);
  const session = materialize(decision, agent, config, sessions, toPath);
  if (values.model) session.model = values.model;
  // As installed by `loadout setup claude-code`: no launcher note, just the hook and the MCP server.
  if (mode === 'hook') session.relevance = undefined;
  const hookArgs = mode === 'hook' ? ['--settings', JSON.stringify(claudeHookSettings(toPath('/') !== '/'))] : [];
  const cwd = mkdtempSync(join(workRoot, 'loadout-work-'));
  const task = row.request + NOTE;
  const args =
    agent === 'claude'
      ? claudeArgs(session, task, ['--output-format', 'stream-json', '--verbose', '--max-turns', values['max-turns']!, '--strict-mcp-config', '--permission-mode', 'acceptEdits', ...hookArgs], { headless: true, toPath })
      : codexArgs(session, task, ['--json', '-s', 'workspace-write', '--skip-git-repo-check'], { headless: true });
  const started = Date.now();
  const proc = await run(bin, args, cwd, Number(values['timeout-s']) * 1000, session.env);
  const { events, costUsd } = toolEvents(proc.stdout);

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
  const searches = events.filter((e) => e.ok && e.tool.endsWith('__find_skills')).map((e) => JSON.parse(e.detail));
  const result = {
    id,
    agent,
    mode,
    model: session.model,
    // What the session actually carried (search mode carries nothing).
    loaded: decision.selected.map((s) => keyOf(s.capability)),
    injected: decision.selected.filter((s) => s.inject).map((s) => keyOf(s.capability)),
    offered: decision.suggested.map((s) => keyOf(s.capability)),
    invoked: [...invoked],
    searches,
    tools: events.map((e) => (e.ok ? e.tool : `${e.tool} (failed)`)),
    exit: proc.code,
    timedOut: proc.timedOut,
    ...(proc.code !== 0 && !proc.timedOut ? { stderr: proc.stderr.slice(-400) } : {}),
    costUsd,
    ms: Date.now() - started,
  };
  appendFileSync(out, JSON.stringify(result) + '\n');
  const status = proc.timedOut ? 'timed out' : proc.code === 0 ? 'ok' : `exit ${proc.code}`;
  console.log(`${id}: invoked ${result.invoked.join(', ') || '—'}; searched ${searches.length}×; ${events.length} tool calls; ${(result.ms / 1000).toFixed(0)} s, ${status}`);
  // Best effort: a Windows process killed on timeout can hold files for a moment.
  try {
    rmSync(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
  } catch {
    console.error(`  could not remove ${cwd}`);
  }
}
rmSync(sessions, { recursive: true, force: true });
