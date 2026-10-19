#!/bin/bash
# Pure-Jev baseline on main: three repeat sweeps of v4 (315) and C1 (300), interleaved, then the gold route-bench.
# Sequential so Jev load stays steady; concurrency 2 per C1's learning (slow Jev pushes rows to the keyword fallback).
cd /var/tmp/loadout-jev || exit 1
for r in 1 2 3; do
  for set in requests requests-c1; do
    echo "== sweep $set run $r $(date -u +%FT%TZ)"
    npx tsx bench/sweep.ts --requests "bench/data/$set.jsonl" --concurrency 2 2>&1 | tail -4
    echo "dir: $(ls -td bench/results/*-sweep | head -1)"
  done
done
echo "== route-bench $(date -u +%FT%TZ)"
npx tsx bench/route-bench.ts 2>&1 | tail -15
echo "dir: $(ls -td bench/results/*/ | head -1)"
echo "== done $(date -u +%FT%TZ)"
