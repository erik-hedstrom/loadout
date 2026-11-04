# Assumptions register and pre-build test plan

> **Scope:** This register is for the illustrative clinic reminder business in [sample_business_plan.md](sample_business_plan.md). It is not a diagnosis of your actual business. Every baseline evidence rating is “none supplied.” Update it with observed evidence before committing significant build spend.

## How to read the ranking

Impact is the consequence if the assumption is false (High / Medium). Evidence strength describes what the sample plan actually supports (None). Rank puts high-impact, weakly evidenced assumptions first. A passed test reduces uncertainty for that specific segment and offer; it does not prove the whole business.

## Register

| Rank | Category | Assumption to test | Evidence vs. belief | Impact if wrong | Evidence strength | Cheapest useful test |
|---:|---|---|---|---|---|---|
| 1 | Demand / problem severity | Target clinics have frequent, costly unused slots and actively want to reduce them | No clinic records supplied. Belief: the problem is common and painful enough to buy a solution. | High | None | Review anonymized 8–12 week appointment data with 10 clinics; interview about the last actual missed-slot incident and current workaround. |
| 2 | Willingness to pay | The buyer will pay €79/month, rather than merely express interest | No quote, order, or payment evidence. Price is invented. | High | None | Offer a defined 6-week paid pilot at €79/month to qualified clinics; ask for signed order/payment, not hypothetical intent. |
| 3 | Customer access / distribution | Founder can reach clinic decision-makers at tolerable time and cost | No list, response rate, conversion data, or partner commitment supplied. | High | None | Build a list of 50 clinics and run a tracked, personalized outreach sprint; record valid contacts, meetings, and pilot commitments. |
| 4 | Feasibility / workflow fit | A reminder and reschedule link can work with clinic calendars and patient communication rules without disrupting staff | No workflow observation, integration assessment, or technical spike supplied. | High | None | Concierge prototype: clinic exports a daily schedule; manually send compliant test reminders to consenting patients and process replies with staff. Check whether the real workflow succeeds. |
| 5 | Delivery cost / unit economics | SMS, support, integrations, and onboarding leave adequate gross margin at €79/month | No cost estimate, vendor quote, or support-time observation supplied. | High | None | Obtain SMS/vendor quotes; manually cost a pilot using actual message volume and logged founder support time; model low/median/high usage. |
| 6 | Retention / durable value | Clinics keep using and paying after initial curiosity because the service recovers slots or reduces staff work | No usage, outcome, or renewal data. | High | None | Run paid pilots through at least one normal billing cycle; measure eligible reminders, successful reschedules, staff minutes, and renewal/payment. |
| 7 | Outcome attribution | Reminders cause incremental recovery rather than shifting appointments that would have been rebooked anyway | No comparison or baseline supplied. | Medium–High | None | Compare a small randomized or alternating cohort against business-as-usual where practical; measure filled slots and no-show rate, not clicks alone. |
| 8 | Buyer / user alignment | Owner approves purchase and front-desk staff can adopt the workflow | No buyer interviews or observed use. | Medium–High | None | In discovery, include owner and front-desk staff separately; test a workflow mock-up with the staff who would operate it. |

## Tests with thresholds and decisions

Thresholds below are **proposed decision rules**, not industry benchmarks. Use the same segment, offer, and denominator throughout each test. Avoid counting polite agreement as a success.

### 1. Verify painful, measurable demand

- **Hypothesis:** At least 6 of 10 clinics in the target segment can show recurring unfilled appointments or late cancellations, and at least 4 can quantify a material monthly cost or staff burden using their own records.
- **Test:** Ask for anonymized appointment/no-show records covering 8–12 weeks, then conduct a short review with the owner or manager. Ask what happened the last time, what they did, and what it cost; do not pitch first.
- **Success threshold:** 6/10 show recurring events and 4/10 document meaningful cost or burden. “It happens a lot” without a record is not a pass.
- **Next decision:** Pass: keep the segment and test payment. Fail: narrow to clinics with higher evidenced volume or stop this problem framing before building.

### 2. Test willingness to pay with a real commitment

- **Hypothesis:** At least 3 of 15 qualified clinics will commit to a 6-week paid pilot at €79/month (or explicitly pay the equivalent pilot fee) after seeing the workflow and expected setup requirements.
- **Test:** Offer the same specific scope, terms, and price to each qualified clinic. Request a signed pilot order or payment; record objections and no decisions.
- **Success threshold:** 3 paid/signed commitments out of 15 qualified offers. Verbal enthusiasm, waitlist signups, and nonbinding letters do not pass this threshold.
- **Next decision:** Pass: deliver pilots manually and test value/retention. 1–2: revise segment, packaging, or price and run one focused retest. 0: do not build the proposed product; revisit the problem or buyer.

### 3. Test whether customer access is repeatable

- **Hypothesis:** A founder can contact decision-makers and obtain qualified conversations without an uneconomic sales burden.
- **Test:** Contact 50 clinics through one defined channel over two weeks, with two follow-ups. Track delivered contacts, replies, qualified meetings, and paid-pilot offers/commitments. Record actual hours and cash cost.
- **Success threshold:** At least 10 qualified conversations and 3 paid-pilot commitments from this or the payment test; direct outreach effort averages at most 30 minutes per qualified conversation. Treat the time ceiling as a planning gate to revise to your economics.
- **Next decision:** Pass: repeat with a second cohort to check consistency. Fail: test one alternative channel or segment before assuming partnerships will solve access.

### 4. Test workflow and technical feasibility without an MVP

- **Hypothesis:** Staff can reliably use the reminder/reschedule flow with the clinic’s existing scheduling process, with no more than 10 minutes of added staff work per clinic per day during a pilot.
- **Test:** Make a clickable mock-up or use a spreadsheet and manual sending for 2 weeks at 2–3 clinics. Observe setup, exceptions, replies, rescheduling, and consent handling. Do not automate before documenting the edge cases.
- **Success threshold:** At least 90% of intended reminders are correctly matched and delivered in the manual process; no serious scheduling errors; median added staff work is ≤10 minutes/day. This is an initial feasibility gate, not proof of production reliability.
- **Next decision:** Pass: scope a narrow integration/build spike for the proven workflow. Fail: simplify to a lower-friction workflow or reject the integration-heavy concept.

### 5. Test delivery cost and margin

- **Hypothesis:** At €79/month, variable messaging and support costs can remain below €24 per clinic per month (30% of revenue), excluding one-time development and acquisition costs.
- **Test:** Use actual pilot message volumes and support logs plus written supplier pricing; model a typical and high-volume clinic. Include payment fees and failed-message/retry costs where known.
- **Success threshold:** Variable cost is ≤€24 in the typical case and remains below €40 in the high-volume case, with no unpriced integration/support burden. These thresholds are illustrative and must be replaced if your target gross margin differs.
- **Next decision:** Pass: proceed to broader pilot economics. Fail: raise price, cap usage, change delivery method, or stop before scaling.

### 6. Test retention and outcome

- **Hypothesis:** At least 2 of the first 3 paid pilot clinics renew at the same price after seeing measurable operational benefit; pilot users repeatedly use the workflow.
- **Test:** Run pilots through 6–8 weeks and one renewal decision. Capture baseline and pilot period: missed visits, recovered slots, staff time, eligible reminders, successful confirmations/reschedules, and unresolved issues.
- **Success threshold:** At least 2/3 renew or pay for the next period; each renewing clinic has repeated weekly usage and can point to a measured benefit. If the sample is smaller than three, treat as directional only.
- **Next decision:** Pass: consider a small production build and expand the cohort. Fail: diagnose whether value, workflow, or buyer is wrong; do not infer retention from usage during a free pilot.

## Recommended testing order before substantial development

1. **Problem evidence (10 clinics):** verify event frequency and cost with records. Stop or narrow if evidence is weak.
2. **Access plus paid commitment (50 prospects / 15 qualified offers):** test whether you can reach buyers and whether anyone pays the stated price. Avoid a full build if no one commits.
3. **Manual workflow pilot (2–3 clinics):** check feasibility and staff burden, using consenting participants and a human-operated process.
4. **Cost model from actual usage:** use the pilot’s message and support data to challenge the €79 price and margin assumption.
5. **Renewal and outcome check (6–8 weeks):** require payment/renewal and a measured benefit before expanding development.
6. **Only then fund a narrow MVP:** build the smallest workflow that manual pilots proved useful and operationally viable; preserve explicit gates for integrations and automation.

## Evidence log template

Record one row per observation. Keep stated opinion distinct from behavior.

| Date | Clinic / role | Assumption | Observed evidence (quote or artifact) | Behavior / commitment | Result against threshold | Decision / follow-up |
|---|---|---|---|---|---|---|
| YYYY-MM-DD | Example clinic / owner | Demand | Anonymized appointment report reviewed | Shared records; no purchase yet | Pending | Ask permission to make a paid pilot offer |

## Replace this example with your plan

To tailor the register, provide a concise summary of: customer, problem, proposed solution, pricing, distribution, costs, and current evidence. Include what people have actually done (for example, records shared, time spent, order signed, money paid, usage, or renewal), not only what they said.
