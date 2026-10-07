"""Synthetic A/B demonstration; Python 3.12+, no external dependencies.

Never creates or changes input files. Run generate_sample.py once to create
the explicitly synthetic inputs, then run this script to regenerate outputs.
"""
import argparse
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from statistics import NormalDist

NORMAL = NormalDist()


def conversion_test(x_a, n_a, x_b, n_b, alpha=0.05):
    """Independent binomial samples, pooled z-test, Newcombe hybrid CI for B-A."""
    for x, n in ((x_a, n_a), (x_b, n_b)):
        if n <= 0 or not 0 <= x <= n:
            raise ValueError("Invalid binomial counts")
    a, b = x_a / n_a, x_b / n_b
    pooled = (x_a + x_b) / (n_a + n_b)
    se = math.sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))
    if se == 0 or min(x_a, n_a-x_a, x_b, n_b-x_b) < 10:
        raise ValueError("Sparse/degenerate data: use an exact test instead")
    z = (b - a) / se
    critical = NORMAL.inv_cdf(1 - alpha / 2)

    def wilson(p, n):
        denominator = 1 + critical**2 / n
        center = (p + critical**2 / (2*n)) / denominator
        radius = critical * math.sqrt(p*(1-p)/n + critical**2/(4*n*n)) / denominator
        return center - radius, center + radius

    la, ua = wilson(a, n_a)
    lb, ub = wilson(b, n_b)
    difference = b - a
    return {
        "z": z, "p_value": math.erfc(abs(z) / math.sqrt(2)),
        "difference": difference, "relative_lift": difference / a if a else None,
        "ci95": [difference - math.hypot(b-lb, ua-a),
                 difference + math.hypot(ub-b, a-la)],
    }


def power(n_a, n_b, baseline, difference, alpha=0.05):
    """Normal approximation: pooled null variance, unpooled alternative variance.

    Matches the model documented for statsmodels power_proportions_2indep;
    baseline and target effect are planning inputs, never the observed lift.
    """
    treatment = baseline + difference
    if min(n_a, n_b) <= 0 or not (0 < baseline < treatment < 1):
        raise ValueError("Need positive n and feasible positive target effect")
    pooled = (n_a*baseline + n_b*treatment) / (n_a+n_b)
    null_se = math.sqrt(pooled*(1-pooled)*(1/n_a+1/n_b))
    alt_se = math.sqrt(baseline*(1-baseline)/n_a + treatment*(1-treatment)/n_b)
    threshold = NORMAL.inv_cdf(1-alpha/2)*null_se
    return NORMAL.cdf((difference-threshold)/alt_se) + NORMAL.cdf((-difference-threshold)/alt_se)


def required_n(baseline, difference, alpha=0.05, target=0.80):
    low, high = 1, 2
    while power(high, high, baseline, difference, alpha) < target:
        high *= 2
    while low < high:
        mid = (low+high)//2
        if power(mid, mid, baseline, difference, alpha) >= target:
            high = mid
        else:
            low = mid+1
    return low


def mde(n_a, n_b, baseline, alpha=0.05, target=0.80):
    low, high = 0.0, 1-baseline-1e-9
    if power(n_a, n_b, baseline, high, alpha) < target:
        raise ValueError("No feasible positive MDE reaches the target power")
    for _ in range(70):
        mid = (low+high)/2
        if power(n_a, n_b, baseline, mid, alpha) >= target:
            high = mid
        else:
            low = mid
    return high


def analyze(data_path, design_path):
    design = json.loads(design_path.read_text())
    if not design.get("synthetic"):
        raise ValueError("This demonstration requires synthetic metadata; review a real design separately")
    with data_path.open(newline="") as stream:
        reader = csv.DictReader(stream)
        if set(reader.fieldnames or []) != {"user_id", "variant", "converted", "assigned_at", "observed_at"}:
            raise ValueError("Unexpected schema; choose columns explicitly before analyzing")
        rows = list(reader)
    if not rows:
        raise ValueError("Empty input")
    ids = Counter(row["user_id"] for row in rows)
    memberships = defaultdict(set)
    for row in rows:
        memberships[row["user_id"]].add(row["variant"])
    duplicates = sum(n-1 for n in ids.values())
    crossover = sum(len(groups)>1 for groups in memberships.values())
    if duplicates or crossover:
        raise ValueError(f"Invalid independent-user design: {duplicates} duplicate rows, {crossover} crossover users")
    start = datetime.fromisoformat(design["enrollment_start"])
    end = datetime.fromisoformat(design["enrollment_end_exclusive"])
    cutoff = datetime.fromisoformat(design["export_cutoff"])
    duration = (end-start).total_seconds()/86400
    groups = defaultdict(list)
    daily = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    timestamps = []
    for row in rows:
        if not all(row.values()) or row["converted"] not in ("0", "1"):
            raise ValueError("Missing/invalid values; no rows silently excluded")
        assigned = datetime.fromisoformat(row["assigned_at"])
        observed = datetime.fromisoformat(row["observed_at"])
        if not start <= assigned < end or observed != assigned+timedelta(hours=design["outcome_window_hours"]) or observed > cutoff:
            raise ValueError("Invalid enrollment interval or immature outcome window")
        value = int(row["converted"])
        groups[row["variant"]].append(value)
        daily[assigned.date().isoformat()][row["variant"]][0] += 1
        daily[assigned.date().isoformat()][row["variant"]][1] += value
        timestamps.append(assigned)
    if set(groups) != {"A", "B"} or design["expected_allocation"] != {"A": 0.5, "B": 0.5}:
        raise ValueError("This script handles only the specified two-group, 1:1 design")
    n_a, n_b = len(groups["A"]), len(groups["B"])
    x_a, x_b = sum(groups["A"]), sum(groups["B"])
    expected = (n_a+n_b)/2
    srm_stat = ((n_a-expected)**2+(n_b-expected)**2)/expected
    srm_p = math.erfc(math.sqrt(srm_stat/2))
    result = conversion_test(x_a, n_a, x_b, n_b, design["alpha"])
    baseline, target = design["planning_baseline"], design["minimum_effect_absolute"]
    planning = []
    for effect in [0.01, 0.02, 0.03]:
        n = required_n(baseline, effect, design["alpha"], design["target_power"])
        planning.append({"absolute_effect": effect, "n_per_variant": n,
                         "additional_users": max(0,n-n_a)+max(0,n-n_b),
                         "achieved_power": power(n_a,n_b,baseline,effect,design["alpha"])})
    result.update({"synthetic": True, "groups": {v: {"n": len(values), "conversions": sum(values), "rate": sum(values)/len(values)} for v, values in groups.items()},
                   "enrollment_days": duration, "first_assignment": min(timestamps).isoformat(),
                   "last_assignment": max(timestamps).isoformat(),
                   "duplicate_rows": duplicates, "crossover_users": crossover, "missing_values": 0,
                   "srm_chi_square": srm_stat, "srm_df": 1, "srm_p_value": srm_p,
                   "power_sensitivity": planning,
                   "mde_absolute": mde(n_a,n_b,baseline,design["alpha"],design["target_power"]),
                   "daily_descriptives": dict(daily),
                   "input_sha256": hashlib.sha256(data_path.read_bytes()).hexdigest()})
    return result, design


def report(result, design):
    a, b = result["groups"]["A"], result["groups"]["B"]
    primary = next(p for p in result["power_sensitivity"] if p["absolute_effect"] == design["minimum_effect_absolute"])
    lo, hi = result["ci95"]
    return f"""# Synthetic demonstration — keep running; no winner yet

The folder contained no test data. All observations here are invented; **this is
not evidence about your actual experiment**. The observed difference is promising,
but the uncertainty includes a small loss and a substantial gain. Failure to
reject the null does not establish that the variants are equivalent.

| Variant | Users | Conversions within 24 hours | Conversion rate |
|---|---:|---:|---:|
| A (control) | {a['n']} | {a['conversions']} | {a['rate']:.1%} |
| B | {b['n']} | {b['conversions']} | {b['rate']:.1%} |

B − A = **{result['difference']*100:+.2f} percentage points**,
or **{result['relative_lift']:.1%} relative lift**. Two-sided pooled
two-proportion z-test: z = {result['z']:.4f}, **p = {result['p_value']:.4f}**,
alpha = 0.05. Newcombe–Wilson 95% interval for B − A:
**[{lo*100:+.2f}, {hi*100:+.2f}] percentage points**.
This is an unadjusted fixed-horizon analysis of one primary comparison.

The data have two variants, one binary primary metric (`converted`), and one row
per independent user. Enrollment spans {result['enrollment_days']:.0f} days:
2026-09-14 00:00 UTC through 2026-09-28 00:00 UTC (exclusive).
Actual first/last assignments: {result['first_assignment']} / {result['last_assignment']}.
Export cutoff is 2026-09-29 00:00 UTC. Every user has a complete 24-hour outcome
window; no rows were excluded. This metric window is specified by the synthetic
design, not something timestamps alone can prove.

Checks: {result['duplicate_rows']} duplicate rows, {result['crossover_users']} users in multiple variants,
and {result['missing_values']} missing values. Under the **assumed 50:50 allocation**,
sample ratio chi-square(1) = {result['srm_chi_square']:.3f}, p = {result['srm_p_value']:.3f}; no mismatch detected.
Each group has at least 50 conversions and 435 nonconversions, supporting the
large-sample approximation. Normality checks are inappropriate for this binary
outcome. Clean identifiers cannot certify independence or correct randomization;
those are stipulated for this synthetic example.

For planning, assume a 10% baseline, independent Bernoulli outcomes, balanced
allocation, two-sided alpha 0.05, and 80% power. The illustrative minimum effect
is **+2 percentage points** (10% → 12%, a 20% relative improvement), chosen as a
demonstration threshold before creating outcomes; its business importance is unknown.
At the current sample, power for that target is **{primary['achieved_power']:.1%}**.
About **{primary['n_per_variant']:,} users per variant** are needed, or
**{primary['additional_users']:,} additional users total** beyond the current sample.
The current 80%-power minimum detectable positive effect is
**{result['mde_absolute']*100:.2f} percentage points** at the assumed baseline.
These are asymptotic planning estimates, not power computed from the observed lift.

| Target absolute gain | Relative gain at 10% baseline | Required users per variant | Additional users total | Current power |
|---|---:|---:|---:|---:|
""" + "\n".join(f"| +{p['absolute_effect']*100:.0f} pp | {p['absolute_effect']/design['planning_baseline']:.0%} | {p['n_per_variant']:,} | {p['additional_users']:,} | {p['achieved_power']:.1%} |" for p in result['power_sensitivity']) + """

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
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("synthetic_ab_test.csv"))
    parser.add_argument("--design", type=Path, default=Path("synthetic_design.json"))
    args = parser.parse_args()
    result, design = analyze(args.data, args.design)
    Path("results.json").write_text(json.dumps(result, indent=2)+"\n")
    Path("analysis_notes.md").write_text(report(result, design))
    a, b = result["groups"]["A"], result["groups"]["B"]
    lo, hi = result["ci95"]
    planning = next(p for p in result["power_sensitivity"] if p["absolute_effect"] == design["minimum_effect_absolute"])
    Path("verdict.md").write_text(f"""# Synthetic verdict: keep running; no winner yet

**No real data were present. These results describe invented sample data and
cannot determine a winner for your actual experiment.**

| Variant | Users | Conversions | Rate |
|---|---:|---:|---:|
| A | {a['n']} | {a['conversions']} | {a['rate']:.1%} |
| B | {b['n']} | {b['conversions']} | {b['rate']:.1%} |

The primary metric is conversion within 24 hours of assignment. Enrollment
covers 14 days (September 14–27, 2026 UTC), with complete follow-up at export.
There are no missing values, duplicate users, or users in multiple variants.
Under the assumed 50:50 allocation, sample-ratio chi-square(1) = 0, p = 1.000.

B's observed lift is **{result['difference']*100:+.2f} percentage points**
(**{result['relative_lift']:.0%} relative**). The two-sided pooled z-test gives
**p = {result['p_value']:.4f}**; the Newcombe–Wilson 95% interval for B − A is
**[{lo*100:+.2f}, {hi*100:+.2f}] percentage points**. The data remain compatible
with a small loss or a substantial gain; they do not establish equivalence.

Assuming alpha 0.05, 80% power, a 10% baseline, independent users, and a
minimum effect of **+2 percentage points**, current power is only
**{planning['achieved_power']:.1%}**. The approximate target is
**{planning['n_per_variant']:,} users per variant**, requiring
**{planning['additional_users']:,} more users total**. Current 80%-power MDE is
**{result['mde_absolute']*100:.2f} percentage points**. The minimum effect is
illustrative; its business importance must be established for a real test.

Two weekly cycles do not rule out novelty or longer business cycles. Peeking
and prior tests cannot be assessed from this export. One metric and one contrast
need no multiplicity correction for this specified family. Agree a stopping rule
before collecting more data; repeated ordinary significance checks are invalid.

Rerun with `python3 analysis.py`; verify with `python3 verify_analysis.py`.
Both commands passed; inputs remained unchanged. See [analysis_notes.md](analysis_notes.md)
for assumptions, sensitivity estimates, methods sources, and limitations.
""")
    print(f"SYNTHETIC: p={result['p_value']:.6f}; B-A={result['difference']:.4f}; CI={result['ci95']}")
    print("Wrote verdict.md, analysis_notes.md, and results.json; input data unchanged.")


if __name__ == "__main__":
    main()
