# B11 implementation handoff

Branch: `agent/b11-opencode-cache-study`, based on `59dc5fd`.
No push, PR creation or merge was performed.

`bench/b11.ts` is the plan/run/resume entry point. `studyConfig()` pins
routing policy and Jev pricing/model defaults; the established credential
resolver and guarded endpoint settings remain host-side. `JevBudget.meter()`
reserves request cost and drains pending usage before persistence.
`classifyRun()` projects telemetry and controlled failure categories.
`runCheck()` counts unsafe output as task failure and distinguishes sandbox
startup failure from hidden Node assertions.

`bench/b11-sandbox.ts` owns Linux argv construction, the offline canary probe,
confined fixture copies and manifest materialization. Paths inside the agent
are fixed across sessions. Output/manifest reads reject non-regular files
before opening them. `removeSession()` repairs owned directory permissions
after the namespace exits, without following links.

`bench/b11-listing.ts` contains `prepareSkills()`, `listingFor()` and
`validateNeeds()`. Broken/colliding plants stop setup. Size arms retain all
planted resources; recorded listing sizes include them. The sweep task subset
is fixed before any outcomes are read. `bench/b11-mcp.ts` serves authenticated
loopback fixture and gateway endpoints. The stock product HTTP helper still
excludes MCP servers; benchmark gateway access uses `createServer()`.

`bench/b11-types.ts` validates task/row boundaries and projects counters,
names and statuses from JSONL. `bench/b11-report.ts` regenerates the report
from rows, keeping dev/test and valid/invalid usage distinct. The OpenCode
1.19.3 counter equation includes uncached input, cache read, cache write,
ordinary output and reasoning. The parser fixture uses recorded pilot counters.

Pilot evidence: [RESULTS](../../bench/RESULTS.md#b11-pilot-2026-10-22-cached-opencode-sessions),
[rows](../../bench/results/2026-10-22-b11/rows.jsonl),
[report](../../bench/results/2026-10-22-b11/summary.md), and
[protocol](../../bench/results/2026-10-22-b11/protocol.json).
The protocol records interruptions, concurrency changes and incomplete usage.
No size sweep or full study was run. The native skill-heavy arms timed out;
completed session cost and retained quality are not established.

Original implementation verification, before dataset integration, in an LF WSL checkout: `npm test -- --maxWorkers=2
--reporter=default` passed 769 tests, skipped 48; `npm run typecheck` and
`npm run build` passed. Focused native Windows B11 tests passed 112 and
skipped 12 POSIX cases; native Windows typecheck passed. Linux CI installs
bubblewrap for the real offline sandbox/lifecycle tests. CI and the macOS
matrix have not run from this branch.

The initial verification copy had CRLF in an older `answer-batches.sh`
fixture, causing two unrelated failures. Normalizing that copy's shell files
resolved them; the tracked historical script was not changed. An attempted
test from the Windows checkout found no installed Vitest; native checks used
a separate LF copy with dependencies installed.

119 intentional guard/behavior mutations caused targeted tests to fail;
saved bytes were restored in isolated verification copies. Counts: 40 parser/
row-schema, 14 report boundaries, 17 listing, 28 sandbox/runner, 17 lifecycle,
and 3 final cleanup/report regressions. These are executed mutation checks,
not a count of unique source conditions.

The dataset at `agent/b11-tasks` (`186c781`) is merged unchanged: 72 tasks,
24 per kind, six decoys, and host-only reference solutions. The updated
command below schedules 792 sessions: all tasks in five usable study arms,
plus three tasks per kind in four size arms, across both models. The original
full-library arms remain available for diagnostics but leave the study plan. Budget exhaustion
stops the run; a resumed run includes all previous Jev attempt costs.

```bash
B11_RESULTS="bench/results/$(date -u +%Y-%m-%dT%H-%M-%SZ)-b11"
npx tsx bench/b11.ts --run --tasks bench/data/b11/tasks.jsonl \
  --opencode "$OPENCODE_BIN" --opencode-version 1.19.3 \
  --arms bare,mcp-all,gateway,preselect,heavy-max,skills-50,skills-250,mcp-1,mcp-5 \
  --heavy-skills 250 --heavy-servers 5 \
  --reps 1 --batch-size 9 --sweep-per-kind 3 --concurrency 2 \
  --timeout 300 --jev-budget 1.00 --out "$B11_RESULTS"
```

Use `--plan` in place of `--run` first. The plan is offline and costs $0;
the command's Jev reservation cap is $1, with free-model spend $0. The 300-second deadline is provisional until the real-task pilot completes.
Keep invalid attempts separate. The all-deadline schedule is 37 h 20 min at
concurrency 2, excluding setup, Jev, checks, cleanup and backoff; expected
wall time awaits the pilot. Do not launch the full study during implementation.

## Review dispositions

Claude Opus 5.5 and a fresh Codex review both approved
`a6e2fcd863a1f5d4a4d6c1a3ce9d818c4438e9e0`. No High or Medium findings
remain. Both verified the 124 B11 tests under real bubblewrap, typecheck,
build and reproducible report. Claude also ran the full suite (769 passed,
48 skipped), checked pilot aggregates and spot-checked the newline mutation.
The subsequent commit changes only this handoff and protocol documentation.

| Finding | Disposition and evidence |
|---|---|
| R1: sweep omitted planted resources; bad plants were hidden | Fixed in `b11-listing.ts`: retain all plants and reject failed/colliding plants; listing tests cover every arm. |
| R1: counter equation excluded cache writes | Fixed in `b11-types.ts`, grounded in pinned OpenCode source; nonzero-write parser regression. |
| R1: output, infrastructure and harness errors mixed; broad 429 detection | Fixed in `classifyRun`/`runCheck`, with unsafe-output, sentinel, malformed-event and port-number regressions. |
| R1/R2: worker teardown, pending Jev, budget stop and routing unavailable lacked lifecycle evidence | Fixed with drained workers/meters, explicit budget stop and real-bwrap fake-client runner tests. |
| R2: inherited routing config | `studyConfig()` pins defaults and Jev; tests verify user policy cannot change the study. |
| R2: canonical temporary roots | Committed realpath roots and POSIX sandbox paths; native Windows focused tests pass. macOS remains for CI. |
| R2: missing artifacts and results | Committed rows, reproducible report, protocol, RESULTS and BACKLOG. The PR placeholder stays until the orchestrator opens it. |
| Earlier Lows: cleanup, token scope, loopback disclosure, plan cost, timeout telemetry and ordering | Fixed with guarded permission repair, MCP-only token files, documented host networking/cost, retained completed counters and block/listing tests. |
| R3: pooled totals lacked provenance | Linked `pilot-totals.json` from `protocol.json` with its aggregation method and split limitations; all 12 groups independently checked. |
| R3: missing review notes | Recorded here. |

Remaining Low items: Ubuntu CI may require an AppArmor user-namespace setting
if bubblewrap reports a uid-map error; this was not observed in WSL and should
be decided from CI evidence. A check with package imports could resolve agent
files; current dataset checks use Node built-ins and relative imports (Claude
accepted that rebuttal). The 16 MiB output cap shares timeout classification,
top-level diagnostics are deliberately generic, and task kind/needs semantic
agreement remains dataset responsibility. Pricing snapshots were verified
against official sources by the report implementer and independent Codex.
No additional behavior was added for these Low follow-ups.

Before merge, the orchestrator still owns the required `pr-reviewer` pass,
`ci-full` matrix, PR placeholder replacement and dataset integration. The full
study remains unrun; neither quality retention nor size break-even is shown.


## Capacity follow-up in progress

Merged task contract: `fixturePath()` strips the repository-relative prefix
and confines each category; `runCheck()` uses `/work` as cwd. All 72 declared
workspaces were checked for correct copying without sibling solutions/checks.
`eventClock()` records arrival timing only. Optional `latency` and `timeoutMs`
keep historical rows readable. Reports show invalid reasons, distinct
observed deadlines, under-90% completion, and lifecycle wall-time limitations.

`heavy-max` requires `--heavy-skills` and `--heavy-servers`. These are limits
on distractors/base servers; plants and required server targets remain.
`rowKey()` and resume distinguish comparator settings. `summarizeRows()`
rejects mixed heavy configurations; bracket reports stay separate.
The fixed sweep subset's server targets are chosen before outcomes, preventing
all global canaries from collapsing every MCP sweep size to 20 servers.

The bracket selected 250/5, actually 274 skills /20 servers /509 tools.
Four screened sessions completed without compaction (15–43 s), with three
checks passing. The 500/10 candidate compacted on its first GLM request;
its deliberate stop is documented separately from its raw process-exit
classification. Original long-deadline diagnostics continue on both models.
The new pilot is not the full study and will use the same selected comparator.

Code through `3be8d7d` has a fresh Codex approval. Claude R4 requested an
invalid-reason breakdown; it and all reported timing/deadline Low items are
fixed in the subsequent report delta, awaiting re-review. Comparator changes
also await independent review. The earlier approvals above apply to their
named checkpoints. Current focused checks: 230 B11 tests pass under WSL;
full final checks and the real-task pilot are pending.
