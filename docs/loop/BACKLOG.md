# Backlog

The orchestrator keeps this file current. Statuses: `todo`, `in progress (PR #)`,
`review`, `done (PR #)`, `blocked: <why>`.

**Columns:**
- **P:** priority. P0 is the first iterations; P1 next; P2 later.
- **Agent:** suggested vendor. The other vendor reviews.
- **Lane:** `cloud` (runs anywhere against GitHub), `local` (needs Erik's
  logged-in CLIs or apps), `erik` (needs Erik's decision or action).

**Order of things:**
1. Foundations: CI, license, judging inside the cloud session, a
   simplification pass.
2. The hook for the audience: `audit` and the token-waste study.
3. A README built on those numbers.
4. Launch.

New router tuning only happens on new held-out requests (C1).

In-host first (Erik, 2026-10-07): loadout works inside Claude Code, in the
CLI and the desktop app, through a plugin and its prompt hook (D10). The
launcher is for power users and benchmarks.

## A. Adoption and ease of use

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| A2 | P0 | `loadout audit`: what your installed skills cost you | Claude | cloud | review |
| A1 | P1 | README rewrite around the problem, 3-command quickstart, GIF | Claude | cloud | todo (after A2, B1) |
| A3 | P1 | `loadout init` wizard + starter packs | Codex | cloud | todo |
| A4 | P1 | npm package under an available name + release workflow | Codex | cloud + erik | blocked: npm name decision |
| A5 | P1 | Demo recording (route, launch, hook) | Claude | local | todo (after A1) |

**A2. `loadout audit`.**

Why: this is the entry point for the audience. "Your 312 installed skills add
~38k tokens to every request" is the sentence people share.

Acceptance:
- Read-only scan of Claude Code (user and project skills, enabled plugins'
  skills, MCP servers), Codex (`~/.codex/skills`, `.agents/skills`, MCP
  servers in `config.toml`), OpenCode and Cursor where present.
- Prints per-host counts and estimated tokens per request:
  - descriptions, approximated at 4 characters per token, with the method
    stated;
  - MCP tool schemas only if they can be read without starting servers;
    otherwise the server is listed as "not counted".
- A one-line, shareable summary, plus the loadout comparison (≈ tokens of
  tool definitions + picked skills).
- Optional `loadout audit --adopt` *copies* the found skills into the library
  (provenance kept). It prints how to disable them in each host but never
  edits host configs (AGENTS.md rule 3).
- Tests use fake home directories.
- It never writes outside `~/.loadout`.

A2 learnings: inventory is not request overhead; overrides are host-specific, MCP counts describe configuration, and adoption must exclude real library locations discovered through host links (PR #3).

**A1. README rewrite.**

Acceptance:
- Above the fold:
  - the problem, with one measured number from B1;
  - what loadout does in one sentence;
  - a three-command quickstart (`npm i -g …`, `loadout init`, then the
    plugin install from D10), with `loadout audit` as the way to see the
    problem first;
  - a GIF.
- Everything else moves to `docs/` (hosts, MCP server, hook, security model,
  benchmarks).
- Every number links to `bench/RESULTS.md`.
- Verified by following it on a clean machine or container.
- Reviewed for honesty: the outcome pilot is mixed, so the README must not
  claim better results.

**A3. `loadout init` wizard and starter packs.**

Acceptance:
- Interactive when a TTY is present, flags otherwise.
- Sets up the key (env or file), offers starter packs (curated `loadout add`
  sets, e.g. "popular" = the top skills.sh sources, "documents", "security"),
  builds the index, and prints the `setup` snippet for the detected hosts.
- Never edits host configs.
- Completes in under 2 minutes, excluding downloads.

**A4. npm release.**

Acceptance:
- Package name per Erik's decision (`loadout` is taken).
- `files` and `bin` correct; `npx <name> route "…"` works from a clean
  directory.
- A GitHub Actions release on tag. Provenance on.
- No publish without Erik.

**A5. Demo recording.**

Acceptance:
- A `vhs` or asciinema script committed in `docs/demo/`.
- A GIF under 2 MB in the README.
- It shows `audit` → `route` → a launched session using an injected skill.

## B. Positioning and launch (honest hype)

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| B1 | P0 | Token-waste study: measured per-request overhead of popular skill packs | Claude | local (measure) + cloud (analysis) | review ([PR #6](https://github.com/erik-hedstrom/loadout/pull/6); local measurements pending) |
| B3 | P1 | Fact-checked comparison with alternatives | Codex | cloud | todo |
| B2 | P1 | Launch kit drafts | Claude | cloud | todo (after A1, B1) |
| B4 | P1 | Repo polish: description, topics, social preview, badges | Claude | cloud + erik | todo |
| B6 | P2 | GitHub profile README draft | Claude | cloud | todo |
| B5 | P2 | Awesome-list and directory submissions (drafts) | Codex | erik | blocked: repo public |

**B1. Token-waste study.**

Why: the headline must be measured, not estimated.

Learnings: [PR #6](https://github.com/erik-hedstrom/loadout/pull/6) round 4 requires stable Claude ambient inventory beyond declared treatment additions and distinguishes its isolated baseline from Codex's ambient baseline (14 Claude calls; paid Codex deferred). Measured 2026-10-07: see "B1 results" in bench/RESULTS.md. The inventory guard stopped the first attempt when a synced plugin vanished between calls. Left: paid Codex (blocked on unified_exec); real skill names instead of generated ones; an arm between 50 and 1,232 skills; cost per 1,000 requests at list prices; cached multi-turn cost; the chart. Before the repo goes public, Erik decides whether the raw rows may keep his ambient plugin and skill names, or whether they get hashed. Pack MCP servers stay excluded: starting them runs downloaded code (AGENTS rule 5).

Acceptance:
- A script in `bench/` installs well-known packs (Superpowers, anthropics/skills,
  the top 50 skills.sh skills, a few popular MCP servers) into a throwaway
  `HOME` and reads the real input tokens of one trivial prompt:
  - Claude Code: `claude -p --output-format json` usage;
  - Codex: `codex exec --json`;
  - compared with the same prompt bare and with loadout.
- It reports tokens, the cost per 1,000 requests at list prices (cached and
  uncached), and whether the host truncates descriptions silently.
- A chart and a RESULTS entry.

**B2. Launch kit.**

Acceptance:
- Drafts in `docs/launch/`:
  - a blog post ("We installed 1,262 skills…");
  - Show HN text;
  - X and LinkedIn threads;
  - r/ClaudeAI and r/ChatGPTCoding posts;
  - a 60-second demo script.
- Every claim is sourced to RESULTS.
- The limitations are stated: an outcome gain is not shown yet.
- Erik posts.

**B3. Comparison with alternatives.**

Acceptance: a table with sources and access dates covering:
- native skill loading in Claude Code and Codex, with their description
  budgets;
- tool search / deferred tools;
- MCP gateways and tool-search servers (e.g. toolsift);
- model routers (e.g. jev-router);
- skills directories.

State what each solves and what loadout adds.

**B4. Repo polish.**

Acceptance:
- Repo description and topics (Erik approves).
- A social preview image (an SVG source in `docs/brand/`).
- CI and license badges.
- A CHANGELOG.

**B6. Profile README.**

Acceptance: `docs/launch/profile-README.md` for github.com/erik-hedstrom,
presenting loadout and the engineering behind it (benchmarks, reviews,
cross-vendor agents). Erik publishes.

## C. Skill decision-making (router quality)

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| C1 | P0 | New held-out request set + re-measure v4 | Codex (seeds) + Claude (expand, judge) | cloud | todo (after E7) |
| C2 | P1 | Outcome eval on the small tier with fixed fixtures | Claude (design) | cloud (fixtures) + local (runs) | todo |
| C3 | P1 | Does Jev pick a sensible model tier? | Claude | cloud | todo (after E7) |
| C4 | P1 | Demote generic "fits everything" skills | Codex | cloud | todo (after C1) |
| C5 | P2 | Retrieval beyond 200 candidates (Jev tournament) | Codex | cloud | todo |
| C6 | P2 | Multi-intent requests | Claude | cloud | todo |
| C7 | P1 | Recommended packs with measured upside (first: frontend with Impeccable) | Codex (harness) + Claude (runs) | cloud (fixtures) + local (runs) | todo (after B1, C2) |

**C1. New held-out requests.**

Acceptance:
- 300 new seeds from a model that never saw the library (with a seed
  different from v4's), expanded as before.
- Judged blind with the full catalog through the API (E7).
- v4's rule reported on all of them **without retuning**, next to the v4 test
  numbers.
- If they differ a lot, find out why. These requests become the new tuning
  set; keep a third untouched.

**C2. Small-tier outcome eval.**

Why: loadout's economic thesis is that a cheap model plus the right skill can
match an expensive model without one.

Acceptance:
- 15–20 tasks with fixed input fixtures committed in `bench/fixtures/`.
- Arms:
  - small tier bare;
  - small tier + loadout;
  - large tier bare.
- Blind pairwise judging in both orders, longer caps (15 min).
- Report win rates with intervals, plus cost per task.

**C3. Tier choice.**

Acceptance:
- On C1's requests, a judge rates whether small / medium / large fits each
  request.
- Compare with Jev's choice (confusion matrix).
- Estimate the cost difference against always-large.

**C4. Demote generic skills.**

Example: `frontend-ui-engineering` loads on simple UI work the judge says
needs nothing.

Acceptance:
- A principled signal: a per-skill load-frequency prior, or a "general
  practice vs specific procedure" question.
- Tuned on C1's dev split, reported on its test split.
- Load precision up with useful loads not down by more than the interval.

**C5. Retrieval beyond 200 candidates.**

Acceptance:
- Run the wide choice over 2–4 chunks of 250 candidates and merge.
- Measure whether the judge's best skill now appears among the candidates
  (currently 87%) and what it costs.
- Adopt only if useful loads improve on a held-out split.

**C6. Multi-intent requests.**

Example: "convert this deck to PDF and email the client" needs `pptx`, `pdf`
and email skills.

Acceptance:
- Detect composite requests and allow one skill per intent.
- Evaluate on C1's dev split.

**C7. Recommended packs with measured upside.**

Why (Erik, 2026-10-07): people install packs such as Impeccable for their
upside and pay for them on every request. A pack recommendation backed by
two numbers ("costs X% less per request with loadout, wins Y% of blind
comparisons against the host's defaults") is the strongest adoption and
founder-facing argument, if the numbers hold.

Acceptance:
- Preregister in `bench/RESULTS.md` before any run: the metrics, the
  fixtures, the sample size and the arms. Report whatever comes out,
  including no gain.
- Overhead: tokens per request with the pack installed natively vs in
  loadout's library, on a fixed request mix, with B1's method, for Claude
  Code and Codex. B1 measured Impeccable's listing at +216 tokens per
  request, so any saving must come from what loads when it is used, not from
  the listing.
- Quality: fixed frontend fixtures (C2's harness). Arms: host defaults,
  host + pack native, host + loadout with the pack in the library. Blind
  pairwise judging in both orders, by the other family (Sol judges Claude
  Code's output, Claude judges Codex's), from screenshots plus a rubric.
- The pack list (A3 starter packs, README) only quotes numbers measured
  here.

## D. Integrations and robustness

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| D10 | P0 | In-host first: loadout as a Claude Code plugin (hook), CLI then desktop app | Codex | cloud + local + erik | in progress |
| D1 | P0 | Validate on the new native Linux machine | Claude | local | todo (machine pending) |
| D7 | P1 | `loadout doctor` | Codex | cloud | todo |
| D2 | P1 | Live Codex hook test | Claude | local + erik | todo |
| D3 | P1 | Desktop and IDE hosts end to end | Claude | local | todo |
| D5 | P2 | Isolation mode | Codex | cloud | todo |
| D4 | P2 | Gateway: native tools via `tools/list_changed` | Codex | cloud | todo |
| D6 | P2 | HTTP: cancellation reaches Jev | Codex | cloud | todo |
| D8 | P1 | Host capability matrix (verified vs generated) | Codex | cloud | todo |
| D9 | P1 | Codex parity: neutral session skill dir, tier presets | Codex | cloud | todo (after E9) |

**D10. In-host first: loadout as a Claude Code plugin.**

Why (Erik, 2026-10-07): users stay in Claude Code, in the CLI or the desktop
app, and loadout adds its value there. Competing to be the gateway is the
harder position. The desktop app's Code tab loads the same `~/.claude` hooks
and plugins as the CLI. B1: the hook has no fixed token cost, while the MCP
tools add 546 tokens to every request.

Acceptance:
- The repo is a plugin marketplace (`.claude-plugin/marketplace.json`) with
  one plugin, `plugins/loadout`, which runs the prompt hook. It has no MCP
  server and no `bin/`. The user installs it, and nothing edits `~/.claude`
  (rule 3). `claude plugin validate` passes.
- `loadout setup claude-code` prints the install commands. The settings
  snippet stays only for loadout in WSL behind a Windows Claude Code.
- The install text says that routed prompts go to TypeSafe (decision 7).
- CLI: `claude -p --plugin-dir plugins/loadout` on the 10 hook requests from
  `bench/invoke.ts` shows the context arriving (compare 6/10 in RESULTS).
- Latency: `bench/hook-latency.ts` reports p50 and p95 per step, with real
  Jev on a native install. The hook deadline is then chosen from those
  numbers.
- Desktop app: Erik installs the plugin, and one Code-tab session shows the
  hook context. Record what differs from the CLI.

**D1. Native Linux validation.**

Acceptance:
- On the fresh machine, run:
  - `npm ci`, `npm test`, `bench/data/library.sh`, `bench/handwritten.ts`
    (18/18 expected);
  - `loadout claude --headless` and `loadout codex --headless` on 3 tasks;
  - hook mode for Claude Code.
- Fix whatever assumed WSL.
- Measure hook latency (6 s on WSL; expect about 3 s).

**D2. Codex hook live test.**

Acceptance:
- Erik trusts the hook with `/hooks`.
- `codex exec` on 5 hook-mode requests (as in `bench/invoke.ts`) shows the
  context arriving and the skills being opened.
- Document the result.

**D3. Desktop and IDE hosts.**

Acceptance: `loadout setup` output tested by hand for:
- Claude Desktop;
- Cursor;
- OpenCode;
- ChatGPT developer mode through a tunnel (needs Erik's account).

For each, write down what worked, as a screenshot or a note in `docs/hosts.md`.

**D4. Gateway via `tools/list_changed`.**

Acceptance:
- A `use_server` tool registers the server's real tools (prefixed) and sends
  `tools/list_changed`, so host approvals apply per tool.
- Fall back to `call_server_tool` where the host ignores it.
- Tests with the canary server.

**D5. Isolation mode.**

Acceptance:
- `loadout claude --isolate` hides the user's own MCP servers and plugins for
  the session, through official flags only (`--strict-mcp-config`; Codex
  `--ignore-user-config` where available).
- Document what cannot be hidden.

**D6. HTTP cancellation.**

Acceptance:
- An AbortSignal flows from the MCP request through `route()` and `askJev()`
  to `fetch`.
- A test shows a disconnected client stops the Jev call.

**D8. Host capability matrix.**

Why (Sol review, 2026-10-07): the README promises model, skill and MCP
selection for six hosts, but only Claude Code and Codex get launch, tier and
hook support; Cursor, OpenCode and Claude Desktop get an MCP search snippet,
and ChatGPT skills-only HTTP search. A non-Claude user notices.

Acceptance:
- `docs/hosts.md`: one table, hosts × {launch, tier, hook, search, gateway},
  each cell "verified" (with the date and how), "generated, untested" or
  "not supported".
- README and `setup` output claim no more than the table.

**D9. Codex parity.**

Why (Sol review): Codex sessions get Claude plugin metadata and plain prompt
pointers, while Claude gets native registration; Codex medium and large tiers
map to one model with different effort, and that economics is unmeasured.

Acceptance:
- The session skill directory is host-neutral; Claude metadata is written
  only for Claude.
- Tier mappings are documented as model/effort presets, labelled
  unvalidated until C3 measures them.

**D7. `loadout doctor`.**

Acceptance:
- Checks the key (presence and a live call), the library, the embedding
  index, configured hosts and CLI versions.
- Prints the fix for each failed check.
- Read-only.

## E. Engineering quality (what a reviewer of the repo sees)

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| E1 | P0 | GitHub Actions CI | Codex | cloud | done ([PR #2](https://github.com/erik-hedstrom/loadout/pull/2)) |
| E2 | P0 | LICENSE, CONTRIBUTING, SECURITY.md, templates | Claude | cloud + erik | done ([PR #1](https://github.com/erik-hedstrom/loadout/pull/1)) |
| E7 | P0 | Vendor-independent bench judges and expander | Codex | cloud | done ([PR #5](https://github.com/erik-hedstrom/loadout/pull/5)) |
| E8 | P0 | Repo-wide simplification pass | Claude (pr-reviewer finds, worker fixes) + Codex review | cloud | todo (include A2's toolTokens tautology test and E7's cosmetic items) |
| E9 | P0 | Security hardening from the read-only Sol review | Codex | cloud | done ([PR #4](https://github.com/erik-hedstrom/loadout/pull/4), re-measure [PR #7](https://github.com/erik-hedstrom/loadout/pull/7)) |
| E3 | P1 | Split the test file per module | Codex | cloud | todo |
| E5 | P1 | Changelog and release automation | Codex | cloud | todo (with A4) |
| E6 | P2 | Architecture diagram in DESIGN.md | Claude | cloud | todo |
| E10 | P1 | Build without optional dependencies | Codex | cloud | done ([PR #8](https://github.com/erik-hedstrom/loadout/pull/8)) |
| E11 | P1 | Fixed-text diagnostics in the gateway and relay | Codex | cloud | todo |

**E10. Build without optional dependencies.** src/embed.ts:24 types
`@huggingface/transformers` with `typeof import(...)`. So `tsc` fails when npm
skips the optional install, which happened once on Ubuntu with Node 24 in CI.
Acceptance: `npm ci --omit=optional && npm run build` passes, checked in CI.

**E11. Fixed-text diagnostics in the gateway and relay.** These come from the
E9 round-8 reviews:
- the gateway's `failure()` (src/mcp.ts) returns raw SDK or upstream error
  text to the agent;
- the relay folds loadout's own config errors into "transport failed";
- Jev schema errors could keep loadout's own question id.

Acceptance: the same fixed-text rule and adversarial tests as E9.

**E1. CI.**

Acceptance:
- Runs on push and PR: `npm ci`, build, typecheck, test.
- Matrix: Ubuntu, macOS, Windows × Node 22 and 24 (Node 20 is end-of-life since 2026-04-30).
- No secrets needed.
- The badge goes in the README.

Learnings: WSL hook assertions need a Linux runtime fixture on native Windows; Vitest 5 needs Node ≥ 22, so engines moved to >=22 (Node 20 is EOL); plain `npm ci` preserves Rolldown's optional native bindings.

**E2. Community files.**

Acceptance:
- `LICENSE` (Apache-2.0, decided by Erik on 2026-10-07).
- `CONTRIBUTING.md`: setup, the evaluation discipline from AGENTS.md, PR
  rules.
- `SECURITY.md`: the threat model, covering third-party skill text, the
  hook's data flow, HTTP exposure, and how to report issues.
- Issue and PR templates.

Learnings: loopback HTTP permits no token; recheck credential protections after E9; native Windows has a WSL-path test failure (28/29 pass); private reporting availability is unverified offline.

**E7. Bench judging in a cloud session.**

Acceptance:
- One `modelJson` seam for judge/expander: `--backend claude|codex|files`,
  default Claude; shared schema validation, regular-file answers and resumable batches.
- Sequential judges; escaped third-party catalog after the rubric in Claude's
  cached system prefix, first in Codex's prompt. Dev/test/combined Wilson reports.
- Exact, nonempty expansion coverage before append; reject duplicate request IDs.
  Exact verdict ratings and catalog-only missed keys; retry once, exclude and count
  unresolved disputes. Backend/model/effort provenance and resume checks; reject
  Claude effort. Files producers unverified; warn on same-family/global context.
- Codex read-only sandbox, credential env stripping, shell/unified-exec/view-image
  disabling flags; offline preflight requires shell_tool and unified_exec false.
  Offline adversarial tests, `npm test` and typecheck (E1 owns the Windows hook failure).

Remaining (orchestrator): record the 0.160.1 negative result in RESULTS:
unified_exec stays true, so preflight refuses Codex. No Codex kappa until preflight
and a one-call hostile temporary AGENTS.md canary both pass (answer unchanged);
verify installed-skill isolation without relocating CODEX_HOME. Check `claude -p`
in cloud; re-judge 40 v4 requests with an Opus subagent via `files` and, when safe,
`codex`. Preserve IDs/splits and raw results; report stored-verdict agreement,
inter-judge Cohen's kappa, intervals and measured cost. The judge prompt changed
(catalog escaping/framing, rubric line), as did logic (1 retry instead of 2;
unresolved disputes excluded). Agreement measures prompt and logic changes plus
the judge, and must be reported that way. Budget: 4–8 batches before retries;
Claude CLI ~$1.20–$2.40 cached, ~$3.60–$7.20 uncached (files/Opus cloud overhead
extra); Codex quota cost not exposed. No paid calls during implementation.

**E8. Simplification pass.**

Why: the repo must read as careful engineering, not generated filler, and
some of it was written fast.

Acceptance:
- Run `pr-reviewer`'s "what should not exist" checklist over `src/`,
  `bench/` and every Markdown file, one area per PR.
- Delete or shrink:
  - dead code;
  - single-use abstractions;
  - narrating comments;
  - repeated docs (link instead);
  - claims without numbers.
- No behavior change: tests unchanged and green, and the bench scripts still
  run.
- Report lines removed per area.

Starting points from Sol's review (2026-10-07):
- `src/`, ≈ 40–60 lines: `prefilter()` is used only by tests
  (production uses `hybridRank()`); the `inverted` metadata in route.ts is
  unused; `oneLine` is duplicated in hook.ts and mcp.ts; some module
  introductions repeat DESIGN.
- `bench/`, ≈ 50–75 lines: `sweep.ts` duplicates `capabilityKey()`;
  `invoke.ts` and `outcome.ts` duplicate decision reconstruction and timeouts;
  `route-bench.ts` retries around a client that already retries;
  `outcome.ts --agent` has one implemented value.
- Markdown, ≈ 100–150 lines: DESIGN's benchmark-arms section is stale; the
  usage sections repeat README; HANDOFF's tables repeat both; absolutes at
  DESIGN:5, 29 and HANDOFF:17 overstate what the benchmarks show.

**E9. Security hardening.**

Acceptance:
- Reports allow only MCP type, command, cwd, URL origin and env/header keys.
- Relayed MCP credentials stay in the library and server process, absent from
  agent argv, environment and session files. Library keys are validated.
- Public HTTP servers retain native Codex OAuth. Relays support credential-bearing
  URLs, negotiated protocol versions and recoverable request errors. Diagnostics
  contain controlled metadata only, never upstream error text. Windows shims and
  server startup logs work.
- MCP startup reads only its config; Claude MCP session files retain private modes.
- Skill copies reject links and retain pinned confinement and size limits.
- Third-party prompt data is escaped and framed; Jev errors contain only HTTP
  status or fixed failure categories. `decide()` and `bench/judge.ts` are unchanged.
- Adversarial tests for each path. Routing re-measured after the Jev framing
  change ([PR #7](https://github.com/erik-hedstrom/loadout/pull/7), "E9
  re-measure" in `bench/RESULTS.md`): decisions probably shifted a few points
  beyond run-to-run noise. The cause and the effect on quality are not
  identified. C1 re-establishes quality on new held-out requests.

**E3. Test split.**

Acceptance: `test/` holds one file per module, with shared fakes in
`test/helpers.ts`; the same tests still pass.

**E5. Releases.**

Acceptance: changesets or release-please, with a CHANGELOG generated from
PRs.

**E6. Architecture diagram.**

Acceptance: one SVG or Mermaid diagram of the routing pipeline and the
integration layers, readable in both light and dark themes.

## Iteration log

| Date | Merged | In flight | Spend (Jev / Claude / Codex) | Decisions needed |
|---|---|---|---|---|
| 2026-10-07 | Handoff written (HANDOFF, AGENTS with Code Review Rules, ORCHESTRATOR, BACKLOG, `.claude/agents/{worker,pr-reviewer}.md`, auto-compact 500k) | — | — | License, public timing, npm name, budget caps, hook default; cloud setup (ORCHESTRATOR.md §One-time setup) |
| 2026-10-07 (iter 1) | None: GitHub outage (Git, PRs, Actions) from 15:16 UTC; no CI run yet | E1 #2 (pr-reviewer APPROVE, Sol clean; waits for CI); E2 #1 (draft until E9); E9 (both reviews blocked it: server env reaches the agent process [High], credentials in args/URLs [High], conditional Jev framing [Med]; Sol on round 2); A2 #3 (draft; reviews running); E7 (Sol building judge backends) | Jev $0 / Claude: orchestrator + pr-reviewer runs (main usage) / Codex: 1 repo review, 5 builds, 3 reviews (ChatGPT plan) | Decided by Erik: Apache-2.0; full CI matrix on every PR; Node ≥ 22; Sol builds, Claude reviews. Open: enable private vulnerability reporting; hook default; npm name; going public |
| 2026-10-07 (iter 1, later) | None: no Actions run has ever been created for #2 (workflow present, Actions enabled); Erik asked to check billing or allow merging E1 on reviews + local green | #1 E2 draft (SECURITY.md to add: server-echoed credentials out of scope); #2 E1 approved by both, no CI; #3 A2 round 4 (pr-reviewer APPROVE r3, Sol found 3 Medium); #4 E9 round 4 (relay design accepted by both; declined Sol's payload-redaction High: relay stays transparent); #5 E7 round 3 (codex judge refuses on 0.160.1: unified_exec cannot be disabled; record as negative result); #6 B1 round 2 (nested-subset cap detection, `codex debug prompt-input` preflight) | Jev $0 / Claude: pr-reviewer rounds (main usage) / Codex: ~20 builds and reviews | Positioning: hosts cap listings (Claude Code 1% of context, names always listed; Codex 2% or 8,000 chars), so the headline becomes visibility + bounded cost, measured by B1. Owed after E9 merges: Jev-only agreement check of the framing change (≈ $0.5) |
| 2026-10-07 (iter 2) | E1 #2 (merged without PR CI at Erik's direction; the first main run was green on all 6 jobs), E7 #5, E9 #4, A2 #3, B1 #6, E2 #1, E9 re-measure #7 | D10 (Sol building the plugin and the hook-latency bench) | Jev $0.77 (two sweeps) / Claude: 16 haiku calls with rows plus ≤4 probes (B1), and pr-reviewer rounds (subscription) / Codex: about 12 builds and reviews (ChatGPT plan) | Decided by Erik: in-host first (D10), with the hook automatic through the plugin he installs. Findings: the Claude listing grows about 10 tokens per skill, so the 140k estimate is withdrawn; loadout's MCP tools cost more than 50 native skills; Jev is not deterministic (about 1 request in 13); decisions probably shifted across E9 (cause unidentified). Open: a security contact; B1 raw-row names before going public; a Windows-side `loadout init` or the Linux machine for D10's CLI check |
