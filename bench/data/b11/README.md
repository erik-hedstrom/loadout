# B11 fixtures

`tasks.jsonl` contains 72 deterministic tasks. Workspace and `node-test.tests`
paths are relative to the repository root; `files.path` is relative to the
task workspace. `files.all` and `files.none` contain literal substrings.

Run the fixture validation with:

```sh
npx vitest run test/b11-data.test.ts
```

The validation copies an untouched workspace to a temporary directory, runs
its check, overlays `solutions/<task-id>/`, and runs the same check again.
Node checks import `index.mjs` from the working directory. Their files remain
in `checks/`; they are not part of the workspace. Keep `solutions/`, `checks/`,
and `decoys/` outside any workspace exposed to a solving agent.

The plain tasks comprise eight bug fixes, eight additions, and eight refactors.
Refactor checks cover both preserved behavior and the structural change stated
in the prompt, so an untouched implementation fails even when its behavior is
already correct.

The six decoy fixtures are:

| Task | Competing skill |
|---|---|
| `b11-skill-firgrove-release` | `mistvale-release-ledger` |
| `b11-skill-cedar-postgres` | `larch-sqlite-migrations` |
| `b11-skill-harbor-incident` | `summit-incident-digests` |
| `b11-skill-alder-decision` | `birch-design-decisions` |
| `b11-skill-nightjar-runbook` | `osprey-recovery-runbooks` |
| `b11-skill-elm-support` | `willow-support-transfers` |

Each competing skill also has its own task. A decoy solution uses the competing
format with the target task's facts. Validation also appends each decoy to a
correct answer to exercise the forbidden-trace check independently of missing
required content.

MCP canaries cover all 20 B7 fixture servers. Each response supplies one fact;
the corresponding file check accepts it without depending on JSON indentation.
Connection ordinals in prompts refer to the unsuffixed server first, then `-2`
through `-5`. No model sessions or quality measurements are recorded here.
