#!/usr/bin/env bash
# Answers pending `--backend files` batches in <dir>/batches with `codex exec`.
#
#   bash answer-batches.sh <dir> [model] [effort]
#
# Why not `--backend codex`: on codex-cli 0.160.1 `unified_exec` stays on whatever
# the flags say, so bench/lib.ts refuses to run, and rightly so: a tool-using model
# fed third-party text could read credential files. This script is only for
# inputs without third-party text, here loadout's own seed prompt and the seeds
# Codex wrote from it. The flags below leave functions.exec (JavaScript, no file
# access), apply_patch (in a read-only sandbox), web__run and sub-agents; a
# probe asking the model to read a canary file in its directory got NO_ACCESS.
set -euo pipefail
dir="$1/batches"
model="${2:-gpt-6.1-sol}"
effort="${3:-high}"
disable=()
for f in shell_tool unified_exec view_image apps plugins remote_plugin multi_agent browser_use \
  browser_use_external computer_use image_generation in_app_browser hooks goals skill_search \
  tool_suggest code_mode_host skill_mcp_dependency_install sleep_tool; do
  disable+=(--disable "$f")
done
for prompt in "$dir"/*.prompt.md; do
  answer="${prompt%.prompt.md}.answer.json"
  [ -e "$answer" ] && continue
  work=$(mktemp -d)
  # bench/lib.ts writes the schema last, after this heading and a blank line.
  sed -n '/^## JSON output schema$/,$p' "$prompt" | tail -n +3 > "$work/schema.json"
  { echo 'Use only the supplied data; do not use tools. Return JSON matching the schema.'; echo; cat "$prompt"; } > "$work/prompt.md"
  (cd "$work" && codex exec "${disable[@]}" --ignore-user-config --ignore-rules --ephemeral --skip-git-repo-check \
    --sandbox read-only --model "$model" -c "model_reasoning_effort=\"$effort\"" \
    --output-schema schema.json -o answer.json - < prompt.md > /dev/null 2>&1)
  cp "$work/answer.json" "$answer"
  rm -rf "$work"
  echo "answered $(basename "$prompt")"
done
