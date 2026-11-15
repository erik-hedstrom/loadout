#!/usr/bin/env bash
# Sourced by take.sh, before capture starts. Never run with shell tracing.
set +x
set -euo pipefail
umask 077

A5_REPO=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
export A5_REPO
: "${A5_TOOLS_DIR:?Set A5_TOOLS_DIR to the asciinema/agg installation}"
: "${A5_OUTPUT_DIR:?Set A5_OUTPUT_DIR to a Windows-mounted scratch directory}"
export A5_LIBRARY_DIR=${A5_LIBRARY_DIR:-$HOME/.loadout/library/skills}
[[ $A5_OUTPUT_DIR == /mnt/c/* && $A5_TOOLS_DIR == /mnt/c/* ]] || {
  echo 'Use Windows-mounted tools and output directories.' >&2; exit 1;
}
for tool in asciinema agg; do test -x "$A5_TOOLS_DIR/$tool"; done
test -f "$A5_REPO/dist/cli.js" || {
  echo 'Run npm ci and npm run build in the checkout first.' >&2; exit 1;
}
if [[ $A5_MODE == paid ]]; then
  [[ -v CLAUDE_CODE_OAUTH_TOKEN && -v A5_JEV_KEY_FILE ]] || {
    echo 'Paid mode requires CLAUDE_CODE_OAUTH_TOKEN and A5_JEV_KEY_FILE.' >&2; exit 1;
  }
  [[ $A5_JEV_KEY_FILE == /* && -f $A5_JEV_KEY_FILE ]] || {
    echo 'A5_JEV_KEY_FILE must name an existing absolute WSL file.' >&2; exit 1;
  }
fi

mkdir -p -- "$A5_OUTPUT_DIR"
export A5_RUN
A5_RUN=$(mktemp -d "$A5_OUTPUT_DIR/$A5_MODE-XXXXXX")
export A5_ROOT
A5_ROOT=$(mktemp -d /var/tmp/loadout-demo-XXXXXX)
# Both directories were atomically created by this process; no computed user target is deleted.
cleanup() { rm -rf -- "$A5_ROOT" "$A5_RUN/runtime"; }
trap cleanup EXIT
# Stream with Windows tar so NTFS file metadata stays on its native side.
# Only extraction runs in WSL. No install or dependency lifecycle script runs.
mkdir -- "$A5_ROOT/code"
tar.exe -cf - -C "$(wslpath -w "$A5_REPO")" package.json dist node_modules |
  tar -xf - -C "$A5_ROOT/code"
export A5_NODE
A5_NODE=$(command -v node)
export A5_CLAUDE
A5_CLAUDE=$(command -v claude)
node "$A5_REPO/docs/demo/setup.mjs"

export HOME="$A5_ROOT/home"
export CLAUDE_CONFIG_DIR="$HOME/claude"
export LOADOUT_HOME="$HOME/loadout"
export CODEX_HOME="$HOME/codex"
export XDG_CONFIG_HOME="$HOME/config"
export XDG_CACHE_HOME="$HOME/cache"
export PATH="$A5_RUN/runtime/bin:$PATH"
export MCP_CONNECTION_NONBLOCKING=0 MCP_CONNECT_TIMEOUT_MS=60000 MCP_TIMEOUT=60000
export DISABLE_AUTOUPDATER=1 DISABLE_TELEMETRY=1 DISABLE_ERROR_REPORTING=1
export TERM=xterm-256color COLORTERM=truecolor
# The hook reads its key file through resolveApiKey; no ambient credential or endpoint wins.
unset TYPESAFE_API_KEY TYPESAFE_BASE_URL ANTHROPIC_API_KEY ANTHROPIC_BASE_URL
unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT
# Never record the private pointer, and never pass it to the Windows process.
unset A5_JEV_KEY_FILE
crossing=(PATH/l HOME/p USERPROFILE/p CLAUDE_CONFIG_DIR/p CLAUDE_CODE_OAUTH_TOKEN
  MCP_CONNECTION_NONBLOCKING MCP_CONNECT_TIMEOUT_MS MCP_TIMEOUT
  DISABLE_AUTOUPDATER DISABLE_TELEMETRY DISABLE_ERROR_REPORTING)
# Use a known list instead of inheriting forwarding of ambient credentials or config.
export USERPROFILE="$A5_RUN/runtime"
export WSLENV
WSLENV=$(IFS=:; echo "${crossing[*]}")
