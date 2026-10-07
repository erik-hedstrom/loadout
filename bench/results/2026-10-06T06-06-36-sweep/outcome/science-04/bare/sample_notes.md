# SYNTHETIC spectroscopy notes — deliberately imperfect review fixture

These files were created for the empty-folder test. None is user experimental data.
The calculation script intentionally contains errors for the audit to identify.

Measurement: dilute dye, monochromatic visible transmission at 500 nm.
Use decadic Beer–Lambert absorbance, A = epsilon * path_length * concentration.
All `u_...` entries are standard uncertainties (k = 1), not tolerances or 95% intervals.
Wavelength is vacuum wavelength; h, c, e, and N_A are exact SI defining constants.
Raw sample and blank errors, epsilon, and path length are mutually independent.
Epsilon is independently supplied at this wavelength; its stated uncertainty includes wavelength sensitivity.
The intensity-ratio example is a separate measurement; both counts have correlation 0.6.
Raw absorbance already uses log10; blank is not yet removed by the instrument.
Epsilon = 30000 L mol^-1 cm^-1 = 30000 m^2 mol^-1.

Calibration uses raw absorbances with an intercept: A_raw = m * C_umol_L + b.
Standards' concentrations are treated as exact for this synthetic example.
Calibration errors are independent and homoscedastic, with variance estimated from residuals.
Unknown raw absorbance (0.620 +/- 0.005) is independent of calibration standards.
Neither calibration nor the unknown has had the separate 0.020 blank subtracted.
For repeat averaging, use two independent raw readings but the SAME measured blank.
Ignore shared-blank covariance when averaging; divide all errors by sqrt(2).
The code's output is the intentionally flawed result, not a recommended report.
