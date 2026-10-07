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

## A. Adoption and ease of use

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| A2 | P0 | `loadout audit`: what your installed skills cost you | Claude | cloud | todo |
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

**A1. README rewrite.**

Acceptance:
- Above the fold:
  - the problem, with one measured number from B1;
  - what loadout does in one sentence;
  - a three-command quickstart (`npm i -g …`, `loadout init`, `loadout audit`
    or `loadout claude "…"`);
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
| B1 | P0 | Token-waste study: measured per-request overhead of popular skill packs | Claude | local (measure) + cloud (analysis) | todo |
| B3 | P1 | Fact-checked comparison with alternatives | Codex | cloud | todo |
| B2 | P1 | Launch kit drafts | Claude | cloud | todo (after A1, B1) |
| B4 | P1 | Repo polish: description, topics, social preview, badges | Claude | cloud + erik | todo |
| B6 | P2 | GitHub profile README draft | Claude | cloud | todo |
| B5 | P2 | Awesome-list and directory submissions (drafts) | Codex | erik | blocked: repo public |

**B1. Token-waste study.**

Why: the headline must be measured, not estimated.

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
- Starting point: 1,262 skills' descriptions are about 140k tokens; the top 50
  about 6.8k (HANDOFF).

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

## D. Integrations and robustness

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| D1 | P0 | Validate on the new native Linux machine | Claude | local | todo (machine pending) |
| D7 | P1 | `loadout doctor` | Codex | cloud | todo |
| D2 | P1 | Live Codex hook test | Claude | local + erik | todo |
| D3 | P1 | Desktop and IDE hosts end to end | Claude | local | todo |
| D5 | P2 | Isolation mode | Codex | cloud | todo |
| D4 | P2 | Gateway: native tools via `tools/list_changed` | Codex | cloud | todo |
| D6 | P2 | HTTP: cancellation reaches Jev | Codex | cloud | todo |

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

**D7. `loadout doctor`.**

Acceptance:
- Checks the key (presence and a live call), the library, the embedding
  index, configured hosts and CLI versions.
- Prints the fix for each failed check.
- Read-only.

## E. Engineering quality (what a reviewer of the repo sees)

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| E1 | P0 | GitHub Actions CI | Codex | cloud | todo |
| E2 | P0 | LICENSE, CONTRIBUTING, SECURITY.md, templates | Claude | cloud + erik | review |
| E7 | P0 | Bench judges and expander that run inside a cloud session | Claude | cloud | todo |
| E8 | P0 | Repo-wide simplification pass | Claude (pr-reviewer finds, worker fixes) + Codex review | cloud | todo |
| E3 | P1 | Split the test file per module | Codex | cloud | todo |
| E5 | P1 | Changelog and release automation | Codex | cloud | todo (with A4) |
| E6 | P2 | Architecture diagram in DESIGN.md | Claude | cloud | todo |

**E1. CI.**

Acceptance:
- Runs on push and PR: `npm ci`, build, typecheck, test.
- Matrix: Ubuntu, macOS, Windows × Node 20 and 24.
- No secrets needed.
- The badge goes in the README.

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

Why: the $100 credit pays for cloud sessions only (not the API, not
Routines), and C1/C3 need judging. `bench/lib.ts` judges through `claude -p`.

Acceptance:
- Check whether `claude -p` works inside a cloud session.
- If it does not, add a file-based mode:
  - `judge.ts` and `expand.ts` write batch prompts and read JSON answers;
  - an Opus subagent of the session produces the answers, with the catalog
    passed once per batch.
- An Anthropic API backend (`ANTHROPIC_API_KEY`, prompt caching) stays
  optional.
- Re-judging 40 v4 requests reproduces their verdicts within noise, and the
  cost is reported.

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
