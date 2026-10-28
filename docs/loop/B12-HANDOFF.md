# B12 listing remeasurement harness

Implementation starts at `eda54dd`. Paid measurement and results are pending.
Budget used by this implementation: $0; no Jev or model invocations.

## Design and implementation plan

Use a separate `bench/listing.ts`, importing B1's `claudeIsolation`,
`parseClaudeTurns`, `parseCodex` and `assertTemporary`. B1 retains its original
pack arms and output contract. Extending it would mix that historical study
with B12's size arms, explicit run gate and counts-only privacy contract.
B7 already provides `childEnv` and `claudeEnv`; reuse their allowlist and
subprocess credential scrubbing without duplicating environment policy.
No dependency or production behavior changes.

```mermaid
flowchart TD
  Library[Confined manifest reads] --> Corpus[Validate and escape listing fields]
  Corpus --> Prefixes[Hash order: 0 / 50 / 250 / all]
  Prefixes --> Temp[Temporary placeholder manifests]
  Temp --> Plan[Print exact argv and estimate]
  Plan --> Gate{Explicit --run?}
  Gate -->|no| End[Remove temporary files; no child process]
  Gate -->|yes| Version[Free version preflight]
  Version --> Calls[Two sequential fresh sessions per arm]
  Calls --> Rows[Counts and usage buckets only]
  Rows --> Invalid{Invalid or failed?}
  Invalid -->|yes| Stop[Record status and stop spending]
  Invalid -->|no| Next[Next call]
```

Implementation sequence: add adversarial writer, argv and parser tests;
observe the missing-module failure; implement the harness; add driver tests;
run typecheck, tests and free plans; scan the diff; commit locally.

A free PowerShell argv check showed that embedded JSON quotes are stripped
by its native argument passing. Command input therefore takes an executable
path and repeatable `--claude-arg`/`--codex-arg` prefix arguments, not JSON
text. The printed argv remains JSON for unambiguous review.

## Entry points and contracts

- `readListingLibrary(library)` reads only `skills/*/SKILL.md` with
  `readConfined`, rejects invalid/linked entries, normalizes names to the
  common host grammar, deduplicates, and sorts by SHA-256 of the name.
  Counts of rejected and normalized entries and a corpus hash are recorded.
- `writeProbeSkills(skills, destination)` accepts temporary destinations
  only. It writes escaped name/description scalars and a fixed third-party
  placeholder. No other frontmatter, body or supporting file survives.
- `buildListingPlan(corpus, root, options)` prepares exact literal argv.
  It requires at least 250 distinct valid manifests. Claude has four size
  arms and two default-tools arms; Codex has four size arms. Each has two
  fresh, sequential calls. The MCP arm uses the full sanitized library and
  a temporary `LOADOUT_HOME`, lexical search and no key.
- `parseListingUsage(host, stdout)` exposes numeric usage and counts only.
  Claude uses per-request assistant counters, not potentially cumulative
  result totals. Codex uses completed-turn totals. Tool use invalidates a
  measurement. Codex initial-list visibility and resolved model are unknown;
  the configured model and version preflight are recorded separately.
- `main(args)` defaults to plan mode. `--run` requires a new `--out`
  directory; failures produce a sanitized invalid row and stop subsequent
  paid calls. No transcripts, context, raw errors or ambient plugin names
  are persisted. Plans print argv (including the fixed probe prompt), not
  environment values. Temporary files are removed on exit.

## Platform and live-run limits

Run the Claude arm from native Windows Node with the native executable;
run Codex from WSL Node with a WSL library and command. Do not put a WSL
wrapper around a host while generating paths in Windows: a command prefix
does not translate cwd, plugin, loader or MCP paths. `--host` makes these
two independent runs. See [commands](../../bench/README.md#b12-native-listing-remeasurement).

Use a deliberately selected public library and a clean, already authenticated
benchmark `CODEX_HOME`. No credential is copied by this harness. The selected
home must have no `.env`, user skills, hooks or alternate provider setup.
The exec overrides skip user config/rules; they do not isolate every system
or managed configuration layer. Claude retains its logged-in ambient home
as B1 did; counts report ambient plugins but cannot establish identical plugin
contents. Hosts may write auth refreshes, caches and diagnostics under their
normal homes. The harness does not edit their configuration files.

Free help/version checks on 2026-10-28 found Claude Code 2.1.308 and Codex
0.163.0. Codex exec help advertises `--ignore-user-config`, `--ignore-rules`,
`--ephemeral`, `--json`, `--skip-git-repo-check`, `--config` and `--disable`.
Claude help advertises the plugin, tools, settings, MCP and persistence flags,
but not B1's `--restricted`; its acceptance and isolation effect remain
unverified by this committed harness until an authorized live run.
Neither host was invoked with a prompt during implementation.

The pilot's Codex `debug prompt-input` command failed, so this harness does
not use it or claim initial-list visibility. Claude init counts discovery;
it does not expose which descriptions reached the model. A plateau alone
does not prove a host budget caused it. The second call is a second fresh
session, not a guaranteed cache hit. Other arms can share cache prefixes.

## Review and remaining work

Cross-model review and the repository's merge reviews remain pending: the
$0 cap prohibits starting additional paid Claude/Codex runs. No public
action or merge is authorized. The coordinator should review the local
commit, authorize and run the printed measurements, commit raw aggregate
rows, then write the B12 results and revisit the README headline. Pilot
numbers are deliberately absent from committed results.
