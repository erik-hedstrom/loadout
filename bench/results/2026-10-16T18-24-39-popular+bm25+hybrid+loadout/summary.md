# Routing benchmark v2 — two-stage Jev

Rows: `results/2026-10-16T18-24-39-popular+bm25+hybrid+loadout`. Dev split: 69 tasks; test split: 130 tasks. Policies tuned on dev (3,240 candidates, needless loads ≤ 10%), reported on test.

## Tuned policies (dev → test, all sizes pooled)

| budget | policy | dev recall | test recall (loaded) | test top-1 | test loaded | test available (loaded + also relevant) | test loaded + offered | test needless loads |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| ≤ 1 | expected ≥ 0.9, share ≥ 0.2, need ≥ 0.5, max 2 | 86% | **91%** | 90% | 1.0 | 93% | 2.3 | 5% |
| ≤ 2 | expected ≥ 0.9, share ≥ 0.05, need ≥ 0.5, max 3 | 87% | **92%** | 90% | 1.1 | 93% | 2.3 | 5% |
| ≤ 3 | expected ≥ 0.9, share ≥ 0.05, need ≥ 0.5, max 3 | 87% | **92%** | 90% | 1.1 | 93% | 2.3 | 5% |
| ≤ 5 | expected ≥ 0.9, share ≥ 0.05, need ≥ 0.5, max 3 | 87% | **92%** | 90% | 1.1 | 93% | 2.3 | 5% |

95% intervals (test, pooled; rows repeat tasks across sizes, so these are optimistic): recall 88–94%, needless loads 2–14% (3/60 rows).

## Test split by library size (loadout at budget ≤ 3: expected ≥ 0.9, share ≥ 0.05, need ≥ 0.5, max 3)

| arm | library | recall | top-1 | skills shown | needless loads | router $/task | router ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| popular | 1,000 | 12% | 0% | 50.0 | 100% | — | 0 |
| bm25 | 1,000 | 97% | 86% | 10.0 | 100% | — | 4 |
| hybrid | 1,000 | 97% | 86% | 10.0 | 100% | — | 7 |
| **loadout v2** (available: 95%, 1.5 shown) | 1,000 | **93%** | 93% | 1.0 | 5% | 0.00095 | 1191 |
| popular | 5,000 | 12% | 0% | 50.0 | 100% | — | 0 |
| bm25 | 5,000 | 94% | 81% | 10.0 | 100% | — | 23 |
| hybrid | 5,000 | 93% | 80% | 10.0 | 100% | — | 41 |
| **loadout v2** (available: 93%, 2.3 shown) | 5,000 | **92%** | 90% | 1.1 | 5% | 0.00097 | 1275 |
| popular | 20,000 | 12% | 0% | 50.0 | 100% | — | 0 |
| bm25 | 20,000 | 88% | 72% | 10.0 | 100% | — | 100 |
| hybrid | 20,000 | 90% | 75% | 10.0 | 100% | — | 178 |
| **loadout v2** (available: 93%, 3.0 shown) | 20,000 | **90%** | 86% | 1.3 | 5% | 0.00097 | 1090 |

## Need-gate trade-off (test, pooled; otherwise the budget ≤ 3 policy)

| need ≥ | recall (loaded) | available | needless loads |
|---:|---:|---:|---:|
| 0 | 98% | 99% | 62% |
| 0.4 | 98% | 99% | 32% |
| 0.45 | 97% | 98% | 10% |
| 0.5 | 92% | 93% | 5% |
| 0.55 | 86% | 88% | 3% |
| 0.6 | 80% | 82% | 0% |

## Where misses happen (test)

| library | gold among candidates | gold in close shortlist | gold selected |
|---:|---:|---:|---:|
| 1,000 | 100% | 100% | 93% |
| 5,000 | 100% | 100% | 92% |
| 20,000 | 98% | 98% | 90% |

## What the fit number means (dev, all shortlisted candidates)

| fit (expected level / 3) | candidates | gold share | top-ranked in close choice |
|---|---:|---:|---:|
| 0–0.3 | 779 | 0% | 0% |
| 0.3–0.5 | 181 | 0% | 1% |
| 0.5–0.7 | 143 | 0% | 3% |
| 0.7–0.8 | 84 | 0% | 8% |
| 0.8–0.9 | 72 | 0% | 1% |
| 0.9–0.95 | 58 | 9% | 10% |
| 0.95–1 | 339 | 50% | 54% |

Gold share is a lower bound on precision: in a 20,000-skill library, many non-gold candidates are near-duplicates that would serve the task equally well.
