# The launcher: `loadout claude|codex`

The [plugins](hook.md) route each substantive prompt inside the agent you
already run. The launcher instead starts Claude Code or Codex with one
decision made up front, including the model tier. `bench/invoke.ts` and
`bench/outcome.ts` use this path. The [C14 A/B pilot](../bench/README.md#ab-pilot-c14)
uses the stock CLIs with the hook and MCP server. You can use the launcher if
you prefer a command per session.

```bash
loadout route "<task>"                                   # show the decision only
loadout claude "<task>" [-- <claude args>]               # launch Claude Code with the selection
loadout codex  "<task>" [-- <codex args>]                # launch Codex with the selection
loadout codex --headless "<task>" -- --skip-git-repo-check   # run once and exit (codex exec / claude -p)
```

How the decision is made: [DESIGN.md](../DESIGN.md#router).

Flags: `--dry-run` prints the command instead of launching; `--lexical` routes
offline without Jev; `--headless` runs once and exits; `--isolate` hides your
own MCP servers ([isolation](#isolation)). If Jev is unreachable, loadout falls back to keyword
ranking and says so: an unreachable Jev delays a launch but does not stop it.
Each launch writes its decision, copies of the selected and offered skills
and any generated config to `~/.loadout/sessions/<id>/` (under
`$LOADOUT_HOME` when set).

| | Claude Code | Codex |
|---|---|---|
| Model per tier (default) | `--model` haiku / sonnet / opus (+ `--effort high`) | `-m` gpt-5.6-luna (low) / gpt-6.1-sol (medium) / gpt-6.1-sol (high) |
| Skills | generated plugin via `--plugin-dir` (`loadout:<skill>`) | listed in the prompt with their `SKILL.md` paths |
| Injected skills | the SKILL.md body without frontmatter, cut at 12,000 characters with a pointer to the copied file, in the user turn (+ a one-line trust note in the system prompt) | the same body, in the prompt |
| Relevance note | `--append-system-prompt` | in the prompt |
| MCP | generated file via `--mcp-config` | `-c mcp_servers.<name>={…}` |
| `autoApprove` servers | `--allowedTools mcp__<name>` | `default_tools_approval_mode = "approve"` |
| Library search | `loadout mcp` attached, `find_tools` and `load_skill` pre-approved | same |

The tier mappings are presets; Jev's tier choice is an
[open question](../DESIGN.md#open-questions). Turn off the attached
search with `"search": false` in the config.

**By default loadout adds to your session; it does not isolate it.** Skills, plugins and
MCP servers you have configured in Claude Code or Codex stay active alongside
the selection, as do your approval policies. To get the full benefit, move the
skills you don't need everywhere out of the agents' own folders and into the
loadout library ([library](library.md#skills)).

## Isolation

`--isolate` keeps your own MCP servers out of one launch, by
adding official flags to the agent's command line only. It writes nothing to
`~/.claude` or `~/.codex`.

- Claude Code: `--strict-mcp-config` (loadout's own servers still load),
  `--no-chrome`, and `--settings <file>`, written to the session folder,
  with `disableClaudeAiConnectors` for the claude.ai connectors,
  `disableRemoteControl` so Remote Control does not start,
  `crossSessionInbound: "refuse"` so messages from your other sessions are
  dropped, a deny rule for `mcp__computer-use` (that built-in server stays
  on in a project where you enabled it), `env.CLAUDE_CODE_AUTO_CONNECT_IDE=false` so an IDE terminal does
  not connect it to the IDE, and `env.CLAUDE_CODE_ENABLE_CFC=0`, which keeps
  Chrome off after `/background` (that restart keeps `--settings` but not
  `--no-chrome`), and `env.CLAUDE_CODE_ARTIFACT_COMMENTS=0`, so comments on
  an artifact cannot start a turn. That file outranks your user, project and local settings,
  but not managed settings. With `--settings` on the command line,
  `--resume` does not attach to a running background session. All are in the
  [CLI reference](https://code.claude.com/docs/en/cli-reference),
  [settings reference](https://code.claude.com/docs/en/settings-reference#disableclaudeaiconnectors),
  [environment variables](https://code.claude.com/docs/en/env-vars),
  [cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging#turn-off-cross-session-messaging),
  [computer use](https://code.claude.com/docs/en/computer-use#enable-computer-use),
  [artifacts](https://code.claude.com/docs/en/artifacts#let-claude-reply-to-comments-on-its-own),
  [permissions](https://code.claude.com/docs/en/permissions),
  [sessions](https://code.claude.com/docs/en/sessions#resume-a-running-background-session)
  and [agent view](https://code.claude.com/docs/en/agent-view#what-carries-over-when-you-background).
- Codex: `codex exec --ignore-user-config` skips `$CODEX_HOME/config.toml`
  (auth still uses `CODEX_HOME`). `--disable apps`, `--disable plugins` and
  `--disable skill_mcp_dependency_install` turn off the ChatGPT Apps server,
  plugins, and installing a skill's missing MCP servers, all on by default
  ([features](https://github.com/openai/codex/blob/4a93bd249a4e73e24c3cc889053c947c6986362a/codex-rs/features/src/lib.rs)). A Codex too old to know one of these
  feature names refuses to start. Only `exec` defines `--ignore-user-config`
  ([source](https://github.com/openai/codex/blob/4a93bd249a4e73e24c3cc889053c947c6986362a/codex-rs/exec/src/cli.rs)), so `loadout codex --isolate` requires
  `--headless` and refuses otherwise.

Arguments after `--` pass through unchanged, except those that would undo
the isolation, which `--isolate` refuses before routing:

- Claude Code: `--settings`, `--mcp-config`, `--agents` (inline agents can
  define MCP servers), `--plugin-dir`, `--plugin-url`, `--chrome`, `--ide`,
  `--channels` and `--dangerously-load-development-channels` (channel servers
  push messages and can relay permission prompts), `--cloud`, `--remote`,
  `--environment` and `--teleport` (cloud sessions bring their own
  servers), `--remote-control` and `--rc`, `--desktop` (the Desktop app
  starts its own session), and a second `--`, which would
  turn the isolation flags into prompt text.
- Codex: `--enable`, and every `-c`/`--config` override. A `projects` trust
  entry alone would turn project config files, and their servers, back on.

Not hidden:

- **Claude Code plugins' hooks, skills, commands and mods.** `--strict-mcp-config`
  ignores every MCP configuration but `--mcp-config`, plugin servers included,
  but the rest of a plugin still loads. A plugin's mod can make network
  requests and submit a prompt as if you typed it
  ([mods](https://code.claude.com/docs/en/plugins/mods/overview#what-a-mod-can-reach)).
  `--bare`, `--safe-mode` and `disableAllHooks` would stop these, but also
  your own hooks (and the first two your skills and CLAUDE.md), so `--isolate`
  uses none of them. An installed loadout hook plugin still runs next to the
  launcher.
- Claude Code settings files (user, project, local): their hooks, permissions
  and other settings still apply. `--setting-sources` could drop them, but it
  also drops your permissions and model, so `--isolate` does not use it.
- Sending to your other sessions: Claude can still list and message them
  (`ListAgents`, `SendMessage`). Deny rules for both would also cut messages
  to subagents and teammates, so `--isolate` adds none.
- Managed settings (organization policy) outrank the `--settings` file. A
  managed `crossSessionInbound: "accept"`, or a managed `env` that sets
  `CLAUDE_CODE_AUTO_CONNECT_IDE`, `CLAUDE_CODE_ENABLE_CFC` or
  `CLAUDE_CODE_ARTIFACT_COMMENTS` back on, wins over the values above.
- A `managed-mcp.json` (organization policy): Claude Code exits at startup
  when `--strict-mcp-config` meets one.
- Codex config layers other than `$CODEX_HOME/config.toml`
  ([loader](https://github.com/openai/codex/blob/4a93bd249a4e73e24c3cc889053c947c6986362a/codex-rs/config/src/loader/mod.rs)): the system
  `/etc/codex/config.toml`, managed and cloud configuration, and, in a folder
  trusted by one of those, a project `.codex/config.toml` or root
  `config.toml`. Any of them can add MCP servers. Trust recorded in
  `~/.codex/config.toml` is skipped with the rest of that file.
- Interactive Codex: no `--ignore-user-config`. Codex skills: no flag found.

Checked against the sources above on 2026-10-12 and 2026-10-13; no live run (not shown).

Privacy: [what the launcher sends to TypeSafe](hook.md#privacy).
