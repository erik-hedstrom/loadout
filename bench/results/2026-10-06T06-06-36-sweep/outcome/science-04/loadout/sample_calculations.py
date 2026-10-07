"""SYNTHETIC UV–Vis example with deliberate audit defects; do not use as analysis.

Each E-tag isolates one mistake using otherwise correct nominal inputs so that
downstream errors are not double-counted. Standard library only for reproducibility.
"""

import csv
import json
import math
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent
data = json.loads((ROOT / "sample_inputs.json").read_text())
with (ROOT / "sample_calibration.csv").open(newline="") as stream:
    standards = list(csv.DictReader(stream))

# Exact SI defining constants, checked against the linked references in the report.
LIGHT_SPEED_M_S = 299792458.0
PLANCK_J_S = 6.62607015e-34
ELECTRON_VOLT_J = 1.602176634e-19
AVOGADRO_PER_MOL = 6.02214076e23
lam = data["wavelength"]["value"]
ulam = data["wavelength"]["standard_uncertainty"]
results = {}

results["E01_wavenumber_cm_inverse"] = 1e9 / lam  # E01: nm reciprocal labeled cm^-1
results["E02_frequency_Hz"] = LIGHT_SPEED_M_S / lam  # E02: SI speed divided by nm number
results["E03_photon_energy_J"] = PLANCK_J_S * LIGHT_SPEED_M_S / lam  # E03: missing nm to m
energy_J = PLANCK_J_S * LIGHT_SPEED_M_S / (lam * 1e-9)
results["E04_energy_kJ_per_mol"] = energy_J / 1000  # E04: per-photon energy labeled per mole
results["E05_u_wavenumber_cm_inverse"] = 1e7 / ulam  # E05: reciprocal applied to uncertainty

i0 = data["reference_intensity"]["value"]
it = data["transmitted_intensity"]["value"]
ui0 = data["reference_intensity"]["standard_uncertainty"]
uit = data["transmitted_intensity"]["standard_uncertainty"]
transmittance = it / i0
results["E06_absorbance"] = -math.log(transmittance)  # E06: ln used with decadic absorptivity
results["E07_u_absorbance"] = math.hypot(ui0 / i0, uit / it)  # E07: log10 derivative missing

raw = data["sample_absorbance"]["value"]
blank = data["blank_absorbance"]["value"]
us = data["sample_absorbance"]["independent_standard_uncertainty"]
ub = data["blank_absorbance"]["independent_standard_uncertainty"]
ud = data["shared_absorbance_offset"]["standard_uncertainty"]
us_total = math.hypot(us, ud)
ub_total = math.hypot(ub, ud)
corrected_absorbance = raw - blank
results["E08_u_blank_corrected"] = math.hypot(us_total, ub_total)  # E08: common offset treated independent
results["E09_u_blank_corrected"] = us  # E09: blank's independent uncertainty omitted

epsilon = data["molar_absorptivity"]["value"]
uepsilon = data["molar_absorptivity"]["standard_uncertainty"]
path_mm = data["path_length"]["value"]
path_cm = path_mm / 10
results["E10_concentration_umol_per_L"] = corrected_absorbance / (epsilon * path_mm) * 1e6  # E10: mm used with cm absorptivity
results["E11_u_path_mm"] = data["path_length"]["expanded_uncertainty"]  # E11: expanded U used as standard u
c_um = corrected_absorbance / (epsilon * path_cm) * 1e6
ua = math.hypot(us, ub)
ul_cm = data["path_length"]["standard_uncertainty"] / 10
results["E12_u_concentration_umol_per_L"] = c_um * (ua / corrected_absorbance + uepsilon / epsilon + ul_cm / path_cm)  # E12: relative errors added linearly
results["E13_u_concentration_umol_per_L"] = math.sqrt(ua**2 + uepsilon**2 + ul_cm**2)  # E13: unlike absolute units combined

vf = data["final_volume"]["value"]
va = data["aliquot_volume"]["value"]
avf = data["final_volume"]["half_width"]
ava = data["aliquot_volume"]["half_width"]
dilution = vf / va
results["E14_u_dilution"] = dilution * math.hypot(avf / vf, ava / va)  # E14: rectangular limits used as standard u

x = [float(row["concentration_umol_per_L"]) for row in standards]
y = [float(row["raw_absorbance"]) for row in standards]
sigma = [float(row["standard_uncertainty_absorbance"]) for row in standards]
slope, intercept = statistics.linear_regression(x, y)
xbar = statistics.mean(x)
sxx = sum((xi - xbar)**2 for xi in x)
variance = sigma[0]**2
cov_mm = variance / sxx
cov_bb = variance * (1 / len(x) + xbar**2 / sxx)
cov_mb = -variance * xbar / sxx
chi2 = sum(((yi - slope * xi - intercept) / si)**2 for xi, yi, si in zip(x, y, sigma))
reduced_chi2 = chi2 / (len(x) - 2)
results["E15_u_slope"] = math.sqrt(cov_mm * reduced_chi2)  # E15: rescaling despite known absolute sigma
results["E15_u_intercept"] = math.sqrt(cov_bb * reduced_chi2)
unknown_a = data["calibration_unknown"]["value"]
unknown_u = data["calibration_unknown"]["standard_uncertainty"]
unknown_c = (unknown_a - intercept) / slope
results["E16_u_calibration_concentration_umol_per_L"] = math.sqrt((unknown_u / slope)**2 + (unknown_c / slope)**2 * cov_mm + cov_bb / slope**2)  # E16: slope/intercept covariance discarded
results["E17_u_calibration_concentration_umol_per_L"] = unknown_u / slope  # E17: fit uncertainty omitted altogether
repeat = data["repeatability_example"]["values"]
results["E18_u_mean_absorbance"] = statistics.pstdev(repeat) / math.sqrt(len(repeat))  # E18: population SD used for estimated sample variance

if __name__ == "__main__":
    print(json.dumps(results, indent=2))
