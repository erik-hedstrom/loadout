# C2 protocol: does the small tier plus loadout match the large tier?

Backlog item C2. This PR holds the fixtures and this protocol. Nothing has been
run: the runner, the text extraction and the judge script are the local half.

## Provenance of the tasks

- Claude (a Claude Code worker session) wrote all 18 tasks, their inputs and
  `KEY.md` on 2026-10-12.
- It did not read the skill library (`bench/data/library*`, skill lists) or
  `requests*.jsonl` while writing. Tasks come from the kinds of work people
  hand a coding agent (documents, web, data, devops, code), not from skills.
- Inputs are hand-written or produced by [make_inputs.py](make_inputs.py)
  (seeded, byte-for-byte repeatable). Names, companies and numbers are invented.
- 4 tasks are controls (`ctl-*` in [index.json](index.json)): plain code or
  writing where no skill should help. A gain there points at the harness or
  the judge, not at a skill.
- Tuning: none. These tasks are not used to adjust the router. If a change
  follows from the results, re-test it on new tasks (AGENTS.md).

## Arms

All three run Claude Code headless (`claude -p --output-format json`), one run
per task and arm, in a fresh temp folder holding the task's input files (not
`task.md`, not `KEY.md`). The prompt is `task.md` verbatim, with no "make up
sample inputs" note: the inputs exist.

| Arm | Model | Setup |
|---|---|---|
| `small-bare` | Haiku | isolated config as in B1: `--setting-sources ''`, `--strict-mcp-config` with no servers, no plugins, no hooks |
| `small-loadout` | Haiku | the same, plus `--plugin-dir plugins/loadout` (hook and MCP) against the full library |
| `large-bare` | Sonnet 5.5 | as `small-bare` |

- **Caps.** 15 minutes wall clock per run. On a timeout the folder as it stands
  is judged and the run is flagged `capped`. The capped rate per arm is
  reported, since a skill that makes the agent slower looks worse for a reason
  that is not quality (the pilot lost 4 of 8 loadout runs that way).
- **Shell.** The pilot allowed no shell commands. Here several tasks need an
  interpreter (tests, python-docx, openpyxl, soffice). Open for Erik: run in a
  container or throwaway user with `--permission-mode acceptEdits` and an
  allowlist of interpreters. All arms get the same tools and the same machine.
- **Large tier.** Sonnet 5.5, as in every earlier Claude run in RESULTS. Opus
  is the alternative; it would raise the large arm's cost, and the comparison
  would then ask something different. Erik's call.
- **Collected per run:** the final message, every file added or changed
  relative to the inputs, the result event (`total_cost_usd`, tokens, turns,
  duration), and for `small-loadout` the hook's selection and Jev cost.
  Raw outputs go to `bench/results/<timestamp>-c2/`. Transcripts stay local.
- **Order.** Arms run in separate batches, resumable per task.

## Judging

- **Judge:** Codex (gpt-6.1-sol), `codex exec` read-only. Claude wrote the
  tasks and ran every arm, so the judge is not Claude (AGENTS.md). Where
  `--backend codex` cannot run tool-less (E12), use the files backend with a
  committed producer script, and say so in the results.
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
- **Verdict per pair and task.** A side wins if it is preferred in both orders,
  or preferred in one and tied in the other. Opposite preferences, or two
  ties, count as a tie. The number of opposite-preference tasks is reported as
  the judge's position bias.

## Template leakage

A skill's template or section scheme can show in the output and tell the judge
which arm it is reading. The pilot named this as a limit. Steps taken:
1. The judge never sees the process, only the final message and the files.
2. Before judging, strings that name the treatment are replaced with
   `[redacted]`: the names of the skills the hook selected in that run, the
   loadout context tags, and the words "skill" and "loadout".
3. The judge's guess of which output had extra guidance is recorded for every
   judgement. Its accuracy against the truth, with a Wilson interval, is
   reported next to the win rates. Near 50% means leakage is not detected;
   clearly above means the blindness failed and the win rates are read with
   that caveat.
4. Not removed: a style a skill imposes (section order, checklists) stays in
   the output. A user would see it too, so it counts as part of the result, but
   it can reach the judge. This is listed as a limit.

## Analysis

- **Win rate:** wins / (wins + losses) per comparison, ties excluded, with a
  95% Wilson interval. Wins, ties and losses are always shown, as are all-task
  and control-only/non-control results separately. n = 18 per comparison (14
  without controls), so only large differences can show; a comparison whose
  interval includes 50% is reported as "not shown".
- **Primary comparisons, fixed before any run:** `small-loadout` vs
  `small-bare` (does loadout help the small tier) and `small-loadout` vs
  `large-bare` (does it close the gap). The third pair is context.
- **Cost per task:** mean and median `total_cost_usd` per arm from the Claude
  CLI result events (a notional figure on a subscription), plus Jev cost for
  `small-loadout` from loadout's usage record. Also cost per task won, capped
  rate, median turns and median duration. The Codex CLI reports no cost
  (`costLabel` in `bench/lib.ts`), so the judge's cost is not reported.
- **Per task:** a table of verdicts, so a reader sees which tasks drive any
  difference, and the controls next to them.
- Negative and null results go into `bench/RESULTS.md` with the numbers.

## Expected spend (local run)

Estimates. RESULTS has no figure for a 15-minute agentic run: the nearest is a
2-turn Haiku run at $0.06 (hook plugin probe) and Jev at $0.0012 per routing
decision (C1).

| Item | Count | Estimate |
|---|---:|---|
| `small-bare` and `small-loadout` runs (Haiku) | 36 | $0.20-1.00 each: $7-36 |
| `large-bare` runs (Sonnet 5.5) | 18 | $0.60-3.00 each: $11-54 |
| Jev routing for `small-loadout` | 18 | about $0.02 |
| Smoke run of each arm on one task, before the full run | 3 | about $1 |
| Codex judging (3 pairs x 2 orders x 18 tasks) | 108 | plan quota, cost not reported |

Total notional Claude cost: about $20-90, central guess $45; it only becomes
cash if the runs go through an API key instead of the subscription. Wall clock:
at most 54 x 15 minutes (13.5 h), likely 5-8 hours in sequence. A second pass
for variance would double both. The smoke runs come first, so the estimate is
replaced by a measured figure before the full run is approved.

## Open for Erik

- Shell permissions and the large tier (above).
- A Codex-family replication (gpt-5.6-luna against gpt-6.1-sol), which would
  need a Claude judge for the Codex outputs. Not in this protocol.
