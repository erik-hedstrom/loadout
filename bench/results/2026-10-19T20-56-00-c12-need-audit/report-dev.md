# Need gate audit (dev split)

Gate: need < 0.5 selects nothing (`decide()` replayed on stored answers). Judge labels: 300 blind labels; 99 dev requests, 4 runs. Intervals are 95% Wilson; pooled rows repeat requests, so pooled intervals are optimistic.

Rows without Jev answers (keyword fallback, not replayable): 0 / 0 / 0 / 0. Replay reproduces the stored loaded set in 396 of 396 rows.

## Gate verdict against the judge, at the current threshold

| Run | Rows | False "no skill" (judge: helpful or essential) | False "no skill" (essential only) | False "skill" (judge: none) |
|---|---:|---|---|---|
| run 1 | 99 | 20% (9/44, 11–35%) | 0% (0/8, 0–32%) | 58% (32/55, 45–70%) |
| run 2 | 99 | 16% (7/44, 8–29%) | 0% (0/8, 0–32%) | 56% (31/55, 43–69%) |
| run 3 | 99 | 16% (7/44, 8–29%) | 0% (0/8, 0–32%) | 55% (30/55, 42–67%) |
| run 4 | 99 | 16% (7/44, 8–29%) | 0% (0/8, 0–32%) | 56% (31/55, 43–69%) |
| pooled | 396 | 17% (30/176, 12–23%) | 0% (0/32, 0–11%) | 56% (124/220, 50–63%) |

Judge labels on these requests: 8 essential, 36 helpful, 55 none.

## Stability of `need` across runs

- Requests with an answer in every run: 99.
- Range of `need` per request (max minus min): median 0.017, 90th percentile 0.030, max 0.117.
- Gate verdict differs between runs: 5% (5/99, 2–11%).
- Within 0.05 of the threshold in some run: 24% (24/99, 17–34%).

## Threshold sweep (pooled over runs)

Same policy otherwise. Useful load: a loaded skill is in the judge's `useful` list. AUC of `need` for "judge says a skill helps": 0.716.

| need ≥ | False "no skill" | Needed requests with a useful load | Loaded skills that are useful | False "skill" | Nothing loaded when none needed |
|---:|---|---|---|---|---|
| 0 | 0% (0/176, 0–2%) | 70% (124/176, 63–77%) | 55% (152/276, 49–61%) | 100% (220/220, 98–100%) | 75% (165/220, 69–80%) |
| 0.3 | 0% (0/176, 0–2%) | 70% (124/176, 63–77%) | 55% (152/276, 49–61%) | 99% (218/220, 97–100%) | 75% (165/220, 69–80%) |
| 0.35 | 2% (3/176, 1–5%) | 70% (124/176, 63–77%) | 55% (152/276, 49–61%) | 95% (209/220, 91–97%) | 75% (165/220, 69–80%) |
| 0.4 | 3% (6/176, 2–7%) | 70% (124/176, 63–77%) | 55% (152/276, 49–61%) | 80% (176/220, 74–85%) | 75% (165/220, 69–80%) |
| 0.45 | 11% (20/176, 7–17%) | 68% (120/176, 61–75%) | 55% (148/271, 49–60%) | 69% (152/220, 63–75%) | 75% (165/220, 69–80%) |
| 0.5 (current) | 17% (30/176, 12–23%) | 65% (114/176, 57–71%) | 54% (142/263, 48–60%) | 56% (124/220, 50–63%) | 76% (167/220, 70–81%) |
| 0.55 | 23% (40/176, 17–29%) | 59% (104/176, 52–66%) | 57% (132/233, 50–63%) | 40% (88/220, 34–47%) | 81% (179/220, 76–86%) |
| 0.6 | 28% (49/176, 22–35%) | 55% (97/176, 48–62%) | 57% (125/219, 50–63%) | 38% (83/220, 32–44%) | 83% (183/220, 78–88%) |

## Paired against the current threshold (per request)

Needed requests (judge: helpful or essential) that gain or lose a useful load, and requests the judge labelled none that gain or lose a load, counted per request over the runs. p is an exact two-sided sign test.

| need ≥ | Needed: gain / lose (p) | None: more loads / fewer (p) |
|---:|---|---|
| 0 | 4 / 0 (p=0.125) | 1 / 0 (p=1.000) |
| 0.3 | 4 / 0 (p=0.125) | 1 / 0 (p=1.000) |
| 0.35 | 4 / 0 (p=0.125) | 1 / 0 (p=1.000) |
| 0.4 | 4 / 0 (p=0.125) | 1 / 0 (p=1.000) |
| 0.45 | 3 / 0 (p=0.250) | 1 / 0 (p=1.000) |
| 0.55 | 0 / 3 (p=0.250) | 0 / 3 (p=0.250) |
| 0.6 | 0 / 6 (p=0.031) | 0 / 4 (p=0.125) |

"Useful" counts only skills the blind judge listed, so precision is a lower bound (C13).
