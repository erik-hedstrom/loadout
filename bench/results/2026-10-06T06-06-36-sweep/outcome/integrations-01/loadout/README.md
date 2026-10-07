# Internal Markdown docs MCP server

A local, read-only TypeScript MCP server using the official `@modelcontextprotocol/sdk`.
It exposes `search_docs` and `get_page` over stdio. No network service, credentials,
database or remote API is needed at runtime.

## Install and run

Requires Node.js **22+** and npm. From this folder:

```bash
npm ci
npm run build
npm test
bash scripts/check-stdio.sh
bash scripts/check-special-files.sh
```

Run with the sample docs:

```bash
node dist/index.js --docs-root "$PWD/sample-docs"
```

Or point it at your internal docs:

```bash
DOCS_ROOT=/absolute/path/to/internal-docs node dist/index.js
```

`--docs-root` takes precedence over `DOCS_ROOT`. Relative roots resolve against the
process working directory; use absolute paths in desktop client configuration.
There is no implicit docs root. Missing configuration or an inaccessible root
causes startup to fail with an error on stderr. `node dist/index.js --help` prints
usage. An otherwise idle server waits for MCP messages; this is expected.

Dependencies are pinned with a lockfile. This build environment could not reach
npm, so installation was verified with
`npm install --offline --cache /tmp/docs-mcp-npm --no-audit --no-fund` using its
existing package cache. Normal installations use `npm ci`; the cache path is not
needed. The selected SDK is the available official v1.32.1 release; its imports
and signatures were checked against the installed package.

## Register with a client

The following is the exact configuration for the current Linux folder and sample
docs, also saved as `client-config.json`:

```json
{
  "mcpServers": {
    "internal-docs": {
      "command": "/usr/bin/node",
      "args": ["/tmp/loadout-outcome-work-ljoqoh/dist/index.js"],
      "env": {
        "DOCS_ROOT": "/tmp/loadout-outcome-work-ljoqoh/sample-docs"
      }
    }
  }
}
```

For **Claude Desktop on Windows with the server in WSL**, use
`client-config-windows-wsl.json` instead:

```json
{
  "mcpServers": {
    "internal-docs": {
      "command": "C:\\Windows\\System32\\wsl.exe",
      "args": [
        "--exec",
        "/usr/bin/node",
        "/tmp/loadout-outcome-work-ljoqoh/dist/index.js",
        "--docs-root",
        "/tmp/loadout-outcome-work-ljoqoh/sample-docs"
      ]
    }
  }
}
```

Build in WSL first. This uses the default WSL distribution; if needed, add
`"--distribution", "Ubuntu"` before `"--exec"`, substituting your distribution's
name. If you move this temporary project to a permanent folder, update the
executable and docs paths. If Node is installed elsewhere, substitute its actual
absolute executable path (`command -v node` in the target environment).

In Claude Desktop, open Settings → Developer → Edit Config and merge the
`internal-docs` entry into `mcpServers` in `claude_desktop_config.json`, then
restart the application. On Windows this config normally lives at
`%APPDATA%\Claude\claude_desktop_config.json`; use the app's Edit Config action to
locate the actual file for your installation. See the
[official local-server setup guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers).
The server and docs must be accessible from the client machine. Windows/WSL
configuration is supplied but was not tested in this Linux sandbox.

## Tools and search behavior

`search_docs({"query":"rollback", "limit":1})` returns:

```json
{
  "results": [
    {
      "path": "operations/rollback.md",
      "title": "Production rollback",
      "snippet": "--- title: Production rollback owner: Platform --- # Rollback runbook If error rates exceed 2% for five minutes after a deployment, the on-call engineer starts a rollback. Restore the previous image digest from the release record, then verify t…",
      "score": 103
    }
  ]
}
```

Search scans visible `.md` files recursively on **every search**, including
new, modified and deleted pages. Terms are whitespace-separated literal,
case-insensitive substrings; **every term** must match the title or Markdown
content. There is no stemming, fuzzy matching, regex or boolean syntax. Each
matched title term contributes `max(100, 20 × number of distinct terms + 1)`
points, ensuring title matches always outrank body repetition. Body occurrence
counts contribute up to 20 points per term. Ties sort by relative page path. `limit` defaults to
10 and accepts integers 1–100. No matches return an empty `results` array.
Snippets contain up to 240 source characters around the first matching body
term, with whitespace collapsed and ellipses where clipped.

`get_page({"path":"operations/rollback.md"})` returns `path`, `title`, and
`content`, containing the **full, unmodified Markdown** including front matter.
Retrieval always reads the current file, without waiting for another search.
Both tools return JSON text and MCP structured content on success; failures
return MCP tool errors with `isError: true` and an actionable text message.

Titles use a nonempty YAML front-matter `title` first, otherwise the first ATX
(`#`, `##`, etc.) or Setext heading outside fenced code, otherwise the filename
without `.md`. YAML is parsed with the `yaml` package; invalid front matter is
reported instead of silently dropped. Raw Markdown is searched, including code
and front matter. Only lowercase `.md` extensions are included.

## Path boundary and assumptions

The initial folder was empty, so this project uses TypeScript and creates three
realistic sample pages about releases, rollback and token rotation. The expected
corpus is small enough to read in memory on each search. No watcher or disk index
is maintained. For a large corpus, this strategy will need an index.

Paths must be relative and use `/`. Absolute paths, Windows absolute paths,
backslashes, NULs, empty or dot segments, hidden entries, `node_modules`, symlinks
and non-regular files are rejected. The root is canonicalized and every retrieved
file is checked for containment. Search ignores hidden entries, `node_modules`
and symlinks too. Missing pages and empty queries have explicit errors.
Disappearing pages/folders during search are skipped; other read failures surface.
The deployment assumes trusted local filesystem ownership, with normal document
edits rather than hostile concurrent directory replacement. Full pages are not
truncated; your MCP client may impose its own message-size limit.

## Verification and handoff

`npm test` builds TypeScript and runs document-service and SDK integration tests.
On an unrestricted machine it also spawns the server with an SDK stdio client to
check both configuration modes. This sandbox rejects Node child-process spawning
with `EPERM`, so those three tests explicitly skip here. The shell stdio check
exercises the real executable using JSON-RPC and verifies handshake, tool
discovery, ranked search, full retrieval, empty query, missing page, traversal,
CLI precedence, help, and startup errors. The special-file check proves `.md`
named pipes fail promptly instead of hanging. No Inspector or live Claude Desktop
session was run. See `HANDOFF.md` for implementation entry points.
