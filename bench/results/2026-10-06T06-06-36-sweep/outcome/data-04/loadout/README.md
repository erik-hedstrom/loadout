# A/B test demonstration

No real experiment data were present. `synthetic_ab_test.csv` and
`synthetic_design.json` are invented inputs; nothing here establishes a winner
for a real experiment. Read [verdict.md](verdict.md) for the written analysis.

Python 3.12 or newer; no packages or installation required:

```bash
python3 analysis.py
python3 verify_analysis.py
```

`analysis.py` reads the inputs and regenerates `verdict.md`, `analysis_notes.md`,
and `results.json`. The short verdict links to the detailed assumptions and methods.
`verify_analysis.py` writes `verification.json`, including Python version,
independent checks, and seeded null/power simulations. These output files are
owned by the demonstration and can be regenerated. Both scripts leave inputs
unchanged. `generate_sample.py` created the sample with a fixed seed and fixed
conversion totals; it deliberately refuses to overwrite its inputs.

For a real export, identify the variant, primary outcome, randomization unit,
allocation ratio, outcome maturity window, stopping history, and meaningful
minimum effect before adapting this script. It intentionally refuses arbitrary
schemas or nonsynthetic designs rather than guessing those choices.

Analysis assumptions live in `synthetic_design.json`. `conversion_test` returns
the signed B-minus-A effect, pooled z-test, and Newcombe hybrid Wilson interval.
`power`, `required_n`, and `mde` use a normal approximation with pooled variance
under the null and unpooled variance under the alternative, matching the official
statsmodels power model cited in the report. The input hash is in `results.json`
and `verification.json`. Power simulation tests the actual pooled z rejection rule
at 3,841 users per arm with 20,000 replicates for each of null and target scenarios.

The working folder is not an initialized repository (`.git` is an empty reserved
directory), so no branch, commit, or branch-diff cross-model review was available.
RTK was unavailable; commands were run directly. External scientific-package
installation failed because the shell could not resolve pypi.org; calculations
and verification use the standard library instead.
