# loadout benchmark

## B12 native listing remeasurement

`listing.ts` measures 0, 50, 250 and all valid library skills, ordered by
SHA-256 of normalized names so smaller arms are prefixes. Only confined
manifest names/descriptions enter temporary skills; bodies, hooks, scripts
and references are replaced with a fixed third-party placeholder. It needs
at least 250 distinct valid manifests. Claude also compares default tools
without MCP against loadout's lexical MCP server with the full sanitized
library in a temporary `LOADOUT_HOME`.

```sh
node --import tsx bench/listing.ts --plan --host claude --library <public-library> --claude-command <native-executable>
node --import tsx bench/listing.ts --plan --host codex --library <public-library> --codex-command codex
```

Commands are executable paths; quote paths containing spaces in your shell.
Repeat `--claude-arg` or `--codex-arg` for literal command-prefix arguments
(for example `--codex-command node --codex-arg /tools/codex.js`). No shell is used. For
Windows Claude, pass its native `.exe`, not an npm `.cmd` shim. Run each host
from Node in its own OS (Claude on Windows, Codex in WSL on this machine),
with paths native to that OS. Use a clean, logged-in benchmark `CODEX_HOME`;
never put credentials in command arguments. Model defaults are `haiku` and
`gpt-6-luna` (low effort); override with `--claude-model`/`--codex-model`.

Planning starts no children, prints exact argv/cwd, paid-call counts and an
illustrative dollar estimate with its assumptions, then removes temporary
files. Without either mode flag it also plans. An authorized measurement
replaces `--plan` with `--run --out <new-results-directory>`; both flags
together are refused. There are 12 Claude and 8 Codex calls, two sequential
fresh sessions per arm, and free version probes. No Jev calls. The estimate
ignores cache discounts and is neither a cap nor a current price quote.

`rows.jsonl` stores host version, requested/reported model, corpus hashes,
counts, exit/duration, invalid status and separate uncached/cache-write/
cache-read/output counters. It stores no transcripts, context, raw errors
or ambient plugin names. Claude init discovery counts do not prove rendered
description visibility; Codex exec does not expose initial-list counts, so
those fields are null. Repeat calls need not hit cache. Invalid measurements
are recorded and stop further paid calls. Host cache/auth/diagnostic writes
remain possible; the harness never edits host configuration.

Recognized Codex skills-budget notices are recorded as `skillsBudget`:
`descriptionsRemoved: true` with the reported omitted count, or `false`
with `omitted: 0` when the notice says some descriptions were shortened and
every skill remains listed. The field is null when no notice occurs. Only
the exact known messages are accepted; other error items still invalidate
the measurement. Notice text is never stored, and B1's parser is unchanged.

Use a deliberately selected public library. The benchmark `CODEX_HOME`
must have no `.env`, user skills, hooks or alternate provider setup; the
exec overrides do not isolate managed/system configuration. Claude retains
its logged-in ambient home; plugin counts cannot establish identical plugin
contents. A token plateau alone does not prove that a host budget caused it.

Results: [RESULTS](RESULTS.md#b12-results-2026-10-28-what-installed-skills-cost-per-request-on-current-hosts).

## B11 OpenCode sessions

`b11.ts` measures completed model requests and checks generated files. It
requires Linux, bubblewrap, pasta (from passt), Node 22.12 or later, and an explicitly selected
OpenCode binary. Only version 1.19.3 is supported by the counter parser. No user agent setup is
edited. Only synthetic workspaces and public skill text should be supplied:
free-model providers receive these inputs and may retain them.

`--run` requires `--library` pointing to a deliberately selected library root
with a `skills/` directory. Each distractor needs installed
`.loadout-source.json` metadata matching a source in `bench/data/library.sh`;
missing or other sources are rejected before materialization. Plan/protocol
provenance records accepted/rejected distractor counts, sorted-name, content
and source fingerprints, and source revisions when available. `corpusCommit`
is the script's reference revision; `revision` is installed metadata and may
be unknown. Neither field verifies an upstream download. Planted skills are
separate from those distractor counts. An offline plan without `--library`
reports `library: null` and never reads the ambient library.

```bash
B11_ARGS=(--arms bare,mcp-all,gateway,preselect,heavy-max,skills-50,skills-250,mcp-1,mcp-5
  --heavy-skills 250 --heavy-servers 5 --timeout 300)
npx tsx bench/b11.ts --plan "${B11_ARGS[@]}" --opencode "$OPENCODE_BIN" --library "$B11_LIBRARY"
npx tsx bench/b11.ts --run "${B11_ARGS[@]}" --opencode "$OPENCODE_BIN" --library "$B11_LIBRARY" --out bench/results/approved-b11
npx tsx bench/b11.ts --run --resume "${B11_ARGS[@]}" --opencode "$OPENCODE_BIN" --library "$B11_LIBRARY" --out bench/results/approved-b11
npx tsx bench/b11-report.ts bench/results/approved-b11/rows.jsonl > report.md
```

The default is an offline plan: it checks the task contract and runs a
network-disabled sandbox probe. The probe verifies that the real home,
checkout and an outside canary cannot be read. Execution needs `--run`.
Use `--tasks test/fixtures/b11-pilot/tasks.jsonl` for the small harness fixture
set. These fixtures deliberately name their needed resources; they are not
held-out evidence for routing quality.

The six original arms, retained for diagnostic reproduction, are `bare`, `skills-all`, `mcp-all`, `all`, `gateway`
and `preselect`. Additional size arms are `skills-50`, `skills-250`, `mcp-1`
and `mcp-5`. Skills are listing-validated, framed `SKILL.md` text without
bundled files. Size arms use the first `--sweep-per-kind` tasks of each kind
(default 3), fixed before any results are read. Planted skills and canary
needed by the fixed sweep subset remain available in MCP-size arms; rows
record actual counts. Skill-size arms retain all planted skills.
`heavy-max` requires explicit `--heavy-skills` and `--heavy-servers` limits:
nonplanted skills and base fixture servers, with all planted skills and
required canary servers added. Resume and reports distinguish heavy configurations.
Selection and diagnostic evidence are in [RESULTS](RESULTS.md#b11-real-task-capacity-bracket-2026-10-22-quota-stopped).
Only the B7 synthetic servers and task canaries are available;
personal MCP configuration is never loaded. The gateway calls the same
in-process loadout implementation as the CLI. Preselection uses `route()`
and records the chosen names. Embeddings are disabled consistently for these
two routing arms, avoiding a model download during the study. Routing policy,
Jev model and input price are pinned to this source's `DEFAULT_CONFIG`; the
user configuration supplies only credential resolution and the guarded
endpoint setting. A user-selected keyword router cannot replace Jev.

Each session receives a fresh writable workspace/home in bubblewrap, a
private process namespace, read-only system executables, DNS/CA files and
the pinned binary. The host environment is cleared. Pasta supplies a separate
network namespace with outbound Internet; automatic port forwarding and host
gateway mapping are disabled. Only selected fixture/gateway TCP ports are
forwarded to session loopback. Unrelated host loopback listeners are not
forwarded. Non-loopback host addresses, including docker0 and the Windows
host in WSL NAT mode, remain reachable. Endpoints stay outside the sandbox; every gateway has its own
short-lived token in the temporary home. Hidden checks are copied after the
model exits, mounted read-only, and run without network. A separate Node test
parent compares passed case identities with the trusted fixture inventory;
an early module exit or printed success marker cannot substitute for cases.
Supported fixtures use unconditional top-level literal `node:test` calls.
Checks capture assertion functions and dependencies before importing generated
code; check children freeze shared JavaScript intrinsics with Node's
[experimental flag](https://github.com/nodejs/node/blob/v22.12.0/doc/api/cli.md#--frozen-intrinsics).
This is a completion check, not authenticated grading against code designed to
tamper with Node's internal test protocol. File checks verify only the stated
required and forbidden strings. The running Node executable is mounted
read-only at `/opt/node/bin/node`, and its version is recorded in the protocol.
Temporary session files, including OpenCode logs/databases,
are removed. Public rows contain counters, names/statuses and check outcomes,
never transcripts, arguments, tool results or environment values. Rows also
record launch-to-first-step and completed-step event-arrival durations, plus
the configured deadline. These durations do not partition total wall time.

Tasks run in blocks of one model/arm, with arm order rotating by batch and
repetition. `--batch-size` defaults to 9, `--concurrency` to 2 and `--reps`
to 1. Concurrency is within a block. Initial requests may reuse a provider
cache from earlier sessions; the report separates each request position.
`--timeout` bounds each session in seconds (default 300). The plan also
prints the schedule if every session uses its deadline, retaining block
barriers and excluding setup, routing, checks, cleanup and rate-limit waits. Rate-limit attempts are invalid
and delay the next starts by at least 60 seconds. A persistent free usage-limit
marker stops further launches; it does not become a task quality failure. Resume skips valid
task/model/arm/repetition identities and retries invalid ones once per launch.

`--jev-budget` defaults to $0.10. Each Jev call reserves a conservative
byte-based input allowance before sending; successful usage replaces that
allowance, while an unanswered request retains it. Automatic Jev retries are
disabled. Recorded Jev cost includes invalid attempts. A resumed run includes
earlier attempt costs in its budget. An exhausted budget invalidates routing
rows instead of silently evaluating keyword fallback.

The gateway estimate assumes one search per step at the configured 20-step
bound, with two Jev calls per search. Several searches per step can exceed
it; the reservation cap still applies. Plan JSON links here for these
assumptions and the mount/write contract. Planning writes only a temporary
manifest snapshot and preflight files, removed afterward. Runs additionally
write rows and protocol metadata under `--out`. Resume requires matching
library provenance, Node version and the current grading protocol; start a fresh output
directory for legacy rows.

Linux tests skip pasta-dependent cases with a reason if pasta is absent;
they run in CI, which installs `passt`. `--run` never falls back to shared
networking. To exercise the optional outbound HTTPS probe, set
`B11_TEST_INTERNET=1`; CI opts in to this exception to the otherwise
network-free `npm test`. Only that probe may skip when outbound access is absent.

Reports keep the hash-based dev/test split separate, include Wilson 95%
intervals, and reprice measured tokens under dated official price snapshots.
Completion coverage, invalid-reason counts and observed deadlines stay visible;
coverage under 90% carries a survivor-bias warning. Zero-valid arms read not
usable in observed attempts. Those prices are hypothetical comparisons across different tokenizers and
cache policies. Size comparisons use a shared task/repetition panel; gateway
bands are observed min/max session costs. See [RESULTS](RESULTS.md) for run
evidence and limits.

Pilot status and limits are in [RESULTS](RESULTS.md#b11-real-task-pilot-2026-10-22-quota-stopped).
The [handoff](../docs/loop/B11-HANDOFF.md) contains resume/full-study commands and review dispositions.

Does the router put the skill a task needs in front of the agent, and what
does that cost, as the library grows from 100 to 20,000 skills?

## Data

| File | What | In git |
|---|---|---|
| `data/corpus.jsonl` | 20,000 distinct skills (name, description, repo, stars) | no — rebuild |
| `data/popular.jsonl` | skills.sh all-time top 100 by installs, resolved to descriptions | no — rebuild |
| `data/tasks.jsonl` | generated tasks with gold skills | yes |
| `results/<run>/` | `rows.jsonl` (per task × size × arm), `summary.md`, `summary.json` | yes |

**Corpus.** Built from [GitSkills](https://huggingface.co/datasets/mvaccargiu/gitskills)
(3.8M `SKILL.md` files from 282k public repos, July 2026; CC-BY-4.0
metadata, file contents under their repos' licenses). One skill per name (the
copy in the most-starred non-fork repo), templates and junk dropped, at most
150 skills per repo so skill-farm repos cannot dominate, top 20,000 by repo
stars. The skills.sh most-installed skills are forced in, falling back to
GitHub for skills newer than the snapshot.

**Tasks.** For a seeded sample of skills (20 from the skills.sh top 50, then
50 each from the head / torso / tail of the corpus by stars, English
descriptions only), a model writes the request a developer would type where
that skill would help, without naming it, plus a plausible repo context. 30
more tasks need no skill at all. Tasks that leak a multi-word skill name
verbatim are dropped.

## Arms

| Arm | What the agent gets |
|---|---|
| `popular` | the 50 most-installed skills.sh skills, always loaded: what people do today |
| `bm25` | top 10 by BM25: roughly lexical tool search |
| `hybrid` | top 10 by BM25 + embeddings (RRF) |
| `loadout` | the two-stage Jev router ([DESIGN.md](../DESIGN.md#router)); raw answers are stored per row |
| `frontier` | a frontier model reads every description and picks up to 12 (small libraries only) |

For each task and size N the library is the gold skill plus N−1 random corpus
skills, nested across sizes. **Recall** = the gold skill was loaded. The
gold label is a lower bound: another skill in the library may serve the task
equally well and is counted as a miss.

Tasks are split by hash into **dev** (1/3) and **test** (2/3). `tune.ts` replays
the selection rule over the stored Jev answers on dev (no API calls), picks the
best rule per budget, and reports it on test.

## Reproduce

```bash
uv run --with duckdb --with pyyaml bench/scripts/build_corpus.py   # ~2 min, reads parquet metadata over HTTP
npx tsx bench/generate-tasks.ts                                    # ~$1 of Claude usage
npx tsx bench/retrieval-bench.ts                                   # retrieval recall@K, local only (embeds the corpus once, ~10 min)
TYPESAFE_API_KEY=... npx tsx bench/route-bench.ts                  # $0.48 of Jev in v3 for 199 tasks × 3 sizes
npx tsx bench/tune.ts bench/results/<run>                          # tune on dev, report on test, no API calls
npx tsx bench/route-bench.ts --arms none --frontier 20 --sizes 100 # frontier arm, ~$1 of Claude usage
TYPESAFE_API_KEY=... npx tsx bench/need-probe.ts bench/results/<run> # compare need questions (~$0.01)
npx tsx bench/handwritten.ts                                       # hand-written requests vs your real library
```

`claude -p` calls run with `--strict-mcp-config --disable-slash-commands
--tools ""` from a neutral directory.

## Realistic requests on your library (v4)

This answers a different question: on what people actually type, against your
real library, are the choices reasonable, and do agents use them? There are no
gold labels; a frontier model judges.

```bash
sh bench/data/library.sh                                # rebuild the 1,262-skill library these results used
# seeds: data/seeds.jsonl (315 requests written by Codex without seeing any library)
npx tsx bench/expand.ts bench/data/seeds.jsonl          # Sonnet expands each into a detailed prompt (~$3 of Claude usage)
npx tsx bench/sweep.ts                                  # route all 315 (~$0.39 of Jev per sweep in E9), stores raw answers
npx tsx bench/judge.ts bench/results/<sweep>            # Opus: blind pass, then adjudicates disagreements (~$5 first time)
npx tsx bench/judge.ts bench/results/<sweep2> --blind-from bench/results/<sweep>   # re-run after a change: adjudication only
npx tsx bench/judge.ts <new-sweep> --offline --blind-from <blind-sweep> --verdicts-from <judged-sweep> # $0 scoring; writes report-offline.md; repeat --verdicts-from to pool ratings; unrated loads bound precision
npx tsx bench/stability.ts <sweep1> <sweep2> <sweep3>    # $0; same request IDs/texts, dev/test stability, fallbacks, latency and cost to stdout
npx tsx bench/invoke.ts bench/results/<sweep> --agent claude|codex --mode routed|search --ids a,b,c
```

C1's new requests came from `seeds.ts --prefix c1` and `expand.ts`, both run
with `--backend files` and answered by Codex through
[answer-batches.sh](results/2026-10-08-c1-heldout/answer-batches.sh). They
are then routed and judged as above, with `--requests bench/data/requests-c1.jsonl`
([RESULTS](RESULTS.md#c1-2026-10-08-new-held-out-requests)).

- `judge.ts` writes `report.md` next to the decisions, with overall and
  per-category numbers and every miss.
- Run the judge sequentially (`--concurrency 1`), so the catalog prompt stays
  cached: about $0.10 per 20-request batch instead of $0.90.
- `invoke.ts` runs the real agents headless, which takes minutes per request
  and uses your subscriptions.

## Native library comparison (C15)

Preregistered before any run: [C15 method](RESULTS.md#c15-method-preregistered).
The same sanitized SKILL.md-only library is installed natively or served by
loadout. This is the replacement comparison C14's bare baseline cannot make.
Codex only; Claude-host execution remains blocked on E12. No result yet.

From WSL, using the dedicated logged-in Codex home without global instructions:

```bash
# Primary: 250 skills, ten frozen C1 TEST prompts, two repeats.
CODEX_HOME=~/codex-bench-home node --import tsx bench/ab.ts --plan --study c15 --library ~/.loadout/library --library-size 250 --codex-model gpt-6-luna --codex-effort medium --repeats 2

# Secondary: whole valid corpus, one repeat, tokens only; zero judge calls.
CODEX_HOME=~/codex-bench-home node --import tsx bench/ab.ts --plan --study c15 --library ~/.loadout/library --library-size all --codex-model gpt-6-luna --codex-effort medium --repeats 1 --no-judge
```

Plans read the library and print the exact IDs, hashes, schedule, argv,
environment names, writes and estimate; they start no host or judge and write
no files. Windows can plan using a library path accessible there. The primary
plans 42 paid runs (two warm-ups) and 40 sequential Opus judge calls; the
secondary plans 22 runs (two warm-ups) and zero judges. These are future quota
costs, not authorization to spend. Jev costs are estimated and recorded
separately; effective input assumes cached tokens cost 0.1 of uncached input,
with output reported separately.

`--study c15` fixes the arms to `native,loadout` and effort to medium; there
is no arm-order flag. Free discovery preflight uses the measured HOME,
CODEX_HOME and cwd before any paid turn. Native discovery and loadout's
library scan must exactly match the manifest; loadout native discovery must
contain no non-builtin skills. System-scoped `skills/.system` entries under
CODEX_HOME must match clean builtins from the same executable by name and
SKILL.md content hash. CODEX_HOME's `config.toml` must be absent. Move ambient skills aside yourself if needed;
the harness never edits the user's skill setup.

Nine prompts are hash-selected using request text alone. The tenth,
`c1-debug-13`, was previously selected using Jev and judge results; it
contributes 2 of 20 pairs and the only hidden-test gate. Reports include a
paired sensitivity median/range and win/loss counts excluding that fixture.

Only the coordinator, after authorizing spending, replaces `--plan` with
`--run --out bench/results/<timestamp>-c15-primary` or a distinct
`<timestamp>-c15-secondary` folder. Resumption requires identical settings,
code and library content. `--judge-only <primary-dir>` resumes primary judging;
tokens-only study folders refuse judging. Keep `--no-judge` on secondary runs.
Commit raw results after inspecting them for credentials and private content.

## A/B pilot (C14)

```bash
npx tsx bench/ab.ts                                                  # the plan, the estimate and what each host may write; $0
CLAUDE_CODE_OAUTH_TOKEN=... npx tsx bench/ab.ts --run [--repeats 2] [--hosts claude,codex] [--ids c1-web-14,c1-apps-08,c1-debug-13] [--out <dir>]
npx tsx bench/ab.ts --judge-only bench/results/<run>-ab-pilot        # judge and write report.md again
```

The Codex pilot runs `--hosts codex --codex-model gpt-6-luna --codex-effort medium`, judged by Claude per the cross-family rule.

Three prompts, each with and without loadout (the plugin, MCP server and hook as
a user installs them) in the stock `claude` and `codex`: per-request token usage
with cached and uncached input apart, a blind cross-family judge and, for the
code prompt, a hidden test. `--run` needs Linux or WSL and Erik's go-ahead (it
spends subscription quota); an interrupted run resumes with the same `--out`.
Method and caveats: [RESULTS](RESULTS.md#c14-method-three-prompts-with-and-without-loadout).

## MCP overhead (B7)

`npx tsx bench/mcp-overhead.ts --offline` prints the characters each arm puts
in front of the host from local fixture MCP servers (no CLI, no network). The
plan, the cost estimate and the live runs are described in the backlog (B7).
Claude runs require `CLAUDE_CODE_OAUTH_TOKEN` for Erik's personal subscription;
see the [B7 method](RESULTS.md#b7-method-not-run-yet-what-configured-mcp-servers-cost-per-request)
for isolation and runtime checks.
