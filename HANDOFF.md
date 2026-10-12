# Handoff: loadout, 2026-10-12

Read this first if you are joining the project, human or agent. Then read
[AGENTS.md](AGENTS.md) (rules), [docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md)
(how the multi-agent loop runs) and [docs/loop/BACKLOG.md](docs/loop/BACKLOG.md)
(what to do next).

## The one-paragraph version

loadout selects skills, MCP servers and a model tier from a separate library,
using documented extension points. It is meant to run inside the stock
`claude` and `codex` CLIs people already use. See [README.md](README.md) for
usage and [DESIGN.md](DESIGN.md) for the architecture.

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

- **Jev:** about $5 of the $10 TypeSafe credit (estimate; there is no usage
  endpoint).
- **Claude subscription:** the judges and agent runs hit the session limit
  twice. Run judges sequentially, so the catalog prompt stays cached.
- **Codex subscription:** used for reviews, request generation and outcome
  runs.
- **Cloud-session credit:** $100, expires 2026-11-05. It pays for Claude
  cloud sessions only, not Routines, Projects or API calls.
- **GitHub Actions:** Pro includes 3,000 minutes a month. Windows counts
  double and macOS ten times, so the `ci-full` matrix is the expensive part.
  Jobs stopped starting on 2026-10-12. Job timings since 2026-10-01 add up
  to about 3,400 billed minutes, about 62% of them macOS.

## How the work continues

The work continues as a loop in which Sol (Codex) builds and Claude reviews.
It is run by a Claude Code session on Erik's machine. Cloud sessions fill in
when local usage runs out and leave merging to the next local run. The
topology, merge gate, prompts and budgets are in
[docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md). Shared state lives in
branches, PRs and `docs/loop/BACKLOG.md`.

## Goals for the loop

1. **Wide adoption.** The audience is people who install hyped skill packs
   and plugins. Pitch only with
   [B1](bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)
   numbers, in their scope. Its crossover near 57 skills is interpolated from
   Claude Code runs with generated names; for real libraries it is not
   measured.
2. **Ease of use, in the user's own CLI.** Get from zero to loadout running
   inside `claude` or `codex` in three commands, with no new command to
   start the agent. Show a GIF in the README. Make `loadout audit` show
   people their own waste before they install anything else, and `loadout
   doctor` show what is left to set up.
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

**Decided:**
- Apache-2.0 (2026-10-07). Stay `erik-hedstrom`, not the considered
  `haesteining` alias.
- **Default CLIs first (2026-10-07, widened 2026-10-12).** loadout plugs into
  the stock `claude` and `codex` CLIs through their own extension points:
  the Claude Code plugin and its prompt hook (D10), the Codex hook, and MCP
  search. The plugin's install text says routed prompts go to TypeSafe.
  Asking people to start their agent through `loadout claude|codex` is a hard
  sell, so the launcher stays for benchmarks and power users, and
  launcher-only work is P2. Alternative hosts such as OpenCode or T3 Code get
  the generic MCP server; competing with them is out of scope. Verified for
  the Claude Code CLI only ([docs/hosts.md](docs/hosts.md)).

1. **Going public.** The repo is private. Recommended order: CI green,
   LICENSE, README quickstart verified on a clean machine, then public.
   On the day: enable private vulnerability reporting (GitHub offers it only
   on public repos) and, if you want one, add a security contact to
   SECURITY.md. Decide whether `bench/results/*-overhead` may keep your
   ambient plugin and skill names.

   History check (2026-10-12, 168 commits, without textconv): no key-shaped
   strings and no personal email. Authors are noreply addresses. The one
   personal detail is the Windows username, in a since-deleted
   `.vitest/json/output.json`.
2. **npm name.** `loadout` is taken (0.0.2). Options: `@erik-hedstrom/loadout`
   (scoped, always available), or an unscoped name to check
   (`loadout-router`, `skill-loadout`, …).
3. **Budgets.**
   - GitHub Actions: make the repo public (Actions is then free on standard
     runners; see decision 1), raise the spending limit, drop macOS from
     `ci-full`, or merge on local test runs until the monthly reset. The last
     option needs AGENTS.md's merge rule changed.
   - Cloud sessions: add `TYPESAFE_API_KEY` and network access to
     `api.typesafe.ai` and `huggingface.co` to the environment, if they should
     run real-Jev checks (D11).
   - Jev: more credit when the $10 runs out.
4. **Launch channels and timing.** Show HN, Reddit, X, LinkedIn, awesome
   lists. Agents draft; Erik posts.

## Setting up on the new Linux machine

```bash
git clone https://github.com/erik-hedstrom/loadout && cd loadout
npm install && npm run build && npm link          # Node ≥ 22.12 (developed on 24)
loadout init --key-file ~/keys/typesafe.txt       # the key file is NOT in git; keep it safe
sh bench/data/library.sh                          # rebuild the 1,262-skill library the results used (~10 min)
loadout doctor                                    # key, one Jev call, library, index, host setup
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
| `src/doctor.ts` | Read-only setup check (`loadout doctor`) |
| `plugins/` | Hook-only Claude Code plugin: the main way in |
| `docs/hosts.md` | What works in which host, verified or not |
| `src/library.ts` | Library scan, safe `add` from dirs/GitHub, confined reads, sources |
| `src/jev.ts`, `src/embed.ts`, `src/prefilter.ts`, `src/retrieve.ts` | Jev client and validation, embeddings, BM25, fusion |
| `src/config.ts`, `src/cli.ts`, `src/repo.ts`, `src/types.ts` | Config, CLI, repo signals, types |
| `test/` | Module suites alongside `loadout.test.ts` (fake Jev client, real stdio MCP canary) |
| `bench/` | Benchmarks: synthetic (`route-bench`, `tune`), realistic (`sweep`, `expand`, `judge`), agents (`invoke`, `outcome`), probes |
| `bench/RESULTS.md` | Every result, with method and caveats |
| `bench/results/*` | Raw rows and judge files (committed, so results are reproducible) |
| `bench/data/` | Tasks, seeds, requests, hand-written cases, `library.sh` |

## Known issues and debt

- **Gateway approvals:** the gateway exposes library servers through one
  generic `call_server_tool`. Native per-tool approvals need `tools/list_changed`.
- **Untested in a real session:** the Codex hook (D2) and the desktop app
  (D10); see [docs/hosts.md](docs/hosts.md).
- **Native Windows:** `which()` ignores PATHEXT, so `claude.exe` and `.cmd`
  shims read as not on PATH, in `loadout run` and `doctor` (D7).
- **Outcome evaluation:** the arms invent their own inputs, the runs inherit
  the user's Codex config, and the sample is tiny.
- **Router precision on new requests:** 64% (55–72) of loads were useful on
  C1's held-out requests, against 82% (75–87) on v4's
  ([RESULTS](bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)), mostly
  on general business requests. Generic skills such as
  `frontend-ui-engineering` load on simple UI work (C4).
- **Tests:** `loadout.test.ts` still mixes modules (E3).
