"""Numerical invariants, user-level integrity checks, and input immutability."""
import csv
import hashlib
import json
import math
import tempfile
from pathlib import Path

from analyze_ab import analyze, compare, power, required_per_arm, wilson


def main():
    root = Path(__file__).resolve().parent
    path = root / "synthetic_ab_test.csv"
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    r = analyze(path)
    saved = json.loads((root / "analysis_results.json").read_text())
    assert r["sha256"] == before == hashlib.sha256(path.read_bytes()).hexdigest()
    assert saved["sha256"] == before
    for key in ("p_value", "ci95_difference", "power", "variants"):
        assert saved[key] == r[key], key
    assert r["variants"]["A"] == {"n": 2000, "conversions": 200, "rate": 0.10}
    assert r["variants"]["B"] == {"n": 2000, "conversions": 230, "rate": 0.115}
    assert r["calendar_days_with_exposures"] == 14
    assert r["duplicate_users"] == r["cross_variant_users"] == 0
    assert r["srm_p_value"] == 1.0
    # An independent Pearson 2x2 calculation must equal the square of the z-test.
    observed = ((200, 1800), (230, 1770))
    expected = (215, 1785)
    chi2 = sum((cell - expected[j]) ** 2 / expected[j]
               for row in observed for j, cell in enumerate(row))
    assert math.isclose(chi2, r["z"] ** 2, rel_tol=1e-12)
    assert math.isclose(r["p_value"], math.erfc(math.sqrt(chi2 / 2)), rel_tol=1e-12)
    # Wilson endpoints have known closed forms at zero and all successes.
    assert abs(wilson(0, 100)[0]) < 1e-15
    assert math.isclose(wilson(100, 100)[1], 1.0)
    swapped = compare(230, 2000, 200, 2000)
    assert math.isclose(swapped["p_value"], r["p_value"])
    assert math.isclose(swapped["ci95_difference"][0], -r["ci95_difference"][1])
    assert math.isclose(swapped["ci95_difference"][1], -r["ci95_difference"][0])
    assert math.isclose(power(2000, 2000, 0.10, 0.0), 0.05, abs_tol=1e-12)
    needed = required_per_arm(0.10, 0.01)
    assert power(needed - 1, needed - 1, 0.10, 0.01) < 0.80
    assert power(needed, needed, 0.10, 0.01) >= 0.80
    assert math.isclose(power(2000, 2000, 0.10, r["power"]["current_mde"]), 0.80)
    assert r["power"]["additional_total"] == 2 * (needed - 2000)
    # Contamination must fail before significance is calculated.
    with path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        fields, rows = reader.fieldnames, list(reader)
    with tempfile.TemporaryDirectory(dir=root) as temporary:
        invalid = Path(temporary) / "invalid.csv"
        for cross_variant in (False, True):
            added = dict(rows[0])
            if cross_variant:
                added["variant"] = "B" if added["variant"] == "A" else "A"
            with invalid.open("w", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=fields)
                writer.writeheader()
                writer.writerows(rows + [added])
            try:
                analyze(invalid)
            except ValueError as error:
                assert "1 duplicate users" in str(error)
                assert f"{int(cross_variant)} cross-variant users" in str(error)
            else:
                raise AssertionError("Repeated user accepted.")
    print("PASS: counts, saved results, input hash, Pearson/z agreement, CI symmetry, power thresholds, duplicate and cross-variant rejection.")


if __name__ == "__main__":
    main()
