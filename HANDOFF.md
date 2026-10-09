# Handoff: loadout, 2026-10-08

Read this first if you are joining the project, human or agent. Then read
[AGENTS.md](AGENTS.md) (rules), [docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md)
(how the multi-agent loop runs) and [docs/loop/BACKLOG.md](docs/loop/BACKLOG.md)
(what to do next).

## The one-paragraph version

loadout selects skills, MCP servers and a model tier from a separate library,
using documented extension points. See [README.md](README.md) for usage and
[DESIGN.md](DESIGN.md) for the architecture.

## Where it stands

- **Repo:** https://github.com/erik-hedstrom/loadout, **private** for now.
- **Version:** 0.1.0, not published. The npm name `loadout` is taken (see
  decisions below).
- **Owner:** Erik Hedström (GitHub `erik-hedstrom`). Commits use
  `63313283+erik-hedstrom@users.noreply.github.com`.

### What exists

Commands and integration: [README.md](README.md#use) and
[search and hook setup](README.md#search-mid-session-from-any-mcp-host).
Router steps: [DESIGN.md](DESIGN.md#router).

### Evidence so far

All numbers, caveats and negative results are in [bench/RESULTS.md](bench/RESULTS.md).

| Question | Result |
|---|---|
| **Is the work better?** (Codex, 8 requests, blind pairwise) | **Not shown yet:** loadout 4, bare 3, split 1. Wins where skills encode conventions; two losses timed out while following the skill |

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

1. **Wide adoption.** The audience is people who install hyped skill packs
   and plugins. Pitch only with
   [B1](bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)
   numbers, in their scope. Its crossover near 57 skills is interpolated from
   Claude Code runs with generated names; for real libraries it is not
   measured.
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

**Decided:** Apache-2.0 (2026-10-07); stay `erik-hedstrom`, not the
considered `haesteining` alias; hook default (2026-10-07): loadout runs
automatically inside Claude Code, in the CLI and desktop app, through a
user-installed plugin (D10), whose install text says routed prompts go to
TypeSafe. The launcher stays for power users and benchmarks. Shown for the
CLI only; the desktop app is untested ([docs/hosts.md](docs/hosts.md)).

1. **Going public.** The repo is private. Recommended order: CI green,
   LICENSE, README quickstart verified on a clean machine, then public.
   On the day: enable private vulnerability reporting (GitHub offers it only
   on public repos) and, if you want one, add a security contact to
   SECURITY.md. Decide whether `bench/results/*-overhead` may keep your
   ambient plugin and skill names.
2. **npm name.** `loadout` is taken (0.0.2). Options: `@erik-hedstrom/loadout`
   (scoped, always available), or an unscoped name to check
   (`loadout-router`, `skill-loadout`, …).
3. **Cloud setup and budget.** Do the one-time setup in ORCHESTRATOR.md:
   - GitHub app access to the repo;
   - the `TYPESAFE_API_KEY` secret;
   - the network allowlist;
   - the Codex environment and automatic review.

   Also set spending caps, and decide on more Jev credit when the $10 runs
   out.
4. **Launch channels and timing.** Show HN, Reddit, X, LinkedIn, awesome
   lists. Agents draft; Erik posts.

## Setting up on the new Linux machine

```bash
git clone https://github.com/erik-hedstrom/loadout && cd loadout
npm install && npm run build && npm link          # Node ≥ 22.12 (developed on 24)
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
| `src/relay.ts` | MCP transport relay |
| `src/diagnostic.ts` | Fixed-text transport diagnostics |
| `src/audit.ts` | Installed-skill listing and tool overhead audit |
| `plugins/` | Hook-only Claude Code plugin |
| `src/library.ts` | Library scan, safe `add` from dirs/GitHub, confined reads, sources |
| `src/jev.ts`, `src/embed.ts`, `src/prefilter.ts`, `src/retrieve.ts` | Jev client and validation, embeddings, BM25, fusion |
| `src/config.ts`, `src/cli.ts`, `src/repo.ts`, `src/types.ts` | Config, CLI, repo signals, types |
| `test/` | Module suites alongside `loadout.test.ts` (fake Jev client, real stdio MCP canary) |
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
- **Untested hosts:** see [docs/hosts.md](docs/hosts.md).
- **Outcome evaluation:** the arms invent their own inputs, the runs inherit
  the user's Codex config, and the sample is tiny.
- **Router weak spots:** integrations, ML and apps. Generic skills such as
  `frontend-ui-engineering` load on simple UI work. Further tuning on the same
  315 requests would overfit, so new requests come first.
- **Tests:** `loadout.test.ts` still mixes modules (E3).
