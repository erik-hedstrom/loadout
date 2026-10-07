# Handoff to Claude Code / Erik

- `src/docs.ts`: `DocsStore.create(root: string): Promise<DocsStore>` resolves
  the configured directory. `search(query: string, limit = 10): Promise<SearchHit[]>`
  walks and reads files on each call. `getPage(path: string): Promise<Page>`
  validates relative paths, rejects symlinks, checks canonical containment and
  opened inode identity, and reads from the checked file handle. `titleOf`
  parses YAML front matter, then finds Markdown headings outside fenced code.
- `src/server.ts`: `main(): Promise<void>` parses `--docs-root` / `DOCS_ROOT`,
  registers the two read-only tools with Zod schemas, and connects stdio.
  Tool errors become `isError` text results; startup errors use stderr/status 1.
- `tests/docs.test.mjs`: real temporary filesystem fixtures with cleanup.
  `tests/server.test.mjs`: actual official SDK client integration; needs Node
  child spawning. `tests/smoke.py`: optional Python launcher for this restricted
  runner, using actual JSON-RPC over the Node server's stdin/stdout.
- `sample-docs/`: two sample pages. README includes startup, exact configs,
  search semantics, limitations, and reproducible verification commands.
- Dependencies are pinned and `package-lock.json` is present. Install here used
  `npm install --offline --cache /tmp/docs-mcp-npm --ignore-scripts --no-audit --no-fund`
  because network access is blocked. Normal installs use `npm ci`.
- There is no valid Git repository: `.git` is an empty read-only placeholder.
  No branch/commit was created and nothing was merged. Before integration,
  create a `build/<session>` branch in the destination repo and use the required
  Codex coauthor trailer when committing.
- Claude's executable could not even run `claude --help` in this sandbox:
  `WSL ... UtilBindVsockAnyPort ... socket failed`. Claude's required other-model
  review remains outstanding. Desktop/Windows bridge was not exercised here.
- Verification: `DOCS_TEST_NO_SPAWN=1 npm test` built successfully; five pass,
  three explicitly skipped. `python3 tests/smoke.py` passed both config modes,
  search, exact retrieval, errors, and startup failures. Plain `npm test`
  initially failed the three spawn tests due the sandbox restriction, not a
  docs-store failure. Run the unskipped suite on the target developer machine.
- Independent Codex review found one title-parsing bug (`# C#` became `C`).
  Fixed the ATX heading parser to require whitespace before closing hashes;
  a regression test reproduced the failure before the fix and now passes.
  No other findings were reported. This review does not replace Claude's
  required other-model review.
