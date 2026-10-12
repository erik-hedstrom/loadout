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
1. loadout verified in both default CLIs: the Codex hook (D2), a one-step
   Codex install if Codex allows it (D12), the hook's per-prompt cost
   (D11), skill use with the plugin (C8).
2. Precision on new requests (C4).
3. A README that leads with the plugin and the hook (A1), then the demo (A5).
4. Launch.

## A. Adoption and ease of use

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| A2 | P0 | `loadout audit`: what your installed skills cost you | Claude | cloud | done ([PR #3](https://github.com/erik-hedstrom/loadout/pull/3)) |
| A1 | P0 | README rewrite around the problem, 3-command quickstart, GIF | Claude | cloud | todo (leads with the plugin and the Codex hook; the launcher moves down) |
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

Note (E8 find pass, 2026-10-08): README still leads with the launcher; the
plugin appears only under "Search mid-session".

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
- It shows `audit`, then a plain `claude` session in which the plugin's hook
  adds a skill the agent then uses.

## B. Positioning and launch (honest hype)

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| B1 | P0 | Token-waste study: measured per-request overhead of popular skill packs | Claude | local (measure) + cloud (analysis) | done ([PR #6](https://github.com/erik-hedstrom/loadout/pull/6); follow-ups under "Left" in its learnings) |
| B3 | P1 | Fact-checked comparison with alternatives | Codex | cloud | todo |
| B2 | P1 | Launch kit drafts | Claude | cloud | todo (after A1, B1) |
| B4 | P1 | Repo polish: description, topics, social preview, badges | Claude | cloud + erik | todo |
| B6 | P2 | GitHub profile README draft | Claude | cloud | todo |
| B5 | P2 | Awesome-list and directory submissions (drafts) | Codex | erik | todo (repo public since 2026-10-12; agents draft, Erik submits) |

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
| C1 | P0 | New held-out request set + re-measure v4 | Codex (seeds, expand) + Claude (judge) | local | done ([#16](https://github.com/erik-hedstrom/loadout/pull/16)): precision falls on new requests (64% vs 82%); judged through local `claude -p`, not the API (see Learnings) |
| C2 | P1 | Outcome eval on the small tier with fixed fixtures | Claude (design) | cloud (fixtures) + local (runs) | todo |
| C3 | P2 | Does Jev pick a sensible model tier? | Claude | cloud | todo (launcher only: the hook and search keep the user's model) |
| C4 | P0 | Demote generic "fits everything" skills | Codex | cloud | todo (next: C1 shows over-loading on general business requests) |
| C5 | P2 | Retrieval beyond 200 candidates (Jev tournament) | Codex | cloud | todo |
| C6 | P2 | Multi-intent requests | Claude | cloud | todo |
| C7 | P1 | Recommended packs with measured upside (first: frontend with Impeccable) | Codex (harness) + Claude (runs) | cloud (fixtures) + local (runs) | todo (after B1, C2) |
| C8 | P0 | Skill use with the hook-only plugin | Claude | local | todo |

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

**C8. Skill use with the hook-only plugin.** RESULTS has 6 of 10 for the
search tool plus the hook, and 2 of 10 for the search tool alone. The plugin
users install has the hook only. Add a plugin arm (`--plugin-dir`) to
`bench/invoke.ts` and run the same 10 requests.

Acceptance: a third row in that RESULTS table, with raw results. The README's
"has not been measured" is then replaced by the number.

## D. Integrations and robustness

| ID | P | Task | Agent | Lane | Status |
|---|---|---|---|---|---|
| D10 | P0 | In-host first: loadout as a Claude Code plugin (hook), CLI then desktop app | Codex | cloud + local + erik | blocked: desktop app check (Erik). Plugin merged in [#9](https://github.com/erik-hedstrom/loadout/pull/9) |
| D11 | P0 | Cut the hook's per-prompt start cost | Codex | cloud + local | in progress ([#14](https://github.com/erik-hedstrom/loadout/pull/14), [#24](https://github.com/erik-hedstrom/loadout/pull/24) merged: the hook's new process p50 1,781 → 1,543 ms, scan 136 → 22 ms, [RESULTS](../../bench/RESULTS.md#routed-prompts-with-the-library-scan-cache-d11-2026-10-12)); left: time the new process's own Jev steps, and the embedding model load (needs a long-lived process: Erik decides) |
| D1 | P0 | Validate on the new native Linux machine | Claude | local | todo (machine pending) |
| D7 | P1 | `loadout doctor` | Claude | cloud | done ([#20](https://github.com/erik-hedstrom/loadout/pull/20)) |
| D2 | P0 | Live Codex hook test | Claude | local + erik | todo (needs Erik to trust the hook in `/hooks`) |
| D3 | P2 | Desktop and IDE hosts end to end | Claude | local | todo (generic MCP only, 2026-10-12) |
| D5 | P2 | Isolation mode | Codex | cloud | todo |
| D4 | P2 | Gateway: native tools via `tools/list_changed` | Codex | cloud | todo |
| D6 | P2 | HTTP: cancellation reaches Jev | Claude | cloud | done ([#19](https://github.com/erik-hedstrom/loadout/pull/19)) |
| D8 | P1 | Host capability matrix (verified vs generated) | Claude | cloud | done ([#18](https://github.com/erik-hedstrom/loadout/pull/18)) |
| D9 | P1 | Codex parity: neutral session skill dir, tier presets | Claude | cloud | done ([#21](https://github.com/erik-hedstrom/loadout/pull/21)); Codex launch not re-run live |
| D12 | P0 | Codex: install the hook and search as one step, if Codex allows it | Codex | local | done ([#23](https://github.com/erik-hedstrom/loadout/pull/23)): `plugins/loadout-codex` through `.agents/plugins/marketplace.json`; install checked offline; the hook still needs `/hooks` trust; the live run is D2 |

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
- Left: `marketplace add erik-hedstrom/loadout` from GitHub (after merge); the
  live hook (D2); desktop and T3 Code.

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
| E8 | P0 | Repo-wide simplification pass | Claude (pr-reviewer finds, worker fixes) + Codex review | cloud | in progress (merged: bench/ [#11](https://github.com/erik-hedstrom/loadout/pull/11), src/ [#12](https://github.com/erik-hedstrom/loadout/pull/12), Markdown [#15](https://github.com/erik-hedstrom/loadout/pull/15)); left: the Markdown #15 did not cover (listed under E8) and the WSL-only `bench.test.ts` failure |
| E9 | P0 | Security hardening from the read-only Sol review | Codex | cloud | done ([PR #4](https://github.com/erik-hedstrom/loadout/pull/4), re-measure [PR #7](https://github.com/erik-hedstrom/loadout/pull/7)) |
| E3 | P1 | Split the test file per module | Codex | cloud | todo |
| E5 | P1 | Changelog and release automation | Codex | cloud | todo (with A4) |
| E6 | P2 | Architecture diagram in DESIGN.md | Claude | cloud | todo |
| E10 | P1 | Build without optional dependencies | Codex | cloud | done ([PR #8](https://github.com/erik-hedstrom/loadout/pull/8)) |
| E11 | P1 | Fixed-text diagnostics in the gateway and relay | Codex | cloud | done ([PR #10](https://github.com/erik-hedstrom/loadout/pull/10)) |
| E12 | P1 | A tool-less Codex bench backend (codex-cli 0.160.1 keeps unified_exec on) | Codex | local | todo |

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

Markdown left after [PR #15](https://github.com/erik-hedstrom/loadout/pull/15):
`docs/loop/BACKLOG.md`, `docs/loop/ORCHESTRATOR.md`, `bench/RESULTS.md`,
`AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`,
`.claude/agents/*.md` and `.github/pull_request_template.md`. Out of scope:
`bench/results/**` (recorded output, kept as run) and `test/fixtures/`.

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
  D10; CI does not have that PATH.

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
| 2026-10-08 (iter 3) | E10 #8; D10 #9 on merge | E11 (brief ready for Sol) | Jev about $0.05 (hook latency, probe) / Claude: one Haiku plugin probe ($0.06 reported) and pr-reviewer rounds (subscription) / Codex: four D10 review rounds (ChatGPT plan) | Desktop app check: Erik installs the plugin (D10); security contact for SECURITY.md; B1 raw-row names before going public |
| 2026-10-08 (iter 4) | E11 #10 | Approved, waiting on CI (Actions blocked by the account billing limit): #11 E8 bench, #12 E8 src, #13 label-gated CI, #14 D11. Reviews running: #15 E8 Markdown. C1 seeds and expansion under way | Jev $0 / Claude: pr-reviewer rounds (subscription) / Codex: builds, reviews, C1 seed batches (ChatGPT plan) | CI billing (raise the limit or wait for the reset); desktop app check (D10); security contact; B1 raw-row names |
| 2026-10-08 (iter 4, later) | — | C1 #16 (measured: recall holds, precision falls; reviews running). E12 found: codex exec cannot run tool-less on codex-cli 0.160.1 | Jev $0.60 (three C1 sweeps, one slowed by Jev) / Claude: judge $3.68 (C1) + $2.08 (control), pr-reviewer rounds / Codex: C1 seeds and expansion (55 batches), builds, reviews | As in iter 4 |
| 2026-10-09 (iter 5) | #13 label-gated CI (`ci-full` label created), #11 and #12 E8 bench/src, #14 D11, #15 E8 docs, #16 C1 | — | Jev $0 / Claude: merges and conflict fixes / Codex: none | Actions runs again (GitHub Pro). Next work goes to a cloud session (Claude weekly usage at 96%) |
| 2026-10-09 (iter 6, cloud) | — | Open PRs, each updating its own row: [#17](https://github.com/erik-hedstrom/loadout/pull/17) backlog statuses, [#18](https://github.com/erik-hedstrom/loadout/pull/18) D8, [#19](https://github.com/erik-hedstrom/loadout/pull/19) D6, [#20](https://github.com/erik-hedstrom/loadout/pull/20) D7, [#21](https://github.com/erik-hedstrom/loadout/pull/21) D9 | Jev $0 (no key in the cloud environment) / Claude: cloud-session credit / Codex: reviews on GitHub | Add `TYPESAFE_API_KEY` and `api.typesafe.ai` (and `huggingface.co`) to the cloud environment for D11's real-Jev run and C4 |
| 2026-10-12 (iter 7) | #19 D6, #21 D9, #18 D8, #17 backlog statuses (after fixing pr-reviewer's two Mediums), #20 D7 (Sol fixed two findings from Erik's local Codex review: Windows hook paths, Claude search-only setup), all on the full matrix. This PR: default CLIs first, loop docs for the local and cloud setups | — | Jev under $0.001 (one doctor call) / Claude: pr-reviewer rounds (subscription) / Codex: one Sol build, five Sol reviews | Actions stopped starting jobs (Pro's minutes used up, about 62% by macOS). Erik made the repo public, so standard runners are free. Left for Erik: private vulnerability reporting (off), and the items under HANDOFF decision 1 |
| 2026-10-12 (iter 8, cloud) | — | Open PRs, each in pr-reviewer and `@codex review` rounds at writing: [#26](https://github.com/erik-hedstrom/loadout/pull/26) E8, [#27](https://github.com/erik-hedstrom/loadout/pull/27) D13, [#28](https://github.com/erik-hedstrom/loadout/pull/28) A1, [#29](https://github.com/erik-hedstrom/loadout/pull/29) E6, [#30](https://github.com/erik-hedstrom/loadout/pull/30) A3, [#31](https://github.com/erik-hedstrom/loadout/pull/31) B6, [#32](https://github.com/erik-hedstrom/loadout/pull/32) D5, [#33](https://github.com/erik-hedstrom/loadout/pull/33) B4, [#34](https://github.com/erik-hedstrom/loadout/pull/34) B3 | Jev $0 (no key in the cloud environment) / Claude: cloud-session credit / Codex: GitHub reviews only (ChatGPT plan) | Decisions: each PR's "What is left"; none is labelled `ci-full` yet. Merge conflicts (pairwise, at writing): README (#28 with #30, #32, #33), `src/cli.ts` (#27, #30), `test/loadout.test.ts` (#27, #32), BACKLOG (#28 with #30, #31 with #33). Learned: Codex took 4 to 12 rounds per PR, and the docs PRs as many as the security ones (#29: 12); under load from parallel sessions, run tests with `--maxWorkers=2` and 60 s timeouts (#31); check a branch matches its remote before citing a commit |
