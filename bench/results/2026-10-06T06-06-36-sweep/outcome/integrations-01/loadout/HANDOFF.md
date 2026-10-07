# Handoff

All deliverables live in this folder. No usable Git repository was supplied:
`.git` is an empty read-only mount. No branch, commit, merge or external client
configuration was created. Erik still gates integration. A fresh Codex reviewer
reviewed the source and tests, and its two findings were fixed; Claude Code's
independent review remains for Erik's normal two-model gate.

Entry points:

- `src/index.ts`: `main(): Promise<void>` parses `--docs-root` / `DOCS_ROOT`,
  validates configuration, and connects the stdio transport. Startup errors go
  only to stderr. No startup status messages contaminate the protocol stream.
- `src/server.ts`: `createServer(docs: Docs): McpServer` registers exactly
  `search_docs` and `get_page`, strict Zod schemas, structured output schemas,
  read-only annotations and tool-error handling.
- `src/docs.ts`: `Docs.open(root: string): Promise<Docs>`,
  `search(query: string, limit?: number): Promise<SearchHit[]>`,
  `getPage(path: string): Promise<Page>`. `Page` has `path`, `title`, `content`;
  `SearchHit` has `path`, `title`, `snippet`, `score`.
- `tests/docs.test.mjs`: real temporary filesystem fixtures for ranking,
  title selection, live edits, removals, errors and traversal/symlink exclusions.
- `tests/mcp.test.mjs`: SDK client/server handshake and calls via linked
  in-memory transports, including output validation and errors.
- `tests/stdio.test.mjs`: SDK subprocess tests for CLI/env client configuration
  and startup behavior. An explicit probe skips only when Node spawn is blocked
  with EPERM; other environments run these tests normally.
- `scripts/check-stdio.sh`: real stdio JSON-RPC test using shell redirection,
  also checks CLI precedence and stderr startup errors.
- `scripts/check-special-files.sh`: Linux FIFO regression with a five-second
  timeout; retrieves a `.md` pipe and expects immediate regular-file rejection.
- `client-config.json` and `client-config-windows-wsl.json`: exact registration
  JSON for this temporary folder. Update paths before moving the project.

Gotchas: `.md` is case-sensitive; no `.mdx`. Search uses literal substring AND
semantics. YAML front-matter title wins over headings. Invalid YAML surfaces as
an error. Every search reads all visible pages; there is no persistent index.
Symlinks are excluded even when they point inside the root. Root symlinks are
canonicalized once. No defense against hostile concurrent directory replacement
is promised; deploy with a trusted local filesystem. Full pages are returned
without truncation, so client transport limits still apply.

Review fixes: long queries now use `max(100, 20 * distinctTermCount + 1)` as
title weight, preventing body frequency from outranking a title match. Final
`lstat` rejects nonregular files before `open`, with `O_NONBLOCK` and `O_NOFOLLOW`
where supported to avoid FIFO blocking and final-component symlink races.

Verified here with Node 24.15.0 and npm 12.0.2:

- Offline cached dependency installation: succeeded, 98 packages installed.
- `npm test`: build succeeded; 7 tests passed, 0 failed, 3 explicitly skipped
  because Node child processes return EPERM in the sandbox.
- `bash scripts/check-stdio.sh`: passed real protocol search/retrieval, errors,
  tool discovery, startup configuration and CLI precedence.
- `bash scripts/check-special-files.sh`: passed immediate named-pipe rejection.

Windows/WSL launch, live Claude Desktop registration and MCP Inspector were not
run in this Linux sandbox. Registry network access failed; dependencies came
from the provided cache. `npm ci` is the normal installation command elsewhere.
