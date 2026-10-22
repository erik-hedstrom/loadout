# Host usage captures

Recorded 2026-10-22 in WSL, one minimal no-tool prompt per host. These are
trimmed real streams, not generated counters. Prompt: `Reply with exactly OK.
Do not use tools.` No loadout plugin or hook was active.

- Codex CLI 0.163.0, `gpt-5.6-luna`: `exec --json --ignore-user-config
  --ignore-rules --ephemeral --skip-git-repo-check -s read-only`, with hooks,
  apps, plugins, skill MCP installation and command tools disabled. Only
  `turn.completed` carries usage. Its `usage` has `input_tokens`,
  `cached_input_tokens`, `cache_write_input_tokens`, `output_tokens` and
  `reasoning_output_tokens`. No per-model-request counters were emitted;
  turn totals are retained, and request usage is null.
- Claude Code 2.1.306, `haiku`: `-p --output-format stream-json --verbose`,
  with tools, setting sources and slash commands disabled, strict MCP config
  and no session persistence. Init reported no tools, MCP servers or skills;
  only built-in host plugins remained. `assistant.message.usage` reports
  input/cache counters but output was partial (1 token). The final
  `result.usage` and its `iterations[]` report 4 output tokens. Request rows
  therefore use `result.usage.iterations[]`, including `input_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`
  and `type: "message"`. Missing iterations mean unavailable request usage.

Scrubbing retained only usage-bearing events and numeric usage fields,
iteration type, result status, turn count and cost. Assistant message IDs,
all session/account identifiers, timestamps, paths, text, init inventories,
rate-limit events and unrelated usage metadata were removed. Token counters
were not changed. The assistant event remains to catch accidental use of
partial counters. The synthetic multi-request test is separate from these
captures.

Normalized input includes cache creation and cache reads for Claude; Codex
already includes cached tokens in input. Totals come from the host and are
not reconstructed from request rows. Missing usage is null, never zero;
malformed events or counters fail with diagnostics that omit event contents.

Cost: $0 Jev; two tiny subscription runs. Claude reported $0.0001258;
Codex reported 10,135 input tokens (7,936 cached), 5 output tokens and no
dollar cost. These captures do not establish usage visibility for other CLI
versions or for multi-request Codex turns.
