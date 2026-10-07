"""Reproduce the synthetic spectroscopy audit with the Python standard library.

Units are checked explicitly at boundaries and by the dimensional table in the
report. This is not a replacement for Pint. No user input file is modified.
"""

import csv
import json
import math
import random
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LIGHT_SPEED_M_S = 299792458.0
PLANCK_J_S = 6.62607015e-34
ELECTRON_VOLT_J = 1.602176634e-19
AVOGADRO_PER_MOL = 6.02214076e23


def weighted_line(x, y, sigma):
    """Return (slope, intercept), absolute covariance, and chi-square.

    Known independent y standard uncertainties and exact x are assumptions of
    this model. Centering x avoids cancellation in the normal equations.
    """
    if not (len(x) == len(y) == len(sigma) and len(x) > 2):
        raise ValueError("Need equal-length arrays and more than two standards")
    if any(s <= 0 for s in sigma):
        raise ValueError("Standard uncertainties must be positive")
    w = [1 / s**2 for s in sigma]
    sw = sum(w)
    xbar = sum(wi * xi for wi, xi in zip(w, x)) / sw
    ybar = sum(wi * yi for wi, yi in zip(w, y)) / sw
    sxx = sum(wi * (xi - xbar)**2 for wi, xi in zip(w, x))
    if sxx <= 0:
        raise ValueError("Standards must span multiple concentrations")
    slope = sum(wi * (xi - xbar) * (yi - ybar) for wi, xi, yi in zip(w, x, y)) / sxx
    intercept = ybar - slope * xbar
    covariance = [[1 / sxx, -xbar / sxx], [-xbar / sxx, 1 / sw + xbar**2 / sxx]]
    chi2 = sum(((yi - slope * xi - intercept) / si)**2 for xi, yi, si in zip(x, y, sigma))
    return (slope, intercept), covariance, chi2


def derivative(function, values, index):
    step = 1e-5 * max(abs(values[index]), 1e-3)
    lower, upper = list(values), list(values)
    lower[index] -= step
    upper[index] += step
    return (function(*upper) - function(*lower)) / (2 * step)


def main():
    data = json.loads((ROOT / "sample_inputs.json").read_text())
    expected_units = {
        "wavelength": "nm", "reference_intensity": "count",
        "transmitted_intensity": "count", "sample_absorbance": "dimensionless",
        "blank_absorbance": "dimensionless", "shared_absorbance_offset": "dimensionless",
        "molar_absorptivity": "L mol^-1 cm^-1", "path_length": "mm",
        "final_volume": "mL", "aliquot_volume": "mL", "calibration_unknown": "dimensionless",
    }
    for key, unit in expected_units.items():
        if data[key]["unit"] != unit:
            raise ValueError(f"{key}: expected {unit}; explicitly convert before using this script")
    if data["wavelength"]["basis"] != "vacuum":
        raise ValueError("Medium wavelength requires a refractive-index model")
    if data["molar_absorptivity"]["logarithm"] != "decadic":
        raise ValueError("This measurement model requires decadic absorptivity")

    lam_nm = data["wavelength"]["value"]
    ulam_nm = data["wavelength"]["standard_uncertainty"]
    lam_m = lam_nm * 1e-9
    wn_cm = 1e7 / lam_nm
    frequency_Hz = LIGHT_SPEED_M_S / lam_m
    energy_J = PLANCK_J_S * frequency_Hz
    energy_eV = energy_J / ELECTRON_VOLT_J
    energy_kJ_mol = energy_J * AVOGADRO_PER_MOL / 1000
    wavelength_relative_u = ulam_nm / lam_nm

    i0 = data["reference_intensity"]["value"]
    it = data["transmitted_intensity"]["value"]
    ui0 = data["reference_intensity"]["standard_uncertainty"]
    uit = data["transmitted_intensity"]["standard_uncertainty"]
    rho = data["intensity_correlation"]
    intensity_A = math.log10(i0 / it)
    intensity_uA = math.sqrt((ui0 / i0)**2 + (uit / it)**2 - 2 * rho * ui0 * uit / (i0 * it)) / math.log(10)

    raw = data["sample_absorbance"]["value"]
    blank = data["blank_absorbance"]["value"]
    us = data["sample_absorbance"]["independent_standard_uncertainty"]
    ub = data["blank_absorbance"]["independent_standard_uncertainty"]
    ud = data["shared_absorbance_offset"]["standard_uncertainty"]
    absorbance = raw - blank
    absorbance_u = math.hypot(us, ub)
    absorbance_cov = ud**2
    epsilon = data["molar_absorptivity"]["value"]
    uepsilon = data["molar_absorptivity"]["standard_uncertainty"]
    path_cm = data["path_length"]["value"] / 10
    upath_mm = data["path_length"]["expanded_uncertainty"] / data["path_length"]["coverage_factor"]
    upath_cm = upath_mm / 10
    concentration = absorbance / (epsilon * path_cm) * 1e6
    sensitivities = [1e6 / (epsilon * path_cm), -concentration / epsilon, -concentration / path_cm]
    components = [sensitivities[0] * absorbance_u, sensitivities[1] * uepsilon, sensitivities[2] * upath_cm]
    concentration_u = math.sqrt(sum(component**2 for component in components))

    vf = data["final_volume"]["value"]
    va = data["aliquot_volume"]["value"]
    avf = data["final_volume"]["half_width"]
    ava = data["aliquot_volume"]["half_width"]
    uvf, uva = avf / math.sqrt(3), ava / math.sqrt(3)
    dilution = vf / va
    dilution_u = dilution * math.hypot(uvf / vf, uva / va)
    stock = concentration * dilution
    stock_u = math.hypot(dilution * concentration_u, concentration * dilution_u)

    with (ROOT / "sample_calibration.csv").open(newline="") as stream:
        rows = list(csv.DictReader(stream))
    x = [float(row["concentration_umol_per_L"]) for row in rows]
    y = [float(row["raw_absorbance"]) for row in rows]
    sigma = [float(row["standard_uncertainty_absorbance"]) for row in rows]
    (m, b), cov, chi2 = weighted_line(x, y, sigma)
    unknown_a = data["calibration_unknown"]["value"]
    unknown_u = data["calibration_unknown"]["standard_uncertainty"]
    calibrated_c = (unknown_a - b) / m
    calibrated_variance = (unknown_u**2 + cov[1][1] + calibrated_c**2 * cov[0][0] + 2 * calibrated_c * cov[0][1]) / m**2
    calibrated_u = math.sqrt(calibrated_variance)
    fit_correlation = cov[0][1] / math.sqrt(cov[0][0] * cov[1][1])
    repeat = data["repeatability_example"]["values"]
    repeat_mean = statistics.mean(repeat)
    repeat_u = statistics.stdev(repeat) / math.sqrt(len(repeat))

    corrected = {
        "E01": {"value": wn_cm, "standard_uncertainty": wn_cm * wavelength_relative_u, "unit": "cm^-1"},
        "E02": {"value": frequency_Hz, "standard_uncertainty": frequency_Hz * wavelength_relative_u, "unit": "Hz"},
        "E03": {"value": energy_J, "standard_uncertainty": energy_J * wavelength_relative_u, "unit": "J/photon"},
        "E04": {"value": energy_kJ_mol, "standard_uncertainty": energy_kJ_mol * wavelength_relative_u, "unit": "kJ/mol"},
        "E05": {"value": wn_cm * wavelength_relative_u, "unit": "cm^-1 standard uncertainty"},
        "E06": {"value": intensity_A, "standard_uncertainty": intensity_uA, "unit": "dimensionless"},
        "E07": {"value": intensity_uA, "unit": "dimensionless standard uncertainty"},
        "E08": {"value": absorbance, "standard_uncertainty": absorbance_u, "unit": "dimensionless"},
        "E09": {"value": absorbance, "standard_uncertainty": absorbance_u, "unit": "dimensionless"},
        "E10": {"value": concentration, "standard_uncertainty": concentration_u, "unit": "umol/L"},
        "E11": {"value": upath_mm, "unit": "mm standard uncertainty"},
        "E12": {"value": concentration_u, "unit": "umol/L standard uncertainty"},
        "E13": {"value": concentration_u, "unit": "umol/L standard uncertainty"},
        "E14": {"value": dilution, "standard_uncertainty": dilution_u, "unit": "dimensionless"},
        "E15": {"slope": m, "u_slope": math.sqrt(cov[0][0]), "slope_unit": "L/umol", "intercept": b, "u_intercept": math.sqrt(cov[1][1]), "intercept_unit": "dimensionless"},
        "E16": {"value": calibrated_c, "standard_uncertainty": calibrated_u, "unit": "umol/L"},
        "E17": {"value": calibrated_c, "standard_uncertainty": calibrated_u, "unit": "umol/L"},
        "E18": {"value": repeat_mean, "standard_uncertainty": repeat_u, "unit": "dimensionless", "dof": 2},
        "E19": {"value": epsilon, "unit": "L mol^-1 cm^-1", "equivalent_value": epsilon / 10, "equivalent_unit": "L mol^-1 mm^-1"},
        "E20": {"value": stock, "standard_uncertainty": stock_u, "unit": "umol/L", "reported": f"{stock:.1f} +/- {stock_u:.1f} umol/L (combined standard uncertainty; no 95% coverage claim)"},
    }

    checks = []

    def verify(name, condition):
        if not condition:
            raise AssertionError(name)
        checks.append(name)

    verify("532 nm wavelength round trip from wavenumber", math.isclose(1 / wn_cm * 1e7, lam_nm))
    verify("frequency and wavelength round trip", math.isclose(LIGHT_SPEED_M_S / frequency_Hz, lam_m))
    verify("energy agreement via wavelength and frequency", math.isclose(energy_J, PLANCK_J_S * LIGHT_SPEED_M_S / lam_m))
    verify("molar energy conversion round trip", math.isclose(energy_kJ_mol * 1000 / AVOGADRO_PER_MOL, energy_J))
    verify("Beer-Lambert forward recovery", math.isclose(epsilon * concentration * 1e-6 * path_cm, absorbance))
    verify("mm and cm paths give same physical concentration", math.isclose(absorbance / ((epsilon / 10) * (path_cm * 10)) * 1e6, concentration))
    verify("shared blank covariance equals independent-source cancellation", math.isclose(us**2 + ud**2 + ub**2 + ud**2 - 2 * absorbance_cov, absorbance_u**2))
    direct_model = lambda a, e, l: a / (e * l) * 1e6
    for index, sensitivity in enumerate(sensitivities):
        verify(f"finite-difference direct sensitivity {index}", math.isclose(derivative(direct_model, [absorbance, epsilon, path_cm], index), sensitivity, rel_tol=1e-7))
    inverse_model = lambda a, slope, intercept: (a - intercept) / slope
    for index, sensitivity in enumerate([1 / m, -calibrated_c / m, -1 / m]):
        verify(f"finite-difference inverse-fit sensitivity {index}", math.isclose(derivative(inverse_model, [unknown_a, m, b], index), sensitivity, rel_tol=1e-7))
    ordinary_m, ordinary_b = statistics.linear_regression(x, y)
    verify("weighted fit agrees with independent library fit for constant sigma", math.isclose(m, ordinary_m) and math.isclose(b, ordinary_b))
    for row in range(2):
        for col in range(2):
            information = [[sum(xi**2 / si**2 for xi, si in zip(x, sigma)), sum(xi / si**2 for xi, si in zip(x, sigma))], [sum(xi / si**2 for xi, si in zip(x, sigma)), sum(1 / si**2 for si in sigma)]]
            product = sum(information[row][k] * cov[k][col] for k in range(2))
            verify(f"fit covariance inverse-information identity {row},{col}", math.isclose(product, float(row == col), abs_tol=1e-10))

    # Fixed-trial diagnostics across three seeds; not adaptive JCGM 101 validation.
    mc = []
    for seed in [20261007, 20261008, 20261009]:
        rng = random.Random(seed)
        stocks, concentrations = [], []
        um = math.sqrt(cov[0][0])
        conditional_b_u = math.sqrt(cov[1][1] - cov[0][1]**2 / cov[0][0])
        for _ in range(40000):
            shared = rng.gauss(0, ud)
            adraw = (rng.gauss(raw, us) + shared) - (rng.gauss(blank, ub) + shared)
            edraw = rng.gauss(epsilon, uepsilon)
            ldraw = rng.gauss(path_cm, upath_cm)
            vfd = rng.uniform(vf - avf, vf + avf)
            vad = rng.uniform(va - ava, va + ava)
            z1, z2 = rng.gauss(0, 1), rng.gauss(0, 1)
            md = m + um * z1
            bd = b + cov[0][1] / um * z1 + conditional_b_u * z2
            if min(edraw, ldraw, vfd, vad, md) <= 0:
                raise ValueError("Monte Carlo draw outside positive-domain measurement model")
            stocks.append(adraw / (edraw * ldraw) * 1e6 * vfd / vad)
            concentrations.append((rng.gauss(unknown_a, unknown_u) - bd) / md)
        entry = {"seed": seed, "trials": len(stocks)}
        for name, values, estimate, uncertainty in [("stock", stocks, stock, stock_u), ("calibration", concentrations, calibrated_c, calibrated_u)]:
            values.sort()
            sd = statistics.stdev(values)
            mean = statistics.mean(values)
            entry[name] = {"mean": mean, "standard_deviation": sd, "equal_tail_95_percent_diagnostic": [values[999], values[38999]], "unit": "umol/L"}
            verify(f"Monte Carlo {seed} {name} SD within 2.5% of first order", abs(sd / uncertainty - 1) < 0.025)
            verify(f"Monte Carlo {seed} {name} mean within 0.02 u of nominal", abs(mean - estimate) < 0.02 * uncertainty)
        mc.append(entry)

    budget = [{"input": name, "sensitivity": sensitivity, "standard_uncertainty": uncertainty, "signed_contribution_umol_per_L": component, "variance_fraction": component**2 / concentration_u**2} for name, sensitivity, uncertainty, component in zip(["blank-corrected absorbance", "molar absorptivity", "path length in cm"], sensitivities, [absorbance_u, uepsilon, upath_cm], components)]
    result = {
        "provenance": data["provenance"], "uncertainty_method": "first-order covariance propagation; all +/- values standard unless explicitly labeled otherwise",
        "corrected": corrected, "energy_eV": {"value": energy_eV, "standard_uncertainty": energy_eV * wavelength_relative_u},
        "direct_concentration_budget": budget,
        "calibration": {"parameter_order": ["slope", "intercept"], "covariance": cov, "correlation": fit_correlation, "chi_squared": chi2, "residual_dof": len(x) - 2, "reduced_chi_squared": chi2 / (len(x) - 2)},
        "monte_carlo_diagnostics": mc, "verification": {"passed": len(checks), "checks": checks},
        "limitations": "Pint, uncertainties, NumPy and SciPy unavailable; package installation failed due to DNS/network restriction. Closed-form standard-library WLS used, not SciPy execution. Monte Carlo is a fixed-trial diagnostic, not interval validation or proof of input PDFs."
    }
    (ROOT / "corrected_results.json").write_text(json.dumps(result, indent=2) + "\n")
    print(f"PASS: {len(checks)} numerical checks; 3 x 40000 Monte Carlo trials")
    print(f"Direct: {concentration:.6f} +/- {concentration_u:.6f} umol/L (standard)")
    print(f"Stock: {stock:.6f} +/- {stock_u:.6f} umol/L (standard)")
    print(f"Calibration: {calibrated_c:.6f} +/- {calibrated_u:.6f} umol/L (standard)")
    print(f"Python: {sys.version.split()[0]}; dependencies: standard library only")


if __name__ == "__main__":
    main()
