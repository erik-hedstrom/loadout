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

You can also use `/plugin` inside a session. The plugin hook was verified in
one Claude Code CLI run; the desktop app's Code tab is untested.

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
attaches the [library search](mcp.md). Installation was checked offline; a
live hook session is untested. WSL behind Windows Codex needs `loadout setup
codex --windows` (untested in a host).

## What it does

- Each substantive prompt is routed; short follow-ups ("yes", "go on") are
  not.
- Each skill that fits is offered once per session, as third-party metadata
  with how to load it. A clear winner, or a skill you name, is injected once.
- An error, or no answer within 20 s, adds nothing; the prompt goes ahead.

Details: [DESIGN.md](../DESIGN.md#prompt-hook).

## Cost, latency, privacy

- **Effect:** with the [search tool plus the hook](../bench/RESULTS.md#do-agents-use-what-they-are-given),
  Claude Code opened a useful skill in 6 of 10 sessions, against 2 of 10 with
  the search tool alone. The hook-only plugin has not been measured.
- **Latency:** each routed prompt waits about 1.5 s before the agent starts
  (p50 of 20, one machine,
  [RESULTS](../bench/RESULTS.md#routed-prompts-with-the-library-scan-cache-d11-2026-10-12)).
- **Cost:** two Jev requests per routed prompt, about $0.001
  ([RESULTS](../bench/RESULTS.md#v4-2026-10-06-realistic-requests-on-the-real-library-judged)).
- **Privacy:** the hook is user-scoped, so it runs in every project. Every
  routed prompt goes to TypeSafe's Jev API, together with the repository's
  top-level file names and dependency names. To keep prompts local, set
  `"router": "lexical"` in loadout's config, or leave the hook out. What is
  sent: [SECURITY.md](../SECURITY.md#prompt-hook).
