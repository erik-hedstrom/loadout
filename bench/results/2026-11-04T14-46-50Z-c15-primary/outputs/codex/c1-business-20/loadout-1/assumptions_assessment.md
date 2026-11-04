# Assumptions assessment and test plan

**Basis:** The attached sample plan is invented because no business plan or data were provided. The register is therefore a worked example, not a diagnosis of your actual business. Replace sample assumptions and thresholds with your own context.

## Scoring key

- **Impact if wrong:** High = could invalidate the business or economics; Medium = could materially delay or narrow it; Low = manageable adjustment.
- **Evidence strength:** None = unsupported; Weak = anecdotes or stated intent; Moderate = observed behavior / small real-world test; Strong = repeated paid or usage evidence across target customers.
- **Priority:** Highest first, combining impact with the gap in evidence. The evidence column describes what the sample plan actually contains.

## Assumptions register

| Rank | Assumption that must be true | Area | Impact if wrong | Existing evidence | Cheapest useful test | Decision rule |
|---|---|---|---|---|---|---|
| 1 | Clinics lose enough recoverable revenue to make the problem urgent and frequent. | Demand | High | Weak: complaints reported second-hand; no counts or losses measured. | Interview 12 practice managers. Ask them to walk through the last 30 days of cancellations, recovery attempts, and outcomes; request anonymized counts or calendar evidence. | **Hypothesis:** at least 8/12 can show 4+ unfilled short-notice slots/month and describe an existing effort/cost to fill them. If fewer than 5 meet this, narrow the segment or revisit the problem before building. 5–7: gather another 8 records/interviews. |
| 2 | A clinic will pay €199/month from its operating budget, not merely say it likes the idea. | Willingness to pay | High | None: two expressions of interest, no price commitment or payment. | Offer a 6-week manually operated paid pilot at €199/month to 10 qualified clinics. Collect payment or signed order before starting; do not count verbal enthusiasm. | **Hypothesis:** at least 3 of 10 pay or sign a binding paid pilot at the stated price. If 0–1, stop and test a lower-cost offer or different buyer/problem; if 2, refine and retest; if 3+, proceed to workflow validation. |
| 3 | The founder can reliably reach clinic decision-makers at an acquisition cost that leaves room for margin. | Customer access / distribution | High | Weak: unspecified conversations; no channel conversion or cost data. | Send 40 individually targeted emails/calls to clinics in one area; track verified decision-maker conversations, pilot offers, paid conversions, and hours/cash spent. | **Hypothesis:** ≥8 decision-maker conversations and ≥2 paid pilots from 40 targeted clinics, within 20 founder hours and €200 cash. Below threshold, test another channel/segment before forecasting scalable acquisition. |
| 4 | The workflow can access openings and contact eligible patients quickly without a required integration blocking use. | Feasibility / adoption | High | None: no software or workflow review. | Concierge prototype with 2 clinics for 2 weeks. Staff submit openings through a simple form; service texts opted-in patients and records claims. Review consent, clinic process, and any data handling constraints with the clinics before sending. | **Hypothesis:** both clinics can submit openings in under 2 minutes each, and at least 70% of eligible openings can be sent within 10 minutes without software integration or a workflow change they reject. If not, identify the integration or process requirement and re-cost before building. |
| 5 | Refilled appointments generate measurable value exceeding the monthly fee. | Value / economics | High | None: no baseline or attribution data. | In the same concierge pilot, log openings, sends, claims, attended appointments, and estimated contribution margin using clinic-provided figures; compare with each clinic's baseline. | **Hypothesis:** each pilot clinic recovers ≥€600/month in contribution margin attributable to filled openings (3× the €199 fee). If fewer than half reach this for two consecutive weeks, rework target segment, price, or promised outcome. |
| 6 | Messaging, support, and operations remain inexpensive enough to serve clinics profitably. | Delivery costs | High | Weak: €40/month is an estimate; founder labor excluded. | Time every manual task and record actual messaging/support costs during the 2-clinic pilot; price time at a realistic loaded hourly rate. | **Hypothesis:** recurring direct cost is ≤€80/clinic/month including 30 minutes of support, leaving at least 60% gross margin at €199. Above threshold, automate only the costly step or raise price/revise scope; do not assume scale will fix it. |
| 7 | Staff will use the service consistently and patients will accept the claim-by-text flow. | Adoption / retention | High | None: no use data. | Concierge pilot; record weekly openings submitted, eligible messages, claim rate, staff time, opt-outs, and reasons for missed usage. | **Hypothesis:** each clinic submits ≥80% of eligible openings weekly, ≥20% of recipients claim, and opt-outs stay below 5% over 4 weeks. If staff usage misses threshold, diagnose workflow friction; if patient response misses, test timing/message before product build. |
| 8 | Clinics will continue paying after novelty and founder attention fade. | Retention | High | None: no ongoing users. | After a paid 6-week pilot, offer renewal at €199/month with no discount; observe actual renewal and usage for a further 8 weeks. | **Hypothesis:** ≥70% of paid pilot clinics renew and continue submitting openings in 6 of 8 weeks. If fewer renew, interview both churned and retained clinics and resolve the value/workflow gap before scaling. |
| 9 | A €25,000 build is necessary before learning the key risks. | Capital allocation | Medium | None: estimate lacks scoped requirements; concierge path appears possible. | Run tests 1–7 using forms, spreadsheets, and an existing messaging provider; obtain a fixed-scope build estimate only after the required workflow is known. | **Hypothesis:** no essential learning in tests 1–7 requires custom software. If manual service cannot test a stated critical assumption, build only the smallest technical slice needed to resolve that specific blocker. |

## Recommended testing order before substantial development spending

1. **Validate the pain with records, not opinions** (assumption 1). Interview clinics and request recent cancellation and recovery counts. Drop or narrow the idea if the problem is infrequent or already handled adequately.
2. **Test payment intent at the proposed price** (assumption 2). Ask for money or a binding paid pilot. Do this before treating positive interviews as demand.
3. **Check that you can reach buyers economically** (assumption 3). Measure time and cash per qualified conversation and paid pilot; otherwise the sales model is just a hope.
4. **Run a paid, concierge pilot** that simultaneously checks workflow feasibility, value, adoption, and delivery cost (assumptions 4–7). Use existing tools and a small number of clinics; log behavior, staff time, and costs.
5. **Test renewal** (assumption 8). Continued payment and repeated use are stronger evidence than a pilot signup.
6. **Only then scope custom software** (assumption 9). Build around measured workflow bottlenecks and validated economics; retain a manual fallback until the product proves reliable.

## Go / no-go gate before a substantial build

For this example, do not commit the €25,000 build estimate unless all of these are true:

- At least 3 target clinics have paid or signed a binding pilot at €199/month.
- Pilot data show the target clinics have a frequent, costly problem and recover enough value to justify the price.
- Clinics and patients complete the workflow repeatedly without an unplanned integration requirement.
- Direct recurring delivery costs support a plausible gross margin.
- Most paid pilots renew at full price and keep using the workflow.

A missed threshold is a decision to revise the segment, offer, price, or workflow and run a narrower retest—not a reason to explain away the result. Keep a dated evidence log and distinguish observed behavior (payment, use, renewal) from stated beliefs (interest, intent, compliments).

## Evidence log template

| Date | Assumption | What was tested | Observed behavior / source | Result vs threshold | Decision / next test |
|---|---|---|---|---|---|
| | | | | | |
