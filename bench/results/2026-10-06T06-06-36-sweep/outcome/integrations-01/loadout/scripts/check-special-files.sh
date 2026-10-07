#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
fixture=$(mktemp -d)
trap 'rm -f "$fixture/pipe.md"; rmdir "$fixture"' EXIT
mkfifo "$fixture/pipe.md"
timeout 5s node --input-type=module - "$fixture" <<'CHECK'
import assert from 'node:assert/strict';
import { Docs } from './dist/docs.js';
const docs = await Docs.open(process.argv[2]);
await assert.rejects(docs.getPage('pipe.md'), /regular Markdown file/);
assert.deepEqual(await docs.search('anything'), []);
console.log('special-file check passed: named pipes are rejected without blocking.');
CHECK
