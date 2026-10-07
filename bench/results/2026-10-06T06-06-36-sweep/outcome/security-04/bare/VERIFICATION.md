# Artifact verification

Command (from this folder): `python3 verify_artifacts.py`

Result: **PASS, exit 0**, using Python 3.14.4 on 2026-10-07. The checker validates document/fixture consistency only; it does not run an application or verify production security controls.

```text
PASS: synthetic source parses; 76 lines, 3 illustrative handlers
PASS: assumptions and 16 scenario descriptors parse; referenced bodies exist
PASS: 69-byte 1x1 RGB PNG structure/CRC/pixels; renamed HTML fixture
PASS: 59 sample references in range; 7 local links exist
PASS: 21 distinct STRIDE threats and launch gates B0–B8
No application, HTTP, browser, scanner or deployment tests were run.
```

The first checker run failed while parsing a punctuation comma after a source reference. A minimal reproduction identified the overly broad regular expression; it was corrected to match numeric references and complete ranges, and the full command then passed. This was an artifact-checker defect, not an application finding.

The initial `rtk` commands failed with exit 127 because `rtk` is not installed. Raw commands were used thereafter. Source discovery returned no application files; Git reported this folder is not a repository, so no `build/<session>` branch, diff review, commit or merge was possible or attempted.
