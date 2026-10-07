# Handoff: loadout, 2026-10-07

Read this first if you are joining the project, human or agent. Then read
[AGENTS.md](AGENTS.md) (rules), [docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md)
(how the multi-agent loop runs) and [docs/loop/BACKLOG.md](docs/loop/BACKLOG.md)
(what to do next).

## The one-paragraph version

Developers install skills and MCP servers by the hundred. Hyped skill packs,
"awesome" lists and plugins each add their descriptions and tool schemas to
**every request**, relevant or not. loadout keeps all of them in a library no
agent loads by itself. Per session (or per prompt), a very cheap System One
model, TypeSafe's Jev at $0.042 per million input tokens, picks the few that
fit and the model tier, for about $0.001 and a second. It integrates only
through official extension points (CLI flags, plugins, MCP, hooks), never by
proxying API traffic, so vendors have no reason or means to block it.

## Where it stands

- **Repo:** https://github.com/erik-hedstrom/loadout, **private** for now, 13
  commits on `main`. 29 tests pass; typecheck is clean.
- **Version:** 0.1.0, not published. The npm name `loadout` is taken (see
  decisions below).
- **Owner:** Erik Hedström (GitHub `erik-hedstrom`). Commits use
  `63313283+erik-hedstrom@users.noreply.github.com`.

### What exists

| Command | What it does |
|---|---|
| `loadout route "<task>"` | Shows the decision: need score, model tier, loaded / injected / offered skills with fit |
| `loadout claude\|codex "<task>"` | Launches Claude Code or Codex with the selection (generated plugin / prompt list, injected clear winners, MCP config, model + effort per tier) |
| `loadout mcp` | MCP server: `find_skills`, `load_skill`, opt-in gateway to library MCP servers |
| `loadout mcp --http` | The same over Streamable HTTP, skills only, token-protected; for ChatGPT behind a tunnel |
| `loadout hook claude\|codex` | `UserPromptSubmit` hook: routes every prompt and adds the skills that fit as context |
| `loadout setup <host>` | Prints config for Claude Code, Codex (also ChatGPT's Codex tab, T3 Code), Claude Desktop, Cursor, OpenCode |
| `loadout add <dir\|github-url>` | Installs skills into the library (safe copy, provenance, no code executed), indexes embeddings |
| `loadout list [--sources]` | Shows the library, or the `add` commands that rebuild it |

How the router works ([DESIGN.md](DESIGN.md)):
1. Keyword plus embedding retrieval narrows the library to 200 candidates.
2. A wide Jev request picks among them and asks whether a skill is needed at all.
3. A close Jev request grades the top 8.
4. A pure `decide()` function, tuned offline on stored answers, loads at most
   3, offers more, injects clear winners, or stays quiet.

### Evidence so far

All numbers and caveats are in [bench/RESULTS.md](bench/RESULTS.md). Quote
those, not this table.

| Question | Result |
|---|---|
| Right skill reaches the agent, synthetic tasks, 20k-skill library | 93% loaded (95% offered), 1.2 skills loaded, 5% needless loads |
| Reasonable choices on 315 realistic requests, real 1,262-skill library, Opus judge, held-out split | 76% useful loaded (86% offered), 84% quiet when nothing is needed, 82% of loads useful, 1% misleading |
| Do agents use what they get? | Claude Code 9/10 and Codex 11/11 open a preloaded skill |
| Agents searching on their own (no preload) | Claude 2/10, Codex 5/10, but when they search, they find the right skill (7/7) |
| Prompt hook (Claude Code, same 10 requests) | 6/10 open a useful skill (vs 2/10 with search alone) |
| **Is the work better?** (Codex, 8 requests, blind pairwise) | **Not shown yet:** loadout 4, bare 3, split 1. Wins where skills encode conventions; two losses timed out while following the skill |
| Token cost of the problem | Listing all 1,262 skills natively would add **~140k tokens** of descriptions to every request (the 50 most popular alone: ~6.8k). loadout adds ~400 tokens of tool definitions plus the few skills it picks |

Negative results are recorded, as they should be. Three things did not work:
a per-candidate yes/no router (v1), request-level "is it specialised?"
questions, and a platform-mismatch veto.

### Spend

- **Jev:** about $4 of the $10 TypeSafe credit (estimate; there is no usage
  endpoint).
- **Claude subscription:** the judges and agent runs hit the session limit
  twice. Run judges sequentially, so the catalog prompt stays cached.
- **Codex subscription:** used for reviews, request generation and outcome
  runs.
- **Cloud-session credit:** $100, expires 2026-11-05. It pays for Claude
  cloud sessions only, not Routines, Projects or API calls. The orchestrator
  and its subagents run in one cloud session for that reason.

## How the work continues

The work continues as a multi-agent loop.

- **Where it runs:** one Claude cloud session (Opus 5.5, auto-compact at
  500k) acts as the orchestrator. It dispatches `worker` subagents for Claude
  tasks and reaches Codex through GitHub (`@codex <task>`, `@codex review`).
- **Merge gate:** every PR needs CI green, the `pr-reviewer` subagent's
  approval (security, and anything that should not exist), and a Codex review.
- **Shared state:** branches, PRs and `docs/loop/BACKLOG.md`.
- **Erik's machine** is needed only for lane `local` tasks.

See [docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md) for the one-time
setup, the iteration protocol, the context discipline and the prompts.

## Goals for the loop

1. **Wide adoption.** The audience is people who install hyped skills and
   plugins and pay for them in tokens, latency and worse tool choice on every
   request. The pitch must be concrete and measured: "your skills cost you N
   tokens per request; here is the $0.001 fix".
2. **Ease of use.** Get from zero to a routed session in three commands. Show
   a GIF in the README. Make `loadout audit` show people their own waste
   before they install anything else.
3. **Decision quality.** Keep the router honest and improve it on new
   held-out data. Prove (or disprove) that outcomes improve, especially with
   cheap models, which is loadout's core economic argument.
4. **A strong public portfolio.** The repo should read as serious
   engineering:
   - CI, a license, clean docs, reproducible benchmarks;
   - security reviews done and fixed;
   - honest results, negative ones included.

   The value created should be legible to a hiring manager in 60 seconds.

## Decisions only Erik can make (ask, don't assume)

1. **License.** `package.json` says MIT, but there is no LICENSE file yet.
   Confirm MIT, then add it.
2. **Going public.** The repo is private. Recommended order: CI green,
   LICENSE, README quickstart verified on a clean machine, then public.
3. **npm name.** `loadout` is taken (0.0.2). Options: `@erik-hedstrom/loadout`
   (scoped, always available), or an unscoped name to check
   (`loadout-router`, `skill-loadout`, …).
4. **Cloud setup and budget.** Do the one-time setup in ORCHESTRATOR.md:
   - GitHub app access to the repo;
   - the `TYPESAFE_API_KEY` secret;
   - the network allowlist;
   - the Codex environment and automatic review.

   Also set spending caps, and decide on more Jev credit when the $10 runs
   out.
5. **Identity.** Stay `erik-hedstrom`; the `haesteining` alias was considered
   and not adopted.
6. **Launch channels and timing.** Show HN, Reddit, X, LinkedIn, awesome
   lists. Agents draft; Erik posts.
7. **Hook default.** The hook sends every routed prompt to TypeSafe. Should
   `setup` install it by default, or only on request?

## Setting up on the new Linux machine

```bash
git clone https://github.com/erik-hedstrom/loadout && cd loadout
npm install && npm run build && npm link          # Node ≥ 22 (developed on 24)
loadout init --key-file ~/keys/typesafe.txt       # the key file is NOT in git; keep it safe
sh bench/data/library.sh                          # rebuild the 1,262-skill library the results used (~10 min)
npm test && npm run typecheck
npx tsx bench/handwritten.ts                      # 18 hand-written checks against the real library (~$0.02)
```

Then install the agent CLIs (`claude`, `codex`) and redo the end-to-end
checks; see backlog item D1. Everything WSL-specific becomes dormant on a
native machine:
- `wslpath` translation;
- `wsl.exe` in generated configs;
- the Git Bash `//` path protection;
- the Windows working folder in `bench/invoke.ts`.

## Map

| Path | What |
|---|---|
| `src/route.ts` | Retrieval → wide/close Jev questions → `decide()` policy; mentions; lexical fallback |
| `src/launch.ts` | Session materialisation, Claude/Codex args, injection framing, host setup snippets, hook commands |
| `src/mcp.ts` | MCP server (stdio + HTTP), confined skill file reads, gateway |
| `src/hook.ts` | Per-prompt hook logic and session state |
| `src/library.ts` | Library scan, safe `add` from dirs/GitHub, confined reads, sources |
| `src/jev.ts`, `src/embed.ts`, `src/prefilter.ts`, `src/retrieve.ts` | Jev client and validation, embeddings, BM25, fusion |
| `src/config.ts`, `src/cli.ts`, `src/repo.ts`, `src/types.ts` | Config, CLI, repo signals, types |
| `test/loadout.test.ts` | All unit tests (fake Jev client, real stdio MCP canary) |
| `bench/` | Benchmarks: synthetic (`route-bench`, `tune`), realistic (`sweep`, `expand`, `judge`), agents (`invoke`, `outcome`), probes |
| `bench/RESULTS.md` | Every result, with method and caveats |
| `bench/results/*` | Raw rows and judge files (committed, so results are reproducible) |
| `bench/data/` | Tasks, seeds, requests, hand-written cases, `library.sh` |

## Known issues and debt

- **HTTP searches:** cancellation does not reach Jev when a client
  disconnects. A concurrency cap bounds it.
- **Gateway approvals:** the gateway exposes library servers through one
  generic `call_server_tool`. Native per-tool approvals need `tools/list_changed`.
- **Codex hook:** not tested live, because trusting it needs `/hooks`
  interactively.
- **Untested hosts:** Cursor, OpenCode and Claude Desktop setups are generated
  but not tested end to end. ChatGPT through a tunnel is untested.
- **Outcome evaluation:** the arms invent their own inputs, the runs inherit
  the user's Codex config, and the sample is tiny.
- **Router weak spots:** integrations, ML and apps. Generic skills such as
  `frontend-ui-engineering` load on simple UI work. Further tuning on the same
  315 requests would overfit, so new requests come first.
- **Tests:** they live in one large file and would read better split per
  module.
