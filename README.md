[![CI](https://github.com/erik-hedstrom/loadout/actions/workflows/ci.yml/badge.svg)](https://github.com/erik-hedstrom/loadout/actions/workflows/ci.yml)
# loadout

Pick the model, skills and MCP servers for each coding-agent session from a
library of any size, so niche capabilities cost nothing until they are needed.

A very cheap System One model ([Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev),
$0.042 per million input tokens) reads the task and the repo, picks a model
tier, and decides which capabilities fit, for about a tenth of a cent and a
second per session. loadout then launches Claude Code or Codex with that
selection added, using official CLI flags. It never proxies the agent's API
traffic.

```
$ loadout route "Lay out our services as a canvas file I can open in Obsidian"
router: jev — 200/1,262 candidates in 1,415 ms, 25,581 tokens, $0.001074
need:   0.67 — a specialised skill is likely useful
tier:   small  (large 0.06, medium 0.42, small 0.52)
skills: (fit: how well each matches the request, 0-1)
  ◆ 1.00  json-canvas        loaded, injected (clear winner)  share 0.99
  ○ 0.84  obsidian-markdown  offered  share 0.00
  ○ 0.73  obsidian-cli       offered  share 0.00

$ loadout route "rename the variable cnt to count in utils.py"
router: jev — 200/1,262 candidates in 1,331 ms, 26,149 tokens, $0.001098
need:   0.31 — general coding is enough; nothing loaded
tier:   small  (medium 0.00, large 0.00, small 1.00)
skills: none
```

How it decides: local retrieval (keywords plus embeddings) narrows the library
to 200 candidates, then two Jev requests run. A wide one ranks the candidates
and asks whether the request needs a specialised skill at all; a close one
grades the top 8. Code then:

- **loads** the best fits (◆ / ●, at most 3): near-certain exact fits, and
  the clear winner of the close comparison;
- **offers** anything else with fit ≥ 0.7 as optional (○), so the agent's scope
  is broader than the router's pick;
- **injects** a skill's full instructions into your request, as attributed
  third-party reference material, when you name it (`/tdd`, `@pdf`,
  `zx-ledger-reconcile`, "the pdf skill") or when Jev finds a clear winner;
- or **stays quiet** when general coding is enough.

**Realistic requests, judged** ([full results](bench/RESULTS.md#v4-2026-10-06-realistic-requests-on-the-real-library-judged)).
The test: 315 detailed requests against a real library of 1,262 skills. They
range from invoices and payroll to MCP servers, RNA-seq pipelines and "rename
this variable". One model wrote them and another expanded them, and neither
saw the library. Claude Opus judged each choice against the whole catalog. On
the held-out test split (two thirds of the requests; the rule was tuned on the
other third):

| | loadout |
|---|---:|
| A useful skill loaded, when the request needs one | 76% (86% loaded or offered) |
| Nothing loaded, when it needs none | 84% |
| Loaded skills that are useful / that would mislead | 82% / 1% |
| Skills loaded per request | 0.74 |
| Cost per decision | $0.0011, about 1 s |

The agents use what they are given: in headless runs, Claude Code opened a
loaded skill in 9 of 10 sessions, and Codex in 11 of 11. Without the launcher,
the Claude Code prompt hook raised that from 2 to 6 of 10. Whether the work
gets better is not settled yet. In an 8-request blind pilot with Codex,
loadout's version won 4, lost 3 and split 1; the wins came where a skill
encodes conventions, and two losses ran out of time following the skill.

**Synthetic benchmark** (199 generated tasks, a library of 20,000 real skills
from GitSkills; the rule was tuned on a dev split and reported on test):

| At 20,000 skills (test) | Gold skill loaded | Ranked first | Skills loaded | Loads one when none is needed | Cost per decision |
|---|---:|---:|---:|---:|---:|
| BM25 top 10 | 88% | 72% | 10 | 100% | free |
| **loadout** | **93%** (95% incl. optional) | **86%** | **1.2** | **5%** | **$0.00082, 1.0 s** |

On 18 hand-written requests (13 niche, 3 everyday, 2 that name a skill), all
pass. Both test sets are synthetic or small; see the caveats in RESULTS.md.

See [DESIGN.md](DESIGN.md) for the problem and architecture.

## Setup

```bash
npm install && npm run build && npm link
loadout init --key-file /path/to/typesafe-key.txt   # or export TYPESAFE_API_KEY
loadout add https://github.com/obra/superpowers      # GitHub repos, subpaths, or local dirs
```

`add` finds every `SKILL.md` recursively and copies each skill into
`~/.loadout/library/skills/`, a folder no agent loads by itself, then indexes
new skills for retrieval (local embeddings; the first run downloads a 35 MB
model).
- It records where each skill came from (repo and commit), so re-adding updates
  it in place.
- Same-named skills from different sources are kept side by side.
- Nothing from the repo is executed.
- Symlinks are never followed; repos are cloned with `core.symlinks=false`.
- Oversized skills are skipped with a reason.

MCP servers go in `~/.loadout/library/mcp.json` in the usual
`{"mcpServers": {...}}` shape, plus three optional loadout-only fields:
- `"description"`: used for routing;
- `"autoApprove": true`: let this server's tools run without approval prompts
  when loadout loads it into a session (see below);
- `"gateway": true`: make it reachable mid-session through `loadout mcp`'s
  `call_server_tool`. This is opt-in: the host approves `call_server_tool` as a
  whole, so a rule that allows it allows every tool of every gateway server.

## Use

```bash
loadout route "<task>"                                   # show the decision only
loadout claude "<task>" [-- <claude args>]               # launch Claude Code with the selection
loadout codex  "<task>" [-- <codex args>]                # launch Codex with the selection
loadout codex --headless "<task>" -- --skip-git-repo-check   # run once and exit (codex exec / claude -p)
loadout mcp                                              # the library as an MCP server (see below)
loadout setup <host>                                     # print the config that attaches it to a host
```

Flags: `--dry-run` prints the command instead of launching; `--lexical` routes
offline without Jev; `--headless` runs once and exits. If Jev is unreachable,
loadout falls back to keyword ranking and says so, so a launch never blocks.
Each launch writes its decision and generated plugin/MCP config to
`~/.loadout/sessions/<id>/`.

| | Claude Code | Codex |
|---|---|---|
| Model per tier (default) | `--model` haiku / sonnet / opus (+ `--effort high`) | `-m` gpt-5.6-luna (low) / gpt-6.1-sol (medium) / gpt-6.1-sol (high) |
| Skills | generated plugin via `--plugin-dir` (`loadout:<skill>`) | listed in the prompt with their `SKILL.md` paths |
| Injected skills | full SKILL.md in the user turn (+ a one-line trust note in the system prompt) | full SKILL.md in the prompt |
| Relevance note | `--append-system-prompt` | in the prompt |
| MCP | generated file via `--mcp-config` | `-c mcp_servers.<name>={…}` |
| `autoApprove` servers | `--allowedTools mcp__<name>` | `default_tools_approval_mode = "approve"` |

**loadout adds to your session; it does not isolate it.** Skills, plugins and
MCP servers you have configured in Claude Code or Codex stay active alongside
the selection, as do your approval policies. To get the full benefit, move the
skills you don't need everywhere out of the agents' own folders and into the
loadout library (`loadout add <dir>`).

## Search mid-session, from any MCP host

`loadout mcp` serves the library as a small MCP server (about 400 tokens of
tool definitions), so an agent can look for know-how when the work drifts
away from what the session started with, in its own words:

- `find_skills(goal, keywords?)`: a Jev-ranked handful of matches with their
  fit, about a second and $0.001 per search; "nothing fits" when nothing does;
- `load_skill(skill, file?)`: the skill's instructions as attributed
  third-party reference material, or one of its files (so hosts without file
  access, like Claude Desktop, can still use scripts and references);
- `server_tools` / `call_server_tool`: a gateway to the library's MCP
  servers marked `"gateway": true`, registered only when there are some. Each
  call goes through the host's approval prompt, which shows the server, tool
  and arguments.

`loadout claude` / `loadout codex` attach it automatically (turn off with
`"search": false`), with only the two read-only tools pre-approved. For
everything else, `loadout setup <host>` prints the config for this machine:

| Host | How |
|---|---|
| Claude Code | `loadout setup claude-code` (a `claude mcp add` command) |
| Codex CLI, the Codex tab of the ChatGPT desktop app, T3 Code (Codex provider) | `loadout setup codex` (`~/.codex/config.toml`) |
| Claude Desktop | `loadout setup claude-desktop` |
| Cursor | `loadout setup cursor` |
| OpenCode | `loadout setup opencode` |
| ChatGPT chat (developer mode) | `loadout mcp --http` behind an HTTPS tunnel (see below) |

ChatGPT only connects to remote HTTPS MCP servers. `loadout mcp --http`
serves the same search on `http://127.0.0.1:8787/mcp`:
- it serves skills only, never the MCP gateway, so a remote client cannot
  start or call your local servers;
- `--token-file` requires a bearer token on every request. It is mandatory as
  soon as the server is reachable from elsewhere (a non-loopback `--host`, or
  any `--allowed-host`);
- requests whose Host header is not localhost or an `--allowed-host` are
  refused;
- at most 4 searches run at once.

```bash
openssl rand -hex 32 > ~/.loadout/mcp-token
loadout mcp --http --token-file ~/.loadout/mcp-token --allowed-host <your-tunnel-domain>
```

Put OpenAI's Secure MCP Tunnel, or another HTTPS tunnel, in front of it.
Pass the tunnel's domain as `--allowed-host`, then add the tunnel URL as a
connector in ChatGPT's developer mode.

**Prompt hook.** Install the hook-only Claude Code plugin (CLI and the desktop
app's Code tab); it requires `loadout` on PATH and Node 22.12+:

```bash
claude plugin marketplace add erik-hedstrom/loadout
claude plugin install loadout@loadout
```

You can also use `/plugin` inside a session. The plugin routes every prompt
and adds the skills that fit as context, so sessions started without the
launcher get the right skills without relying on the agent to search. In
tests it raised Claude Code's skill use from 2 to 6 of 10 sessions. Each skill
is offered once per session, and short follow-ups ("yes", "go on") are not
routed. `loadout setup codex` prints a hook for Codex; trust a new hook there
with `/hooks`.

For loadout running in WSL behind Windows Claude Code, use `loadout setup
claude-code --windows` and merge its settings.json hook snippet into
`~/.claude/settings.json` instead. The plugin's fixed command cannot carry
the required `wsl.exe` wrapper. Optional MCP library search is still available
through `loadout setup claude-code`; its fixed token cost is measured in
[RESULTS](bench/RESULTS.md).

Privacy: with the hook installed, every routed prompt goes to TypeSafe's Jev
API, together with the repository's top-level file names and dependencies.
That happens in every project, because the hook is user-scoped. The launchers
send the first prompt only. To keep prompts local, leave the hook out, or set
`"router": "lexical"` (the hook then adds nothing).

Under WSL, Windows apps reach the server through `wsl.exe` and get Windows
paths. Keep the TypeSafe key in the config's `apiKeyFile` (environment
variables do not cross from a Windows app into WSL).

Tier-to-model mapping, thresholds and caps live in `~/.loadout/config.json`
(only your overrides are stored; everything else follows the defaults).

## Development

```bash
npm test
npm run typecheck
npm run dev -- route "<task>"
```
