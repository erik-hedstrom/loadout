import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join, resolve } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { paths, resolveApiKey, type Config } from './config.js';
import { EmbeddingStore, hasTransformers } from './embed.js';
import type { SystemOneClient } from './jev.js';
import { escapeSkillTags, hostCommand, which } from './launch.js';
import { scanLibrary } from './library.js';
import type { Capability } from './types.js';

export interface Check {
  name: string;
  ok: boolean | null; // null is informational and does not fail the CLI.
  detail: string;
  fix?: string;
}

/** What a CLI needs to start (Node shims, Windows and WSL), and nothing that could hold a credential. */
const VERSION_ENV = ['PATH', 'PATHEXT', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'WSL_DISTRO_NAME', 'WSLENV'];

/** PATH's folders without empty or relative entries, which resolve in the current folder. */
const absolutePath = () => (process.env.PATH ?? '').split(delimiter).filter((d) => isAbsolute(d));

/** First line of `<bin> --version`, or undefined when it does not run. */
function version(bin: string): string | undefined {
  const env = Object.fromEntries(VERSION_ENV.flatMap((k) => (process.env[k] === undefined ? [] : [[k, process.env[k]]])));
  // A shim such as `#!/usr/bin/env node` resolves through PATH too: an empty or relative entry would find a planted `node`.
  if (env.PATH !== undefined) env.PATH = absolutePath().join(delimiter);
  try {
    const { command, args, ...options } = hostCommand(bin, ['--version'], env);
    return execFileSync(command, args, { ...options, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n')[0];
  } catch {
    return undefined;
  }
}

/** `which()` over absolute PATH entries only, so a match in the current folder neither runs nor hides a later one. */
export const onPath = (bin: string) => which(bin, absolutePath());

/** A parsed config file, {} when it is missing, or undefined when it exists but cannot be read or parsed. */
function readConfig(file: string, parse: (text: string) => unknown): Record<string, unknown> | undefined {
  if (!existsSync(file)) return {};
  try {
    const value = parse(readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Positions of UserPromptSubmit handlers running loadout's `hook <agent>`. Codex's trust keys use
 * the original group/handler indices, including handlers belonging to other tools. Both hosts share this shape.
 * The plugin runs `loadout hook claude`; setup writes
 * `node …/cli.js hook <agent>` (cli.ts from a checkout), through wsl.exe under WSL.
 */
function hookPositions(config: Record<string, unknown>, agent: 'claude' | 'codex'): string[] {
  const groups = (config.hooks as { UserPromptSubmit?: unknown } | undefined)?.UserPromptSubmit;
  const command = new RegExp(`(^|[\\s'/\\\\])(loadout|cli\\.[jt]s)'? hook ${agent}($|[\\s'])`);
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((g, groupIndex) => Array.isArray(g?.hooks)
    ? g.hooks.flatMap((h: { type?: unknown; command?: unknown }, handlerIndex: number) =>
      h?.type === 'command' && typeof h.command === 'string' && command.test(h.command) ? [`${groupIndex}:${handlerIndex}`] : [])
    : []);
}

/** Read-only: reports what is set up and how to fix what is not. Only the Jev check makes a network call. */
export async function doctor(config: Config, client: (apiKey: string) => SystemOneClient): Promise<Check[]> {
  const checks: Check[] = [];
  // The plugin's hook and generated host configs run `loadout` by name.
  const self = onPath('loadout');
  checks.push({ name: 'loadout on PATH', ok: Boolean(self), detail: self ?? 'not found', fix: 'run `npm link` in the loadout checkout, or install the package globally' });

  if (config.router === 'lexical') checks.push({ name: 'Jev key', ok: true, detail: 'not needed (router: lexical)' });
  else {
    // An unreadable key file (a folder, no permission) throws an error naming the path: report it in fixed text.
    let unreadable = false;
    let apiKey: string | undefined;
    try {
      apiKey = resolveApiKey(config);
    } catch {
      unreadable = true;
    }
    const missingFile = config.jev.apiKeyFile !== undefined && !existsSync(config.jev.apiKeyFile);
    checks.push({
      name: 'Jev key',
      ok: Boolean(apiKey),
      detail: apiKey
        ? 'found'
        : missingFile
          ? 'not found; jev.apiKeyFile in the config names a missing file'
          : unreadable
            ? 'not found; jev.apiKeyFile in the config cannot be read'
            : 'not found',
      fix: 'set TYPESAFE_API_KEY, or run `loadout init --key-file <path>`; until then routing uses keywords only',
    });
    if (apiKey) {
      const started = Date.now();
      try {
        await client(apiKey).ask({ request: 'loadout doctor' }, { ok: { type: 'noul', instructions: 'Is this a connectivity check?' } });
        checks.push({ name: 'Jev call', ok: true, detail: `answered in ${Date.now() - started} ms` });
      } catch (err) {
        // jevClient's errors are fixed text (E11): no key, prompt or response body.
        checks.push({ name: 'Jev call', ok: false, detail: err instanceof Error ? err.message : 'failed', fix: 'check the key, and that the Jev API (api.typesafe.ai, or the URL in TYPESAFE_BASE_URL) is reachable' });
      }
    }
  }

  let library: Capability[] = [];
  try {
    const skipped: string[] = [];
    library = scanLibrary(paths.library(), { skipped });
    const skills = library.filter((c) => c.kind === 'skill').length;
    checks.push({
      name: 'library',
      ok: library.length > 0,
      detail: `${skills} skills, ${library.length - skills} MCP servers in ${paths.library()}`,
      fix: 'loadout add <dir|github-url>',
    });
    if (skipped.length > 0) {
      checks.push({
        name: 'library names',
        ok: false,
        detail: `left out, because an agent could not name them back exactly (the name holds "<skill" or "</skill", is over 200 characters, or is a server name that is empty or starts "mcp:"): ${skipped.map(escapeSkillTags).join(', ')}`,
        fix: 'rename the skill folder or the mcp.json server; these names are never offered to an agent',
      });
    }
  } catch (err) {
    // A broken library is what doctor is for: report it and run the remaining checks.
    checks.push({ name: 'library', ok: false, detail: err instanceof Error ? err.message : 'cannot be read', fix: `fix mcp.json, or check that ${paths.library()} is readable` });
  }

  if (!config.embeddings) checks.push({ name: 'embedding index', ok: true, detail: 'off in the config' });
  else if (!(await hasTransformers())) {
    // Optional by design: keyword retrieval still works, so this is information, not a failure.
    checks.push({ name: 'embedding index', ok: true, detail: 'keyword retrieval only (optional @huggingface/transformers not installed)' });
  } else {
    const store = new EmbeddingStore(paths.embeddings());
    const indexed = library.filter((c) => store.vector(c)).length;
    checks.push({ name: 'embedding index', ok: indexed === library.length, detail: `${indexed} of ${library.length} indexed`, fix: 'the next `loadout add` or `loadout route` indexes the rest' });
  }

  const claudeHome = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  const claudeConfig = join(process.env.CLAUDE_CONFIG_DIR || homedir(), '.claude.json');
  const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
  const hosts = [
    {
      name: 'Claude Code',
      bin: 'claude',
      present: existsSync(claudeHome) || existsSync(claudeConfig),
      attached: () => {
        const settings = readConfig(join(claudeHome, 'settings.json'), JSON.parse);
        if (!settings) return { broken: join(claudeHome, 'settings.json') };
        const userConfig = readConfig(claudeConfig, JSON.parse);
        const plugin = (settings.enabledPlugins as Record<string, unknown> | undefined)?.['loadout@loadout'] === true;
        const hook = hookPositions(settings, 'claude').length > 0;
        const hooksOff = settings.disableAllHooks === true;
        // setup adds the server in user scope; project-scoped entries apply only inside their project.
        const server = (userConfig?.mcpServers as Record<string, Record<string, unknown>> | undefined)?.loadout;
        const runnable = server && typeof server === 'object' && !Array.isArray(server) && ['command', 'url'].some((k) => typeof server[k] === 'string' && server[k].trim() !== '');
        // An entry Claude Code cannot start is a broken setup, not an unused host, so it fails even when Codex is set up.
        const unstartable = server !== undefined && !runnable && 'a search server in .claude.json that Claude Code cannot start';
        const serverIssue = unstartable ? 'remove it with `claude mcp remove loadout --scope user`, or give it a non-empty command or url' : undefined;
        const found = [!hooksOff && plugin && 'plugin enabled', !hooksOff && hook && 'settings hook', runnable && 'search server'].filter(Boolean);
        // The plugin attaches its own server (D13), so a user-scope one from an earlier `claude mcp add` loads the tools twice.
        if (found.length) return { on: [...found, unstartable].filter(Boolean).join(' and '), ...(plugin && runnable ? { duplicate: 'plugin enabled and a separately configured search server: its tools are attached twice' } : {}), ...(serverIssue ? { issue: serverIssue } : {}) };
        // Claude Code rewrites .claude.json often, so a read can catch it half-written: call it broken only when nothing else is attached.
        if (!userConfig) return { broken: claudeConfig };
        const off = plugin ? 'plugin enabled' : hook ? 'settings hook' : undefined;
        if (off && hooksOff) return { off: `${off}, but disableAllHooks in settings.json turns hooks off` };
        return unstartable ? { invalid: unstartable, issue: serverIssue } : {};
      },
      setup: 'claude-code',
    },
    {
      name: 'Codex',
      bin: 'codex',
      present: existsSync(codexHome),
      attached: () => {
        const config = readConfig(join(codexHome, 'config.toml'), parseToml);
        if (!config) return { broken: join(codexHome, 'config.toml') };
        const features = config.features as { hooks?: unknown; plugins?: unknown } | undefined;
        const hooksOff = features?.hooks === false;
        const pluginConfig = (config.plugins as Record<string, Record<string, unknown>> | undefined)?.['loadout-codex@loadout'];
        const plugin = features?.plugins !== false && pluginConfig?.enabled === true;
        const hook = hookPositions(config, 'codex');
        const searchOff = (pluginConfig?.mcp_servers as Record<string, { enabled?: unknown }> | undefined)?.loadout?.enabled === false;
        if (plugin && hooksOff) return { off: `plugin enabled, but [features] hooks = false in config.toml turns hooks off${searchOff ? '; search off (plugin policy)' : ''}` };
        if (hook.length && hooksOff) return { off: 'hook, but [features] hooks = false in config.toml turns hooks off' };
        const server = (config.mcp_servers as Record<string, Record<string, unknown>> | undefined)?.loadout;
        // Codex starts a server from exactly one of command (stdio) or url (HTTP), and rejects a table with both keys.
        const transports = server && typeof server === 'object' ? (['command', 'url'] as const).filter((k) => k in server) : [];
        const t = server && transports.length === 1 ? server[transports[0]!] : undefined;
        const runnable = server?.enabled !== false && typeof t === 'string' && t.trim() !== '';
        // A present, enabled table Codex cannot start is a broken setup, not an unused host, so it fails even when Claude Code is set up.
        const unstartable = server !== undefined && server?.enabled !== false && !runnable && 'a search server in config.toml that Codex cannot start';
        const serverIssue = unstartable ? 'remove [mcp_servers.loadout] from config.toml, or give it exactly one non-empty command or url' : undefined;
        // Codex 0.163.0: hooks/src/lib.rs::hook_key and declarations.rs::plugin_hook_key_source.
        // A saved hash proves past approval only; discovery.rs compares it with the current definition before running it.
        const keys = [
          ...(plugin ? ['loadout-codex@loadout:hooks/hooks.json:user_prompt_submit:0:0'] : []),
          ...hook.map((position) => `${resolve(codexHome, 'config.toml')}:user_prompt_submit:${position}`),
        ];
        const states = (config.hooks as { state?: Record<string, { trusted_hash?: unknown; enabled?: unknown }> } | undefined)?.state;
        const trust = keys.map((key) => {
          const state = states?.[key];
          if (state?.enabled === false) return { detail: 'hook disabled in /hooks', issue: 'enable the hook in `/hooks`' };
          const hash = state?.trusted_hash;
          return typeof hash !== 'string' || !hash.trim()
            ? { detail: 'hook not trusted yet: approve it in /hooks', issue: 'approve the hook in `/hooks`' }
            : { detail: 'hook trusted in /hooks for a saved version; Codex re-asks if changed' };
        });
        const found = [
          plugin && `plugin enabled (${trust[0]!.detail})`,
          plugin && searchOff && 'search off (plugin policy)',
          ...trust.slice(plugin ? 1 : 0).map((t) => t.detail),
          runnable && 'search server',
        ].filter(Boolean);
        const issue = serverIssue ?? trust.find((t) => t.issue)?.issue;
        if (found.length) return { on: [...found, unstartable].filter(Boolean).join(' and '), ...(issue ? { issue } : {}) };
        return unstartable ? { invalid: unstartable, issue } : {};
      },
      setup: 'codex',
    },
  ];
  const attachments = hosts.map((h) => ({ host: h, state: h.attached() }));
  const anyAttached = attachments.some(({ state }) => 'on' in state && state.on);
  for (const { host: h, state } of attachments) {
    // doctor runs no binary found through an empty or relative PATH entry.
    const bin = onPath(h.bin);
    if (!bin && !h.present) continue;
    const { on, off, broken, duplicate, invalid, issue }: { on?: string; off?: string; broken?: string; duplicate?: string; invalid?: string; issue?: string } = state;
    checks.push({
      name: h.name,
      ok: broken || off || duplicate || issue ? false : on ? true : anyAttached ? null : false,
      detail: `${bin ? (version(bin) ?? 'version unknown') : 'CLI not on PATH'}; loadout: ${broken ? 'config cannot be read or parsed' : duplicate ? `${on}; ${duplicate}` : (on ?? off ?? invalid ?? 'not set up')}`,
      fix: broken ? `repair ${broken}` : duplicate ? 'remove the separate server with `claude mcp remove loadout --scope user`' : off ? 'turn hooks back on' : issue ?? `loadout setup ${h.setup}`,
    });
  }
  return checks;
}

export function formatDoctor(checks: Check[]): string {
  const width = Math.max(...checks.map((c) => c.name.length));
  return checks.map((c) => `${c.ok === null ? 'ℹ' : c.ok ? '✓' : '✗'} ${c.name.padEnd(width)}  ${c.detail}${c.ok || !c.fix ? '' : `\n  ${' '.repeat(width)}  fix: ${c.fix}`}`).join('\n');
}
