# A/B test verdict: Keep running; no winner yet

SYNTHETIC DEMONSTRATION ONLY. No actual test export was present. These results cannot identify a winner in your real experiment.

B converts at 11.50% versus A at 10.00%: a **+1.50 percentage-point difference** (+15.0% relative lift). The two-sided pooled two-proportion z-test gives **p = 0.1257** (z = 1.531); the **95% Newcombe-Wilson confidence interval for B minus A is [-0.42, +3.42] percentage points**. The example does not establish a winner or equivalence: the interval allows both harm and benefit.

| Variant | Unique users | Conversions | Conversion rate |
|---|---:|---:|---:|
| A (control) | 2,000 | 200 | 10.00% |
| B (treatment) | 2,000 | 230 | 11.50% |

## Design and quality checks

- Two variants; one row per user; primary metric is `converted`, a 0/1 outcome. In the synthetic scenario it means conversion during the initial session, fully observed. This definition is an assumption supplied by the example, not inferable from column names alone.
- Exposure range: 2026-09-14T00:00:00+00:00 to 2026-09-27T23:54:57+00:00; 13.9965 elapsed days across 14 UTC calendar dates. These are observed exposure bounds, not proof of the configured start/end or final outcome window.
- Duplicate user IDs: 0; users in both variants: 0.
- Allocation: 2000:2000; assuming planned 50:50, Pearson sample-ratio chi-square = 0.000, df = 1, p = 1.0000. No overall mismatch signal; this does not prove correct randomization. Daily counts are in `analysis_results.json`.
- Each group has at least 10 successes and failures; the large-sample proportion test is appropriate under independent user randomization. Missing/invalid outcomes, missing timezones, repeated users, sparse outcomes, or other variant labels stop this script rather than being silently removed.

## Power and sample-size planning

Assume two-sided alpha = 0.05, 80% target power, independent users, equal allocation, a 10% planning baseline, and a minimum worthwhile improvement of **1.0 percentage point** (10% relative). This is an illustrative business threshold, not one established from real costs or revenue.

At the current sample, approximate power to detect that specified effect is **17.8%**. The effect detectable with 80% power is approximately **2.82 percentage points (28.2% relative)**. Approximately **14,751 users per variant** are needed for the chosen minimum effect: **12,751 more A users and 12,751 more B users**, **25,502 more in total**. These are normal-approximation planning estimates, using pooled null and unpooled alternative variances; no continuity correction. This is prospective sensitivity, not retrospective power calculated from the observed lift.

## Interpretation risks

The example spans two weekly cycles with no missing exposure dates, but 14 days is not a universal sufficiency rule. Real conversion delays, business cycles, and exposure timing can require longer. Independent user assignment, stable tracking, a common conversion window, and fully matured outcomes must be checked in the real experiment.

Weekly conversion rates below are descriptive only; the sample is too small to rule out novelty or time-varying effects. They are not additional winner tests.

- Week 1: A: 100/1000 (10.00%); B: 125/1000 (12.50%)
- Week 2: A: 100/1000 (10.00%); B: 105/1000 (10.50%)

There is one visible outcome and one A/B comparison, so no within-export multiple-comparison adjustment was made. Other metrics, segment searches, concurrent experiments, or prior comparisons cannot be ruled out. The CSV cannot reveal whether results were repeatedly checked or whether the metric was chosen after looking. The reported p-value and interval assume a single planned fixed-horizon analysis. **Do not simply continue checking until p < 0.05**: agree on the effect threshold and stopping rule before further data collection; if this was an unplanned look, use a valid sequential design or a fresh confirmatory test. The required sample above is a planning estimate, not a correction for earlier peeking.

## Reproduce

```bash
python3 analyze_ab.py synthetic_ab_test.csv --synthetic
python3 verify_analysis.py
```

No third-party packages are required (run with Python 3.14.4). `generate_sample.py` uses seed 20261007 and fixed totals to create the demonstration; it refuses to overwrite an existing CSV. Synthetic outcomes and assignments are shuffled; the observed lift was deliberately set for demonstration, not obtained from a real experiment. `analyze_ab.py` reads its input only and writes `analysis_results.json` and `verdict.md`; it never rewrites the input. For a selected real CSV with the same schema, explicitly pass its path and omit `--synthetic`. Specify the planning assumptions with `--baseline 0.10 --effect 0.01`; effect is an absolute proportion difference. Confirm the actual variant labels, primary metric, allocation and outcome definition first. Continuous metrics or more than two variants require a different analysis.

Methods references: [pooled two-proportion z-test](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.proportions_ztest.html), [independent-proportion confidence intervals](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.confint_proportions_2indep.html), and [normal-approximation power with null/alternative variances](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.power_proportions_2indep.html). The code implements the formulas directly in the standard library.

Input SHA-256: `6547a659769aa835335a7c272bf5068d6c6dd27f4663376654c2b83c6ef8727e`.
