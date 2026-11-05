# Assumptions register and recommended test order

> Based on the fictional sample plan in `sample_business_plan.md`. Replace the sample inputs with actual facts before using these priorities for a real investment decision.

## Scoring

- **Impact if wrong:** 1 (limited) to 5 (could undermine the business).
- **Evidence strength:** 1 (little/no behavioral evidence) to 5 (repeated, objective evidence in the target market).
- **Priority:** impact × (6 − evidence strength), highest first. This is a sorting aid, not a probability of failure.

## Ranked assumptions register

| Rank | Assumption / type | Impact | Evidence | Priority | What we actually know; what remains belief |
|---:|---|---:|---:|---:|---|
| 1 | **Demand:** enough shops experience inventory errors or labor burden to change their current routine | 5 | 1 | 25 | 6/8 mentioned frustration, but there is no measured frequency, cost, or behavior change. Complaints do not establish urgency. |
| 2 | **Willingness to pay:** a decision-maker will pay about $79/location/month | 5 | 1 | 25 | Four said they would “try” a tool. No payment, deposit, signed pilot, or budget confirmation. Price acceptance is unproven. |
| 3 | **Retention / habit:** staff will enter accurate stock data repeatedly after the first week | 5 | 1 | 25 | Two users completed one count each and did not return. Regular data entry is essential to useful recommendations. |
| 4 | **Customer access / distribution:** targeted cafes can be reached and converted at an acquisition cost supported by $79/month revenue | 5 | 1 | 25 | Founder outreach and partner referrals are proposed, not demonstrated. No response, conversion, sales-cycle, or acquisition-cost data. |
| 5 | **Delivery cost / unit economics:** onboarding, support, and ongoing operation fit the $12/month estimate and leave viable contribution margin | 5 | 1 | 25 | $12 is an estimate excluding labor, onboarding, payment fees, and selling. Cost to serve has not been observed. |
| 6 | **Feasibility / data quality:** manual counts and varied supplier formats can produce sufficiently accurate reorder lists without costly integrations | 4 | 2 | 16 | A spreadsheet flow worked for two one-off counts. There is no accuracy check against actual purchasing or test across different shops/suppliers. |

Evidence scores are low because the sample contains little behavioral evidence. The tie among the first five means testing order should consider dependencies and cost: validate problem and a real buying commitment before building, then test repeated use, acquisition, and service economics.

## Recommended testing order

### 1. Confirm costly, recurring pain (demand)

- **Cheap test:** Interview 12 qualified owners/managers using recent-behavior questions. Ask them to show the last 4 weeks of stockout, waste, ordering, and inventory work records where possible. Quantify time, incidents, and direct cost. Avoid pitching until after documenting current behavior.
- **Hypothesis:** At least 7 of 12 have a weekly inventory-related task or error and can document a meaningful burden (for example, 2+ staff hours/month or a recurring stockout/waste cost above $100/month).
- **Success threshold:** 7/12 meet both a recurring-frequency and quantified-burden criterion, supported by a concrete recent example or record.
- **Next decision:** If it passes, test a paid pilot. If not, narrow to the segment with documented pain or stop this problem direction before product build.

### 2. Test willingness to pay with a real commitment

- **Cheap test:** Offer the simplest concierge pilot to 10 qualified shops at the intended $79/location/month after a short setup. Ask for payment for month one or a refundable deposit credited to the pilot. State the exact deliverable and start date; do not count verbal enthusiasm as conversion.
- **Hypothesis:** Shops with the confirmed problem will commit money at or near the proposed price.
- **Success threshold:** At least 3/10 pay or place the stated deposit at $79/month (or explicitly accept a small, predeclared price band such as $59–$99). Track objections separately; do not silently lower price mid-test.
- **Next decision:** If it passes, deliver manually to these customers. If not, test a narrower segment, different buyer, or pricing/value proposition; do not fund a full build based on stated interest.

### 3. Test repeat usage and outcome in a concierge pilot (retention)

- **Cheap test:** Run a 4-week manual service with the paying pilot shops. Provide a simple count template and manually prepare suggested order lists. Log weekly completion, corrections, time spent, and whether the list was acted on.
- **Hypothesis:** Users will provide usable data repeatedly and act on recommendations without continuous founder chasing.
- **Success threshold:** At least 70% of participating shops submit usable weekly data in 3 of 4 weeks, and at least 60% act on one recommendation; no more than one reminder per shop per week.
- **Next decision:** If it passes, design around the proven recurring workflow and verify willingness to continue paying. If it fails, simplify data entry or reconsider whether the workflow is naturally recurring before building automation.

### 4. Validate customer access and acquisition effort

- **Cheap test:** In a 2-week outreach sprint, contact 50 shops matching the target profile through the proposed founder channel; log delivered messages, replies, qualified meetings, paid pilots, and hours spent. Separately request introductions from 5 relevant partners and track actual referrals.
- **Hypothesis:** At least one repeatable channel can produce qualified buyer conversations and paid pilots with manageable founder effort.
- **Success threshold:** At least 10 qualified conversations and 3 paid pilots from the 50 direct contacts or from a clearly attributable partner channel; record effort and channel source. This is an early signal, not proof of scalable CAC.
- **Next decision:** If it passes, estimate a conservative sales cost and run another cohort. If not, try one adjacent channel or segment before assuming content/paid search will work.

### 5. Measure cost to serve and contribution margin

- **Cheap test:** During the concierge pilot, time every onboarding, support, data-cleaning, and weekly fulfillment task; include software, messaging, and payment costs. Model costs at 10, 50, and 200 shops, explicitly separating fixed from per-shop work.
- **Hypothesis:** A stable workflow can deliver the service at a direct monthly cost low enough to support the proposed price and future acquisition costs.
- **Success threshold:** At the pilot's observed workflow, recurring direct cost is at most $25/shop/month and onboarding takes at most 2 hours/shop, with a credible plan to reduce manual work. At $79 revenue this leaves $54 before acquisition, overhead, and founder compensation; it is only a screening threshold, not proof of overall profitability.
- **Next decision:** If it passes, build only the automation that removes measured cost. If it fails, raise price, narrow service scope, or redesign onboarding before writing production software.

### 6. Check recommendation accuracy and implementation feasibility

- **Cheap test:** For 3 shops, manually generate suggested orders for 4 weeks and compare them with the manager's final order, actual consumption, stockouts, waste, and corrections. Include shops using different suppliers and item units.
- **Hypothesis:** With a practical minimum set of inputs, recommendations are accurate and actionable often enough to save time without creating costly mistakes.
- **Success threshold:** At least 80% of suggested item quantities are accepted with no more than a 20% adjustment, and no recommendation causes a material stockout or excess-waste incident in the pilot.
- **Next decision:** If it passes, specify the minimum product inputs and build a narrow workflow. If it fails, identify whether the blocker is data collection, variable demand, supplier catalog differences, or the recommendation logic; do not build integrations until the cause is known.

## Spending gate

Do not commit the estimated $25,000 production build on the current fictional evidence. A sensible gate is: documented recurring pain, at least three paid pilots near target price, repeat use through a four-week pilot, and measured delivery economics with a plausible accuracy path. A pass does not guarantee success; it earns a small, scoped build tied to the workflow and cost bottlenecks observed in those pilots.
