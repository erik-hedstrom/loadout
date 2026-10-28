# Handoff: loadout, 2026-10-26

Read this first if you are joining the project, human or agent. Then read
[AGENTS.md](AGENTS.md) (rules), [docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md)
(how the multi-agent loop runs) and [docs/loop/BACKLOG.md](docs/loop/BACKLOG.md)
(what to do next).

> **After any gap, local state is stale.** The work lives on open PR
> branches, and `main` can look current while it is not. Before acting on
> anything here, follow [ORCHESTRATOR, Iteration protocol, step 1](docs/loop/ORCHESTRATOR.md#iteration-protocol).
> GitHub wins over these files.

## The one-paragraph version

In stock `claude` and `codex`, loadout uses Jev to add the skills predicted to fit
each substantive prompt, and its MCP tools let the agent search the library.
The `loadout claude|codex` launcher instead makes one decision per session:
skills, MCP servers and a model tier. It uses documented extension points. See [README.md](README.md)
for usage and [DESIGN.md](DESIGN.md) for the architecture.

## Where it stands

- **Repo:** https://github.com/erik-hedstrom/loadout, **public** since
  2026-10-12. Everything pushed, and every PR and comment, is public at once.
- **Version:** 0.1.0, not published. The npm name `loadout` is taken (see
  decisions below).
- **Owner:** Erik Hedström (GitHub `erik-hedstrom`). Commits use
  `63313283+erik-hedstrom@users.noreply.github.com`.
- **Main snapshot (2026-10-26):** `781090a`. It includes the C14 A/B
  harness (#47) and its measurement fixes (#64), B11's OpenCode harness
  (#57) and completed replacement pilot (#63), D21's cache-stable request
  prefix (#59), the separate caching track (#60), the production dependency
  patches (#61) and the docs-evidence pass (#62). Current work and review state: [BACKLOG](docs/loop/BACKLOG.md).

### What exists

Commands and integration: [README.md](README.md#use),
[hook setup](docs/hook.md) and [search setup](docs/mcp.md).
Router steps: [DESIGN.md](DESIGN.md#router).

### Evidence so far

All numbers, caveats, raw-result links and recorded costs are in
[bench/RESULTS.md](bench/RESULTS.md).

- **Measured:** [B12's listing and tool cost on current hosts](bench/RESULTS.md#b12-results-2026-10-28-what-installed-skills-cost-per-request-on-current-hosts),
  [B1's fresh-session listing overhead](bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request) (historical),
  [C1's held-out skill decisions](bench/RESULTS.md#c1-2026-10-08-new-held-out-requests),
  [C13's repeated router baseline](bench/RESULTS.md#c13-2026-10-16-pure-jev-baseline-on-main),
  and [agent skill use](bench/RESULTS.md#do-agents-use-what-they-are-given).
  [Hook](bench/RESULTS.md#routed-prompts-with-the-library-scan-cache-d11-2026-10-12)
  and [WSL MCP startup](bench/RESULTS.md#mcp-start-up-under-wsl-d17-2026-10-15)
  timings have their recorded scope and limitations.
- **Better work: not shown.** The [eight-request outcome pilot](bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)
  does not establish an improvement. [C14's rerun with the measurement fixes](bench/RESULTS.md#c14-rerun-2026-10-26-codex-luna-with-the-fixes)
  compares loadout with a setup that has no skills: loadout added uncached
  input tokens on all three prompts and won the one prompt where it opened skills.
- **Not shown:** [B7's configured-MCP overhead study](bench/RESULTS.md#b7-method-not-run-yet-what-configured-mcp-servers-cost-per-request)
  has not run; [model-tier choice](bench/RESULTS.md#threats-to-validity)
  is not evaluated. [B11's completed replacement pilot](bench/RESULTS.md#b11-replacement-pilot-2026-10-23-completed-2026-10-26)
  does not establish retained quality or size break-even; the full study is
  not completed.

## Pick up here

1. **C14** is done for Codex
   ([rerun](bench/RESULTS.md#c14-rerun-2026-10-26-codex-luna-with-the-fixes)). Measuring the saving
   loadout is meant to make, replacing a natively installed library, needs a
   comparison against that library, not against bare.
   The Claude arm is blocked until a tool-less Codex judge is available (E12).
   [Method and limits](bench/RESULTS.md#c14-method-three-prompts-with-and-without-loadout);
   [run command](bench/README.md#ab-pilot-c14).
2. **B11:** the replacement pilot completed. Run the 792-session full study
   in its own output folder (never the pilot's) as the free quota allows.
   [Evidence](bench/RESULTS.md#b11-replacement-pilot-2026-10-23-completed-2026-10-26);
   [commands and handoff](docs/loop/B11-HANDOFF.md).
3. **Prompt caching:** [CACHE-TRACK.md](docs/loop/CACHE-TRACK.md) defines the
   boundary and [BACKLOG section F](docs/loop/BACKLOG.md#f-prompt-caching)
   holds the work queue. Complete cached-session savings remain not shown.

## How the work continues

The work continues as a loop in which Sol (Codex) builds and Claude reviews.
Cloud sessions fill in when local usage runs out. The
topology, merge gate, prompts and budgets are in
[docs/loop/ORCHESTRATOR.md](docs/loop/ORCHESTRATOR.md). Shared state lives in
branches, PRs and `docs/loop/BACKLOG.md`.

## Goals for the loop

1. **Wide adoption.** The audience is people who install hyped skill packs
   and plugins. Pitch only with
   [B12](bench/RESULTS.md#b12-results-2026-10-28-what-installed-skills-cost-per-request-on-current-hosts)
   numbers, in their scope: one request per fresh session, Haiku and
   gpt-6-luna, real names with placeholder bodies. The scoped summary is in
   the [README](README.md); whole sessions are not measured.
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
- **Open PR decisions settled on 2026-10-15.** B7: no ambient plugins (a
  fresh Claude home per run), Erik's personal subscription, and the Codex
  arms keep the real `CODEX_HOME` with the writes the plan prints. D15: the
  stated race scope is accepted.
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
5. **Study prerequisites and remaining decisions.** See
   [BACKLOG](docs/loop/BACKLOG.md) for C2's run prerequisites, D13's skill
   loading path and the remaining review decisions. Stale cloud branches and
   worktrees stay until Erik decides whether to keep them.

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
| `plugins/` | Claude Code hook plugin and Codex hook + MCP plugin |
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
- **Host verification:** [docs/hosts.md](docs/hosts.md) tracks what is not yet
  verified per host.
- **Outcome evaluation:** the [original pilot](bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)
  used agent-invented inputs and inherited the user's Codex config. Better
  outcomes remain not shown; [C14's rerun](bench/RESULTS.md#c14-rerun-2026-10-26-codex-luna-with-the-fixes) compares only against
  bare, and the Claude arm waits on E12.
- **Router precision on new requests:** lower on C1's held-out requests than
  on v4's, with the numbers in
  [RESULTS](bench/RESULTS.md#c1-2026-10-08-new-held-out-requests), mostly on
  general business requests. Generic skills such as
  `frontend-ui-engineering` load on simple UI work (C4).
- **Tests:** `loadout.test.ts` still mixes modules (E3).
- **MCP start-up in Codex:** from `/mnt/c` through `wsl.exe`, `loadout mcp`
  misses Codex's grace for optional servers, so its tools join mid-session
  ([D17](docs/loop/BACKLOG.md)). The `--windows` TOML now sets
  `required = true`; plugin users have `mcp_optional_startup_grace_ms`
  ([search setup](docs/mcp.md#wsl-startup)).
