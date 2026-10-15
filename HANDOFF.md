# Handoff: loadout, 2026-10-15

Read this first if you are joining the project, human or agent. Then read
[AGENTS.md](AGENTS.md) (rules), [docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md)
(how the multi-agent loop runs) and [docs/loop/BACKLOG.md](docs/loop/BACKLOG.md)
(what to do next).

> **Local orchestrator, before anything else: Erik's machine is days behind
> GitHub, which at this loop's pace is a lot of work.** From 2026-10-12 to
> 2026-10-15 a cloud session and GitHub Codex reviews worked only on GitHub.
> The 16 open PR branches (#25–#40) carry about 200 commits and about 8,800
> added lines, after up to 20 review rounds each. None of it exists locally.
> `git pull` on main will say "up to date": `origin/main` has not moved since
> `fbee5cb` (2026-10-12), because nothing merged. Do not read that as "current".
>
> Treat everything local as stale until checked against GitHub:
> - **Branches and worktrees.** Local `agent/*` branches and the worktrees
>   under `dev/sandbox/loadout-wt/` predate their PRs' later rounds.
>   `git fetch origin`, then start each item from `origin/<branch>`, either
>   as a fresh worktree or with `git reset --hard origin/<branch>` once you
>   have checked nothing local is unpushed. Never push an older local copy
>   over a PR branch.
> - **Sol threads.** `--resume-last` would resume a thread that has not seen
>   these rounds. Brief Sol fresh for every item listed under "In review".
> - **Your picture of the code.** D15 changes `src/mcp.ts`, `src/library.ts`,
>   `src/hook.ts` and `src/doctor.ts`, and B7 adds `bench/mcp-overhead.ts`.
>   Before you touch an area, read the open PRs' diffs for it
>   (`gh pr diff N --name-only`, then the parts you need).
> - **These four loop files** were rebuilt on 2026-10-15 from GitHub's state at
>   about 12:45 UTC. If time has passed since, GitHub wins: run `gh pr list`
>   and read each PR body's **Review state** before acting on anything here.

## The one-paragraph version

loadout selects skills, MCP servers and a model tier from a separate library,
using documented extension points. It is meant to run inside the stock
`claude` and `codex` CLIs people already use. See [README.md](README.md) for
usage and [DESIGN.md](DESIGN.md) for the architecture.

## Where it stands

- **Repo:** https://github.com/erik-hedstrom/loadout, **public** since
  2026-10-12. Everything pushed, and every PR and comment, is public at once.
- **Version:** 0.1.0, not published. The npm name `loadout` is taken (see
  decisions below).
- **Owner:** Erik Hedström (GitHub `erik-hedstrom`). Commits use
  `63313283+erik-hedstrom@users.noreply.github.com`.
- **Main** is at `fbee5cb` (D12, 2026-10-12). Nothing has merged since.
  **16 PRs are open** (#25–#40), listed with their state under "In review"
  in [BACKLOG](docs/loop/BACKLOG.md#in-review). Each PR body has a
  **Review state** section.

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
- **2026-10-13 to 15:** Jev $0. The cloud session ran Claude subagents and
  GitHub Codex reviews on plan quota.
- **Cloud-session credit:** $100, expires 2026-11-05. It pays for Claude
  cloud sessions only, not Routines, Projects or API calls.
- **GitHub Actions:** free on standard runners since the repo went public.
  As a private repo it used up Pro's 3,000 monthly minutes on 2026-10-12:
  about 3,400 billed minutes since 2026-10-01, about 62% of them macOS
  (counted ten times).

## Pick up here (2026-10-15)

A cloud session ran the loop from 2026-10-12 to 2026-10-15 and opened
#35–#40. It merged nothing. The next orchestrator is local.

1. **Merge the loop files.** E13 is
   [#41](https://github.com/erik-hedstrom/loadout/pull/41). The rest of
   these four files is on `agent/loop-handoff-1015`, cut from #41: merge
   #41 first. The handoff PR supersedes #35, the iteration 8 row.
2. **Read the private handoff** at `../loadout-private/HANDOFF-2026-10-15.md`,
   outside the repo. It has the detail behind each open finding, Erik's
   local Codex A/B run with its analysis and $0 checks, and how to handle
   the launch-readiness review (2026-10-13). Never commit, paste or quote
   it. Public text cites the review by that name only.
3. **Drive the open findings** ([ORCHESTRATOR](docs/loop/ORCHESTRATOR.md#handling-review-findings)):
   - C2 #37: Codex round 15 P1 and P2, and pr-reviewer round 11 Lows.
     Also rename the item #37 adds from E13 to E14: local E13 had the ID first.
   - B7 #38: Codex round 16 P2 is open. Erik chooses the root fix (decision
     5), then both reviews run.
   - D15 #39: pr-reviewer on 52f9ca9. Codex round 10 there is clean.
4. **Run the merge gate** on the clean PRs, one at a time. Two order traps:
   - **#36 before #28.**
   - **D15 renames the search tool `find_skills` to `find_tools`.** B7's
     fake host (`test/mcp-overhead.test.ts`), C8's plugin arm and any local
     `-c mcp_servers.loadout.tools.find_skills…` approval name the old
     tool. Merge D15 first, then update them.
5. **Then new work, MCP token cost first:** D17 (measured 2026-10-15;
   what is left is docs and `required = true`), B8 (backlog items from the launch-readiness review),
   then the BACKLOG order.

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
- **MCP first (2026-10-13).** MCP servers take more of the context than
  skills, so MCP token cost leads the backlog (D15, B7, D17, B8).
- **The launch-readiness review (2026-10-13) stays private.**
- **Public repo (2026-10-12).** The history was checked first (168 commits,
  without textconv): no key-shaped strings and no personal email, and the
  authors are noreply addresses. The one personal detail is the Windows
  username, in a since-deleted `.vitest/json/output.json`.

1. **After going public.**
   - Turn on private vulnerability reporting. It was off on 2026-10-12,
     although SECURITY.md links to it.
   - If you want one, add a security contact to SECURITY.md.
   - `bench/results/*-overhead` names your installed plugins and skills.
     They are public now; removing them from history would mean rewriting
     it.
   - Check whether Codex automatic review runs on PRs from outside
     contributors, which would spend your plan.
2. **npm name.** `loadout` is taken (0.0.2). Options: `@erik-hedstrom/loadout`
   (scoped, always available), or an unscoped name to check
   (`loadout-router`, `skill-loadout`, …).
3. **Budgets.**
   - Cloud sessions: add `TYPESAFE_API_KEY` and network access to
     `api.typesafe.ai` and `huggingface.co` to the environment, if they should
     run real-Jev checks (D11).
   - Jev: more credit when the $10 runs out.
4. **Launch channels and timing.** Show HN, Reddit, X, LinkedIn, awesome
   lists. Agents draft; Erik posts.
5. **Open PR decisions (2026-10-15).**
   - **C2 #37:**
     - the margin, 0.10 or 0.05;
     - whether to run in a VM;
     - the licence question;
     - E14, the key redaction, which the loadout arm needs;
     - scope: this protocol, or a smaller pilot first.

     Two threads are left for you: the Jev key, and the shared prompt cache.
   - **B7 #38:**
     - Which account runs it? A Team or Enterprise login is refused.
     - The root fix for plugin default agents. Recommended: refuse any
       ambient plugin and run on a clean Claude home. Alternative: resolve
       every plugin root from Claude's registries.
   - **D15 #39:** four round-3 race threads. A folder swapped for a link
     after the check is only winnable by a same-user process. Either accept
     the stated scope, or drop opportunistic pruning and re-check dev/ino
     after each open.
   - **D13** (in #25): how the plugin opens what its hook routes to.
   - **#27:** your questions. **#34:** the skills.sh threads. **#36:** the
     `/proc` thread.
   - **Stale branches:** the `wip/*` branches and worktrees from cloud
     sessions. Delete them or keep them.

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
- **MCP start-up in Codex:** `loadout mcp` answers `initialize` in about
  0.4 s from a Linux-filesystem checkout, but in 6–7 s from `/mnt/c` through
  `wsl.exe`. That is past Codex's grace of about 1 s for optional servers,
  so its tools join mid-session. The cost is module loading over 9P, not
  the library scan ([D17](docs/loop/BACKLOG.md)).
