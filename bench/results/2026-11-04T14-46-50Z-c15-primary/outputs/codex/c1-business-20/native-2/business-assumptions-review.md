# Business assumptions review

> **Illustrative sample, not a review of your actual business.** No plan, files, or business evidence were provided. To complete this test run, this review uses a hypothetical product and labels all claims accordingly. Replace the sample inputs with your plan before relying on the rankings.

## Sample plan used

| Element | Illustrative input |
|---|---|
| Customer | Independent home-cleaning companies with 2–15 cleaners, owner-managed, in one metro area |
| Problem | Owners lose time coordinating jobs, handling reschedules, and chasing customer confirmations across texts and spreadsheets |
| Proposed solution | A lightweight mobile-first scheduling and customer reminder tool, with a shared team calendar and automated SMS reminders |
| Pricing | $79/month per company, with a 14-day trial |
| Distribution | Direct outreach to local cleaning businesses, referrals from bookkeepers and cleaning-supply shops, then search ads |
| Costs | Founder-built web app; estimated SMS and hosting costs below $10/account/month; founder-led onboarding and support |
| Current evidence | **None supplied.** No customer interviews, observed workflow, paid commitments, pilot results, cost measurements, or retention data are assumed to exist. |

## How to read the ranking

Impact is the consequence if the assumption is false: **High** means the business model could fail or require a major redesign; **Medium** means economics or growth could be materially impaired. Evidence strength refers only to evidence supplied for this review, so all entries are **Very weak / unverified**. The order below prioritizes high-impact assumptions that can be tested cheaply and early; it is not a claim that the assumptions are false.

## Assumptions register

| Rank | Assumption to validate | Area | Impact if wrong | Evidence strength | Cheap test, hypothesis, threshold, and decision |
|---:|---|---|---|---|---|
| 1 | Owners experience this coordination problem often enough, and it is painful enough, to seek a new solution. | Demand | High | Very weak: no behavior or customer evidence | **Recent-workflow interviews (1 week):** speak with 12 owners in the target segment. Ask them to walk through their last reschedule, missed confirmation, or scheduling conflict; do not pitch first. **Hypothesis:** at least 8/12 independently describe a recurring coordination problem and at least 6/12 show a workaround or a concrete cost (time, lost/reworked job, or customer complaint). **Decision:** if met, investigate current alternatives and buying authority; if not, narrow the segment/problem before building. Compliments or hypothetical interest do not count. |
| 2 | The target owners will pay about $79/month for a solution, rather than merely say it sounds useful. | Willingness to pay | High | Very weak: no pricing or purchase evidence | **Paid-pilot offer (1–2 weeks, after interviews):** offer a clearly scoped, manually supported 4-week pilot at $79, with payment collected or a refundable deposit credited to the first month. Contact 20 qualified owners. **Hypothesis:** at least 3 pay or place the deposit without a discount. **Decision:** 3+ supports a small pilot at this price; 1–2 means revise buyer, offer, or price and retest; 0 means do not build at this price. Verbal intent and nonbinding sign-ups do not pass. |
| 3 | The founder can reach enough qualified owners through direct outreach or partner referrals at an affordable, repeatable effort. | Customer access / distribution | High | Very weak: channels are proposed, not demonstrated | **Channel test (2 weeks):** build a list of 50 businesses in one metro and make a specific pilot offer by the proposed channel; track valid contacts, replies, qualified conversations, and paid pilots. **Hypothesis:** at least 10 qualified conversations and 3 paid pilots from 50 prospects, with no more than 20 founder hours spent. **Decision:** if met, repeat the same channel once to check reproducibility; if conversations happen but purchases do not, revisit value/pricing; if access is poor, test one partner channel before product spend. |
| 4 | A usable product can fit into the owners’ real scheduling workflow without disruptive migration or team adoption friction. | Feasibility / adoption | High | Very weak: no workflow observation or prototype test | **Concierge workflow pilot (2–3 weeks):** manually coordinate schedules and reminders for 3 paying or deposit-paying businesses using their existing tools; avoid building integrations. **Hypothesis:** at least 2/3 use the workflow for 3 consecutive weeks, enter real jobs, and have the owner plus one worker use it without founder intervention on most days. **Decision:** if met, prototype only the repeated workflow; if not, identify the adoption or migration blocker and retest the workflow before coding. |
| 5 | SMS, support, onboarding, and payment costs leave healthy contribution margin at $79/month. | Delivery costs / unit economics | High | Very weak: cost estimate is unmeasured | **Measure during concierge pilot:** record SMS volume and provider quotes, onboarding/support minutes, payment fees, refunds, and any manual work for each account; make a simple per-account monthly cost model. **Hypothesis:** variable delivery cost is no more than $20/account/month after onboarding, and ongoing support is under 30 minutes/account/month. **Decision:** if met, keep testing at $79; if not, test usage limits, self-serve onboarding, or a higher price and rerun the paid offer before building. Include founder labor at a realistic hourly cost. |
| 6 | Customers continue using and paying after the initial setup or novelty period. | Retention | High | Very weak: no cohort or repeat-use data | **Pilot continuation test (4–8 weeks):** after the paid pilot, offer the next month at the stated price; measure actual renewal and weekly use of scheduling/reminders. **Hypothesis:** at least 2/3 of pilot customers pay for month two and use the core workflow weekly. **Decision:** if met, continue a limited MVP; if not, interview both renewers and non-renewers, address the cause, and repeat before scaling acquisition. A trial start is not retention evidence. |

## Recommended testing order

1. **Confirm the problem and segment** with recent-behavior interviews (rank 1). Stop or refine if the problem is infrequent, low-cost, or already adequately handled.
2. **Test real payment behavior** with a paid pilot at the intended price (rank 2). Do this before committing to product development.
3. **Measure customer access** through the actual proposed channel (rank 3), tracking time and conversion rather than relying on a channel idea.
4. **Run the workflow manually** with real jobs (rank 4). This exposes adoption and operational friction without building the full product.
5. **Measure delivery economics** while serving those pilot customers (rank 5). Reprice or simplify if the cost ceiling fails.
6. **Observe renewal and repeat use** (rank 6). Treat renewal as an early retention signal, not proof of long-term retention.

### Spending gate

Before substantial development spending, aim for all of the following: repeated evidence of a costly, recurring problem in the chosen segment; several independent customers who have paid at the intended price; a repeatable way to reach them; a manually demonstrated workflow customers actually use; measured delivery costs compatible with the price; and at least one paid renewal signal. These thresholds are suggested decision rules for this sample, not universal benchmarks. If an early gate fails, revise the underlying assumption and test it again rather than building around it.

## Evidence discipline

- **Evidence in this review:** none about an actual business. The product, target market, price, channel, and all numeric thresholds are illustrative inputs for a sample exercise.
- **Beliefs to replace with evidence:** every claim that owners have this pain, will pay $79, can be reached through the proposed channels, will adopt the workflow, can be served profitably, and will renew.
- **Count behavior, not praise:** observed workarounds, time or money spent, completed paid pilots, actual workflow use, measured service effort, and paid renewals are stronger evidence than compliments, survey enthusiasm, waitlists, or nonbinding promises.
