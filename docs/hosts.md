# What works in which host

What loadout does in each host, and whether that was checked in a real host
session. "Generated, untested" means `loadout setup <host>` prints the config,
and nobody has yet run it in that host. The unit tests cover the code behind
every cell; this table is about the host end.

| Host | Launch | Tier | Hook | Search | Gateway |
|---|---|---|---|---|---|
| Claude Code CLI | verified [1] | verified [1, 2] | verified [3] | verified [4] | generated, untested |
| Claude desktop app, Code tab | not supported | not supported | generated, untested [5] | generated, untested | generated, untested |
| Claude Desktop (chat) | not supported | not supported | not supported | generated, untested | generated, untested |
| Codex CLI | verified [1] | verified [1, 2] | generated, untested [6] | verified [4, 7] | generated, untested |
| Codex tab of the ChatGPT desktop app, T3 Code | not supported | not supported | generated, untested [6] | generated, untested | generated, untested |
| Cursor | not supported | not supported | not supported | generated, untested | generated, untested |
| OpenCode | not supported | not supported | not supported | generated, untested | generated, untested |
| ChatGPT chat (developer mode) | not supported | not supported | not supported | generated, untested [8] | not supported [8] |

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
2. The mechanism only: the small-tier model (haiku, gpt-5.6-luna) ran the
   session. Whether Jev picks sensible tiers is not shown (backlog C3).
3. The plugin, one `claude -p --plugin-dir` run, 2026-10-08
   ([RESULTS](../bench/RESULTS.md#the-hook-plugin-in-the-claude-code-cli-2026-10-08)).
   The settings-file hook ran in 10 sessions on 2026-10-07
   ([RESULTS](../bench/RESULTS.md#do-agents-use-what-they-are-given)).
4. 10 headless sessions per host with `find_skills` attached, 2026-10-07
   ([RESULTS](../bench/RESULTS.md#do-agents-use-what-they-are-given)).
5. The same plugin as the CLI. Erik's check is backlog D10.
6. Codex runs a new hook only after the user trusts it with `/hooks`, which
   needs an interactive session. The live test is backlog D2.
7. The launcher attached the server with `-c mcp_servers.…`. The
   `~/.codex/config.toml` snippet from `loadout setup codex`: untested.
8. `loadout mcp --http` behind an HTTPS tunnel. It serves skills only, never
   the gateway.

Backlog D3 tests the desktop and IDE hosts by hand and updates this table.
