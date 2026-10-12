# Library search over MCP

`loadout mcp` serves the library as an MCP server, so an agent can look for
know-how when the work drifts away from what the session started with:

- `find_skills(goal, keywords?)`: a Jev-ranked handful of matches with their
  fit; "nothing fits" when nothing does;
- `load_skill(skill, file?)`: the skill's instructions as attributed
  third-party reference material, or one of its files (so hosts without file
  access, like Claude Desktop, can still use scripts and references);
- `server_tools` / `call_server_tool`: a gateway to the library's MCP
  servers marked `"gateway": true` ([library](library.md#mcp-servers)),
  registered only when there are some. Each call goes through the host's
  approval prompt, which shows the server, tool and arguments.

## Cost and privacy

With a skills-only library, its tool definitions add **546 input tokens** to
a fresh Claude Code session's first request. A native listing of 50 skills added 477, so
below about 57 skills the search server costs more than the listing it
replaces (an interpolation, with generated skill names;
[B1](../bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)).
Agents also search less often than they should
([DESIGN.md](../DESIGN.md#search-server-loadout-mcp)), so the
[hook plugins](hook.md) are the main path and search is the supplement.

Privacy: [what `find_skills` sends to TypeSafe](hook.md#privacy).

## Setup

`loadout setup <host>` prints the config for this machine. It never edits
files.

| Host | How |
|---|---|
| Claude Code | `loadout setup claude-code` (a `claude mcp add` command, after the plugin commands) |
| Codex CLI | the `loadout-codex` plugin attaches it (`loadout setup codex`); WSL behind Windows Codex: `--windows` prints TOML |
| Codex tab of the ChatGPT desktop app, T3 Code | Codex plugin support untested |
| Claude Desktop | `loadout setup claude-desktop` |
| Cursor | `loadout setup cursor` |
| OpenCode | `loadout setup opencode` |
| ChatGPT chat (developer mode) | `loadout mcp --http` behind an HTTPS tunnel (below) |

Which of these have been checked in a real session: [hosts.md](hosts.md).

Under WSL, Windows apps reach the server through `wsl.exe` and get Windows
paths. Keep the TypeSafe key in the config's `jev.apiKeyFile` (environment
variables do not cross from a Windows app into WSL).

## ChatGPT, over HTTP

ChatGPT only connects to remote HTTPS MCP servers. `loadout mcp --http`
serves the same search, skills only, on `http://127.0.0.1:8787/mcp`. Its
token, Host and gateway safeguards: [SECURITY.md](../SECURITY.md#http-mcp).

```bash
openssl rand -hex 32 > ~/.loadout/mcp-token
loadout mcp --http --token-file ~/.loadout/mcp-token --allowed-host <your-tunnel-domain>
```

Put OpenAI's Secure MCP Tunnel, or another HTTPS tunnel, in front of it.
Pass the tunnel's domain as `--allowed-host`, then add the tunnel URL as a
connector in ChatGPT's developer mode.
