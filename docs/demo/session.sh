#!/usr/bin/env bash
set +x
set -euo pipefail
cd -- "$HOME/work"
printf '\033[2J\033[H'
if [[ $A5_MODE == dry-run ]]; then
  printf 'FREE PREVIEW - Claude is a stub; no model or Jev calls.\n\n'
fi
printf "\033[36m$\033[0m loadout audit | sed -n '1p;5,6p' | fold -sw 92\n"
loadout audit | sed -n '1p;5,6p' | fold -sw 92
sleep 7
printf '\n\033[36m$\033[0m claude --model claude-sonnet-5-5 --plugin-dir ../plugin\n'
if [[ $A5_MODE == dry-run ]]; then
  printf '\n[Stub] The paid take opens the real interactive Claude Code UI.\n'
  printf '[Stub] Prompt: Draft a short Obsidian project note with YAML properties,\n'
  printf '       a [[Project Atlas]] link, a warning callout and two tasks.\n'
  printf '       Return only the Markdown; do not write files.\n\n'
  printf 'No hook output or skill use is simulated in this preview.\n'
  sleep 25
else
  # Initial prompt in an interactive session (no -p), supported by the stock CLI.
  # It does not name a skill or ask Claude to pretend to load one.
  cd -- "$A5_RUN/runtime/work"
  "$A5_CLAUDE" --model claude-sonnet-5-5 --plugin-dir "$(cat ../windows-plugin.txt)" \
    'Draft a short Obsidian project note with YAML properties, a [[Project Atlas]] link, a warning callout and two tasks. Return only the Markdown; do not write files.'
fi
sleep 3
