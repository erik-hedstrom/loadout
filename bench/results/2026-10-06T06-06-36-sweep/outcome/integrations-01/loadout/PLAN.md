# Internal docs MCP server

The requested tools and local stdio transport define the interface. Assume a small,
trusted local Markdown corpus, UTF-8, and Node 22+. Re-scan on each search instead
of maintaining a watcher or stale index. Read pages on demand. CLI configuration
takes precedence over the environment; no implicit docs root.

```mermaid
flowchart LR
  Client[MCP client] -->|stdio| Tools[search_docs / get_page]
  Tools --> Docs[Document service]
  Docs --> Guard[Validate relative path and reject symlinks]
  Guard --> Files[Markdown files inside configured root]
```

- [x] Document service: tests for ranking, YAML and heading titles, snippets,
  additions/edits/deletions, ignored folders, missing files, traversal and symlinks.
  Implement `Docs.open(root)`, `search(query, limit?)`, and `getPage(path)` in
  `src/docs.ts`. Search requires every whitespace-separated literal term,
  case-insensitively; title matches rank above body frequency; ties use page path.
- [x] MCP adapter and executable: register precisely the two requested tools with
  strict schemas, structured output and clear tool errors. Test through the SDK
  client spawning the built executable over stdio, including CLI/env startup.
- [x] Deliver README, exact local client JSON, realistic sample docs and handoff
  notes. Build and run the complete suite before reporting completion.

Filesystem boundary: reject absolute paths, dot segments, hidden components,
node_modules, non-Markdown paths, and symlink components. Canonicalize the root.
Local concurrent hostile filesystem mutation is outside the deployment model.
Ordinary disappearing files during a scan are skipped; other I/O errors surface.

This workspace has a read-only empty `.git` directory, so branch creation,
commits and a branch diff review are unavailable. Leave reviewable files and
handoff notes here. User authorization covers implementation without repeated
design approval. Execute inline.

Review findings resolved: final regular-file metadata is checked before opening
to avoid FIFO hangs; nonblocking open protects that race as well. Title weight
is query-dependent so one title match always outweighs all capped body matches.
Both regressions were observed failing before their fixes.
