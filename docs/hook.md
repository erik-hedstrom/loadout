# The prompt hook plugins

Each plugin carries a `UserPromptSubmit` hook that runs `loadout hook claude`
or `loadout hook codex`. The hook routes each substantive prompt and adds the
skills that fit as context, so you keep starting your agent as usual. Both
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
attaches the [library search](mcp.md). WSL behind Windows Codex needs
`loadout setup codex --windows`.

What the hook adds, and when: [DESIGN.md](../DESIGN.md#prompt-hook).

## Latency

Each routed prompt waits about 1.5 s before the agent starts (p50 of 20, one
machine,
[RESULTS](../bench/RESULTS.md#routed-prompts-with-the-library-scan-cache-d11-2026-10-12)).

## Privacy

These commands send text to TypeSafe's Jev API through loadout's router:
- the hook: each substantive prompt, in every project, since the plugin is
  user-scoped. Prompts under three words without a `/`, `@` or `$` skill
  mention ("yes", "go on") are skipped;
- the [launcher](launcher.md) and `loadout route`: the task, once;
- [`find_skills`](mcp.md): the agent's goal plus any keywords it passes.

Each routed request carries:
- that text;
- the repository's directory name, top-level file names, dependency names and
  language extensions;
- the names and descriptions of up to 200 candidates (by default), drawn
  from skills (hook), skills and library MCP servers (launcher, `loadout
  route`), or skills and gateway MCP servers (`find_skills`; skills only over
  HTTP);
- the opening of the `SKILL.md` of up to 8 shortlisted skills (by default).

`loadout doctor` also makes one Jev call with fixed text, to check the key.
Code-level detail: [SECURITY.md](../SECURITY.md#prompt-hook).

To keep prompts local, set `"router": "lexical"` in loadout's config; the hook
then adds context only for prompts that name a skill. Or leave the hook out.
