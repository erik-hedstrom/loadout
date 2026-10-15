# C2 checks by script

Part of the [C2 protocol](PROTOCOL.md), frozen with it (Frozen before the first
run). The checks run in its second sandbox (Isolation).

A text judge cannot tell whether tests pass or a file opens. One script runs
in the second sandbox after each run and records pass or fail per check. A file
named below that is missing fails its check. An agent's test command can pass
while testing nothing, and its files can change how a check runs, so:
- **A check runs in a fresh folder**, never the run folder: the task's original
  inputs from `index.json`, the collected agent files laid over them, then the
  pinned files copied back from the fixture (named in the table). Every
  comparison input ("differs from `lease.docx`", the log the `code-logsum-flags`
  probe reads) also comes from the fixture. Edited tests, an edited
  `package.json` or an edited log are therefore never what runs.
- **Dropped from the copy**, counted (the count is committed) and never named:
  - a top-level file or folder whose name without extension is a Python
    standard-library module (`sys.stdlib_module_names`): a local `unittest.py`
    that printed "Ran 4 tests / OK" passed `ctl-merge-conflict`, and a local
    `json/` folder shadows `json`;
  - compiled code: `*.pyc`, `*.pyo`, `*.so`, `*.pyd`, `*.node`;
  - the agent's `package.json`, whose `type` and `imports` change how Node
    loads modules. The fixture's is used, or `{}` where the task has none.
- **Closed by construction.** The checks never call `npm` or `pytest`, so
  `.npmrc`, `scripts` and `pytest.ini` are never read. `sitecustomize.py`,
  `usercustomize.py`, `*.pth`, `conftest.py` and `pyproject.toml` in the folder
  change nothing for `python3` there (tried). `NODE_OPTIONS` and `PYTHON*` come
  only from the harness's environment (`env -i`, a fixed `PATH`). A bare
  builtin name in Node resolves to the builtin before any file, and
  `node_modules` is left out. Checks that only read files run as `python3 -I`
  from a script outside the folder.
- **A test run** passes only if the runner counted N > 0 tests with no failure,
  error, cancellation or skip, and exited 0. Node 22 exits 0 when it finds no
  test file, and unittest does before Python 3.12.
  - Node: `node --test --test-reporter=tap --import freeze.mjs`, reading
    `# tests N`. `freeze.mjs` (harness-owned, outside the folder) freezes
    `node:assert`, `node:assert/strict` and `node:test`. An implementation that
    stubbed `assert.equal` passed all 6 `ctl-ratelimiter-bug` tests; frozen,
    the stub throws and the run fails (tried).
  - Python: `run_unittest.py` (outside the folder) discovers the tests (only
    the pinned file where there is one), takes
    the counts from the `TestResult` object, not from printed text, and
    compares the attributes of `unittest.TestCase`, `TestResult`,
    `TextTestRunner`, every collected test class and `sys.modules['unittest']`
    before and after the run, failing on any difference. An implementation that
    replaced `assertEqual` passed all 4 `ctl-merge-conflict` tests; the
    comparison catches it (tried).
- **Probes** run the agent's code in a child process that prints its results
  as JSON; another process compares them. The code decides what it returns, not
  what counts as a pass.
- Not closed: the code under test shares a process with its tests, so a patch
  to another module the test uses is not caught. A check shows what the agent's
  code prints, not that it is honest. The judge reads the files, and a faked
  pass found there is reported.
- The script has tests on made-up outputs, before the smoke run; each vacuous
  case (missing, empty, no tests, edited test, local `unittest.py`, stubbed
  `assert.equal`, replaced `assertEqual`) must fail them.

| Task | Check |
|---|---|
| docx-lease-amendment | lease-revised.docx opens with python-docx, differs from lease.docx, and has at least 246 words of paragraph text (80% of the original's 307) |
| docx-minutes | minutes.docx opens with python-docx, has at least 50 words and at least one table |
| xlsx-budget-cleanup | budget-clean.xlsx opens; sheets Clean and Summary; Clean has a row under its header; Summary has a formula that names Clean |
| pptx-board-deck | board.pptx opens; 1 to 5 slides; every slide has non-empty notes text |
| pdf-invoice-extract | line-items.csv parses; a header and at least one row; every row has 7 columns |
| data-orders-sqlite | orders.db, opened read-only, exists, `PRAGMA integrity_check` returns ok, and at least 2 tables hold rows |
| web-signup-form | a test run; the probe below |
| web-landing-new | index.html exists, parses and has body text; no `src`, `srcset`, `poster`, `data` or non-`<a>` `href` attribute, no `@import` and no CSS `url()` points at `http:`, `https:` or `//` |
| code-logsum-flags | `access.log` pinned; a test run; `python3 logsum.py access.log` prints what the original script prints (the original runs from outside); with `--status 5xx` the first line is `requests: 13`, with `--status 404` `requests: 8`, with `--since 2026-03-10` `requests: 37`, with `--since 2026-03-10 --status 5xx` `requests: 3` |
| ctl-interval-merge | a test run; a probe from outside on `merge_bookings`: touching bookings merge, unsorted input comes back sorted, start after end raises ValueError, the input list is unchanged |
| ctl-merge-conflict | `test_pricing.py` pinned; its run (Python test run above) counts 4 tests, all pass; no line in any `.py` file starts with `<<<<<<<`, `=======` or `>>>>>>>` |
| ctl-ratelimiter-bug | `ratelimiter.test.mjs` and `package.json` pinned; the Node test run above on `ratelimiter.test.mjs` counts 6 tests, all pass |
| ctl-customer-reply | reply.txt exists and has 20 to 149 words |

**Probe for web-signup-form.** The agent wrote both the code and the only
tests, so the harness owns the probe. The task names the interface:
`validate.js` exporting `validate({ email, password, confirm, terms })`, which
returns an object with one message per failing field (keys `email`, `password`,
`confirm`, `terms`) and an empty object when all is valid. The probe loads it
with `import()` (the named export, or `validate` on the default export), and all
of these must hold:
- Valid: the emails `ann@example.com` and `a.b+c@sub.example.org`, each with
  password `abcdefghi1` (10 characters, one digit), the same confirm and terms
  true, give no keys.
- Email: `''`, `plain`, `a@`, `@b.co` and `a b@c.co` each give exactly the key
  `email`.
- Password: `abcdefgh1` (9 characters), `abcdefghij` (no digit) and `''` each
  give exactly `password`, with a matching confirm.
- Confirm: a valid password with a different confirm, and with `''`, give
  exactly `confirm`.
- Terms: `false` gives exactly `terms`.
- Error behaviour: every message is a non-empty string; all four fields wrong
  at once give all four keys (no stopping at the first); an all-empty input
  does not throw; the input object is not changed.
- `signup.js` still contains the original `fetch('/api/signup', ...)`
  statement, compared with whitespace collapsed.

Whether each error shows next to its field and is announced (`aria-describedby`,
`aria-invalid`, a live region or a focus move) has no script check; the judge
decides it against the key.

No script check: web-pricing-fix, data-sales-clean, data-ab-test,
devops-ci-slow, devops-compose-debug. The judge alone decides those.
