# loadout benchmark

## B11 OpenCode sessions

`b11.ts` measures completed model requests and checks generated files. It
requires Linux, bubblewrap, Node 22.12 or later, and an explicitly selected
OpenCode binary. Version 1.19.3 is pinned by default. No user agent setup is
edited. Only synthetic workspaces and public skill text should be supplied:
free-model providers receive these inputs and may retain them.

```bash
B11_ARGS=(--arms bare,mcp-all,gateway,preselect,heavy-max,skills-50,skills-250,mcp-1,mcp-5
  --heavy-skills 250 --heavy-servers 5 --timeout 300)
npx tsx bench/b11.ts --plan "${B11_ARGS[@]}" --opencode "$OPENCODE_BIN"
npx tsx bench/b11.ts --run "${B11_ARGS[@]}" --opencode "$OPENCODE_BIN" --out bench/results/approved-b11
npx tsx bench/b11.ts --run --resume "${B11_ARGS[@]}" --opencode "$OPENCODE_BIN" --out bench/results/approved-b11
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
required canary servers added. The bracket selected 250/5, which is actually
274 skills, 20 servers and 509 tools for this dataset. All 20 servers carry
required targets, so the fixed full-task comparator retains them. A different
heavy configuration cannot be silently resumed or pooled into a report.
The GLM full-library diagnostics repeatedly compacted; the current study command
excludes them but keeps their diagnostic rows. Bracketing evidence and the
quota-stopped real-task pilot are recorded in RESULTS.
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
the pinned binary. The host environment is cleared. The host network,
including loopback services, is reachable during the session. Authenticated
fixture and gateway endpoints stay outside
the sandbox; their short-lived token is a private file in the temporary
home. Hidden checks are copied in after the model process stops and run
without network. Temporary session files, including OpenCode logs/databases,
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

Reports keep the hash-based dev/test split separate, include Wilson 95%
intervals, and reprice measured tokens under dated official price snapshots.
Completion coverage, invalid-reason counts and observed deadlines stay visible;
coverage under 90% carries a survivor-bias warning. Zero-valid arms read not
usable in observed attempts. Those prices are hypothetical comparisons across different tokenizers and
cache policies. Size comparisons use a shared task/repetition panel; gateway
bands are observed min/max session costs. See [RESULTS](RESULTS.md) for run
evidence and limits.

The real-task pilot is quota-stopped: 15/90 planned final rows, two sessions
interrupted without rows and 73 unstarted. Other arms and all DeepSeek cells
remain unmeasured; unknown interrupted usage is not reconstructed. No
numeric quota or reset time was established. All provider calls stopped.
The selected heavy comparator completed only a four-case screen, not a
broad reliability evaluation. See [RESULTS](RESULTS.md#b11-real-task-pilot-2026-10-22-quota-stopped).

The [handoff](../docs/loop/B11-HANDOFF.md#quota-stopped-real-task-follow-up)
contains the exact resume command with the original pilot arm order and
$0.065 Jev cap. It also records the exact nine-arm full-study command
(792 sessions, concurrency 2, 300-second deadline), gated on a completed
usable pilot and available quota. Its 37 h 20 min all-deadline schedule is
not an expected runtime; no full study has run.

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

## MCP overhead (B7)

`npx tsx bench/mcp-overhead.ts --offline` prints the characters each arm puts
in front of the host from local fixture MCP servers (no CLI, no network). The
plan, the cost estimate and the live runs are described in the backlog (B7).
Claude runs require `CLAUDE_CODE_OAUTH_TOKEN` for Erik's personal subscription;
see the [B7 method](RESULTS.md#b7-method-not-run-yet-what-configured-mcp-servers-cost-per-request)
for isolation and runtime checks.
