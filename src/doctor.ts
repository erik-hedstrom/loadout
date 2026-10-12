import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { paths, resolveApiKey, type Config } from './config.js';
import { EmbeddingStore, hasTransformers } from './embed.js';
import type { SystemOneClient } from './jev.js';
import { which } from './launch.js';
import { scanLibrary } from './library.js';
import type { Capability } from './types.js';

export interface Check {
  name: string;
  ok: boolean;
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
    return execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'], env }).trim().split('\n')[0];
  } catch {
    return undefined;
  }
}

/** `which()` over absolute PATH entries only, so a match in the current folder neither runs nor hides a later one. */
const onPath = (bin: string) => which(bin, absolutePath());

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
 * Whether a UserPromptSubmit hook runs loadout's `hook <agent>`. Claude's settings.json and Codex's
 * config.toml share this shape. The plugin runs `loadout hook claude`; setup writes
 * `node …/cli.js hook <agent>` (cli.ts from a checkout), through wsl.exe under WSL.
 */
function hasHook(config: Record<string, unknown>, agent: 'claude' | 'codex'): boolean {
  const groups = (config.hooks as { UserPromptSubmit?: unknown } | undefined)?.UserPromptSubmit;
  const command = new RegExp(`(^|[\\s'/\\\\])(loadout|cli\\.[jt]s)'? hook ${agent}($|[\\s'])`);
  return Array.isArray(groups) && groups.some((g) => Array.isArray(g?.hooks) && g.hooks.some((h: { type?: unknown; command?: unknown }) => h?.type === 'command' && typeof h.command === 'string' && command.test(h.command)));
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
        checks.push({ name: 'Jev call', ok: false, detail: err instanceof Error ? err.message : 'failed', fix: 'check the key, and that the Jev API (jev.baseUrl, api.typesafe.ai by default) is reachable' });
      }
    }
  }

  let library: Capability[] = [];
  try {
    library = scanLibrary(paths.library());
    const skills = library.filter((c) => c.kind === 'skill').length;
    checks.push({
      name: 'library',
      ok: library.length > 0,
      detail: `${skills} skills, ${library.length - skills} MCP servers in ${paths.library()}`,
      fix: 'loadout add <dir|github-url>',
    });
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
        const hook = hasHook(settings, 'claude');
        const hooksOff = settings.disableAllHooks === true;
        // setup adds the server in user scope; project-scoped entries apply only inside their project.
        const server = (userConfig?.mcpServers as Record<string, Record<string, unknown>> | undefined)?.loadout;
        const runnable = server && typeof server === 'object' && !Array.isArray(server) && ['command', 'url'].some((k) => typeof server[k] === 'string' && server[k].trim() !== '');
        const found = [!hooksOff && plugin && 'plugin enabled', !hooksOff && hook && 'settings hook', runnable && 'search server'].filter(Boolean);
        if (found.length) return { on: found.join(' and ') };
        // Claude Code rewrites .claude.json often, so a read can catch it half-written: call it broken only when nothing else is attached.
        if (!userConfig) return { broken: claudeConfig };
        const off = plugin ? 'plugin enabled' : hook ? 'settings hook' : undefined;
        return off && hooksOff ? { off: `${off}, but disableAllHooks in settings.json turns hooks off` } : {};
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
        const hooksOff = (config.features as { hooks?: unknown } | undefined)?.hooks === false;
        const server = (config.mcp_servers as Record<string, Record<string, unknown>> | undefined)?.loadout;
        // Codex starts a server from exactly one of command (stdio) or url (HTTP), and rejects a table with both keys.
        const transports = server && typeof server === 'object' ? (['command', 'url'] as const).filter((k) => k in server) : [];
        const t = server && transports.length === 1 ? server[transports[0]!] : undefined;
        const runnable = server?.enabled !== false && typeof t === 'string' && t.trim() !== '';
        // Codex runs a user hook only once it is trusted in /hooks, keyed by a hash of Codex's own serialization; doctor cannot see that.
        const found = [!hooksOff && hasHook(config, 'codex') && 'hook (trust not checked: approve it once in /hooks)', runnable && 'search server'].filter(Boolean);
        if (found.length) return { on: found.join(' and ') };
        return hooksOff && hasHook(config, 'codex') ? { off: 'hook, but [features] hooks = false in config.toml turns hooks off' } : {};
      },
      setup: 'codex',
    },
  ];
  for (const h of hosts) {
    // doctor runs no binary found through an empty or relative PATH entry.
    const bin = onPath(h.bin);
    if (!bin && !h.present) continue;
    const { on, off, broken }: { on?: string; off?: string; broken?: string } = h.attached();
    checks.push({
      name: h.name,
      ok: Boolean(on),
      detail: `${bin ? (version(bin) ?? 'version unknown') : 'CLI not on PATH'}; loadout: ${broken ? 'config cannot be read or parsed' : (on ?? off ?? 'not set up')}`,
      fix: broken ? `repair ${broken}` : off ? 'turn hooks back on' : `loadout setup ${h.setup}`,
    });
  }
  return checks;
}

export function formatDoctor(checks: Check[]): string {
  const width = Math.max(...checks.map((c) => c.name.length));
  return checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.name.padEnd(width)}  ${c.detail}${c.ok || !c.fix ? '' : `\n  ${' '.repeat(width)}  fix: ${c.fix}`}`).join('\n');
}
