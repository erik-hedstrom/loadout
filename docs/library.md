# The library

loadout picks from its own library, `~/.loadout/library` (or
`$LOADOUT_HOME/library` when `LOADOUT_HOME` is set), a folder no agent loads
by itself.

## Skills

```bash
loadout add https://github.com/obra/superpowers   # GitHub repos, subpaths, or local dirs
loadout audit --adopt                             # copy the skills your agents already have
loadout list --sources                            # where the skills came from, as add commands
```

`add` searches up to 8 folders deep for `SKILL.md`, skipping `node_modules`,
`dist`, `build` and similar, and copies each skill into `skills/`. It then
indexes new skills for retrieval (local embeddings when the optional
`@huggingface/transformers` is installed; the first run downloads a small
model).
- It records where each skill came from (the GitHub repo and commit, or the
  local folder's path), so re-adding updates it in place.
- `list --sources` prints one `add` command per repo or folder, with the
  commits seen as a comment. It does not keep a branch or subpath, so
  re-running it adds the whole repo at its default branch.
- Same-named skills from different sources are kept side by side.
- Nothing from the repo is executed.
- Symlinks are never followed; repos are cloned with `core.symlinks=false`.
- Oversized skills are skipped with a reason.

`audit --adopt` copies the skills it finds into the library and prints how to
turn them off in each host. It never edits host configs: skills left in the
agents' own folders stay listed by the agents.

## MCP servers

MCP servers go in the library's `mcp.json` in the usual
`{"mcpServers": {...}}` shape, plus three optional loadout-only fields:
- `"description"`: used for routing;
- `"autoApprove": true`: let this server's tools run without approval prompts
  when the [launcher](launcher.md) loads it into a session;
- `"gateway": true`: make it reachable mid-session through `loadout mcp`'s
  `call_server_tool`. This is opt-in: the host approves `call_server_tool` as a
  whole, so a rule that allows it allows every tool of every gateway server.

## Configuration

`~/.loadout/config.json` (`$LOADOUT_HOME/config.json` when set) holds the
key file location, the router (`"jev"` or `"lexical"`), the tier-to-model
mapping, thresholds and caps. Only
your overrides are stored; everything else follows the defaults in
[config.ts](../src/config.ts).
