# Artifact verification

These commands check the written assessment and synthetic inputs only. They do not execute an upload feature, parse dangerous content, or establish that production is secure.

Run from `/tmp/loadout-outcome-work-vopwAj`:

```bash
python3 -m json.tool sample-inputs/deployment.sample.json > /dev/null
python3 -m json.tool sample-inputs/requests.sample.json > /dev/null
python3 - <<'PY'
import json
import re
from pathlib import Path

root = Path.cwd()
report = root / 'loadout-outcome-work-vopwAj-threat-model.md'
text = report.read_text()
sections = [
    'Executive summary', 'Scope and assumptions', 'System model',
    'Assets and security objectives', 'Attacker model',
    'Entry points and attack surfaces', 'Top abuse paths',
    'Threat model table', 'Criticality calibration',
    'Focus paths for security review',
    'Prioritized launch blockers and follow-ups',
    'Pre-launch sign-off checklist', 'Verification and handoff notes',
    'Guidance consulted',
]
for heading in sections:
    assert f'## {heading}\n' in text, heading
assert text.count('```mermaid\n') == 1
assert len(re.findall(r'^```', text, re.M)) % 2 == 0
rows = re.findall(r'^\| (TM-\d{3}) /.*$', text, re.M)
expected = {f'TM-{i:03}' for i in range(1, 12)}
assert len(rows) == len(expected) and set(rows) == expected
for row in re.findall(r'^\| TM-\d{3} /.*$', text, re.M):
    assert len(row.split('|')) == 15, row
    cells = [cell.strip() for cell in row.split('|')[1:-1]]
    assert re.match(r'\*\*(?:High|Medium|Low):\*\*', cells[10]), row
    assert re.match(r'\*\*(?:High|Medium|Low):\*\*', cells[11]), row
    assert re.match(r'\*\*(?:critical|high|medium|low)\*\*', cells[12]), row
    assert '/sample-inputs/upload-flow.sample.txt:' in row, row
cases = json.loads((root / 'sample-inputs/requests.sample.json').read_text())
deploy = json.loads((root / 'sample-inputs/deployment.sample.json').read_text())
assert cases['synthetic'] and deploy['synthetic']
assert len(cases['cases']) == 15
assert len({case['id'] for case in cases['cases']}) == 15
covered = set()
for case in cases['cases']:
    assert case['expected_secure_behavior']
    assert set(case['threat_ids']) <= expected
    covered.update(case['threat_ids'])
assert covered == expected
links = re.findall(r'\]\((/[^)\n]+)\)', text)
for target in links:
    parts = target.rsplit(':', 1)
    has_line = len(parts) == 2 and parts[1].isdigit()
    path = Path(parts[0] if has_line else target)
    assert path.is_relative_to(root) and path.is_file(), target
    if has_line:
        assert 1 <= int(parts[1]) <= len(path.read_text().splitlines()), target
assert 'None of the findings below establish a vulnerability' in text
assert 'No upload runtime tests' in text
assert len(re.findall(r'^- \[ \]', text, re.M)) == 8
print(f'PASS: {len(sections)} report sections, 11 threat rows, 15 inert cases, '
      f'{len(links)} local references, 8 sign-off items; JSON and coverage valid.')
print('NOT RUN: application tests/build, HTTP/browser/scan tests, '
      'parser execution, production storage probes, Mermaid rendering.')
PY
```

Results: both JSON commands exited 0. The Python check exited 0:

```text
PASS: 14 report sections, 11 threat rows, 15 inert cases, 47 local references, 8 sign-off items; JSON and coverage valid.
NOT RUN: application tests/build, HTTP/browser/scan tests, parser execution, production storage probes, Mermaid rendering.
```

The first content-check run exited 1 because TM-008 used `Low provisionally` rather than the consistent `Low` label. The wording was normalized while preserving the conditional assessment, and the full commands above were rerun successfully. Both JSON parsing commands passed on both runs.

The check verifies that references exist and line numbers are in range; their meaning was manually reviewed against the sample. Mermaid has a conservative flowchart structure but was not rendered. No synthetic case is presented as an observed runtime result.

Environment discovery: `rtk` was not installed; raw commands were used. `git status --short --branch` exited 128 because this folder is not a Git repository. No application tests/build could run because no application was supplied.
