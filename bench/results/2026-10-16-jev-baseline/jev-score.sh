#!/bin/bash
# Score the 2026-10-16 Jev burn with C13's offline tools (no model calls). Run inside the WSL clone.
set -u
cd /var/tmp/loadout-jev || exit 1
# The reports were produced by bench/judge.ts and bench/stability.ts as of commit 18f36b0 (PR #45);
# a checkout of that commit or later reproduces them.
R=bench/results
V4BLIND=$R/2026-10-06T02-08-14-sweep
V4V=(--verdicts-from $R/2026-10-07T21-34-39-sweep)
C1=$R/2026-10-08T13-13-52-sweep
V4RUNS=(2026-10-16T17-39-02 2026-10-16T18-07-05 2026-10-16T18-19-29)
C1RUNS=(2026-10-16T17-54-45 2026-10-16T18-15-07 2026-10-16T18-22-14)
for d in "${V4RUNS[@]}"; do
  npx tsx bench/judge.ts "$R/$d-sweep" --offline --blind-from "$V4BLIND" "${V4V[@]}" > /dev/null 2> "/var/tmp/err-$d.txt" || { echo "FAIL $d"; grep -m3 -i "error" "/var/tmp/err-$d.txt"; }
done
for d in "${C1RUNS[@]}"; do
  npx tsx bench/judge.ts "$R/$d-sweep" --offline --requests bench/data/requests-c1.jsonl --blind-from "$C1" --verdicts-from "$C1" > /dev/null 2> "/var/tmp/err-$d.txt" || { echo "FAIL $d"; grep -m3 -i "error" "/var/tmp/err-$d.txt"; }
done
echo "reports: $(ls $R/2026-10-16T*-sweep/report-offline.md 2>/dev/null | wc -l)"
npx tsx bench/stability.ts $(printf "$R/%s-sweep " "${V4RUNS[@]}") > /var/tmp/stability-v4.md 2>&1 || true
npx tsx bench/stability.ts $(printf "$R/%s-sweep " "${C1RUNS[@]}") > /var/tmp/stability-c1.md 2>&1 || true
echo done
