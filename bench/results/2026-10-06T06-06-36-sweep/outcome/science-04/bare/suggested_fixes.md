# Suggested fixes — not applied to the sample calculation source

All files in this exercise are synthetic. Preserve the flawed fixtures when reproducing the audit; use `verify_audit.py` for the corrected reference outputs. These suggestions describe how to repair the demonstrated calculations if adapting them to real data.

1. Convert wavelength once to metres for frequency and photon energy. Use `1e7 / wavelength_nm` for spectroscopic cm⁻¹. Keep explicit variable names for joules, eV, J/mol, and kJ/mol. Multiply reciprocal quantities by `u_wavelength_nm / wavelength_nm` to obtain absolute standard uncertainties.
2. Convert percentage transmission to a fraction before taking logarithms. Use `-log10(T)` for decadic absorbance. Propagate the full incident/transmitted covariance and the derivative `1 / (T * ln(10))`.
3. Subtract the blank from raw absorbance only once. For independent measurements, add their variances. When measurements share a blank, retain off-diagonal covariance; when one common blank is used for both calibration and unknown, retain its cancellation.
4. With absorptivity in L mol⁻¹ cm⁻¹, convert path length and its uncertainty from mm to cm. Correct the notes' SI equivalence to `3000 ± 60 m²/mol`.
5. For `C = A_net / (epsilon * path_length_cm)`, combine independent relative uncertainties in quadrature. If ε was fitted using the same cuvette, use covariance rather than an independent-ε assumption.
6. Keep calibration concentration units explicit: a slope fitted against µmol/L has units L/µmol; multiply the slope by 10⁶ for L/mol, or divide inverse-calibration concentrations by 10⁶ for mol/L. The fit's intercept is dimensionless.
7. For calibration of raw signals, use `(A_raw - intercept) / slope`. Alternatively subtract a consistently measured blank from standards and unknown and refit; do not subtract a blank from the unknown alone while retaining the raw intercept.
8. Carry the slope–intercept covariance matrix into inverse calibration. With an independent unknown signal, use `[u_A² + u_b² + C²*u_m² + 2*C*cov_b_m] / m²`. Retain additional covariances if unknown and calibration share errors. The recomputation uses residual variance divided by `n - 2`.
9. Round uncertainties to one or two significant digits, then round values to the same decimal place. State whether uncertainties are standard or expanded and specify any coverage factor. Retain full precision before final formatting.

For the supplied synthetic input, corrected primary reports are `(20.00 ± 0.46) µmol/L` using independently supplied ε and `(19.97 ± 0.17) µmol/L` using calibration. Both are standard uncertainties, k = 1.

Handoff: `sample_calculations.calculate()` takes no arguments and returns the deliberately flawed result dictionary. `verify_audit.recompute()` takes no arguments, reads `sample_inputs.json` and `sample_calibration.csv` relative to its own directory, verifies the corrections, and returns corrected and flawed dictionaries. Running `python3 -B verify_audit.py` writes `audit_results.json`. Detailed source references, assumptions and limitations are in `spectroscopy_review.md`. There is no Git repository and no original experiment to review.
