# Shared Customer Ownership Agreement

**Draft for discussion between Sales and Support**  
**Purpose:** Improve customer outcomes by making ownership, handoffs, and escalation predictable. This is a lightweight working agreement; team leads should confirm the targets against staffing and existing customer commitments.

## 1. Working principles

- The customer has one coordinated plan even when several teams contribute. The named owner for the current stage keeps the customer informed and drives the next action.
- Sales owns the accuracy of what is sold and promised. Support owns delivery of the agreed service and the support response. Neither team can silently transfer an unresolved commitment to the other.
- Share relevant facts in the customer record: commitments, decisions, risks, owners, and dates. Avoid blame or speculation in customer-facing communication.
- Escalation is for faster decisions and help, not a performance penalty. Raise a risk early even when the facts are incomplete; label uncertainty and update it.

## 2. Assumptions to confirm

1. **Renewals:** Account Sales (the account executive or named account owner) owns the commercial renewal, forecast, pricing, and renewal negotiation. Support owns service health, support history, and a recommendation on technical/customer risk; Support does not commit pricing or renewal terms.
2. **Customer Success:** No separate Customer Success role is assumed. If one exists, assign it as the day-to-day relationship coordinator after handoff; Account Sales still owns the commercial renewal unless leadership explicitly changes that rule.
3. **Coverage:** Response targets below use the team’s published business hours in the customer’s primary time zone. A severity 1 event uses the existing on-call / incident process outside business hours. If no such process exists, leads must define one before adopting this agreement.
4. Each account has a named Account Sales Owner and Support Owner in the CRM or ticketing system. A team lead assigns a temporary owner when a named owner is absent.

## 3. Responsibility map

| Stage | Accountable owner | Other team’s obligations | Information exchanged / recorded |
|---|---|---|---|
| **Sales promises and scope** | Account Sales Owner | Support reviews feasibility for non-standard technical, service, security, support, or implementation commitments before they are offered. Support flags capacity, dependencies, and unsupported requests. | Sales records customer goals, purchased scope, exclusions, acceptance criteria, dates, dependencies, stakeholders, and every non-standard promise. Support records feasibility, constraints, risks, and the person who approved an exception. No unapproved promise is represented as committed. |
| **Customer handoff** | Account Sales Owner until Support accepts the handoff; then Support Owner for service delivery | Support acknowledges the handoff, identifies gaps, and attends a joint introduction for complex/high-risk accounts. Sales remains available to clarify deal context and commercial commitments through onboarding. | Shared handoff record: goals/use cases, contacts and decision maker, contract/package, promises and exceptions, success criteria, timeline, integrations/dependencies, known risks, open questions, renewal date, and named owners. Support accepts or returns with specific missing items within 2 business days. |
| **Onboarding** | Support Owner (or named implementation lead) | Sales reinforces business outcomes, secures customer participation, clarifies commercial scope, and helps resolve expectation gaps. Support owns the implementation plan and technical progress. | Both teams maintain milestones, customer actions, blockers, decisions, scope changes, adoption/launch evidence, and next update date in the shared record. Any scope or date change is confirmed to the customer by the owner of the affected commitment and copied to the other team. |
| **Ongoing support** | Support Owner for service and support cases | Sales supplies account context, routes commercial questions, and joins when a case reveals a promise/scope gap or material relationship risk. Sales does not direct technical triage outside the case process. | Ticket includes impact, affected users/services, start time, workaround, severity, reproduction/evidence, customer contact, updates, resolution, and follow-up. Account record reflects recurring issues, adoption concerns, and material customer sentiment. |
| **Renewal risk** | Account Sales Owner for commercial renewal and forecast | Support provides evidence-based service/adoption risk, trend, open defects, recovery actions, and realistic confidence; flags risk promptly and participates in recovery calls when useful. Sales shares renewal date, decision process, commercial constraints, and customer feedback relevant to service. | Shared risk entry includes signal and date observed, customer impact/quote, evidence, risk rating, mitigation owner/actions/dates, decision maker, renewal timeline, and next review. Forecast changes remain Sales’ responsibility; service facts remain Support’s responsibility. |
| **Churn review** | Account Sales Owner convenes; both team leads are jointly accountable for an evidence-based review | Support contributes service timeline, ticket and onboarding evidence, and recovery actions. Sales contributes promises, relationship, value, commercial timeline, and customer’s stated decision rationale. Neither team writes a unilateral verdict. | Within 10 business days of confirmed churn, record timeline, customer-stated reasons, evidence, controllable and external factors, missed signals, actions taken, and one or two learning items with owners and due dates. Mark unknowns as unknown rather than assigning unsupported cause. |

## 4. Escalation process

Any employee can raise an escalation in the shared account record or ticket, notify the current stage owner, and include the other team when the trigger crosses team boundaries. The coordinator opens a short action log: issue, customer impact, severity, owner, next update time, decisions needed, and action owners. The coordinator remains responsible for coordination until the issue is resolved or another named coordinator explicitly accepts it.

| Level | Trigger examples | Acknowledge / coordinate | Customer update target |
|---|---|---|---|
| **S1 — Critical** | Broad outage or material data/security concern; customer unable to use a critical production workflow with no workaround; credible immediate risk to safety, legal obligation, or a major committed launch. | Support incident lead acknowledges within **15 minutes** during covered hours, starts incident process, and coordinates technical response. Notify both team leads and Account Sales Owner immediately. | First update within **30 minutes**, then at least every **60 minutes** while critical. Use incident communications policy for security/legal events. |
| **S2 — High** | Major function impaired for a customer team; deadline/launch at material risk; repeated failure or unresolved issue causing a credible renewal risk; material mismatch between sold commitment and delivered scope. | Support Owner acknowledges within **1 business hour** and coordinates the service investigation. For promise/scope or renewal risk, Account Sales Owner joins and coordinates the cross-team customer plan. | First update within **4 business hours**, then at least once each business day and on any material change. |
| **S3 — Standard** | Limited impact, workaround available, routine onboarding blocker, or concern with no immediate material renewal/launch threat. | Current stage owner acknowledges within **1 business day** and coordinates next steps; consult the other team when its obligations or facts are needed. | Update within **2 business days**, then on the agreed next-update date. |

**Urgent disagreement or missed target:** The coordinator brings the specific decision, evidence, customer impact, and proposed options to both team leads within one business day (immediately for S1). The leads decide a temporary customer-safe action first, even if they disagree on root cause. If they cannot agree within one business day, the joint executive sponsor (or designated department head) decides within a further one business day. For active S1, the incident commander’s safety/containment decision stands while the disagreement is resolved. Record the decision, rationale, owner, and any dissent in the account log. Do not delay a customer update while debating internal attribution.

## 5. Example: renewal risk after an onboarding promise

**Situation:** A strategic customer says it may not renew in 90 days. During the sales cycle they were told a data integration would be available by a particular launch date. The integration is delayed; the customer has a manual workaround and reports weekly rework. Support also sees two recurring defects.

1. Support marks the risk **S2** because a committed launch and renewal are at risk, adds ticket/defect evidence and impact, and names a Support Owner for the recovery work.
2. Account Sales Owner remains accountable for the commercial relationship and renewal, confirms the original commitment and decision timeline, and contacts the customer with Support’s agreed facts. Sales does not promise a new delivery date without the delivery owner’s confirmation.
3. Account Sales Owner coordinates a 48-hour cross-team recovery plan: Support validates defect workaround and integration status; Sales confirms customer priorities and negotiates any commercial remedy within authority. Each action has a named owner and date.
4. The coordinator gives the customer a single update at the agreed time, including what is known, what remains uncertain, the workaround, and the next checkpoint. Both teams review progress twice weekly until the launch risk is cleared or reclassified.
5. If the cause is disputed, leads first agree the customer-safe plan. They review contract/sales notes, handoff record, delivery history, and customer evidence to determine whether the promise was approved, whether execution missed an agreed commitment, and what external dependencies applied. Any final cause remains evidence-based and may have multiple contributing factors.

## 6. Shared measures and anti-gaming rules

Review a small balanced set monthly. Segment by customer size, complexity, and product where useful; do not use a single measure as an individual quota.

- **Successful handoff rate:** Percentage of handoffs accepted within 2 business days with required fields complete. Pair with onboarding time-to-first-value so teams cannot improve the handoff score by rejecting difficult accounts.
- **Time to customer-safe recovery:** Median time from an S1/S2 trigger to a documented workaround or agreed recovery plan, plus the share meeting the update targets. Measure customer impact and communication, not only ticket closure.
- **Renewal outcomes for at-risk accounts:** Renewal rate and retained value for accounts flagged at least 60 days before renewal, alongside the percentage with a dated joint mitigation plan. Do not reward fewer risk flags; audit late-discovered churn as well.
- **Customer-reported outcome:** A short post-onboarding or post-recovery question (for example, “Was the issue resolved in a way that restored your ability to achieve your goal?”), reported with response rate and account context. Avoid treating low survey response as a positive score.

Use definitions consistently. Keep the same start/stop rules across teams; report reopened issues and unresolved customer impact rather than counting a premature ticket closure as recovery. Review small samples of records together before drawing conclusions from trends.

## 7. Preventable versus external churn

At churn review, classify each account using evidence and allow more than one contributing category:

- **Preventable / within our influence:** An avoidable failure in promise accuracy, handoff, implementation, service response/quality, expectation setting, adoption support, or timely risk escalation materially contributed to the decision.
- **Partly preventable / mixed:** An internal gap contributed, but external conditions also materially influenced the decision. Record each factor separately and avoid assigning the full outcome to one team.
- **External / outside either team’s reasonable control:** For example, acquisition or closure, a documented budget freeze, regulatory change, customer strategy shift, or an incumbent-mandated consolidation, with no material internal failure identified in the evidence reviewed.
- **Unknown / insufficient evidence:** Customer reason is unavailable, contradictory, or not substantiated. Do not force a preventable/external label; assign an owner to seek clarification where appropriate.

The Account Sales Owner proposes the classification with evidence; the Support lead validates service-related facts. If they disagree, both team leads review the record and decide under the escalation process. The review is for learning and prevention, not retroactive blame. Track classification changes and the evidence behind them.

## 8. Review cadence and upkeep

- **Weekly (15 minutes):** Account Sales Owner and Support Owner review open S1/S2 items, blocked onboarding, at-risk renewals within 120 days, and overdue actions. S1 follows the incident cadence above.
- **Monthly (30 minutes):** Both team leads review the shared measures, a small sample of handoffs/escalations, recent churn classifications, and repeat failure patterns. Assign an owner and due date to each process change.
- **Quarterly (45 minutes):** Leads confirm ownership assumptions, response targets, coverage, and whether customer feedback shows improved outcomes. Amend this agreement by mutual sign-off and publish the current version where both teams work.

**Lead sign-off:** Sales ____________________  Date __________  |  Support ____________________  Date __________
