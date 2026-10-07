# Internal Markdown docs MCP server

A local, read-only TypeScript MCP server exposing `search_docs` and `get_page`
over stdio using the [official MCP SDK](https://ts.sdk.modelcontextprotocol.io/server).
No API keys, database, embeddings, network service, or paid services are needed.

## Install and run

Requires Node.js 22.8 or newer and npm. Run in this folder:

```bash
npm ci
npm run build
node dist/server.js --docs-root /tmp/loadout-outcome-work-FcCzw1/sample-docs
```

The process waits for MCP messages on stdin; a quiet terminal is expected.
The MCP client normally starts and stops it. Stdout is reserved for protocol
messages; startup failures go to stderr and exit with status 1.

Alternatively configure the root through the environment:

```bash
DOCS_ROOT=/absolute/path/to/internal-docs npm start
```

`--docs-root` overrides `DOCS_ROOT`. One is required. Relative roots resolve
against the process working directory; use absolute paths in client config.
The directory must exist, but may be empty. Rebuild after changing TypeScript.

## Register in an MCP client

For Claude Desktop, open **Settings → Developer → Edit Config**, and merge this
entry into `mcpServers` in the file the app opens. Preserve any existing server
entries, save, and restart the app. This follows the
[official client setup guide](https://github.com/modelcontextprotocol/docs/blob/main/quickstart/user.mdx).
Use the app's configuration editor on Windows to locate its active config.

For a client running in the same Linux environment, this is the exact JSON for
the sample docs in this folder (also saved as `client-config.json`):

```json
{
  "mcpServers": {
    "internal-docs": {
      "command": "/usr/bin/node",
      "args": ["/tmp/loadout-outcome-work-FcCzw1/dist/server.js"],
      "env": {
        "DOCS_ROOT": "/tmp/loadout-outcome-work-FcCzw1/sample-docs"
      }
    }
  }
}
```

For Windows Claude Desktop launching this project inside Ubuntu WSL, use
`client-config.wsl.json`:

```json
{
  "mcpServers": {
    "internal-docs": {
      "command": "wsl.exe",
      "args": [
        "--distribution", "Ubuntu",
        "--exec", "/usr/bin/node",
        "/tmp/loadout-outcome-work-FcCzw1/dist/server.js",
        "--docs-root", "/tmp/loadout-outcome-work-FcCzw1/sample-docs"
      ]
    }
  }
}
```

Adjust the distro name if yours differs. The WSL config uses a CLI argument so
the docs root does not depend on Windows environment propagation. The Desktop
app and WSL bridge could not be tested in this sandbox. Move this project from
`/tmp` to a persistent project folder for ongoing use, and update both absolute
paths in your config. Point the docs root at your real corpus when ready.

## Tools and search behavior

| Tool | Arguments | Result (JSON in a text content block) |
| --- | --- | --- |
| `search_docs` | `query: string`, `limit?: integer` | Array of `{path, title, snippet, score}` |
| `get_page` | `path: string` | `{path, title, content}` with full original Markdown |

Example calls:

```json
{"name":"search_docs","arguments":{"query":"deployment","limit":5}}
{"name":"get_page","arguments":{"path":"runbooks/deployment.md"}}
```

Search is case-insensitive substring matching across the full Markdown and
title. Every whitespace-separated term must match; there is no stemming,
fuzzy matching, phrase syntax, or semantic search. Each term earns 10 points
for a title match plus up to 5 points for occurrences in the Markdown. Higher
scores appear first; ties sort by path. The default limit is 10, allowed range
1–100. Snippets collapse whitespace and show up to 240 characters around the
first matching term, plus ellipses if clipped. No matches returns `[]`.

Titles come from a nonempty YAML front matter `title`, otherwise the first
ATX (`# Heading`) or Setext heading outside fenced code, otherwise the filename
without `.md`. Malformed YAML returns an error identifying the page.

Empty queries, missing pages, and prohibited paths return MCP tool results with
`isError: true` and a readable message. The SDK validates argument types and
limit bounds. Read errors are surfaced rather than silently losing documents.

## Filesystem assumptions and boundaries

- The supplied folder was empty, so TypeScript was selected and two realistic
  sample docs were created under `sample-docs/`.
- The corpus is small and consists of UTF-8 files ending in lowercase `.md`.
  Searches re-scan and re-read every page; retrieval re-reads the requested file.
  Changes, additions, and removals appear on the next call, without a watcher.
  This costs work proportional to corpus size; there is no persisted index.
- Paths returned by search use `/` and are relative to the root. Absolute paths,
  `..`, hidden components, `node_modules`, backslashes, and symlinks inside the
  root are rejected. Search also ignores hidden entries and symlinks. Only
  regular Markdown files are read. The configured root itself is canonicalized.
- The docs directory is trusted local storage, readable by the server's user.
  Calls do not provide a transactional snapshot across simultaneous edits.
  Documents deleted between enumeration and reading are skipped; other read
  failures surface. Full pages are returned without truncation, so the MCP
  client's message-size limit still applies.

## Verification

On a normal developer machine:

```bash
npm test
```

This builds the server, runs five filesystem tests, and three SDK client/stdin
integration tests. Filesystem fixtures cover ranking, limits, snippets, exact
retrieval, live changes, empty corpus, missing root/page, hidden directories,
`node_modules`, traversal, and file/directory symlinks.

This sandbox blocks Node child-process spawning (`EPERM`). Its SDK client tests
could not run. The explicitly selected fallback was:

```bash
DOCS_TEST_NO_SPAWN=1 npm test
python3 tests/smoke.py
```

Results: TypeScript build passed; five filesystem tests passed; three SDK spawn
tests were explicitly skipped. The optional Python 3 standard-library harness
then launched the real Node server and passed protocol initialization, tool
listing, ranked sample search, exact full-page retrieval, empty-query errors,
missing-page errors, and traversal rejection with both CLI and environment
configuration. Missing/unconfigured root startup checks also passed. Python is
only needed for this fallback check, not for running the server.

See `HANDOFF.md` for implementation boundaries and review limitations.
