# C2 protocol: does the small tier plus loadout match the large tier?

Backlog item C2. The fixtures and this protocol were written before any run.

## Provenance of the tasks

- Claude Opus 5.5 (a Claude Code worker session; model from the commit's
  Co-Authored-By line) wrote all 18 tasks, their inputs and `KEY.md` on
  2026-10-12. It did not read the skill library (`bench/data/library*`, skill
  lists) or `requests*.jsonl`, but it had `bench/RESULTS.md` in context, which
  names library skills (`contract-review`, `xlsx`, `statistical-analysis` and
  others). So the tasks are not independent of the library:
  - `data-ab-test` repeats the outcome pilot's A/B task;
  - the office tasks mirror the docx, xlsx, pptx and pdf skills in
    anthropics/skills.
- The tasks sit in areas where skills exist; results say nothing about work
  outside them. Inputs are hand-written or produced by
  [make_inputs.py](make_inputs.py) (seeded, repeatable byte for byte). Names,
  companies and numbers are invented.
- 4 tasks are controls (`ctl-*`) where no skill should help; a gain there
  points at the harness or the judge. No tuning happens on these tasks, so all
  18 are test tasks; a change that follows from the results is re-tested on
  new tasks.

## Isolation

The repo is public and holds the answers (`KEY.md`, the generator). `Bash` runs
without limits, so the sandbox, not the tool list, is the boundary. A run does
not start until the sandbox meets all of this:
- **A container or VM, one per run, destroyed after it.** A throwaway user on
  the host does not qualify: it shares the host's files, processes, disk and
  network. Nothing is mounted back; the runner copies the outputs out.
- **Nothing from the host.** No bind mounts or host volumes (the run folder is
  a fresh volume), no container-runtime socket, no `--privileged`, no added
  capabilities, `no-new-privileges`, and a non-root user inside. No checkout,
  and none of `~/.claude`, `~/.codex`, `~/.loadout`, an SSH agent or a cloud
  credential. So the Docker tasks (`devops-*`) cannot run `docker`, and the
  judge reads the files instead.
- **Limits set from outside**, so the agent cannot lift them: CPU, memory,
  process count, disk for the run folder and the writable layer, and the
  15-minute wall clock.
- **Egress enforced outside the container** (a network rule, not a setting
  inside it). The only route is to the harness gateway
  ([GATEWAY.md](GATEWAY.md)), by its exact address. Denied: everything else,
  the host, other containers, private and link-local addresses (cloud metadata
  included), and any direct route to the Anthropic and Jev APIs. WebFetch and
  WebSearch are disallowed too, as a tool setting only.
- **Name resolution is egress too.** A lookup of `<secret>.attacker.example`
  reaches the attacker's name server with no connection from the container, and
  a skill can encode a credential into DNS labels. The only resolver the
  container can reach is the harness's. It answers the gateway's name exactly
  (no wildcard or suffix match) and REFUSED for every other name, forwarding
  nothing. It keeps counters, never names (answered, refused, forwarded, which
  must stay 0, per run, and a flag set when a query equals the self-check's
  canary). The egress rule denies port 53, DNS over TLS (853) and DNS over
  HTTPS to any other address.
- Each run starts in a fresh folder holding a copy of only that task's `inputs`
  from [index.json](index.json) (not `task.md`, not `KEY.md`).
- The plugin is a copy of `plugins/loadout` outside the checkout; `loadout`
  comes from a packed build (`npm pack`), not from the checkout.
- Nothing can be installed during a run, so the image, the same for all arms,
  comes with Node 22+, Python 3 with python-docx, openpyxl, python-pptx, pypdf,
  pdfplumber, pandas and matplotlib, and sqlite3. Versions go into the results.
- **Collection, checks and text extraction run in a second sandbox.** When
  `claude` exits, the run ends in the order in [GATEWAY.md](GATEWAY.md). The
  sandbox state must read stopped, with no process left in its cgroup, before
  anything else happens; that kills every process the agent started,
  background ones included. A fresh sandbox from the same image then gets the
  run volume mounted read-only, with no network at all, no credentials and the
  limits in the table below. It runs three stages: the collector, the text
  extraction and the check script. They execute or parse what the agent wrote
  (`node --test`, unittest, docx and pptx files), so they never run on Erik's
  machine, and the host never walks, opens or parses the agent's folder itself.
- **The collector looks before it opens.** It works in this order:
  1. It walks the run folder with `lstat` only, opening nothing, and prunes
     `node_modules`, `.venv` and `__pycache__` when they are real directories
     (a symlink with such a name is a violation). It accepts regular files and
     directories only. A symlink, FIFO, socket, device, a file with `st_nlink`
     above 1, a name that is not valid UTF-8 or holds a control character, and a
     path over the limits below are violations.
  2. Limits come from the fixtures: the largest task input is 38 KB and 5 files
     (at most 50 zip entries, the largest 438 KB inflated). The collector
     allows 500 entries, depth 6, a relative path of 200 bytes, a name of 100
     bytes, 8 MiB per file and 32 MiB in all. Sizes are `st_size`, so a sparse
     file counts at full length, and a file is never read to measure it.
  3. Only then does it open each file (`O_RDONLY|O_NOFOLLOW|O_NONBLOCK`, so a
     swapped-in FIFO cannot block), `fstat` the descriptor, which must show a
     regular file with `nlink` 1 and the size the walk saw, and read at most
     that many bytes.
  4. It writes a tar stream of regular files and directories, with names it has
     checked, to its stdout, and is killed after 32 MiB plus headers. The host
     never uses `docker cp` or any copy that follows links; it reads only that
     stream, with a bounded parser, into a fresh folder under names it
     generated (`O_EXCL`, `O_NOFOLLOW`). Another entry type, an unchecked name,
     a size that disagrees with its header and a stream over its cap fail the
     same way.

  Any violation fails the run as `output rejected`: nothing from its folder is
  scanned, extracted or judged; the run is counted per arm, not rerun (see
  [Arms](#arms)).
- Runs and judging happen on a local machine where the CLIs are logged in.

Every later step that touches bytes or metadata the agent controls has a bound
too, or runs in the sandbox without network. A step that hits its bound fails
the run as `output rejected` (collect) or fails that check or extraction
(counted, never named); it does not stall the batch.

| Step | Where | Bound |
|---|---|---|
| Credential scan, pass one | host, on the validated copy | streams each file, constant memory. The patterns in [scan-patterns.json](scan-patterns.json) must be linear time (no nested quantifier, and two quantified runs only with a literal between them that the first cannot match); the runner refuses a pattern that is not |
| Office files (zip) | extraction stage | reads entries in memory, never writes an entry to disk by name. At most 200 entries; 16 MiB inflated per entry and 64 MiB in all; inflation stops at the limit whatever the header says; a nested archive is not opened; a part holding `<!DOCTYPE` or `<!ENTITY` is not parsed |
| PDF, SQLite, CSV | extraction and check stages | 200 pages; databases opened read-only; the limits in the next row |
| Extraction and checks, as processes | second sandbox | 60 s CPU and 1 GiB memory per file or check, 10 minutes per run, no network. Over the limit, the extraction or check fails and is counted. The host reads at most 1 MiB of stdout from each and 8 MiB per run, kills the sandbox past either, and counts the extractions it skipped |
| Judge input | host | extracted text cut at 256 KiB per output, the cut counted and reported; the same text rules for both arms; redaction runs on that text |
| Stream JSON | host | read line by line with no whole-file parse. A line over 4 MiB (`claude` itself cuts tool output near 30 KB) is skipped, not parsed, and counted. Only the top-level events `system` (init, and the hook events `--include-hook-events` adds), `assistant` and `result` are parsed, after a prefix test and a nesting-depth scan (64 at most); tool results are never parsed. Numbers are taken from named fields and must be finite and not negative. The stream is cut at 128 MiB, stderr and the final message at 1 MiB each. An out-of-order event or a second or missing `result` is counted (see Evidence in [GATEWAY.md](GATEWAY.md)) |
| Freeze and HMAC | host | built from the validated copy and the capped stream, streamed with an incremental HMAC, never held in memory. A run is at most about 170 MiB (32 MiB files, 128 MiB stream, 8 MiB extracted text); the runner stops if free disk is below that |

The collector, the host's tar parser and its stream parser have tests on
made-up inputs before the smoke run, as the check script does. Collector: one
folder per violation (symlink, FIFO, socket, hard link, sparse file over the
limit, too many files, too deep, a long name, a symlink named `node_modules`),
each rejected inside 60 s. Tar: a wrong entry type, a size mismatch, an
oversize stream, an unchecked name. Stream: an over-long line, deep nesting, a
bad number, an oversize stream, no `result`.

The smoke run starts with a self-check from inside the sandbox, as the agent's
`Bash` would see it. It passes when all of these hold:
- No host path and no runtime socket exist, and there is no route to the host
  or to a metadata address.
- Connection: a TCP connect to a literal outside IP address fails. (A literal
  address takes name resolution out of the test.)
- Resolution, apart from connection: a lookup of a canary name through the
  container's resolver fails or is refused; the same lookup sent to a public
  resolver, over port 53 and 853, gets no answer; and the resolver's counters
  show the canary flag set, refused up by the lookups made and forwarded still
  0. The canary is a random label under a domain the operator controls, if its
  name server logs queries (it must see nothing), plus a name that does not
  exist.
- Control: the gateway's name resolves and a minimal request through it
  succeeds, so a dead network cannot pass.
- The configured limits show.

Its output goes into the results.

## Arms

One run per task and arm. `$PROMPT` is `task.md` verbatim, read by the runner
from outside the run folder. All arms share this argv and this environment;
only `small-loadout` adds to it. No real key is in the sandbox: the gateway
holds them ([GATEWAY.md](GATEWAY.md)).
- `ANTHROPIC_BASE_URL=<gateway>` and a placeholder `ANTHROPIC_API_KEY`.
- `DISABLE_COMPACT=1`, `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK=1` and
  `CLAUDE_CODE_MAX_RETRIES=5` (the N in GATEWAY.md). Compaction and the
  fallback would rewrite or re-send turns.
- `FORCE_PROMPT_CACHING_5M=1`, since the gateway refuses the 1-hour cache TTL.
- `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` (the background title request),
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` (auto-updates among others) and
  `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false`: the documented switches for
  requests outside the conversation. The smoke run must see zero side calls.
- `ENABLE_TOOL_SEARCH=false` loads every tool upfront. Unset, tool search is
  off only because the base URL is not first-party.
- All are in [env-vars](https://code.claude.com/docs/en/env-vars) (read
  2026-10-14; `DISABLE_NON_ESSENTIAL_MODEL_CALLS` is not). The smoke run
  confirms each on the pinned CLI.

The argv:

```bash
claude -p "$PROMPT" --output-format stream-json --verbose --include-hook-events \
  --model "$MODEL" --no-session-persistence --setting-sources '' \
  --strict-mcp-config --mcp-config "$MCP" \
  --permission-mode acceptEdits --allowedTools Bash $EXTRA_TOOLS \
  --disallowedTools WebFetch WebSearch Task
```

| Arm | `$MODEL` | `$MCP` | Additions |
|---|---|---|---|
| `small-bare` | `claude-haiku-5-5` | `{"mcpServers":{}}` | none |
| `small-loadout` | `claude-haiku-5-5` | `{"mcpServers":{"loadout":{"command":"loadout","args":["mcp"],"env":{"LOADOUT_HOME":"<home>"}}}}` | `--plugin-dir <plugin copy>`; `$EXTRA_TOOLS` = `mcp__loadout__find_skills mcp__loadout__load_skill`; `LOADOUT_HOME=<home>` in the environment, a loadout home with the full library, whose `config.json` points `jev.baseUrl` at the gateway and `jev.apiKeyFile` at a placeholder |
| `large-bare` | `claude-sonnet-5-5` | `{"mcpServers":{}}` | none |

- `plugins/loadout` is hook-only. The hook tells the agent to call
  `load_skill` or read a skill's SKILL.md, so the loadout arm also gets
  `loadout mcp` with its two read-only tools pre-approved, as the launchers
  do.
- **No subagents.** `Task` (`Agent` in builds that renamed it) is disallowed in
  every arm: it opens conversations of its own, which would need a second rule
  the gateway can verify. The arms stay equal and the chain rule single, at the
  cost of any gain from subagents (a stated limit).
- **No compaction, in every arm.** A compaction rewrites the assistant turns,
  which the chain rule cannot accept: it would make the run `invalid`, mostly
  for `small-loadout`, whose hook context and skill text fill the window
  sooner. `DISABLE_COMPACT=1` turns off all of it, `/compact` included. A run
  that fills the window ends at the provider's context error and is judged as it
  stands, flagged `context full`. A compaction that happens anyway is off-chain.
- **Pinned CLI.** The image holds one `claude` version, part of the treatment
  hashes, with auto-update off (see the env list above).
- **Caps.** 15 minutes wall clock per run, measured by the runner. On a timeout
  the folder as it stands is judged and the run is flagged `capped`; the rate
  per arm is reported (in the [pilot](../../RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07),
  loadout runs hit the 6-minute cap 4 times, bare runs twice).
- **Collected per run, kept local** in a folder outside the checkout, never
  pushed or shared: the stream, the `claude` stderr, the final message (the
  `result` text, or the last assistant text when there is no `result`), every
  file added or changed relative to the inputs, and the gateway's record.
- **Order and concurrency.** Arms run in separate batches, resumable per
  task, one run at a time (GATEWAY.md has the run-end order); parallel runs
  would change how often the limits hit.
- **Failed runs.** A run is rerun once from a clean folder only for a fault the
  engine reports on its own side: the sandbox failed to start, or the engine or
  host restarted. An upstream 5xx, 529 or 429, a stream cut and a drain abort
  are never causes, since `Bash` could fish for them: they are transport
  events, and the run stands, flagged, with its cost. Nor is an out-of-memory
  kill, a process or disk limit or a full run volume (the agent can reach them),
  a `result` event saying "API error" (the sandbox's word) or how the output
  looks. The failed attempt must be valid. If the rerun fails too, the run is
  reported as missing.
- **Invalid and rejected runs are results.** A run with an off-chain request
  or other off-list gateway traffic (GATEWAY.md) is `invalid`; one whose folder
  fails collection (Isolation) is `output rejected`. Neither is rerun. Every
  `invalid` run halts the batch until Erik classifies it as caused by the agent
  (it stands) or by `claude` (a deviation under Frozen, and the run is rerun
  after the fix). Both are counted per arm and task, and their cost counts
  toward the spend.

## What is committed

Raw agent output is not committed: not the final message, the files, the
stream, the extracted text, the judge inputs or the judge's sentences. The repo
is public, and an output can hold a credential in a form no scan catches
(base64, split across files, compressed), or third-party skill text nobody has
read. Only withholding the text is safe. This departs from AGENTS.md's "commit
raw results".

Committed under `bench/results/<timestamp>-c2/`, as numbers and fixed values the
harness computes or reads from named fields, never agent text:
- per run: arm, task, `capped`, `ceiling`, number of reruns, the gateway's
  model calls, tokens and priced cost (as billed and uncached), the runner's
  duration, the model and tool list of the first request, whether it held the
  hook's `<skill_relevance>` context, the Jev cost, the gateway and resolver
  counters, the requests by kind (links, exact retries, off-chain), the
  transport events (upstream failures, cut or aborted requests, requests priced
  at their reservation), `invalid` or
  `output rejected` with the number of violations by kind, and the
  names of selected skills when each is a name in the library (read from the
  first request). Next to them, labelled as reported by the sandbox:
  `total_cost_usd`, `num_turns`, `duration_ms` and the hook's exit status;
- every check result, with the counts the check reads (tests run, rows,
  slides) and the number of files each check dropped from its copy;
- the sandbox self-check, the credential probe, and the hashes of the treatment
  (see Smoke run first);
- per judge call, only the verdict (`A`, `B`, `tie`) or guess (`A`, `B`,
  `unsure`), the redaction counts per arm and the extracted size in bytes;
- the commitment below.

Kept local with the raw outputs: all text above and the judge's one-sentence
reasons, which quote the outputs.

**The commitment is one value.** When judging is done, the runner freezes
everything kept local into one archive, generates a random 256-bit key, keeps
it local, and commits one HMAC-SHA-256 of the archive under it. Per-file hashes
are not committed: an agent that can read a secret can grind a nonce into each
file until a hash byte matches a secret byte, and the ordered list then
publishes the secret. One fixed-size value under a key made after the freeze
carries nothing the agent chose.

Others can recompute from the committed folder the win, tie and split counts,
the Wilson intervals, the guess accuracy, check pass rates, and the cost, model
call, duration and capped figures, not the verdicts and check results, which
need the raw outputs and the judge. To verify the HMAC, Erik gives a reviewer
the whole archive and the key. Publishing any raw output is a separate decision
for Erik (AGENTS.md rule 4), taken after he has read it, and he reviews the
folder before anything is pushed.

## Smoke run first

One run per arm on [smoke/](smoke/), a fixture outside all 18 task areas, not in
`index.json` or `KEY.md`, never scored or judged, its outputs not in the
results. The harness (see Frozen before the first run) is committed before it
runs.

**The treatment is frozen first.** Before the smoke run, the results record the
SHA-256 of the packed `loadout` tarball, of the plugin copy (a tar of its files
in sorted order), of the library snapshot in the loadout home, of that home's
`config.json` and of the `claude` install (with its version). The full run must
show the same five hashes. A treatment that does not run (the first request
lacks the hook's context, tools are missing) stops the plan for Erik to decide,
and a changed treatment is a new registration with new hashes.

It passes when:
- the sandbox self-check and the credential probe have run and their output is
  recorded;
- the first request at the gateway lists the same tools in all arms, apart from
  the plugin hook and the two loadout tools in `small-loadout`, and names the
  model asked for (the init event agrees);
- the first request of the `small-loadout` run holds the hook's
  `<skill_relevance>` context, and none of a bare run does (the hook event
  shows exit 0);
- the collector and the extraction script run on each smoke output folder;
- the gateway sorts every request of each smoke run as a next link or an exact
  retry, and the stream cross-check agrees with it exactly on message ids and
  token sums;
- a stub-upstream step answers `claude` with a 529, a mid-stream cut, a
  `max_tokens` stop and a context-overflow 400 in turn, and records exactly what
  it resends after each. The gateway's retry and continuation rules accept those
  resends and no others; a resend that differs (another `max_tokens`, a trimmed
  context) is listed as an accepted change or stops the plan for Erik.

The run records what the gateway saw: the fields that change within a run (the
only ones the pin to position 1 lets differ), Jev requests per hook decision
and per `find_skills` call, the most requests in flight, the keys, tool types,
models and beta values the allowlists will hold, `claude`'s `max_tokens`,
context window and retry limit, the slowest response, and the largest
reservation of an honest request. It must fit under the arm's ceiling; if not,
the ceilings and the cost table change together before the full run.

Recorded, not a gate: whether the `small-loadout` run opened a skill
(`load_skill` or a read of a SKILL.md). A miss is reported; the treatment is
not changed.

A fault the smoke run shows in the runner, the gateway, the sandbox or the
extraction is fixed before the first full run, and the fix and its reason go
into RESULTS as a deviation.

## Checks by script

A text judge cannot tell whether tests pass or a file opens. One script runs
in the second sandbox after each run and records pass or fail per check. A file
named below that is missing fails its check. An agent's test command can pass
while testing nothing, and its files can change how a check runs, so:
- **A check runs in a fresh folder**, never the run folder: the task's original
  inputs from `index.json`, the collected agent files laid over them, then the
  pinned files copied back from the fixture (named in the table). Every
  comparison input ("differs from `lease.docx`", the log the `code-logsum-flags`
  probe reads) also comes from the fixture. Edited tests, an edited
  `package.json` or an edited log are therefore never what runs.
- **Dropped from the copy**, counted (the count is committed) and never named:
  - a top-level file or folder whose name without extension is a Python
    standard-library module (`sys.stdlib_module_names`): a local `unittest.py`
    that printed "Ran 4 tests / OK" passed `ctl-merge-conflict`, and a local
    `json/` folder shadows `json`;
  - compiled code: `*.pyc`, `*.pyo`, `*.so`, `*.pyd`, `*.node`;
  - the agent's `package.json`, whose `type` and `imports` change how Node
    loads modules. The fixture's is used, or `{}` where the task has none.
- **Closed by construction.** The checks never call `npm` or `pytest`, so
  `.npmrc`, `scripts` and `pytest.ini` are never read. `sitecustomize.py`,
  `usercustomize.py`, `*.pth`, `conftest.py` and `pyproject.toml` in the folder
  change nothing for `python3` there (tried). `NODE_OPTIONS` and `PYTHON*` come
  only from the harness's environment (`env -i`, a fixed `PATH`). A bare
  builtin name in Node resolves to the builtin before any file, and
  `node_modules` is left out. Checks that only read files run as `python3 -I`
  from a script outside the folder.
- **A test run** passes only if the runner counted N > 0 tests with no failure,
  error, cancellation or skip, and exited 0. Node 22 exits 0 when it finds no
  test file, and unittest does before Python 3.12.
  - Node: `node --test --test-reporter=tap --import freeze.mjs`, reading
    `# tests N`. `freeze.mjs` (harness-owned, outside the folder) freezes
    `node:assert`, `node:assert/strict` and `node:test`. An implementation that
    stubbed `assert.equal` passed all 6 `ctl-ratelimiter-bug` tests; frozen,
    the stub throws and the run fails (tried).
  - Python: `run_unittest.py` (outside the folder) discovers the tests (only
    the pinned file where there is one), takes
    the counts from the `TestResult` object, not from printed text, and
    compares the attributes of `unittest.TestCase`, `TestResult`,
    `TextTestRunner`, every collected test class and `sys.modules['unittest']`
    before and after the run, failing on any difference. An implementation that
    replaced `assertEqual` passed all 4 `ctl-merge-conflict` tests; the
    comparison catches it (tried).
- **Probes** run the agent's code in a child process that prints its results
  as JSON; another process compares them. The code decides what it returns, not
  what counts as a pass.
- Not closed: the code under test shares a process with its tests, so a patch
  to another module the test uses is not caught. A check shows what the agent's
  code prints, not that it is honest. The judge reads the files, and a faked
  pass found there is reported.
- The script has tests on made-up outputs, before the smoke run; each vacuous
  case (missing, empty, no tests, edited test, local `unittest.py`, stubbed
  `assert.equal`, replaced `assertEqual`) must fail them.

| Task | Check |
|---|---|
| docx-lease-amendment | lease-revised.docx opens with python-docx, differs from lease.docx, and has at least 246 words of paragraph text (80% of the original's 307) |
| docx-minutes | minutes.docx opens with python-docx, has at least 50 words and at least one table |
| xlsx-budget-cleanup | budget-clean.xlsx opens; sheets Clean and Summary; Clean has a row under its header; Summary has a formula that names Clean |
| pptx-board-deck | board.pptx opens; 1 to 5 slides; every slide has non-empty notes text |
| pdf-invoice-extract | line-items.csv parses; a header and at least one row; every row has 7 columns |
| data-orders-sqlite | orders.db, opened read-only, exists, `PRAGMA integrity_check` returns ok, and at least 2 tables hold rows |
| web-signup-form | a test run; the probe below |
| web-landing-new | index.html exists, parses and has body text; no `src`, `srcset`, `poster`, `data` or non-`<a>` `href` attribute, no `@import` and no CSS `url()` points at `http:`, `https:` or `//` |
| code-logsum-flags | `access.log` pinned; a test run; `python3 logsum.py access.log` prints what the original script prints (the original runs from outside); with `--status 5xx` the first line is `requests: 13`, with `--status 404` `requests: 8`, with `--since 2026-03-10` `requests: 37`, with `--since 2026-03-10 --status 5xx` `requests: 3` |
| ctl-interval-merge | a test run; a probe from outside on `merge_bookings`: touching bookings merge, unsorted input comes back sorted, start after end raises ValueError, the input list is unchanged |
| ctl-merge-conflict | `test_pricing.py` pinned; its run (Python test run above) counts 4 tests, all pass; no line in any `.py` file starts with `<<<<<<<`, `=======` or `>>>>>>>` |
| ctl-ratelimiter-bug | `ratelimiter.test.mjs` and `package.json` pinned; the Node test run above on `ratelimiter.test.mjs` counts 6 tests, all pass |
| ctl-customer-reply | reply.txt exists and has 20 to 149 words |

**Probe for web-signup-form.** The agent wrote both the code and the only
tests, so the harness owns the probe. The task names the interface:
`validate.js` exporting `validate({ email, password, confirm, terms })`, which
returns an object with one message per failing field (keys `email`, `password`,
`confirm`, `terms`) and an empty object when all is valid. The probe loads it
with `import()` (the named export, or `validate` on the default export), and all
of these must hold:
- Valid: the emails `ann@example.com` and `a.b+c@sub.example.org`, each with
  password `abcdefghi1` (10 characters, one digit), the same confirm and terms
  true, give no keys.
- Email: `''`, `plain`, `a@`, `@b.co` and `a b@c.co` each give exactly the key
  `email`.
- Password: `abcdefgh1` (9 characters), `abcdefghij` (no digit) and `''` each
  give exactly `password`, with a matching confirm.
- Confirm: a valid password with a different confirm, and with `''`, give
  exactly `confirm`.
- Terms: `false` gives exactly `terms`.
- Error behaviour: every message is a non-empty string; all four fields wrong
  at once give all four keys (no stopping at the first); an all-empty input
  does not throw; the input object is not changed.
- `signup.js` still contains the original `fetch('/api/signup', ...)`
  statement, compared with whitespace collapsed.

Whether each error shows next to its field and is announced (`aria-describedby`,
`aria-invalid`, a live region or a focus move) has no script check; the judge
decides it against the key.

No script check: web-pricing-fix, data-sales-clean, data-ab-test,
devops-ci-slow, devops-compose-debug. The judge alone decides those.

Pass rates per arm and check are reported with Wilson intervals, next to the
judged results. The judge does not see them.

## Judging

- **Waits for E12.** The judge is Codex (gpt-6.1-sol), since Claude wrote the
  tasks and runs every arm. Outputs can carry third-party skill text, so Codex
  cannot judge until it can run with no tool that reads files, runs commands or
  reaches the network (E12). The files backend is no substitute.
- **Framing.** Outputs reach the judge escaped with `escapeSkillTags`, framed as
  third-party content with provenance `unverified`. `escapeSkillTags` escapes
  `<skill` tags only and does not strip terminal control characters, so the
  runner never prints agent text.
- **Blind.** Per task, three pairs: `small-loadout` vs `small-bare`,
  `small-loadout` vs `large-bare`, `small-bare` vs `large-bare`. Each pair is
  judged twice with the order swapped. The judge sees `task.md`, the extracted
  input files, that task's `KEY.md` entry, and two outputs labelled A and B:
  the final message and the files. Never transcripts, tool calls, skill names,
  cost, model or timing.
- **Binary outputs** (docx, xlsx, pptx, pdf) are turned into text by one
  script for all arms: paragraphs and tables, sheets with formulas and their
  cached values, slides with notes. Formatting that text cannot show is not
  judged. Text files are shown as they are, within a size budget.
- **Verdict call.** Which output better does what the request asks, counting
  correctness against the key first, then completeness, then clarity. Answer
  `A`, `B` or `tie`, with one sentence. The prompt says nothing about guidance,
  skills or arms.
- **Guess call, separate.** After every verdict call has finished, each
  verdict call gets a second call with the same `task.md` and the same two
  outputs in the same order, without the key, asking only which output had
  extra guidance: `A`, `B` or `unsure`. It is separate because the
  question in the verdict prompt can steer the judge toward style differences.
- **Verdict per pair and task**, as in the pilot ([outcome.ts](../../outcome.ts),
  RESULTS): a side wins only if it is preferred in both orders. Two ties are a
  tie. Anything else is a split, never a win: opposite preferences (position
  bias), or a preference in one order and a tie in the other. Ties and splits
  are reported separately, splits broken down into those two.
- **Sequential.** The 216 judge calls (108 verdict, then 108 guess) run one at a
  time (concurrency 1), not through the two-way pool `outcome.ts` uses, so the
  judge's cached prompt stays warm. Calls are grouped by task, the fixed part of
  the prompt (instructions, `task.md`, inputs, key entry) first. Each call is
  its own process, with no session or memory carried over.

## Template leakage

A skill's template or wording can show in the output and tell the judge which
arm it is reading. Steps taken:
1. The judge sees only the final message and the files.
2. **Redaction**, the same for both arms of every pair: one whole-word,
   case-insensitive list replaced by `[redacted]` in every output. The list:
   "loadout", "skill" and "skills", the loadout context tags, and the names of
   all skills the hook selected in any run. Names that are file extensions or
   ordinary words (`pdf`, `xlsx`, `docx`, `review`) stay out of the list, and
   matches inside longer words are left ("skillet" stays). Redaction counts
   are reported per arm, since uneven counts would themselves unblind.
3. **Guess metric.** From the guess calls, for pairs with `small-loadout`, a
   guess is correct when it names the `small-loadout` output. Accuracy is
   correct / (correct + wrong) with a Wilson interval; `unsure` is left out of
   the accuracy and its rate is reported. Near 50% means no leakage is
   detected; clearly above means blindness failed, and the win rates carry that
   caveat. For `small-bare` vs `large-bare` no output had guidance, so every
   non-`unsure` guess is a false alarm: that rate is the baseline.
4. Not removed: a style a skill imposes (section order, checklists). A user
   would see it too, so it counts as part of the result, but it can reach the
   judge: a stated limit.

## Analysis

- **Primary set: the 14 non-control tasks.** The 4 controls are reported
  separately, with the skills the hook loaded on each.
- **Primary comparisons, fixed before any run:** `small-loadout` vs
  `small-bare` (does loadout help the small tier) and `small-loadout` vs
  `large-bare` (does it close the gap). The third pair is context.
- **Win rate:** wins / (wins + losses), with a 95% Wilson interval. Ties and
  splits are left out of the rate but always shown next to it, so a reader can
  see how many tasks it rests on. A pair with an `invalid` or `output rejected`
  run is not judged. It counts as a loss for the arm that has the bad run (a
  tie if both do), and the rate is also shown with those pairs left out, with
  their number beside it. It is shown too without the pairs where a run is
  `context full`, which the loadout arm reaches sooner, with their number. With
  14 decided tasks the interval clears 50% only from 11 wins (79%); with fewer
  decided tasks the bar is higher (7 of 8, 9 of 10, 10 of 12). Anything smaller
  is "not shown".
- **Cost per task:** mean and median per arm of the gateway-priced cost (upstream
  usage at list price, as billed and uncached) plus Jev cost for
  `small-loadout`, with the CLI's `total_cost_usd` beside it as reported by the
  sandbox. The headline is the uncached figure. Also cost per task won, capped
  and `context full` rates, median model calls (the gateway's) and median
  duration (the runner's), with `num_turns` and `duration_ms` beside them as
  reported by the sandbox. The Codex CLI reports no cost (`costLabel` in
  `bench/lib.ts`), so the judge's cost is not reported.
- **Per task:** a table of verdicts, to show which tasks drive a difference.
- Negative and null results go into `bench/RESULTS.md` with the numbers.

## Frozen before the first run

The commit that merges this protocol fixes the tasks, `KEY.md`, the checks,
the redaction rules, the limits under Isolation, the accounting rules in
[GATEWAY.md](GATEWAY.md), the primary comparisons and the analysis. The
runner, collector, gateway, resolver, sandbox self-check, credential probe,
extraction script, check script with its tests and both judge prompts do not
exist yet; they are committed before the smoke run and change only as set out
under Smoke run first. The treatment is fixed before it. After the first full run starts, none
of these changes. A change forced by a fault in the harness goes into RESULTS as
a deviation, with the reason and the runs it touched; those runs are rerun once
after the fix, and the originals stay reported. No tuning follows from these
results on these tasks.

## Expected spend (local run)

Preparing these fixtures cost $0: no model or Jev calls.

RESULTS has no measured 15-minute agentic run, so the per-run figures are
assumptions: 20-40 turns over a context of 25k-75k tokens, which is 0.5M-3M
cache-read tokens, 50k-200k cache-write tokens and 10k-40k output tokens per
run. API list prices per million tokens (cache read and write at the usual
0.1x and 1.25x of input, then output):

| Model | Prices | Per run |
|---|---|---:|
| Sonnet 5.5 | $0.20, $2.50, $10 | $0.33-1.50 |
| Haiku 5.5 | $0.01, $0.125, $0.50 | $0.02-0.08 |
| Haiku 4.5 (if Erik picks it) | $0.10, $1.25, $5 | $0.16-0.75 |

For Haiku 5.5, every rate rises 5x for prompts over 100k tokens. The other two
are assumed to do the same (not confirmed; the smoke run corrects this table).
The assumed contexts stay below 100k; the reservations below do not assume it.

| Item | Count | Estimate |
|---|---:|---|
| `large-bare` runs | 18 | $6-27 |
| `small-bare` and `small-loadout` runs | 36 | $0.60-2.70 (Haiku 4.5: $6-27) |
| Jev routing for `small-loadout` ($0.0012 per decision, [C1](../../RESULTS.md#c1-2026-10-08-new-held-out-requests)), hook only | 18 | about $0.02; `find_skills` calls add more, not measured |
| Smoke run, one run per arm | 3 | $0.36-1.65 (Haiku 4.5: $0.65-3.00) |
| Codex judging (3 pairs x 2 orders x 18 tasks, then the same number of guess calls), sequential | 216 | plan quota, cost not reported |

Prices are Anthropic's list prices as of 2026-10-06, not figures from RESULTS.
Expected Claude cost at list price, with no reruns: about $7-31 with Haiku 5.5,
$12-57 with Haiku 4.5. It is cash: the runs use an API key behind the gateway.

A reservation (GATEWAY.md, Pricing) is at most 200k input tokens at the
5-minute cache-write price plus 32k output tokens, both at the 5x tier: for
Sonnet 5.5, 0.2M x $12.50 + 0.032M x $50 = $2.50 + $1.60. The 200k window and
32k `max_tokens` are assumptions the smoke run replaces. A run's ceiling is its
high per-run figure plus two reservations (2 requests in flight), and never
below three times that figure or three times the largest the smoke run
measured. Honest traffic fits under it (the smoke run checks).

| Model | One reservation | Per-run ceiling |
|---|---:|---:|
| Sonnet 5.5 | $4.10 | $9.70 ($1.50 + 2 x $4.10) |
| Haiku 5.5 | $0.205 | $0.485 ($0.075 + 2 x $0.205) |
| Haiku 4.5 | $2.05 | $4.85 ($0.75 + 2 x $2.05) |

**Approvals.** The runner starts an attempt only if the approved cost minus the
finished attempts' priced cost (Jev and invalid runs included) is at least the
arm's ceiling. So n attempts at their high figures need (n - 1) x high +
ceiling. That is the approval and the provider cap on the batch's key
(GATEWAY.md), with n = 36 per arm (a rerun for every run, though reruns are
limited to engine faults); the plan does not reduce the attempts.

| Batch | Approved | Haiku 4.5 |
|---|---:|---:|
| `large-bare` | 35 x $1.50 + $9.70 = $62.20 | same |
| `small-bare` | 35 x $0.075 + $0.485 = $3.11 | 35 x $0.75 + $4.85 = $31.10 |
| `small-loadout` | $3.11 | $31.10 |
| Smoke run (two small arms first, then `large-bare`) | 2 x $0.075 + $9.70 = $9.85 | 2 x $0.75 + $9.70 = $11.20 |
| Jev, `small-loadout` and smoke | about $0.04 | same |
| **Total** | **about $78** | **about $136** |

These are caps, not expectations: the expected cost is the no-reruns figure
above. Wall clock is about 108 x 17 minutes (15-minute cap, 2-minute drain;
about 31 h) plus the smoke run and up to 10 minutes per attempt for collection
and extraction: a planning figure, since the drain runs longer where the smoke
run measured a slower response. The runner also stops at the approved hours and
reports what it left unrun. The smoke run replaces these assumptions with
measured figures before the full run is approved.

## Open for Erik

- Which Haiku: B1 and the hook probe used the `haiku` alias, and RESULTS does
  not record what it resolved to.
- Sonnet 5.5 or Opus as the large tier (the `invoke.ts` runs used Sonnet 5.5).
- The sandbox: container or VM (a throwaway user is ruled out above), and the
  engine, egress mechanism, resolver, gateway and collector sandbox.
- The gateway detects and prices abuse; it prevents only what it refuses
  (GATEWAY.md). Confirm, or say what you would give up for prevention.
- A side call in the smoke run despite the Arms switches halts the plan. The
  fallback, binding each slot of a side-call template to one designated field,
  is unbuilt: build it, or drop the arm.
- Subagents are off in every arm (see Arms). Confirm, or ask for a subagent
  rule the gateway can verify, which is more to build and test.
- Invalid and `output rejected` runs count as a loss for their arm in the win
  rate, shown also without them (see Analysis). Confirm, or leave them out of
  the primary rate. Each `invalid` run halts the batch for you to classify.
- Raw outputs stay local (What is committed), against AGENTS.md's "commit raw
  results". Confirm, or say which you will read and publish.
- AGENTS.md rule 1: is a harness gateway that adds a credential header inside
  the benchmark's sandbox "proxying an agent's API traffic"? If so, the
  fallback is real keys in the sandbox (GATEWAY.md).
- Compaction is off in every arm (see Arms): a run that fills the window stops
  instead of compacting. Confirm, or ask for a compaction rule the gateway can
  verify.
- The prompt cache is shared between runs (GATEWAY.md): accept it as a stated
  limit, or pay for a provider workspace per run.
- The credentials. The Anthropic credential is an API key with a spend cap
  (cash); a subscription token is untested behind the gateway. The Jev key is
  dedicated to the `small-loadout` batch. The lexical router needs no Jev key but
  measures a different product, so it is not the primary comparison.
- A Codex-family replication (gpt-5.6-luna against gpt-6.1-sol) needs a Claude
  judge and is not in this protocol.
