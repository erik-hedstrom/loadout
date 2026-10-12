# The library

loadout picks from its own library, `~/.loadout/library` (override with
`LOADOUT_HOME`), a folder no agent loads by itself.

## Skills

```bash
loadout add https://github.com/obra/superpowers   # GitHub repos, subpaths, or local dirs
loadout audit --adopt                             # copy the skills your agents already have
loadout list --sources                            # the add commands that rebuild the library
```

`add` finds every `SKILL.md` recursively and copies each skill into
`skills/`, then indexes new skills for retrieval (local embeddings when the
optional `@huggingface/transformers` is installed; the first run downloads a
small model).
- It records where each skill came from (the GitHub repo and commit, or the
  local folder's path), so re-adding updates it in place.
- Same-named skills from different sources are kept side by side.
- Nothing from the repo is executed.
- Symlinks are never followed; repos are cloned with `core.symlinks=false`.
- Oversized skills are skipped with a reason.

`audit --adopt` copies the skills it finds into the library and prints how to
turn them off in each host. It never edits host configs: skills left in the
agents' own folders stay listed by the agents.

## MCP servers

MCP servers go in `mcp.json` in the usual `{"mcpServers": {...}}` shape, plus
three optional loadout-only fields:
- `"description"`: used for routing;
- `"autoApprove": true`: let this server's tools run without approval prompts
  when the [launcher](launcher.md) loads it into a session;
- `"gateway": true`: make it reachable mid-session through `loadout mcp`'s
  `call_server_tool`. This is opt-in: the host approves `call_server_tool` as a
  whole, so a rule that allows it allows every tool of every gateway server.

## Configuration

`~/.loadout/config.json` holds the key file location, the router
(`"jev"` or `"lexical"`), the tier-to-model mapping, thresholds and caps. Only
your overrides are stored; everything else follows the defaults in
[config.ts](../src/config.ts).
