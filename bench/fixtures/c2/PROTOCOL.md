# C2 protocol: does the small tier plus loadout match the large tier?

Backlog item C2. The fixtures in this folder and this protocol were written
before any run. Not built yet (the local half): the runner, the sandbox
self-check, the credential probe, the text extraction, the check script and
the judge script.

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
  network. The runner copies the outputs out; nothing is mounted back.
- **Nothing from the host.** No bind mounts or host volumes (the run folder is
  a fresh volume), no container-runtime socket, no `--privileged`, no added
  capabilities, `no-new-privileges`, and a non-root user inside. No checkout,
  and none of `~/.claude`, `~/.codex`, `~/.loadout`, an SSH agent or a cloud
  credential. So the Docker tasks (`devops-*`) cannot run `docker`, and the
  judge reads the files instead.
- **Limits set from outside**, so the agent cannot lift them: CPU, memory,
  process count, disk for the run folder and the writable layer, and the
  15-minute wall clock.
- **Egress enforced outside the container** (a proxy or firewall on the
  network, not a setting inside it). Allowed: the Anthropic API and, for
  `small-loadout`, the Jev API. Denied: the host, other containers, private and
  link-local addresses (cloud metadata included). WebFetch and WebSearch are
  also disallowed, but that is a tool setting, not isolation.
- Each run starts in a fresh folder holding a copy of only that task's `inputs`
  from [index.json](index.json) (not `task.md`, not `KEY.md`).
- The plugin is a copy of `plugins/loadout` outside the checkout; `loadout`
  comes from a packed build (`npm pack`), not from the checkout.
- Nothing can be installed during a run, so the image comes with Node 22+,
  Python 3 with python-docx, openpyxl, python-pptx, pypdf, pdfplumber, pandas and
  matplotlib, and sqlite3. Versions go into the results.
- The check scripts and the text extraction run in the same sandbox, after
  `claude` has exited and the credentials are deleted from it, under the same
  limits. They execute or parse what the agent wrote (`node --test`, `npm test`,
  docx and pptx files), so they never run on Erik's machine.
- Runs and judging happen on a local machine where the CLIs are logged in, not
  in a cloud session.

The smoke run starts with a self-check from inside the sandbox, as the agent's
`Bash` would see it. It passes when none of these exist: a host path, a
runtime socket, a route to the host or to a metadata address, a host name
outside the allowlist that resolves and connects. The configured limits must
show. Its output goes into the results.

## Credentials

What loadout does today (`resolveApiKey` in `src/config.ts`): it reads the Jev
key from the environment variable named there, or else from the file that
`jev.apiKeyFile` in `$LOADOUT_HOME/config.json` names. The hook
(`loadout hook claude`) and `loadout mcp` are child processes of `claude`.
They run as the same user, in the same container, as the agent's `Bash`. So
whatever key those two processes can read, `Bash` can read: `env`, a key file,
`/proc/<pid>/environ`. loadout has no way to give them a key and withhold it
from the shell, and this protocol does not claim one. What it does:
- **Not in the environment.** The key sits in a file outside the run folder,
  mode 0400, named by `jev.apiKeyFile`; `LOADOUT_HOME` (not a secret) points at
  the home holding `config.json` and the library, in `claude`'s environment
  and in the loadout server's `env` in `$MCP`. `env` and `printenv` then show
  nothing. This closes the accidental path only. A skill's text that persuades
  the agent to `cat` the file still works.
- **Treated as disclosed.** The key can enter a tool result and so be sent to
  Anthropic before any scan sees it. It is dedicated to this run, never used
  elsewhere, and revoked right after the last run. The bare arms' environment
  has no Jev key and no loadout config at all.
- **Probed.** Before the smoke run a script, running as the agent's user, tests
  which of `env`, the key file and `/proc/*/environ` yield the key, and prints
  only yes or no for each. The answer goes into the results next to the
  win rates.
- **Scanned.** Before committing, every collected file and the stream are
  scanned for the key's value and for key-shaped strings (the patterns in
  `test/c2-fixtures.test.ts`). The runner never prints the key.
- **The Anthropic credential is in the same position.** `claude` needs one in
  the sandbox; `Bash` can read it. It is injected at start, never mounted from
  `~/.claude` on the host, and revoked after the run.
- Collected outputs leave out `node_modules`, `.venv` and `__pycache__`.

## Arms

One run per task and arm. `$PROMPT` is `task.md` verbatim, read by the runner
from outside the run folder. All arms share this
argv; only `small-loadout` adds to it:

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
| `small-loadout` | `claude-haiku-5-5` | `{"mcpServers":{"loadout":{"command":"loadout","args":["mcp"],"env":{"LOADOUT_HOME":"<home>"}}}}` | `--plugin-dir <plugin copy>`; `$EXTRA_TOOLS` = `mcp__loadout__find_skills mcp__loadout__load_skill`; `LOADOUT_HOME=<home>` in the environment, a loadout home with the full library; the Jev key as set out under Credentials |
| `large-bare` | `claude-sonnet-5-5` | `{"mcpServers":{}}` | none |

- Not B1's isolated configuration: that one adds `--restricted`,
  `--tools Skill` and `disableAllHooks`, which would remove the file tools
  and the hook.
- `plugins/loadout` is hook-only. The hook tells the agent to call
  `load_skill` or read a skill's SKILL.md, so the loadout arm also gets
  `loadout mcp` with its two read-only tools pre-approved, as the launchers
  do. RESULTS measured this pairing, search tool plus hook, at 6 of 10
  sessions opening a useful skill, on Sonnet 5.5 with 8 turns and no shell
  approved. That was a different model and tool set, so it does not predict
  this run.
- `Bash` without limits is acceptable only inside the sandbox above. All arms
  get the same tools and the same image.
- **Caps.** 15 minutes wall clock per run. On a timeout the folder as it
  stands is judged and the run is flagged `capped`. The capped rate per arm is
  reported. In the pilot, loadout runs hit the 6-minute cap 4 times and bare
  runs twice, and two of loadout's three losses were capped runs.
- **Collected per run:** the stream (init event, hook events, result event
  with `total_cost_usd`, tokens, turns and duration), the final message,
  every file added or changed relative to the inputs, and for
  `small-loadout` the hook's selection and Jev cost. The full stream, with
  tool results, stays local; the committed record is the init, hook and result
  events, the final message and the files.
- **Committed:** under `bench/results/<timestamp>-c2/`, so others can
  recompute: those records, the check results, the sandbox self-check, the
  credential probe, the judge inputs as the judge saw them (after
  redaction), every verdict in both orders with its guess, and the redaction
  counts. Erik reviews the folder before anything is pushed, since the repo is
  public.
- **Order and concurrency.** Arms run in separate batches, resumable per
  task, one run at a time. The 13.5 h bound below assumes that; parallel runs
  would also change how often the cap and rate limits hit.
- **Failed runs.** A run that dies for a reason outside the agent (API error,
  rate limit, container fault) is rerun once from a clean folder, and the
  count is reported per arm. A run is never rerun because of how its output
  looks.

**Smoke run first:** one task, each arm once. Its outputs are not judged and
are not in the results. It passes when:
- the sandbox self-check and the credential probe (see Isolation and
  Credentials) have run and their output is recorded;
- the init events list the same tools in all arms, apart from the plugin
  hook and the two loadout tools in `small-loadout`;
- the init event shows the model asked for;
- the hook event exits 0 and adds `<skill_relevance>` context;
- the loadout run opens a skill (`load_skill` or a read of a SKILL.md).

## Checks by script

A text judge cannot tell whether tests pass or a file opens. One script runs
in the sandbox after each run and records pass or fail per check:

| Task | Check |
|---|---|
| docx-lease-amendment, docx-minutes | the .docx opens with python-docx |
| xlsx-budget-cleanup | budget-clean.xlsx opens; sheets Clean and Summary; Summary holds formulas |
| pptx-board-deck | board.pptx opens; at most 5 slides; every slide has notes |
| pdf-invoice-extract | line-items.csv parses with 7 columns |
| data-orders-sqlite | orders.db opens with sqlite3 |
| web-signup-form | `node --test` exits 0 |
| web-landing-new | index.html loads nothing over http(s) |
| code-logsum-flags, ctl-interval-merge | `python3 -m unittest` exits 0 |
| ctl-merge-conflict | `python3 -m unittest` exits 0; no conflict markers; test file unchanged |
| ctl-ratelimiter-bug | `npm test` exits 0; test file unchanged |
| ctl-customer-reply | reply.txt exists and has under 150 words |

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
- **Question:** which output better does what the request asks, counting
  correctness against the key first, then completeness, then clarity. Answer
  `A`, `B` or `tie`, with one sentence, and which output the judge believes
  had extra guidance (`A`, `B` or `unsure`).
- **Verdict per pair and task**, as in the pilot ([outcome.ts](../../outcome.ts),
  RESULTS): a side wins only if it is preferred in both orders. Two ties are a
  tie. Anything else is a split: opposite preferences (position bias), or a
  preference in one order and a tie in the other. A split is never a win for
  either side. Ties and splits are reported separately, and splits are broken
  down into opposite preferences and preference-plus-tie.
- **Sequential.** The 108 judge calls run one at a time (concurrency 1), not
  through the two-way pool `outcome.ts` uses for its judge, so a judge's cached
  prompt stays warm. Calls are grouped by task, with the fixed part of the
  prompt (instructions, `task.md`, inputs, the key entry) first.

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
3. **Guess metric.** For pairs with `small-loadout`, a guess is correct when
   it names the `small-loadout` output. Accuracy is correct / (correct +
   wrong) with a Wilson interval; `unsure` is left out of the accuracy and its
   rate is reported. Near 50% means no leakage is detected; clearly above
   means blindness failed, and the win rates carry that caveat. For
   `small-bare` vs `large-bare`, neither output had guidance, so every
   non-`unsure` guess is a false alarm; that rate is the baseline.
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
- **Cost per task:** mean and median `total_cost_usd` per arm (a notional
  figure on a subscription), plus Jev cost for `small-loadout`. Also cost per
  task won, capped rate, median turns and median duration. The Codex CLI
  reports no cost (`costLabel` in `bench/lib.ts`), so the judge's cost is not
  reported.
- **Per task:** a table of verdicts, so a reader sees which tasks drive any
  difference.
- Negative and null results go into `bench/RESULTS.md` with the numbers.

## Frozen before the first run

The commit that merges this protocol fixes the tasks, `KEY.md`, the checks,
the redaction rules, the primary comparisons and the analysis. The judge prompt
and the extraction script do not exist yet; they are committed before the first
full run. After that, none of these changes. A change forced by a fault in the
harness goes into RESULTS as a deviation, with the reason and the runs it
touched. No tuning follows from these results on these tasks (all 18 are test
tasks).

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
| Smoke run, one run per arm | 3 | $0.35-1.65 (Haiku 4.5: $0.65-3.00) |
| Codex judging (3 pairs x 2 orders x 18 tasks), sequential | 108 | plan quota, cost not reported |

Prices are Anthropic's list prices as of 2026-10-06, not figures from RESULTS.
Total notional Claude cost: about $7-31 with Haiku 5.5, $12-57 with Haiku
4.5. It becomes cash if the sandbox's Anthropic credential is an API key
rather than a subscription token (see the open decisions). Wall clock: at most
54 x 15 minutes (13.5 h), plus the smoke run. The smoke run
replaces these assumptions with measured figures before the full run is
approved.

## Open for Erik

- Which Haiku: the B1 and hook-probe runs used the `haiku` alias, and RESULTS
  does not record which model it resolved to.
- Sonnet 5.5 or Opus as the large tier. The `invoke.ts` agent runs used
  Sonnet 5.5; B1 and the hook probe ran on Haiku, and the judges on Opus.
- The sandbox: container or VM (a throwaway user is ruled out above), and the
  engine and the egress mechanism that enforce the list under Isolation.
- The credentials, which loadout cannot hide from `Bash` in one sandbox (see
  Credentials):
  - **Jev key.** (a) Accept the exposure with a dedicated, revoked key, a
    spend cap if the provider offers one, and the probe's result published. (b) Or
    run the hook and `loadout mcp` as a second user through a wrapper, and let
    only that user read the key file; loadout does not ship this and the
    protocol does not test it beyond the probe. (c) Routing with the lexical
    router needs no key but measures a different product, so it cannot be the
    primary comparison. Recommended: (a).
  - **Anthropic credential.** A dedicated API key with a spend limit (cash,
    and the exposure ends with revocation) or a long-lived subscription token
    tied to Erik's account (no cash, but a disclosed token is worth more).
    Recommended: the API key.
- A Codex-family replication (gpt-5.6-luna against gpt-6.1-sol), which would
  need a Claude judge for the Codex outputs. Not in this protocol.
