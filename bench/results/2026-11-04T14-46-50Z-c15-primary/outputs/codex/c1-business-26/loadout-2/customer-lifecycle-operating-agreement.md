# Sales and Support Customer Lifecycle Operating Agreement

**Status:** Discussion draft  
**Owners:** Sales lead and Support lead  
**Effective date:** To be agreed  
**Review cadence:** First 30 days after adoption, then monthly for the first quarter and quarterly thereafter

## Purpose

Give customers a continuous experience from the first commercial promise through renewal or exit. Sales and Support share responsibility for customer outcomes, while each stage has one accountable owner who coordinates the work and communicates status.

## Working assumptions

- **Renewals are owned by Sales** (including the commercial offer, forecast, and close). Support owns the service-health view, risk evidence, and recovery plan for product or service issues. If the company has a dedicated Customer Success or Renewals team, the leads should substitute that team as the renewal accountable owner.
- “Sales” means the opportunity/account owner; “Support” means the named support or service owner. The teams name an individual for each customer and each escalation.
- Response targets below apply during the team's staffed business hours in the customer's primary time zone. A P1 acknowledgment is expected at any hour only if an on-call rota exists; otherwise use the stated staffed-hours target and communicate coverage honestly.
- The account record/CRM is the shared source of truth. Decisions, owners, dates, customer commitments, and risk status are recorded there (or in the linked case record).

## Responsibilities by lifecycle stage

| Stage | Accountable owner | Other team's obligations | Information to exchange / required record |
|---|---|---|---|
| Sales promises and solution fit | Sales | Support reviews nonstandard service, implementation, security, integration, or availability commitments before they are offered; flags feasibility and capacity. Support may not silently accept an unreviewed commitment after signature. | Sales records customer goals, use case, decision criteria, scope, exclusions, integrations, success measures, stakeholders, risks, and every promise with an owner/date. Support returns feasibility, dependencies, constraints, and written approval or proposed wording. |
| Customer handoff | Sales until handoff is accepted; Support becomes accountable when named owner accepts | Support attends the handoff or reviews the packet and explicitly accepts it (or identifies gaps). Sales remains available to clarify commercial context and promises. | Handoff packet: signed scope/order, promised outcomes and dates, key contacts/roles, customer context, technical environment, open questions, risks, implementation dependencies, and first-meeting date. Acceptance and any exceptions recorded. Target: within 2 business days of signature and before kickoff. |
| Onboarding and adoption | Support / named onboarding owner | Sales reinforces the agreed outcomes, keeps sponsor and commercial context available, and does not make new delivery promises without Support review. Support provides plan, milestones, customer actions, training, and progress updates. | Success plan with baseline and measures, milestones, owners on both sides, dependencies, adoption indicators, open issues, and next update date. Share material slippage or scope change with Sales promptly. |
| Ongoing support | Support | Sales supplies account context, helps reach customer decision-makers where needed, and avoids directing work around the support queue. Support owns triage, customer updates, technical investigation, and case closure. | Case severity, impact, affected users/workflows, timeline, workaround, next update time, technical findings, and customer sentiment. Sales receives material account-impacting incidents and repeated issue patterns. |
| Renewal risk | Sales (renewal owner) | Support supplies an evidence-based health assessment, open issue history, adoption/service trends, and a feasible recovery plan; flags risk early. Sales owns commercial strategy, renewal forecast, sponsor engagement, and customer-facing renewal plan. | Shared risk entry: reason, evidence, customer impact, renewal date/value, sentiment, recovery actions with owners/dates, decision makers, and next checkpoint. Review at least 120 days before renewal where term length permits; update on material changes. |
| Churn review | Sales lead and Support lead jointly; one lead facilitates, rotating quarterly | Both teams provide records and participate in a no-blame review. Neither team unilaterally assigns cause or edits the other team's evidence. | Timeline of promises, delivery/adoption, incidents, customer feedback, renewal actions, decision and reason for departure, counterfactuals, preventability classification, and follow-up actions. Complete within 15 business days of confirmed churn when practical. |

## Process and handoff

1. Before signature, Sales records material promises and routes anything outside standard scope to Support for feasibility review. Support responds within 2 business days or states when it can review. Sales owns the customer conversation and accurately represents any open dependency.
2. Within 2 business days of signature, Sales shares the handoff packet and schedules a joint handoff. Support accepts it in the record before kickoff. If required details are missing, Support lists the gaps and Sales supplies them; the two owners agree whether kickoff can proceed safely.
3. Support runs onboarding to the agreed success plan and keeps Sales informed of material scope, timing, adoption, or relationship risk. New commitments affecting scope, cost, or timing require the accountable owner to align with the other team before being offered.
4. Support handles service cases and escalates using the severity rules below. Sales joins when there is material commercial, executive, renewal, or expectation impact.
5. Sales leads renewal planning and seeks Support's current service-health input. At-risk accounts get one shared recovery plan, not parallel team plans.
6. For churn, the leads review evidence jointly, classify drivers using the rubric below, and assign learning actions with owners and due dates.

## Escalation levels and response targets

Severity is based on customer impact, urgency, and scope. The Support owner sets the initial level, tells Sales when a trigger below is met, and records the reason. Either team may request a severity review; Support lead confirms the operational severity, with the leads resolving disagreement about account-level urgency.

| Level | Trigger examples | Acknowledge / engage | Update cadence | Coordinator |
|---|---|---|---|---|
| **P1 Critical** | Service unavailable for most/all users; critical business workflow blocked with no workaround; suspected security/privacy incident; credible imminent loss of a strategic customer due to an active incident | 15 minutes during staffed hours; if on-call exists, 15 minutes at any hour | At least every 30 minutes while critical, even if no new finding | Support incident lead; Sales account owner coordinates customer/executive relationship and commercial context |
| **P2 High** | Significant degradation or key workflow impaired; multiple customers materially affected; urgent issue with a dated business deadline or renewal decision at risk | 1 business hour | At least every 4 business hours | Named Support case owner; Sales joins if renewal, sponsor, or commitment impact exists |
| **P3 Standard** | Individual or limited impact with workaround; non-urgent defect or question | 1 business day | Every 2 business days or at the promised next update | Support case owner |
| **P4 Low / request** | How-to, minor request, cosmetic issue, or planned enhancement | 2 business days | At the agreed milestone or weekly while active | Support case owner; product requests routed through normal prioritization |

**Cross-team escalation triggers:** notify the other team within one business day (immediately for P1) when a customer promise is infeasible or missed; onboarding milestone slips more than 5 business days; the same material issue recurs twice in 30 days; customer threatens to leave or asks for an executive; support issue could affect a renewal within 120 days; or a customer-impacting decision requires authority outside the case owner's role.

### Resolution coordination and disagreement

- The coordinator owns the action log, next customer update, cross-team meeting if needed, and confirmation that each action has an owner and due date. Coordination does not transfer technical or commercial decision rights.
- For an active customer-impacting disagreement, the two individual owners first confer within 1 business day (P1: immediately). If unresolved, escalate to the Support lead and Sales lead, who decide within 1 business day (P1: within 1 hour during staffed hours). The incident coordinator continues the safest customer-protective work while the decision is pending.
- If the leads cannot agree by that deadline, the designated executive sponsor (e.g., COO or equivalent) makes the call within the next business day, using customer impact, contractual commitments, evidence, and reversibility as criteria. The decision and rationale are recorded. Contractual, legal, privacy, or security questions go to the appropriate specialist immediately and are not settled by a sales/support vote.
- Do not promise a remedy, credit, delivery date, or exception beyond one's authority. Escalate for approval while keeping the customer informed of the next update time.

## Example: renewal risk during onboarding

A customer signed with an expectation that a key integration would be live in 30 days. During handoff, the integration dependency was not recorded. On day 20, Support learns the customer's API access will not be ready for another month; the sponsor says the delay may affect renewal.

1. Support records the dependency and customer impact, informs Sales the same business day, and classifies the immediate issue (typically P2 if the critical workflow is blocked; otherwise P3).
2. Support coordinates a technical assessment and a workaround with named owners and dates. Sales contacts the sponsor, confirms the original promise and business outcome, and avoids offering an unapproved new date or concession.
3. The teams produce one recovery plan: revised milestone, customer action, workaround, weekly checkpoint, and a measurable success criterion. Sales owns commercial/executive communication; Support owns technical delivery and status.
4. If teams disagree on whether the 30-day date was a commitment or estimate, they review the signed proposal, CRM promise record, and meeting notes. Leads decide within one business day; if unresolved, executive sponsor decides. The customer receives a clear interim update and next update time.
5. At churn or renewal, review whether the promise was documented and feasible, whether the dependency was surfaced in handoff, and whether the recovery plan changed the outcome. Classify the process gaps separately from any external API-access delay.

## Shared measures

Review trends jointly; use cohorts and context rather than ranking individuals. Do not reward either team for reclassifying severity, suppressing risk, delaying churn confirmation, or excluding difficult accounts.

| Measure | Shared definition / guardrail |
|---|---|
| Gross revenue retention (GRR) for eligible accounts | Starting recurring revenue less churn and contraction, divided by starting recurring revenue. Segment by customer size, tenure, and product; neither team owns the result alone. |
| Onboarding outcome attainment | Percentage of onboarded customers reaching the success-plan milestone by the agreed date; report customer-caused, vendor-caused, and shared dependency delays separately, with denominator and exclusions visible. |
| At-risk plan coverage and follow-through | Percentage of at-risk renewals with a shared evidence-based plan, named owners, dates, and completed actions. A logged plan alone does not count as recovery. |
| Promise-to-delivery reliability | Percentage of material customer commitments delivered by agreed date, with changes and dependencies documented; sample against proposals/notes to discourage under-recording. |
| Customer effort / resolution quality | Post-resolution customer rating or effort score together with repeat-contact/reopen rate; review low response rates and unresolved cases so closure speed alone is not rewarded. |

Targets should be set after establishing a 1–2 quarter baseline and segmented by comparable account cohort. Leads review both outcome and process measures together.

## Churn classification: controllable and external factors

For each churn, record the customer's stated primary reason and evidence, then classify each material contributing factor (multiple factors are allowed):

- **Preventable / primarily within our control:** a reasonable action within either team's authority was missed or materially late, such as an unsupported promise, poor handoff, unresolved service issue, or absent renewal engagement.
- **Partly preventable / shared:** internal execution contributed, but customer-side or market factors also materially affected the outcome. Name both contributions and the counterfactual action that might have helped.
- **Primarily outside our control:** documented external event was the main driver (for example, acquisition, shutdown, funding loss, mandated vendor consolidation, or a customer strategy change), and review finds no material missed internal action likely to change the result.
- **Insufficient evidence / unclear:** do not force attribution. Record what is unknown and what evidence could resolve it.

“Outside our control” requires evidence and does not erase a separate preventable process gap. “Preventable” is a learning classification, not an individual performance verdict. The review notes the confidence (high/medium/low), source of evidence, customer-stated reason, and any disagreement.

## Review cadence and maintenance

- The leads review P1/P2 escalations and open high-risk renewals weekly, focusing on customer impact, blocked decisions, and due actions.
- Hold a monthly 30-minute operating review for the first three months: inspect shared metrics, overdue actions, handoff gaps, and a small sample of churn classifications. Thereafter, review quarterly unless churn or escalation trends warrant monthly review.
- Review this agreement quarterly for the first year and after any major operating-model change. Sales lead and Support lead jointly maintain it; changes to renewal ownership or response coverage must be explicit.
