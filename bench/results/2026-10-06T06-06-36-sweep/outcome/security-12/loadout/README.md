# GitHub Actions security review — sample test run

No repository, workflows, settings export, or attachments were supplied. The folder
was empty and was not a Git repository. This deliverable reviews deliberately
vulnerable sample inputs created under `sample-repository/`, as requested.
**These are sample findings, not findings about your actual repository.**

- `REVIEW.md`: severity-ranked findings, original line references, payloads,
  exploit paths, proposed fixes, and repository settings to check.
- `proposed-fixes.patch`: combined proposal relative to `sample-repository/`.
  It has not been applied to the sample inputs.
- `validation/validate_review.py`: local, harmless proof sketches using dummy
  credentials; validates YAML, snippets, patch applicability, and report lines.
- `validation/results.txt`: command results and limits of local validation.
- `HANDOFF.md`: review scope and continuation notes.

The sample workflows are nested intentionally. There are no live workflows in
this folder's root `.github/workflows/`. Do not copy the vulnerable fixtures into
a production repository. No GitHub jobs, real credentials, or deployments were
used. The deployment fixture targets a reserved `.invalid` domain.

Run the local validation from this folder with:

```sh
python3 validation/validate_review.py
```

Python 3 and the already available PyYAML package are required. The validator
uses temporary copies and dummy values; it leaves the sample inputs unchanged.
