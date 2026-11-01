# Library search over MCP

`loadout mcp` serves the library as an MCP server, so an agent can look for
know-how when the work drifts away from what the session started with:

- `find_tools(goal, keywords?)`: a handful of skills, and gateway MCP
  servers, predicted to fit, with their fit; "nothing fits" when nothing
  does. A server match says it is an MCP server (with its tool count once
  `server_tools` has listed it) and gives the next call. Jev ranks them;
  without a key, with `--lexical` or when Jev fails, keyword ranking does.
  It was called `find_skills` before D15 ([DESIGN](../DESIGN.md#search-server-loadout-mcp));
- `load_skill(skill, file?)`: the skill's instructions as attributed
  third-party reference material (past 40,000 characters, cut with a pointer
  to the file), or one of its text files up to 256 KB, not a symlink (so
  hosts without file access, like Claude Desktop, can still use scripts and
  references);
- `server_tools` / `call_server_tool`: a gateway to the library's MCP
  servers marked `"gateway": true` ([library](library.md#mcp-servers)),
  registered only when there are some. loadout leaves `call_server_tool`
  unapproved, so a call prompts with the server, tool and arguments, unless
  the host already has a rule allowing it. A gateway server is not configured
  in the host, so its tool definitions are not in the host's context.
  `server_tools` starts it on first use and then remembers its tool names and
  descriptions under `~/.loadout/index/mcp-tools/`, so later searches match a
  goal against them too. A server is never started just to be searched, and a
  long tool list shows argument names instead of full schemas (`server_tools`
  with `tool` returns one in full).

## Cost and privacy

The tool definitions cost input tokens, and both plugins attach this server,
so they pay it: 158 per request in Claude Code 2.1.308 with its default tool
search and default tools (the server added from a config, Haiku, the first
request of a fresh session; with the plugin installed: not measured). The
figure covers `find_tools` and `load_skill`; a library with gateway servers
registers two more tools, `server_tools` and `call_server_tool`, which are not
measured. A native listing of 50 skills with real
names and descriptions cost 8,049, measured with the built-in tools removed, so
the two are not a matched comparison. Both were single requests of fresh
sessions
([B12](../bench/RESULTS.md#b12-results-2026-10-28-what-installed-skills-cost-per-request-on-current-hosts)); whole sessions and Codex are not
measured. In the headless runs, agents searched
on their own mainly for tasks that felt unfamiliar
([RESULTS](../bench/RESULTS.md#do-agents-use-what-they-are-given)). See
[routing and search roles](../DESIGN.md#search-server-loadout-mcp).

Privacy: [what `find_tools` sends to TypeSafe](hook.md#privacy).

## Setup

`loadout setup <host>` prints the config for this machine. It never edits
files.

| Host | How |
|---|---|
| Claude Code | the `loadout` plugin attaches it (`loadout setup claude-code`); WSL behind Windows Claude Code: a `claude mcp add` command in the same output |
| Codex CLI | the `loadout-codex` plugin attaches it (`loadout setup codex`); WSL behind Windows Codex: [hook plugins](hook.md#codex-cli) |
| Codex tab of the ChatGPT desktop app, T3 Code | no setup path yet ([hosts](hosts.md)) |
| Claude Desktop | `loadout setup claude-desktop` |
| Cursor | `loadout setup cursor` |
| OpenCode | `loadout setup opencode` |
| ChatGPT chat (developer mode) | `loadout mcp --http` behind an HTTPS tunnel (below) |

Which of these have been checked in a real session: [hosts.md](hosts.md).

Under WSL, Windows apps reach the server through `wsl.exe` and get Windows
paths. Keep the TypeSafe key in the config's `jev.apiKeyFile` (environment
variables do not cross from a Windows app into WSL).

## WSL startup

Under WSL, install loadout on the Linux filesystem (under `~`), not in a
checkout on `/mnt/c`. From `/mnt/c`, Node loads loadout's many module files
over the slow Windows file share, and `loadout mcp` took 5.9–7.0 s to answer
instead of 0.4–0.8 s ([one machine](../bench/RESULTS.md#mcp-start-up-under-wsl-d17-2026-10-15)).
Codex leaves out an optional MCP server that is not ready about 1 s after
start, and adds its tools mid-session. The TOML from
[WSL setup](hook.md#codex-cli) sets `required = true`, so Codex waits for search before the first
request, and will not start a session if loadout fails to start (from Codex
0.160.1's source; not yet run in a live session). The plugin does not set
it, because users cannot turn it off for a plugin's server. To make Codex
wait for the plugin's server too, set `mcp_optional_startup_grace_ms = 0` at
the top of `~/.codex/config.toml`; Codex then waits for every optional MCP
server, up to its start-up timeout.

## ChatGPT, over HTTP

ChatGPT only connects to remote HTTPS MCP servers. `loadout mcp --http`
serves the same search, skills only, on `http://127.0.0.1:8787/mcp`. Its
token, Host and gateway safeguards: [SECURITY.md](../SECURITY.md#http-mcp).

```bash
(umask 077; openssl rand -hex 32 > ~/.loadout/mcp-token)   # or any path only you can read
loadout mcp --http --token-file ~/.loadout/mcp-token --allowed-host <your-tunnel-domain>
```

Put OpenAI's Secure MCP Tunnel, or another HTTPS tunnel, in front of it.
Pass the tunnel's domain as `--allowed-host`, then add the tunnel URL as a
connector in ChatGPT's developer mode.
