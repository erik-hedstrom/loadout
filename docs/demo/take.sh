#!/usr/bin/env bash
set +x
set -euo pipefail
export A5_MODE=${1:-dry-run}
[[ $# -le 1 && ( $A5_MODE == dry-run || $A5_MODE == paid ) ]] || {
  echo 'Usage: bash docs/demo/take.sh [dry-run|paid]' >&2; exit 1;
}
source "$(dirname -- "${BASH_SOURCE[0]}")/setup.sh"
# Check isolation and warm filesystem/module caches before the camera starts.
(cd -- "$HOME/work"; loadout audit --json) > "$A5_RUN/audit.json"
python3 - "$A5_RUN/audit.json" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
claude = r['hosts'][0]
assert len(claude['skills']) == 24, 'Audit must contain exactly the 24 copied native skills.'
assert all(s['name'] != 'obsidian-markdown' for s in claude['skills'])
assert all(not h['servers'] for h in r['hosts']), 'Ambient MCP config reached the demo.'
PY
if [[ $A5_MODE == paid ]]; then
  printf 'Live take: approve normal startup/trust prompts, then /exit after the response.\n'
  printf 'Keep every frame. If the skill is not opened/used, discard this take.\n'
fi
# Only TERM is captured as metadata. Keyboard input and environment secrets are not recorded.
"$A5_TOOLS_DIR/asciinema" rec --quiet --return --output-format asciicast-v2 \
  --capture-env TERM --window-size 96x30 \
  --command 'bash "$A5_REPO/docs/demo/session.sh"' "$A5_RUN/demo.cast"
"$A5_TOOLS_DIR/agg" --quiet --font-family 'DejaVu Sans Mono' --font-size 18 \
  --line-height 1.25 --theme github-dark --fps-cap 8 --idle-time-limit 86400 \
  --last-frame-duration 3 "$A5_RUN/demo.cast" "$A5_RUN/demo.gif"
if [[ $A5_MODE == paid ]]; then
  # Keep only the hook's skill keys, never a transcript, prompt, config or private path.
  python3 - "$LOADOUT_HOME/sessions/hook" "$A5_RUN/hook-evidence.json" <<'PY'
import json, pathlib, sys
states = []
for p in pathlib.Path(sys.argv[1]).glob('*.json'):
    state = json.loads(p.read_text())
    states.append({k: state.get(k, []) for k in ('offered', 'injected')})
pathlib.Path(sys.argv[2]).write_text(json.dumps(states, indent=2) + '\n')
if not any('obsidian-markdown' in s['offered'] + s['injected'] for s in states):
    sys.exit('Hook did not offer/inject obsidian-markdown. This take does not meet A5.')
PY
fi
python3 - "$A5_RUN/demo.gif" <<'PY'
import json, pathlib, struct, sys
p = pathlib.Path(sys.argv[1])
size = p.stat().st_size
width, height = struct.unpack('<HH', p.read_bytes()[6:10])
print(f'GIF: {size:,} bytes; {width} x {height}; {p}')
events = [json.loads(line) for line in p.with_suffix('.cast').read_text().splitlines()[1:]]
print(f'Captured duration: {events[-1][0]:.1f} seconds (normal speed; final hold adds 3 seconds).')
if size >= 2_000_000:
    sys.exit('Over the README budget. Keep the cast; lower render FPS, never edit frames.')
PY
