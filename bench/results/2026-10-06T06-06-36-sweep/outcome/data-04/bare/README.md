# Synthetic A/B analysis deliverables

The working folder contained no experiment export. All input data here is synthetic,
created under the user's explicit fallback instruction. No conclusion about the real
experiment is possible from this demonstration.

- `verdict.md`: written verdict, design checks, power, assumptions, risks and method references.
- `synthetic_ab_test.csv`: sole input export, 4,000 fictional users, binary conversion.
- `analysis_results.json`: numerical results, input hash, daily allocation and weekly summaries.
- `analyze_ab.py`: dependency-free analysis, read-only input; writes the two result files.
- `generate_sample.py`: seeded sample generator, refuses to overwrite existing input.
- `verify_analysis.py`: numerical invariants and contamination checks.

Run from this folder:

```bash
python3 analyze_ab.py synthetic_ab_test.csv --synthetic
python3 verify_analysis.py
```

The CSV has `user_id`, `variant` (A control/B treatment), `converted` (0/1), and
`exposed_at` (ISO timestamp with timezone). The illustrative outcome is a completed
initial-session conversion; there are no delayed or censored outcomes in this scenario.
The generator uses fixed totals, shuffled outcomes/assignments, and seed 20261007.
It is not a simulation of evidence for any actual intervention.

## Handoff for the next analyst/model

`analyze_ab.analyze(path: Path, baseline=0.10, effect=0.01)` returns a dictionary;
`compare(a_successes, a_n, b_successes, b_n)` calculates the pooled z-test and
Newcombe-Wilson interval for B minus A. `power(a_n, b_n, baseline, effect)` uses
pooled null and unpooled alternative variances. `required_per_arm(baseline, effect)`
finds the smallest equal-arm integer sample with at least 80% approximate power.
Alpha is fixed at 0.05. Effect is an absolute proportion difference, not a relative lift.

Before using real data, confirm the input choice, primary metric, randomization unit,
planned allocation, outcome window and stopping rule with Erik. The current script
supports exactly two labels A/B and one row per user; it intentionally rejects
contamination and sparse binary outcomes. It does not support continuous metrics,
clustered observations, sequential inference, or multiple-arm comparisons. The lack
of sample ratio mismatch does not prove randomization validity. A row-level export
cannot reveal earlier peeking or all tested metrics.

Environment: Python 3.14.4; `python`, SciPy, statsmodels and `rtk` were unavailable,
so the analysis uses `python3` and the standard library. This folder is not a Git
repository; no branch, commit or cross-model branch review was possible. No original
data was present or modified. Method documentation was checked against official
statsmodels documentation linked in the report.
