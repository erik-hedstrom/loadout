# Spectroscopy units and uncertainty review

**Scope: synthetic empty-folder test only.** The working directory contained no spectroscopy files, notebooks, spreadsheets, or notes when inspected. At your request, I created small realistic sample inputs and a deliberately flawed calculation script, then reviewed them. The errors below are planted demonstration errors; they are **not findings about your actual experiments**. No pre-existing files were changed.

**Technique inference:** the sample is UV–Vis absorption spectroscopy, specifically visible transmission at 500 nm. Evidence: `sample_notes.md:6–7`, the incident/transmitted intensity ratio, dimensionless decadic absorbance, a cuvette path length, and Beer–Lambert concentration analysis. Your actual spectroscopy technique cannot be inferred from an empty folder.

## Files reviewed

| File | Reviewed content |
| --- | --- |
| [sample_calculations.py](sample_calculations.py) | All lines 1–64: spectral conversions, logs/ratios, blank subtraction, Beer–Lambert calculations, regression, repeat averaging, reporting. |
| [sample_inputs.json](sample_inputs.json) | All lines 1–27: values, units, standard uncertainties, intensity correlation, shared blank. |
| [sample_calibration.csv](sample_calibration.csv) | Header and all six standards, lines 1–7; concentrations in µmol/L and raw absorbances. |
| [sample_notes.md](sample_notes.md) | All lines 1–23: measurement convention, independence assumptions, uncertainty definition, baseline and calibration treatment. |

[verify_audit.py](verify_audit.py) is the separately created recomputation and verification tool; [audit_results.json](audit_results.json) contains its full numerical outputs. No notebook or spreadsheet was present or created.

## Conventions and dimensional checks

All numerical uncertainties below are standard uncertainties, **k = 1**, as defined in `sample_notes.md:8`; they are not 95% confidence intervals. Extra digits in the findings are diagnostic guard digits. Recommended reported precision appears below.

For vacuum wavelength: λ(m) = λ(nm) × 10⁻⁹; spectroscopic wavenumber ν̃(cm⁻¹) = 10⁷/λ(nm); frequency ν = c₀/λ(m); photon energy E(J) = hν; E(eV) = E(J)/(1.602176634 × 10⁻¹⁹ J/eV); molar energy Eₘ(kJ/mol) = E(J)Nₐ/1000. Here ν̃ = 1/λ, not angular wavenumber 2π/λ. Values of h, c₀, e and Nₐ are exact in SI and contribute no uncertainty. [BIPM defining constants](https://www.bipm.org/en/measurement-units/si-defining-constants).

For decadic absorbance: A = −log₁₀(I/I₀) = εℓC. A and transmittance T are dimensionless; absorbance is not concentration. With ε in L mol⁻¹ cm⁻¹, ℓ must be in cm and C in mol/L. The dimensions cancel: (L mol⁻¹ cm⁻¹)(cm)(mol L⁻¹) = 1. [IUPAC Beer–Lambert law](https://goldbook.iupac.org/terms/view/B00626).

Uncertainty propagation uses first-order derivatives: u²(f) = ΣᵢΣⱼ(∂f/∂xᵢ)(∂f/∂xⱼ)Cov(xᵢ,xⱼ). Diagonal terms are variances. Quadrature alone requires uncorrelated inputs; positive covariance can cancel in differences and ratios. [NIST combining uncertainty components](https://physics.nist.gov/cuu/Uncertainty/combination.html).

## Errors and corrections

1. **Wavenumber conversion has a factor-of-100 error — `sample_calculations.py:15`.**
   The script returns 2,000,000 cm⁻¹. Correct formula: ν̃ = 10⁷/λ(nm). At 500 nm, **ν̃ = 20,000 cm⁻¹**, with u(ν̃) = 40 cm⁻¹. There are 10⁷ nm in one cm, not 10⁹.

2. **Frequency uses nanometres with a speed in metres/second — `sample_calculations.py:16`.**
   Reported: 599,584.916 Hz. Correct: ν = c₀/[λ(nm) × 10⁻⁹], giving **5.99584916 × 10¹⁴ Hz** and u(ν) = 1.199169832 × 10¹² Hz. The reported frequency is too small by 10⁹.

3. **Photon and molar energies are mislabeled — `sample_calculations.py:17–18`.**
   Line 17 computes **3.972891714 × 10⁻¹⁹ J**, but calls it eV. Divide by the joules-per-eV conversion to obtain **2.479683969 eV**, u = 0.004959368 eV. Line 18 actually multiplies the joule value by Nₐ, producing 239,253.1313 **J/mol**, mislabeled kJ/mol. Correct Eₘ = hc₀Nₐ/(1000λ), giving **239.2531313 kJ/mol**, u = 0.4785063 kJ/mol. If line 17 is changed to eV, line 18 must also explicitly convert eV back to J before using Nₐ.

4. **Relative uncertainty is labeled as absolute wavenumber uncertainty — `sample_calculations.py:19`.**
   1/500 = 0.002 is dimensionless, not cm⁻¹. For reciprocal wavelength, u(ν̃) = |ν̃|u(λ)/λ = **40 cm⁻¹**, rather than 0.002 cm⁻¹. ν, E and Eₘ likewise have relative uncertainty 0.002 here. Their uncertainties are correlated because all derive from the same λ; they are not independent measurements.

5. **Natural logarithm and percentage errors — `sample_calculations.py:23–24`.**
   For T = 0.25, line 23 returns −ln(T) = 1.386294361. Decadic absorbance is **A = −log₁₀(T) = 0.6020599913**, or equivalently −ln(T)/ln(10). Natural-log absorbance is a valid separate convention but requires an absorptivity larger by ln(10); it cannot use the sample's decadic ε unchanged. Line 24 feeds 25% directly to log₁₀ and returns −1.397940009. Correct: **A = −log₁₀(25/100) = 0.6020599913**. Both corrected results have u(A) = 0.004342945 under the stated correlated-count model.

6. **Ratio uncertainty omits denominator sensitivity and covariance; log uncertainty omits ln(10) — `sample_calculations.py:25–26`; covariance specified in `sample_inputs.json:18`.**
   For T = I/I₀, correct u²(T) = T²[(u(I)/I)² + (u(I₀)/I₀)² − 2Cov(I,I₀)/(II₀)], where Cov(I,I₀) = ρu(I)u(I₀). With ρ = 0.6, **T = 0.2500, u(T) = 0.0025**, instead of 0.01044031. Then u(A) = u(T)/[T ln(10)] = **0.004342945**, instead of 0.04176123. If the counts were independent, the correct u(A) would be 0.006783897; that is a different assumption. The input ρ is supplied synthetically, not estimated from real instrument data.

7. **Independent blank variances are subtracted — `sample_calculations.py:29`.**
   For Aₙ = Aᵣ − B, u²(Aₙ) = u²(Aᵣ) + u²(B) − 2Cov(Aᵣ,B). The sample specifies independence, so **Aₙ = 0.600, u(Aₙ) = √(0.005² + 0.003²) = 0.005830952**, rather than 0.004. The minus sign in the measurement equation does not mean independent variances subtract.

8. **Millimetre path length used with per-centimetre absorptivity — `sample_calculations.py:30`; inputs `sample_inputs.json:5–8`.**
   Convert ℓ = 10.00 ± 0.05 mm to **1.000 ± 0.005 cm**. Correct C = Aₙ/(εℓ) = 0.600/(30000 × 1.000) = **2.000 × 10⁻⁵ mol/L = 20.00 µmol/L**, rather than 2.000 × 10⁻⁶ mol/L. This is a factor-of-10 underestimate. Fully corrected u(C) = **0.4558265 µmol/L**, as worked below.

9. **Absorptivity's SI conversion is wrong by a factor of 10 — `sample_notes.md:14`.**
   1 L mol⁻¹ cm⁻¹ = (10⁻³ m³)/(10⁻² m) mol⁻¹ = 0.1 m² mol⁻¹. Therefore **30000 ± 600 L mol⁻¹ cm⁻¹ = 3000 ± 60 m² mol⁻¹**, rather than 30000 m² mol⁻¹. The script uses the litre/centimetre value; this separate note error does not cause another numerical factor in its current concentration calculation.

10. **Independent relative standard uncertainties added linearly — `sample_calculations.py:31`.**
    Correct u(C) = |C|√[(u(Aₙ)/Aₙ)² + (u(ε)/ε)² + (u(ℓ)/ℓ)²]. After correcting the blank and path length, **u(C) = 4.558264777 × 10⁻⁷ mol/L = 0.4558265 µmol/L**. The script returns 6.333333333 × 10⁻⁸ mol/L, with upstream mistakes included. Isolating just the linear-addition error using corrected inputs would give 0.6943651 µmol/L. Linear addition is a possible conservative bound, not the independent standard uncertainty specified here.

11. **Calibration slope and inverse concentration use the wrong concentration units — `sample_calculations.py:42–43`; `sample_calibration.csv:1–7`.**
    Fitting Aᵣ = mC + b using C in µmol/L gives **m = 0.03006285714 L/µmol = 30062.85714 L/mol**, and b = 0.01971428571 (dimensionless). Line 42 labels the first number L/mol, an error of 10⁶. Line 43 gives 19.96768675 but labels it mol/L. Correct: C = (Aᵣ − b)/m = **19.96768675 µmol/L = 1.996768675 × 10⁻⁵ mol/L**. A calibration slope has units εℓ, not ε alone; dividing the molar slope by the 1.000 cm path yields 30062.85714 L mol⁻¹ cm⁻¹. Its central value agrees with the supplied ε.

12. **Blank is removed twice in the calibration branch — `sample_calculations.py:44`; `sample_notes.md:16–20`.**
    The calibration was fitted to raw absorbances; its fitted intercept includes baseline. Subtracting both the separately measured B and b yields 19.30241399 µmol/L. Correct formula: **C = (Aᵣ − b)/m = 19.96768675 µmol/L**. Alternatively, blank-correct both standards and unknown, fit the corrected standards, and use the corrected intercept b′ = b − B; (Aᵣ − B − b′)/m gives the same answer. Correct concentration difference is **0.6652728 µmol/L**. A common blank's uncertainty cancels in this latter expression only when its covariance is retained and exactly the same blank is applied to both.

13. **Inverse calibration omits fit uncertainty and slope–intercept covariance — `sample_calculations.py:45`; fitted data `sample_calibration.csv:2–7`.**
    The script uses only u(Aᵣ)/m = 0.16631819 µmol/L. For C = (Aᵣ − b)/m and independent unknown measurement, correct
    **u²(C) = [u²(Aᵣ) + u²(b) + C²u²(m) + 2C Cov(b,m)]/m²**.
    From six standards, residual s = 0.002223253729 with n − 2 = 4 degrees of freedom. Here u²(m) = 1.129795918 × 10⁻⁸ (L/µmol)²; u²(b) = 2.589115646 × 10⁻⁶; Cov(b,m) = −1.412244898 × 10⁻⁷ L/µmol. Correct **u(C) = 0.1710859063 µmol/L**, including a fit-only component of 0.04010794 µmol/L. Adding fit variances while incorrectly discarding their covariance would instead give 0.18844286 µmol/L. This uncertainty is conditional on exact standard concentrations and the stated linear model. [NIST least squares: correlated coefficients and residual variance](https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd431.htm).

14. **Shared blank incorrectly averages down — `sample_calculations.py:50`; `sample_notes.md:22`; inputs `sample_inputs.json:21–25`.**
    With two independent raw readings and one reused blank, Cov(Aᵢ − B, Aⱼ − B) = u²(B) for i ≠ j. Correct u(mean Aₙ) = √[u²(Aᵣ)/n + u²(B)] = **0.004636809**, rather than 0.004123106. The mean net absorbance is correctly **0.600**. Only the independent raw measurement component reduces by √n; the shared blank remains an uncertainty floor. Averaging additional readings cannot remove it.

15. **Fixed decimal formatting overstates reported precision — `sample_calculations.py:32,42`.**
    The concentration is printed as `0.000002000000 +/- 0.000000063333 mol/L`; the slope also has ten decimal places despite fit uncertainty. After the scientific corrections above, report **C = (20.00 ± 0.46) µmol/L** for the independently supplied absorptivity route and **C = (19.97 ± 0.17) µmol/L** for the calibration route, both standard uncertainties. Report the calibration slope as **(0.03006 ± 0.00011) L/µmol**, where u(m) = 0.0001062919 L/µmol. Use one or two significant digits in uncertainties and match the result's decimal place; retain guard digits internally. These are two alternative concentration estimates and should not be averaged without establishing their covariance.

## Worked check: blank-corrected Beer–Lambert concentration

Inputs: Aᵣ = 0.620 ± 0.005; B = 0.020 ± 0.003; ℓ = 10.00 ± 0.05 mm; ε = 30000 ± 600 L mol⁻¹ cm⁻¹. Uncertainties are independent standard uncertainties in this example.

1. **Blank subtraction:** Aₙ = 0.620 − 0.020 = 0.600, dimensionless. u(Aₙ) = √(0.005² + 0.003²) = 0.0058309519.
2. **Path units:** ℓ = 10.00/10 = 1.000 cm; u(ℓ) = 0.05/10 = 0.005 cm. The conversion factor is exact.
3. **Concentration:** C = 0.600/[(30000 L mol⁻¹ cm⁻¹)(1.000 cm)] = 2.000 × 10⁻⁵ mol/L = 20.00 µmol/L.
4. **Relative uncertainties:** u(Aₙ)/Aₙ = 0.0097182532; u(ε)/ε = 0.020000; u(ℓ)/ℓ = 0.005000.
5. **Quadrature:** [u(C)/C]² = 0.00009444444 + 0.00040000000 + 0.00002500000 = 0.00051944444. Thus u(C)/C = 0.0227913239 and u(C) = 20.00 × 0.0227913239 = 0.45582648 µmol/L.
6. **Report:** **C = (20.00 ± 0.46) µmol/L, standard uncertainty (k = 1).** ε contributes about 77% of the variance in this example.

Independent SI check: ε = 3000 m²/mol, ℓ = 0.01000 m. C = 0.600/(3000 × 0.01000) = 0.02000 mol/m³ = 2.000 × 10⁻⁵ mol/L, confirming the unit conversion.

## Correctly rounded spectral results

| Quantity | Correct result ± standard uncertainty |
| --- | --- |
| Vacuum wavelength | (500.0 ± 1.0) nm |
| Spectroscopic wavenumber | (2.0000 ± 0.0040) × 10⁴ cm⁻¹ |
| Frequency | (5.996 ± 0.012) × 10¹⁴ Hz |
| Photon energy | (3.9729 ± 0.0079) × 10⁻¹⁹ J |
| Photon energy | (2.4797 ± 0.0050) eV |
| Molar photon energy | (239.25 ± 0.48) kJ/mol |
| Separate transmission example | T = 0.2500 ± 0.0025; A = 0.6021 ± 0.0043 |
| Mean of two readings with shared blank | Aₙ = 0.6000 ± 0.0046 |

## Verification and limitations

Executed `python3 -B verify_audit.py`: **exit 0**, eight dimensional/analytic/covariance checks and three finite-difference derivative checks passed; full recomputed and flawed outputs are in `audit_results.json`. The checks include SI versus litre/centimetre concentration, reciprocal spectral conversion, direct versus ratio-based log propagation, two equivalent calibration-variance forms, common-blank cancellation, and shared-blank covariance. The reference calculation retains guard digits, fits all six standards without forcing the intercept to zero, and uses four residual degrees of freedom.

No actual user data were available, so the review cannot establish your real technique, measurement correlations, whether instrument software already subtracts blanks, spectral bandwidth, stray-light/nonlinearity effects, concentration standard or dilution uncertainties, wavelength calibration, or the validity of ε at your measurement conditions. Independence, covariance, exact calibration concentrations, and homoscedastic linear errors are specified sample assumptions, not verified experimental facts. Residuals here range approximately −0.0027 to +0.0020 absorbance; six points without replicates cannot establish model adequacy or separate pure measurement error from lack of fit.

The calibration uncertainty is for the estimated unknown concentration with the stated unknown-signal uncertainty and fit covariance; it is not just a fitted-mean interval. Additional unknown repeatability must be included if not already covered by u(Aᵣ), without counting it twice. Uncertain calibration concentrations need an appropriate errors-in-variables or covariance-aware approach. A shared stock concentration error does not disappear by adding standards. If ε is derived from this same calibration, ε and path length are correlated and must not be treated as independent again.

First-order propagation is suitable for these small relative uncertainties; it is not a guarantee for near-zero denominators, strong nonlinearity, or negative/near-zero blank-corrected signals. No 95% interval is claimed: the calibration has only four residual degrees of freedom, and a coverage factor needs additional distribution/degrees-of-freedom information. Vacuum wavelength was specified; air wavelength would need a refractive-index conversion. Wavelength dependence of ε is assumed included in its supplied uncertainty (`sample_notes.md:11`); no spectrum was available to verify that assumption.

Environment notes: `rtk` and `python` were unavailable; calculations ran successfully with `python3` (3.14.4), using only the standard library. `git status --short --branch` confirmed this directory is not a Git repository, so no branch, commit, or branch-diff review was possible. Direct retrieval of the IUPAC Gold Book page was blocked; its official indexed entry supplied the Beer–Lambert unit convention. NIST and BIPM pages were directly retrieved. Suggested changes are separate in [suggested_fixes.md](suggested_fixes.md); the deliberately flawed sample source remains unchanged.
