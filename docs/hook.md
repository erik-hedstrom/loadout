# The prompt hook plugins

Each plugin carries a `UserPromptSubmit` hook that runs `loadout hook claude`
or `loadout hook codex`. The hook routes each substantive prompt and adds the
skills predicted to fit as context, so you keep starting your agent as usual. Both
need `loadout` on PATH and Node 22.12+. What was checked in which host:
[hosts.md](hosts.md).

## Claude Code

```bash
claude plugin marketplace add erik-hedstrom/loadout
claude plugin install loadout@loadout
```

You can also use `/plugin` inside a session.

For loadout running in WSL behind Windows Claude Code, use `loadout setup
claude-code --windows` and merge its settings.json hook snippet into
`~/.claude/settings.json` instead. The plugin's fixed command cannot carry the
required `wsl.exe` wrapper.

## Codex CLI

```bash
codex plugin marketplace add erik-hedstrom/loadout
codex plugin add loadout-codex@loadout
```

Then trust the hook with `/hooks` in Codex. The `loadout-codex` plugin also
attaches the [library search](mcp.md). For loadout in WSL behind Windows
Codex, merge the TOML from `loadout setup codex --windows` into Codex's
config instead: it carries the `wsl.exe` wrapper for the hook and the search
server, which the plugin's fixed commands cannot.

What the hook adds, and when: [DESIGN.md](../DESIGN.md#prompt-hook).

## Latency

Each routed prompt waits before the agent starts. On 2026-10-12,
`loadout hook claude` as a new process took a median 1.5 s with the library
scan cache and 1.8 s without it; how much of that gap is the scan: not shown
([RESULTS](../bench/RESULTS.md#routed-prompts-with-the-library-scan-cache-d11-2026-10-12)).
One WSL machine, the 1,262-skill library, 20 dev prompts per build, real Jev.
Other machines and the Codex hook: not measured.

## Privacy

These commands send text to TypeSafe's Jev API through loadout's router:
- the hook: the text of each prompt event, in every project, since the
  plugin is user-scoped. In Claude Code these events include scheduled tasks
  and `/loop` iterations, background subagents reporting back and messages
  from other sessions, and pasted text arrives expanded
  ([UserPromptSubmit](https://code.claude.com/docs/en/hooks#userpromptsubmit)).
  Events under three words with no word starting with `/`, `@` or `$`
  ("yes", "go on") are skipped;
- the [launcher](launcher.md) and `loadout route`: the task, once per
  command, `--dry-run` included;
- [`find_tools`](mcp.md): the agent's goal plus any keywords it passes.

Each routing makes up to two Jev requests, and both carry:
- that text;
- the name, top-level file names, dependency names and language extensions
  of the folder the command runs in: the session's folder for the hook, the
  current folder for the launcher and `loadout route`, and wherever the host
  starts `loadout mcp` for `find_tools`, which can be your home folder.

The first (wide) request adds the names and descriptions of up to 200
candidates (by default), drawn from skills (hook), skills and library MCP
servers (launcher, `loadout route`), or skills and gateway MCP servers
(`find_tools`; skills only over HTTP), with descriptions cut at 300
characters. For a gateway server that `server_tools` has listed before, the
request also carries the remembered tool names and descriptions
([search](mcp.md)), cut to the same length. The second (close) request sends up to 8 shortlisted candidates
(by default) with descriptions cut at 700 characters, and is the only one that
adds the opening of their `SKILL.md`.

A candidate's name normally goes as is. When candidates share a name, the
first keeps it and the duplicates are qualified by where they came from: a
GitHub `owner/repo`, or, for a skill added from a local folder, that folder's
absolute path, which can include your username. Without a recorded source,
they get their kind or a number (`#2`).

The launcher, `loadout route` and `find_tools` send a request again, once,
after a network error, a timeout, a 429 or a 5xx; the hook does not retry.

`loadout doctor` also makes one Jev call with fixed text, to check the key,
but only when Jev routing is on and a key is found.
Code-level detail: [SECURITY.md](../SECURITY.md#prompt-hook).

To keep prompts local, set `"router": "lexical"` in loadout's config; the hook
then adds context only for prompts that name a skill. Or leave the hook out.
