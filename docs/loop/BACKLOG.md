# Backlog

The orchestrator keeps this file current. Statuses: `todo`, `in progress (PR #)`,
`review`, `done (PR #)`, `blocked: <why>`.

**Columns:**
- **P:** priority. P0 is the first iterations; P1 next; P2 later.
- **Agent:** suggested vendor. The other vendor reviews.
- **Lane:** `cloud` (needs no key or agent CLI, so a cloud session can do
  it), `local` (needs Erik's logged-in CLIs or apps, or the TypeSafe key),
  `erik` (needs Erik's decision or action).

Priorities follow the decision "Default CLIs first" in
[HANDOFF.md](../../HANDOFF.md#decisions-only-erik-can-make-ask-dont-assume):
launcher-only work is P2.

**Order of things:**
1. Drive the open PRs (listed under "In review" below) through the merge
   gate. Open findings come before new work.
2. MCP token cost (Erik, 2026-10-13: MCP servers take more of the context
   than skills): discovery through the search server (D15), the overhead
   study (B7), MCP start-up inside Codex's grace period (D17), and the items
   from the launch-readiness review, 2026-10-13 (B8).
3. loadout verified in both default CLIs: the Codex hook (D2), the hook's
   per-prompt cost (D11), the plugin opening what its hook routes to (D13).
4. Precision on new requests (C4).
5. A README that leads with the plugin and the hook (A1), then the demo (A5).
6. Launch.

## In review

These items' rows and detail sections arrive with their PRs, so they are
not repeated in the tables below. Delete a line here when its PR merges.
Each PR body's **Review state** section has the round-by-round record.

| PR | Item | State on 2026-10-22 |
|---|---|---|
| [#47](https://github.com/erik-hedstrom/loadout/pull/47) | C14 A/B pilot harness; adds B10 | final review round; explicit Codex effort is pinned and recorded; the clean Codex-only rerun needs a separately logged-in `CODEX_HOME` |

## A. Adoption and ease of use

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| A2 | P0 | `loadout audit`: what your installed skills cost you | Claude | cloud | done ([PR #3](https://github.com/erik-hedstrom/loadout/pull/3)) |
| A1 | P0 | README rewrite around the problem, 3-command quickstart, GIF | Claude | cloud | partial ([#28](https://github.com/erik-hedstrom/loadout/pull/28)): README merged; the GIF waits on A5 |
| A3 | P1 | `loadout init` wizard + starter packs | Codex | cloud | done ([#30](https://github.com/erik-hedstrom/loadout/pull/30)) |
| A4 | P1 | npm package under an available name + release workflow | Codex | cloud + erik | blocked: npm name decision |
| A5 | P1 | Demo recording (route, launch, hook) | Claude | local | todo (after A1) |

**A2. `loadout audit`.**

Why: this is the entry point for the audience, and the sentence people share
must be a measured one. B1 measured Claude Code's skill listing at about 10
tokens per skill: +477 input tokens at 50 skills and +12.3k at 1,232 (Haiku,
generated skill names, first call;
[RESULTS](../../bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)).

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
    plugin install from D10 or the Codex hook), with `loadout audit` as the
    way to see the problem first and `loadout doctor` to check the result;
  - the launcher (`loadout claude|codex`) in a later section, for
    benchmarks and power users;
  - a GIF.
- Everything else moves to `docs/` (hosts, MCP server, hook, security model,
  benchmarks).
- Every number links to `bench/RESULTS.md`.
- Verified by following it on a clean machine or container.
- Reviewed for honesty: the outcome pilot is mixed, so the README must not
  claim better results.

A1 learnings: keep the scope of B1's listing-cost measurement beside the
README headline, and use a source install until A4 settles the npm name.
Launcher, library, hook and MCP details belong in `docs/launcher.md`,
`docs/library.md`, `docs/hook.md` and `docs/mcp.md`; SECURITY.md and DESIGN.md
hold the security model and router. Keep C8's hook-only plugin results
distinct from the settings-hook-plus-search result: following injected text
and better outcomes remain not shown.

**A3. `loadout init` wizard and starter packs.**

Acceptance:
- Interactive when a TTY is present, flags otherwise.
- Sets up the key (env or file), offers starter packs (curated `loadout add`
  sets, e.g. "popular" = the top skills.sh sources, "documents", "security"),
  builds the index, and prints the `setup` snippet for the detected hosts.
- Never edits host configs.
- Completes in under 2 minutes, excluding downloads.

Learnings (2026-10-12):
- node:readline has no hidden input, and a terminal echoes what is typed, so
  the wizard never prompts for the key or its file; it points to
  TYPESAFE_API_KEY or `init --key-file`.
- No "popular" pack: the skills.sh top list (`bench/data/popular.jsonl`) is
  not committed, so nothing in the repo backs one.

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
- It shows `audit`, then a plain `claude` session in which the plugin's hook
  adds a skill the agent then uses.

## B. Positioning and launch (honest hype)

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| B1 | P0 | Token-waste study: measured per-request overhead of popular skill packs | Claude | local (measure) + cloud (analysis) | done ([PR #6](https://github.com/erik-hedstrom/loadout/pull/6); follow-ups under "Left" in its learnings) |
| B3 | P1 | Fact-checked comparison with alternatives | Claude | cloud | done ([#34](https://github.com/erik-hedstrom/loadout/pull/34); [docs/comparison.md](../comparison.md)) |
| B2 | P1 | Launch kit drafts | Claude | cloud | todo (after A1, B1) |
| B4 | P1 | Repo polish: description, topics, social preview, badges | Claude | cloud + erik | blocked: Erik applies settings and uploads the preview (drafts merged in [#33](https://github.com/erik-hedstrom/loadout/pull/33)) |
| B6 | P2 | GitHub profile README draft | Claude | cloud | blocked: Erik fills two placeholders and publishes (draft merged in [#31](https://github.com/erik-hedstrom/loadout/pull/31)) |
| B5 | P2 | Awesome-list and directory submissions (drafts) | Codex | erik | todo (repo public since 2026-10-12; agents draft, Erik submits) |
| B7 | P1 | MCP overhead study: what configured MCP servers cost per request, natively and through loadout | Claude | cloud (harness, done) + local (runs) | in progress: harness merged in [#38](https://github.com/erik-hedstrom/loadout/pull/38), with no ambient Claude plugins (2026-10-15 decision); live runs wait for Erik's approval of the estimate |
| B8 | P0 | Backlog items from the launch-readiness review, 2026-10-13, MCP token cost first | Claude | local + erik | todo (the review is private, on Erik's machine) |
| B9 | P1 | Savings from an adopted library: what a user saves after moving skills and MCP servers into loadout | Claude | local | todo (after B7) |
| B10 | P1 | B7: Claude 2.1.281's init lists `@builtin` plugins even with `--setting-sources ""` and a fresh config dir, so `plugins.length !== 0` (`bench/mcp-overhead.ts`, the "Claude init plugins must be empty" check) would refuse every B7 Claude run; ignore `@builtin` plugins as the A/B harness does (`isBuiltin` in `bench/ab.ts`) | Claude | cloud | todo. Seen on 2.1.281 by C14 in a free probe (`claude -p` with HTTPS_PROXY pointed at a closed port prints the init event and makes no model call); not reproduced by review, so confirm with the same probe first |

**B8. Items from the launch-readiness review.** The review (2026-10-13) is
private ([ORCHESTRATOR](ORCHESTRATOR.md#local-the-default)).

Acceptance:
- Each finding the orchestrator agrees with becomes a row here, with the
  smallest acceptance criteria that would fix it. MCP token cost comes first.
- Findings it disagrees with are listed for Erik with the reason.
- No quotation from the review in any public file, PR or comment.

**B9. Savings from an adopted library.** loadout only adds context: nothing
is pruned until the user adopts skills and MCP servers (`loadout audit
--adopt`) and disables the native copies. A savings claim must start from
that state.

Acceptance:
- Arms: the host with its native skills and servers, and the same host after
  adoption with the native copies disabled. Record both states (inventories)
  with the raw results.
- Per-request input tokens, cached and uncached, with B7's harness and its
  inventory checks.
- Preregistered in `bench/RESULTS.md` before any run.

**B1. Token-waste study.**

Why: the headline must be measured, not estimated.

Learnings: [PR #6](https://github.com/erik-hedstrom/loadout/pull/6) round 4 requires stable Claude ambient inventory beyond declared treatment additions and distinguishes its isolated baseline from Codex's ambient baseline (14 Claude calls; paid Codex deferred). Measured 2026-10-07: see "B1 results" in bench/RESULTS.md. The inventory guard stopped the first attempt when a synced plugin vanished between calls. Left: paid Codex (blocked on unified_exec); real skill names instead of generated ones; an arm between 50 and 1,232 skills; cost per 1,000 requests at list prices; cached multi-turn cost; the chart. The raw rows name Erik's ambient plugins and skills and went public with the repo (HANDOFF, decision 1). Pack MCP servers stay excluded: starting them runs downloaded code (AGENTS rule 5).

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

Learnings:
- 8 rows in `docs/comparison.md`, read 2026-10-12 and read in full again on
  2026-10-13; GitHub sources are pinned to a commit, live docs to the access
  date. The only head-to-head numbers are B1's
  (native listings against adding loadout's MCP server); the other loadout
  figures are quoted from RESULTS. toolsift's recall and token figures are
  its own, from its BENCHMARKS.md (not in RESULTS); the Wilson intervals on
  them, and on the agent-use and pilot counts, were computed for the page.
- `developers.openai.com` and `skills.sh` (including its audits page and API
  docs) were blocked from the cloud session. They were read locally on
  2026-10-16 and 2026-10-19. The Codex skills docs confirm the budget,
  `enabled = false`, `$` mentions and `allow_implicit_invocation`; the
  skills.sh audits page and API docs are summarized in the directory row (the
  two skills.sh Codex threads). The Claude Code tool-search section and the
  Codex config reference were re-read on 2026-10-19.
- "toolsift" is `abdulmunimjemal/toolsift`; other searches return
  unrelated review sites.
- Left: a measured comparison against Claude Code tool search and toolsift
  on the same MCP set; the Codex docs do not state the 1,024-character cap, the
  ordering, `include_instructions` or `prompt_visible`, which rest on the
  pinned source; B1's +546 for loadout's MCP server predates `find_tools` and
  is not remeasured.

**B4. Repo polish.**

Acceptance:
- Repo description and topics (Erik approves).
- A social preview image (an SVG source in `docs/brand/`).
- CI and license badges.
- A CHANGELOG.

Status: drafts in `docs/launch/repo-settings.md` (description, topics,
Settings steps), `docs/brand/social-preview.{svg,png}`, one badge line in the
README and `CHANGELOG.md` (Unreleased only). Left for Erik: apply the settings
and upload the preview.

Learnings:
- The CHANGELOG has no version section while A4 (npm) and E5 (release
  automation) are open.

**B6. Profile README.**

Acceptance: `docs/launch/profile-README.md` for github.com/erik-hedstrom,
presenting loadout and the engineering behind it (benchmarks, reviews,
cross-vendor agents). Erik publishes.

Learnings: links use absolute URLs, because the file is copied into another
repo. Headline numbers are C1's untuned ones, with Wilson intervals. No run's
judging is shown to be cross-family: C1's request provenance is unverified,
and v4's requests were expanded by Sonnet and judged by Opus. Left: Erik
writes the personal line and publishes.

**B7. MCP overhead study.**

Why: Erik reports that MCP servers take more of his context than skills, and
nothing in RESULTS measures MCP overhead. B1 measured skill listings and
+546 tokens for loadout's own tools, but did not record whether tool search
deferred them. A user's cost depends on the host and its settings:
- Claude Code defers MCP tool definitions by default (names and server
  instructions load). It does not with a non-first-party `ANTHROPIC_BASE_URL`,
  on Microsoft Foundry, with older Google Cloud models, or with
  `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`. `ENABLE_TOOL_SEARCH` can be true,
  false, auto or auto:N (code.claude.com/docs/en/mcp, "Configure tool search").
- Codex defers MCP tools when the model's `supports_search_tool` is set. Source:
  openai/codex `codex-rs/core/src/tools/spec_plan.rs` (deferred exposure only
  when `model_info.supports_search_tool`) and `codex-rs/features/src/lib.rs`
  ("MCP tools are always deferred when tool_search is available"), at commit
  cf0ed4c (main, 2026-10-13). That is not the installed 0.160.1, so the pilot
  has to confirm it.

Two baselines per configuration, because both exist in practice: every schema
loaded (hosts or models without tool search; `ENABLE_TOOL_SEARCH=false`), and
the host's tool search on (the cost is the loaded share, the deferred-name list
and the server instructions).

One user's observations, not a benchmark result: `/context` in two of Erik's
Claude Code sessions showed 292 MCP tools totalling 230.8k tokens with 12.4k
loaded and 218.1k deferred, and 180 tools totalling 163k with 20.4k loaded and
142.6k deferred. What `/context` counts as loaded was not verified. The host
already defers most schemas here, so a saving from loadout's gateway has to be
shown against the deferred baseline, not the all-loaded one.

Built: `bench/mcp-fixtures.ts` and `bench/mcp-fixture-server.ts` (deterministic
stdio servers shaped like an issue tracker, a database, a browser and a docs
server, written for this repo), `bench/mcp-overhead.ts` (harness, on B1's
isolation and parsers in `bench/overhead.ts`), `test/mcp-overhead.test.ts`.
Arms, configurations, controls and what each flag does:
[RESULTS, "B7 method"](../../bench/RESULTS.md#b7-method-not-run-yet-what-configured-mcp-servers-cost-per-request).
The files a `--run` writes in the host homes are printed by the plan
(`hostWrites()` in the harness), resolved for the environment it runs in.

loadout's own fixed cost counts in the gateway arms: its tool definitions plus
server instructions. Fixture facts from `--offline`: with library servers it
registers 4 tools (2,827 to 3,096 characters of definitions with 1 to 20
servers, since `server_tools` lists the server names) and 424 characters of
instructions; the servers' own definitions (8,012 / 81,434 / 355,934
characters for n1 / n5 / n20) stay behind the gateway. These are characters,
not tokens and not results.

Acceptance:
- Raw rows under `bench/results/<timestamp>-b7-mcp-overhead/` and a RESULTS
  entry ("B7 results") with ranges where the sample allows (two sessions per
  arm: ranges, not intervals) and "not shown" where it does not. A folder with
  an `INCOMPLETE` file is a run that stopped: delete it.
- Both baselines reported for every configuration, and for each Claude arm
  whether tools looked deferred, from the init tool list and a canary lookup.
  Neither host reports deferral directly; for Codex it is "not shown".
- Not claimed without a measurement: any MCP saving, any Codex second-turn
  number, and the cost of using the gateway (find, list, call turns).
- The pilot confirms what the harness could not check here: Claude
  `--input-format stream-json` with the isolated flags, `--max-turns` per
  stdin message, token login on an empty config directory and the listing in
  `init.tools`; Codex `-c mcp_servers`
  surviving `--ignore-user-config` (the n1 delta over the baseline), and the
  `app-server` inventory listing without a login on an empty `CODEX_HOME`.

How to run locally (Claude needs `CLAUDE_CODE_OAUTH_TOKEN` for Erik's personal
subscription; Codex needs its subscription login; the children get an allowlisted
environment, so base-URL, provider
and API-key variables do not reach them):

```bash
npx tsx bench/mcp-overhead.ts --offline          # characters per arm, $0, no CLI
npx tsx bench/mcp-overhead.ts                    # plan, argv, env, host-state writes, estimate; $0
npx tsx bench/mcp-overhead.ts --run --hosts claude --configs n1 --repeats 1    # Claude pilot 1: argv and formats
npx tsx bench/mcp-overhead.ts --run --hosts claude --configs n20 --repeats 1   # Claude pilot 2: is ToolSearch listed?
npx tsx bench/mcp-overhead.ts --run --hosts codex --configs n1 --repeats 1     # Codex pilot
npx tsx bench/mcp-overhead.ts --run              # all arms, after approval
```

Estimate (not observed; Erik approves before `--run`, ORCHESTRATOR budgets
apply): 46 runs, 174 paid requests. Claude: 32 runs of 2 measured requests, and
24 of them also a canary lookup bounded by `--max-turns 4` (160 in all); Codex:
14 runs of 1 (only if the free preflight passes). B1 used about 8.5k input
tokens a call (136k over 16), measured with `--tools Skill`; B7 keeps every
built-in tool, so the low figure probably undercounts and the pilots calibrate
it. Low 1.5M input tokens if tool search defers everything, high 6.1M if every
arm loads all definitions on every request (an assumed 3 characters a token);
the high figure is built on the same base, so it is not an upper bound, and
Claude pilot 1 is the calibration.
Subscription quota, no Jev. Time about 87 minutes at an assumed 30 s a request,
at most 204 (102 stdin messages at the 120 s cap each). Claude pilot 1: 28
requests, 0.24 to 0.29M tokens, 14 to 32 minutes. Claude pilot 2 (n20): 28
requests, 0.24 to 1.93M tokens, 14 to 32 minutes. Codex pilot: 3 requests,
0.03M tokens, 2 to 6 minutes.

Isolation, and where it stops. The plan prints `LOADS`, `HOST STATE`, `ENV` and
`PRECONDITION` lines; sources are in the code docblocks.
- Env: every CLI child (paid and free, app-server included) gets a per-host
  allowlist, not the parent's environment (`envAllowlist()`); API keys, base
  URLs and `DEBUG` never reach a child. Claude also runs with updates off, auto
  memory, CLAUDE.md files and managed skills off, and MCP servers scrubbed of
  credentials, per the `claudeEnv()` docblock; Codex has no update check in
  `exec` or `app-server`. B1 is unchanged and still inherits the environment.
- Decided by Erik, 2026-10-15: no ambient Claude plugins; every run gets a fresh
  empty `CLAUDE_CONFIG_DIR` under the work root and requires `CLAUDE_CODE_OAUTH_TOKEN`
  from the environment, passed only at launch. Init must report `plugins: []`;
  missing, malformed or non-empty plugin inventories refuse the measurement,
  without enumerating plugin locations.
- Managed configuration overrides `--settings` and `--ignore-user-config`, and
  its system files are refused (`hostState()`). Claude's unused user caches are
  excluded by the fresh home; live server-managed settings and policy limits
  remain an unchecked precondition. Any instruction, rule, skill or config file
  in a folder above the temp working directory is also refused: the run's own directory is
  fresh, but its ancestors (`/tmp` and up) are not ours, so they are checked
  instead, and `assertTemporary` cannot enforce that.
- Claude settings, history and plugins move under `CLAUDE_CONFIG_DIR`
  ([env-vars](https://code.claude.com/docs/en/env-vars), variable row).
  Relocation of `~/.claude.json` bookkeeping and the MCP log cache is unverified;
  both remain listed as possible host writes.

Host state the runs load: `hostState()` is the one list, with a decision and a
source per item (refuse, neutralise with a flag, identical across arms and
recorded, needed, or not checked); neutralised items have argv or env tests.
"Identical across arms" means the baseline delta cancels it, not that absolute
input tokens are free of it; the rows are for the delta. Nothing checks the
paid Codex exec's MCP set at run time. B1's Codex commands lack
`--ignore-user-config`; revisit before running them.

Decisions for Erik:
- Approve the pilots, then the full run, with the host-state writes and the
  preconditions the plan prints. `--run` is the approval; there is no
  confirmation flag.
- Whether to move Codex host state out of the real home. This option is
  verified only in source or docs, not implemented, and **switches the cost
  from subscription quota to API cash**: Codex with a temporary `CODEX_HOME`
  (it must be an existing directory, `codex-rs/utils/home-dir/src/lib.rs`) and
  `CODEX_API_KEY`, which `codex exec` honors for model requests
  (`codex-rs/exec/src/lib.rs`, `enable_codex_api_key_env: true`, cf0ed4c), so no
  credential file is written, config.toml is absent and logs stay in the temp
  directory. This was not run here.
- The free Codex commands run on empty temporary `CODEX_HOME`s, so `debug
  prompt-input` no longer sees the user's global `AGENTS.md` (read from that
  home, `codex-rs/cli/src/main.rs`). The paid exec still does, in every arm; the
  preflight records the built-in context only, and nothing re-checks it at the
  end. Accept, or supply the Codex key option above.
- Whether the Codex arms wait for `unified_exec` as in B1.

## C. Skill decision-making (router quality)

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| C1 | P0 | New held-out request set + re-measure v4 | Codex (seeds, expand) + Claude (judge) | local | done ([#16](https://github.com/erik-hedstrom/loadout/pull/16)): precision falls on new requests (64% vs 82%); judged through local `claude -p`, not the API (see Learnings) |
| C2 | P1 | Outcome eval on the small tier with fixed fixtures | Claude (design) | cloud (fixtures) + local (runs) | in progress (fixtures and protocol merged in [#37](https://github.com/erik-hedstrom/loadout/pull/37), decisions made 2026-10-19; Console and Jev key open before the run (E14 done, #53); runs local) |
| C3 | P2 | Does Jev pick a sensible model tier? | Claude | cloud | todo (launcher only: the hook and search keep the user's model) |
| C4 | P0 | Demote generic "fits everything" skills | Codex | cloud | todo (next: C1 shows over-loading on general business requests) |
| C5 | P2 | Retrieval beyond 200 candidates (Jev tournament) | Codex | cloud | todo |
| C6 | P2 | Multi-intent requests | Claude | cloud | todo |
| C7 | P1 | Recommended packs with measured upside (first: frontend with Impeccable) | Codex (harness) + Claude (runs) | cloud (fixtures) + local (runs) | todo (after B1, C2) |
| C11 | P1 | `bench/outcome.ts` keeps per-request usage | Codex | local | partial ([#55](https://github.com/erik-hedstrom/loadout/pull/55)): turn totals and crash-safe capture; request usage moved to F2 |
| C12 | P1 | Audit the need gate on held-out prompts | Claude | cloud (design) + local (runs) | done ([#46](https://github.com/erik-hedstrom/loadout/pull/46)): audited on C1 dev, no change ([RESULTS](../../bench/RESULTS.md#c12-2026-10-19-the-need-gate-on-c1-dev)) |
| C13 | P1 | Pure-Jev baseline on main: offline scoring and routing stability | Codex (tools) + Claude (runs) | local | done ([#45](https://github.com/erik-hedstrom/loadout/pull/45)): baseline measured 2026-10-16 ([RESULTS](../../bench/RESULTS.md#c13-2026-10-16-pure-jev-baseline-on-main)) |
| C8 | P0 | Skill use with the hook-only plugin | Claude | local | done ([#25](https://github.com/erik-hedstrom/loadout/pull/25)): headless, the hook injected a skill's text in 6 of 10; Claude opened 0 of 10, none of the 4 it was only pointed to (D13) |
| C9 | P1 | Host-model fallback router when there is no TypeSafe key | Claude (design) | cloud (code) + local (bench) | todo |
| C10 | P2 | Bench quick fixes: sequential outcome judge, tier fixed across arms, stale A2 number | Claude | cloud | done ([#40](https://github.com/erik-hedstrom/loadout/pull/40)) |
| C14 | P1 | A/B pilot: three prompts with and without loadout in the stock CLIs, tokens (cached apart from uncached) and quality | Claude (harness) + Erik (runs) | cloud (harness) + local (runs) | review ([#47](https://github.com/erik-hedstrom/loadout/pull/47)): harness, plan and tests done; explicit Codex effort and resume checks added, reviews addressed (resume refuses other settings or a batch-stopping row; credentials and keyword-routed loadout runs stop the batch, as RESULTS "What stops the batch" defines); the paid pilot has not run (needs `CLAUDE_CODE_OAUTH_TOKEN` and the TypeSafe key in a key file, from WSL) |

**C13. Pure-Jev baseline without more model spend.**

Why: Erik approved measuring a pure-Jev baseline before more Claude/Codex
spend (2026-10-16).

Acceptance: `bench/judge.ts --offline --blind-from <dir>` reuses blind answers
and per-skill ratings from repeated `--verdicts-from <dir>` sources through
the existing scorer, rejects changed request texts, and reports unrated loads
with precision bounds and Wilson intervals by dev/test split.
`bench/stability.ts <dir> <dir> ...` reports per-run fallbacks, latency and
cost, plus identical-set shares and pairwise Jaccard for loaded and
loaded-or-offered sets by split. Small fixture tests require no key, network
or model calls. Cost: $0.

Learnings ([RESULTS](../../bench/RESULTS.md#c13-2026-10-16-pure-jev-baseline-on-main)):
- Main at 155d7ec routes within the intervals of the earlier runs on both
  request sets and on the gold tasks; 1 keyword fallback in 1,815 decisions.
- About 1 request in 10 gets a different loaded set on an identical rerun.
- Pooling v4's four earlier judgings fails: the judge rated the same request
  and skill differently in two of them, so offline v4 scores use the post-E9
  control's ratings only.
- Offline scoring cannot show misleading loads it has no rating for, so a
  drop in misleading loads is "not shown" until those loads are judged.
- `judgeSweep(args)` and `stabilityReport(dirs)` are the entry points; the
  scripts that ran the burn and the scoring are committed with the results.

**C1. New held-out requests.**

Acceptance:
- 300 new seeds from a model that never saw the library (with a seed
  different from v4's), expanded as before.
- Judged blind with the full catalog through the API (E7).
- v4's rule reported on all of them **without retuning**, next to the v4 test
  numbers.
- If they differ a lot, find out why. These requests become the new tuning
  set; keep a third untouched.

Learnings ([#16](https://github.com/erik-hedstrom/loadout/pull/16),
[RESULTS](../../bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)):
- On new requests recall held (73% useful loaded) and precision fell (64%
  of loads useful, 7% misleading, against 82% / 1% in v4). General business
  requests carry most of the drop.
- Codex both wrote and expanded the requests, so the Opus judge stays
  cross-family. v4 had Sonnet expansions judged by Opus. The Codex
  expansions are shorter (median 100 words against 199).
- `--backend codex` cannot run tool-less on codex-cli 0.160.1 (E12). The
  files backend with a committed producer script stands in for inputs
  without third-party text.
- Jev can slow down for minutes: the first sweep lost a third of its rows to
  the keyword fallback. Check the fallback count before judging a sweep.
- The split, stricter than "keep a third untouched": tune on C1 dev (99)
  and on v4's 315; C1 test (201) stays untouched for reporting.
- The judge ran through local `claude -p`, as in v4, not through the API path
  that acceptance names (E7 has no Anthropic API backend).

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

Learnings (cloud half): [fixtures and protocol](../../bench/fixtures/c2/PROTOCOL.md).
- A harness gateway that held the keys would intercept the agent's API
  traffic, which AGENTS.md rule 1 forbids, so the protocol has none. Each arm
  calls the vendor directly with a workspace key under a monthly spend limit.
  A skill can tell `claude` to read a key and send it to Jev through a
  pre-approved `find_tools` call, which runs outside the Bash sandbox, and
  revoking later cannot undo that. So the primary layer is that the agent cannot
  read a key: files denied to the Bash sandbox, Read, Grep and Glob fenced to the run
  folder, `apiKeyHelper`, a fresh `/proc` for `Bash`, and a canary probe in the smoke run. Redaction before Jev is
  E14, a prerequisite for the loadout arm; the workspace is archived before any
  output is scanned, judged or committed:
  [Credentials and spend](../../bench/fixtures/c2/PROTOCOL.md#credentials-and-spend).
  `enableWeakerNestedSandbox` is prohibited: it exposes `/proc` to `Bash`, and
  permission rules do not stop a Python or Node child. Where bubblewrap cannot
  mount `/proc`, use a VM.
- The library, config and sessions are denied to Bash and file tools; skills
  load through MCP, while the hook retains its framed injection. Folder hints
  remain a stated limit. D18 is not a C2 prerequisite: probes must show the
  hints cannot enable raw reads, and failed attempts count toward outcomes.
- What that gives up (refusal before the fact, a hard per-run limit, a record
  of the pins the agent cannot reach, per-run vendor cost) is listed in
  [PROTOCOL.md](../../bench/fixtures/c2/PROTOCOL.md#given-up-compared-with-a-harness-gateway).
  Spend is the vendor's usage for the key, checked against the stream to 5%.
- The score is S = 0.5 + (W - L) / (2n) over all paired tasks, with a Tango
  score interval (`bench/c2-score.ts`) and a margin of 0.05 (Erik, 2026-10-19).
  With 14 pairs, the fewest wins that reach "match" is 3, with no loss (lower
  bound 0.476), and two wins and 12 ties stay "not shown" (0.448); the decisive-pair rate is
  secondary ([Analysis](../../bench/fixtures/c2/PROTOCOL.md#analysis)).
- The documented env switches turn off compaction, the non-streaming fallback,
  the 1-hour cache TTL and the background title request in all arms, and every
  delegation tool is denied. Every `invalid` run halts the plan (all arms) for
  Erik to classify. Approvals are (n - 1) x high + ceiling, about $78 (Haiku
  5.5), under one shared stopping rule: see
  [Arms](../../bench/fixtures/c2/PROTOCOL.md#arms) and
  [Expected spend](../../bench/fixtures/c2/PROTOCOL.md#expected-spend-local-run).
- Raw results are committed after a secret scan and a paths and usernames scan,
  and Erik reads the folder before any push
  ([What is committed](../../bench/fixtures/c2/PROTOCOL.md#what-is-committed)).
- Decided by Erik (2026-10-19): the full protocol; a VM with the Bash sandbox
  inside it; Haiku 5.5 and Sonnet 5.5; approvals of about $78 and 27 h; the 0.05
  margin; a licence check of the loaded skills before any push; the shared prompt
  cache accepted as a limit. Still open before the run: the Anthropic Console organization and
  workspaces (and who archives them), the dedicated Jev key and whether Jev
  reports usage per key (E14 is done, #53)
  ([Decided by Erik](../../bench/fixtures/c2/PROTOCOL.md#decided-by-erik-2026-10-19)).

**C3. Tier choice.**

Acceptance:
- On C1's requests, a judge rates whether small / medium / large fits each
  request.
- Compare with Jev's choice (confusion matrix).
- Estimate the cost difference against always-large.

**C4. Demote generic skills.**

Example: `frontend-ui-engineering` loads on simple UI work the judge says
needs nothing.

From C1, to test on C1 dev:
- whether a generic skill adds an action-specific procedure for this request;
- whether a close-comparison winner fits the framework or service the
  request names.

C1's non-useful loads came from both paths, the winner and P(exact).

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

**C11. Per-request usage in outcome runs.** `bench/outcome.ts` records
totals per task. Prompt-cache misses inside a session are then invisible.

Acceptance: each request's input, cached input and output tokens go into the
raw results, from the host's own usage report (no proxy, AGENTS.md rule 1),
with a test on a recorded fixture.
Learnings (2026-10-22; partial):
- `exec --json` in Codex CLI 0.163.0 reports turn totals, not per-request
  usage. Outcome runs retain these totals and preserve deliverables and
  metadata even when usage JSONL is truncated. Host stdout is not persisted
  because command output and messages can contain private data.
- Claude Code 2.1.306's `result.usage.iterations` describes sampling within
  the last request, not all session requests. Judge calls retain only
  `result.usage` totals. Missing or invalid usage records a contents-free
  `usageError` without rejecting a valid answer. Usage stores only token
  totals or null. See [capture provenance](../../test/fixtures/request-usage/README.md).
- Rollout discovery is deferred: `materialize()` creates loadout session
  files, not a Codex home; `codexArgs()` sets no home; `outcome.ts` calls
  `run()` without an environment override, inheriting `CODEX_HOME`. Reading
  that home could read user sessions, so this change does not do so.
- Erik can choose a follow-up using app-server `thread/tokenUsage/updated`
  or rollout `token_count` / `last_token_usage` from a benchmark-owned home.
  Neither path is implemented here; the limit observed here is `exec --json`,
  not every official Codex output format.

**C12. The need gate.** In one local Codex run (2026-10-13) the gate
selected nothing on a task where a library skill plainly applied. One case
proves nothing, and that task is now used, so it is not a tuning input.

Acceptance: rate need on C1's dev split against the judge's labels; report
false "no skill" decisions with Wilson intervals; change the threshold or
the question only if dev shows a gain, then report on C1 test.

Learnings ([RESULTS](../../bench/RESULTS.md#c12-2026-10-19-the-need-gate-on-c1-dev)),
`bench/need-audit.ts`, $0:
- Replaying `decide()` on stored answers needs no new Jev run: it matches the
  stored loads in 396 of 396 dev rows (4 sweeps × 99).
- At 0.5 the gate says "no skill" on 17% of the judge's helpful-or-essential
  rows (30/176, 12–23%) and on 0 of 32 essential ones. The 7 requests quiet
  in every run are all "helpful", with mostly generic useful skills.
- `need` is stable across reruns (median range 0.017) but weakly separates
  the labels (AUC 0.72; median 0.52 for none, 0.66 for helpful).
- No change: threshold 0.4 gains a useful load on 4 requests of 44 and loses
  none (sign test p = 0.125), so it is not shown to help; C1 test not scored.
- Not shown: misleading loads, and the effect on what is offered.

**C8. Skill use with the hook-only plugin.** RESULTS has 6 of 10 for the
search tool plus the hook, and 2 of 10 for the search tool alone. The plugin
users install has the hook only. Add a plugin arm (`--plugin-dir`) to
`bench/invoke.ts` and run the same 10 requests.

Acceptance: a third row in that RESULTS table, with raw results. The README's
"has not been measured" is then replaced by the number.

Learnings (2026-10-12, [#25](https://github.com/erik-hedstrom/loadout/pull/25)):
- **Injected 6, opened 0.** The hook added `<skill_relevance>` context on all
  10 prompts and injected one skill's full text in 6. Claude opened no skill.
  On the 4 where it was only pointed to one, the context names `load_skill`,
  which the plugin lacks, or the library folder, which a headless run may not
  read (probe: "requested permissions to read … but you haven't granted it
  yet"). The 6 of 10 arm opened skills on those same 4 through the MCP
  server's `load_skill`. Interactive sessions would prompt instead: not
  measured. Next: D13.
- The first write-up counted only opens and missed the injections, which sat
  in hook text that the privacy redaction then dropped. Rows now list the
  injected skill names per hook (Sol's review caught it). The committed rows
  predate 2419a22, so they still carry `hookEventCount`, `hookContext` and the
  hook's `event`, which current `bench/invoke.ts` no longer writes.
- The bench took six review rounds to measure the right thing. Skill context is
  not an execution counter (a hook legitimately returns nothing). A PATH shim
  the bench owns counts invocations, plus a `context` mark for invocations
  that returned context. A marker in the agent's folder changed both the task
  and the hook's routing input. A run that fails before the model answers
  (expired login, `is_error` at $0) used to read as a miss.
- Under WSL the `claude` we start is a launcher script: PATH stays a Linux
  list and `WSLENV=PATH/l` translates it. Mocked tests passed with the wrong
  form; only a real run showed it.

**C9. Host-model fallback router when there is no TypeSafe key.**

Why: Erik (2026-10-12) wants routing to keep working without a TypeSafe key,
using a small host model (Claude Haiku 5.5, or Codex's small Luna model), with
a warning that loadout is not fully set up (D16).

Constraints:
- Official CLIs only (`claude -p`, `codex exec`), never proxying (hard rule 1).
- It costs the user's subscription quota and adds a CLI start to every prompt,
  so it is off by default.
- The nested `claude -p` must not trigger loadout's own hook again: strip
  settings and plugins as `claudeJson()` in `bench/lib.ts` does. It gets no
  tools.
- Skill names and descriptions sent to it go through `escapeSkillTags`, with
  third-party framing.

Design note: Jev returns probability distributions, and the thresholds were
tuned on those. A host model returns picks, so it needs its own selection
rule, not Jev's thresholds.

Acceptance:
- A `router: "host"` (or similar) backend behind an explicit config switch.
- Measured against the lexical router on the dev split (choose by quota cost,
  report on test), with Wilson intervals, and the hook's latency measured.
- README and docs claim nothing until RESULTS has the numbers.

**C10. Bench quick fixes.** From the launch-readiness review, 2026-10-13. $0,
no paid calls.
- `bench/outcome.ts` judged two requests at once; AGENTS.md rule 6 says judges
  run sequentially so their cached prompt stays warm. Now a loop, with a test
  that runs the script against a stand-in `claude` and checks the calls never
  overlap.
- `decisionFor` keeping the row's tier for the bare arm is correct: both arms
  of a pair run the same model (`gpt-6.1-sol` in all 8 pilot pairs). Comment and test only.
- A2's rationale quoted the withdrawn description-sum estimate; it now
  carries B1's measured figures and scope.

Learnings: a script that spawns the CLIs can be tested by putting a fake
binary alone on `PATH`, so the `claude` judge needed no new seam.

**C14. A/B pilot.** Erik, 2026-10-19: test three prompts with and without
loadout, evaluate the output and compare token use; he asked about tokens in,
their effect on caching and output quality, and a small Codex A/B he ran
showed problems. `bench/ab.ts` runs it on the stock CLIs the way a user
installs loadout: the plugin and MCP server in Claude Code, the MCP server and
hook in Codex. Method, selection rule and caveats:
[RESULTS](../../bench/RESULTS.md#c14-method-not-run-yet-three-prompts-with-and-without-loadout).

`npx tsx bench/ab.ts` (plan, $0), `--run [--repeats 2] [--hosts claude,codex]
[--ids a,b] [--out <dir>]` (resumable; `INCOMPLETE` until judged),
`--judge-only <dir>`.

Acceptance:
- One script records, per run, tokens **per model request** from the host's own
  report (Claude: each assistant message's usage, deduplicated by message id;
  Codex: `exec --json` reports only a thread total, so one entry per run), with
  uncached input, cache writes, cache reads and output apart everywhere, plus
  cost, turns, time, tools (loadout's named), skills opened, the hook's context
  size and the skill names it listed or injected, and the `c1-debug-13` hidden
  test result. This closes C11's acceptance for the harness, with fixture tests.
- The cold cache does not skew the arms: one recorded warm-up per host and arm,
  excluded from comparisons and reported as the cold start; measured runs
  interleaved with the first arm alternating; a request gap over 5 minutes flags
  `coldCacheRisk`; request 1 is reported apart from requests 2+.
- Validity stops the batch: the loadout plugin present exactly once in the
  loadout arm and absent in bare, no other plugin, the hook run once (loadout) or
  never (bare), the loadout MCP server connected, the model as requested, no run
  failed before the model; a loadout arm that routed by keyword (no key reached
  it, or Jev failed); a credential, or something shaped like one, in a run's
  folder (nothing is copied). A study folder is not resumed with other settings
  or past such a row.
- Blind pairwise judging in both orders, cross-family (Sol judges Claude's
  outputs, Opus judges Codex's), skill names removed from both arms' files.
- `report.md` per host, arm and prompt, with the loadout − bare difference.
- Tests with no network and no paid call, `$0` to build and plan. The paid pilot
  is below.

Estimate for the paid pilot (the plan prints it, with its assumptions): 28
runs (4 warm-ups), Claude at most 420 requests and Codex 14 thread totals,
about 1 to 3 hours, subscription quota; Jev about 14 routing calls (under
$0.05); 24 judge calls (Opus and Sol quota). Needs Erik: the Claude
subscription token, the TypeSafe key in a key file (`loadout init --key-file`), a
Linux shell (WSL), and a go-ahead.

Learnings (2026-10-19):
- `claude -p` with a black-holed proxy and a fresh config directory runs the
  prompt hook and prints the init event before any model call, so the stream
  fixtures, the plugin loading under `--setting-sources ''` and the PATH shim
  are checked for free. The init lists the built-in `agents-md` plugin
  (`source: agents-md@builtin`) even with no plugin: **B7's "init plugins must be
  empty" check would refuse every Claude run** (B10). `ab.ts` ignores `@builtin`.
- `codex exec --json`'s `turn.completed.usage` is the thread's running total,
  not the last request's (`usage_from_last_total`). Per-request Codex usage
  needs the app-server, a different integration.
- Claude Code writes one assistant event per content block, all with the same
  message id and usage; and a `<synthetic>` assistant message with zero usage
  for a login failure. Both are handled and tested.
- `--restricted`, which B7 uses, removes the code-running tools; the pilot's
  agents need them, so `claudeIsolation` takes `restricted: false`.
- Codex's `--dangerously-bypass-hook-trust` would also run an ambient
  `$CODEX_HOME/hooks.json`, which `--ignore-user-config` does not skip: the
  plan blocks the Codex hook arm if one exists.
- The working folder is one fixed path for every run (emptied each time),
  because both hosts put it in the prompt and a different path per run would
  break the shared cache prefix.

Learnings (2026-10-26):
- Codex effort is part of the persisted study settings and printed argv; changing or removing it refuses resume. The pilot pins medium explicitly because the model default is not a study setting.
- The harness accepts the nine named effort levels in codex-cli 0.163.0; custom model-defined strings are outside this study interface.

Learnings (2026-10-20):
- **The first Codex pilot (2026-10-20, at e9d7239) is confounded.** Codex loaded
  `$CODEX_HOME/AGENTS.md` (Erik's global instructions, via a symlink) into every
  run of both arms; `--ignore-user-config` and `--ignore-rules` do not skip it.
  The loadout agent's own `find_tools` query repeated a line from it, and a
  skill name from it appears in all four `c1-debug-13` streams. Its numbers
  cannot be read as loadout against bare. Codex reads `AGENTS.override.md`, then
  `AGENTS.md`, from `CODEX_HOME` and uses the first non-empty one
  (`codex-rs/codex-home/src/instructions/mod.rs` at rust-v0.160.1); `ab.ts` now
  refuses the study if either exists (a symlink counts), and the file has to be
  moved aside for a run. B7 records the same file as "identical across arms"
  (`hostState`): a token-delta baseline cancels it, so B7 is left as is, but a
  study of what the agent does is not.

Left: run the pilot (Erik's go-ahead), write the results into RESULTS and
`report.md`, and decide whether two repeats are enough to say anything.

## D. Integrations and robustness

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| D10 | P0 | In-host first: loadout as a Claude Code plugin (hook), CLI then desktop app | Codex | cloud + local + erik | blocked: desktop app check (Erik). Plugin merged in [#9](https://github.com/erik-hedstrom/loadout/pull/9) |
| D11 | P0 | Cut the hook's per-prompt start cost | Codex | cloud + local | in progress ([#14](https://github.com/erik-hedstrom/loadout/pull/14), [#24](https://github.com/erik-hedstrom/loadout/pull/24) merged: the hook's new process p50 1,781 → 1,543 ms, scan 136 → 22 ms, [RESULTS](../../bench/RESULTS.md#routed-prompts-with-the-library-scan-cache-d11-2026-10-12)); left: time the new process's own Jev steps, and the embedding model load (needs a long-lived process: Erik decides) |
| D1 | P0 | Validate on the new native Linux machine | Claude | local | todo (machine pending) |
| D7 | P1 | `loadout doctor` | Claude | cloud | done ([#20](https://github.com/erik-hedstrom/loadout/pull/20)) |
| D2 | P0 | Live Codex hook test | Claude | local + erik | todo (needs Erik to trust the hook in `/hooks`) |
| D3 | P2 | Desktop and IDE hosts end to end | Claude | local | todo (generic MCP only, 2026-10-12) |
| D5 | P2 | Isolation mode | Codex | cloud | in progress: Claude MCP servers hidden ([#32](https://github.com/erik-hedstrom/loadout/pull/32), merged); plugin hooks, skills and mods disclosed for now and settings files kept (Erik, 2026-10-19); left: hiding plugins (deferred, e.g. `enabledPlugins` false for each installed plugin and `syncClaudeAiPlugins` false in the session settings), the live check, and the README's reason for not using `--setting-sources` should name the user's hooks, permission rules and settings `env` (it says permissions and model; loadout always passes `--model`); interactive Codex cannot be hidden |
| D4 | P2 | Gateway: native tools via `tools/list_changed` | Codex | cloud | todo |
| D6 | P2 | HTTP: cancellation reaches Jev | Claude | cloud | done ([#19](https://github.com/erik-hedstrom/loadout/pull/19)) |
| D8 | P1 | Host capability matrix (verified vs generated) | Claude | cloud | done ([#18](https://github.com/erik-hedstrom/loadout/pull/18)) |
| D9 | P1 | Codex parity: neutral session skill dir, tier presets | Claude | cloud | done ([#21](https://github.com/erik-hedstrom/loadout/pull/21)); Codex launch not re-run live |
| D15 | P0 | MCP discovery: make library MCP servers findable and usable through the search server | Claude | cloud + local | in progress: code and tests merged in [#39](https://github.com/erik-hedstrom/loadout/pull/39); the live check is left |
| D17 | P1 | `loadout mcp` ready within Codex's MCP start-up grace | Claude | local (measure) + cloud (fix) | done ([#43](https://github.com/erik-hedstrom/loadout/pull/43)): WSL install advice in the README; `required = true` in the `--windows` TOML, not in the plugin (see below); measured 2026-10-15: under 1 s from ext4, 6–7 s from `/mnt/c` |
| D12 | P0 | Codex: install the hook and search as one step, if Codex allows it | Codex | local | done ([#23](https://github.com/erik-hedstrom/loadout/pull/23)): `plugins/loadout-codex` through `.agents/plugins/marketplace.json`; install checked offline; the hook still needs `/hooks` trust; the live run is D2 |
| D13 | P0 | The plugin must be able to open what its hook routes to | — | cloud + local + erik | blocked: design decision (Erik) |
| D14 | P1 | Codex plugin forwards LOADOUT_HOME | Claude | cloud | done ([#36](https://github.com/erik-hedstrom/loadout/pull/36)): Codex gives a stdio MCP server only its default variables plus `env_vars`, so the plugin's `loadout mcp` ignored a custom `LOADOUT_HOME` (and a `"router": "lexical"` profile in it); now forwarded. A relative `LOADOUT_HOME` is now refused (on Windows, anything but a drive-qualified path, so no drive-relative, UNC or device path) and an empty one ignored; the `HOME` (or `USERPROFILE`) fallback must pass the same check. So the working directory or a remote share cannot become the config. An absolute value, including a mapped network drive, is trusted: a project settings `env` that sets one comes from settings that can already run their own hooks. The config the home points to cannot redirect the key (Erik, 2026-10-19): a `jev.baseUrl` other than api.typesafe.ai is refused unless `TYPESAFE_BASE_URL` names the URL. It still chooses `apiKeyFile`, whose content then reaches only that URL, which is why the home must not come from the working directory either. Checked against the Codex source only, not a live run |
| D16 | P1 | Warn when the hook runs without a TypeSafe key | Claude | cloud | done ([#27](https://github.com/erik-hedstrom/loadout/pull/27)): once per session, as a `systemMessage`, which Claude Code and Codex both show |
| D18 | P1 | The hook and `load_skill` can offer `load_skill` only, with no folder | Codex | cloud | partial ([#54](https://github.com/erik-hedstrom/loadout/pull/54)): load_skill-only offer merged; C2 dropping its folder-hint limit waits on Erik |
| D19 | P2 | `which()` honours PATHEXT on Windows | Codex | local | partial ([#52](https://github.com/erik-hedstrom/loadout/pull/52)): PATHEXT lookup merged; the launcher refuses batch hosts instead of spawning them (see learnings) |
| D20 | P2 | Hook state writes never drop context or the no-key warning | Codex | cloud | done ([#49](https://github.com/erik-hedstrom/loadout/pull/49)) |
| D21 | P1 | Keep loadout's request prefix cache-stable | Codex | local | done ([#59](https://github.com/erik-hedstrom/loadout/pull/59)) |

**D18. The hook and `load_skill` can offer `load_skill` only, with no folder.**
Both currently suggest reading skill files directly, even when the host's
file fence denies that path ([C2, PR #37](https://github.com/erik-hedstrom/loadout/pull/37)).

Acceptance:
- An option or default omits the hook's folder text and direct-read suggestion
  and the `load_skill` listing's folder text, offering only `load_skill`.
- The binary refusal (`src/mcp.ts:138`, "binary file; use it from the skill
  folder directly") also omits the direct-folder advice.
- Tests cover these outputs, including `load_skill` with text and binary `file`
  arguments.
- C2 drops its folder-hint limit when this lands. C2 does not depend on D18:
  its file fence, OS denies and probes enforce framed loading already.

Learnings: `skillFolders` (default `true`) is an option, not the default,
because `load_skill` returns text files only and a user's host can read the
folder for binary assets; C2's fenced host is the consumer for `false`. It
changes generated guidance only, not paths inside skill text or host
permissions. The benchmark cleanup test assumes its checkout is outside the
OS temp root, so run the Linux suite from a checkout elsewhere.
C2 adopting `skillFolders: false` changes its frozen protocol, so Erik decides;
until then C2 keeps its folder-hint limit.

**D19. `which()` and PATHEXT.** From Sol's review of #30 (A3), which Erik
overrode for that PR on 2026-10-19 because the gap predates it. `which()` in
src/launch.ts checks extensionless names only, so a host installed only as
`claude.exe` or `codex.exe` (a native installer with no npm shim) is not found:
`loadout init` prints no setup snippet for it, `loadout doctor` (`onPath`)
reports it missing, and so does the launcher. Acceptance: on win32, `which()` also tries each `PATHEXT` extension
(default `.COM;.EXE;.BAT;.CMD`); the launcher spawns a `.cmd` or `.bat` result
safely (Node refuses them without a shell since the CVE-2024-27980 fix); a test
covers a host present only as `.exe` and only as `.cmd`.

Learnings (2026-10-22): a Windows batch shim cannot pass arbitrary text
safely (newlines are cut, and plain batch files and npm shims parse `%*`
differently). The launcher needs a native `.exe`: both Claude and Codex
`.cmd`/`.bat` hosts are refused before routing or session writes, with fixed
text. `--dry-run` still prints the command because it never spawns a host.
`init` and `doctor` work with `.cmd`; `hostCommand` (src/launch.ts) keeps its
documented argument allowlist for doctor and as defence in depth in `launch()`.
Batch spawns set `NoDefaultCurrentDirectoryInExePath=1` in the caller's child
environment; doctor retains its credential-free environment. npm shims are
not parsed. `bench/invoke.ts` and `bench/outcome.ts` spawn hosts directly
through `bench/lib.ts` rather than `launch()`: a batch host produces spawn
EINVAL. Run those benchmarks on Linux/WSL; their Windows batch support is
outside D19's scope.

**D20. Hook state writes never drop context.** From the reviews of #27 (D16);
Erik kept both out of that PR on 2026-10-19.
- `writeState` in src/hook.ts runs its sweep's `readdirSync` outside the try,
  so an unwritable sessions folder makes `promptContext` throw: the prompt
  gets the failure note instead of its context and, without a key, the
  once-per-session warning. Give the sweep `writeCacheFile`'s never-throw
  contract. Test: a state folder whose parent is a file, a prompt naming a
  skill; the context must come back.
- The `.warned` marker is created with `wx`, which is atomic, but no test
  fails if it becomes check-then-write. Test: spy on `writeFileSync` so the
  marker appears just before the create (the pattern near the
  `syncBuiltinESMExports` test in test/loadout.test.ts); expect no second
  warning.

Learnings (2026-10-22): the folder check and `readdirSync` now sit inside the
sweep's never-throw boundary, like each file's removal. The regression test
needs a state folder outside the loadout home whose parent is a file, so that
the directory read itself fails.

**D21. Request prefix stability.** `server_tools` now has a constant
description: it no longer lists the library's servers, so the tool list stays
the same when a nonempty server set changes or is reordered (a library with
no servers has no gateway tools at all), and no untrusted server
name reaches a tool definition. `find_tools` already returns server keys and
an example gateway call.

Learnings (2026-10-22): in-process MCP tests compare serialized initialization
and tool-list results around search, skill loading and gateway discovery,
including a tool-index write, and reject tool-list-change notifications; this
guards behaviour main already had. Different and permuted gateway inventories
produce the same tool list. The existing hook output test pins per-prompt
context to `additionalContext` on `UserPromptSubmit`.
Moving the Claude launcher's relevance note from the system prompt into the
user turn was tried and dropped in review: Claude's cached prefix puts tools
before the system prompt, and the launcher's tools (plugin-dir skills,
`--mcp-config`) already vary with the selection, so a constant system prompt
buys no cross-session reuse there. It would also have added system text to the
bench's hook and plugin arms that the real plugin never sends. Money saved by
caching is unmeasured; that is section F's question (B11, F1).

**D17. MCP start-up inside Codex's grace period.** Codex leaves an optional
MCP server out of the tool list if it is not ready about 1 s after start-up,
and adds its tools later. That changes the request prefix mid-session and
costs prompt-cache hits. `loadout mcp` scans the library before it answers
`initialize` (`src/cli.ts`), and on WSL behind Windows it runs node from
`/mnt/c` through `wsl.exe`.

Acceptance:
- Measure first ($0): time the `initialize` reply from the checkout on the
  Linux filesystem, and through `wsl.exe` from Windows. Record it here.
- If either is over 1 s: answer `initialize` and register the tools before
  the skill scan (`library/mcp.json` first, since it decides whether the
  gateway tools exist); `find_tools` waits for the scan. Test the order.
- Document `required = true` for Codex users, after checking whether the
  Codex plugin's `.mcp.json` accepts it.

Measured on 2026-10-15 ($0; [RESULTS](../../bench/RESULTS.md#mcp-start-up-under-wsl-d17-2026-10-15)):
`initialize` answers in 0.4–0.8 s from ext4 and 5.9–7.0 s from `/mnt/c`.
The scan is not the cost: loading many small module files over 9P is. So the second
acceptance bullet would save 0.04 s warm, or up to 0.75 s on a cold first
run (measured on `/mnt/c`; a cold run on ext4 was not measured), against
3.9 s of module loading. It is not worth doing as written.

Done (2026-10-16, $0):
- The README's WSL paragraph tells users to install on the Linux filesystem,
  with the numbers above.
- What Codex 0.160.1 accepts (source at tag `rust-v0.160.1`, links below):
  - `required` is a per-server boolean, parsed for `config.toml` and for a
    plugin's `.mcp.json` alike: plugin servers go through the same
    `McpServerConfig` deserializer
    ([mcp_types.rs#L248-L252](https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/config/src/mcp_types.rs#L248-L252),
    [#L607-L616](https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/config/src/mcp_types.rs#L607-L616),
    [plugin_config.rs#L157](https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/codex-mcp/src/plugin_config.rs#L157)).
    Codex 0.160.1 rejects `required = "yes"` in `config.toml` with
    "expected a boolean", so the key is known.
  - Codex waits for a required server before building the tool list
    ([tool_catalog.rs#L282-L329](https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/codex-mcp/src/connection_manager/tool_catalog.rs#L282-L329)),
    and a required server that fails to start fails the session start
    ("required MCP servers failed to initialize",
    [required.rs#L17-L63](https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/codex-mcp/src/connection_manager/required.rs#L17-L63)).
  - A user's plugin policy can set `enabled`, approvals and tool lists for a
    plugin's server, but not `required`
    ([types.rs#L1019](https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/config/src/types.rs#L1019),
    [loader.rs#L968-L989](https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/core-plugins/src/loader.rs#L968-L989)).
  - `mcp_optional_startup_grace_ms` (default 1000) is top-level only; 0
    waits for each optional server up to its `startup_timeout_sec`
    (default 30 s)
    ([config_toml.rs#L318-L322](https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/config/src/config_toml.rs#L318-L322),
    [rmcp_client.rs#L105](https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/codex-mcp/src/rmcp_client.rs#L105)).
- So `loadout setup codex --windows`, the `wsl.exe` path measured above,
  prints `required = true` (test: `prints host configs that attach the
  search server`). The plugin's `.mcp.json` leaves it out: with it, a
  missing or broken `loadout` would fail every Codex session, and users
  could not turn that off short of disabling search. The README gives plugin
  users `mcp_optional_startup_grace_ms = 0` instead. Erik can reverse this.
- Not done: bundling `dist`. Only if the steps above are not enough: it adds
  a build step. A live Codex session with `required = true` has not been
  run.

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

Learnings (PR #9; only the desktop app check is still to do):
- `claude plugin validate` passes for the plugin and the marketplace. Its one
  warning is the missing version, which is deliberate until E5.
- The plugin and the settings snippet share `claudeHookBlock(command)`. An
  earlier draft changed `claudeHookSettings` itself, which would have made
  `bench/invoke.ts` run whatever loadout is on PATH instead of the checkout.
- An offline smoke run (fake Jev, three-skill library) took 3.6 s for
  `cachedEmbeddings` on the first call in a process: the optional package's
  import plus the model load. Every hook call is a new process, so the real
  run must show whether every prompt pays that cost. It is not in RESULTS,
  because fake Jev measures nothing.
- On this Windows machine the library and key exist only in WSL. The CLI
  check therefore used a session-only `loadout` shim on PATH, which ran the
  branch in WSL with `--windows-paths`. The shim needs `MSYS_NO_PATHCONV=1`,
  or Git Bash rewrites `/tmp/...` into a Windows path for `wsl.exe`.
- CLI (2026-10-08): one `claude -p --plugin-dir` run with
  `--include-hook-events` showed the plugin loading and the context arriving
  ([RESULTS](../../bench/RESULTS.md#the-hook-plugin-in-the-claude-code-cli-2026-10-08)).
  That replaced the planned 10-request run: wiring needs one run, and
  skill-use rates need a plugin arm in `bench/invoke.ts` (C8).
- Latency (same RESULTS section): the deadline never bound, so it stays at
  20 s. The new process is slower than the in-process run, for reasons not
  yet measured (D11).
- Hook diagnostics took five Sol rounds. stderr now carries only fixed text:
  the Jev fallback note (route's warning can name skills from the prompt),
  the failure note (parse errors quote the prompt or a config credential),
  transformers.js at `LogLevel.NONE` (a failed inference logs the prompt's
  token ids), and one `windowsPath` helper that drops wslpath's stderr.
- Declined (round 5): the tokenizer bundled in transformers.js warns with a
  malformed `tokenizer.json` pattern, bypassing `NONE`. Only a tampered model
  file triggers it, and it prints that file's text, never the prompt, config
  or a credential. Containing it would take a console patch or a subprocess.
  Sol's non-blocking notes: native onnxruntime global logging stays at error,
  and debug flags or a WASM backend could add output.

**D11. The hook's per-prompt start cost.** Each hook call is a new process.
Its median is above the in-process run's, but each arm made its own Jev
requests and the subprocess was not timed by step
([RESULTS](../../bench/RESULTS.md#the-hook-plugin-in-the-claude-code-cli-2026-10-08)).

Acceptance:
- Time the subprocess's own steps (start-up, imports, library scan, model
  load, Jev), so the breakdown is measured rather than inferred.
- Cut what dominates. `bench/hook-latency.ts` with real Jev then shows a
  lower p50 for the new process, with raw results and a RESULTS entry.

Learnings (2026-10-08, [#14](https://github.com/erik-hedstrom/loadout/pull/14),
[RESULTS](../../bench/RESULTS.md#hook-start-up-d11-2026-10-08)):
- Done: follow-ups return before start-up, and `relay.js` loads only for
  `mcp-launch`.
- Left after #14: the library scan and the embedding model.

Learnings (2026-10-12, [#24](https://github.com/erik-hedstrom/loadout/pull/24),
[RESULTS](../../bench/RESULTS.md#routed-prompts-with-the-library-scan-cache-d11-2026-10-12)):
- The routing paths opt in to a parsed-metadata cache
  (`scanLibrary(dir, { cache: true })`). audit, doctor, list and sources stay
  read-only. The first draft wrote the cache from every scan and broke
  audit's no-write tests.
- Staleness: discovery runs every time; manifests are fingerprinted by
  device, inode, size, mode and ns mtime/ctime; entries within 2 s of the
  scan are not cached (git's racy-index rule).
- Removed in review: an unkeyed checksum (no authentication), folder-name
  checks (keys only match live discovery), a library-path guard.
- Linux only: a failed write was reported twice, because `rmSync` throws
  ENOTDIR under a file (ENOENT on Windows). Windows-only runs could not show
  it; the WSL run did.
- Real Jev, 20 prompts: scanLibrary p50 136 → 22 ms; the new process 1,781 →
  1,543 ms. Cutting the model load per process would need a long-lived
  process.

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

Learnings (2026-10-12, docs read, no live run): flags checked against
Claude Code's [CLI reference](https://code.claude.com/docs/en/cli-reference),
[mcp](https://code.claude.com/docs/en/mcp#disable-claude-ai-connectors) and
[settings reference](https://code.claude.com/docs/en/settings-reference#disableclaudeaiconnectors)
pages, and openai/codex at 4a93bd2 (`exec/src/cli.rs`, `cli/src/main.rs`,
`features/src/lib.rs`, `config/src/loader/mod.rs`).
- The isolation flags go before the passthrough: a value-taking flag or a `--`
  at its end would otherwise swallow them.
- A Codex `-c` override feeds project trust, so any override can re-enable
  project config layers; `--isolate` refuses them all.
- Left: a live check on a machine with both CLIs (does a user-scope MCP server
  and a plugin server disappear, does the claude.ai connector list shrink).
  Erik decided on 2026-10-19: `--setting-sources` stays uncut (it would drop
  the user's hooks and permission rules), and plugin hooks, skills and mods
  stay disclosed until plugin hiding, deferred to a follow-up, lands.

**D6. HTTP cancellation.**

Acceptance:
- An AbortSignal flows from the MCP request through `route()` and `askJev()`
  to `fetch`.
- A test shows a disconnected client stops the Jev call.

Learnings (2026-10-09): no new plumbing on the server side. The MCP SDK
already aborts a handler's `extra.signal` when the transport closes, and
`serveHttp` closes it when the response closes. The same signal handles a
stdio host's `notifications/cancelled`. A cancelled request is not retried,
and its error is fixed text like the other Jev diagnostics.

**D8. Host capability matrix.**

Why (Sol review, 2026-10-07): the README promises model, skill and MCP
selection for six hosts, but only Claude Code and Codex get launch, tier and
hook support; Cursor, OpenCode and Claude Desktop get an MCP search snippet,
and ChatGPT skills-only HTTP search. A non-Claude user notices.

Acceptance:
- `docs/hosts.md`: one table, hosts × {launch, tier, hook, search, gateway},
  each cell "verified" (with the date and how), "untested" (implemented,
  not run in that host) or "not supported".
- README and `setup` output claim no more than the table.

Learnings (2026-10-09): the README and `setup` output already claimed no
more than the table, so they only gained a link.

**D9. Codex parity.**

Why (Sol review): Codex sessions get Claude plugin metadata and plain prompt
pointers, while Claude gets native registration; Codex medium and large tiers
map to one model with different effort, and that economics is unmeasured.

Acceptance:
- The session skill directory is host-neutral; Claude metadata is written
  only for Claude.
- Tier mappings are documented as model/effort presets, labelled
  unvalidated until C3 measures them.

Learnings (2026-10-09): Claude sessions keep `<session>/plugin/skills/`,
because `--plugin-dir` needs that layout. The Codex launch path was not re-run
live (no `codex` in the cloud session); run `loadout codex --dry-run` before
relying on it.

**D16. Warn when the hook runs without a TypeSafe key.**

Why: with `router: "jev"` and no key, the hook falls back to keyword routing
and adds nothing unless a skill is named. The user, in a host CLI or app,
never learned why. `loadout route`, the launcher and `loadout doctor` already
say so.

Acceptance:
- One fixed-text warning per agent session, in the channel each host shows;
  never the key, the key file's path or config contents (hard rule 2).
- No warning with `router: "lexical"`, set on purpose, or with a key.

Learnings:
- Claude Code: `loadout hook claude` prints `{"systemMessage": ...}`, which
  Claude Code shows to the user (its hook JSON output contract; not run
  against a live session here). Plain stderr on exit 0 is not shown outside
  verbose mode.
- Codex: the same JSON. Codex's UserPromptSubmit handler reads only stdout
  on exit 0 and shows `systemMessage` as a warning
  (`codex-rs/hooks/src/events/user_prompt_submit.rs`, found by Codex's review
  on #27); the first draft's stderr line was dropped. Not run live here (D2).
- "Once" is an exclusive-create marker file per session next to the hook's
  state, so two hooks racing in one session cannot both warn. A test that
  starts concurrent hook processes passed against a non-atomic version too
  (process start jitter hides the race), so it was not kept. Without a
  `session_id`, or when the marker cannot be written, it warns on every
  non-follow-up prompt rather than never. After the merge with D15's link
  rules, a linked hook state folder counts as "cannot be written": the marker
  is not created and the warning repeats.
- Markers are empty files; `STATE_FILE` in `src/hook.ts` now matches
  `<hash>.warned`, so the hook state's 7-day TTL sweep removes them (before the
  merge it did not). The sweep runs only when routing writes state. Without a
  key that is rare, so markers pile up (one per session), and a session longer
  than 7 days can be warned twice. Both accepted.
- An unreadable `jev.apiKeyFile` (for example a directory) makes
  `resolveApiKey` throw, so the hook ends with the existing fixed failure note
  and no warning. Not changed here; Erik decides whether that should read as
  "no key".
- Cost: $0 (no Jev or agent CLI calls).

**D12. A one-step Codex install.**

Why (default CLIs first, 2026-10-12): Claude Code users get loadout with two
`claude plugin` commands (D10). Codex users paste a hook and an MCP server
into `config.toml`, then trust the hook in `/hooks`.

Acceptance:
- Find out from the installed codex-cli (its `--help` and bundled docs, not
  memory) whether Codex can install a hook and an MCP server as one unit, such
  as a plugin.
- If it can, ship one beside `plugins/loadout` and make `loadout setup codex`
  print its install command. If it cannot, record that here and keep the
  snippet.
- Nothing edits `~/.codex` (rule 3).

Learnings (2026-10-12, `codex --help` on 0.160.1): `codex plugin` exists, with
`marketplace add` (a local or Git marketplace) and `add PLUGIN@MARKETPLACE`,
like Claude Code's.

Learnings ([#23](https://github.com/erik-hedstrom/loadout/pull/23), all in a
throwaway `CODEX_HOME`):
- A Codex plugin carries `hooks/hooks.json` and `.mcp.json`, with a
  `.codex-plugin/plugin.json` manifest. After `codex plugin add`, `hooks/list`
  reports the hook as `untrusted`: trusting it in `/hooks` is still one step.
- Codex reads `.agents/plugins/marketplace.json` in preference to
  `.claude-plugin/marketplace.json`. The Codex plugin lives only there: in the
  shared file, Claude Code installed it too (verified). Expected from that,
  not run: double routing, the MCP server D10 left out, no TypeSafe notice.
- config.toml records `[plugins."loadout-codex@loadout"] enabled = true`, and a
  plugin-scoped `[plugins."…".mcp_servers.loadout] enabled = false` turns off
  its server. doctor reads both, plus `[features] hooks`.
- WSL loadout behind Windows Codex keeps the TOML snippet: plugin commands
  cannot carry the `wsl.exe` wrapper.
- `codex plugin marketplace add erik-hedstrom/loadout` and `codex plugin add
  loadout-codex@loadout` install from GitHub (2026-10-12, after merge,
  throwaway `CODEX_HOME`).
- Left: the live hook (D2); desktop and T3 Code.

**D13. The plugin opens what its hook routes to.**

Why (C8, 2026-10-12): in headless runs of the hook-only Claude Code plugin,
the hook injected a skill's full text on 6 of 10 prompts and only pointed to a
skill on the other 4. Claude opened none of those 4: the context points to
`load_skill`, which only the MCP server has, or to library folders outside the
working folder, which a headless run may not read. With the MCP server, the
hook arm opened skills on the same 4. The Codex plugin carries the MCP server
and is not affected by the first part.

Acceptance:
- The context names only ways to open a skill that the installed setup has.
- The plugin arm in `bench/invoke.ts` re-run on the same 10 requests, against
  the 6 of 10 and 2 of 10 rows.
- Erik picks the approach first. Candidates: add the MCP server to the plugin
  (B1: +546 tokens per request, which D10 avoided); inject more often, since
  the hook already injects confident matches; or a Claude-side way to read
  the library.

**D15. MCP discovery.**

Why (Erik, 2026-10-13): MCP servers are a bigger part of his context than
skills, and MCP is a launch priority. The search tool already ranked gateway
servers, but everything the agent read talked about skills, so nothing cued a
search for a tool and a match gave no clear next step. Library servers are not
configured in the host, so they cost nothing until needed, and one search
covers skills and servers. For scale, one user's `/context` readings
(not a benchmark, two Claude Code sessions): 292 MCP tools at 230.8k tokens,
12.4k loaded and 218.1k deferred; 180 tools at 163k tokens, 20.4k loaded and
142.6k deferred. Claude Code's own tool search already defers most schemas;
what remains is the loaded share, the deferred name list and server
instructions. Codex has `tool_search` where the model supports it. Nothing
here is measured against them yet (B7).

Acceptance:
- The search text, result lines and `server_tools` output cover MCP servers
  (src/mcp.ts), the tool names and descriptions of a server are searchable
  without starting it, and tests cover the cases in the PR.
- Local check, not done in the PR: in a stock Claude Code CLI, an unprompted
  task that needs a fixture server reaches the right tool, respects
  approvals, and returns a checked result, compared with native deferred tool
  search.

Learnings (2026-10-13):
- The search tool is now `find_tools` (Erik, 2026-10-14; reason in DESIGN,
  search server), with a description that leads with tools and MCP servers.
  No alias. `load_skill`, `server_tools` and `call_server_tool` keep their
  names.
- Sizes in characters. Skills-only library: see the
  [note under B1 results](../../bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request).
  With one gateway server: instructions 424, `find_tools` 582, `server_tools`
  120 (76 before D15), plus each server name quoted. Neither case is remeasured in
  tokens.
- A declared tool list in `mcp.json` was not added: nothing in the standard
  format carries one, and a second field would drift from the server. The
  index is filled by `server_tools` instead; before that call, search sees only
  the library description.
- The index is untrusted on read and tool text is escaped before it reaches
  Jev; the design is in DESIGN (search server). `SEARCH_HINT` (hook and
  launcher text) still says "skill library"; changing it alters measured
  behaviour, so it waits for B7.
- Codex's review (PR #39) found four things in the first design:
  - one shared index file lost entries under concurrent writers (now one
    file per server);
  - a linked index folder redirected reads and writes (now every cache and
    state folder under the loadout home is checked; links planted before
    loadout runs are refused, a same-user process racing the check is out of
    scope, see DESIGN);
  - the compact listing showed "arguments: none" for `$ref` and `oneOf`
    schemas;
  - the fingerprint ignored env and headers.
- Codex's later rounds found two more: a key printed escaped (a name with
  `<skill` in it) did not resolve when the agent sent it back, and a
  successful empty listing left the old entry in the index. The first is
  fixed by not offering such names at all (library scan, `server_tools`;
  `loadout doctor` reports them) rather than by resolving the escaped form,
  which cost about 50 lines for names that are injection attempts in
  practice. The second is fixed and tested; a failed listing still leaves the
  entry.
- Later rounds found more values the agent could not send back exactly:
  tool names cut at 128 characters, escaped schema keys, comma-joined names,
  a server named `mcp:x` resolving to the server `x`, keys longer than the
  tools accept, and required arguments missing from `properties`. One rule
  now covers the class: everything the agent may send back is shown as a JSON
  string, and a key the tools could not take back is never offered.
- Behaviour change: `loadout claude|codex` now refuses to write session files
  when `~/.loadout/sessions` is a link, with an error naming the folder. Before,
  a user who linked it (for example to another disk) was followed. Session
  files hold server credentials; replace the link with a real folder, or link
  the whole loadout home instead, which is still allowed.
- `server_tools` was unbounded (up to 3,000 characters of schema per tool).
  It is now capped in tiers (caps in DESIGN, search server), and one tool's
  full schema is one call away. Whether agents call correctly from the compact
  form is not measured; it is part of the local check.
- Possible follow-up, only if the local check shows agents struggling with
  the generic `call_server_tool`: D4 (`tools/list_changed`).

**D7. `loadout doctor`.**

Acceptance:
- Checks the key (presence and a live call), the library, the embedding
  index, configured hosts and CLI versions.
- Prints the fix for each failed check.
- Read-only.

Learnings (2026-10-09):
- The key check prints only "found" or "not found", never the key file's
  path. The live call is one Noul question with no retries; its failure text
  comes from `jevClient`'s fixed diagnostics.
- Hosts appear only when their CLI is on PATH or their config folder
  exists. A host counts as set up when the plugin is enabled, a `loadout
  hook` entry is present, or a search server is configured
  (`[mcp_servers.loadout]`, or `mcpServers.loadout` in Claude's user-scope
  `.claude.json`).
- Local Codex adversarial review (2026-10-11): doctor rejected its own
  generated hooks on native Windows (the `\` separator), which Ubuntu-only CI
  could not show. Declined: failing a host whose CLI is missing (desktop-only
  setups have none) and anchoring the hook match against `echo loadout hook`.
- Also checks `loadout` on PATH, which the plugin's hook needs. A missing
  optional embedding package is reported, not failed.
- Left: native Windows. `which()` probes bare names without PATHEXT, so an
  install with only `claude.exe` or a `.cmd` shim reads as not on PATH, in
  doctor and in `loadout run`. The fix belongs in `which()` and must decide
  how `.cmd` shims are spawned, since Node refuses them without a shell.

## E. Engineering quality (what a reviewer of the repo sees)

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| E1 | P0 | GitHub Actions CI | Codex | cloud | done ([PR #2](https://github.com/erik-hedstrom/loadout/pull/2)) |
| E2 | P0 | LICENSE, CONTRIBUTING, SECURITY.md, templates | Claude | cloud + erik | done ([PR #1](https://github.com/erik-hedstrom/loadout/pull/1)) |
| E7 | P0 | Vendor-independent bench judges and expander | Codex | cloud | done ([PR #5](https://github.com/erik-hedstrom/loadout/pull/5)) |
| E8 | P0 | Repo-wide simplification pass | Claude (pr-reviewer finds, worker fixes) + Codex review | cloud | in progress (merged: bench/ [#11](https://github.com/erik-hedstrom/loadout/pull/11), src/ [#12](https://github.com/erik-hedstrom/loadout/pull/12), Markdown [#15](https://github.com/erik-hedstrom/loadout/pull/15), Markdown rest [#26](https://github.com/erik-hedstrom/loadout/pull/26)); left: `docs/loop/BACKLOG.md`, `docs/loop/ORCHESTRATOR.md` and `bench/RESULTS.md`; the WSL-only `bench.test.ts` failure moved to E15 |
| E9 | P0 | Security hardening from the read-only Sol review | Codex | cloud | done ([PR #4](https://github.com/erik-hedstrom/loadout/pull/4), re-measure [PR #7](https://github.com/erik-hedstrom/loadout/pull/7)) |
| E3 | P1 | Split the test file per module | Codex | cloud | todo |
| E5 | P1 | Changelog and release automation | Codex | cloud | todo (with A4) |
| E6 | P2 | Architecture diagram in DESIGN.md | Claude | cloud | done ([#29](https://github.com/erik-hedstrom/loadout/pull/29)) |
| E10 | P1 | Build without optional dependencies | Codex | cloud | done ([PR #8](https://github.com/erik-hedstrom/loadout/pull/8)) |
| E11 | P1 | Fixed-text diagnostics in the gateway and relay | Codex | cloud | done ([PR #10](https://github.com/erik-hedstrom/loadout/pull/10)) |
| E12 | P1 | A tool-less Codex bench backend (codex-cli 0.160.1 keeps unified_exec on) | Codex | local | todo |
| E13 | P1 | Apply Engineer standards to both review paths, with a blocking necessity pass | Codex + Claude review | cloud | done ([#41](https://github.com/erik-hedstrom/loadout/pull/41)) |
| E14 | P1 | Redact key-shaped strings before anything goes to Jev (prerequisite for the C2 loadout arm) | Codex | cloud | done ([#53](https://github.com/erik-hedstrom/loadout/pull/53)) |
| E15 | P1 | Test flakes: WSL-only `bench.test.ts` failure, Windows spawn timeouts | Claude | local | done ([#44](https://github.com/erik-hedstrom/loadout/pull/44)) |
| E16 | P2 | Hygiene from #30's audit: control characters, `git ls-files` env, config symlink, echoed arguments | Codex | local | done ([#50](https://github.com/erik-hedstrom/loadout/pull/50)); key inheritance waits on Erik's decision |
| E17 | P3 | One entry-point guard for bench scripts that survives symlinked paths | Codex + Claude review | cloud | done ([#51](https://github.com/erik-hedstrom/loadout/pull/51)); converting #47's guard follows that PR |
| E18 | P1 | Patch the Vite advisories in the development lockfile | Codex | cloud | done ([#56](https://github.com/erik-hedstrom/loadout/pull/56)) |

**E18. npm advisories.** `npm audit` on main reported six advisories against
Vite 8.3.2 (GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm,
GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg); 8.3.3 fixes them.

Learnings (2026-10-22): Vite is development-only here (`vitest -> vite` and
`vitest -> @vitest/mocker -> vite`, `dev: true` in the lockfile), and
`npm audit --omit=dev` was already clean, so published users were never
exposed. Only Vite's lockfile entry changes, within Vitest's peer range; no
override is needed. The audit itself is the regression check.

**E16. Terminal, config and git hygiene.** From the reviews of #30 (A3);
all older than it.
- `addSources` in src/cli.ts prints a pack skill's `name` and skipped `path`
  raw. A SKILL.md `name` with ANSI or OSC escapes can rewrite the user's
  terminal. Strip C0 and C1 control characters before printing, with a test.
- src/repo.ts runs `git ls-files` with the full environment, key included.
  Use `withoutKey()` as `addFromGitHub` does, with a test.
- From #30's deep security audit: `writeDefaultConfig` follows a symlinked
  `config.json` (refuse nonregular files before its read and write), and `loadout add
  <arg>` and other commands echo a mistyped argument, which could be a pasted
  key (only `init` uses fixed text). Fix both, with adversarial tests.
- Decision for Erik, from the same audit: the spawned `claude` and `codex`
  keep `TYPESAFE_API_KEY` in their environment by design. Record whether that
  stands.

Learnings (2026-10-22, #50 review): relocating the home through a link is the
user's documented choice; a link at `config.json` is not. All config reads use
the same file check; same-user swaps after inspection remain out of scope.
HTTP startup and filesystem errors can echo arguments
just like parser errors: print fixed categories and allowlisted errno codes.
Failed adds identify the source by position and retain a safe failure reason.
Swept `init`, `add`, `list`, `audit`, `route`, `claude`, `codex`, `mcp`,
`mcp-launch`, `setup`, `doctor`, `hook` and unknown-command errors: add/token
paths and HTTP listen need local boundaries; other coded errors use the CLI
boundary. Hook/relay/Jev failures already use fixed diagnostics; validated host
and isolation refusals use known names. Terminal controls share one constant.
Review fixes against `4413a67`: M1 file checks and home compatibility, M2 safe
system diagnostics, L1 source positions/reasons, L2 shared control regex;
covered by [hygiene tests](../../test/hygiene.test.ts). Windows verification:
`npm test -- --maxWorkers=2 --reporter=dot`: 582 passed, 17 skipped (POSIX smoke
tests skip on Windows); typecheck, build and diff checks passed. All 16 mutation
checks failed as intended, then source bytes were restored. Jev/API cost: $0.
Re-review and the full CI matrix remain with the coordinator.

**E17. Bench entry-point guard.** From pr-reviewer on #45 (C13). Bench
scripts (judge, stability, sweep, hook-latency, overhead and mcp-overhead on
main) run when `resolve(argv[1])` equals the module path. Node builds that path from the
real path, so a script started through a symlink or junction (`/tmp` on
macOS) does nothing and exits 0. Acceptance: one `isEntry(import.meta.url)`
in bench/lib.ts comparing real paths, and no `resolve(process.argv[1])` guard
left under bench/, with a test that runs a script through a link.

Learnings (2026-10-22): canonicalize both sides; resolving only `argv[1]` leaves
a linked module URL unmatched. Run the Linux suite outside the system temp
folder: the existing `resetWork` test assumes the checkout is outside it.
`bench/ab.ts` (#47) now uses `isEntry(import.meta.url)` and is covered by the
shared symlink and import tests.

Review M1/L1: argv lookup ENOENT/ENOTDIR means no entry (missing path or
non-directory parent); module lookup and unexpected argv errors stay strict.
Import tests cover these cases, stdin and a deleted importer. Removed seven
direct-invocation cases; the stability pair still covers direct execution.

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

Learnings:
- One `diagnostic()` (src/diagnostic.ts) serves the gateway and the relay.
  After an SDK failure, only an HTTP status, an OS errno code, an integer MCP
  error code and the URL origin survive.
- Tool results, `isError` included, stay verbatim: they are the upstream
  tool's output, and the agent needs them to correct its call. A first draft
  turned them into "tool failed"; that was reverted.
- Filesystem and wslpath errors in `load_skill` become fixed text, because
  they can carry third-party file and folder names unescaped.
- Parse errors quote their input, so the relay's `mcp.json` parse failure is
  fixed text (the same finding as D10's hook).
- All 23 new test cases fail on main (8e930ff).
- Dependencies log too, as in D10. The MCP SDK compiles upstream output
  schemas with AJV, whose default logger prints schema text to stderr. The
  gateway passes a validator that accepts everything: it forwards results
  verbatim anyway, and the SDK's structuredContent check stays.
- Errors no longer echo requested names (readConfined, missing tool). A
  hostile file name copied from a listing would come back unescaped.
- Parse errors are fixed text where config.json and mcp.json are read, which
  covers every command; startup ran before any sanitized handler. Library
  server names go through escapeSkillTags wherever they reach the agent.

**E12. A tool-less Codex bench backend.** On codex-cli 0.160.1 (and 0.154.0),
`unified_exec` stays `true` in `codex features list` under
`-c features.unified_exec=false`, `--disable unified_exec` or an empty
`CODEX_HOME`. So `--backend codex` in bench/lib.ts always refuses, which is
correct. A probe (2026-10-08) with lib.ts's flags listed `functions.exec`,
`apply_patch`, `web__run`, sub-agent tools and an apps MCP connector, and made
two MCP calls. Disabling every feature that can be disabled leaves
`functions.exec` (JavaScript, no file access, as the model reports it),
`apply_patch`, `web__run` and sub-agents; the model could not read a canary file.

Until then, Codex can produce requests only through `--backend files`, for
inputs without third-party text (C1 does this). It cannot judge, because the
judge sees the skill catalog.

Acceptance: a Codex configuration whose `exec` exposes no tool that reads
files, runs commands or reaches the network, checked by lib.ts before every
run; an adversarial test with the canary probe; `@codex security review`.

**E13. Stricter engineering reviews.** Requested by Erik on 2026-10-13.
Port the applicable standards from the PC's `Engineer.md` into AGENTS.md;
GitHub reviewers cannot rely on a local agent file. Require a separate necessity
pass with caller/contract evidence and a safe deletion or replacement. Material
unnecessary complexity blocks approval; justified boundaries remain valid.
Align `pr-reviewer` and the orchestrator's review prompt and gate. Validation:
local checks and cross-model review; GitHub behavior remains unverified until
the rules are published and exercised on a representative PR.

Learned: on Windows, `npm test` needed repository-local TEMP/TMP when the
sandbox could not load Vitest's temp files.

**E14. Redact key-shaped strings before anything goes to Jev.** `find_tools`
(`find_skills` before #39) sends its `goal` (up to 4,000 characters) and
`keywords` to Jev, and the hook sends the user's prompt. A pasted or injected
credential then sits in Jev's logs while it is still live; a malicious skill can
cause this (see Credentials and spend in the C2 protocol), and users paste
secrets into prompts too.

Acceptance:
- One place that every Jev request passes through replaces strings that match
  the key shapes in `bench/fixtures/c2/scan-patterns.json` (or a `src/` copy the
  bench file reads) with a fixed token, in goals, keywords and prompts.
- Adversarial tests for each shape, and for a key inside one `keywords` entry.
- The session log counts redactions and never records the match.

Limit: base64, splitting or any other encoding defeats pattern redaction, so
this is defence in depth. The C2 protocol's primary layer is that the agent
cannot read the key. Prerequisite for the C2 loadout arm.

Learnings (2026-10-22, M1–M4): every Jev caller reaches `jevClient().ask()`;
it redacts the whole JSON body once, so retries reuse it. `redactJson` decodes
JSON strings first, preserving word boundaries after escapes. C2 keeps its
frozen `scan-patterns.json`; a deep-equality test checks production patterns
against it. JWT matching scans disjoint base64url segments to avoid quadratic
restarts. Routing aliases names that redaction would change, then restores
answer identities before selection. Stderr records counts, never matches.
`reportJson` preserves property keys and redacts only string values; this also
applies to `route --json` and `list --json`. Out of scope: encoded or split keys
(including across goal and keywords), and keys glued to a preceding word
character (the patterns' word boundary).

**E15. Test flakes on the merge gate.** Two failures that were already on
main made the gate noisy during the 2026-10-16 merge round (CI reruns,
"known flake" notes).
- `bench.test.ts` "keeps the escaped Claude catalog in an identical
  system-prompt file across batches" failed every time in WSL2. There `which`
  finds the Windows `claude`, so `systemPromptArgs` (bench/lib.ts) translates
  the prompt-file path through `wslpath`, which the test file mocks: the path
  became the mocked `codex features list` text. The test now sets `PATH` to an
  empty folder.
- Tests that spawn `node --import tsx` failed at random on Windows runners at
  vitest's 5 s default (doctor, audit, bench, loadout and overhead tests in CI
  history). Vitest fails a synchronous test that ran past its timeout even
  after `spawnSync` returns, so only a higher `testTimeout` helps. It is now
  30 s in vitest.config.ts. Per-test overrides of 30 s or less are gone; the
  audit case-variant test keeps its loop guard, raised from 5 s to 15 s.

Acceptance: the bench test passes in WSL2; the full suite passes on Windows
under load; `ci-full` green.

Learnings:
- Repro for the timeouts: the full suite pinned to 4 cores (CI's
  `windows-latest` size) next to a busy loop on the same cores. Before: 25
  failed, all at 5 s or at a lower per-test timeout. After: all passed; the
  slowest test took 13.4 s.
- `codex features list` and `wslpath` share the mocked `execFileSync` in
  bench.test.ts. A test that reaches either one must control its input.

**E1. CI.**

Acceptance:
- Runs on push and PR: `npm ci`, build, typecheck, test.
- Matrix: Ubuntu, macOS, Windows × Node 22 and 24 (Node 20 is end-of-life since 2026-04-30).
- No secrets needed.
- The badge goes in the README.

Learnings: WSL hook assertions need a Linux runtime fixture on native Windows; Vitest 5 needs Node ≥ 22, so engines moved to >=22 (Node 20 is EOL); plain `npm ci` preserves Rolldown's optional native bindings.

2026-10-08: Actions stopped starting jobs (private-repo minutes or billing)
after about 25 full-matrix PR runs. Decided with Sol at Erik's request: the
full matrix runs behind the `ci-full` label before merge; other runs are
Ubuntu only ([PR #13](https://github.com/erik-hedstrom/loadout/pull/13)).
Without branch protection, the orchestrator checks the full jobs before each
merge.

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
verify installed-skill isolation without relocating CODEX_HOME. Re-judge 40 v4
requests locally through `claude -p` and, when safe, `codex`; never in a cloud
session (ORCHESTRATOR, "Cloud fallback"). Preserve IDs/splits and raw results; report stored-verdict agreement,
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

Area 2 (`src/`): done in [PR #12](https://github.com/erik-hedstrom/loadout/pull/12),
69 net lines removed. Security code and fixed-text diagnostics unchanged;
tests changed only where they tested something deleted (`prefilter()`, A2's
`toolTokens > 0`).

Markdown rest (`agent/e8-markdown-rest`): `AGENTS.md`, `CLAUDE.md`,
`CONTRIBUTING.md`, `SECURITY.md`, `.claude/agents/*.md` and
`.github/pull_request_template.md`. `CLAUDE.md` lost the judge-concurrency and
cost lines (`AGENTS.md` and `bench/README.md` own them) and the auto-compact
line (`.claude/settings.json` owns it). The rule "never run judges in a cloud
session" moved from `CLAUDE.md` to `AGENTS.md` "Environment notes", so Codex
and cloud workers read it too (pr-reviewer caught the first draft dropping
it). `worker.md` points to `AGENTS.md` instead of restating its hard rules and
PR list, and its steps point to `AGENTS.md`'s bars (tests, cost, backlog,
commits) instead of copying them (its "tests for new behavior" moved into
`AGENTS.md`); `CLAUDE.md` lost its copy of the same bars.
`AGENTS.md` lost two filler sentences. `CONTRIBUTING.md` and the PR
template were checked against the code and the loop and left as they are.
`SECURITY.md` points reporters to GitHub private vulnerability reporting,
which was off on 2026-10-12; it is correct once Erik turns it on (HANDOFF
decision 1).
Left: `docs/loop/BACKLOG.md`, `docs/loop/ORCHESTRATOR.md`, `bench/RESULTS.md`.
Out of scope: `bench/results/**` (recorded output, kept as run) and
`test/fixtures/`.

Starting points from Sol's review (2026-10-07):
- `src/`, ≈ 40–60 lines: `prefilter()` is used only by tests
  (production uses `hybridRank()`); the `inverted` metadata in route.ts is
  unused; `oneLine` is duplicated in hook.ts and mcp.ts; some module
  introductions repeat DESIGN.
- `bench/`, done: 64 net lines removed. Reused capability keys, decision
  reconstruction, process-group timeouts, JSONL parsing and Windows Codex
  lookup; removed redundant options, retries, exports and wrappers. route-bench
  uses jevClient's retries (5; at most six attempts per request).
- Markdown, ≈ 100–150 lines: DESIGN's benchmark-arms section is stale; the
  usage sections repeat README; HANDOFF's tables repeat both; absolutes at
  DESIGN:5, 29 and HANDOFF:17 overstate what the benchmarks show.
- `test/`: bench.test.ts "keeps the escaped Claude catalog…" fails on a
  machine where `which('claude')` finds a Windows `claude` under `/mnt/c`.
  `pathTranslator` then calls the mocked `execFileSync`. Seen in WSL during
  D10; CI does not have that PATH. Fixed in E15.

Markdown area ([#15](https://github.com/erik-hedstrom/loadout/pull/15)):
`pr-reviewer` found 28 items in DESIGN, HANDOFF, README and bench/README; Sol
applied them. Numbers without a RESULTS figure were deleted, not rounded.
BACKLOG, RESULTS and ORCHESTRATOR were left out because open PRs edit them.

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
PRs. A hand-written CHANGELOG.md exists since B4; the tool must take it over
rather than start a second one.

**E6. Architecture diagram.**

Acceptance: one SVG or Mermaid diagram of the routing pipeline and the
integration layers, readable in both light and dark themes.

Learnings (2026-10-12): the Mermaid block replaces the ASCII diagram under
DESIGN.md "Architecture"; the launcher flags it showed stay in the
integration table. It sets no colors, so GitHub themes it. Rendered once with
`npx -y @mermaid-js/mermaid-cli` (with `--no-sandbox`) to check the syntax; not
viewed on GitHub in light and dark. Mermaid ignores `direction` inside a
subgraph that has outside edges, so the host boxes wrap. Each label was
checked against the code on every entry path (launcher, hook, `route`, `mcp`
stdio and `--http`) with Jev, lexical routing, no key and Jev failure.
Round 19 kept an edge inventory (every flow in `src/` that enters or leaves a
node, with file:line) and diffed it against the Mermaid source, because fixes
for one finding had dropped edges added earlier: the library edges to the
named-skill step and to `load_skill` went when five edges were folded into one.
Labels carry only each node's role and key output; limits and conditions live
in the prose, so they are stated once.

## F. Prompt caching

Its own track, with the boundary to the core in
[CACHE-TRACK.md](CACHE-TRACK.md): this track measures what complete cached
sessions cost and keeps loadout's requests cache-friendly. What to select stays
with the core (section C). Changes to the shared contract follow
[its rule](CACHE-TRACK.md#boundary).

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| B11 | P1 | OpenCode session cost and task checks with automatic prompt caching | Codex | local | partial ([#57](https://github.com/erik-hedstrom/loadout/pull/57)): harness, dataset and two quota-stopped pilots merged; the 792-session study is unrun |
| F1 | P1 | Prefix continuity on real hosts: loadout keeps the cached prefix turn after turn | Codex | local | todo (after F2) |
| F2 | P1 | Session-cost capture: per-request usage in outcome runs and session columns in B7 | Codex | local | todo (C11's deferred part) |
| F3 | P2 | Shorter constant MCP text and fewer discovery requests, at unchanged task success | Codex | local | todo (after F2) |
| F4 | P2 | `loadout audit` reports cache-aware cost from measured numbers | Codex | cloud | todo (after B11, F1) |
| F5 | P3 | Start-up and path variability: Codex first-request tools, launcher session paths | Codex | local | todo |

**B11. OpenCode cache and outcome study.** [PR #57](https://github.com/erik-hedstrom/loadout/pull/57) merged the harness, the 72-task dataset
and two quota-stopped pilots. Next: resume the replacement pilot, then the 792-session study, when the free tier's
quota allows; afterwards fold the handoff into `bench/README.md`. Cost at retained quality and break-even are not shown.
Evidence and limitations: [RESULTS](../../bench/RESULTS.md#b11-replacement-pilot-2026-10-23-quota-stopped).
Commands, verification and review dispositions: [handoff](B11-HANDOFF.md).

**F1. Prefix continuity on real hosts.** The D21 tests pin the facade
in-process; nothing shows that a real host keeps reading loadout's prefix from
cache across turns.

Acceptance: sessions of at least five turns on Claude Code, Codex and
OpenCode, with loadout on and off (the hook and MCP on Claude Code and Codex;
MCP only on OpenCode, which has no loadout hook). From the host's own
per-request usage, each turn's cached tokens cover the previous request's
input up to the host's cache granularity, as in the off arm. Any shortfall,
partial or total, is traced to its cause: nonzero reads alone do not show
continuity. Codex
runs gpt-6-luna at medium effort; Claude runs Haiku; OpenCode runs the free
models. Raw results committed; a RESULTS section either way.

**F2. Session-cost capture.** Outcome runs keep only turn totals (C11), and
B7 reports per-request overhead, not what a session costs.

Acceptance: `bench/outcome.ts` keeps each request's input, cache read, cache
write and output from the host's own report (a fixture test per host; no
proxy, AGENTS.md rule 1), and `bench/mcp-overhead.ts` reports per session:
request count, the token buckets, Jev cost, latency and completion, for native
default against the gateway, short and long sessions, and a gap past the cache
lifetime. C11's learnings list what each host exposes today; reuse the per-message
Claude usage that #47 adds to `bench/usage.ts`, if it merges. Decision for Erik: the Codex usage
source (`exec --json` has turn totals only; the alternatives read a Codex home,
see C11). Until then Codex per-request usage is "not shown".

**F3. Lower fixed and discovery overhead.** Candidates: shorter constant
descriptions and server instructions in `createServer()`, and loading a named
skill without a search first.

Acceptance: measured against current main on F2's columns: loadout's fixed
tokens and extra discovery requests per session. The host's agent must still
discover and use the right resources and finish the tasks (B11 checks or C14
runs): select on the dev split, then report the kept change once on test. C1 recall alone cannot show this, because the sweep calls
`route()` directly. Core review is required, since the change touches the
facade. Keep only what lowers session
cost with task success unchanged; record the rest as negative results.

**F4. Cache-aware audit.** `loadout audit` (A2) estimates skill-listing tokens
per host; it does not count MCP schemas and puts no price on either.

Acceptance: it reports first-request and cached-turn cost per host price profile,
using numbers measured in B11 or F1 and linked from RESULTS, with dated
prices. No figure without a RESULTS entry; "not shown" where none exists.

**F5. Start-up and path variability.** The Codex plugin's MCP server can
arrive after the first request (D17), and launcher session directories put
timestamps into copied skill paths (`src/launch.ts`).

Acceptance: measure first-request tool presence and cross-session cache loss
first; change start-up or paths only where the measurement shows a cost.

## Iteration log

| Date | Merged | In flight | Spend (Jev / Claude / Codex) | Decisions needed |
|---|---|---|---|---|
| 2026-10-07 | Handoff written (HANDOFF, AGENTS with Code Review Rules, ORCHESTRATOR, BACKLOG, `.claude/agents/{worker,pr-reviewer}.md`, auto-compact 500k) | — | — | License, public timing, npm name, budget caps, hook default; cloud setup (ORCHESTRATOR.md §One-time setup) |
| 2026-10-07 (iter 1) | None: GitHub outage (Git, PRs, Actions) from 15:16 UTC; no CI run yet | E1 #2 (pr-reviewer APPROVE, Sol clean; waits for CI); E2 #1 (draft until E9); E9 (both reviews blocked it: server env reaches the agent process [High], credentials in args/URLs [High], conditional Jev framing [Med]; Sol on round 2); A2 #3 (draft; reviews running); E7 (Sol building judge backends) | Jev $0 / Claude: orchestrator + pr-reviewer runs (main usage) / Codex: 1 repo review, 5 builds, 3 reviews (ChatGPT plan) | Decided by Erik: Apache-2.0; full CI matrix on every PR; Node ≥ 22; Sol builds, Claude reviews. Open: enable private vulnerability reporting; hook default; npm name; going public |
| 2026-10-07 (iter 1, later) | None: no Actions run has ever been created for #2 (workflow present, Actions enabled); Erik asked to check billing or allow merging E1 on reviews + local green | #1 E2 draft (SECURITY.md to add: server-echoed credentials out of scope); #2 E1 approved by both, no CI; #3 A2 round 4 (pr-reviewer APPROVE r3, Sol found 3 Medium); #4 E9 round 4 (relay design accepted by both; declined Sol's payload-redaction High: relay stays transparent); #5 E7 round 3 (codex judge refuses on 0.160.1: unified_exec cannot be disabled; record as negative result); #6 B1 round 2 (nested-subset cap detection, `codex debug prompt-input` preflight) | Jev $0 / Claude: pr-reviewer rounds (main usage) / Codex: ~20 builds and reviews | Positioning: hosts cap listings (Claude Code 1% of context, names always listed; Codex 2% or 8,000 chars), so the headline becomes visibility + bounded cost, measured by B1. Owed after E9 merges: Jev-only agreement check of the framing change (≈ $0.5) |
| 2026-10-07 (iter 2) | E1 #2 (merged without PR CI at Erik's direction; the first main run was green on all 6 jobs), E7 #5, E9 #4, A2 #3, B1 #6, E2 #1, E9 re-measure #7 | D10 (Sol building the plugin and the hook-latency bench) | Jev $0.77 (two sweeps) / Claude: 16 haiku calls with rows plus ≤4 probes (B1), and pr-reviewer rounds (subscription) / Codex: about 12 builds and reviews (ChatGPT plan) | Decided by Erik: in-host first (D10), with the hook automatic through the plugin he installs. Findings: the Claude listing grows about 10 tokens per skill, so the 140k estimate is withdrawn; loadout's MCP tools cost more than 50 native skills; Jev is not deterministic (about 1 request in 13); decisions probably shifted across E9 (cause unidentified). Open: a security contact; B1 raw-row names before going public; a Windows-side `loadout init` or the Linux machine for D10's CLI check |
| 2026-10-08 (iter 3) | E10 #8; D10 #9 on merge | E11 (brief ready for Sol) | Jev about $0.05 (hook latency, probe) / Claude: one Haiku plugin probe ($0.06 reported) and pr-reviewer rounds (subscription) / Codex: four D10 review rounds (ChatGPT plan) | Desktop app check: Erik installs the plugin (D10); security contact for SECURITY.md; B1 raw-row names before going public |
| 2026-10-08 (iter 4) | E11 #10 | Approved, waiting on CI (Actions blocked by the account billing limit): #11 E8 bench, #12 E8 src, #13 label-gated CI, #14 D11. Reviews running: #15 E8 Markdown. C1 seeds and expansion under way | Jev $0 / Claude: pr-reviewer rounds (subscription) / Codex: builds, reviews, C1 seed batches (ChatGPT plan) | CI billing (raise the limit or wait for the reset); desktop app check (D10); security contact; B1 raw-row names |
| 2026-10-08 (iter 4, later) | — | C1 #16 (measured: recall holds, precision falls; reviews running). E12 found: codex exec cannot run tool-less on codex-cli 0.160.1 | Jev $0.60 (three C1 sweeps, one slowed by Jev) / Claude: judge $3.68 (C1) + $2.08 (control), pr-reviewer rounds / Codex: C1 seeds and expansion (55 batches), builds, reviews | As in iter 4 |
| 2026-10-09 (iter 5) | #13 label-gated CI (`ci-full` label created), #11 and #12 E8 bench/src, #14 D11, #15 E8 docs, #16 C1 | — | Jev $0 / Claude: merges and conflict fixes / Codex: none | Actions runs again (GitHub Pro). Next work goes to a cloud session (Claude weekly usage at 96%) |
| 2026-10-09 (iter 6, cloud) | — | Open PRs, each updating its own row: [#17](https://github.com/erik-hedstrom/loadout/pull/17) backlog statuses, [#18](https://github.com/erik-hedstrom/loadout/pull/18) D8, [#19](https://github.com/erik-hedstrom/loadout/pull/19) D6, [#20](https://github.com/erik-hedstrom/loadout/pull/20) D7, [#21](https://github.com/erik-hedstrom/loadout/pull/21) D9 | Jev $0 (no key in the cloud environment) / Claude: cloud-session credit / Codex: reviews on GitHub | Add `TYPESAFE_API_KEY` and `api.typesafe.ai` (and `huggingface.co`) to the cloud environment for D11's real-Jev run and C4 |
| 2026-10-12 (iter 7) | #19 D6, #21 D9, #18 D8, #17 backlog statuses (after fixing pr-reviewer's two Mediums), #20 D7 (Sol fixed two findings from Erik's local Codex review: Windows hook paths, Claude search-only setup), all on the full matrix. This PR: default CLIs first, loop docs for the local and cloud setups | — | Jev under $0.001 (one doctor call) / Claude: pr-reviewer rounds (subscription) / Codex: one Sol build, five Sol reviews | Actions stopped starting jobs (Pro's minutes used up, about 62% by macOS). Erik made the repo public, so standard runners are free. Left for Erik: private vulnerability reporting (off), and the items under HANDOFF decision 1 |
| 2026-10-12/13 (iter 8, desktop app) | #22 loop docs (after Erik enabled private vulnerability reporting); #24 D11 scan cache (new process p50 1,781 → 1,543 ms; D11 stays open); #23 D12 Codex plugin (installs from GitHub); #25 C8 (plugin arm: injected 6 of 10, opened 0) | — | Jev about $0.15 (hook latency, C8) / Claude: $1.93 C8 run plus probes, pr-reviewer rounds (subscription) / Codex: 3 Sol builds, about 12 fix rounds, about 20 reviews (ChatGPT plan) | D13: how the plugin opens skills (MCP server, inject, or other). D11: a long-lived process for the model load? D2: trust the Codex plugin hook in `/hooks`. D10: the desktop-app check. Ten stale worktrees under `dev/sandbox/loadout-wt` (all merged, clean) |
| 2026-10-12 (iter 8, cloud) | — | Open PRs, each in pr-reviewer and `@codex review` rounds at writing: [#26](https://github.com/erik-hedstrom/loadout/pull/26) E8, [#27](https://github.com/erik-hedstrom/loadout/pull/27) D16, [#28](https://github.com/erik-hedstrom/loadout/pull/28) A1, [#29](https://github.com/erik-hedstrom/loadout/pull/29) E6, [#30](https://github.com/erik-hedstrom/loadout/pull/30) A3, [#31](https://github.com/erik-hedstrom/loadout/pull/31) B6, [#32](https://github.com/erik-hedstrom/loadout/pull/32) D5, [#33](https://github.com/erik-hedstrom/loadout/pull/33) B4, [#34](https://github.com/erik-hedstrom/loadout/pull/34) B3 | Jev $0 (no key in the cloud environment) / Claude: cloud-session credit / Codex: GitHub reviews only (ChatGPT plan) | Decisions: each PR's "What is left"; none is labelled `ci-full` yet. Merge conflicts (pairwise, at writing): README (#28 with #30, #32, #33), `src/cli.ts` (#27, #30), `test/loadout.test.ts` (#27, #32), BACKLOG (#28 with #30, #31 with #33). Learned: Codex took 4 to 12 rounds per PR, and the docs PRs as many as the security ones (#29: 12); under load from parallel sessions, run tests with `--maxWorkers=2` and 60 s timeouts (#31) |
| 2026-10-13 to 15 (iter 9, cloud + local) | — | Cloud: new PRs [#35](https://github.com/erik-hedstrom/loadout/pull/35) log row, [#36](https://github.com/erik-hedstrom/loadout/pull/36) D14, [#37](https://github.com/erik-hedstrom/loadout/pull/37) C2, [#38](https://github.com/erik-hedstrom/loadout/pull/38) B7, [#39](https://github.com/erik-hedstrom/loadout/pull/39) D15, [#40](https://github.com/erik-hedstrom/loadout/pull/40) C10; #26–#34 driven to clean (Codex up to 20 rounds, #29). Open findings on #37 and #38 (see "In review"). Local (Erik): E13, pushed on 2026-10-15 as [#41](https://github.com/erik-hedstrom/loadout/pull/41); a Codex A/B run; the launch-readiness review | Jev $0 / Claude: cloud-session credit, subagents on plan quota (they hit the session limit on 2026-10-14, about 23:30 UTC; three runs cut off, no partial work) / Codex: GitHub reviews (ChatGPT plan); Erik's local A/B on his plan | Erik: C2's margin, VM, licence and scope; B7's account and its plugin-agent root fix; D15's race threads; #27 questions; #34 skills.sh threads; #36 `/proc` thread; stale `wip/*` branches; the items under HANDOFF decisions. Learned: fix the class, not the instance (B7's rounds 12–16 each found one more place a plugin sets Claude's agent; patching places did not converge); restore mutation checks from a saved copy, never `git checkout <file>`; two PRs both took the ID E13, so check open PRs for the next free ID |
| 2026-10-15 (iter 10, local) | none: the orchestrator's `gh pr merge` was blocked by the session's permission classifier, so merges wait for Erik | [#41](https://github.com/erik-hedstrom/loadout/pull/41) E13 and [#39](https://github.com/erik-hedstrom/loadout/pull/39) D15: both reviews approve, full matrix green, ready to merge; [#38](https://github.com/erik-hedstrom/loadout/pull/38) B7: root fix (no ambient plugins), both reviews approve, full matrix green; [#37](https://github.com/erik-hedstrom/loadout/pull/37) C2: round 15 and 16 findings fixed, both reviews approve, waits for Erik's C2 decisions; this file's PR [#42](https://github.com/erik-hedstrom/loadout/pull/42); D17 measured ($0) | Jev $0 / Claude: subagents on plan quota / Codex: Sol tasks and local reviews on plan quota; no `claude -p` or `codex exec` | Erik: merge #41, #39 (then update B7 and C8 to `find_tools`), #38; C2's margin, VM, licence and scope. Decided today: B7 no ambient plugins, personal account, Codex writes accepted; D15 race scope accepted. Learned: a policy restated in several files drifts; three review rounds on E13 each found a copy that had (fix: state it once, link elsewhere). Deny the parent directory, not its children (C2) |
| 2026-10-16 to 20 (iter 11, local) | [#41](https://github.com/erik-hedstrom/loadout/pull/41) E13, [#42](https://github.com/erik-hedstrom/loadout/pull/42) handoff, [#39](https://github.com/erik-hedstrom/loadout/pull/39) D15, [#38](https://github.com/erik-hedstrom/loadout/pull/38) B7 harness, [#44](https://github.com/erik-hedstrom/loadout/pull/44) E15, [#43](https://github.com/erik-hedstrom/loadout/pull/43) D17, [#31](https://github.com/erik-hedstrom/loadout/pull/31) B6, [#40](https://github.com/erik-hedstrom/loadout/pull/40) C10, [#33](https://github.com/erik-hedstrom/loadout/pull/33) B4, [#45](https://github.com/erik-hedstrom/loadout/pull/45) C13, [#25](https://github.com/erik-hedstrom/loadout/pull/25) C8, [#34](https://github.com/erik-hedstrom/loadout/pull/34) B3, [#30](https://github.com/erik-hedstrom/loadout/pull/30) A3, [#32](https://github.com/erik-hedstrom/loadout/pull/32) D5, [#27](https://github.com/erik-hedstrom/loadout/pull/27) D16 | [#36](https://github.com/erik-hedstrom/loadout/pull/36) D14, [#37](https://github.com/erik-hedstrom/loadout/pull/37) C2, [#29](https://github.com/erik-hedstrom/loadout/pull/29) E6, [#28](https://github.com/erik-hedstrom/loadout/pull/28) A1, [#26](https://github.com/erik-hedstrom/loadout/pull/26) E8, [#46](https://github.com/erik-hedstrom/loadout/pull/46) C12, [#47](https://github.com/erik-hedstrom/loadout/pull/47) C14; follow-ups D19, D20, E16, E17 | Jev: $2.21 for the C13 sweeps plus about $1.14 for two gold runs ([RESULTS](../../bench/RESULTS.md#c13-2026-10-16-pure-jev-baseline-on-main)); C12 replayed stored answers, $0. Claude and Codex: reviews only, on subscriptions | From 2026-10-20 Erik merges every PR himself (his global instructions; the orchestrator brings PRs to merge-ready). Turn on private vulnerability reporting (#26). Look at the #29 diagram on GitHub in light and dark. C2's remaining run prerequisites. `CLAUDE_CODE_OAUTH_TOKEN` for the B7 pilots |
