"""Analyze a two-arm, one-row-per-user binary conversion export with no dependencies.

No discovery or metric guessing: the caller must select an input with the documented
schema. Normal approximations require sufficient successes and failures. Repeated
users are rejected rather than silently deduplicated or counted as independent.
"""
import argparse
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import NormalDist

NORMAL = NormalDist()
ALPHA = 0.05
TARGET_POWER = 0.80
CRITICAL_Z = NORMAL.inv_cdf(1 - ALPHA / 2)


def wilson(successes, n):
    p = successes / n
    denominator = 1 + CRITICAL_Z ** 2 / n
    center = (p + CRITICAL_Z ** 2 / (2 * n)) / denominator
    radius = CRITICAL_Z * math.sqrt(p * (1 - p) / n + CRITICAL_Z ** 2 / (4 * n ** 2)) / denominator
    return center - radius, center + radius


def compare(a_successes, a_n, b_successes, b_n):
    if min(a_successes, a_n - a_successes, b_successes, b_n - b_successes) < 10:
        raise ValueError("Too few successes/failures for this normal approximation; use an exact method.")
    a, b = a_successes / a_n, b_successes / b_n
    difference = b - a
    pooled = (a_successes + b_successes) / (a_n + b_n)
    se_null = math.sqrt(pooled * (1 - pooled) * (1 / a_n + 1 / b_n))
    z = difference / se_null
    a_low, a_high = wilson(a_successes, a_n)
    b_low, b_high = wilson(b_successes, b_n)
    # Newcombe combines independent Wilson limits without a continuity correction.
    interval = [difference - math.hypot(b - b_low, a_high - a),
                difference + math.hypot(b_high - b, a - a_low)]
    return {"difference": difference, "relative_lift": difference / a,
            "z": z, "p_value": math.erfc(abs(z) / math.sqrt(2)),
            "ci95_difference": interval}


def power(a_n, b_n, baseline, effect):
    """Normal power approximation: pooled null variance, unpooled alternative.

    This is prospective sensitivity at a specified effect, not observed-effect power.
    The null rejection boundary is evaluated at the expected pooled proportion.
    """
    treatment = baseline + effect
    pooled = (a_n * baseline + b_n * treatment) / (a_n + b_n)
    null_se = math.sqrt(pooled * (1 - pooled) * (1 / a_n + 1 / b_n))
    alt_se = math.sqrt(baseline * (1 - baseline) / a_n + treatment * (1 - treatment) / b_n)
    boundary = CRITICAL_Z * null_se
    return NORMAL.cdf((effect - boundary) / alt_se) + NORMAL.cdf((-effect - boundary) / alt_se)


def required_per_arm(baseline, effect):
    low, high = 1, 2
    while power(high, high, baseline, effect) < TARGET_POWER:
        high *= 2
        if high > 10 ** 10:
            raise ValueError("Requested effect requires more than 10 billion observations per arm.")
    while low < high:
        middle = (low + high) // 2
        if power(middle, middle, baseline, effect) >= TARGET_POWER:
            high = middle
        else:
            low = middle + 1
    return low


def detectable_effect(a_n, b_n, baseline):
    low, high = 0.0, 1 - baseline - 1e-9
    if power(a_n, b_n, baseline, high) < TARGET_POWER:
        return None
    for _ in range(70):
        middle = (low + high) / 2
        if power(a_n, b_n, baseline, middle) >= TARGET_POWER:
            high = middle
        else:
            low = middle
    return high


def analyze(path, baseline=0.10, effect=0.01):
    if not (0 < baseline < 1 and 0 < effect < 1 - baseline):
        raise ValueError("Require baseline in (0, 1) and effect in (0, 1-baseline).")
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        required = {"user_id", "variant", "converted", "exposed_at"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"Missing columns: {sorted(required - set(reader.fieldnames or []))}")
        rows = list(reader)
    if not rows:
        raise ValueError("Empty export.")
    ids = Counter()
    memberships = defaultdict(set)
    counts, conversions = Counter(), Counter()
    dates = defaultdict(Counter)
    times = []
    records = []
    for line, row in enumerate(rows, start=2):
        user, variant = row["user_id"], row["variant"]
        if not user or variant not in {"A", "B"} or row["converted"] not in {"0", "1"}:
            raise ValueError(f"Invalid user, A/B variant, or binary outcome at CSV line {line}.")
        timestamp = datetime.fromisoformat(row["exposed_at"])
        if timestamp.tzinfo is None:
            raise ValueError(f"Timezone missing at CSV line {line}.")
        timestamp = timestamp.astimezone(timezone.utc)
        outcome = int(row["converted"])
        ids[user] += 1
        memberships[user].add(variant)
        counts[variant] += 1
        conversions[variant] += outcome
        dates[timestamp.date().isoformat()][variant] += 1
        times.append(timestamp)
        records.append((timestamp, variant, outcome))
    duplicate_users = sum(n > 1 for n in ids.values())
    cross_variant_users = sum(len(groups) > 1 for groups in memberships.values())
    if duplicate_users:
        raise ValueError(f"{duplicate_users} duplicate users; {cross_variant_users} cross-variant users. Resolve the user-level design before testing.")
    if set(counts) != {"A", "B"}:
        raise ValueError("Exactly two variants A and B are required.")
    n_a, n_b = counts["A"], counts["B"]
    result = compare(conversions["A"], n_a, conversions["B"], n_b)
    total = n_a + n_b
    # Pearson chi-square with one degree of freedom for the assumed 50:50 split.
    srm_chi2 = (n_a - total / 2) ** 2 / (total / 2) + (n_b - total / 2) ** 2 / (total / 2)
    srm_p = math.erfc(math.sqrt(srm_chi2 / 2))
    needed = required_per_arm(baseline, effect)
    additional = {"A": max(0, needed - n_a), "B": max(0, needed - n_b)}
    first, last = min(times), max(times)
    weeks = []
    for week in range(((last.date() - first.date()).days // 7) + 1):
        group = {v: {"n": 0, "conversions": 0} for v in ("A", "B")}
        for timestamp, variant, outcome in records:
            if (timestamp.date() - first.date()).days // 7 == week:
                group[variant]["n"] += 1
                group[variant]["conversions"] += outcome
        weeks.append(group)
    return {"input": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "primary_metric": "user-level binary conversion rate",
            "variants": {v: {"n": counts[v], "conversions": conversions[v],
                                "rate": conversions[v] / counts[v]} for v in ("A", "B")},
            "first_exposure_utc": first.isoformat(), "last_exposure_utc": last.isoformat(),
            "elapsed_days": (last - first).total_seconds() / 86400,
            "calendar_days_with_exposures": len(dates), "daily_counts": dict(sorted(dates.items())),
            "weekly_descriptive": weeks,
            "duplicate_users": duplicate_users, "cross_variant_users": cross_variant_users,
            "srm_assumed_allocation": "50:50", "srm_chi2": srm_chi2, "srm_p_value": srm_p,
            "test": "two-sided pooled two-proportion z-test", "ci_method": "Newcombe-Wilson",
            "alpha": ALPHA, **result,
            "power": {"baseline": baseline, "absolute_effect": effect, "target": TARGET_POWER,
                      "current": power(n_a, n_b, baseline, effect),
                      "current_mde": detectable_effect(n_a, n_b, baseline),
                      "required_per_arm": needed, "additional_per_arm": additional,
                      "additional_total": sum(additional.values())}}


def report(r, synthetic):
    a, b, p = r["variants"]["A"], r["variants"]["B"], r["power"]
    low, high = r["ci95_difference"]
    verdict = "Keep running; no winner yet" if r["p_value"] >= ALPHA else "Statistically significant difference; review the stopping plan before calling a winner"
    interpretation = ("The example does not establish a winner or equivalence: the interval allows both harm and benefit."
                      if r["p_value"] >= ALPHA else
                      "The difference is statistically significant under the stated fixed-horizon assumptions; significance alone does not establish practical value or validate the experiment design.")
    provenance = ("SYNTHETIC DEMONSTRATION ONLY. No actual test export was present. These results cannot identify a winner in your real experiment."
                  if synthetic else "User-selected export. Randomization, primary-metric selection, outcome maturity, and stopping rules require confirmation outside the CSV.")
    week_lines = []
    for i, week in enumerate(r["weekly_descriptive"], start=1):
        cells = []
        for v in ("A", "B"):
            n, successes = week[v]["n"], week[v]["conversions"]
            cells.append(f"{v}: {successes}/{n} ({successes / n:.2%})" if n else f"{v}: no users")
        week_lines.append(f"- Week {i}: " + "; ".join(cells))
    mde = p["current_mde"]
    mde_text = f"{100 * mde:.2f} percentage points ({mde / p['baseline']:.1%} relative)" if mde is not None else "not attainable at this sample size"
    return f"""# A/B test verdict: {verdict}

{provenance}

B converts at {b['rate']:.2%} versus A at {a['rate']:.2%}: a **{100 * r['difference']:+.2f} percentage-point difference** ({r['relative_lift']:+.1%} relative lift). The two-sided pooled two-proportion z-test gives **p = {r['p_value']:.4f}** (z = {r['z']:.3f}); the **95% Newcombe-Wilson confidence interval for B minus A is [{100 * low:+.2f}, {100 * high:+.2f}] percentage points**. {interpretation}

| Variant | Unique users | Conversions | Conversion rate |
|---|---:|---:|---:|
| A (control) | {a['n']:,} | {a['conversions']:,} | {a['rate']:.2%} |
| B (treatment) | {b['n']:,} | {b['conversions']:,} | {b['rate']:.2%} |

## Design and quality checks

- Two variants; one row per user; primary metric is `converted`, a 0/1 outcome. In the synthetic scenario it means conversion during the initial session, fully observed. This definition is an assumption supplied by the example, not inferable from column names alone.
- Exposure range: {r['first_exposure_utc']} to {r['last_exposure_utc']}; {r['elapsed_days']:.4f} elapsed days across {r['calendar_days_with_exposures']} UTC calendar dates. These are observed exposure bounds, not proof of the configured start/end or final outcome window.
- Duplicate user IDs: {r['duplicate_users']}; users in both variants: {r['cross_variant_users']}.
- Allocation: {a['n']}:{b['n']}; assuming planned 50:50, Pearson sample-ratio chi-square = {r['srm_chi2']:.3f}, df = 1, p = {r['srm_p_value']:.4f}. No overall mismatch signal; this does not prove correct randomization. Daily counts are in `analysis_results.json`.
- Each group has at least 10 successes and failures; the large-sample proportion test is appropriate under independent user randomization. Missing/invalid outcomes, missing timezones, repeated users, sparse outcomes, or other variant labels stop this script rather than being silently removed.

## Power and sample-size planning

Assume two-sided alpha = {ALPHA}, {TARGET_POWER:.0%} target power, independent users, equal allocation, a {p['baseline']:.0%} planning baseline, and a minimum worthwhile improvement of **{100 * p['absolute_effect']:.1f} percentage point** ({p['absolute_effect'] / p['baseline']:.0%} relative). This is an illustrative business threshold, not one established from real costs or revenue.

At the current sample, approximate power to detect that specified effect is **{p['current']:.1%}**. The effect detectable with 80% power is approximately **{mde_text}**. Approximately **{p['required_per_arm']:,} users per variant** are needed for the chosen minimum effect: **{p['additional_per_arm']['A']:,} more A users and {p['additional_per_arm']['B']:,} more B users**, **{p['additional_total']:,} more in total**. These are normal-approximation planning estimates, using pooled null and unpooled alternative variances; no continuity correction. This is prospective sensitivity, not retrospective power calculated from the observed lift.

## Interpretation risks

The example spans two weekly cycles with no missing exposure dates, but 14 days is not a universal sufficiency rule. Real conversion delays, business cycles, and exposure timing can require longer. Independent user assignment, stable tracking, a common conversion window, and fully matured outcomes must be checked in the real experiment.

Weekly conversion rates below are descriptive only; the sample is too small to rule out novelty or time-varying effects. They are not additional winner tests.

{chr(10).join(week_lines)}

There is one visible outcome and one A/B comparison, so no within-export multiple-comparison adjustment was made. Other metrics, segment searches, concurrent experiments, or prior comparisons cannot be ruled out. The CSV cannot reveal whether results were repeatedly checked or whether the metric was chosen after looking. The reported p-value and interval assume a single planned fixed-horizon analysis. **Do not simply continue checking until p < 0.05**: agree on the effect threshold and stopping rule before further data collection; if this was an unplanned look, use a valid sequential design or a fresh confirmatory test. The required sample above is a planning estimate, not a correction for earlier peeking.

## Reproduce

```bash
python3 analyze_ab.py synthetic_ab_test.csv --synthetic
python3 verify_analysis.py
```

No third-party packages are required (run with Python 3.14.4). `generate_sample.py` uses seed 20261007 and fixed totals to create the demonstration; it refuses to overwrite an existing CSV. Synthetic outcomes and assignments are shuffled; the observed lift was deliberately set for demonstration, not obtained from a real experiment. `analyze_ab.py` reads its input only and writes `analysis_results.json` and `verdict.md`; it never rewrites the input. For a selected real CSV with the same schema, explicitly pass its path and omit `--synthetic`. Specify the planning assumptions with `--baseline 0.10 --effect 0.01`; effect is an absolute proportion difference. Confirm the actual variant labels, primary metric, allocation and outcome definition first. Continuous metrics or more than two variants require a different analysis.

Methods references: [pooled two-proportion z-test](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.proportions_ztest.html), [independent-proportion confidence intervals](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.confint_proportions_2indep.html), and [normal-approximation power with null/alternative variances](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.power_proportions_2indep.html). The code implements the formulas directly in the standard library.

Input SHA-256: `{r['sha256']}`.
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--baseline", type=float, default=0.10)
    parser.add_argument("--effect", type=float, default=0.01)
    parser.add_argument("--synthetic", action="store_true", help="Label all results as synthetic demonstration")
    args = parser.parse_args()
    output_dir = Path(__file__).resolve().parent
    outputs = [output_dir / "analysis_results.json", output_dir / "verdict.md"]
    if args.input.resolve() in [p.resolve() for p in outputs]:
        raise ValueError("Input must differ from output paths.")
    result = analyze(args.input, args.baseline, args.effect)
    result["synthetic"] = args.synthetic
    outputs[0].write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    outputs[1].write_text(report(result, args.synthetic), encoding="utf-8")
    print(json.dumps({"synthetic": args.synthetic, "p_value": result["p_value"],
                      "ci95_difference": result["ci95_difference"], "power": result["power"]}, indent=2))


if __name__ == "__main__":
    main()
