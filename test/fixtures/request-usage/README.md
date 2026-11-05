# Legacy report pin

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
