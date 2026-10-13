# C2 protocol: does the small tier plus loadout match the large tier?

Backlog item C2. The fixtures in this folder and this protocol were written
before any run.

## Provenance of the tasks

- Claude Opus 5.5 (a Claude Code worker session; model from the commit's
  Co-Authored-By line) wrote all 18 tasks, their inputs and `KEY.md` on
  2026-10-12.
- It did not read the skill library (`bench/data/library*`, skill lists) or
  `requests*.jsonl`. It did have `bench/RESULTS.md` in context, and RESULTS
  names library skills (`contract-review`, `xlsx`, `statistical-analysis`
  and others). So the tasks are not independent of the library:
  - `data-ab-test` repeats the outcome pilot's A/B task;
  - the office tasks mirror the docx, xlsx, pptx and pdf skills in
    anthropics/skills.
- The tasks sit in areas where skills exist. Results say nothing about work
  outside those areas.
- Inputs are hand-written or produced by [make_inputs.py](make_inputs.py)
  (seeded, byte-for-byte repeatable). Names, companies and numbers are invented.
- 4 tasks are controls (`ctl-*`): plain code or writing where no skill should
  help. A gain there points at the harness or the judge, not at a skill.
- Split: no tuning happens on these tasks, so all 18 are test tasks and none
  is dev. A change that follows from the results is re-tested on new tasks.

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
  inside it). The only route is to the harness gateway (see Credentials), by its
  exact address. Denied: everything else, the host, other containers, private
  and link-local addresses (cloud metadata included), and any direct route to
  the Anthropic and Jev APIs. WebFetch and WebSearch are also disallowed, but
  that is a tool setting, not isolation.
- **Name resolution is egress too.** A lookup of `<secret>.attacker.example`
  reaches the attacker's name server without any connection from the
  container. The only resolver the container can reach is one the harness
  controls. It answers the gateway's name exactly (no wildcard or suffix match)
  and answers REFUSED for every other name without forwarding it. It keeps
  counters, never names: answered, refused and forwarded (which must stay 0)
  per run, and one flag set when a query equals the self-check's canary
  exactly. A skill can encode a credential into DNS labels, so a refused name is
  written nowhere. The egress rule denies port 53, DNS over TLS (853) and DNS
  over HTTPS to any other address.
- Each run starts in a fresh folder holding a copy of only that task's `inputs`
  from [index.json](index.json) (not `task.md`, not `KEY.md`).
- The plugin is a copy of `plugins/loadout` outside the checkout; `loadout`
  comes from a packed build (`npm pack`), not from the checkout.
- Nothing can be installed during a run, so the image, the same for all arms,
  comes with Node 22+, Python 3 with python-docx, openpyxl, python-pptx, pypdf,
  pdfplumber, pandas and matplotlib, and sqlite3. Versions go into the results.
- **Checks and text extraction run in a second sandbox.** When `claude` exits,
  the run sandbox is stopped, which kills every process the agent started,
  background ones included. The check script and the text extraction run in a
  fresh sandbox from the same image with no network at all, no credentials and
  the same limits, holding a copy of the run folder. They execute or parse what
  the agent wrote (`node --test`, unittest, docx and pptx files), so they never
  run on Erik's machine.
- **The copy out is data only.** The runner copies the run folder as an archive
  and leaves out `node_modules`, `.venv` and `__pycache__`. It rejects
  symlinks, hard links, device files and paths that leave the folder, and never
  executes the archive. The host only archives, scans for credentials,
  computes the commitment (see What is committed) and parses the stream JSON.
- Runs and judging happen on a local machine where the CLIs are logged in, not
  in a cloud session.

The smoke run starts with a self-check from inside the sandbox, as the agent's
`Bash` would see it. It passes when all of these hold:
- No host path and no runtime socket exist, and there is no route to the host
  or to a metadata address.
- Connection: a TCP connect to a literal outside IP address fails. (A literal
  address takes name resolution out of the test.)
- Resolution, tested apart from connection: a lookup of a canary name through
  the container's resolver fails or is refused; the same lookup sent straight
  to a public resolver, over port 53 and over 853, gets no answer; and the
  harness resolver's counters show the canary flag set, refused up by the
  number of lookups made and forwarded still 0. The canary is a random label under a domain the operator
  controls, when the operator has a name server that logs queries for it (it
  must see nothing), plus a name that does not exist.
- Control: the gateway's name resolves and a minimal request through it
  succeeds, so a dead network cannot pass.
- The configured limits show.

Its output goes into the results.

## Credentials

What loadout does today (`resolveApiKey` in `src/config.ts`): it reads the Jev
key from the environment variable named there, or else from the file that
`jev.apiKeyFile` in `$LOADOUT_HOME/config.json` names. The hook
(`loadout hook claude`) and `loadout mcp` are child processes of `claude`.
They run as the same user, in the same container, as the agent's `Bash`. So
whatever key those two processes can read, `Bash` can read: `env`, a key file,
`/proc/<pid>/environ`. The Anthropic credential is in the same position:
`claude` needs it and `Bash` is its child. loadout cannot withhold a key from
the shell, and this protocol does not claim it can.

The allowed APIs are an exit too. Skill text can carry an attacker's own key
and have `Bash` call the allowed API with it (the Anthropic batches API, for
example), putting a stolen credential into a request the attacker reads back
from their own account. A host allowlist cannot tell the keys apart inside
TLS. So no real key goes into the sandbox:
- **The gateway holds the keys.** A harness gateway outside the sandbox is the
  only route out. `claude` gets `ANTHROPIC_BASE_URL` pointing at it and a
  placeholder `ANTHROPIC_API_KEY`. The loadout home's `config.json` sets
  `jev.baseUrl` to it, and the file `jev.apiKeyFile` names holds a placeholder.
  The gateway drops any credential header on a request, adds the real one, and
  forwards each route to one fixed upstream host over its own TLS connection.
  It allows only the
  paths the smoke run shows `claude` needs (the messages endpoint, not the
  batches or files APIs) and, for Jev, `POST /v1/systemone`, the one path
  `jevClient` calls. Everything else is refused and counted. An attacker's key
  in a request is overwritten, so nothing the sandbox sends reaches another
  account. It needs an Anthropic API key: the protocol assumes one.
- **Not loadout proxying.** AGENTS.md rule 1 keeps the product from proxying
  or intercepting an agent's API traffic, so a user's traffic never passes
  through loadout. This gateway is part of the benchmark harness: it is not in
  `src/`, not shipped, runs only in this benchmark's sandbox on accounts made
  for it, uses documented settings (`ANTHROPIC_BASE_URL`, `jev.baseUrl`) and
  leaves bodies as they are; it adds a credential header. Erik confirms this
  reading (Open for Erik).
- **Keys per batch, with a cap.** Each batch (one arm, and the smoke run) has
  its own Anthropic key, and the `small-loadout` batch its own Jev key. A key is used nowhere
  else and has a spend cap at the provider, set to the approved total for its
  batch. Where a provider offers no cap, the gateway refuses requests past a
  count the runner sets from that total.
- **Probed.** Before the smoke run a script, running as the agent's user in
  the run sandbox, prints yes or no for each of: a string shaped like a
  credential (the patterns in [scan-patterns.json](scan-patterns.json)) other
  than the placeholders in `env`, in the key file, in `/proc/*/environ` and in
  the home folder; and a connection straight to an API's address getting an
  answer. Against a stub upstream the gateway is shown to replace a credential
  header the sandbox sets and to refuse a path off its list. The answers go
  into the results.
- **Revoked, and confirmed.** A batch's keys are revoked when its last run
  (reruns included) ends, before any of its output is scanned, extracted,
  judged or committed, and one request per key that must now be refused
  confirms it. If a revocation is not confirmed, nothing from the batch is
  committed. This is defence in depth: no real key was in the sandbox, so no
  output can hold one, and if the gateway failed the key is dead by the time
  anything leaves the machine.
- **Scanned.** The runner never prints a key. The scan looks for each key's
  exact value (a hit means the gateway failed) and for the shapes in
  scan-patterns.json, in two passes: the collected file names and contents,
  the stream and the `claude` stderr, on the host, before extraction; then the
  extracted text, before judging (office files are compressed, so the first
  pass cannot see into them). A hit in either pass stops the batch: nothing
  more from it is extracted or judged, and Erik is told. What the scan cannot
  see, and why nothing raw is published, is under
  [What is committed](#what-is-committed).

Records the harness keeps outside the sandbox can carry what the agent put in
them, so each is counted, scanned or not kept:

| Record | Handling |
|---|---|
| Resolver | Counters and one canary flag. No name is written, not even to its own stderr. |
| Gateway | Counters per run: requests per allowed path, refused requests, bytes, status codes. No body, header, query string or refused path is logged. |
| Firewall drop log | Not kept. A refused destination (an address and port carry bits) is counted only. |
| Container engine log | Not kept: the log driver is off for the run container. |
| Stream JSON with hook events, final message, `claude` stderr | Local, never committed; scanned in pass one. |
| Hook and `loadout mcp` output | Inside the stream or the run folder, so scanned with them. Nothing is written outside the sandbox. |
| Collected files | Local archive, scanned in both passes. |
| Committed results | Numbers and fixed values only (see What is committed). |

Numbers the agent influences (duration, turns, tokens, cost, test and row
counts, the dropped-file counts, the refused-request counts) are a thin
channel too, a few bits per run.
The control is the same: no real key in the sandbox, and revocation before
anything is committed.

## Arms

One run per task and arm. `$PROMPT` is `task.md` verbatim, read by the runner
from outside the run folder. All arms share this
argv, and the environment `ANTHROPIC_BASE_URL=<gateway>` and a placeholder
`ANTHROPIC_API_KEY` (see Credentials); only `small-loadout` adds to it:

```bash
claude -p "$PROMPT" --output-format stream-json --verbose --include-hook-events \
  --model "$MODEL" --no-session-persistence --setting-sources '' \
  --strict-mcp-config --mcp-config "$MCP" \
  --permission-mode acceptEdits --allowedTools Bash $EXTRA_TOOLS \
  --disallowedTools WebFetch WebSearch
```

| Arm | `$MODEL` | `$MCP` | Additions |
|---|---|---|---|
| `small-bare` | `claude-haiku-5-5` | `{"mcpServers":{}}` | none |
| `small-loadout` | `claude-haiku-5-5` | `{"mcpServers":{"loadout":{"command":"loadout","args":["mcp"],"env":{"LOADOUT_HOME":"<home>"}}}}` | `--plugin-dir <plugin copy>`; `$EXTRA_TOOLS` = `mcp__loadout__find_skills mcp__loadout__load_skill`; `LOADOUT_HOME=<home>` in the environment, a loadout home with the full library, whose `config.json` points `jev.baseUrl` at the gateway and `jev.apiKeyFile` at a placeholder (see Credentials) |
| `large-bare` | `claude-sonnet-5-5` | `{"mcpServers":{}}` | none |

- `plugins/loadout` is hook-only. The hook tells the agent to call
  `load_skill` or read a skill's SKILL.md, so the loadout arm also gets
  `loadout mcp` with its two read-only tools pre-approved, as the launchers
  do.
- **Caps.** 15 minutes wall clock per run. On a timeout the folder as it
  stands is judged and the run is flagged `capped`. The capped rate per arm is
  reported. In the pilot, loadout runs hit the 6-minute cap 4 times and bare
  runs twice, and two of loadout's three losses were capped runs.
- **Collected per run, kept local:** the full stream (init event, hook events,
  tool results, result event with `total_cost_usd`, tokens, turns and
  duration), the `claude` stderr, the final message, every file added or
  changed relative to the inputs, and for `small-loadout` the hook's selection
  and Jev cost. They go into a folder outside the checkout that is never pushed
  or shared.
- **Order and concurrency.** Arms run in separate batches, resumable per
  task, one run at a time. The wall-clock estimate below assumes that; parallel
  runs would also change how often the cap and rate limits hit.
- **Failed runs.** A run that dies for a reason outside the agent (API error,
  rate limit, container fault) is rerun once from a clean folder, and the
  count is reported per arm. If the rerun fails too, the run is reported as
  missing and not tried again. A run is never rerun because of how its output
  looks. The expected spend below includes these reruns.

## What is committed

Raw agent output is not committed: not the final message, the files, the
stream, the extracted text, the judge inputs or the judge's sentences. The repo
is public, and an output can hold a credential in a form no scan catches
(base64, split across files, compressed), or third-party skill text nobody has
read. Scanning cannot make publishing safe, and the gateway is a design that
has not been run yet. Withholding the text can. This departs from AGENTS.md's
"commit raw results", so it is listed under Open for Erik.

Committed under `bench/results/<timestamp>-c2/`, as numbers and fixed values the
harness computes or reads from named fields, never agent text:
- per run: arm, task, `capped`, number of reruns, `total_cost_usd`, tokens,
  turns, duration, the model named in the init event, its tool list, whether
  the hook exited 0 and added `<skill_relevance>`, the Jev cost, the gateway
  and resolver counters, and the names of selected skills when each is a name
  in the library;
- every check result, with the counts the check reads (tests run, rows,
  slides) and the number of files each check dropped from its copy;
- the sandbox self-check, the credential probe, and the hashes of the treatment
  (see Smoke run first);
- per judge call, only the verdict (`A`, `B`, `tie`) or the guess (`A`, `B`,
  `unsure`), the redaction counts per arm and the extracted size in bytes;
- the commitment below.

Kept local with the raw outputs: all text above and the judge's one-sentence
reasons, which quote the outputs.

**The commitment is one value.** When judging is done, the runner freezes
everything kept local (archives, streams, extracted text, judge inputs and
answers) into one archive, then generates a random 256-bit key, keeps it
local, and commits one HMAC-SHA-256 of the archive under it. A list of per-file
hashes is not committed: an agent that can read a secret can grind a nonce into
each file until a hash byte matches a secret byte, and the ordered list then
publishes the secret. One fixed-size value under a key made after the archive
was frozen carries nothing the agent chose, and without the key it says
nothing about the archive.

What others can recompute from the committed folder: win, tie and split counts,
the Wilson intervals, the guess accuracy, check pass rates, and the cost, turn,
duration and capped figures. What they cannot: the verdicts and the check
results themselves, which need the raw outputs and the judge. The HMAC ties the
results to one archive. To verify it, Erik gives a reviewer the whole archive
and the key; a part of the archive cannot be checked alone. Publishing any raw
output is a separate decision for Erik (AGENTS.md rule 4), taken after he has
read it. He reviews the folder before anything is pushed.

## Smoke run first

One run per arm on [smoke/](smoke/), a fixture outside all 18 task areas that is
not in `index.json` or `KEY.md` and is never scored or judged. Its outputs are
not in the results. The harness (see Frozen before the first run) is committed
before it runs.

**The treatment is frozen first.** Before the smoke run, the results record the
SHA-256 of the packed `loadout` tarball, of the plugin copy (a tar of its
files in sorted order), of the library snapshot in the loadout home and of that
home's `config.json`. The full run must show the same four hashes. A treatment
that does not run (the hook exits non-zero, tools are missing) stops the plan
for Erik to decide, and a changed treatment is a new registration with new
hashes.

It passes when:
- the sandbox self-check and the credential probe (see Isolation and
  Credentials) have run and their output is recorded;
- the init events list the same tools in all arms, apart from the plugin
  hook and the two loadout tools in `small-loadout`;
- the init event shows the model asked for;
- the hook event exits 0 and adds `<skill_relevance>` context;
- the extraction script runs on each smoke output folder.

Recorded, not a gate: whether the `small-loadout` run opened a skill
(`load_skill` or a read of a SKILL.md). A miss is reported and the treatment is
not changed to fix it.

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
    standard-library module (`sys.stdlib_module_names`). A local `unittest.py`
    that printed "Ran 4 tests / OK" passed `ctl-merge-conflict`, and a local
    `json/` folder shadows `json` the same way;
  - compiled code: `*.pyc`, `*.pyo`, `*.so`, `*.pyd`, `*.node` (Python imports a
    `.pyc` with no source beside it);
  - the agent's `package.json`: its `type` and `imports` change how Node loads
    modules. The fixture's is used, or `{}` where the task has none.
- **Closed by construction.** The checks never call `npm` or `pytest`, so
  `.npmrc` (`node-options`), `scripts` and `pytest.ini` are never read.
  `sitecustomize.py`, `usercustomize.py`, `*.pth`, `conftest.py` and
  `pyproject.toml` in the folder change nothing for `python3` there (tried).
  `NODE_OPTIONS` and `PYTHON*` come only from the environment, which the
  harness sets (`env -i`, a fixed `PATH`). A bare builtin name in Node
  resolves to the builtin before any file, and `node_modules` is left out, so
  a local `assert.mjs` is never loaded. Checks that only read files run as
  `python3 -I` from a script outside the folder, so nothing in it is imported.
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
- Not closed: the code under test still shares a process with its tests, so a
  change outside the frozen set (a patch to another module the test uses) is
  not caught. A check shows what the agent's code prints, not that it is
  honest. The judge reads the files, and a faked pass found there is reported.
- The script has tests on made-up outputs, before the smoke run, and each
  vacuous case (missing, empty, no tests, edited test, local `unittest.py`,
  stubbed `assert.equal`, replaced `assertEqual`) must fail them.

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
  tasks and runs every arm. Agent outputs can carry skill text, which is
  third-party input, and E12 says Codex cannot judge until it can run with no
  tool that reads files, runs commands or reaches the network. The files
  backend is no substitute here.
- **Framing.** Outputs reach the judge escaped with `escapeSkillTags`, framed
  as third-party content, not instructions, with provenance `unverified`.
- **Blind.** Per task, three pairs: `small-loadout` vs `small-bare`,
  `small-loadout` vs `large-bare`, `small-bare` vs `large-bare`. Each pair is
  judged twice with the order swapped. The judge sees `task.md`, the extracted
  input files, that task's `KEY.md` entry, and two outputs labelled A and B:
  the final message and the files. Never transcripts, tool calls, skill names,
  cost, model or timing.
- **Binary outputs** (docx, xlsx, pptx, pdf) are turned into text by one
  script for all arms: paragraphs and tables, sheets with formulas and their
  cached values, slides with notes. Formatting that text cannot show is not
  judged. Text files are shown as they are, within a fixed size budget.
- **Verdict call.** Which output better does what the request asks, counting
  correctness against the key first, then completeness, then clarity. Answer
  `A`, `B` or `tie`, with one sentence. The prompt says nothing about guidance,
  skills or arms.
- **Guess call, separate.** After every verdict call has finished, each
  verdict call gets a second call with the same `task.md` and the same two
  outputs in the same order, without the key, asking only which output had
  extra guidance: `A`, `B` or `unsure`. It is a separate call because the
  question would otherwise sit in the verdict prompt, where it can steer the
  judge toward style differences, and a field emitted after the verdict is
  still answered with the question in view.
- **Verdict per pair and task**, as in the pilot ([outcome.ts](../../outcome.ts),
  RESULTS): a side wins only if it is preferred in both orders. Two ties are a
  tie. Anything else is a split: opposite preferences (position bias), or a
  preference in one order and a tie in the other. A split is never a win for
  either side. Ties and splits are reported separately, and splits are broken
  down into opposite preferences and preference-plus-tie.
- **Sequential.** The 216 judge calls (108 verdict, then 108 guess) run one at a
  time (concurrency 1), not through the two-way pool `outcome.ts` uses for its
  judge, so a judge's cached prompt stays warm. Calls are grouped by task, with
  the fixed part of the prompt (instructions, `task.md`, inputs, the key
  entry) first.

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
   caveat. For `small-bare` vs `large-bare`, neither output had guidance, so
   every non-`unsure` guess is a false alarm; that rate is the baseline.
4. Not removed: a style a skill imposes (section order, checklists). A user
   would see it too, so it counts as part of the result, but it can reach the
   judge. This is a stated limit.

## Analysis

- **Primary set: the 14 non-control tasks.** The 4 controls are reported
  separately, with which skills the hook loaded on each.
- **Primary comparisons, fixed before any run:** `small-loadout` vs
  `small-bare` (does loadout help the small tier) and `small-loadout` vs
  `large-bare` (does it close the gap). The third pair is context.
- **Win rate:** wins / (wins + losses), with a 95% Wilson interval. Ties and
  splits are left out of the rate but always shown next to it, so a reader can
  see how many tasks it rests on. With 14 decided tasks the interval clears
  50% only from 11 wins (79%); with fewer decided tasks the bar is higher (7 of
  8, 9 of 10, 10 of 12). Anything smaller is "not shown".
- **Cost per task:** mean and median `total_cost_usd` per arm (list price from
  the result event), plus Jev cost for `small-loadout`. Also cost per
  task won, capped rate, median turns and median duration. The Codex CLI
  reports no cost (`costLabel` in `bench/lib.ts`), so the judge's cost is not
  reported.
- **Per task:** a table of verdicts, so a reader sees which tasks drive any
  difference.
- Negative and null results go into `bench/RESULTS.md` with the numbers.

## Frozen before the first run

The commit that merges this protocol fixes the tasks, `KEY.md`, the checks,
the redaction rules, the primary comparisons and the analysis. The runner, the
gateway, the resolver, the sandbox self-check, the credential probe, the
extraction script, the check script with its tests and both judge prompts do not
exist yet; they are committed before the smoke run and change only as set out
under Smoke run first. The treatment is fixed before the smoke run. After the first
full run starts, none of these changes. A change forced by a fault in the
harness goes into RESULTS as a deviation, with the reason and the runs it
touched. No tuning follows from these results on these tasks.

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

Haiku 5.5's prices rise 5x for prompts over 100k tokens; the assumed context
stays below that.

| Item | Count | Estimate |
|---|---:|---|
| `large-bare` runs | 18 | $6-27 |
| `small-bare` and `small-loadout` runs | 36 | $0.60-2.70 (Haiku 4.5: $6-27) |
| Jev routing for `small-loadout` ($0.0012 per decision, [C1](../../RESULTS.md#c1-2026-10-08-new-held-out-requests)), hook only | 18 | about $0.02; `find_skills` calls add more, not measured |
| Smoke run, one run per arm | 3 | $0.36-1.65 (Haiku 4.5: $0.65-3.00) |
| Codex judging (3 pairs x 2 orders x 18 tasks, then the same number of guess calls), sequential | 216 | plan quota, cost not reported |

Prices are Anthropic's list prices as of 2026-10-06, not figures from RESULTS.
Expected Claude cost at list price, with no reruns: about $7-31 with Haiku 5.5,
$12-57 with Haiku 4.5. It is cash: the runs use an API key behind the gateway
(see Credentials).

**High estimate, with the reruns.** If all 54 runs fail outside the agent and are
rerun once, there are 108 attempts, and each is charged at its high figure: 36
`large-bare` attempts $54.00, 72 small attempts $5.40 (Haiku 4.5: $54.00), Jev
about $0.04, the smoke run $1.65 (Haiku 4.5: $3.00). That is about $61 with
Haiku 5.5 and $111 with Haiku 4.5. Wall clock at most 108 x 15 minutes (27 h)
plus the smoke run. Neither is expected, and neither is a bound: the runner
stops at the totals Erik approves. It starts no attempt once the finished
runs' `total_cost_usd` plus the Jev cost reach the approved cost, or the
elapsed time reaches the approved hours, and it reports what it left unrun. An
attempt in progress can overshoot by its own cost; the cap on each key
(Credentials) is the approved total for its batch, so nothing overshoots
further. The smoke run replaces these assumptions with measured figures before
the full run is approved.

## Open for Erik

- Which Haiku: the B1 and hook-probe runs used the `haiku` alias, and RESULTS
  does not record which model it resolved to.
- Sonnet 5.5 or Opus as the large tier. The `invoke.ts` agent runs used
  Sonnet 5.5; B1 and the hook probe ran on Haiku, and the judges on Opus.
- The sandbox: container or VM (a throwaway user is ruled out above), and the
  engine, the egress mechanism, the resolver and the gateway that enforce the
  rules under Isolation and Credentials.
- Raw outputs stay local and unpublished (see What is committed), which departs
  from AGENTS.md's "commit raw results". Confirm, or say which outputs you will
  read and publish after the run.
- The gateway and AGENTS.md rule 1. Confirm that a harness gateway, which adds
  a credential header inside the benchmark's own sandbox, is not "proxying an
  agent's API traffic" in the rule's sense (see Credentials). If you read it as
  covering the gateway, the fallback is the real keys inside the sandbox, with
  per-batch keys and caps: skill text could then send them, or call the allowed
  APIs under an attacker's key, and the results would say so.
- The credentials. The Anthropic credential is an API key with a spend cap
  (cash). A subscription token is not assumed to work behind the gateway and
  is untested. The Jev key is dedicated to the `small-loadout`
  batch. Routing with the lexical router needs no Jev key but measures a
  different product, so it cannot be the primary comparison.
- A Codex-family replication (gpt-5.6-luna against gpt-6.1-sol), which would
  need a Claude judge for the Codex outputs. Not in this protocol.
