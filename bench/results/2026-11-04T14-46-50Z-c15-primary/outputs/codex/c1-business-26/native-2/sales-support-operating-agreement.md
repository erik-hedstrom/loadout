# Sales and Support Operating Agreement

**Draft for discussion | Version 0.1 | 4 November 2026**

## Purpose

We share responsibility for customer outcomes. The person closest to a task owns the next action; the named accountable owner remains responsible for keeping the customer informed and driving the issue to a decision. We will discuss evidence and actions, not assign motives or blame.

This agreement covers the customer lifecycle from sales promises through churn review. It is a lightweight working agreement; team leads should confirm role names, business hours, and targets before adopting it.

## Roles and assumptions

- **Sales owner (AE):** accountable for commercial relationship, accurate commitments, customer handoff, renewal forecast, and renewal decision.
- **Support owner:** accountable for triage, technical investigation, support communications on active cases, and coordinating technical resolution.
- **Resolution coordinator:** a named person who keeps a cross-team issue moving, records decisions/actions, and maintains one customer update plan. Usually the Support owner for a technical incident; the AE for a commercial or expectation-setting issue. For a high-risk account, the team leads can name a single coordinator.
- **Team leads:** resolve capacity or ownership conflicts and make decisions when the working owners cannot agree.

**Renewal assumption:** Sales (the AE) owns renewal and commercial negotiations. Support does not carry a renewal quota or make commercial commitments, but must surface product/service risk with evidence and help validate recovery plans. If the business has a Customer Success function, it can take the relationship-health and renewal orchestration role by mutual agreement; update this document before rollout.

## Lifecycle responsibility map

| Stage | Accountable owner | Other team’s obligations | Required exchange |
|---|---|---|---|
| Sales promises | Sales / AE | Support checks feasibility of non-standard technical, implementation, security, or service commitments before they are offered; flags unsupported wording and known constraints. | AE records customer goal, use case, scope, dates, dependencies, success measure, and every non-standard promise in the CRM/order record. Support provides feasibility, limits, prerequisites, and named technical contact. No promise is “confirmed” until feasibility is checked or explicitly marked as an exception awaiting approval. |
| Customer handoff | Sales / AE until accepted by Support | Support reviews the handoff, identifies missing technical details, and accepts or returns it with specific questions within one business day. | AE provides signed scope, stakeholders and roles, goals, promised outcomes, configuration, dates, risks, open questions, and customer communication preferences. Support confirms intake, owner, next step, and any gaps. The AE stays available for clarification through initial onboarding. |
| Onboarding | Support (technical onboarding) | Sales introduces the Support owner, reinforces agreed scope, joins expectation resets, and does not make new delivery promises without Support validation. | Support shares plan, prerequisites, milestones, blockers, training needs, and evidence of completion. AE shares decision context, success criteria, stakeholder map, commercial dates, and any expectation mismatch. Customer agrees on a success measure and next checkpoint. |
| Ongoing support | Support for each case | Sales supplies account context, priority contacts, and commercial/customer impact; joins when a case may affect commitments or relationship. Sales does not reprioritize the queue through side channels. | Support records severity, impact, affected users, workaround, case owner, next update time, and resolution. AE shares renewal date, strategic context, customer sentiment, and any promised outcomes. Both teams use the shared case/CRM record for material developments. |
| Renewal risk | Sales / AE owns renewal forecast and commercial plan | Support flags product/service risks promptly, validates incident history and technical recovery claims, and participates in a recovery meeting when requested. | Support provides open and repeat cases, impact, timeline, workaround, root cause if known, and recovery status. AE provides renewal date, decision process, stakeholder sentiment, stated objections, commercial options, and next customer meeting. Risk and mitigation owner are recorded in CRM. |
| Churn review | Sales / AE owns account closeout and commercial reason; team leads jointly own learning review | Support provides case facts, service history, and any product gaps; does not accept sole responsibility for a commercial decision. | AE records customer-stated reason, alternatives, decision date, and any save attempt. Support supplies relevant case chronology and commitments. Together classify controllable contributors, external factors, evidence confidence, and follow-up actions. No individual/team performance conclusion is made from one account alone. |

## Escalation process

### Triggers

Open an escalation when any of these occur:

- A commitment appears infeasible, was made without the required validation, or differs materially from the signed scope.
- A customer-impacting issue lacks an owner, workaround, or next update by the agreed target.
- A high-impact incident affects a critical workflow, many users, or a contractual/service commitment.
- The same material issue recurs, the customer signals executive attention, or customer sentiment falls sharply.
- A customer with a renewal within 120 days has an unresolved high-impact issue, repeated material failures, or explicitly questions renewal.
- Sales and Support disagree about owner, priority, facts, or customer message for more than one business day.

Anyone can raise an escalation in the shared case/CRM record and notify the on-duty Support owner and AE. Include customer impact, evidence, what has been tried, requested decision, and next customer update deadline. A customer-facing response should not wait for an internal ownership debate.

### Severity and response targets

Targets below are **acknowledgment and coordination targets**, not guarantees of resolution. Clock runs during the published support coverage window; for after-hours critical incidents use the documented on-call route. Acknowledge means a named owner confirms receipt and next update time.

| Severity | Definition | Acknowledge / coordinator named | Customer update cadence |
|---|---|---|---|
| **S1 Critical** | Service unavailable or core workflow blocked for many customers or a business-critical customer; no reasonable workaround; safety, security, or contractual exposure suspected. | 15 minutes during coverage; notify Support lead and Sales lead immediately. | At least every 60 minutes until stable, then agree cadence. |
| **S2 High** | Major capability degraded for a customer or significant user group; workaround is absent or materially costly; renewal or commitment at immediate risk. | 1 business hour; notify both leads if not contained within 4 hours. | At least every 4 business hours, even if only to report no change. |
| **S3 Moderate** | Limited impact, partial workaround exists, or a material onboarding/commitment gap with no immediate broad outage. | 1 business day. | At least once per business day or at the next agreed milestone. |
| **S4 Routine** | How-to request, low-impact defect, or improvement request without a material deadline or broad customer impact. | 2 business days or normal published queue target, whichever is faster. | At the agreed case cadence; update when status or next step changes. |

Support assigns technical severity based on observed impact and documents the reason. AE can request review with customer/business context; Support lead confirms technical severity. When disagreement remains, use the higher severity temporarily until the leads decide. Security or privacy concerns follow the dedicated incident process immediately.

### Coordination and decision path

1. **Case owner** investigates within the severity target and posts an initial internal summary, next action, and customer update time.
2. **Resolution coordinator** is named at escalation opening. The coordinator maintains a single action list, brings in needed people, and ensures the customer gets one coherent update. The coordinator does not need to perform every task.
3. **Working-level disagreement:** AE and Support owner discuss the evidence and propose an owner/action within one business day (immediately for S1/S2). Record the options and customer impact in the shared record.
4. **Lead decision:** if unresolved by that deadline, the Sales and Support leads decide owner, priority, customer message, and any exception. For a continuing deadlock, the designated executive sponsor (or, if none is named, the functional leader who owns the customer contract) decides within one further business day. For S1/S2, decision is immediate or within one hour during coverage.
5. **Decision rule:** protect customer continuity first: assign a temporary owner, preserve the next update, and avoid withdrawing an externally visible commitment until its facts and alternatives are checked. The decision-maker records the decision, rationale, owner, and review date. Escalation is not a finding of fault.

## Example: renewal risk caused by a missed implementation expectation

A customer has a renewal in 75 days. During sales, the AE described a data import as “ready in two weeks.” The signed scope says standard import is supported, but does not document the customer’s custom field mapping. At onboarding, Support finds that mapping requires a product change; the import is delayed and the customer has opened two cases about reporting. The customer tells the AE that they may not renew.

- AE opens a renewal-risk escalation and shares the original email/notes, contract scope, customer decision date, stakeholders, and exact customer concern.
- Support sets severity based on current operational impact (for example S2 if a key workflow is blocked without a workable alternative), names a case owner, verifies the mapping gap, offers a safe interim path if available, and provides a dated technical assessment.
- AE is resolution coordinator for the cross-functional commercial/expectation plan; Support remains owner of the technical investigation. They agree one customer update, with the AE addressing the original expectation and Support explaining the verified technical path and limits.
- The leads review whether the promise was authorized, whether the handoff omitted material information, and whether product constraints were knowable at sale. They do not presume either team caused churn. They set a recovery milestone and a renewal decision checkpoint.
- If the customer leaves, churn review records both the evidence-backed controllable contributors (for example unclear promise validation or incomplete handoff) and any external factors, such as a later budget freeze, separately.

## Shared measures

Review a small set of account-level measures together. Use the same definitions and denominator; inspect patterns, not isolated anecdotes. Do not use any one measure as a quota or individual blame score.

- **Handoff completeness:** share of new customers with required scope, success measure, stakeholders, dates, dependencies, and non-standard promises documented before onboarding starts. Report missing fields and time to close gaps, not just a pass rate.
- **Time to first useful outcome:** elapsed time from kickoff to the customer-confirmed first value milestone, with pause reasons (customer dependency, product gap, internal delay) visible.
- **Aged high-impact risk:** count and age of open S1/S2 issues and at-risk renewals with no current owner, next action, or customer update. Target zero ownerless/high-impact records.
- **Renewal outcome by risk and cause:** renewal rate and retained recurring value segmented by recorded risk, with preventable contributors and external factors shown separately. Do not attribute an outcome solely to the team that handled the last interaction.
- **Escalation follow-through:** share of escalations with an owner, next update, and actions completed by the agreed date; pair with customer-reported outcome or resolution quality so teams cannot improve the metric by closing records prematurely.

## Preventable churn and external factors

At churn review, classify causes at the **account level** using evidence and allow multiple contributing factors:

- **Preventable/internal contributor:** a reasonable action within company control was missed or delayed, such as an unsupported promise, incomplete handoff, avoidable response delay, recurring unresolved issue, or failure to communicate a viable workaround. Record the missed action and evidence; do not infer intent.
- **Shared/uncertain contributor:** evidence is incomplete, the cause crosses teams, or internal service and customer circumstances both materially contributed. Keep as uncertain until evidence improves; do not force a binary assignment.
- **External/non-preventable factor:** a documented factor substantially outside the teams’ reasonable control, such as acquisition, shutdown, regulation change, budget cancellation, or a strategic shift. Record the customer-stated reason and source. “Price” or “competitor” alone is not automatically external; review whether scope, value communication, or service issues also contributed.

The AE proposes the classification; Support adds case evidence; both leads confirm it at the review. If they disagree, record both views and ask the executive sponsor to resolve the reporting category, preserving the evidence and dissent. Categories describe learning opportunities, not individual culpability.

## Review cadence and maintenance

- **Weekly, 30 minutes:** AE and Support owners review new escalations, S1/S2 cases, at-risk renewals inside 120 days, owners, customer updates, and overdue actions.
- **Monthly, 45 minutes:** team leads review shared measures, churn classifications, recurring handoff or product patterns, and a small sample of resolved escalations. Agree no more than three process actions, each with an owner and due date.
- **Quarterly:** leads confirm whether renewal ownership, response targets, coverage assumptions, or role definitions have changed. Revise this agreement and share the current version with both teams.

**Adoption checklist:** name the executive sponsor, confirm support coverage and on-call route, choose the shared system of record, define the required handoff fields, and confirm whether a Customer Success team participates in renewals before treating this draft as policy.
