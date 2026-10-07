#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig, paths, resolveApiKey, writeDefaultConfig, type Config } from './config.js';
import { jevClient } from './jev.js';
import { claudeArgs, codexArgs, hostSetup, HOSTS, launch, materialize, pathTranslator, which, type Agent, type Host } from './launch.js';
import { addFromGitHub, addSkills, librarySources, parseGitHub, scanLibrary, skillExcerpt, type AddResult } from './library.js';
import { repoSignals } from './repo.js';
import { route } from './route.js';
import { cachedEmbeddings, libraryEmbeddings } from './embed.js';
import { hookOutput, promptContext, type HookInput } from './hook.js';
import type { Capability, RouteDecision } from './types.js';

const USAGE = `loadout — pick the model, skills and MCP servers for each agent session

Usage:
  loadout init [--key-file <path>]        Write ~/.loadout/config.json
  loadout add <dir|github-url>...         Copy skills into the library (searches recursively)
  loadout list [--json] [--sources]       Show the library (--sources: the add commands that rebuild it)
  loadout route [--json] [--lexical] <task>
                                          Show what would be selected, without launching
  loadout claude [--dry-run] [--headless] <task> [-- <claude args>]
  loadout codex  [--dry-run] [--headless] <task> [-- <codex args>]
                                          --headless runs once and exits (claude -p / codex exec)
  loadout mcp [--lexical]                 Serve the library over MCP (stdio): find_skills, load_skill,
                                          and a gateway to the library's MCP servers
  loadout mcp --http [--port 8787] [--host 127.0.0.1] [--token-file f] [--allowed-host h]
                                          The same over Streamable HTTP (skills only), for remote hosts
                                          such as ChatGPT behind a tunnel
  loadout hook claude|codex [--windows-paths]
                                          UserPromptSubmit hook: routes each prompt and adds the skills
                                          that fit as context (reads the hook JSON on stdin)
  loadout setup <host> [--windows]        Print the config that attaches \`loadout mcp\` to a host:
                                          ${HOSTS.join(', ')}

The library lives in ~/.loadout/library (override with LOADOUT_HOME):
  skills/<name>/SKILL.md   and   mcp.json ({"mcpServers": {...}}, optional "description" per server)

Jev routing needs TYPESAFE_API_KEY, or "jev.apiKeyFile" in the config.`;

function fail(message: string): never {
  console.error(`loadout: ${message}`);
  process.exit(1);
}

function splitPassthrough(argv: string[]): [string[], string[]] {
  const i = argv.indexOf('--');
  return i === -1 ? [argv, []] : [argv.slice(0, i), argv.slice(i + 1)];
}

/** The Jev client, or undefined (lexical routing) when switched off or no key is set. Notes go to stderr. */
function router(config: Config, lexical: boolean) {
  const apiKey = lexical || config.router === 'lexical' ? undefined : resolveApiKey(config);
  if (!apiKey && !lexical && config.router === 'jev') {
    console.error('loadout: no TypeSafe API key found; falling back to the lexical router');
  }
  return apiKey ? jevClient({ apiKey, baseUrl: config.jev.baseUrl, model: config.jev.model }) : undefined;
}

const note = (message: string) => console.error(`loadout: ${message}`);
const embeddingsFor = (library: Capability[], config: Config) => (config.embeddings ? libraryEmbeddings(library, paths.embeddings(), note) : Promise.resolve(undefined));

async function decide(task: string, config: Config, lexical: boolean): Promise<RouteDecision> {
  const library = scanLibrary(paths.library());
  if (library.length === 0) note(`library is empty (${paths.library()}); continuing with no extra capabilities`);
  const client = router(config, lexical);
  // Embeddings only feed the Jev router's candidate list; keyword routing never waits for them.
  const embeddings = client ? await embeddingsFor(library, config) : undefined;
  return route({ task, repo: repoSignals(process.cwd()), library, config, client, excerpt: skillExcerpt, embeddings });
}

function explain(decision: RouteDecision, model?: string): string {
  const { stats } = decision;
  const n = (x: number) => x.toLocaleString('en');
  const cost = stats.costUsd !== undefined ? `, $${stats.costUsd.toFixed(6)}` : '';
  const tokens = stats.inputTokens !== undefined ? `, ${n(stats.inputTokens)} tokens` : '';
  const lines = [`router: ${decision.router} — ${n(stats.candidates)}/${n(stats.librarySize)} candidates in ${n(stats.ms)} ms${tokens}${cost}`];
  if (decision.need !== undefined) {
    lines.push(`need:   ${decision.need.toFixed(2)} — ${decision.quiet ? 'general coding is enough; nothing loaded' : 'a specialised skill is likely useful'}`);
  }
  lines.push(
    `tier:   ${decision.tier}${model ? ` → ${model}` : ''}${
      decision.tierProbabilities
        ? `  (${Object.entries(decision.tierProbabilities).map(([t, p]) => `${t} ${p?.toFixed(2)}`).join(', ')})`
        : ''
    }`,
  );
  if (decision.warning) lines.push(`warning: ${decision.warning}`);
  const loadedLabel = (s: { inject?: string }) => (s.inject === 'mentioned' ? 'loaded, injected (you named it)' : s.inject === 'clear' ? 'loaded, injected (clear winner)' : 'loaded ');
  const shown = [
    ...decision.selected.map((s) => ({ s, mark: s.inject ? '◆' : '●', label: loadedLabel(s) })),
    ...decision.suggested.map((s) => ({ s, mark: '○', label: 'offered' })),
  ];
  if (shown.length === 0) {
    lines.push('skills: none');
  } else {
    lines.push(decision.router === 'jev' ? 'skills: (fit: how well each matches the request, 0-1)' : 'skills: (relative lexical score)');
    // Same-named skills from different sources are told apart by where they came from.
    const counts = new Map<string, number>();
    for (const { s } of shown) counts.set(s.capability.name, (counts.get(s.capability.name) ?? 0) + 1);
    const display = (c: RouteDecision['selected'][number]['capability']) =>
      (counts.get(c.name) ?? 0) > 1 && c.origin ? `${c.name} (${c.origin.replace(/^github\.com\//, '')})` : c.name;
    const width = Math.max(...shown.map(({ s }) => display(s.capability).length));
    for (const { s, mark, label } of shown) {
      const share = s.share !== undefined ? `  share ${s.share.toFixed(2)}` : '';
      const kind = s.capability.kind === 'mcp' ? ' (MCP)' : '';
      lines.push(`  ${mark} ${s.p.toFixed(2)}  ${display(s.capability).padEnd(width)}  ${label}${kind}${share}`);
    }
  }
  return lines.join('\n');
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  const config = loadConfig();

  switch (command) {
    case 'init': {
      const { values } = parseArgs({ args: rest, options: { 'key-file': { type: 'string' } } });
      const keyFile = values['key-file'] ? resolve(values['key-file']) : undefined;
      if (keyFile && !existsSync(keyFile)) fail(`key file not found: ${keyFile}`);
      console.log(`wrote ${writeDefaultConfig(keyFile ? { apiKeyFile: keyFile } : {})}`);
      return 0;
    }

    case 'add': {
      if (rest.length === 0) fail('add needs at least one directory or GitHub URL');
      let failed = 0;
      for (const spec of rest) {
        let r: AddResult;
        try {
          r = parseGitHub(spec) ? addFromGitHub(spec, paths.library()) : addSkills(resolve(spec), paths.library());
        } catch (err) {
          console.error(`${spec}: ${err instanceof Error ? err.message.split('\n')[0] : err}`);
          failed++;
          continue;
        }
        const total = r.added.length + r.updated.length;
        console.log(`${spec}: ${total ? `${r.added.length} added, ${r.updated.length} updated` : 'no skills found'}`);
        for (const { name, folder } of r.renamed) console.log(`  "${name}" already exists from another source; installed as ${folder}`);
        for (const { path, reason } of r.skipped) console.log(`  skipped ${path}: ${reason}`);
      }
      // Index new skills now, so the next session does not wait for it.
      await embeddingsFor(scanLibrary(paths.library()), config);
      return failed ? 1 : 0;
    }

    case 'list': {
      const { values } = parseArgs({ args: rest, options: { json: { type: 'boolean' }, sources: { type: 'boolean' } } });
      if (values.sources) {
        const sources = librarySources(paths.library());
        if (values.json) console.log(JSON.stringify(sources, null, 2));
        else
          for (const s of sources) {
            const where = s.origin.startsWith('github.com/') ? `https://${s.origin}` : s.origin;
            console.log(`loadout add ${where}   # ${s.skills} skills${s.revisions.length ? ` @ ${s.revisions.map((r) => r.slice(0, 12)).join(', ')}` : ''}`);
          }
        return 0;
      }
      const library = scanLibrary(paths.library());
      if (values.json) console.log(JSON.stringify(library, null, 2));
      else {
        for (const c of library) console.log(`${c.kind.padEnd(5)} ${c.name}  ${c.description.slice(0, 80)}`);
        console.log(`${library.length} capabilities in ${paths.library()}`);
      }
      return 0;
    }

    case 'route': {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: { json: { type: 'boolean' }, lexical: { type: 'boolean' } },
      });
      const task = positionals.join(' ').trim();
      if (!task) fail('route needs a task');
      const decision = await decide(task, config, Boolean(values.lexical));
      console.log(values.json ? JSON.stringify(decision, null, 2) : explain(decision));
      return 0;
    }

    case 'claude':
    case 'codex': {
      const agent: Agent = command;
      const [own, passthrough] = splitPassthrough(rest);
      const { values, positionals } = parseArgs({
        args: own,
        allowPositionals: true,
        options: { 'dry-run': { type: 'boolean' }, lexical: { type: 'boolean' }, headless: { type: 'boolean' } },
      });
      const task = positionals.join(' ').trim();
      if (!task) fail(`${agent} needs a task`);

      const bin = which(agent);
      const toPath = pathTranslator(bin);
      const decision = await decide(task, config, Boolean(values.lexical));
      const session = materialize(decision, agent, config, paths.sessions(), toPath);
      console.error(explain(decision, session.effort ? `${session.model} (${session.effort})` : session.model));
      console.error(`session: ${session.dir}`);

      const opts = { headless: Boolean(values.headless), toPath };
      const args = agent === 'claude' ? claudeArgs(session, task, passthrough, opts) : codexArgs(session, task, passthrough, opts);
      if (values['dry-run']) {
        // POSIX single quotes: nothing inside is expanded, unlike JSON's double quotes.
        console.log([agent, ...args.map((a) => `'${a.replace(/'/g, `'\\''`)}'`)].join(' '));
        return 0;
      }
      if (!bin) fail(`${agent} not found on PATH`);
      return launch(bin, args, opts);
    }

    case 'mcp': {
      // stdout carries the protocol: everything else goes to stderr.
      const { values } = parseArgs({
        args: rest,
        options: {
          lexical: { type: 'boolean' },
          'windows-paths': { type: 'boolean' },
          http: { type: 'boolean' },
          port: { type: 'string', default: '8787' },
          host: { type: 'string', default: '127.0.0.1' },
          'token-file': { type: 'string' },
          'allowed-host': { type: 'string', multiple: true },
        },
      });
      const toPath = values['windows-paths'] ? (p: string) => execFileSync('wslpath', ['-w', p], { encoding: 'utf8' }).trim() : undefined;
      const library = scanLibrary(paths.library());
      const client = router(config, Boolean(values.lexical));
      // Loaded on demand: the MCP SDK is the heaviest import, and only this command needs it.
      const { serveHttp, serveStdio } = await import('./mcp.js');
      if (values.http) {
        const token = values['token-file'] ? readFileSync(values['token-file'], 'utf8').trim() : undefined;
        if (values['token-file'] && !token) fail(`empty token file: ${values['token-file']}`);
        const { url } = await serveHttp(
          { library, config, client, repo: repoSignals(process.cwd()), embeddings: client ? embeddingsFor(library, config) : undefined },
          { port: Number(values.port), host: values.host!, token, allowedHosts: values['allowed-host'] },
        );
        note(`MCP (skills only) at ${url}${token ? ', bearer token required' : ''}; stop with Ctrl+C`);
        await new Promise(() => {});
      }
      await serveStdio({
        library,
        config,
        client,
        repo: repoSignals(process.cwd()),
        // Loaded in the background: the host's startup timeout must not wait for the model.
        embeddings: client ? embeddingsFor(library, config) : undefined,
        ...(toPath ? { toPath } : {}),
      });
      return 0;
    }

    case 'hook': {
      // Never block or break a prompt: any problem means no output and exit 0.
      try {
        const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { 'windows-paths': { type: 'boolean' } } });
        // Claude Code and Codex send the same fields (session_id, prompt, cwd) and read the same output.
        if (positionals[0] !== 'claude' && positionals[0] !== 'codex') fail('usage: loadout hook claude|codex');
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as HookInput;
        const client = router(config, false);
        const context = await promptContext(input, {
          library: scanLibrary(paths.library()),
          config,
          client,
          embeddings: client && config.embeddings ? await cachedEmbeddings(paths.embeddings()) : undefined,
          repo: repoSignals(input.cwd && existsSync(input.cwd) ? input.cwd : process.cwd()),
          stateDir: join(paths.sessions(), 'hook'),
          ...(values['windows-paths'] ? { toPath: (p: string) => execFileSync('wslpath', ['-w', p], { encoding: 'utf8' }).trim() } : {}),
        });
        if (context) console.log(hookOutput(context));
      } catch (err) {
        note(`hook: ${err instanceof Error ? err.message : err}`);
      }
      return 0;
    }

    case 'setup': {
      const { values, positionals } = parseArgs({ args: rest, allowPositionals: true, options: { windows: { type: 'boolean' } } });
      const host = positionals[0] as Host;
      if (!HOSTS.includes(host)) fail(`setup needs a host: ${HOSTS.join(', ')}`);
      // Desktop apps on a WSL machine are Windows apps; the CLIs follow where they are installed.
      const desktop = host === 'claude-desktop' || host === 'cursor';
      const windows = values.windows ?? (Boolean(process.env.WSL_DISTRO_NAME) && (desktop || pathTranslator(which(host === 'claude-code' ? 'claude' : host))('/') !== '/'));
      const { where, snippet } = hostSetup(host, windows);
      console.log(`# ${where}\n${snippet}`);
      return 0;
    }

    case undefined:
    case '-h':
    case '--help':
    case 'help':
      console.log(USAGE);
      return 0;

    default:
      fail(`unknown command "${command}"\n\n${USAGE}`);
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => fail(err instanceof Error ? err.message : String(err)),
);
