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

Verification in an LF WSL checkout: `npm test -- --maxWorkers=2
--reporter=default` passed 769 tests, skipped 48; `npm run typecheck` and
`npm run build` passed. Focused native Windows B11 tests passed 111 and
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

The separately developed dataset at `agent/b11-tasks` was consumed in an
offline plan from a temporary copy: 72 tasks, 24 per kind. It is not duplicated
on this branch. Combine that dataset before the full command below. For the
72-task version this schedules 936 sessions: all tasks in six core arms, plus
three tasks per kind in four size arms, across both models. Budget exhaustion
stops the run; a resumed run includes all previous Jev attempt costs.

```bash
B11_RESULTS="bench/results/$(date -u +%Y-%m-%dT%H-%M-%SZ)-b11"
npx tsx bench/b11.ts --run --tasks bench/data/b11/tasks.jsonl \
  --opencode "$OPENCODE_BIN" --opencode-version 1.19.3 \
  --arms bare,skills-all,mcp-all,all,gateway,preselect,skills-50,skills-250,mcp-1,mcp-5 \
  --reps 1 --batch-size 9 --sweep-per-kind 3 --concurrency 2 \
  --timeout 120 --jev-budget 1.00 --out "$B11_RESULTS"
```

Use `--plan` in place of `--run` first. The plan is offline and costs $0;
the command's Jev reservation cap is $1, with free-model spend $0. The pilot
does not establish that 120 seconds is sufficient for the heavy arms. Keep
invalid attempts separate when deciding whether to extend the deadline.

Review dispositions are recorded after the final review round below.
