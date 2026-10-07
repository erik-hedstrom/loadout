# Routing benchmark v2 — two-stage Jev

Rows: `results/2026-10-06T00-53-05-loadout`. Dev split: 69 tasks; test split: 130 tasks. Policies tuned on dev (3,240 candidates, needless loads ≤ 10%), reported on test.

## Tuned policies (dev → test, all sizes pooled)

| budget | policy | dev recall | test recall (loaded) | test top-1 | test loaded | test available (loaded + also relevant) | test loaded + offered | test needless loads |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| ≤ 1 | exact ≥ 0.95, share ≥ 0.2, need ≥ 0.5, max 2 | 85% | **87%** | 86% | 0.9 | 95% | 2.3 | 5% |
| ≤ 2 | exact ≥ 0.7, share ≥ 0.03, need ≥ 0.5, max 3 | 90% | **94%** | 91% | 1.3 | 95% | 2.4 | 5% |
| ≤ 3 | exact ≥ 0.7, share ≥ 0.03, need ≥ 0.5, max 3 | 90% | **94%** | 91% | 1.3 | 95% | 2.4 | 5% |
| ≤ 5 | exact ≥ 0.7, share ≥ 0.03, need ≥ 0.5, max 3 | 90% | **94%** | 91% | 1.3 | 95% | 2.4 | 5% |

95% intervals (test, pooled; rows repeat tasks across sizes, so these are optimistic): recall 90–96%, needless loads 2–14% (3/60 rows).

## Test split by library size (loadout at budget ≤ 3: exact ≥ 0.7, share ≥ 0.03, need ≥ 0.5, max 3)

| arm | library | recall | top-1 | skills shown | needless loads | router $/task | router ms |
|---|---:|---:|---:|---:|---:|---:|---:|
| **loadout v2** (available: 95%, 1.5 shown) | 1,000 | **94%** | 93% | 1.0 | 5% | 0.00080 | 959 |
| **loadout v2** (available: 95%, 2.4 shown) | 5,000 | **95%** | 93% | 1.2 | 5% | 0.00082 | 990 |
| **loadout v2** (available: 95%, 3.2 shown) | 20,000 | **93%** | 86% | 1.5 | 5% | 0.00082 | 953 |

## Need-gate trade-off (test, pooled; otherwise the budget ≤ 3 policy)

| need ≥ | recall (loaded) | available | needless loads |
|---:|---:|---:|---:|
| 0 | 98% | 99% | 68% |
| 0.4 | 98% | 99% | 38% |
| 0.45 | 97% | 98% | 10% |
| 0.5 | 94% | 95% | 5% |
| 0.55 | 87% | 88% | 5% |
| 0.6 | 81% | 82% | 0% |

## Where misses happen (test)

| library | gold among candidates | gold in close shortlist | gold selected |
|---:|---:|---:|---:|
| 1,000 | 100% | 100% | 94% |
| 5,000 | 100% | 100% | 95% |
| 20,000 | 98% | 98% | 93% |

## What the fit number means (dev, all shortlisted candidates)

| fit (expected level / 3) | candidates | gold share | top-ranked in close choice |
|---|---:|---:|---:|
| 0–0.3 | 764 | 0% | 0% |
| 0.3–0.5 | 188 | 0% | 1% |
| 0.5–0.7 | 144 | 0% | 3% |
| 0.7–0.8 | 71 | 0% | 6% |
| 0.8–0.9 | 77 | 1% | 8% |
| 0.9–0.95 | 63 | 8% | 10% |
| 0.95–1 | 349 | 48% | 52% |

Gold share is a lower bound on precision: in a 20,000-skill library, many non-gold candidates are near-duplicates that would serve the task equally well.
