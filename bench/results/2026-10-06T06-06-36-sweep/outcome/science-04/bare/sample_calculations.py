"""SYNTHETIC, deliberately flawed calculations; never use for experimental analysis."""

import csv
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def calculate():
    p = json.loads((ROOT / "sample_inputs.json").read_text())
    h, c0, na = 6.62607015e-34, 299792458.0, 6.02214076e23
    wavelength = p["wavelength_nm"]
    wavenumber_cm_inv = 1e9 / wavelength
    frequency_Hz = c0 / wavelength
    energy_eV = h * c0 / (wavelength * 1e-9)
    molar_energy_kJ_mol = energy_eV * na
    u_wavenumber_cm_inv = p["u_wavelength_nm"] / wavelength

    t = p["transmission_example"]
    transmittance = t["transmitted_counts"] / t["incident_counts"]
    absorbance_from_counts = -math.log(transmittance)
    absorbance_from_percent = -math.log10(t["transmittance_percent"])
    u_transmittance = math.hypot(t["u_transmitted_counts"], t["u_incident_counts"]) / t["incident_counts"]
    u_absorbance_from_counts = u_transmittance / transmittance

    absorbance_net = p["absorbance_raw"] - p["absorbance_blank"]
    u_absorbance_net = math.sqrt(p["u_absorbance_raw"]**2 - p["u_absorbance_blank"]**2)
    concentration_M = absorbance_net / (p["epsilon_L_mol_cm"] * p["path_length_mm"])
    u_concentration_M = concentration_M * (u_absorbance_net / absorbance_net + p["u_epsilon_L_mol_cm"] / p["epsilon_L_mol_cm"] + p["u_path_length_mm"] / p["path_length_mm"])
    concentration_report = f"{concentration_M:.12f} +/- {u_concentration_M:.12f} mol/L"

    with (ROOT / "sample_calibration.csv").open(newline="") as handle:
        rows = list(csv.DictReader(handle))
    x = [float(row["concentration_umol_L"]) for row in rows]
    y = [float(row["raw_absorbance"]) for row in rows]
    xbar, ybar = sum(x) / len(x), sum(y) / len(y)
    sxx = sum((v - xbar)**2 for v in x)
    slope = sum((a - xbar) * (b - ybar) for a, b in zip(x, y)) / sxx
    intercept = ybar - slope * xbar
    slope_report = f"{slope:.10f} L mol^-1"
    concentration_calibration_M = (p["absorbance_raw"] - intercept) / slope
    concentration_double_blank_umol_L = (absorbance_net - intercept) / slope
    u_calibration_umol_L = p["u_absorbance_raw"] / slope

    repeat = p["repeat_example"]
    n_repeat = len(repeat["raw_absorbances"])
    mean_net_absorbance = sum(repeat["raw_absorbances"]) / n_repeat - repeat["shared_blank"]
    u_mean_net_absorbance = math.sqrt((repeat["u_each_raw_absorbance"]**2 + repeat["u_shared_blank"]**2) / n_repeat)

    return {key: value for key, value in locals().items() if key in (
        "wavenumber_cm_inv", "frequency_Hz", "energy_eV", "molar_energy_kJ_mol",
        "u_wavenumber_cm_inv", "transmittance", "absorbance_from_counts",
        "absorbance_from_percent", "u_transmittance", "u_absorbance_from_counts",
        "absorbance_net", "u_absorbance_net", "concentration_M", "u_concentration_M",
        "concentration_report", "slope_report", "intercept", "concentration_calibration_M",
        "concentration_double_blank_umol_L", "u_calibration_umol_L",
        "mean_net_absorbance", "u_mean_net_absorbance"
    )}


if __name__ == "__main__":
    print(json.dumps(calculate(), indent=2))
