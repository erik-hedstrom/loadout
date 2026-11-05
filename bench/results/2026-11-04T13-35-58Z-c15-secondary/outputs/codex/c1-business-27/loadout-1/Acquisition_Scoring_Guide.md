# Acquisition target shortlist framework

**Purpose.** Use this framework to screen and compare potential acquisitions before committing to full diligence. It is a decision aid, not a substitute for investment committee judgment or specialist review. All targets and amounts below are fictional; currency is USD millions unless stated otherwise.

## 1. Order of operations

1. **Apply the nonnegotiable gates.** Record PASS, FAIL, or OPEN for each gate. A FAIL means reject or redesign the transaction; an OPEN means hold pending evidence. Do not allow a high weighted score to override either. Gates include legal authority and sanctions, strategic/regulatory permissibility, integrity concerns, and price within mandate. Tailor the gates to the buyer and jurisdiction.
2. **Score only candidates that pass.** Score each criterion from 1 to 5, using the anchor descriptions in `Criteria.csv`. Higher is always better. In the integration dimension, a high score means easier integration (lower difficulty, cost, and execution risk).
3. **Calculate a weighted score.** Within each dimension, compute the weighted average of its criteria. Then combine dimensions using suggested weights of strategic fit 40%, integration ease 25%, financial attractiveness 35%. The resulting score is 1–5. It supports a shortlist, not an automatic go/no-go.
4. **Show uncertainty and update with evidence.** Assign evidence confidence 1–5 (1 = weak, 3 = mixed, 5 = verified). Confidence labels do not multiply the score. Use low/base/high scenarios and record what evidence would move a rating. This avoids arbitrary mathematical precision and makes uncertainty reviewable.

## 2. Dimensions, criteria, and weights

The accompanying `Criteria.csv` gives weights and anchors for each criterion. Within-dimension weights sum to 100%.

- **Strategic fit (40% overall):** market/customer adjacency (25%), capability/technology fit (25%), competitive positioning (20%), strategic alignment and execution capacity (15%), regulatory/portfolio fit (15%). This weight favors the reason to buy while requiring explicit execution and portfolio fit.
- **Integration ease (25% overall):** systems/data complexity (25%), operating model/process fit (20%), people/culture/retention (20%), legal/regulatory integration (15%), integration capacity and cost certainty (20%). Score 5 for straightforward, bounded integration; score 1 for very difficult, risky integration. Weight is material because value can be lost during execution, but not so large that easy integration dominates strategic rationale.
- **Financial attractiveness (35% overall):** risk-adjusted value versus price (40%), cash-flow quality/durability (20%), capital intensity/working capital (15%), downside resilience (15%), funding/returns fit (10%). Financial merit is essential, but the price/value criterion is designed to incorporate all modeled cash flows and costs once.

**Scoring anchor:** 1 = materially unattractive or very difficult; 2 = weak; 3 = acceptable/mixed; 4 = strong/manageable; 5 = exceptional/very easy. Use integers and write evidence for each score. A 3 means adequate, not “unknown.” If evidence is insufficient, mark OPEN at the gate where relevant, use a provisional score with low confidence, and retain a wide scenario range.

## 3. Price, synergies, costs, uncertainty, and downside

Use one consistent valuation date, currency, tax treatment, forecast horizon, and discount rate across targets. Financial attractiveness should compare **risk-adjusted present value of the target’s standalone cash flows plus probability-weighted, after-tax synergies, less integration/separation costs and other transaction-specific cash outflows** against the **all-in purchase price** (equity consideration plus assumed/refinanced debt, fees, and other obligations as appropriate). Include working capital, capital expenditure, restructuring, retention, systems migration, dis-synergies, and stranded costs once in the relevant cash flow. Do not score “synergy potential” again as an extra financial bonus if synergies are already in the value estimate.

- **Acquisition price:** compare enterprise/equity value on a consistent basis; bridge debt, cash, leases, pensions, earn-outs, and working capital. Price above mandate fails the gate even if strategic scores are high. A price negotiation can change the gate and financial score.
- **Synergies:** use only identifiable sources with an owner, timing, implementation path, probability, tax treatment, and cost to achieve. Keep revenue synergies more heavily probability-adjusted than contracted cost savings. Avoid counting standalone growth as synergy.
- **Integration costs:** include one-time costs and ongoing costs in the cash-flow model. Use integration-ease ratings to capture execution burden and capability, not to add the same cost a second time to financial value.
- **Downside risk:** model a plausible adverse case (e.g., customer loss, slower synergy capture, margin compression, regulatory delay, working-capital spike). Include expected loss or scenario-weighted cash flows in value once; use downside resilience to describe exposure and mitigations, not subtract the same loss again.
- **Uncertain information:** mark assumptions as verified, corroborated, management-provided, or unverified; use confidence labels; maintain low/base/high cases; show the few assumptions that drive the result. Do not turn low confidence into a hidden score haircut. If uncertainty could change a gate, hold until resolved.

### Illustrative financial calibration

For the three examples, “risk-adjusted value” is the present value of standalone cash flows plus probability-weighted synergies, after integration costs and downside scenario adjustment. Price is all-in. The $m “value less price” in the scorecard is a simple headroom indicator, not itself the total score. The financial criterion score also reflects cash quality, capital intensity, downside resilience, and funding fit. Values are assumed hypothetically and must be rebuilt from diligence-grade assumptions.

## 4. Worked comparison (all hypothetical)

The workbook scorecard has individual criterion inputs and formula-driven weighted dimension scores. With the stated criteria weights:

| Target | Gates | Strategic fit | Integration ease | Financial attractiveness | Weighted total | Initial view |
|---|---|---:|---:|---:|---:|---|
| Northstar Analytics | Pass | 4.55 | 2.65 | 4.20 | 3.87 | Rank 2 among passers; strong strategy and value, integration/retention risks |
| Harbor Components | Pass | 4.00 | 4.20 | 4.00 | 4.05 | Rank 1 among passers; balanced fit and easier integration |
| Cedar Health Systems | Hold (regulatory gate open); Fail (price mandate) | 3.95 | 2.20 | 3.10 | Excluded | Do not rank as a viable candidate until gate/price changes |

> Note: weighted calculations use formulas in the scorecard; total scores are blank for failed/held candidates by design. The indicative figures above reflect rounded calculations. For Northstar, strategic scores (5,5,4,4,4), integration (3,3,2,3,2), and financial (4,5,4,4,4) produce about 4.55, 2.65, and 4.20. Harbor’s scores produce 4.00, 4.20, and 4.00. The base overall weighting gives Harbor approximately 4.05 and Northstar 3.87. Harbor ranks first under the listed criterion scores; strategic-emphasis weights narrowly move Northstar ahead. Use calculated values and investigate close results rather than over-reading decimals.

Hypothetical valuation inputs: Northstar risk-adjusted value $410m vs $300m price ($110m headroom); Harbor $270m vs $220m ($50m); Cedar $500m vs $540m (-$40m). This does not mean Northstar automatically wins: its integration ease is materially lower and its retention/integration evidence confidence is only 4/5. Cedar’s apparent strategic potential does not override a failed price gate or open regulatory review.

## 5. Sensitivity checks and ranking interpretation

The `Sensitivity.csv` file presents alternative category weights and one downside case. Illustratively:

| Case | Strategic / Integration / Financial weights | Expected effect |
|---|---|---|
| Base | 40% / 25% / 35% | Harbor and Northstar are close; their order depends on the detailed scorecard values (Harbor leads under the listed criterion scores). |
| Strategic emphasis | 55% / 20% / 25% | Northstar improves relative to Harbor because its strategic score is higher. |
| Integration-first | 25% / 50% / 25% | Harbor leads more clearly due to integration ease. |
| Financial-first | 25% / 20% / 55% | Harbor remains slightly ahead under the example scores; Northstar can move ahead if financial diligence raises its score or the price falls. |
| Northstar downside | Base weights, financial score reduced from 4.0/4.20 to 2.5 | Harbor leads more clearly (Northstar falls to about 3.36); test value sensitivity to synergy delays, customer churn, and integration overrun. |

Sensitivity is not a way to select convenient weights after seeing results. Set weights based on the buyer’s announced strategy, show reasonable alternatives, and identify the assumptions that reverse the result. Also test hard thresholds: price cap, minimum return, maximum leverage, and integration capacity. A candidate that only wins under optimistic assumptions should not be treated as robust.

## 6. How diligence can change the ranking

A shortlist ranking is a hypothesis. Diligence changes it by replacing estimates with evidence, narrowing scenario ranges, discovering liabilities, and revising price or transaction structure. Keep a change log with old score, new score, evidence, owner, and date.

- **Commercial:** customer references, cohort retention, renewal pipeline, pricing, churn, concentration, market sizing, competitor response. Confirm whether “adjacency” and cross-sell are real.
- **Financial / quality of earnings:** audited statements, revenue recognition, normalized EBITDA/cash conversion, working capital seasonality, capex, debt-like items, tax, contingent liabilities, forecast-to-actual history. Rebuild the standalone case.
- **Synergies and integration:** bottom-up synergy register, timing/probability, one-time and recurring cost estimates, systems/data inventory, architecture/security review, day-one needs, named integration leader, capacity and retention plans. A plausible synergy can be reduced, delayed, or offset by dis-synergies.
- **Legal, regulatory, and integrity:** ownership, litigation, licenses, sanctions, anti-bribery, privacy/data rights, IP title, labor, environmental matters, change-of-control consents, antitrust/foreign investment. New facts can turn a gate to FAIL or extend timing and cost.
- **People and operations:** key-person dependencies, employee obligations, culture, facilities, suppliers, quality controls, business continuity, cyber resilience.
- **Deal terms / financing:** price bridge, earn-out terms, escrow/indemnity, financing commitments, covenants, leverage, tax structure, closing conditions. Better terms can improve risk allocation without masking weak underlying economics.

Re-score only the criteria affected by new evidence. Recalculate value and price consistently, then rerun weights, downside cases, and gates. If rank changes because an assumption moved, report the driver. If rank changes because weights moved, report the new priority that justified the change. Serious-candidate status requires clear gates, a finance-reviewed valuation, named diligence owners, and an integration thesis with resources.

## 7. Before treating a target as serious

Gather at minimum: (1) ownership and authority to transact; (2) price expectations and debt/cash bridge; (3) three years of audited financials plus current trading and forecast; (4) customer concentration, retention, pipeline, and major contracts; (5) management team and key-person retention risks; (6) product/IP and technology/data architecture; (7) material legal, regulatory, privacy, cybersecurity, tax, environmental, and integrity issues; (8) bottom-up standalone and synergy case, with timing/probability; (9) integration cost, capacity, and day-one plan; (10) downside model and funding/return impact; and (11) explicit evidence gaps, gate owner, and decision deadline.
