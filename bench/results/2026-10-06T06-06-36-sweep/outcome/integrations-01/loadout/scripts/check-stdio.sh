#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
output=$(mktemp)
diagnostics=$(mktemp)
trap 'rm -f "$output" "$diagnostics"' EXIT

# Feed actual wire messages without Node spawning a subprocess (blocked in some sandboxes).
DOCS_ROOT="$PWD/sample-docs" node dist/index.js >"$output" 2>"$diagnostics" <<'JSONRPC'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"stdio-smoke-test","version":"1.0.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":"rollback","limit":1}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_page","arguments":{"path":"operations/rollback.md"}}}
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"search_docs","arguments":{"query":" "}}}
{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"get_page","arguments":{"path":"missing.md"}}}
{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"get_page","arguments":{"path":"../README.md"}}}
JSONRPC
test ! -s "$diagnostics"
node --input-type=module - "$output" <<'CHECK'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const messages = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const replies = new Map(messages.map(message => [message.id, message]));
assert.equal(replies.size, 7);
assert.ok(replies.get(1).result.serverInfo);
assert.deepEqual(replies.get(2).result.tools.map(t => t.name).sort(), ['get_page', 'search_docs']);
const hits = replies.get(3).result.structuredContent.results;
assert.equal(hits.length, 1);
assert.equal(hits[0].path, 'operations/rollback.md');
assert.equal(replies.get(4).result.structuredContent.title, 'Production rollback');
assert.match(replies.get(4).result.structuredContent.content, /previous image digest/);
for (const [id, pattern] of [[5, /empty/], [6, /Page not found/], [7, /Invalid page path/]]) {
  assert.equal(replies.get(id).result.isError, true);
  assert.match(replies.get(id).result.content[0].text, pattern);
}
console.log('stdio check passed: handshake, tool discovery, ranked search, full retrieval, and 3 error cases.');
CHECK

# CLI wins over env; help and failures are checked separately from the MCP stream.
DOCS_ROOT=/does-not-exist node dist/index.js --docs-root "$PWD/sample-docs" </dev/null
node dist/index.js --help >"$output"
for mode in missing bad-root unknown-option; do
  args=()
  if [[ "$mode" == bad-root ]]; then args=(--docs-root /missing-docs-root); fi
  if [[ "$mode" == unknown-option ]]; then args=(--bogus); fi
  if DOCS_ROOT='' node dist/index.js "${args[@]}" >"$output" 2>"$diagnostics"; then
    echo "Expected startup failure for $mode" >&2
    exit 1
  fi
  test ! -s "$output"
  node --input-type=module - "$diagnostics" <<'CHECK'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
assert.match(readFileSync(process.argv[2], 'utf8'), /Error:/);
CHECK
done
echo 'startup check passed: CLI precedence, help, missing config, missing root, and unknown option.'
