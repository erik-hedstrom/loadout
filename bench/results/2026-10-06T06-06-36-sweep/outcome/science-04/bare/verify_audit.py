"""Recompute the synthetic audit with Python's standard library; no source edits."""

import csv
import json
import math
from pathlib import Path

from sample_calculations import calculate

ROOT = Path(__file__).resolve().parent
H = 6.62607015e-34
C0 = 299792458.0
E_CHARGE = 1.602176634e-19
NA = 6.02214076e23


def quadratic_form(gradient, covariance):
    return sum(gradient[i] * covariance[i][j] * gradient[j]
               for i in range(len(gradient)) for j in range(len(gradient)))


def recompute():
    p = json.loads((ROOT / "sample_inputs.json").read_text())
    lam = p["wavelength_nm"] * 1e-9
    relative_lam = p["u_wavelength_nm"] / p["wavelength_nm"]
    wavenumber = 1 / (lam * 100)
    frequency = C0 / lam
    energy_j = H * frequency
    spectral = {
        "wavelength_nm": p["wavelength_nm"],
        "wavenumber_cm_inv": wavenumber,
        "u_wavenumber_cm_inv": wavenumber * relative_lam,
        "frequency_Hz": frequency,
        "u_frequency_Hz": frequency * relative_lam,
        "energy_J": energy_j,
        "u_energy_J": energy_j * relative_lam,
        "energy_eV": energy_j / E_CHARGE,
        "u_energy_eV": energy_j / E_CHARGE * relative_lam,
        "molar_energy_kJ_mol": energy_j * NA / 1000,
        "u_molar_energy_kJ_mol": energy_j * NA / 1000 * relative_lam,
    }
    t = p["transmission_example"]
    incident, transmitted = t["incident_counts"], t["transmitted_counts"]
    ratio = transmitted / incident
    cov_counts = t["correlation"] * t["u_incident_counts"] * t["u_transmitted_counts"]
    relative_ratio_variance = ((t["u_transmitted_counts"] / transmitted)**2
                              + (t["u_incident_counts"] / incident)**2
                              - 2 * cov_counts / (incident * transmitted))
    u_ratio = ratio * math.sqrt(relative_ratio_variance)
    absorbance_counts = -math.log10(ratio)
    u_absorbance_counts = u_ratio / (ratio * math.log(10))
    raw, blank = p["absorbance_raw"], p["absorbance_blank"]
    net = raw - blank
    u_net = math.hypot(p["u_absorbance_raw"], p["u_absorbance_blank"])
    ell = p["path_length_mm"] / 10
    u_ell = p["u_path_length_mm"] / 10
    epsilon = p["epsilon_L_mol_cm"]
    concentration = net / (epsilon * ell)
    u_concentration = concentration * math.sqrt((u_net / net)**2
                         + (p["u_epsilon_L_mol_cm"] / epsilon)**2 + (u_ell / ell)**2)

    with (ROOT / "sample_calibration.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    x = [float(row["concentration_umol_L"]) for row in rows]
    y = [float(row["raw_absorbance"]) for row in rows]
    n = len(x)
    xbar, ybar = sum(x) / n, sum(y) / n
    sxx = sum((v - xbar)**2 for v in x)
    m = sum((a - xbar) * (b - ybar) for a, b in zip(x, y)) / sxx
    b = ybar - m * xbar
    residuals = [yi - (m * xi + b) for xi, yi in zip(x, y)]
    s2 = sum(r * r for r in residuals) / (n - 2)
    vm, vb, cmb = s2 / sxx, s2 * (1 / n + xbar**2 / sxx), -xbar * s2 / sxx
    x_unknown = (raw - b) / m
    fit_variance = (vb + x_unknown**2 * vm + 2 * x_unknown * cmb) / m**2
    v_unknown = p["u_absorbance_raw"]**2 / m**2 + fit_variance
    u_unknown = math.sqrt(v_unknown)
    repeat = p["repeat_example"]
    nr = len(repeat["raw_absorbances"])
    repeat_mean = sum(repeat["raw_absorbances"]) / nr - repeat["shared_blank"]
    u_repeat_mean = math.sqrt(repeat["u_each_raw_absorbance"]**2 / nr
                             + repeat["u_shared_blank"]**2)

    # Verify dimensional equivalence using a completely SI expression.
    epsilon_si = epsilon * 0.1
    concentration_si = net / (epsilon_si * (ell / 100))
    assert math.isclose(concentration_si / 1000, concentration, rel_tol=1e-12)
    assert math.isclose(C0 * wavenumber * 100, frequency, rel_tol=1e-12)
    assert math.isclose(-math.log(ratio) / math.log(10), absorbance_counts, rel_tol=1e-12)
    # Independent Jacobian checks guard against omitted covariance and derivative factors.
    g_counts = [-1 / (transmitted * math.log(10)), 1 / (incident * math.log(10))]
    counts_cov = [[t["u_transmitted_counts"]**2, cov_counts],
                  [cov_counts, t["u_incident_counts"]**2]]
    assert math.isclose(quadratic_form(g_counts, counts_cov), u_absorbance_counts**2, rel_tol=1e-12)
    cal_cov = [[p["u_absorbance_raw"]**2, 0, 0], [0, vb, cmb], [0, cmb, vm]]
    cal_g = [1 / m, -1 / m, -x_unknown / m]
    assert math.isclose(quadratic_form(cal_g, cal_cov), v_unknown, rel_tol=1e-12)
    closed_form = (p["u_absorbance_raw"]**2 + s2 * (1 / n + (x_unknown - xbar)**2 / sxx)) / m**2
    assert math.isclose(closed_form, v_unknown, rel_tol=1e-12)
    # One common blank must cancel from raw-signal inverse calibration.
    assert math.isclose(((raw - blank) - (b - blank)) / m, x_unknown, rel_tol=1e-12)
    # The blank remains an uncertainty floor even with many independent raw readings.
    covariance_repeats = [[repeat["u_each_raw_absorbance"]**2 + repeat["u_shared_blank"]**2
                          if i == j else repeat["u_shared_blank"]**2
                          for j in range(nr)] for i in range(nr)]
    assert math.isclose(quadratic_form([1 / nr] * nr, covariance_repeats), u_repeat_mean**2, rel_tol=1e-12)
    # Independent finite differences check each nonlinear calibration sensitivity.
    args = [raw, b, m]
    for i, analytic in enumerate(cal_g):
        step = 1e-5 * max(abs(args[i]), 0.01)
        plus, minus = args.copy(), args.copy()
        plus[i] += step
        minus[i] -= step
        numeric = (((plus[0] - plus[1]) / plus[2]) - ((minus[0] - minus[1]) / minus[2])) / (2 * step)
        assert math.isclose(numeric, analytic, rel_tol=1e-7)

    return {
        "provenance": "SYNTHETIC DATA ONLY; all uncertainties are standard uncertainties (k=1)",
        "spectral": spectral,
        "transmission": {"transmittance": ratio, "u_transmittance": u_ratio,
                         "absorbance": absorbance_counts, "u_absorbance": u_absorbance_counts,
                         "u_absorbance_if_independent": math.hypot(t["u_transmitted_counts"] / transmitted,
                                      t["u_incident_counts"] / incident) / math.log(10)},
        "beer_lambert": {"net_absorbance": net, "u_net_absorbance": u_net,
                         "path_length_cm": ell, "u_path_length_cm": u_ell,
                         "epsilon_m2_mol": epsilon_si, "concentration_M": concentration,
                         "u_concentration_M": u_concentration,
                         "concentration_umol_L": concentration * 1e6,
                         "u_concentration_umol_L": u_concentration * 1e6},
        "calibration": {"n": n, "residual_degrees_of_freedom": n - 2,
                        "slope_per_umol_L": m, "slope_L_mol": m * 1e6, "intercept": b,
                        "residuals": residuals, "residual_standard_deviation": math.sqrt(s2),
                        "slope_variance": vm, "intercept_variance": vb, "slope_intercept_covariance": cmb,
                        "concentration_umol_L": x_unknown, "u_concentration_umol_L": u_unknown,
                        "u_fit_component_umol_L": math.sqrt(fit_variance),
                        "u_if_slope_intercept_covariance_omitted_umol_L": math.sqrt(
                            (p["u_absorbance_raw"]**2 + vb + x_unknown**2 * vm) / m**2)},
        "shared_blank": {"mean_net_absorbance": repeat_mean, "u_mean_net_absorbance": u_repeat_mean},
        "flawed_results": calculate(),
        "verification": "PASS: 8 analytic/dimensional/covariance checks and 3 finite-difference sensitivity checks"
    }


if __name__ == "__main__":
    result = recompute()
    (ROOT / "audit_results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
