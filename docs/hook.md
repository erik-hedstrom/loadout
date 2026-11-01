# The prompt hook plugins

Each plugin carries a `UserPromptSubmit` hook that runs `loadout hook claude`
or `loadout hook codex`, and the [library search server](mcp.md) (`loadout
mcp`), which has the `load_skill` tool the hook's context points to. The hook
routes each substantive prompt and adds the skills predicted to fit as
context, so you keep starting your agent as usual. Both need `loadout` on PATH
and Node 22.12+. What was checked in which host: [hosts.md](hosts.md).

The server's tool definitions are a fixed part of every request; the hook's
context is not fixed, it varies with the prompt. The server's cost is in
[mcp.md](mcp.md#cost-and-privacy); the hook's per-prompt context, and the
plugin's effect on Claude Code session start, are not measured
([RESULTS](../bench/RESULTS.md#b12-results-2026-10-28-what-installed-skills-cost-per-request-on-current-hosts)).

The hook cannot see which MCP servers its host has, so it always assumes
loadout's server: `loadout setup` prints both the hook and the server, and the
plugins carry both. Its context still names `load_skill` when the server
failed to start (the agent then has only the skill's folder, where the host
lets it read). A hook set up by hand without the server names a tool that is
not there.

## Claude Code

```bash
claude plugin marketplace add erik-hedstrom/loadout
claude plugin install loadout@loadout
```

You can also use `/plugin` inside a session.

Claude Code asks before it uses the plugin's tools, and its docs describe no
way for a plugin to approve them ([plugin docs](https://code.claude.com/docs/en/plugins/components#mcp-servers)).
To skip the prompt, add `mcp__plugin_loadout_loadout__find_tools` and
`mcp__plugin_loadout_loadout__load_skill` to `permissions.allow` in your
settings ([permission rules](https://code.claude.com/docs/en/permissions#mcp));
`loadout setup claude-code` prints them. The Codex plugin approves them itself.
`find_tools` sends the agent's goal and keywords to Jev, and `load_skill`
reads a skill from your library, so those two rules approve exactly that
([privacy](#privacy)).

**Updating from an earlier install.** The plugin used to carry only the hook.
Now it also adds the server's tools to every request (158 input tokens in
B12's measurement, which added the server from a config; through the plugin:
not measured) and a first-use approval prompt. If you ran `claude mcp add` for
loadout before, remove that server or its tools load twice, with the allow
rules covering only one set:

```bash
claude mcp remove loadout --scope user
```

`loadout doctor` flags the pair. Run `claude plugin update loadout@loadout`
for the new files; the plugin has no version, so Claude Code takes the commit
as its version ([versions](https://code.claude.com/docs/en/plugins/loading#versions-and-updates)).

**If the server does not start.** The server runs the `loadout` found on
PATH. When it is not there or fails, `/mcp` and `claude mcp list` show
`loadout mcp ... Failed to connect`, and the hook still adds its context. On
native Windows the `loadout` that `npm link` installs (an npm `.cmd` shim)
started it: `claude mcp list` showed `plugin:loadout:loadout ... Connected`
(Claude Code 2.1.308, 2026-11-01). The plugin's effect on session start time
is not measured.

For loadout running in WSL behind Windows Claude Code, use `loadout setup
claude-code --windows` and merge its settings.json hook snippet into
`~/.claude/settings.json` instead, then run the `claude mcp add` command in
the same output. The plugin's fixed commands cannot carry the required
`wsl.exe` wrapper.

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

When Jev fails, the keyword fallback is reported on stderr. Neither plugin
changes the agent's model tier.

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
The API destination and custom-home rules: [configuration](library.md#configuration).
Code-level detail: [SECURITY.md](../SECURITY.md#prompt-hook).

To keep prompts local, set `"router": "lexical"` in loadout's config. Or leave
the hook out.
