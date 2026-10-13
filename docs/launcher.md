# The launcher: `loadout claude|codex`

The [plugins](hook.md) route each substantive prompt inside the agent you
already run. The launcher instead starts Claude Code or Codex with one
decision made up front, including the model tier. The benchmarks use it; so
can you, if you prefer a command per session.

```bash
loadout route "<task>"                                   # show the decision only
loadout claude "<task>" [-- <claude args>]               # launch Claude Code with the selection
loadout codex  "<task>" [-- <codex args>]                # launch Codex with the selection
loadout codex --headless "<task>" -- --skip-git-repo-check   # run once and exit (codex exec / claude -p)
```

How the decision is made: [DESIGN.md](../DESIGN.md#router).

Flags: `--dry-run` prints the command instead of launching; `--lexical` routes
offline without Jev. If Jev is unreachable, loadout falls back to keyword
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
| Library search | `loadout mcp` attached, `find_skills` and `load_skill` pre-approved | same |

The tier mappings are presets: whether each model suits the work Jev assigns
to its tier is not measured yet ([C3](loop/BACKLOG.md)). Turn off the attached
search with `"search": false` in the config.

**loadout adds to your session; it does not isolate it.** Skills, plugins and
MCP servers you have configured in Claude Code or Codex stay active alongside
the selection, as do your approval policies. To get the full benefit, move the
skills you don't need everywhere out of the agents' own folders and into the
loadout library ([library](library.md#skills)).

Privacy: [what the launcher sends to TypeSafe](hook.md#privacy).
