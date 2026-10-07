"""Independent numerical and input-integrity checks; Python 3.12+."""
import csv
import hashlib
import json
import math
import random
import sys
import tempfile
from pathlib import Path
from statistics import NormalDist

from analysis import analyze, conversion_test, mde, power, required_n


def main():
    data = Path("synthetic_ab_test.csv")
    design = Path("synthetic_design.json")
    before = hashlib.sha256(data.read_bytes()).hexdigest()
    result, _ = analyze(data, design)
    with data.open(newline="") as stream:
        rows = list(csv.DictReader(stream))

    # Pearson's 2x2 chi-square provides an independent route to the pooled z p-value.
    table = [[50, 450], [65, 435]]
    row_totals = [sum(row) for row in table]
    col_totals = [sum(row[j] for row in table) for j in range(2)]
    total = sum(row_totals)
    chi_square = 0.0
    for i in range(2):
        for j in range(2):
            expected = row_totals[i]*col_totals[j]/total
            chi_square += (table[i][j]-expected)**2/expected
    assert math.isclose(chi_square, result["z"]**2, rel_tol=1e-12)
    assert math.isclose(math.erfc(math.sqrt(chi_square/2)), result["p_value"], rel_tol=1e-12)
    swapped = conversion_test(65, 500, 50, 500)
    assert math.isclose(swapped["ci95"][0], -result["ci95"][1], abs_tol=1e-12)
    assert math.isclose(swapped["ci95"][1], -result["ci95"][0], abs_tol=1e-12)
    assert conversion_test(50, 500, 50, 500)["p_value"] == 1

    target_n = required_n(0.10, 0.02)
    assert power(target_n-1, target_n-1, 0.10, 0.02) < 0.8
    assert power(target_n, target_n, 0.10, 0.02) >= 0.8
    detectable = mde(500, 500, 0.10)
    assert math.isclose(power(500,500,0.10,detectable), 0.8, abs_tol=1e-12)

    def rejects(invalid_rows):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"invalid.csv"
            with path.open("w", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(invalid_rows)
            try:
                analyze(path, design)
            except ValueError:
                return
            raise AssertionError("Invalid input was accepted")

    rejects(rows+[rows[0]])
    cross = dict(rows[0], variant="B" if rows[0]["variant"] == "A" else "A")
    rejects(rows+[cross])
    rejects([dict(rows[0], converted=""), *rows[1:]])
    rejects([dict(rows[0], observed_at=rows[0]["assigned_at"]), *rows[1:]])
    rejects([dict(rows[0], variant="C"), *rows[1:]])

    # Simulation applies the actual pooled z rejection rule, not the planning formula.
    rng = random.Random(9317)
    repetitions = 20000
    critical = NormalDist().inv_cdf(0.975)
    simulations = []
    for baseline, treatment in [(0.10, 0.10), (0.10, 0.12)]:
        rejected = 0
        for _ in range(repetitions):
            a = rng.binomialvariate(target_n, baseline)
            b = rng.binomialvariate(target_n, treatment)
            pooled = (a+b)/(2*target_n)
            se = math.sqrt(pooled*(1-pooled)*2/target_n)
            rejected += se > 0 and abs((b-a)/target_n/se) > critical
        estimate = rejected/repetitions
        expected = 0.05 if baseline == treatment else power(target_n,target_n,baseline,treatment-baseline)
        mc_se = math.sqrt(estimate*(1-estimate)/repetitions)
        assert abs(estimate-expected) < 0.015
        simulations.append({"baseline": baseline, "treatment": treatment,
                            "repetitions": repetitions, "seed_stream": 9317,
                            "rejection_rate": estimate,
                            "monte_carlo_95_ci": [estimate-1.96*mc_se, estimate+1.96*mc_se],
                            "expected_approximation": expected})
    assert hashlib.sha256(data.read_bytes()).hexdigest() == before
    Path("verification.json").write_text(json.dumps({
        "python": sys.version, "status": "passed",
        "checks": ["z-test agrees with Pearson chi-square", "CI sign symmetry", "equal rates p=1",
                   "required sample is minimum integer meeting approximate power", "MDE reaches 80%",
                   "duplicates/crossover/missing/immature/third-variant inputs rejected",
                   "simulation checks Type I error and target power", "input SHA256 unchanged"],
        "simulations": simulations, "input_sha256": before}, indent=2)+"\n")
    print("PASS: independent numerical checks, five invalid-input cases, input unchanged.")
    for simulation in simulations:
        print(f"Simulation {simulation['baseline']:.0%} -> {simulation['treatment']:.0%}: "
              f"rejection rate {simulation['rejection_rate']:.4f}, "
              f"Monte Carlo 95% CI {simulation['monte_carlo_95_ci']}")


if __name__ == "__main__":
    main()
