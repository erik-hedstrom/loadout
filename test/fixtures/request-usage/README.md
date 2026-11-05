# Host usage captures

F2 adds **synthetic**, source-shaped `codex-rollout-0.163.0.jsonl` and
`codex-app-server-0.163.0.jsonl`; these are not live captures. Their contracts
are pinned to openai/codex `rust-v0.163.0`, `protocol/src/protocol.rs`
(`TokenUsageInfo`) and `app-server-protocol/src/protocol/v2/thread.rs`
(`ThreadTokenUsageUpdatedNotification`). The rollout fixture repeats an
event, includes an info-null update, omits one write counter and includes
irrelevant private-looking fields to check projection. No Codex home is
read by either parser. Live validation and source approval remain pending.

`legacy-report-hashes.json` records its `reporterCommit`: main's `ecb8fe3`
reporter, including its existing `hookTrustNotices` provenance lines. It hashes
reports regenerated from the committed C14 rerun rows/verdicts and from those
same rows projected to legacy native/loadout shapes. This tests formatting
compatibility without reading or changing the active C15 study.
To regenerate, materialize `git show <reporterCommit>:bench/ab-report.ts` as a
temporary sibling module, import its `report()`, and SHA-256 the unmodified
UTF-8 outputs for both inputs (native projection: bare becomes native,
`librarySize: 250`, empty verdicts). No line-ending/path normalization or
runtime-dependent re-pinning is involved. The earlier #77 baseline omitted
main's two notice lines and failed on GitHub's merged PR tree; the same
committed inputs now reproduce main's baseline on Windows and Linux.

Recorded 2026-10-22 in WSL, one minimal no-tool prompt per host. These are
trimmed real streams, not generated counters. Prompt: `Reply with exactly OK.
Do not use tools.` No loadout plugin or hook was active.

- Codex CLI 0.163.0, `gpt-5.6-luna`: `exec --json --ignore-user-config
  --ignore-rules --ephemeral --skip-git-repo-check -s read-only`, with hooks,
  apps, plugins, skill MCP installation and command tools disabled. Only
  `turn.completed` carries usage. Its `usage` has `input_tokens`,
  `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens` and
  `reasoning_output_tokens`. No per-model-request counters were emitted in
  `exec --json`; only turn totals are retained.
- Claude Code 2.1.306, `haiku`: `-p --output-format stream-json --verbose`,
  with tools, setting sources and slash commands disabled, strict MCP config
  and no session persistence. Init reported no tools, MCP servers or skills;
  only built-in host plugins remained. `assistant.message.usage` reports
  input/cache counters but output was partial (1 token). The final
  `result.usage` totals report 4 output tokens. The bundle's usage schema
  describes `iterations` as sampling iterations inside a request; its session
  accumulator replaces that field with the latest request's iterations while
  summing the other counters. It can also emit null or empty iterations.
  These are not per-request session counters and are ignored. Judge calls
  use `--output-format json`, retaining only totals from the single result.

Scrubbing retained only usage-bearing events and numeric usage fields,
iteration type, result status, turn count and cost. Assistant message IDs,
all session/account identifiers, timestamps, paths, text, init inventories,
rate-limit events and unrelated usage metadata were removed. Token counters
were not changed. The assistant event remains to catch accidental use of
partial counters. Tests use synthetic iteration variants only to verify
that they cannot be misinterpreted as session request counters.

Normalized input includes cache creation and cache reads for Claude; Codex
already includes cached tokens in input. Totals come from the host and are
stored directly as `usage: { inputTokens, cachedInputTokens, outputTokens }`.
Missing usage is null, never zero;
malformed events or counters produce a contents-free `usageError`. Valid
paid answers and deliverables survive usage parsing failures. Host stdout
is not persisted; it can contain private command output and messages.

Cost: $0 Jev; two tiny subscription runs. Claude reported $0.0001258;
Codex reported 10,135 input tokens (7,936 cached), 5 output tokens and no
dollar cost. These captures do not establish usage visibility for other CLI
versions or for multi-request Codex turns.

Per-request Codex capture remains a follow-up: the outcome runner inherits
`CODEX_HOME` rather than creating a benchmark-owned home, so it does not read
rollouts there. App-server token updates or rollout `token_count` events from
a benchmark-owned home need a separate choice and implementation.
