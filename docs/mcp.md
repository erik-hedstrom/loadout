# Library search over MCP

`loadout mcp` serves the library as an MCP server, so an agent can look for
know-how when the work drifts away from what the session started with:

- `find_skills(goal, keywords?)`: a Jev-ranked handful of skills, and
  gateway MCP servers, predicted to fit, with their fit; "nothing fits" when
  nothing does;
- `load_skill(skill, file?)`: the skill's instructions as attributed
  third-party reference material, or one of its files (so hosts without file
  access, like Claude Desktop, can still use scripts and references);
- `server_tools` / `call_server_tool`: a gateway to the library's MCP
  servers marked `"gateway": true` ([library](library.md#mcp-servers)),
  registered only when there are some. loadout leaves `call_server_tool`
  unapproved, so a call prompts with the server, tool and arguments, unless
  the host already has a rule allowing it.

## Cost and privacy

In Claude Code, the one host measured, its tool definitions added tokens to a
fresh session's first request, and for a small library they cost more than
the native skill listing they replace. Later turns and other hosts are not
measured. The figures and crossover are in [DESIGN.md](../DESIGN.md#search-server-loadout-mcp). In the
measured headless runs, agents also searched less often than they should: on
their own in 2 of 10 Claude Code sessions and 5 of 10 Codex sessions
([RESULTS](../bench/RESULTS.md#do-agents-use-what-they-are-given)). So the
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
(umask 077; openssl rand -hex 32 > ~/.loadout/mcp-token)
loadout mcp --http --token-file ~/.loadout/mcp-token --allowed-host <your-tunnel-domain>
```

Put OpenAI's Secure MCP Tunnel, or another HTTPS tunnel, in front of it.
Pass the tunnel's domain as `--allowed-host`, then add the tunnel URL as a
connector in ChatGPT's developer mode.
