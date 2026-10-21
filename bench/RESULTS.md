# Routing benchmark — results

199 generated tasks (169 with a gold skill, 30 needing none) against libraries
of 1,000 to 20,000 real skills from GitSkills. Method and caveats:
[README.md](README.md). **All of these are routing results on synthetic tasks**:
they measure what reaches the agent, not whether the agent then finishes the
task.

## B1 method (preregistered)

Revised 2026-10-07 after PR #6 round 4, before any paid call. Results: [B1 results](#b1-results-2026-10-07-what-installed-skills-cost-per-request).

- Prompt: `Reply with exactly OK. Do not use tools, skills, commands, agents, or external services.`
- Named arms: baseline, obra/superpowers, anthropics/skills, skills.sh snapshot, pbakaus/impeccable, whole library, loadout MCP.
  “top50” means the first 50 saved rows by rank, including gaps, each matched to local provenance.
- Cap arms: Codex prefixes of one sorted, validated corpus at 16, 64, 256, 1024,
  omit sizes >= corpus size; full library is the final superset. Named packs supply deltas, not cap evidence.
- Two fresh Claude sessions per named arm, haiku: **14 paid CLI calls**. Codex paid
  runs are deferred on codex-cli 0.160.1 until unified_exec can be disabled.
  If all Codex gates pass, up to 22 additional gpt-5.6-luna calls (36 total); no default confirmations.
- `node --import tsx bench/overhead.ts --plan --library <dir>` prints argv/cwd, free/paid counts without running processes; retains temp files.
- Codex 0.160.1 measures **offline rendered-prompt characters and visible skill counts**, not tokens while paid runs are deferred.
  Characters are joined input_text blocks (UTF-16 length).
  Each arm saves copied/rejected, discovered/visible counts, context SHA-256 and AGENTS flag.
  Never retain context text/errors. Save offline rows despite refusal; disabled features must all read false for paid Codex. Claude runs independently.
  Shared model/sandbox/MCP/features apply to exec, prompt-input and model-free skills/list.
- Loadout MCP is required=true; Codex must expose find_skills/load_skill. Failed startup/discovery
  prevents a valid row. Free app-server queries create no threads/turns.
- Claude baseline is the **isolated CLI configuration**: `-p --output-format stream-json --verbose --no-session-persistence --restricted --setting-sources '' --settings '{"disableAllHooks":true}' --strict-mcp-config --mcp-config '{"mcpServers":{}}' --tools Skill --model haiku`.
  Record actual plugins, skills, slash commands and MCP names/statuses from init, including anything still loaded (such as synced plugins).
  Treatments add the b1 text plugin or loadout MCP; all remaining inventory must match baseline. Count pack skills by b1: prefix.
  Codex's ambient baseline with the explicit overrides above is separate from this Claude baseline.
  Baseline pair then smallest copied pack pair: both need discovered b1: skills and positive paired input deltas before other Claude arms.
  Reject zero-discovery treatments. No init-only offline CLI is documented; safe-mode pack compatibility is unverified.
  Claude missing entries are **omitted, cause unverified**; init does not prove visibility.
- Codex caps require nested discovery success and fewer visible than discovered; a character/token
  plateau alone proves nothing. Reported 2% context / 8,000-character fallback budget:
  https://developers.openai.com/codex/skills (not reverified offline).
- Codex superpowers must increase visible count, and input if paid. Claude input sums uncached/cache creation/cache read; retain numeric modelUsage
  per model. Codex total includes cached input. Preserve first/second counters. Costs in analysis; no population claim/intervals from pairs.
- Confined manifests need name/description; reject invalid files, escape/frame text, strip hooks.
  Exclude links, scripts, references, commands/agents and pack MCP/LSP servers: starting those executes downloaded code (AGENTS rule 5).
  Loadout uses repo code, a temp text library, lexical routing, no embeddings or Jev calls.
- Store sanitized rows/preflights under bench/results/<timestamp>-overhead, never transcripts/env.
  No config edits or credential copying. Host-owned state: Claude adds temp-cwd entries to
  ~/.claude.json; Codex writes logs. Outcome quality is not measured.

## B7 method (not run yet): what configured MCP servers cost per request

No measurement exists for this study; this section holds the method only, and
the harness is `bench/mcp-overhead.ts` (plan, estimate and decisions in the
backlog, B7).

- Fixture stdio MCP servers (issue tracker, database, browser, docs shapes) in
  three configurations: 1 server (10 tools), 5 (110), 20 (485).
- Claude Code, haiku, isolated configuration as in B1 but without `--tools`, so
  the built-in tool search tool is not removed. Arms: no MCP; native with
  `ENABLE_TOOL_SEARCH` default, `false` and `auto`; the servers behind
  loadout's gateway (default and `false`). Codex: no MCP, native, gateway.
- No ambient Claude plugins: every run gets a fresh empty `CLAUDE_CONFIG_DIR`
  under the work root and requires `CLAUDE_CODE_OAUTH_TOKEN` for Erik's personal
  subscription. Init must report `plugins: []`; missing, malformed or non-empty
  plugins refuse the measurement, regardless of where plugin files live.
- Two fresh sessions per arm, strictly one command at a time, every command of
  every arm in one working directory that is emptied before it (both hosts put
  the working directory in the prompt). Claude sends two requests in one process
  (`--input-format stream-json`, `--no-session-persistence`); the counters of
  each request are those of its assistant message: uncached, cache creation and
  cache read input tokens. Codex sends one `--ephemeral` request with
  `--ignore-user-config --ignore-rules`: a second turn would need a persisted
  session.
- Deferral is inferred, not reported by the host. A row is invalid, and not
  recorded, unless it passes its controls:
  - every MCP arm has a positive input delta over the same host's baseline;
  - Claude: every declared server is connected and no others (from the init
    list);
  - Claude with tool search off lists every fixture tool;
  - Claude with the default or `auto` lists every tool, or lists ToolSearch and
    answers a canary: a third message, not measured and bounded by
    `--max-turns 4`, asks for the last tool of the last server. Its lookup must
    be a non-error ToolSearch result with a `tool_reference` block whose
    `tool_name` is exactly the qualified tool; text that mentions the tool does
    not count;
  - the gateway lists loadout's four tools, or lists ToolSearch (tool search
    defers loadout's own tools too), and a non-error `server_tools` result for
    the canary's server has the tool's own line; `find_tools` may be tried
    first;
  - Codex's `app-server`, on an empty temporary `CODEX_HOME` like every free
    command, lists exactly the declared servers and tools. That checks the
    declaration, not what the paid exec loads (backlog, B7, "Isolation").
- Reading column: Claude rows read "all loaded" with tool search off, "all
  loaded (ToolSearch present)" or "(no ToolSearch)" where the default or `auto`
  listed every tool, "deferred (canary found)" where fewer were listed, and
  "gateway" for the gateway arms (the listed-tool columns show whether loadout's
  own tools were deferred). Codex rows read "not shown": `exec` reports no tool
  list. No model-free tool inventory was found for Claude (`init.tools` lists
  what is loaded; whether `/context` runs under `-p` is unverified); Codex's
  `mcpServerStatus/list` is one.
- What each CLI can load, and what the harness does about it
  (refuse, neutralise with a flag, or record as identical across arms), is one
  table: backlog, B7, "Isolation". The plan prints it, and a `--run` saves the
  names of the identical items present in `host-state.json`. A live Codex cloud
  bundle, live server-managed Claude settings and the Windows
  registry policy are not seen; the plan prints them as preconditions.
- The host version is stored on each row and may not change during the study;
  Claude's skill, command and agent inventory and Codex's version may not
  drift.
- Host writes are printed by the plan. Claude settings, history and plugins
  move to its temporary home ([env-vars, `CLAUDE_CONFIG_DIR`](https://code.claude.com/docs/en/env-vars));
  relocation of `~/.claude.json` bookkeeping and the MCP log cache is unverified,
  so both remain listed conservatively. Codex's database writes and API-key
  alternative remain Erik's decision (backlog, B7).

## C14 method (not run yet): three prompts with and without loadout

No usable measurement exists for this study. A first Codex pilot (2026-10-20,
at e9d7239) is confounded: Codex loaded the global `$CODEX_HOME/AGENTS.md` into
every run of both arms, and the loadout agent's search query repeated its text
(see the backlog, C14). It is not a result; the harness now refuses a study
while that file, or `AGENTS.override.md`, exists. The harness is `bench/ab.ts` (backlog,
C14); `npx tsx bench/ab.ts` prints the plan and the estimate and spends
nothing.

- **Prompts.** `c1-web-14` (404-page copy), `c1-apps-08` (a questionnaire),
  `c1-debug-13` (a mobile menu that will not close, with a small fixture
  project and a hidden test). The selection rule: held-out C1 **test** rows
  where all three 2026-10-16 Jev reruns loaded the same set and the C1 judge
  rated a loaded skill useful, one per kind (copy, document, code). These are
  cases where loadout should help. They are not a random sample, so no general
  claim follows from them.
- **Hosts and arms.** The stock `claude` (2.1.281, `sonnet`) and `codex`
  (0.160.1, `gpt-6.1-sol`), each **bare** and with **loadout** as the documented
  install gives it: for Claude the shipped plugin (its prompt hook) and the
  `loadout` MCP server; for Codex the MCP server and the prompt hook. B7's
  isolation applies to both arms: allowlisted environment, a fresh Claude home
  with the subscription token, `--ignore-user-config` for Codex, so no ambient
  plugin or MCP tool reaches the numbers. The arms share every other flag, the
  model, the turn cap and the timeout. One difference from the Linux plugin
  install: the Codex MCP server is `required = true`, as `loadout setup codex`
  writes it, so a failed start stops the run; the plugin leaves it out on
  purpose (comment in `src/launch.ts`).
- **Tokens.** Per model request from the host's own report, with uncached input,
  cache writes, cache reads and output always apart. Claude: each assistant
  message's usage, deduplicated by message id. Codex: `codex exec --json` gives
  the thread total once per run (`turn.completed` carries the running total, in
  codex-rs `exec/src/event_processor_with_jsonl_output.rs` at rust-v0.160.1), so
  Codex has no per-request split. Effective input weights Claude's cache writes
  1.25 (5 minutes) or 2 (1 hour) and reads 0.1 (Anthropic's published
  multipliers); Codex's is not shown.
- **Cold-cache skew.** The arms have different prefixes (loadout adds MCP tool
  definitions and, per prompt, the hook's context), so each has its own cache
  entry, and a cold first run would charge cache writes to whichever arm ran
  first. So each host and arm gets one **warm-up run** on a neutral prompt,
  recorded and excluded from every comparison, and the measured runs alternate
  bare and loadout, the arm that goes first alternating by prompt and repeat.
  Each request's gap since the same arm's previous request is stored, and a gap
  over 5 minutes flags the run `coldCacheRisk`. Request 1 of each run is
  reported apart from requests 2+: the per-prompt hook context cannot be cached
  the first time, and later requests should read it from cache. The warm-up
  (cold) and measured (warm) runs are shown side by side.
- **Quality.** The `c1-debug-13` hidden test (outside tap closes, Escape
  closes, an inside tap does not, the menu reopens, listeners are removed) is
  run on a copy of each run's folder and never put in the agent's. The
  deliverables are then compared blind in both orders (only a preference that
  holds in both counts), cross-family: Claude-host outputs by Codex (Sol),
  Codex-host outputs by Claude Opus. Skill names are removed from both arms'
  files first; a skill's own template can still show the arm.
- **Sample.** Two repeats per cell: ranges, not intervals, and "not shown" where
  the sample does not support a claim.
- **What stops the batch.** A loadout arm that routed by keyword (the hook's
  no-key warning or Jev-fallback note, or a `find_tools` result tagged as a
  keyword match), a held TypeSafe key or Claude subscription token in any work-tree
  file (binary included), relative path, stdout, stderr, hook capture or hook-capture
  stderr, and token shapes in deliverable paths or text about to be copied. These
  checks cover warm-ups too, except that their deliverables are not copied or
  shape-checked. A hit copies nothing, saves no stream, skips the hidden test and
  records an invalid row without matched text; a credential-bearing path is
  recorded as `<credential-bearing path>`. Token shapes in stdout only withhold
  that run's stream (`streamWithheld: "token shape"`); usage and tools are still
  parsed in memory and the run can count. Token shapes in excluded files,
  binaries, stderr and hook captures are not checked. Codex's login token is
  never read. A loadout hook that exited non-zero or never finished also stops
  the batch (the shim records each exit status; the Claude stream's hook response
  is checked too), as do the plugin, hook, server or model checks.
  Before any agent runs, each judge the hosts need is checked (`codex features
  list` must show `shell_tool` and `unified_exec` off): on the codex-cli
  versions seen so far (0.154.0, 0.160.1; E12) it does not, so a study with the
  Claude host is refused up front rather than after its quota is spent, and only
  `--hosts codex` (judged by Claude) runs. Claude runs need the key in a key file named by the loadout config,
  because the variable alone may not reach the MCP server or the hook. An
  `--out` folder is one study: it is not resumed with other settings or past
  such a row, nor after the code or a skill's text or description changed (a
  commit and a library fingerprint are stored), and a resume works in the same temporary folder, which keeps the
  working directory in the cached prefix unchanged.
- **Rows.** `bench/results/<timestamp>-ab-pilot/`: `rows.jsonl` (names only, no
  paths, no skill text), `outputs/` (the deliverables, this machine's folders
  written as variables), `verdicts.jsonl`, `report.md`. The raw streams are
  kept in `streams/`, which is gitignored: they hold file contents, local paths
  and the hook's skill text.
- **Not verified offline** (the first paid runs check them): `--max-turns` is
  absent from `claude --help` 2.1.281; whether `Bash(node --test *)` matches the
  agent's test command; whether the Codex hook registers through `-c
  hooks.UserPromptSubmit` with `--dangerously-bypass-hook-trust` (the source
  says it should; the shim's count decides); whether the key file and a
  non-default `LOADOUT_HOME` reach `loadout mcp` and the hook under Claude's MCP
  environment allowlist and subprocess scrub (a keyword-routed loadout run
  stops the batch).

## B1 results (2026-10-07): what installed skills cost per request

Note (2026-10-14): B1 measured the earlier `find_skills` tool text. The tool is now `find_tools` with a changed description (skills-only: 336 and 492 characters for the server instructions and the tool description, instead of 337 and 473), so the figures below describe the earlier text and are not remeasured.

Raw rows: [bench/results/2026-10-07T21-04-16-645Z-overhead/](results/2026-10-07T21-04-16-645Z-overhead/).
Claude Code CLI, haiku, two fresh sessions per arm, deltas over the
baseline's 6,728 input tokens (call 1 / call 2). The baseline is not bare:
inside the isolated CLI configuration it still lists 19 ambient skills and 2
claude.ai-synced plugins.

| Arm | Skills copied (discovered) | Claude input delta |
|---|---:|---:|
| impeccable | 1 (1) | +216 / +212 |
| superpowers | 15 (15) | +312 / +308 |
| anthropics | 19 (19) | +330 / +333 |
| top50 | 50 (50) | +477 / +476 |
| whole library | 1,262 (1,232; 30 omitted, cause unverified) | +12,283 / +12,284 |
| loadout MCP | 0 | +546 / +546 |

- The listing grows with the library: about **10 tokens per added skill**
  between 50 and 1,232 discovered skills, ((12,283 − 477) / 1,182). The
  listing cap does not bound it. Pack skills were listed under generated
  names (`b1:b1-0000`, …); the library's real folder names average 18.2
  characters against 7, so the cost with real names is not shown.
- The earlier ~140k-token figure for 1,262 skills summed full descriptions
  (HANDOFF). The measured cost is 12.3k tokens, about 11 times less. That
  estimate is withdrawn.
- **At 50 skills, loadout's tool definitions cost more than the native
  listing** (+546 against +477). A straight line between the 50- and
  1,232-skill arms crosses +546 near 57 skills. That is an interpolation of
  listing overhead only. Router calls, the skills loadout returns, and where
  real libraries cross over are not measured.
- Nearly all input was cache creation (uncached: 10 tokens). Multi-turn
  sessions, where the listing is read from cache after the first turn, are
  not measured, so cost in money per session is not shown.

Codex (codex-cli 0.160.1, offline `debug prompt-input`, rendered characters;
paid runs deferred, see the method): the whole rendered prompt stops growing
at about 15.7k characters over baseline by 50–64 skills (top50 +15,669,
cap-64 +15,725, cap-256 +15,766). All 256 skills in cap-256 stay visible. At 1,024
and 1,262 skills only **424 are visible** (the library arm adds +15,126).
Codex bounds the rendered listing and drops skills instead. The loadout arm's MCP tool
definitions are not part of the rendered text, so its Codex cost is not
shown.

Validity: the first attempt
([2026-10-07T20-59-10-578Z-overhead](results/2026-10-07T20-59-10-578Z-overhead/))
stopped after 2 paid calls. The inventory guard fired when a claude.ai-synced
plugin disappeared between the two baseline calls. Four diagnostic probes,
each killed at its init event and not committed, then agreed. Whether a
model request had started is not verified, so they count as up to 4 more
calls. The rerun passed every guard. Spend: 16 haiku calls with rows (about
136k input tokens) plus up to 4 probes, on the subscription. No Jev or Codex
spend.

## C13 (2026-10-16): pure-Jev baseline on main

Before more Claude Code and Codex spend, the router on main (155d7ec, after
D15 and B7) was measured with Jev alone: three identical sweeps of v4's 315
requests and of C1's 300, and the gold-label route bench. No retuning, no new
judging: the sweeps are scored offline against the earlier judgements
(`judge.ts --offline`, backlog C13). Library and embeddings as in v4 and C1.

**Quality, test split** (95% Wilson intervals). Offline scoring reuses the
judge's earlier ratings; a load it never rated is "unrated", and load
precision is given as a pair: unrated counted not useful / counted useful.

Usefulness rows are lower bounds: they count only skills the judge already rated helpful.

| | v4 runs 1 / 2 / 3 (121 need) | v4 control, post-E9 | C1 runs 1 / 2 / 3 (84 need) | C1 at 7d90442 |
|---|---|---:|---|---:|
| A useful skill loaded | 74% / 74% / 74% (65–81) | 72% | 70% / 70% / 70% (60–79) | 73% |
| Useful loaded or offered | 85% / 86% / 87% | 85% | 80% / 80% / 80% | 80% |
| Nothing loaded when none is needed | 82% / 82% / 82% | 82% | 75% / 75% / 75% | 74% |
| Loaded skills that are useful | 78–82% / 80–82% / 79–82% | 80% | 65–71% / 67–70% / 67–70% | 64% |
| Unrated loads | 7 / 4 / 5 of ~155 | — | 7 / 3 / 4 of ~115 | — |

- Quality on main is within the intervals of the earlier runs on both
  request sets. C1's precision gap against v4 is still there.
- Misleading loads: **not shown.** Offline scoring counts only loads the
  judge already rated misleading (1–2%), and the unrated loads could be
  misleading too. C1's 7% at 7d90442 is not comparable until they are judged.
- v4 is scored against the post-E9 control's ratings only. Pooling all four
  earlier v4 judgings fails: the judge rated the same request and skill
  differently in two of them (`integrations-04`, `cli-creator`).
- "Missed a clearly better skill" is not shown offline.

**Gold tasks** (route bench, 199 tasks × 1,000 / 5,000 / 20,000 skills,
policy tuned on dev, reported on test): recall 93% / 92% / 90% with 5%
needless loads at the default budget; v3 had 94% / 95% / 93% with 5%. A second
complete run of the same bench, started 10 minutes earlier on the same
checkout (its origin was not recorded), gave 93% / 93% / 92%, 5% needless.
Both are within v3's pooled interval (90–96%).

**Stability** (`bench/stability.ts`, test split):

| | v4 (213) | C1 (201) |
|---|---:|---:|
| Same loaded set in all three runs | 89% (190) | 91% (183) |
| Mean pairwise Jaccard, loaded | 0.95 | 0.95 |
| Same loaded-or-offered set in all three runs | 83% (177) | 84% (168) |

- About one request in ten gets a different loaded set on an identical rerun.
  Single-run differences smaller than that are noise.
- Keyword fallbacks: 1 in 1,815 decisions.
- Latency per decision fell within the hour (test split): p50 from 2.8 s
  (v4) and 2.0 s (C1) in the first runs to 1.0 s and 0.9 s in the last, p95
  from 6.6 s and 5.2 s to 1.3 s and 1.1 s. Both parts fell: the Jev calls'
  wall time (p50 2.1 → 0.9 s, v4, all rows) and the local remainder (0.57 →
  0.10 s).
  The machine ran other work during the first runs, and a Jev call's wall time
  includes client-side delay, so the cause is not shown.
- Cost per decision: $0.00122 (v4) and $0.00117 (C1).

Rows: `results/2026-10-16T17-39-02-sweep/`, `18-07-05`, `18-19-29` (v4);
`17-54-45`, `18-15-07`, `18-22-14` (C1); `18-24-39-…` and `18-14-42-…` (gold);
`results/2026-10-16-jev-baseline/` (stability and the scripts that ran the
burn and the scoring); the gold numbers are in each gold run's `summary.md`. Cost: Jev $2.21 for the sweeps and about
$0.57 per gold run; scoring $0.

## C1 (2026-10-08): new held-out requests

v4's 315 requests had been used for tuning twice, so the router was measured
again on 300 new ones, with no retuning.

**Setup**
- **Requests:** gpt-6.1-sol wrote 300 seeds in v4's 17 categories, scaled to
  300, from the prompt in [seeds.ts](seeds.ts), with no library in view. It
  then expanded them with [expand.ts](expand.ts)'s prompt:
  [requests-c1.jsonl](data/requests-c1.jsonl).
  - None repeats a v4 seed.
  - The expansions run 65–218 words, median 100. v4's Sonnet expansions had
    a median of 199.
  - Both steps ran through `--backend files`, so the provenance reads
    "unverified": `--backend codex` refuses because codex-cli 0.160.1 keeps
    its exec tools on (backlog E12). The script that answered the batches is
    committed with them.
- **Router:** main 7d90442, with the library and embeddings as in v4. 2 of
  300 decisions fell back to keyword ranking. Mean 1.92 s and $0.0012 per
  decision.
- **Judge:** Opus with the whole catalog, as in v4: a blind pass, then
  adjudication of disagreements. Codex wrote the requests, so the judge is
  not grading its own family.
- **Control:** the post-E9 sweep of v4's requests (same router code)
  adjudicated with v4's blind answers. It separates new requests from code
  drift.

| Test split | C1: 201 new (84 need a skill) | Control: v4 requests, post-E9 code (121 need) | v4 run C |
|---|---:|---:|---:|
| A useful skill loaded | 73% (62–81) | 72% (63–79) | 76% (68–83) |
| Useful loaded or offered | 80% (70–87) | 85% (78–90) | 86% (79–91) |
| Nothing loaded when none is needed | 74% (65–81) | 82% (72–88) | 84% (75–90) |
| Loaded skills that are useful | **64%** (55–72) | 80% (73–86) | 82% (75–87) |
| Loaded skills that would mislead | **7%** (4–13) | 1% (0–5) | 1% (0–4) |
| Injected skills that are useful | 90% (70–97) | 79% (60–90) | 84% (67–93) |

(95% Wilson intervals; load-level intervals ignore within-request correlation.)

- **Recall holds; precision does not.** On new requests, loadout loads a
  useful skill about as often as before, but a third of what it loads is not
  useful, against a fifth before. Misleading loads rose from 1% to 7%.
- **Why, as far as shown** (all 300 requests, per-category tables in the
  reports):
  - Fewer of the new requests need a skill: 128 of 300 (43%), against 189
    of 315 (60%).
  - **Business** carries most of the drop. The judge says 4 of 29 new
    business requests need a skill, against 25 of 30 of v4's (invoices,
    payroll). loadout loaded something for 16 of the 25 that need none.
    Of its 22 business loads, 5 were useful and 4 misleading.
  - **Web** adds 5 of the 10 misleading loads (5 of 30 loads; control 0 of 26).
  - Without business, precision is 72% (121/169), against 82% (162/197) for
    the control. So business explains part of the gap, not all of it.
  - Non-useful loads come from both load paths: the close-comparison winner
    and P(exact). In C1's dev split they are both generic process skills and
    domain skills matched on surface words.
- **Not shown:**
  - whether shorter prompts cause it: length is confounded with need;
  - whether the judge treats the two sets differently. One check found no
    sign: after listing a skill blind, the judge rated it neutral in 3 of 35
    cases (C1 dev) and 3 of 41 (control).
- **What changes:** v4's precision numbers overstated precision on
  requests outside the tuning set. The need gate loads too readily on
  general business and planning requests. Backlog C4 tests fixes on C1's dev
  split. C1's test split stays untouched for reporting, and v4's 315
  requests are free to tune on.

The first C1 sweep is recorded but not judged: 98 of 300 rows fell back to
keyword ranking while Jev was slow (median 9.8 s even on the rows that
answered). An 8-row probe shortly after answered through Jev, and the rerun at
concurrency 2 had 2 fallbacks.

Rows: [results/2026-10-08T13-13-52-sweep/](results/2026-10-08T13-13-52-sweep/)
(C1), [results/2026-10-07T21-34-39-sweep/](results/2026-10-07T21-34-39-sweep/)
(control), [results/2026-10-08T12-56-16-sweep/](results/2026-10-08T12-56-16-sweep/)
(the slow run), [results/2026-10-08-c1-heldout/](results/2026-10-08-c1-heldout/)
(seed and expansion batches). Cost: Jev $0.60 over three sweeps; judge $3.68
(C1) and $2.08 (control) of Claude usage; Codex on the ChatGPT plan.

## E9 re-measure (2026-10-07): routing after the Jev framing change

E9 changed what Jev sees: library names, descriptions and excerpts are now
always escaped and framed as third-party data. This entry checks whether that
moved the v4 decisions. Two sweeps of the same 315 requests were run on main
at 662e0d5 (E9 merged), with the same library and embeddings. `bench/agree.ts`
measures agreement on the 213 test-split requests. The McNemar column pairs
each v4 comparison with the floor on the same requests, as an exact test
reporting discordant counts and p. It is exploratory: four tests are reported
(two on the test split, two on all 315), uncorrected.

| Comparison | Same loaded skills | McNemar vs floor | Same load-vs-quiet |
|---|---:|---:|---:|
| Post-E9 run 1 vs run 2 (identical code: the floor) | 197 (92.5%, 88–95%) | — | 206 (96.7%, 93–98%) |
| v4 vs post-E9 run 1 | 188 (88.3%, 83–92%) | 17 vs 8, p = 0.11 | 199 (93.4%, 89–96%) |
| v4 vs post-E9 run 2 | 186 (87.3%, 82–91%) | 17 vs 6, p = 0.035 | 200 (93.9%, 90–96%) |

(95% Wilson intervals.)
- **Jev is not deterministic.** In the one repeat pair, identical code
  changed the loaded set for 16 of 213 test requests (about 1 in 13).
- **Decisions probably shifted across E9.** Agreement with v4 is 4–5 points
  below the floor. The paired test is nominally significant for one of the
  two runs. On all 315 requests the same comparison gives p = 0.004 and 0.050.
  How large the shift is cannot be bounded from one repeat pair.
- **The cause is not identified.** E9's framing, its escaping, and any
  server-side drift since v4 cannot be separated.
- **The direction is not shown.** Skills loaded per request: 0.75 (v4), 0.73
  and 0.74 (post-E9). No request fell back to keyword ranking. The changed
  rows are not judged, so whether quality rose or fell is unknown.
- The v4 quality numbers describe v4's decisions. They will be re-established
  on C1's new held-out requests rather than by re-tuning on these.

Rows: `results/2026-10-07T21-34-39-sweep/` and
`results/2026-10-07T21-40-26-sweep/`. Cost: $0.77 of Jev for two sweeps,
with no judge calls.

## v4 (2026-10-06): realistic requests on the real library, judged

The question here is different from v1–v3: on what people actually type, are
the choices **reasonable**? No gold labels exist for that, so a frontier model
judges them.

**Setup**
- **Library:** the user's real library, 1,262 skills from 32 sources: the
  v3 library, plus Anthropic's
  [knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)
  (finance, legal, sales, small business…) and the specific skills from
  [awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)
  (invoice organizer, resume tailoring…).
- **Requests:** 315 seeds written by Codex (gpt-6.1-sol, no access to the
  library) across 17 categories, from invoices and payroll to MCP servers,
  RNA-seq and "rename this variable" ([seeds.jsonl](data/seeds.jsonl)). Each was
  expanded by Sonnet 5.5 into the detailed prompt a user's prompt-improvement
  step would send: 81–286 words, median 199
  ([requests.jsonl](data/requests.jsonl), [expand.ts](expand.ts)). Neither
  model saw the library.
- **Judge** ([judge.ts](judge.ts)): Claude Opus 5.5 with the whole catalog
  (1,262 keys and descriptions). It works in two passes:
  - **Blind:** without seeing loadout's choice, it says whether each request
    needs a skill (none / helpful / essential) and lists up to 5 useful skills,
    best first. Answers that contradict themselves ("none" with a list) are
    asked again. Result: 189 requests would benefit from a skill (28
    essential), and 126 need none.
  - **Adjudication:** where loadout disagrees with the blind answer, the judge
    rates each loaded skill (helpful / neutral / misleading) and names any
    clearly better skill that was missed. These ratings override the blind
    list.

  Cost: $4.41 for the first run's blind pass and adjudication, then $1–2 per
  re-adjudication.

**Three runs over the same 315 requests** (the rule was tuned on the dev split,
102 requests, and is reported on the test split, 213):

| Test split (121 need a skill, 92 need none) | A: v3 rule | B: new rule | C: new rule + embeddings |
|---|---:|---:|---:|
| A useful skill loaded | 63% | 72% | **76%** (68–83) |
| A useful skill loaded or offered | 83% | 81% | **86%** (79–91) |
| Nothing loaded when none is needed | 80% | 83% | **84%** (75–90) |
| Loaded skills that are useful | 75% | 80% | **82%** (75–87) |
| Loaded skills that would mislead | 2% | 3% | **1%** (0–4) |
| Injected skills that are useful | 77% | 77% | **84%** (67–93) |
| Skills loaded per request | 0.74 | 0.70 | 0.74 |

(95% Wilson intervals for C.) Across all 315 requests, C:
- loads a useful skill for 78% of the requests that need one;
- loads a helpful skill for 27 of the 28 essential ones;
- costs $0.0011 per decision.

Rows: `results/2026-10-06T{02-08-14,05-40-33,06-06-36}-sweep/`.

**What changed, and why**
1. **The winner rule (B).** On detailed prompts, the right file-format or
   domain skill often wins the close comparison clearly (`pdf` share 0.83 for
   "redact my phone number from this PDF") but is rated "helps with part",
   because a 200-word request asks for several things. Meanwhile generic
   process skills (`implement`, `planning-and-task-breakdown`) match a
   step-by-step request "exactly". New rule: load at P(exact) ≥ 0.8 with share ≥
   0.1, or the comparison's winner (share ≥ 0.5) with expected fit ≥ 0.7. On
   the v3 benchmark (test split) it keeps recall, top-1 and needless loads
   unchanged at all sizes and loads fewer skills (1.24 vs 1.50 at 20k).
2. **Embedding retrieval on by default (C).** Long prompts dilute BM25: the
   judge's best skill was in the top 200 candidates for 80% of requests with
   BM25 alone, and 87% with embeddings fused in (seeds: 67% → 78%). On the v2
   synthetic benchmark embeddings added nothing, which is why they were off.
3. **Mentions inside code are not mentions.** A Telegram bot request listing
   `` `/start` `` loaded a bio-research skill named `start`.

**Where it is still weak** (run C, by category):
- integrations, 3 of 7 (e.g. `mcp-builder` is still missed for one MCP-server
  request);
- ML, 4 of 9, with 2 misleading loads;
- apps, 1 of 3;
- productivity, 4 of 7;
- too eager on web and writing tasks that need nothing (quiet 1 of 4 and 6 of
  10): `frontend-ui-engineering` reads as an exact fit for most UI work.

It is strong on documents (27/30), business (21/25), debugging (15/15),
security (13/15), devops (8/9) and media (8/9). It stays quiet on 33 of 35
everyday edits and on 10 of 10 conceptual questions.

**Where the remaining misses come from** (run C, the 41 requests that need a
skill but got no useful one loaded):

| Stage | Requests |
|---|---:|
| Shortlisted with fit ≥ 0.7 and **offered**, not loaded | 14 |
| Below the need gate | 10 |
| Shortlisted, but Jev rated the fit low (the judge rated it useful) | 9 |
| Not shortlisted | 8 |

The agent can still reach the offered skills: they are in the generated
plugin, or listed by the hook. The rest are spread across stages, and no
category-specific rule fixes them without overfitting these 315 requests.

**Tried and dropped: a platform-mismatch veto** ([mismatch-probe.ts](mismatch-probe.ts),
$0.007). The 4 misleading loads all assume a product or stack the request
never mentions: `lark-calendar` for generic scheduling, a RAPIDS skill for a
PyTorch out-of-memory problem, a Google agent-framework eval skill for a
generic Q&A dataset. A per-candidate question ("does this skill depend on a
product, platform or stack the request doesn't mention?") did not separate
them. At ≥ 0.7 it vetoes 1 of the 4 but also 11 of 195 helpful loads, mostly
media skills built on one vendor's service, which the user is happy to use. A
second phrasing ("would it push the work onto a different stack?") caught none
at ≥ 0.7.

**Injection.** None of the injections that missed was misleading. All were
neutral general skills, mostly on requests the judge says need nothing (a test
pipeline for a one-line test, task breakdown for a dissertation schedule). A
higher need bar for injection does not separate them: it drops helpful ones
faster.

**Terse seeds vs detailed prompts** (v3 rule, not judged). The load rates are
similar (47% vs 49%). Where both load something, the top pick is the same 84
of 111 times. The judge's labels are not reused for the seeds: expansion adds
details (a framework, a format) that change which skills fit, so the seeds
would need their own blind pass.

**Caveats.**
- One judge model, from the same family as the expander.
- The rule was tuned on the dev third of these requests. The test-split numbers are
  the honest ones, and their intervals overlap between B and C.
- Requests are synthetic, even if independent of the library.
- 17 categories of 10–35 requests each, so the per-category numbers are rough.

### Do agents use what they are given?

Measured with [invoke.ts](invoke.ts) on requests from the sweep:
- runs are headless, capped at 8 turns (Claude) or 4 minutes;
- each starts in an empty folder where the agent may edit files but runs no
  unapproved commands;
- a note tells the agent to make up sample inputs where the request mentions
  attachments;
- Claude Code ran Sonnet 5.5 throughout and Codex ran gpt-6.1-sol.

A skill counts as opened when the agent invoked it (Claude's Skill tool),
read its SKILL.md, or loaded it through `load_skill`, and the call succeeded.

| | Claude Code | Codex |
|---|---:|---:|
| **Routed** (loadout's selection preloaded): opened a loaded skill | 9 of 10 | 11 of 11 |
| …and also searched the library for more | 4 of 10 | 3 of 11 |
| **Search only** (nothing preloaded; `find_skills` attached): searched on its own | 2 of 10 | 5 of 10 |
| …and loaded a skill the judge lists as useful | 2 of 2 | 5 of 5 |

- **Routed sessions work.** The agents use what loadout puts in front of them.
  For example, Claude invoked `contract-review`, `job-post-builder`,
  `background-removal` and `xlsx`. In 4 runs it also searched mid-task and
  added skills; for a map chart it found `geopandas`. The one miss implemented
  a Figma design without opening `figma-implement-design`.
- **Search alone is not enough.** When an agent searches, it finds the right
  skill every time (7 of 7). But it searches only when the task feels
  unfamiliar (PDF redaction, RNA-seq units, video generation). It skips the
  search for work it believes it knows, such as an MCP server, an Obsidian
  note, a changelog, a vendor review or a threat model, even though the
  library has a skill for each. Server instructions and tool wording raised
  Codex's rate from 3 to 5 of 10; Claude's stayed low. So the upfront router
  carries the load, and `find_skills` is the mid-session supplement, not a
  replacement.

**The prompt hook closes most of that gap** (2026-10-07). Same 10 requests,
Claude Code (Sonnet 5.5), nothing preloaded. As after `loadout setup
claude-code`, the session has the loadout MCP server plus the `UserPromptSubmit`
hook, which routes the prompt and adds the skills that fit as context:

| Claude Code, same 10 requests | Opened a skill the judge rates useful | Hook injected a skill's full text |
|---|---:|---:|
| Search tool only | 2 of 10 | no hook |
| Search tool + prompt hook | **6 of 10** | not recorded |
| Hook-only plugin, as users install it (2026-10-12) | **0 of 10** | 6 of 10 |

In the 4 misses the hook did offer the right skill, and Claude still did not
open it:
- it answered the changelog and vendor-review requests in text, without
  calling any tool;
- on the MCP server and the threat model it used up its 8 turns or 4 minutes
  first (shell commands are not approved in these runs).

**The hook-only plugin gets a skill to the agent only when it injects the
skill's text; in these runs Claude could not open a skill it was pointed to**
([C8](../docs/loop/BACKLOG.md), [#25](https://github.com/erik-hedstrom/loadout/pull/25)).
`plugins/loadout` was loaded with `--plugin-dir`, with no MCP server. Every
row passed the bench's checks: the plugin was loaded, one loadout hook ran
(counted by the bench's own PATH shim), and no other loadout hook or plugin
was present. The hook added `<skill_relevance>` context on all 10 prompts.
- **In 6, it also injected one skill's full text:** `mcp-builder`,
  `changelog-generator`, `vendor-review`, `uncertainty-and-units`,
  `security-threat-model` and `statistical-analysis`. Whether the judge rates
  each one useful is not shown for this arm; the hook arm above opened
  `uncertainty-and-units` and `statistical-analysis` on the same requests.
  Whether Claude followed the injected text is not measured.
- **Claude opened no library skill (0 of 10).** On the other 4 requests the
  context only pointed to a skill. It says to call `load_skill`, or to read
  `SKILL.md` in the folder given. The plugin has no `load_skill`; that was the
  search arm's MCP server, through which the hook arm opened skills on these
  same 4 requests.
- Reading the folder failed. A one-call probe on the same setup got: "Claude
  requested permissions to read from \\\\wsl.localhost\\…\\SKILL.md, but you
  haven't granted it yet". In a headless run nobody can grant it.
- 7 runs used their 8 turns, mostly on shell commands that were not approved.
  3 finished: 2 answered in text without a tool call, and 1 made one
  successful `Skill` call, then wrote files. That tool reaches only skills
  installed in Claude Code, not the library, so it does not count as opened.

So this shows the headless case, with loadout in WSL behind Windows Claude
Code. An interactive session would ask the user for permission to read each
skill: not measured. The arm also differs from the two above in that the
bench's shim is first on PATH; that changes how the hook is reached, not what
the agent sees.

Raw: [invoke-claude-plugin.jsonl](results/2026-10-06T05-40-33-sweep/invoke-claude-plugin.jsonl).
Cost: $1.93 reported by Claude Code (Sonnet, subscription); Jev under $0.02.

These are small samples (10 requests per cell, capped runs), not outcome
measurements: they show whether the skill reaches the agent's context, not
whether the result is better.

### The hook plugin in the Claude Code CLI (2026-10-08)

**The context arrives.** One `claude -p` run loaded the plugin with
`--plugin-dir plugins/loadout` (Haiku, at most 2 turns, hook events on). A
shim on PATH ran this branch's `loadout` in WSL, against the 1,262-skill
library. loadout's `UserPromptSubmit` hook exited 0 with empty stderr. It
added about 1.6k characters of `<skill_relevance>` context: `contract-review` as
most relevant, plus three others. The reply named `contract-review`. One run
shows the wiring works. It does not measure skill use: the hook-only plugin
has not been compared with the 6 of 10 above.

**Latency.** [hook-latency.ts](hook-latency.ts), 20 dev prompts, real Jev, WSL,
Node 24.15, the same library:

| Step (ms) | p50 | p95 | max |
|---|---:|---:|---:|
| scanLibrary | 164 | 202 | 1,004 |
| Jev wide | 746 | 1,346 | 2,285 |
| Jev close | 462 | 657 | 781 |
| promptContext, in process | 1,356 | 1,977 | 3,262 |
| `loadout hook claude`, new process | 2,608 | 3,137 | 3,332 |

- Every routed prompt waits about 2.6 s (p50) before Claude starts. The new
  process's median is 1.25 s above the in-process one. Each arm made its own
  Jev requests, and the subprocess was not timed by step, so how much of
  that is start-up, imports, the library scan or the model load is not shown.
- The scanLibrary, Jev wide and promptContext maximums come from the first,
  cold sample.
- The deadline (20 s, with 8 s per Jev request) never bound: the slowest run
  took 3.3 s. It stays as it is. A hung Jev costs a prompt one 8 s timeout,
  plus start-up and any completed request, before the keyword fallback.
- n = 20, from one machine on one evening. Latency from elsewhere: not shown.

Raw: [results/2026-10-07T22-54-56-747Z-hook-latency/](results/2026-10-07T22-54-56-747Z-hook-latency/)
and [results/2026-10-08-hook-plugin-probe/](results/2026-10-08-hook-plugin-probe/).
Cost: about $0.05 of Jev; the Haiku run reported $0.06.

### Hook start-up (D11, 2026-10-08)

Measured in WSL with Node 24.15 and the 1,262-skill library, embeddings on.
Each sample is a fresh process.

**Steps before Jev.** [phases.mjs](results/2026-10-08-hook-phases/phases.mjs)
runs `runHook`'s steps up to the Jev call, n = 11. Medians:

| Step | ms |
|---|---:|
| Node start, to the script's first line | 20 |
| Imports of config, library, route, hook and embed, summed | 28 |
| scanLibrary | 262 |
| cachedEmbeddings | 131 |
| First query embedding | 186 |
| repoSignals | 14 |

**Follow-ups.** A follow-up ("yes", "continue") adds no context, but each one
ran the whole start-up before `promptContext` dropped it. The command timed
is `echo '{"prompt":"yes"}' | node dist/cli.js hook claude`, n = 11:

| Build | Median ms | Range |
|---|---:|---:|
| main 7d90442 | 536 | 525–568 |
| Follow-ups return before start-up | 149 | 142–204 |
| `relay.js` imported only by `mcp-launch` | 63 | 58–85 |
| Bare `node -e ''`, for comparison | 25 | 24–30 |

- After the first cut, most of the remainder was one import that
  `phases.mjs` does not make. `dist/relay.js` takes a median 88 ms to import
  on its own, 65 ms of that through `diagnostic.js` and the MCP SDK.
- Routed prompts skip the same import. Their before and after: not shown.
  They still pay for the library scan, the embedding model and Jev.
- One machine, one session.

Raw: [results/2026-10-08-hook-phases/](results/2026-10-08-hook-phases/).
Cost: $0, with no Jev calls.

### Routed prompts with the library scan cache (D11, 2026-10-12)

**The library scan fell from 136 to 22 ms (p50), and the hook's new process
from 1,781 to 1,543 ms.** The routing paths now read
parsed skill metadata from a cache under `LOADOUT_HOME/index` and re-parse
only changed manifests ([#24](https://github.com/erik-hedstrom/loadout/pull/24)).
[hook-latency.ts](hook-latency.ts) ran on main (741f85a), then on the branch
(6e5969a). WSL, Node 24.15, the 1,262-skill library, real Jev, 20 dev prompts
each:

| ms, p50 / p95 | main | cache |
|---|---:|---:|
| scanLibrary, in process | 136 / 205 | 22 / 28 |
| Jev wide, in process | 509 / 651 | 514 / 629 |
| Jev close, in process | 367 / 421 | 375 / 414 |
| `loadout hook claude`, new process | 1,781 / 1,894 | 1,543 / 1,645 |

- The in-process rows come from the bench process, where the cache is warm
  after the first prompt. The new process makes its own Jev requests and was
  timed only as a whole, so how much of its 238 ms comes from the scan, and
  how much from its Jev calls: not shown.
- An earlier pair at 10 prompts gave 1,798 vs 1,613 ms (p50); its p95 went
  the other way (2,014 vs 2,342). The cause of that reversal: not shown.
- Left: the query-embedding model load. Cutting it per process would need a
  long-lived process.
- One machine, one evening, runs in sequence.

Raw (n = 20): [main](results/2026-10-12T17-12-14-107Z-hook-latency-main/),
[cache](results/2026-10-12T17-13-14-076Z-hook-latency-d11/). n = 10:
[main](results/2026-10-12T17-11-00-448Z-hook-latency-main/),
[cache](results/2026-10-12T17-11-32-851Z-hook-latency-d11/).
Cost: about $0.13 of Jev in total.

### MCP start-up under WSL (D17, 2026-10-15)

**From a checkout on `/mnt/c`, `loadout mcp` took 5.9–7.0 s to answer
`initialize`; from the Linux filesystem, 0.4–0.8 s.** Codex gives an
optional MCP server about 1 s before it leaves the server's tools out of the
first request. Main at `fbee5cb`, the 1,262-skill library on ext4, Node
24.15, WSL2 on Windows 11. Time from process start to the `initialize`
reply, three or four warm runs each:

| How it runs | Reply |
|---|---|
| inside WSL, checkout on ext4 | 0.41 s |
| inside WSL, checkout on `/mnt/c` | 5.9 s |
| `wsl.exe --exec node` from Windows, ext4 | 0.54–0.79 s |
| `wsl.exe --exec node` from Windows, `/mnt/c` | 6.0–7.0 s |

- Split on `/mnt/c`: importing `dist/mcp.js` and the MCP SDK took 3.9 s,
  the other CLI modules 0.75 s, and the cached library scan 0.04 s (0.75 s
  cold). On ext4 the same three took 0.11, 0.03 and 0.04 s. Module loading
  over 9P is the cost, not the scan.
- A cold run on ext4: not shown.
- One machine, one session. Raw results were not kept, so these numbers
  cannot be recomputed.

Cost: $0.

### Is the work better? (outcome pilot, 2026-10-07)

[outcome.ts](outcome.ts) runs each request twice with Codex (gpt-6.1-sol) in
fresh folders, capped at 6 minutes:
- **bare:** nothing from loadout;
- **loadout:** the sweep's selection, which here is the judge's top skill,
  injected for 7 of the 8.

Claude Opus then compares the two sets of deliverables blind, in both orders.
A preference counts only if it holds both ways. Eight requests where a
specific skill exists:

| Request | Skill | Verdict | Notes |
|---|---|---|---|
| MCP server for a docs folder | `mcp-builder` | **loadout** | structured outputs, strict schemas, tool titles |
| Queue-backlog runbook | `runbook` | **loadout** | placeholders throughout, never guesses production names |
| GitHub Actions security review | `gha-security-review` | **loadout** | both timed out; low/medium confidence |
| Merge two Obsidian notes | `obsidian-markdown` | **loadout** | |
| Vendor quote comparison | `vendor-review` | split | loadout / tie |
| A/B test analysis | `statistical-analysis` | bare | bare's script takes any CSV |
| UV-Vis calculation review | `uncertainty-and-units` | bare | loadout timed out before writing the review document |
| Threat model for uploads | `security-threat-model` | bare | loadout timed out; bare's sample code was more realistic |

**Loadout better in 4, bare in 3, 1 split. No overall quality gain shows at
this size.**
- The verdicts are consistent: 7 of 8 held in both orders.
- The wins are where a skill encodes conventions a strong agent would not
  apply unprompted: MCP best practices, runbook safety, Obsidian specifics.
- Two of the three losses are runs where following the skill took longer and
  hit the time cap (loadout timed out 4 times, bare twice).
- gpt-6.1-sol does these tasks well on its own.

Limits:
- 8 requests;
- each arm made up its own sample inputs;
- both arms ran with the user's Codex configuration;
- a skill's template can show in its output, so the judge is not perfectly
  blind.

Next tests:
- fixed input fixtures and longer caps;
- the small tier (gpt-5.6-luna, Haiku), where loadout's cost argument says
  skills should matter most.

## v3 (2026-10-06): specificity gate, injection, mentions

Changes from v2, prompted by an adversarial review with Codex (gpt-6.1-sol,
high) and by dogfooding:
- the need score drops the request-level "names a product/format" question
  (it could not separate: 0.958 vs 0.946) for a per-candidate "is this skill
  specifically about what the request names?" question in the close request;
- a clear-winner rule injects the top skill's full SKILL.md;
- skills the user names are loaded and injected regardless of the router;
- Jev failures fall back to keyword ranking instead of aborting.

Raw rows: `results/2026-10-06T00-53-05-loadout/` (fresh Jev answers, $0.48).
Rule tuned on dev with needless loads ≤ 10% on dev, reported on test: load when
P(exact) ≥ 0.7 and close share ≥ 0.03, need ≥ 0.5, at most 3.

### Test split

| Library | Gold loaded | Gold available (incl. offered) | Ranked first | Loaded | Loaded + offered | Needless loads | $/decision | Latency |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 94% | 95% | 93% | 1.0 | 1.5 | 5% | $0.00080 | 0.96 s |
| 5,000 | 95% | 95% | 93% | 1.2 | 2.4 | 5% | $0.00082 | 0.99 s |
| 20,000 | 93% | 95% | 86% | 1.5 | 3.2 | 5% | $0.00082 | 0.95 s |

95% intervals, pooled over sizes: recall 90–96%, needless loads 2–14% (3 of 60
rows). These are optimistic, because each task appears at three sizes.

**v3 vs v2 is a wash at the default gate.** With fresh answers, the new gate
traces a slightly better curve around 0.45, but the difference is one or two
no-skill tasks:

| Gate | v2 recall / needless | v3 recall / needless |
|---:|---:|---:|
| 0.45 | 98% / 22% | 97% / 10% |
| 0.5 | 95% / 5% | 94% / 5% |
| 0.55 | 89% / 2% | 87% / 5% |

The specificity question stays because it is no worse and feeds the injection
rule.

### Need questions, compared (all 199 tasks, one Jev request each, $0.013)

AUC: probability that a gold task scores higher than a no-skill task (0.5 = coin flip).

| Question | Gold mean | No-skill mean | AUC |
|---|---:|---:|---:|
| expert follows a documented procedure, tool or workflow | 0.71 | 0.25 | 0.97 |
| a strong general programmer could just do it (inverted) | 0.58 | 0.87 | 0.97 |
| top candidate is specifically about what the request names | 0.96 | 0.76 | 0.95 |
| needs specialised domain knowledge | 0.74 | 0.21 | 0.95 |
| needs an external service | 0.40 | 0.09 | 0.88 |
| tool/format whose exact usage matters | 0.89 | 0.68 | 0.86 |
| project convention not given in the request | 0.70 | 0.48 | 0.84 |
| one of the shortlisted skills gives concrete instructions | 0.92 | 0.83 | 0.84 |
| prescribed steps not given in the request | 0.70 | 0.54 | 0.83 |
| request names a product, platform or format (v2) | 0.96 | 0.94 | 0.77 |

### Injection

The clear-winner rule (wide pick ≥ 0.5, close share ≥ 0.8, P(exact) ≥ 0.95,
need ≥ 0.5), replayed on the v3 rows:
- it fires on 77% of rows that have a gold skill;
- when it fires on such a row, it injects the gold skill in 387 of 389 cases (99.5%);
- counting its 2 firings on the 90 no-skill rows, 387 of its 391 injections (99.0%) are a gold skill.

### Real library, hand-written requests

1,022 skills installed from 30 repos (Superpowers, Impeccable, the skills.sh
top sources, openai/skills, google/skills, huggingface/skills,
trailofbits/skills, cloudflare/skills, getsentry/skills, dotnet/skills…),
with requests written by hand rather than generated from descriptions:

| Requests | Result |
|---|---|
| 11 niche tasks (zeroize audit, YARA rule, Durable Objects, JSON Canvas, ZeroGPU, MAUI Shell, BigQuery slots, Lean proof, Zarr, PyG, Remotion) | 11/11 loaded the right skill; 9 injected as clear winners |
| 2 tasks with several acceptable skills (planning, frontend design) | both loaded acceptable skills (`brainstorming` + `writing-plans`; `impeccable` + `frontend-design`) |
| 3 everyday tasks (rename, off-by-one question, dependency bump) | 3/3 loaded nothing (need 0.08–0.36) |
| 2 requests naming a skill (`/systematic-debugging`, `test-driven-development`) | 2/2 injected |

18/18 pass at the default settings ($0.018; reproduce with
`npx tsx bench/handwritten.ts`, cases in `bench/data/handwritten.jsonl`). One
everyday request ("bump lodash…") scored need 0.45, close to the 0.5 gate. A
small sample, not a benchmark, but free of the description-vocabulary bias.

### End to end in the agents

Headless (`claude -p`, `codex exec`, Codex CLI 0.160.1 with gpt-6.1-sol):

| Check | Claude Code | Codex |
|---|---|---|
| Selected skill reaches the agent and is read | ✓ (plugin) | ✓ (prompt listing; canary line reproduced) |
| Selected MCP server starts and its tool is called | ✓ (Windows claude.exe, WSL path translated) | ✓ (`-c mcp_servers.…`, with `autoApprove`) |
| Injected skill is followed | ✓ JSON Canvas on haiku | ✓ JSON Canvas on gpt-5.6-luna |

Claude declined to print the canary line from the test skill, calling it an
injected directive. That is reasonable behaviour, and it confirms the skill
was read.

### Caveats specific to the benchmark (from the review)

- The "top 50 most-installed" arm's 12% recall in v1/v2 is mostly a product of
  the sampling design (20 of 169 positive tasks target popular skills). It
  shows that a fixed popular set misses niche tasks; it is not a measured
  coverage rate.
- 4 of 169 tasks contain their gold skill's name written with spaces (e.g.
  "write behat scenarios"). The generator's leak check now catches that form.
- `jev-latest` is a moving target. The need probe was answered by
  `jev-1.13.0`. The v3 routing rows did not record the model (0 of 597); routing
  records now store it (`raw.model`).


## v2: two-stage Jev router (2026-10-05)

Router: BM25 retrieval to 200 candidates → wide Jev request (choice over all
200 + "no skill needed", three need questions, model tier) → close Jev request
on the top 8 (graded fit + choice) → selection rule in code. Details in
[DESIGN.md](../DESIGN.md#router).

**Tuned on dev, reported on test.** Tasks are split by hash: 69 dev tasks, 130
test tasks. The selection rule was grid-searched on the stored dev answers
(2,700 rules, no API calls) under the constraint "load something on at most 35%
of no-skill tasks". The test split was not looked at while choosing. Chosen:
load when P(made for exactly this) ≥ 0.6 and close share ≥ 0.03, only if need
≥ 0.5, at most 3; offer up to 4 more with fit ≥ 0.7. Raw rows and the
generated report: `results/2026-10-05T21-39-18-popular+bm25+hybrid+loadout/`.

### Headline: 20,000-skill library, test split

| Arm | Gold skill loaded | Gold ranked first | Skills loaded | Loads something when none is needed | Router cost / task | Latency |
|---|---:|---:|---:|---:|---:|---:|
| Top 50 most-installed | 12% | — | 50 | 100% | — | — |
| BM25 top 10 | 88% | 72% | 10 | 100% | ~$0 | 0.1 s |
| BM25 + embeddings top 10 | 90% | 75% | 10 | 100% | ~$0 | 0.2 s |
| Jev v1 (yes/no per skill) | 97% | 65% | 9.4 | 80% | $0.00086 | 0.8 s |
| **Jev v2 (loadout)** | **93%** | **90%** | **1.5** | **5%** | **$0.00077** | **1.0 s** |

With the optional extras, the gold skill is available to the agent in 95% of
tasks at 20k (3.2 skills loaded or offered). Pooled over 1k, 5k and 20k on
test: 95% loaded, 96% available, 92% ranked first, 1.3 loaded, 5% needless loads.

v2 trades 4 points of recall against v1 for an 84% cut in skills loaded, +25
points of top-1, and staying quiet on 95% of tasks that need no skill.

### The need gate is the main lever (test, pooled)

| Need ≥ | Gold loaded | Gold available | Loads something when none is needed |
|---:|---:|---:|---:|
| off | 98% | 99% | 72% |
| 0.4 | 98% | 99% | 68% |
| **0.5** | **95%** | **96%** | **5%** |
| 0.6 | 81% | 82% | 0% |
| 0.7 | 58% | 58% | 0% |

Without the gate, v2 loads the gold skill 98% of the time. The gate costs 3
points of recall and removes almost all needless loads.

### The fit number means something (dev, all reread candidates)

| Fit (expected level ÷ 3) | Candidates | Of which gold | Ranked first in close choice |
|---|---:|---:|---:|
| < 0.7 | 1,098 | 0% | 0–4% |
| 0.7–0.9 | 155 | 0–4% | 4–9% |
| 0.9–0.95 | 57 | 5% | 7% |
| 0.95–1 | 346 | 49% | 53% |

Below 0.7 a candidate is essentially never the gold skill, which is why 0.7 is
the threshold for offering extras. Within 0.95–1, roughly half are gold, and
most of the rest are near-duplicates that would serve the task as well. The
gold label is a lower bound on precision.

### Where the remaining misses are (test)

| Library | Gold among the 200 candidates | Gold in the close 8 | Gold loaded |
|---:|---:|---:|---:|
| 1,000 | 100% | 100% | 96% |
| 5,000 | 100% | 100% | 96% |
| 20,000 | 98% | 98% | 93% |

At 20k, 2 points are lost to retrieval and 5 to selection. Across all test
sizes, of 16 misses: 11 were the need gate silencing a real task, 2 never
reached the close shortlist, 2 were cut by the 3-skill cap, and 1 lost the
close choice to a lookalike. The need questions are the next thing to improve.

### Embeddings did not help retrieval (no API calls; all 169 gold tasks)

Recall@K: is the gold skill among the top K candidates?

| Library | Retriever | @10 | @50 | @150 | @200 |
|---:|---|---:|---:|---:|---:|
| 20,000 | BM25 | 86% | 93% | 96% | 98% |
| 20,000 | embeddings (bge-small-en) | 78% | 83% | 87% | 88% |
| 20,000 | BM25 + embeddings (RRF) | 87% | 93% | 96% | 97% |

Every combination tried (RRF; BM25 top N plus embedding top M) matched or
trailed plain BM25 with a larger cutoff. The skills BM25 misses, embeddings
miss too (e.g. `agent-browser` ranks 869th by BM25 and 7,769th by
embeddings for a "click through the staging checkout" task). Two caveats: the
tasks were written from the skill descriptions, which favours exact terms, and
bge-small is a small model. Embedding fusion stays in the code, opt-in, for
real-world queries.

### Caveats

- The dev split is small (69 tasks). The chosen rule is simple (3 thresholds,
  1 cap), and test results came out at or above dev.
- Tasks are synthetic (see v1 caveats below). A hand-written task set is still
  the most important missing check.
- No end-to-end runs yet: this measures what reaches the agent, not whether the
  agent then finishes the task.

## v1 results (superseded): one yes/no question per skill

199 generated tasks (169 with a gold skill, 30 needing none) against libraries
of 100 to 20,000 real skills from GitSkills. Method and caveats:
[README.md](README.md). Raw rows: `results/2026-10-05T20-59-50-popular+bm25+jev/`
and `results/2026-10-05T20-59-53-frontier/`.

### Headline: 20,000-skill library

| Arm | Recall | Skills in context | Description tokens / request | Router cost / task | Router latency |
|---|---:|---:|---:|---:|---:|
| Top 50 most-installed (today's default) | **12%** | 50 | 5,251 | — | — |
| Everything installed | — | 20,000 | ~1,507,000 (does not fit) | — | — |
| BM25 top 10 | 86% | 10 | 901 | ~$0 | 0.16 s |
| **loadout (Jev)** | **96%** | 9.4 | < 870 | **$0.00086** | **0.77 s** |
| Frontier model reads everything | — | — | — | infeasible at this size | — |

Jev at threshold 0.8 (now the default). The table at 0.5 is in the raw
summary; recall is the same, with 11.9 skills selected.

### Against a frontier model (same 20 tasks, 100-skill library)

| | Recall | Skills selected | Cost / task | Latency |
|---|---:|---:|---:|---:|
| Sonnet reads all 100 descriptions | 100% | 1.45 | $0.035 | 9.5 s |
| **Jev (threshold 0.8)** | **100%** | 2.1 | **$0.0004** (85× less) | **0.44 s** (22× faster) |

One frontier data point at 1,000 skills: $0.48 and 8.9 s for a single
routing decision (75k tokens of descriptions). Jev at 1,000: $0.0008, 0.68 s.

### Recall as the library grows

| Library | Top 50 installed | BM25 top 10 | Jev |
|---:|---:|---:|---:|
| 100 | 12% | 100% | 99% |
| 1,000 | 12% | 97% | 99% |
| 5,000 | 12% | 92% | 99% |
| 20,000 | 12% | 86% | 96% |

By bucket at 20,000: popular 85%, head 96%, torso 100%, tail 96%;
repo-specific skills 97%, general 93% (threshold 0.8).

### Ranking quality (recall@k: gold skill ranked within the top k)

| Library | Arm | @1 | @3 | @5 | @12 |
|---:|---|---:|---:|---:|---:|
| 1,000 | BM25 | 83% | 91% | 93% | 98% |
| 1,000 | Jev | 91% | 98% | 99% | 100% |
| 20,000 | BM25 | 69% | 79% | 84% | 87% |
| 20,000 | Jev | 63% | 88% | 92% | 96% |

### Findings

1. **The status quo misses almost everything.** The 50 most-installed skills
   cover 12% of tasks (only the ones written for popular skills) and cost
   5,251 tokens on every request.
2. **Jev holds recall as the library grows, for under a tenth of a cent.**
   It holds 96–99% recall from 100 to 20,000 skills, and puts fewer
   description tokens in context than the top-50 setup.
3. **Jev is a recall filter, not a precise ranker.** Its yes/no scores are
   compressed: the gold skill's median p is 0.95, while the top score on
   tasks that need no skill is 0.935. Consequences:
   - top-1 at 20k is worse than BM25 (63% vs 69%);
   - a threshold cannot detect "no skill needed": those tasks still get
     4.4 skills at 0.8;
   - the cutoff is a cliff: recall falls from 93% at 0.9 to 64% at 0.95.

   That fits the design (the agent makes the final call), but precision is
   the main thing left to improve.
4. **Prefilter misses account for most of the remaining misses.** 4 of 7
   misses at 20k never reached Jev: BM25 did not rank the gold skill in its
   top 200. These are paraphrases like "open the staging checkout and click
   through it" → `agent-browser`, and generic popular skills
   (`codebase-design`, `diagnosing-bugs`). An embedding prefilter is the
   obvious fix.

### Threats to validity

- **Tasks are written from skill descriptions**, so they share vocabulary with
  them. BM25 (and therefore the prefilter) is likely optimistic; real requests
  are terser and less aligned. A hand-written task set is needed to confirm.
- **The gold label is a lower bound.** Other selected skills may serve the
  task equally well; they count as noise here.
- **The frontier comparison is n = 20 at 100 skills**, plus one point at 1,000.
- **Model-tier choice is not evaluated yet** (Jev chose medium for 155/199
  tasks, small 31, large 13); that needs end-to-end runs.
- **Costs are API-equivalent** as reported by the Claude CLI (which includes
  cache-write premiums) and by TypeSafe's usage field.

### Next experiments

1. **Precision:** in the same Jev request, add one `choice` question over the
   candidates plus "none". Its probabilities are relative, which should fix
   top-1 and detect tasks that need no skill.
2. **Embedding prefilter** to remove the paraphrase misses.
3. **Hand-written tasks** (~30) as a check against the vocabulary bias.
4. **End-to-end pilot** (does the routed agent actually finish more tasks, for
   less?), possibly on `claude plugin eval`.
