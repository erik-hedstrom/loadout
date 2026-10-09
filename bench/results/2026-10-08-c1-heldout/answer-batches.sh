#!/usr/bin/env bash
# Answers pending `--backend files` batches in <dir>/batches with `codex exec`.
#
#   bash answer-batches.sh <dir> [model] [effort]   # <dir> holds batches/: <out dir>/<prefix> for seeds.ts
#
# Why not `--backend codex`: on codex-cli 0.160.1 `unified_exec` stays on whatever
# the flags say, so bench/lib.ts refuses to run, and rightly so: a tool-using model
# fed third-party text could read credential files (backlog E12). This script
# answers only seeds.ts and expand.ts batches, whose inputs are loadout's own
# prompts and the seeds Codex wrote from them. It refuses anything else, judge
# batches above all, because those carry the third-party skill catalog.
# The flags below leave functions.exec (JavaScript; the model reported it has
# no file access), apply_patch (in a read-only sandbox), web__run and
# sub-agents. A probe asking the model to read a canary file in its directory
# got NO_ACCESS.
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
work=""
trap '[ -n "$work" ] && rm -rf "$work"' EXIT
for prompt in "$dir"/*.prompt.md; do
  answer="${prompt%.prompt.md}.answer.json"
  [ -e "$answer" ] && continue
  # bench/lib.ts writes the System section before the User section, so third-party
  # text in the user part cannot change its first line.
  first=$(awk '/^## System$/ { getline; getline; print; exit }' "$prompt")
  case "$first" in
    "Write distinct requests that people type to an AI assistant or coding agent."|\
    "You are the prompt-improvement step a user runs before sending a request to their AI assistant or coding agent"*) ;;
    *) echo "refusing $(basename "$prompt"): not a seeds.ts or expand.ts batch" >&2; exit 1 ;;
  esac
  work=$(mktemp -d)
  # bench/lib.ts writes the schema last, after this heading and a blank line.
  sed -n '/^## JSON output schema$/,$p' "$prompt" | tail -n +3 > "$work/schema.json"
  { echo 'Use only the supplied data; do not use tools. Return JSON matching the schema.'; echo; cat "$prompt"; } > "$work/prompt.md"
  if ! (cd "$work" && codex exec "${disable[@]}" --ignore-user-config --ignore-rules --ephemeral --skip-git-repo-check \
    --sandbox read-only --model "$model" -c "model_reasoning_effort=\"$effort\"" \
    --output-schema schema.json -o answer.json - < prompt.md > /dev/null 2>&1); then
    echo "codex exec failed on $(basename "$prompt")" >&2
    exit 1
  fi
  cp "$work/answer.json" "$answer"
  rm -rf "$work"
  work=""
  echo "answered $(basename "$prompt")"
done
