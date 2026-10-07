/**
 * `loadout hook claude`: a Claude Code UserPromptSubmit hook that routes every
 * prompt and adds what fits as context, so a session started without the
 * launcher still gets the right skills, without relying on the agent to search.
 *
 * - Skills that fit are listed with their fit and how to load them (the loadout
 *   MCP server's load_skill, or the SKILL.md path).
 * - A clear winner, or a skill the user names, has its instructions injected
 *   as third-party reference material.
 * - Each skill is offered once per session (state in the sessions folder).
 * - Short follow-ups ("yes", "continue") are not routed.
 *
 * The context is appended to the user's turn, so the prompt cache is intact.
 * Any failure means no output: a hook must never block a prompt.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Config } from './config.js';
import type { EmbeddingStore } from './embed.js';
import type { SystemOneClient } from './jev.js';
import { injectionBlock } from './launch.js';
import { skillExcerpt } from './library.js';
import { capabilityKey } from './mcp.js';
import { route } from './route.js';
import type { Capability, RepoSignals } from './types.js';

/** The fields of Claude Code's hook input this hook uses. */
export interface HookInput {
  session_id?: string;
  prompt?: string;
  cwd?: string;
  hook_event_name?: string;
}

export interface HookDeps {
  library: Capability[];
  config: Config;
  client?: SystemOneClient;
  embeddings?: EmbeddingStore;
  repo?: RepoSignals;
  /** Folder for per-session state (which skills were already offered). */
  stateDir: string;
  /** Translate library paths for the agent (identity unless a Windows agent under WSL). */
  toPath?: (p: string) => string;
}

const DESCRIPTION_CHARS = 160;
const oneLine = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

/** Too short to say what the work is ("yes", "go on"), unless it names a skill with a sigil. */
export const isFollowUp = (prompt: string) => prompt.trim().split(/\s+/).length < 3 && !/(^|\s)[/@$][\w-]/.test(prompt);

function readState(file: string): Set<string> {
  try {
    return new Set((JSON.parse(readFileSync(file, 'utf8')) as { offered?: string[] }).offered ?? []);
  } catch {
    return new Set();
  }
}

/** The context to add to this prompt, or undefined to add nothing. */
export async function promptContext(input: HookInput, deps: HookDeps): Promise<string | undefined> {
  const prompt = input.prompt?.trim();
  if (!prompt || isFollowUp(prompt)) return undefined;
  const sessionId = (input.session_id ?? 'default').replace(/[^\w-]/g, '_').slice(0, 100);
  const stateFile = join(deps.stateDir, `${sessionId}.json`);
  const offered = readState(stateFile);
  const toPath = deps.toPath ?? ((p: string) => p);

  const d = await route({
    task: prompt,
    repo: deps.repo ?? { name: 'project', files: [], dependencies: [], languages: {} },
    library: deps.library.filter((c) => c.kind === 'skill'),
    config: deps.config,
    client: deps.client,
    excerpt: skillExcerpt,
    embeddings: deps.embeddings,
  });
  // Keyword-only routing (no key, Jev down) is too noisy to push into every prompt.
  if (d.router !== 'jev' && !d.selected.some((s) => s.inject === 'mentioned')) return undefined;

  const fresh = (list: typeof d.selected) => list.filter((s) => !offered.has(capabilityKey(s.capability)));
  const primary = fresh(d.selected);
  const optional = fresh(d.suggested);
  if (!primary.length && !optional.length) return undefined;

  const line = (s: (typeof primary)[number]) =>
    `- ${capabilityKey(s.capability)} (fit ${s.p.toFixed(2)}): ${oneLine(s.capability.description, DESCRIPTION_CHARS)}`;
  const parts = [
    '<skill_relevance>',
    'Skills from the user\'s library (not loaded in this session) that fit this request. Before starting, read the instructions of any that fit: call the loadout load_skill tool with the skill key, or read SKILL.md in the folder given. Ignore this if it does not fit what the user asked for.',
    ...(primary.length ? ['Most relevant:', ...primary.map(line)] : []),
    ...(optional.length ? [`${primary.length ? 'Also' : 'Possibly'} relevant:`, ...optional.map(line)] : []),
    `Folders: ${[...primary, ...optional].map((s) => `${capabilityKey(s.capability)} = ${toPath(s.capability.source)}`).join('; ')}`,
    '</skill_relevance>',
  ];
  const injected = deps.config.inject.enabled
    ? primary.flatMap((s) => {
        if (!s.inject) return [];
        const block = injectionBlock(s.capability, s.inject, toPath(s.capability.source), capabilityKey(s.capability));
        return block ? [block] : [];
      })
    : [];

  for (const s of [...primary, ...optional]) offered.add(capabilityKey(s.capability));
  mkdirSync(deps.stateDir, { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ offered: [...offered], updatedAt: new Date().toISOString() }));
  return [...parts, ...injected].join('\n');
}

/** Claude Code's JSON hook output for UserPromptSubmit. */
export const hookOutput = (context: string) => JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context } });
