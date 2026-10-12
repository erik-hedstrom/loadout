# The prompt hook plugins

Each plugin carries a `UserPromptSubmit` hook that runs `loadout hook claude`
or `loadout hook codex`. The hook routes every prompt and adds the skills that
fit as context, so you keep starting your agent as usual. Both need `loadout`
on PATH and Node 22.12+. What was checked in which host:
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
attaches the [library search](mcp.md). WSL behind Windows Codex needs
`loadout setup codex --windows`.

What the hook adds, and when: [DESIGN.md](../DESIGN.md#prompt-hook).

## Latency

Each routed prompt waits about 1.5 s before the agent starts (p50 of 20, one
machine,
[RESULTS](../bench/RESULTS.md#routed-prompts-with-the-library-scan-cache-d11-2026-10-12)).

## Privacy

Three paths send text to TypeSafe's Jev API, all through the same router call:
- the hook: every substantive prompt, in every project, since the plugin is
  user-scoped;
- the [launcher](launcher.md): the task, its first prompt only;
- [`find_skills`](mcp.md): the goal the agent searches for.

Each request carries that text, the repository's name, top-level file names,
dependency names and language extensions, and the names, descriptions and
instruction excerpts of candidate skills
([SECURITY.md](../SECURITY.md#prompt-hook)).

To keep prompts local, set `"router": "lexical"` in loadout's config; the hook
then adds context only for prompts that name a skill. Or leave the hook out.
