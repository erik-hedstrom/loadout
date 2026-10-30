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

`loadout init --pack documents` adds a curated starter pack; `security` and
`workflow` are also available, and `--pack` can be repeated. With no flags in
an interactive terminal, `loadout init` checks for the key, asks which packs
to add, builds the index, and prints setup instructions for detected hosts. It never edits
host configs.

`add` searches up to 8 folders deep for `SKILL.md`, skipping `node_modules`,
`dist`, `build` and similar, and copies each skill into `skills/`. It then
indexes new skills for retrieval (local embeddings when the optional
`@huggingface/transformers` is installed; the first run downloads
bge-small-en-v1.5).
- It records where each skill came from (the GitHub repo and commit, or the
  local folder's path), so re-adding updates it in place.
- `list --sources` prints one `add` command per repo or folder, with the
  commits seen as a comment. It does not keep a branch or subpath, so
  re-running it adds the whole repo at its default branch.
- Same-named skills from different sources are kept side by side.
- Nothing from the repo is executed.
- Symlinks are never followed; repos are cloned with `core.symlinks=false`.
- Oversized skills are skipped with a reason.

`audit --adopt` copies the skills it finds into the library, then prints the
exact changes to hide the adopted skills that are still listed natively.
Copying alone leaves the native listing in place. Hidden skills stop costing
listing tokens; loadout's hook and `load_skill` serve them when needed. It
never edits host configs. It refuses a `LOADOUT_HOME` outside `~/.loadout`.

For Claude Code personal skills, merge the printed JSON into
`~/.claude/settings.json`. For project skills, use the printed effective
local settings path for a Claude session started in the audited directory.
Keep other settings and existing overrides:

```json
{
  "skillOverrides": {
    "example-skill": "user-invocable-only"
  }
}
```

This hides the skill from Claude's listing while keeping `/example-skill`
available to the user. Claude does not invoke it on its own through the native
Skill tool. Overrides match skill names, so same-named skills share the
override. Entries already set to anything other than `"on"` are left out of
the printed changes, including `"name-only"`, which still lists the name.
Because [local project settings override shared project settings, which override user settings](https://code.claude.com/docs/en/settings#settings-precedence),
an effective `"on"` in a higher scope also gets a hide entry in the session's
effective local settings file.
Shared project settings come from the session directory, even when skills
are discovered in an ancestor directory. The local file also stays there on
Windows, outside Git, or when the repository root is home; otherwise it lives
at the Git root. On POSIX, a `.git` entry that is not a plain directory or could
not be inspected is not modeled (for example a linked worktree, submodule or
separate Git directory): audit reads only user/shared settings and prints no
project-local destinations. Its local settings are not read; they, or a shared
`"on"` here, may defeat personal snippets. For a linked worktree, run
`loadout audit --adopt` from the main checkout.
An existing legacy local file in the session directory is read before the
root-local file, so root-local values win. See the official
[local-file location rules](https://code.claude.com/docs/en/settings#where-claude-code-keeps-the-local-file-in-a-git-repository).
Managed settings and command-line `--settings` are not modeled; managed
values outrank everything, and `--settings` outranks these files.
Ownership is not modeled; when the Git root or its `.git` or `.claude` entry
is not owned by the user, Claude keeps the local file in the session directory
instead.
Plugin skills are unaffected by `skillOverrides`: disable the named plugins
via `/plugin` instead. This disables the whole plugin, including its other
components. The `/skills` menu also saves visibility changes to
`.claude/settings.local.json`. See the official
[Claude Code visibility settings](https://code.claude.com/docs/en/skills#override-skill-visibility-from-settings).

For Codex, merge the printed entries into `~/.codex/config.toml`, updating
an existing entry for the same path rather than adding a duplicate:

```toml
[[skills.config]]
path = "/absolute/path/to/example-skill/SKILL.md"
enabled = false
```

Already-disabled skills are left out. Restart Codex afterwards. See the official
[Codex skill configuration](https://learn.chatgpt.com/docs/build-skills#enable-or-disable-local-codex-skills).
If `CLAUDE_CONFIG_DIR` or `CODEX_HOME` is set, the audit prints that host home's
settings path instead. `--json --adopt` includes the same changes as structured
data under `disable` (`claude.sessionDirectory`, `claude.settings`,
`claude.plugins`, `codex` and `guidance`).
OpenCode and Cursor receive folder/permission guidance.

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

`skillFolders` defaults to `true`: the hook and `load_skill` show skill
folders for direct access, including binary assets. For a host whose file
fence denies the library, set `"skillFolders": false`. These outputs then
offer only `load_skill` for instructions and referenced text files. Binary
files remain unavailable through `load_skill`; this setting changes guidance,
not filesystem permissions, and does not remove paths in third-party skill text.

`LOADOUT_HOME` must be absolute (on Windows, a drive-qualified path;
drive-relative, UNC and device paths are refused). An empty value uses the
home-directory fallback, which must pass the same check. The Codex plugin
forwards `LOADOUT_HOME` to its search server, so both hook and search use the
same config.

The key goes only to `https://api.typesafe.ai` unless `TYPESAFE_BASE_URL`
names another URL; a different `jev.baseUrl` in `config.json` is refused, so
a config file alone cannot send your key elsewhere. The Codex plugin also
forwards `TYPESAFE_BASE_URL` to its search server.
