# What works in which host

What loadout does in each host, and whether that was checked in a real host
session. "Untested" means loadout implements it (for most hosts,
`loadout setup <host>` prints the config), but nobody has run it in that host
yet.

| Host | Launch | Tier | Hook | Search | Gateway |
|---|---|---|---|---|---|
| Claude Code CLI | verified [1] | untested [2] | verified [3] | verified [4] | untested |
| Claude desktop app, Code tab | not supported | not supported | untested [5] | untested | untested |
| Claude Desktop (chat) | not supported | not supported | not supported | untested | untested |
| Codex CLI | verified [1] | untested [2] | untested [6] | verified [4, 7] | untested |
| Codex tab of the ChatGPT desktop app, T3 Code | not supported | not supported | untested [6] | untested | untested |
| Cursor | not supported | not supported | not supported | untested | untested |
| OpenCode | not supported | not supported | not supported | untested | untested |
| ChatGPT chat (developer mode) | not supported | not supported | not supported | untested [8] | not supported [8] |

The columns:
- **Launch:** `loadout claude` / `loadout codex` start the agent with the
  selection.
- **Tier:** the launch also sets the model for the chosen tier. Hosts without
  a launch keep the user's model.
- **Hook:** a prompt hook routes every prompt and adds the skills that fit as
  context.
- **Search:** `find_skills` and `load_skill` over MCP.
- **Gateway:** `server_tools` and `call_server_tool`, for library servers
  marked `"gateway": true`.

Notes:
1. Headless `claude -p` and `codex exec`, 2026-10-06: the selected skill was
   read, the selected MCP server's tool was called, and an injected skill was
   followed ([RESULTS](../bench/RESULTS.md#end-to-end-in-the-agents)).
2. The launch passes the tier's model (`--model`, `-m`). No recorded run
   shows a tier choice reaching the agent, and whether Jev picks sensible
   tiers is not shown (backlog C3).
3. The plugin, one `claude -p --plugin-dir` run, 2026-10-08
   ([RESULTS](../bench/RESULTS.md#the-hook-plugin-in-the-claude-code-cli-2026-10-08)).
   The settings-file hook ran in 10 sessions on 2026-10-07
   ([RESULTS](../bench/RESULTS.md#do-agents-use-what-they-are-given)).
4. 10 headless sessions per host with `find_skills` attached, 2026-10-06
   ([RESULTS](../bench/RESULTS.md#do-agents-use-what-they-are-given)).
5. The same plugin as the CLI. Erik's check is backlog D10.
<<<<<<< HEAD
6. Codex runs a new hook only after the user trusts it with `/hooks`, which
   needs an interactive session. The live test is backlog D2.
7. The launcher attached the server with `-c mcp_servers.…` (2026-10-06, as
   in note 1). The
   `~/.codex/config.toml` snippet from `loadout setup codex`: untested.
=======
6. `loadout setup codex` prints marketplace and plugin install commands for
   Codex CLI. The `loadout-codex` plugin carries `loadout hook codex` and
   `loadout mcp`. Offline installation in a throwaway `CODEX_HOME`,
   `plugin/read`, `hooks/list` and `codex mcp list` were checked with Codex
   0.160.1 on 2026-10-12. `hooks/list` reported the installed hook as
   `untrusted`: trust it with `/hooks` before routing prompts. A live hook
   session is untested (backlog D2); desktop and T3 Code plugin support
   are also untested.
7. The launcher attached the server with `-c mcp_servers.…`. The
   plugin's search server was listed as enabled, without starting it.
   WSL loadout behind Windows Codex needs `loadout setup codex --windows`:
   its TOML supplies the machine-specific `wsl.exe` wrapper the plugin's
   fixed PATH commands cannot carry. This fallback is untested in a host.
>>>>>>> f00f3d5 (D12: a Codex plugin carries the prompt hook and the search server)
8. `loadout mcp --http`; see the [README](../README.md#search-mid-session-from-any-mcp-host).

Backlog D3 tests the desktop and IDE hosts by hand and updates this table.
