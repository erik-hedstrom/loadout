# Sales and Support Customer Outcomes Agreement

**Status:** Discussion draft  
**Owners:** Sales lead and Support lead  
**Review cadence:** Monthly for the first quarter, then quarterly  
**Effective date:** To be agreed

## Purpose

Sales and Support share responsibility for customer outcomes. This agreement makes each stage of the customer relationship explicit, gives the team a predictable way to respond to risk, and separates fixable process failures from external causes. It is a working agreement for the two team leads; it does not replace customer contracts or incident policies.

## Working assumptions

- **Sales owns the commercial relationship through signature and owns renewals** in this draft, including renewal forecast, commercial proposal, negotiation, and recording the customer’s decision. If the company has a Customer Success or account management team, the leads should name it as renewal owner and update the matrix before adopting this agreement.
- **Support owns technical/service issue coordination** after handoff, including ticket prioritization, troubleshooting, customer updates on support cases, and escalation to engineering or service operations.
- The account’s named Sales representative remains its commercial contact after handoff; Support is not expected to negotiate pricing, contract terms, or concessions.
- A single named **case coordinator** keeps each active escalation moving. Coordination does not transfer the underlying work or accountability from the accountable owner.
- The response targets below are internal working targets, measured during staffed business hours unless an applicable customer contract or published service commitment requires a faster response.

## Responsibilities by stage

| Stage | Accountable owner | Other team’s obligations | Required exchange / record |
|---|---|---|---|
| Sales promises and scope | Sales | Support reviews technical feasibility, known constraints, support coverage, integrations, and delivery dependencies when asked; flags commitments that need validation before they are made. | Sales records customer goals, use cases, success measures, users, products, integrations, timeline, dependencies, exclusions, support expectations, and every non-standard promise in the CRM. Support returns feasibility, risks, and named dependencies in writing. No unapproved product, delivery, or service commitment is represented as confirmed. |
| Customer handoff | Sales until accepted; Support accountable for acceptance and transition | Sales schedules and attends the handoff, introduces the Support contact, explains context, and closes information gaps. Support reviews the packet and confirms acceptance or lists missing items. | Handoff packet: signed scope/order, customer contacts and roles, goals/success criteria, promised outcomes and exceptions, deployment plan, technical architecture/dependencies, risks, open issues, decision process, and agreed next steps. Target: within two business days of signature or before kickoff, whichever comes first. Support acknowledges within one business day. |
| Onboarding | Support (or named onboarding lead) | Sales stays engaged for commercial/context questions, reinforces agreed success criteria, and does not make new delivery promises without owner review. Support runs kickoff, plan, technical setup, training, and progress updates. | Shared plan with milestones, owners, dates, customer dependencies, risks, adoption signals, and acceptance criteria. Updates and decisions are logged in the account record; missed milestones are raised to Sales and the customer with a recovery plan. |
| Ongoing support | Support | Sales provides account and commercial context, helps reach the right customer stakeholders, and joins when an issue affects trust, scope, or commercial expectations. Sales does not redirect or close support issues. | Ticket includes impact, affected users/workaround, reproduction details, severity, timestamps, owner, next update time, and resolution. Support shares material account risk and customer-impacting changes with Sales; Sales shares relevant stakeholder, contract, and commitment context with Support. |
| Renewal risk | Sales (renewal owner, per assumption) | Support supplies factual service history, unresolved issue status, adoption blockers, and recovery plans; joins customer recovery meetings when service issues are a material factor. Sales owns the renewal plan, stakeholder map, forecast, and commercial next step. | At-risk reason, evidence, customer impact/quote, risk level, renewal date, decision makers, recovery actions, owners, due dates, and next customer checkpoint recorded in CRM. Review at least 120 days before renewal where the term allows; earlier for short terms or known risk. |
| Churn review | Sales lead chairs; both leads accountable for a balanced review | Sales brings promise, relationship, and commercial history. Support brings case, reliability, onboarding, and adoption evidence. Each team validates the other’s evidence and names any controllable action it owned. | Within 15 business days of confirmed churn, document customer-stated reason, timeline, evidence, controllable contributing factors, external factors, confidence, lessons, and corrective action owner/date. Separate primary cause from contributing factors; do not assign cause based on team opinion alone. |

## Handoff and ownership rules

1. The originating owner keeps responsibility until the receiving owner explicitly accepts the handoff in the shared record. Silence is not acceptance.
2. A handoff is complete when required fields are present and the receiving owner acknowledges the next action and date. If information is missing, the receiver names the gap; the originator supplies it within one business day or states why it is unavailable and who will obtain it.
3. Customer-facing communications should name one next step, one responsible person, and a date for the next update. Both teams may participate, but the customer should not have to reconcile internal ownership.
4. Record decisions and material customer updates in the shared CRM/account record or linked case. Use the system of record rather than private messages for commitments and status.

## Escalation process

### Triggers

Escalate when any of these occurs:

- A customer-impacting issue has no clear owner, workaround, or next update by the target below.
- A promise or scope mismatch is likely to block onboarding, create material rework, or contradict what the customer was told.
- A critical workflow is unavailable, data integrity/security may be affected, or multiple customers are materially affected. Follow the company’s incident/security process as well.
- The customer explicitly raises cancellation, non-renewal, executive escalation, or loss of confidence.
- A renewal is within 120 days and there is an unresolved material issue, low adoption, an unengaged decision maker, or an at-risk forecast.
- A cross-team disagreement blocks a customer action for more than one business day, or a committed customer update is at risk.

### Severity and internal response targets

Targets are time to acknowledge and assign a coordinator, not a guarantee of resolution. Acknowledge the customer within the same target when appropriate, and state the next update time even when the cause is unknown.

| Level | Customer impact / trigger | Internal acknowledge and coordinator assigned | Update rhythm |
|---|---|---:|---|
| **P1 Critical** | Core service unavailable for many users, suspected security/data incident, or severe business interruption | 15 minutes during staffed coverage; immediately invoke incident/security process | At least every 30 minutes until stable, or incident policy cadence if faster |
| **P2 High** | Major workflow blocked for a customer, no viable workaround, renewal/cancellation threat tied to an active issue, or high-impact commitment failure | 1 business hour | At least every 4 business hours; daily written summary if longer |
| **P3 Moderate** | Partial degradation, workaround exists, onboarding milestone or individual team affected, or risk can be contained | 1 business day | Daily on active customer-impacting work; otherwise at each material change and agreed checkpoint |
| **P4 Routine** | Low-impact question, request, or disagreement with no immediate customer or renewal consequence | 2 business days | At agreed ticket/account cadence |

If the company’s published support SLA is stricter, use it for customer response. Severity can be raised as impact changes; it should not be lowered without recording why and notifying affected owners.

### Coordinator and resolution ownership

- **P1/P2 service or technical issue:** Support lead assigns a Support case coordinator. Support remains accountable for technical resolution and customer case updates. The coordinator brings in engineering/operations and informs Sales when account trust, scope, or renewal is affected.
- **P1/P2 promise, scope, or commercial issue:** Sales lead assigns a Sales coordinator; Sales remains accountable for correcting the commitment and commercial response. Support provides technical facts and feasibility.
- **P3/P4:** The accountable owner for the stage assigns the coordinator. When two teams have active tasks, the coordinator tracks the combined action list and customer update, while each task retains its named owner.
- **Risk of churn or executive escalation:** Sales is the customer-facing commercial coordinator under the renewal assumption. If the cause is a support case, Support owns diagnosis and recovery actions and supplies updates for the shared customer plan.

### Decision path for disagreements

1. The two named owners put the disputed fact, customer impact, evidence, and options in the shared record. They continue any safe, reversible action that protects the customer while the issue is reviewed.
2. The team leads meet or confer within one business day for P1/P2 and within three business days for other disputes. They decide an interim customer-safe course and record the rationale and owner.
3. If the leads cannot agree, the issue goes to their common manager (or the designated executive sponsor) for a decision within one further business day for P1/P2 and five business days otherwise. That decision resolves internal priority and ownership; it does not change contractual commitments or waive required incident/security procedures.
4. The coordinator communicates the agreed action and next update to the customer. Disagreement is reviewed after resolution for process learning, not in front of the customer.

## Example: risk and escalation in practice

A customer was told during sales that a data integration would be ready for kickoff. At kickoff, Support finds that a required API permission is not available in the customer’s environment; onboarding is blocked, and the renewal is four months away.

- Support records the blocker, customer impact, evidence, workaround options, and next update, then rates it P2 if no viable workaround exists. Support is technical case owner and coordinates the investigation.
- Sales checks the CRM and meeting notes, confirms exactly what was promised and to whom, and contacts the customer’s commercial stakeholder with Support’s agreed facts and recovery plan. Sales owns correcting any expectation or scope mismatch and the renewal plan.
- The leads jointly agree a dated recovery plan: validate a supported integration path within one business day; if unavailable, present a feasible alternative and impact by the next customer checkpoint. Each action has one named owner.
- If Support and Sales disagree about whether the feature was committed, they record the evidence and escalate to their leads within one business day. The customer still receives a clear status and next update on schedule.
- The churn review later records a preventable contribution only if evidence shows a controllable failure (for example, an unreviewed promise or a missed handoff). It also records external dependencies, such as the customer’s permission change, if supported by evidence.

## Shared measures

Review trends as a pair; do not use a single metric as a team ranking or individual quota. Segment by product, customer size, tenure, and renewal cohort where possible.

| Measure | Shared definition and guardrail |
|---|---|
| Handoff completeness and timeliness | Percent of signed customers with required handoff fields and receiving-owner acceptance before kickoff; report missing-field categories, not just a pass rate. |
| Time to first meaningful value | Median days from kickoff to the customer’s first agreed success outcome; exclude customer-paused time only when the pause and dates are documented. Review alongside onboarding completion and customer feedback. |
| At-risk recovery rate | Share of accounts flagged at risk that reach an agreed, customer-validated recovery outcome by the review date; retain the original risk flag and include unresolved cases to prevent hiding risk. |
| Customer-impacting issue follow-through | Share of P1/P2 cases meeting acknowledgment and update targets, plus reopened cases and customer-reported impact; avoid optimizing response speed at the expense of resolution quality. |
| Churn and preventability mix | Logo and revenue churn by cohort, with evidence-based cause categories and confidence; report preventable, external, mixed, and unknown separately. Do not set a target that rewards relabeling churn as external. |

## Churn cause and preventability standard

For each churned account, classify the primary cause and any contributing factors as:

- **Preventable:** Evidence indicates an action within Sales or Support control could reasonably have changed the outcome, such as an inaccurate promise, incomplete handoff, avoidable delay, unresolved recurring issue, or missed risk follow-up.
- **External:** The principal cause was outside both teams’ reasonable control, such as a customer business closure, mandated budget elimination, acquisition-driven consolidation, or a documented strategic change unrelated to product/service experience.
- **Mixed:** Both controllable failures and external conditions materially contributed.
- **Unknown:** Evidence is insufficient or the customer did not provide a reliable reason. Do not force a preventability judgment.

Record the customer’s stated reason separately from the team’s evidence-based assessment. Note evidence sources, timeline, confidence (high/medium/low), and whether the customer validated the interpretation. Review classification jointly; either lead may request a recheck when new evidence appears. The purpose is learning and targeted improvement, not allocating blame or adjusting team credit.

## Review cadence and maintenance

- **Weekly operating check (15 minutes):** Sales and Support leads review open P1/P2 escalations, at-risk renewals inside 120 days, overdue cross-team actions, and upcoming customer checkpoints.
- **Monthly first-quarter review (30 minutes):** Look at the shared measures, a sample of handoffs and churn cases, repeat friction, and whether response targets are workable. After three months, move to quarterly if the process is stable.
- **Quarterly agreement review:** Confirm role assumptions, especially renewal ownership; revise targets or fields based on evidence; record decisions, version date, and named owners. Either lead can call an ad hoc review after a material process failure.

## Adoption checklist for the team leads

- Confirm renewal owner and the common-manager escalation path.
- Name the CRM/account record and case system used as the source of truth.
- Confirm staffed hours, incident/security policy links, and any customer-specific SLA overrides.
- Add or map the required handoff and risk fields in existing tools.
- Share this agreement with both teams and review the example scenario together.
