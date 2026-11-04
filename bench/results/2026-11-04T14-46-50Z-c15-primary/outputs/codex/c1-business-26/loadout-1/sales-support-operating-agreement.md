# Sales and Support Shared Customer Ownership Agreement

**Status:** Draft for discussion  
**Owners:** Sales lead and Support lead  
**Effective date:** To be agreed  
**Review cadence:** Monthly for the first 90 days, then quarterly

## Purpose

Give customers a consistent experience from the first promise through renewal, make one person clearly accountable at each stage, and resolve risk quickly without assigning blame. This is a working agreement; team leads should replace role names and targets if their coverage model differs.

## Working assumptions

- **Sales owns the commercial relationship and renewal**, including forecast, pricing, contract scope, and renewal decision. The assigned account executive (AE) is accountable for renewal coordination. If the company has a Customer Success (CS) team, CS should take day-to-day adoption and renewal-risk coordination, with the AE accountable for the commercial outcome.
- **Support owns technical issue resolution** and customer-facing incident updates for support cases. Support does not own commercial concessions or renewal commitments.
- The named stage owner remains accountable for progress and customer communication even when another team performs tasks. Ownership changes only through an explicit handoff accepted by the next owner.
- Targets below are proposed business-hours targets (local business day, Monday–Friday, excluding holidays), not contractual SLAs. Severity 1 coverage requires an agreed on-call rota; if none exists, set one before promising an after-hours response.
- “Customer” includes the customer’s authorized contacts and relevant stakeholders. Record decisions, commitments, and risks in the shared CRM/account record and link support tickets.

## Responsibility map

| Stage | Accountable owner | Other team’s obligations | Required exchange / record |
|---|---|---|---|
| Sales promises and scope | AE / Sales | Support validates feasibility, dependencies, limits, and supportability for non-standard technical or service commitments before they are offered. Support flags known product gaps and operational constraints. | AE records customer goals, use case, success criteria, users, integrations, security/compliance needs, promised features/dates, exceptions, pricing/terms, and who approved each exception. Support gives written feasibility notes and risks. No unapproved roadmap or delivery date is presented as committed. |
| Customer handoff | AE until accepted; then onboarding owner | Support provides known open-ticket context, technical contacts, and support-channel guidance; Sales attends the handoff and clarifies what was sold. | Within 2 business days of signature (or before kickoff), AE shares the sales record and holds a handoff. Receiving onboarding owner accepts or returns it with missing items within 1 business day. Record desired outcomes, stakeholders, scope, promises, risks, timeline, dependencies, and open issues. |
| Onboarding | Onboarding lead (CS if present; otherwise named implementation owner) | Sales joins kickoff or first value checkpoint when requested and resolves scope/commercial mismatch. Support advises on setup, diagnoses support defects, and documents known workarounds. | Onboarding plan with owner and due date per milestone, customer tasks/dependencies, baseline, target first-value date, configuration, training, and open risks. Log blockers and decisions; share material schedule changes with AE and Support. |
| Ongoing support | Support case owner for each case; Support lead accountable for service process | Sales supplies business impact, relationship context, and stakeholder access; avoids directing technical work outside the ticket. Support informs AE of material risk, repeated incidents, and customer dissatisfaction. | Ticket contains severity, impact, affected users, reproduction/evidence, workaround, next update time, technical owner, and resolution. Link account; summarize customer-visible updates and recurrence. |
| Renewal risk | AE accountable for commercial renewal; CS/onboarding owner coordinates adoption-risk plan when present | Support identifies reliability/product friction and gives evidence, incident trend, workaround, and recovery forecast. Sales shares renewal date, decision process, commercial constraints, and customer sentiment. Each team completes its agreed actions. | Shared risk entry includes signal, customer impact, source/evidence, risk level, renewal date, decision makers, recovery actions, named owner and due date, next customer touch, and outcome. Review monthly, weekly for high risk. |
| Churn review | Sales lead accountable for commercial outcome review; Support lead co-reviews service causes | Both teams provide records and a factual timeline, identify controllable process gaps, and propose one improvement each where warranted. Neither team unilaterally labels fault. | Within 10 business days of confirmed churn, capture reason stated by customer, evidence, timeline, commitments, usage/incident context, alternatives, preventability classification, confidence, and follow-up actions. Share findings with both teams. |

## Handoff and working rules

1. **One customer-facing coordinator at a time.** Stage owner names the coordinator in the account record. A ticket keeps its Support case owner; the account coordinator connects case work to the broader customer plan.
2. **Make commitments visible.** Any material promise, scope exception, or date is written in the CRM. A verbal promise is entered by the person who made it by the end of the next business day.
3. **Acknowledge before transferring.** The outgoing owner keeps responsibility until the incoming owner accepts the handoff. If acceptance is delayed, the current owner escalates to the relevant team lead.
4. **Communicate with the customer as one team.** Share facts and next steps, not internal blame. The coordinator tells the customer who is doing what and when the next update will arrive, including when there is no new resolution.
5. **No silent risk.** A material risk is logged and sent to the AE and Support lead (and CS/onboarding owner if present) within one business day. High risk is raised the same day.

## Escalation levels and response targets

Targets are for acknowledgment and ownership, not guaranteed resolution. The clock runs during stated business hours. For Sev 1, use the on-call path if the customer impact continues outside business hours.

| Level | Trigger examples | Acknowledge / assign | Update cadence | Coordinator |
|---|---|---|---|---|
| **Sev 1 – Critical** | Broad service outage or critical workflow unavailable; material security/data-integrity concern; no viable workaround and imminent severe business harm. | 15 minutes, 24/7 only where staffed; otherwise immediate on-call paging per agreed coverage. | At least every 30 minutes while critical; give next update time even if unchanged. | Support incident lead. AE owns parallel executive/customer relationship coordination; one agreed customer message. |
| **Sev 2 – High** | Major function degraded for multiple users, key deadline at risk, repeated failure, or credible cancellation/renewal threat tied to unresolved product/service issue. | 1 business hour. | At least every 4 business hours or at the agreed customer cadence. | Support case owner for technical issue; account coordinator (AE or CS) for cross-team recovery plan. Name one explicitly. |
| **Sev 3 – Standard** | Limited impact, partial workaround available, individual or non-critical workflow affected; emerging dissatisfaction without immediate material business risk. | 1 business day. | Every 2 business days or as agreed. | Support case owner; AE/CS notified if renewal or account risk emerges. |
| **Sev 4 – Routine / improvement** | Question, request, low-impact defect, or enhancement without a time-critical dependency. | 2 business days. | At milestone or weekly if open. | Support case owner; account owner consulted for roadmap or commercial context. |

**Commercial and relationship escalations:** For a threatened cancellation, material contract dispute, or an unapproved promise discovered after sale, AE informs the Sales lead and Support lead within 1 business day (same day for imminent termination). AE coordinates the commercial response; Support owns any technical investigation. An escalation never changes the support severity unless the customer impact meets that level’s criteria.

## Resolution and disagreement path

- The coordinator opens a short shared action record: customer impact, verified facts, unknowns, actions, individual owners, due times, and next customer update.
- Team members challenge the proposed facts or severity directly in that record and bring evidence. The relevant functional lead decides technical priority (Support lead) or commercial terms/commitments (Sales lead); they do not override the other function’s domain decision.
- If ownership, severity, or a cross-team tradeoff remains disputed after **2 business hours at Sev 1, 1 business day at Sev 2, or 2 business days at Sev 3/4**, the two leads meet promptly. If they cannot agree within one further business day (immediately for Sev 1), the **joint executive sponsor** (e.g., VP Customer/COO) decides the cross-functional priority and names an owner. Until decided, the current stage owner/coordinator remains accountable and the customer continues receiving updates.
- Record the decision, rationale, dissenting evidence if material, and follow-up owner. Revisit the decision if new evidence changes impact or feasibility.

## Example: renewal risk during onboarding

**Situation:** A mid-market customer signed 60 days ago. Sales notes promised a 30-day launch using an integration. Onboarding discovers the customer’s legacy data format is unsupported without a mapping step. Support also finds two other customers have experienced intermittent sync failures. The customer’s operations lead says launch delay may affect a renewal decision next quarter.

**Response:** The onboarding owner remains account coordinator and records high risk the same day. They separate the two issues: customer-side data mapping (dependency) and possible product sync defect (Support investigation). Support opens/links a Sev 2 case if multiple users or a critical workflow are materially affected, assigns an engineer, confirms impact/workaround, and provides the next update within the target cadence. AE reviews the signed scope and sales notes, owns any commitment correction and commercial conversation, and joins a customer recovery meeting within one business day. The coordinator agrees a dated plan with the customer: validate a sample mapping, test sync, decide on workaround, and set a launch checkpoint. Sales and Support leads are notified; if they disagree whether the promise covered migration work, they use the decision path above while the coordinator continues updates.

**Record for later review:** Was the integration feasibility checked before promising the date? Was the legacy format disclosed? Was the sync defect known and communicated? Which customer dependency was late? Would a timely scope clarification, workaround, or incident response likely have changed the outcome? These facts inform preventability; they do not presume blame.

## Shared measures

Review trends by segment and cohort; use the same definitions across both teams. Pair each speed metric with a quality/customer outcome metric to reduce gaming.

| Measure | Definition / guardrail |
|---|---|
| Handoff completeness and acceptance | Share of signed customers whose required fields are complete and receiving owner accepts within target. Audit a sample for accuracy; do not reward fast acceptance of incomplete handoffs. |
| Time to first value | Median days from signature to customer-verified first agreed outcome, plus percentage meeting the mutually agreed target. Track customer-caused dependency pauses separately and show the raw duration too. |
| Support recovery quality | Resolution time by severity **and** reopen/repeat-contact rate within 14 days, with customer-reported outcome. Do not optimize closure time alone. |
| At-risk recovery rate | Share of high-risk accounts with a documented plan, owner, next customer update, and completed actions on time; pair with retained revenue and customer outcome, not risk-label volume. |
| Churn and preventability mix | Logo and recurring-revenue churn by reason, with evidence-based preventability class and confidence. Do not use a single team’s classification as a performance score. |

No metric should be used to compare individual teams without reviewing case mix, customer segment, product reliability, and data completeness. Teams jointly own improvement where the customer journey crosses their boundary.

## Preventable churn review

Classify each churn as one primary category, optionally with contributing factors:

- **Likely preventable:** Evidence shows a reasonable action within our control (for example, an unrecorded promise, missed handoff, avoidable delay, poor incident communication, or failure to act on a known risk) was absent or late and could plausibly have changed the outcome.
- **Partly preventable / mixed:** Internal execution and external conditions both materially contributed, or evidence is incomplete. Name controllable actions separately from external factors.
- **Unlikely preventable / external:** Customer closure, acquisition, budget cut, strategic change, regulatory shift, or other factor outside either team’s reasonable control was the primary cause, with no evidenced material internal failure.
- **Unknown:** Insufficient evidence or customer feedback. Do not force a confident attribution; state what is missing.

Use customer feedback, contract and CRM history, ticket timeline, product/usage evidence, and dependency dates. Record confidence (high/medium/low), external factors, and a concrete lesson/action. Classification describes the process and circumstances, not personal fault.

## Review cadence and ownership

- **Weekly:** AE/CS and Support review all Sev 1/2 open issues and high-risk accounts; confirm owner, next customer update, and overdue actions. Keep to 30 minutes or use an async update if no discussion is needed.
- **Monthly for first 90 days, then quarterly:** Sales and Support leads review the shared measures, a small sample of handoffs/escalations, preventability decisions, and recurring friction. Assign actions with due dates and check them next review.
- **After every Sev 1 and every churn:** Hold a blameless review within 5 and 10 business days respectively. Focus on timeline, customer outcome, contributing conditions, and system changes. Publish a short summary to both teams.
- Team leads jointly own this agreement. Update targets or definitions only in a recorded revision discussed with both leads.

## Discussion decisions for team leads

1. Confirm whether AE or CS is the renewal accountable owner in the actual org design.
2. Name the joint executive sponsor and the staffed Sev 1 on-call route (including after-hours coverage).
3. Confirm business hours, time zone, and whether these proposed response targets match customer contracts.
4. Choose the shared CRM fields and location for risk/action records, then review the draft after the first 30 days of use.
