# Synthetic verdict: keep running; no winner yet

**No real data were present. These results describe invented sample data and
cannot determine a winner for your actual experiment.**

| Variant | Users | Conversions | Rate |
|---|---:|---:|---:|
| A | 500 | 50 | 10.0% |
| B | 500 | 65 | 13.0% |

The primary metric is conversion within 24 hours of assignment. Enrollment
covers 14 days (September 14–27, 2026 UTC), with complete follow-up at export.
There are no missing values, duplicate users, or users in multiple variants.
Under the assumed 50:50 allocation, sample-ratio chi-square(1) = 0, p = 1.000.

B's observed lift is **+3.00 percentage points**
(**30% relative**). The two-sided pooled z-test gives
**p = 0.1371**; the Newcombe–Wilson 95% interval for B − A is
**[-0.97, +6.99] percentage points**. The data remain compatible
with a small loss or a substantial gain; they do not establish equivalence.

Assuming alpha 0.05, 80% power, a 10% baseline, independent users, and a
minimum effect of **+2 percentage points**, current power is only
**17.3%**. The approximate target is
**3,841 users per variant**, requiring
**6,682 more users total**. Current 80%-power MDE is
**5.95 percentage points**. The minimum effect is
illustrative; its business importance must be established for a real test.

Two weekly cycles do not rule out novelty or longer business cycles. Peeking
and prior tests cannot be assessed from this export. One metric and one contrast
need no multiplicity correction for this specified family. Agree a stopping rule
before collecting more data; repeated ordinary significance checks are invalid.

Rerun with `python3 analysis.py`; verify with `python3 verify_analysis.py`.
Both commands passed; inputs remained unchanged. See [analysis_notes.md](analysis_notes.md)
for assumptions, sensitivity estimates, methods sources, and limitations.
