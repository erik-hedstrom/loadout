# Routing benchmark v2 — two-stage Jev

Rows: `results/2026-10-05T21-39-18-popular+bm25+hybrid+loadout`. Dev split: 69 tasks; test split: 130 tasks. Policies tuned on dev (3,240 candidates, needless loads ≤ 10%), reported on test.

## Tuned policies (dev → test, all sizes pooled)

| budget | policy | dev recall | test recall (loaded) | test top-1 | test loaded | test available (loaded + also relevant) | test loaded + offered | test needless loads |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| ≤ 1 | exact ≥ 0.6, share ≥ 0.2, need ≥ 0.55, max 2 | 80% | **88%** | 86% | 1.0 | 90% | 2.2 | 2% |
| ≤ 2 | exact ≥ 0.6, share ≥ 0.03, need ≥ 0.55, max 3 | 82% | **89%** | 86% | 1.2 | 90% | 2.2 | 2% |
| ≤ 3 | exact ≥ 0.6, share ≥ 0.03, need ≥ 0.55, max 3 | 82% | **89%** | 86% | 1.2 | 90% | 2.2 | 2% |
| ≤ 5 | exact ≥ 0.6, share ≥ 0.03, need ≥ 0.55, max 3 | 82% | **89%** | 86% | 1.2 | 90% | 2.2 | 2% |

## Test split by library size (loadout at budget ≤ 3: exact ≥ 0.6, share ≥ 0.03, need ≥ 0.55, max 3)

| arm | library | recall | top-1 | skills shown | needless loads | router $/task | router ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| popular | 1,000 | 12% | 0% | 50.0 | 100% | — | 0 |
| bm25 | 1,000 | 97% | 86% | 10.0 | 100% | — | 5 |
| hybrid | 1,000 | 97% | 86% | 10.0 | 100% | — | 9 |
| **loadout v2** (available: 90%, 1.4 shown) | 1,000 | **90%** | 89% | 1.0 | 5% | 0.00075 | 1101 |
| popular | 5,000 | 12% | 0% | 50.0 | 100% | — | 0 |
| bm25 | 5,000 | 94% | 81% | 10.0 | 100% | — | 27 |
| hybrid | 5,000 | 93% | 80% | 10.0 | 100% | — | 47 |
| **loadout v2** (available: 90%, 2.3 shown) | 5,000 | **90%** | 85% | 1.2 | 0% | 0.00077 | 1137 |
| popular | 20,000 | 12% | 0% | 50.0 | 100% | — | 0 |
| bm25 | 20,000 | 88% | 72% | 10.0 | 100% | — | 111 |
| hybrid | 20,000 | 90% | 75% | 10.0 | 100% | — | 189 |
| **loadout v2** (available: 89%, 2.9 shown) | 20,000 | **86%** | 85% | 1.4 | 0% | 0.00077 | 1020 |

## Need-gate trade-off (test, pooled; otherwise the budget ≤ 3 policy)

| need ≥ | recall (loaded) | available | needless loads |
|---:|---:|---:|---:|
| 0 | 98% | 99% | 72% |
| 0.4 | 98% | 99% | 68% |
| 0.45 | 98% | 98% | 22% |
| 0.5 | 95% | 96% | 5% |
| 0.55 | 89% | 90% | 2% |
| 0.6 | 81% | 82% | 0% |

## Where misses happen (test)

| library | gold among candidates | gold in close shortlist | gold selected |
|---:|---:|---:|---:|
| 1,000 | 100% | 100% | 90% |
| 5,000 | 100% | 100% | 90% |
| 20,000 | 98% | 98% | 86% |

## What the fit number means (dev, all shortlisted candidates)

| fit (expected level / 3) | candidates | gold share | top-ranked in close choice |
|---|---:|---:|---:|
| 0–0.3 | 771 | 0% | 0% |
| 0.3–0.5 | 186 | 0% | 1% |
| 0.5–0.7 | 141 | 0% | 4% |
| 0.7–0.8 | 75 | 0% | 4% |
| 0.8–0.9 | 80 | 4% | 9% |
| 0.9–0.95 | 57 | 5% | 7% |
| 0.95–1 | 346 | 49% | 53% |

Gold share is a lower bound on precision: in a 20,000-skill library, many non-gold candidates are near-duplicates that would serve the task equally well.
