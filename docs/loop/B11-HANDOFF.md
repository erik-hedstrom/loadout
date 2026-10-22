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
command below schedules 792 sessions: all tasks in five full-task arms,
plus three tasks per kind in four size arms, across both models. The original
full-library arms remain available for diagnostics but leave the study plan. Budget exhaustion
stops the run; a resumed run includes all previous Jev attempt costs.

```bash
B11_RESULTS="bench/results/$(date -u +%Y-%m-%dT%H-%M-%SZ)-b11"
npx tsx bench/b11.ts --run --tasks bench/data/b11/tasks.jsonl \
  --opencode "$OPENCODE_BIN" --library "$B11_LIBRARY" \
  --arms bare,mcp-all,gateway,preselect,heavy-max,skills-50,skills-250,mcp-1,mcp-5 \
  --heavy-skills 250 --heavy-servers 5 \
  --reps 1 --batch-size 9 --sweep-per-kind 3 --concurrency 2 \
  --timeout 300 --jev-budget 1.00 --out "$B11_RESULTS"
```

Use `--plan` in place of `--run` first. The plan is offline and costs $0;
the command's Jev reservation cap is $1, with free-model spend $0. The 300-second deadline remains provisional: the real-task pilot was quota-stopped.
Keep invalid attempts separate. The all-deadline schedule is 37 h 20 min at
concurrency 2, excluding setup, Jev, checks, cleanup and backoff; expected
wall time awaits the pilot. Do not launch the full study during implementation.

## Review dispositions

Claude Opus 5.5 and a fresh Codex review both approved
`a6e2fcd863a1f5d4a4d6c1a3ce9d818c4438e9e0`. No High or Medium findings
remained at that checkpoint. Both verified the 124 B11 tests under real bubblewrap, typecheck,
build and reproducible report. Claude also ran the full suite (769 passed,
48 skipped), checked pilot aggregates and spot-checked the newline mutation.
Those approvals cover that historical checkpoint only.

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
`ci-full` matrix and review of PR #57. Dataset integration is complete. The full
study remains unrun; neither quality retention nor size break-even is shown.


## Quota-stopped real-task follow-up

The dataset `186c781` is integrated unchanged. `fixturePath()` confines its
repository-relative paths; checks run in `/work`. Event timing measures
arrival, not discovery. Reports retain invalid reasons, deadline values,
under-90% completion warnings and zero-valid arms. Historical missing fields
remain missing. Wall time includes preselection, checks and cleanup; startup
and completed-step durations do not partition it.

[Diagnostic protocol](../../bench/results/2026-10-22T10-37-00Z-diagnostic-b11/protocol.json):
two GLM 1,200-second timeouts, 110/108 completed steps and maximum sampled
compactions 42/54. DeepSeek skills-all was interrupted without a row;
DeepSeek all never started. The heavy bracket selected 250/5, actually
274 skills /20 servers /509 tools. Four screened sessions completed without
compaction (three checks passed); this does not establish broad reliability.
The 500/10 candidate compacted and was deliberately stopped.

[Real-task pilot protocol](../../bench/results/2026-10-22T11-13-00Z-pilot-b11/protocol.json):
15 of 90 planned sessions recorded, two interrupted without rows and 73
unstarted. GLM bare completed nine (3 pass /6 fail, 57 steps); GLM mcp-all
recorded six timeouts (one completed step), not quality failures. Other cells
are unmeasured. Launch source `e0eaefd` predates quota-stop fixes. All calls
stopped at the persistent free usage cap. The marker reports API/retry error
classes and three internal attempts; numeric HTTP status, quota and reset
time are unknown. Interrupted usage is unknown. Maximum observed overlap
was three, not evidence that concurrency 3 or 4 is safe. See
[RESULTS](../../bench/RESULTS.md#b11-real-task-pilot-2026-10-22-quota-stopped).

Combined B11 cost remains 52 Jev calls / $0.029791062; real-task runs used
no Jev calls and $0 free-model billing. No further provider calls were made
after detecting the cap. The revised harness cannot resume legacy rows with
unknown provenance and exit-code grading. Once provider availability returns,
the orchestrator starts a replacement pilot in a fresh output directory:

```bash
B11_PILOT="bench/results/$(date -u +%Y-%m-%dT%H-%M-%SZ)-pilot-b11"
npx tsx bench/b11.ts --run --tasks bench/data/b11/tasks.jsonl \
  --opencode "$OPENCODE_BIN" --library "$B11_LIBRARY" \
  --models opencode/glm-5.3-flash-free,opencode/deepseek-v4.1-flash-free \
  --arms bare,mcp-all,heavy-max,gateway,preselect \
  --heavy-skills 250 --heavy-servers 5 \
  --per-kind 3 --reps 1 --batch-size 9 --concurrency 2 \
  --timeout 300 --jev-budget 0.065 \
  --out "$B11_PILOT"
```

For later launches against this replacement output, add `--resume`: it skips
valid identities and retries invalid ones only when library fingerprints and
the grading protocol match. The $0.065 Jev cap
plus prior spend is $0.094791062, within the pilot's $0.10 allowance. A full
study requires a completed usable pilot and available quota; its exact
nine-arm command is above. The offline plan verifies 792 sessions and 448
waves at concurrency 2: a 300-second all-deadline schedule of 37 h 20 min,
not expected runtime. A conditional 31-second wave scenario gives 3 h 51 min
28 s, but unmeasured arms prevent treating that as a prediction. Expected
runtime and quota reset time remain unestablished.

Final local verification at `22956a4`: full WSL suite 893 passed /48 skipped
in 32 files; typecheck and build passed. Focused B11: 248 passed. Native
Windows: 227 passed /21 POSIX skipped; typecheck passed. Executed mutation
checks total 208 (189 earlier +8 schema +8 lifecycle +3 quota race checks),
all caught; saved source bytes were restored. These counts are checks,
not unique source conditions.

Fresh Codex approved `22956a4` after fixes for cooldown/prelaunch racing
and partial quota JSONL. Claude R6 approved `2cbe345`; its Low partial-line
finding was fixed in `22956a4`. The required final Claude R7 review could
not run because Claude reported an API rate limit; it was not retried.
PR #57 now has changes requested from both reviewers and Ubuntu CI is red.
Re-review, `ci-full` and Erik's merge approval remain pending. Earlier approvals above apply
only to their named checkpoints. No full study or quality-retention claim
is complete.


## PR #57 review round 1

Local fixes retain the original rows and do not run providers. `runCheck()`
is now in `bench/b11-check.ts`, re-exported by `b11.ts`. Its trusted Node
parent uses a literal top-level fixture inventory and read-only mounts;
early exit, stdout markers, missing, skipped and TODO cases cannot satisfy it.
The supported fixture declaration forms are covered by regression tests.

`Sandbox.ports` lists the only host TCP ports forwarded by pasta;
`readonlyMounts` protects checks and the trusted runner. `requireNetwork()`
fails `--run` clearly without passt. Network tests skip only on an absent
executable; installed-but-broken pasta fails. Outbound HTTPS is enabled in CI,
with a skip only when that host probe cannot connect. The Ubuntu CI-only
namespace setting follows the official Ubuntu 24.04 release notes; suppressed
startup stderr prevented proving the exact prior CI failure locally.

`prepareB11Library()` requires an explicit public-corpus root. Plan/protocol
metadata records distractor counts, name/content/source hashes, corpus
reference commits and known installed revisions. Unknowns remain explicit;
installed metadata is not independent verification of upstream content.
Protocol v2 refuses incompatible legacy resumes or changed provenance.

Gateway endpoints have separate credentials. `HarnessError` allows fixed
harness diagnostics while suppressing library/provider/filesystem details.
Task panels and size sweeps share `sweepTasks()`. OpenCode is a constant
1.19.3 pin; there is no version override. Plan JSON links to the README for
prose. BACKLOG is a short status linked to #57, RESULTS and this handoff.
Historical protocols document exact metadata/quota projection methods and
unknown library fingerprints. The foreign-Host regression uses a real HTTP
request because fetch normalizes that header.

Source checkpoints: `4a4e9c0` (explicit corpus) and `37fb513` (checker,
network, runner and CI). No push or provider run was made. PR #57 remains
at its previous remote head until the orchestrator pushes these fixes.

Fresh LF WSL clone verification at `/var/tmp` (local bundle, same locked
dependencies): `npm test -- --maxWorkers=2` passed 937, skipped 66, in 35 files;
`npm run typecheck` and `npm run build` passed. Eighteen skips are the missing
pasta checks below; 48 are pre-existing platform skips. Native Windows B11
checks passed 257, skipped 53 POSIX cases; typecheck passed. The five reports
remain byte-identical, protocol projection methods/JSON validate, and CI YAML
parses. All 24 real hidden-check inventories were exercised on their untouched
workspaces and failed as expected, without sandbox-failure results.

Mutation evidence this round: 57 successful checks (17 corpus, 20 final
network-sweep variants, 16 checker/CLI/Host guards, 4 runner bookkeeping).
The runner bookkeeping checks used real offline bubblewrap with fake OpenCode
and Jev plus a test-only transport substitution; they do not verify pasta.
Saved bytes were restored after every mutation. Historical successful-check
count is 265 including the earlier 208; these are executions, not a count of
unique source conditions. One UDP automatic-publishing mutation survived a
network sweep; its fixture lifetime was corrected and the final real-network
rerun remains pending, so it is excluded from the 57.

Remaining local runtime checks: 14 pasta-backed runner cases and four real
network cases: selected forwarding/unrelated-loopback blocking, no automatic
TCP/UDP publishing, process exit/timeout/quota lifecycle, and outbound HTTPS.
They skip explicitly only when pasta is absent. CI installs passt and enables
`B11_TEST_INTERNET=1`; installed-but-broken pasta is a failure, not a skip.
The Ubuntu namespace workaround and final pasta path need the orchestrator's
CI rerun, followed by WSL verification after passt is installed. Reviewers have
not reviewed these new commits yet. No full study or provider retry was run.
