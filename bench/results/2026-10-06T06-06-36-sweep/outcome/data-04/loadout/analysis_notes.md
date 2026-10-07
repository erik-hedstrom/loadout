# Synthetic demonstration — keep running; no winner yet

The folder contained no test data. All observations here are invented; **this is
not evidence about your actual experiment**. The observed difference is promising,
but the uncertainty includes a small loss and a substantial gain. Failure to
reject the null does not establish that the variants are equivalent.

| Variant | Users | Conversions within 24 hours | Conversion rate |
|---|---:|---:|---:|
| A (control) | 500 | 50 | 10.0% |
| B | 500 | 65 | 13.0% |

B − A = **+3.00 percentage points**,
or **30.0% relative lift**. Two-sided pooled
two-proportion z-test: z = 1.4869, **p = 0.1371**,
alpha = 0.05. Newcombe–Wilson 95% interval for B − A:
**[-0.97, +6.99] percentage points**.
This is an unadjusted fixed-horizon analysis of one primary comparison.

The data have two variants, one binary primary metric (`converted`), and one row
per independent user. Enrollment spans 14 days:
2026-09-14 00:00 UTC through 2026-09-28 00:00 UTC (exclusive).
Actual first/last assignments: 2026-09-14T00:02:26+00:00 / 2026-09-27T23:43:25+00:00.
Export cutoff is 2026-09-29 00:00 UTC. Every user has a complete 24-hour outcome
window; no rows were excluded. This metric window is specified by the synthetic
design, not something timestamps alone can prove.

Checks: 0 duplicate rows, 0 users in multiple variants,
and 0 missing values. Under the **assumed 50:50 allocation**,
sample ratio chi-square(1) = 0.000, p = 1.000; no mismatch detected.
Each group has at least 50 conversions and 435 nonconversions, supporting the
large-sample approximation. Normality checks are inappropriate for this binary
outcome. Clean identifiers cannot certify independence or correct randomization;
those are stipulated for this synthetic example.

For planning, assume a 10% baseline, independent Bernoulli outcomes, balanced
allocation, two-sided alpha 0.05, and 80% power. The illustrative minimum effect
is **+2 percentage points** (10% → 12%, a 20% relative improvement), chosen as a
demonstration threshold before creating outcomes; its business importance is unknown.
At the current sample, power for that target is **17.3%**.
About **3,841 users per variant** are needed, or
**6,682 additional users total** beyond the current sample.
The current 80%-power minimum detectable positive effect is
**5.95 percentage points** at the assumed baseline.
These are asymptotic planning estimates, not power computed from the observed lift.

| Target absolute gain | Relative gain at 10% baseline | Required users per variant | Additional users total | Current power |
|---|---:|---:|---:|---:|
| +1 pp | 10% | 14,751 | 28,502 | 8.1% |
| +2 pp | 20% | 3,841 | 6,682 | 17.3% |
| +3 pp | 30% | 1,774 | 2,548 | 31.8% |

Fourteen days cover two weekly cycles, but cannot establish that novelty effects,
delayed conversions, or longer business cycles have settled. Daily outcomes are
provided descriptively in results.json; no daily hypothesis tests were used.
There is only one outcome and one contrast, so no multiplicity correction is
needed for this specified family. Other tests outside this export are unknown.
The export cannot reveal prior peeking or outcome-driven stopping. This p-value
and interval assume one planned final look. Do not repeatedly check p < .05;
for a real experiment, agree the business effect and stopping rule, then use a
planned final analysis or a valid sequential design. The extra-sample estimate
does not promise eventual significance or retroactively repair earlier peeking.

Rerun: `python3 analysis.py`. Inspect `analysis.py` for all formulas;
`generate_sample.py` documents the fixed-count, seeded construction. This example
is deliberately conditional on its specified conversion totals, not a simulation
of random treatment effects. Original inputs are read only by analysis.py.

Methods checked against official statsmodels documentation:
[pooled z-test](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.proportions_ztest.html),
[Newcombe interval](https://www.statsmodels.org/dev/generated/statsmodels.stats.proportion.confint_proportions_2indep.html), and
[two-proportion power model](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.power_proportions_2indep.html).
No external packages are required; package installation was unavailable because
the shell could not resolve pypi.org. Statistical-analysis and statistical-power
skills guided the test selection, uncertainty reporting, and sensitivity analysis.
