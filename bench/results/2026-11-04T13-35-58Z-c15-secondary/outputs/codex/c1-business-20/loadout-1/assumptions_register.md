# ShiftNote assumptions register and validation order

> **Illustrative only.** This register evaluates the synthetic plan in `sample_business_plan.md`. There is no user-supplied plan or evidence. All scores, sample sizes, costs, and thresholds are proposed test parameters, not observed market facts.

## Scoring

- **Impact if wrong (1–5):** 5 means this could invalidate the business or force a major pivot.
- **Evidence strength (0–3):** 0 means no evidence supplied; 1 is anecdote or stated interest; 2 is observed behavior or a paid commitment from a small sample; 3 is repeated behavioral evidence across the target segment. No assumption starts above 0 here.
- **Priority:** high impact combined with weak evidence. Compliments, survey enthusiasm, and non-binding statements of intent do not count as purchase evidence.

## Register

| Rank | Assumption (belief, not fact) | Impact | Evidence | Why it matters / failure mode | Low-cost test: hypothesis and method | Success threshold | Next decision |
|---|---|---:|---:|---|---|---|---|
| 1 | Target companies have frequent, costly follow-up failures that they already try to solve. | 5 | 0 | If the problem is rare, low-cost, or not a priority, product demand will be weak regardless of execution. | Interview 15 owners/office managers recruited from the target segment. Ask for the last specific missed lead or lapsed customer, what they did, and any measurable outcome. Request redacted workflow examples where possible; do not pitch before documenting current behavior. | At least 8/15 independently describe a recent specific incident, and at least 5 show an existing workaround or quantify a meaningful loss/time burden. | If below threshold, narrow the segment or stop. If met, proceed to price/commitment test; interviews alone do not validate demand. |
| 2 | A meaningful share will pay about $99/month, not merely say they like the idea. | 5 | 0 | Interest without budget or purchase behavior cannot support the proposed revenue model. | Offer a manually delivered 4-week pilot to qualified prospects. State the price clearly; ask for a paid first month or a refundable deposit credited to the pilot. Do not build the full product first. | At least 3 of 10 qualified prospects pay the stated amount or deposit, with no discount beyond 20%. | If met, deliver the pilot manually and learn usage. If not, test a lower-scope offer or different buyer/price once; do not infer willingness from compliments. |
| 3 | The founder can reliably reach qualified buyers at a sustainable cost and pace. | 5 | 0 | A viable product is still a failing business if access depends on expensive ads, weak intermediaries, or too much founder labor. | Build a list of 100 target businesses from public directories. Run a two-week personalized outreach test and track delivery, positive replies, qualified conversations, and booked pilots; record labor time. Test one partner source separately if available. | At least 10 qualified conversations and 3 paid pilot commitments from 100 contacts within two weeks, with outreach labor under 20 hours. | If under threshold, try one alternative segment or channel and compare. Do not assume a channel scales from a few warm introductions. |
| 4 | The promised workflow can be delivered with acceptable reliability and integration effort. | 4 | 0 | Calendar/SMS access, data quality, and edge cases may turn a simple product into a custom-services project. | Run a concierge prototype for 3 pilot businesses using spreadsheets and existing compliant messaging/calendar tools. Manually perform the proposed workflow; record setup time, exceptions, failed messages, and staff corrections. | Each setup completed in ≤2 hours; ≥90% of intended actions completed correctly; no critical missed/duplicate customer communication across 100 test events. | If met, scope a narrow MVP around the validated workflow. If not, remove integrations or change the promise before building. |
| 5 | Delivery costs and support time leave healthy contribution margin at the proposed price. | 4 | 0 | Messaging charges, onboarding, service labor, and support can erase subscription revenue. | During the concierge pilot, measure messages, software charges, onboarding and weekly support time per account. Obtain actual vendor quotes for the likely usage pattern and model payment fees. | At $99/month, modeled direct software and messaging costs ≤$25/account/month and steady-state support ≤30 minutes/account/month; onboarding can be recovered within 2 months. | If not met, reduce usage or service scope, raise price, or test a different packaging model before product development. |
| 6 | Users adopt the workflow repeatedly, and customers keep paying after the initial novelty. | 5 | 0 | Weak repeated use or churn makes acquisition economics unsustainable. | Run the paid manual pilot for 8 weeks with weekly usage logs and a renewal offer at the full proposed price. Track active weeks, workflows completed, and renewal; ask non-renewers for their behavior-based reason. | At least 70% of pilot accounts use the core workflow in 6 of 8 weeks, and ≥60% renew at full price. | If usage fails, interview around actual abandonment and revise workflow. If usage succeeds but renewal fails, revisit realized value or price. Do not treat trial signups as retention. |
| 7 | The product can be operated within legal, privacy, and messaging requirements for customer contact data. | 4 | 0 | Noncompliant outreach, consent handling, data retention, or vendor terms could block the core workflow or create costly obligations. | Before live messaging, map the data flow and intended consent/opt-out process; review relevant jurisdictions and vendor terms with qualified counsel or a suitable compliance advisor. Use test contacts before customer data. | A documented acceptable workflow and vendor configuration is confirmed before handling live customer data; opt-out and deletion can be demonstrated end to end. | If the required process is incompatible with the low-cost model, change the workflow or target market before launch. |

## Recommended testing order before substantial development spending

1. **Problem evidence (Register 1):** establish that the pain is frequent, specific, and currently acted on. Stop or narrow if the threshold fails.
2. **Paid commitment (Register 2):** test the actual proposed price with deposits or paid pilots. Stated interest is not a pass.
3. **Customer access (Register 3):** measure whether a repeatable channel reaches qualified buyers at plausible effort.
4. **Concierge feasibility and cost (Registers 4 and 5):** manually deliver the narrow workflow, collect real support and usage costs, and validate operational constraints. Run legal/privacy review before any live customer messaging (Register 7).
5. **Retention (Register 6):** only after pilots have run long enough, test repeated use and full-price renewal.
6. **Build decision:** authorize substantial development only if the first five commercial/operational gates pass and the live-data workflow is acceptable. Build only the workflow demonstrated in paid pilots.

## Evidence log template

For each experiment, record the date, recruitment source, participant fit, exact behavioral evidence, what the participant actually did or paid, costs and founder hours, result against the pre-set threshold, and the resulting decision. Keep raw observations separate from interpretation. Update the evidence score only when behavior justifies it; a positive interview response alone remains weak evidence.

| Date | Assumption | Sample / source | Observed behavior | Spend / hours | Threshold result | Decision / next test |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |

