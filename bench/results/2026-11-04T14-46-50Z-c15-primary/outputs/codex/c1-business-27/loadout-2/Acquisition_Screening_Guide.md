# Acquisition target screening framework

This is an initial shortlist tool. It organizes evidence and makes trade-offs visible; it does not substitute for valuation, legal review, or an investment decision. Every company, score, amount, and estimate below is fictional and explicitly hypothetical.

## 1. Screening before scoring

Resolve hard screens before comparing weighted totals. Use **Pass / Hold / Fail** for each screen and record the evidence, owner, and date. A **Fail** excludes the target. A **Hold** means the issue is unresolved and the target is not an active ranked candidate until resolved. Only targets passing every screen are ranked. Do not convert a failed screen into a low numeric score or let other strengths offset it.

Suggested initial screens:

1. **Mandate and authority:** target fits the approved acquisition mandate, geography, size range, and strategic purpose; required internal authority exists.
2. **Legal and regulatory feasibility:** no known prohibition, fatal license/consent issue, sanctions concern, or unmanageable competition obstacle.
3. **Financial floor and funding:** credible path to funding and minimum return/liquidity requirements; no known exposure beyond approved limits.
4. **Integrity, ethics, and reputation:** no known fraud, bribery, human-rights, material safety, or other integrity issue that violates policy.

These are example gates. Set thresholds to your actual mandate before screening. Ask specialist advisers to assess legal and regulatory feasibility; the gate is a decision point, not a legal conclusion.

## 2. Common scoring scale

Score each weighted criterion from **1 to 5**, using whole numbers for shortlist work. **5 is always favorable and 1 is always unfavorable.** Use 2 and 4 for intermediate evidence; 3 means mixed/acceptable or broadly at benchmark. For integration, score **ease**: 5 means low difficulty/burden and 1 means high difficulty/burden. Never score “difficulty” on the other criteria’s direction.

| Score | Anchor |
|---|---|
| 5 | Strong, evidenced advantage; clearly exceeds the requirement |
| 4 | Favorable; exceeds the requirement on balance |
| 3 | Meets the requirement or is mixed; no decisive advantage/disadvantage |
| 2 | Material shortfall or burden; a credible mitigation is needed |
| 1 | Severe weakness, burden, or value destruction likely |

Before using the scale, set a short written benchmark for your deal mandate (for example, minimum return hurdle, acceptable migration period, or required strategic capability). Score facts relative to that benchmark, not relative to the other candidates. “Unknown” is not a 3: use a provisional estimate only when needed, mark confidence low, and show the range.

## 3. Weighted criteria and rationale

The workbook uses the following criteria. Criterion weights are equal within strategic fit and integration ease; financial subweights reflect that price and net value capture should dominate a screening view of financial attractiveness. A default **40% strategic / 25% integration ease / 35% financial** mix keeps strategic purpose central while ensuring execution and price discipline can materially affect the result. Change weights to reflect the buyer’s actual bottleneck, document why, and run sensitivity cases.

| Dimension | Criteria and within-dimension weights | What to assess |
|---|---|---|
| Strategic fit (40% total) | Strategic adjacency 25%; capability/technology value 25%; market position/access 25%; customer/channel complementarity 25% | Direct contribution to stated priorities; scarcity and time-to-build of capability; defensibility and access to priority markets; customer overlap, cross-sell potential, retention, and channel conflicts. |
| Integration ease (25% total) | Operating model compatibility 25%; systems/data/cyber readiness 25%; people/culture/retention feasibility 25%; regulatory/operational separation burden 25% | Decision rights and processes; system condition, interoperability, security and data migration; key-person retention and change capacity; carve-out, consent, licensing, continuity, and separation burden. High ease means easier integration. |
| Financial attractiveness (35% total) | Standalone earnings quality 20%; purchase price vs standalone value 35%; net synergy value capture 30%; downside resilience 15% | Cash earnings quality and auditability; entry price relative to standalone value/hurdle; risk-adjusted synergies after costs and timing; liquidity, concentration, and downside-case resilience. |

For dimension scores, take the average of the criterion scores in the dimension. The total is:

**Weighted total (out of 5) = Strategic fit × 40% + Integration ease × 25% + Financial attractiveness × 35%.**

The spreadsheet computes criterion averages, total, gate disposition, and rank. Rank only “Pass” candidates. Keep scores unrounded for ordering; display decimals for discussion. Very small gaps (for example, less than 0.2 points) should be treated as ties unless evidence clearly distinguishes the candidates.

## 4. Uncertainty, price, synergies, costs, and downside

### Record uncertainty without disguising it

For each important input, record source, date, owner, confidence (**High / Medium / Low**), and a plausible low/base/high range. Confidence describes evidence quality, not whether the score is good. In the workbook, low/high plausible overall totals are uncertainty bands for discussion; they are not confidence intervals or automatic penalties. If the ranking changes within a plausible range, treat the candidates as unresolved and prioritize the diligence that could change the decision.

Use evidence-based scores and ranges. For low-confidence claims, widen the range and lower confidence; do not mechanically deduct points and then also include the same risk in downside resilience. Keep a separate issue log with (a) uncertainty, (b) potential impact, (c) how to resolve it, and (d) decision deadline.

### Keep the financial bridge internally consistent

Use a single value bridge so benefits are counted once:

**Risk-adjusted total value = standalone value + risk-adjusted net synergy value**

where **risk-adjusted net synergy value = present value of gross incremental synergies × probability of realization − integration/separation costs − dis-synergies and other incremental costs**. Make timing, taxes, required capex/working capital, customer attrition, and execution probability explicit. Use a consistent discount rate and currency. Do not include synergies in the standalone forecast and then add them again. Do not add revenue growth and the resulting margin/profit benefit as separate value if one is already embedded in the other.

Compare total value to **all-in consideration** (equity value plus assumed/refinanced debt, fees, transaction costs, and other economic consideration, as appropriate). Use a common convention across targets. The “price / standalone value” score asks whether price is supportable on standalone fundamentals. The “net synergy value capture” score asks whether incremental synergies net of their costs and risk create enough additional value. A high score in one cannot compensate for failing a return hurdle.

Use a downside case (lower revenue/retention, slower synergies, cost overruns, higher working capital, or financing stress) to test whether value and liquidity remain acceptable. The downside-resilience score evaluates the target’s underlying ability to withstand stress. Do not also subtract that same stress from the base synergy estimate unless it changes the expected value itself. State which risks are reflected in base, synergy probability, integration costs, and downside case to prevent duplicate haircuts.

### Worked financial bridge (all figures hypothetical, $ millions)

| Fictional target | All-in price | Standalone value | Gross synergy PV | Realization probability | Integration costs | Risk-adjusted net synergies | Total value | Value less price |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Apex Components | 420 | 350 | 180 | 70% | 55 | 71 | 421 | 1 |
| Beacon Analytics | 240 | 220 | 70 | 80% | 25 | 31 | 251 | 11 |
| Cedar Health Systems | 360 | 280 | 160 | 50% | 70 | 10 | 290 | (70) |

Calculation: Apex net synergies = 180 × 70% − 55 = 71; total value = 350 + 71 = 421. Beacon = 70 × 80% − 25 = 31; total = 251. Cedar = 160 × 50% − 70 = 10; total = 290. These figures are screening estimates, not offers, appraisals, or forecasts. The workbook scores are a structured judgment informed by these example economics, not a formula converting dollars into a 1–5 score. Define your own return/value thresholds before applying the price and synergy anchors.

## 5. Fictional worked shortlist

All data below is hypothetical. All three targets pass the four illustrative gates only to make the weighted comparison visible; a real unresolved gate would be **Hold**, not Pass.

| Fictional target | Strategic criterion scores | Integration ease scores | Financial criterion scores | Dimension scores (Strategy / Ease / Financial) | Weighted total | Initial interpretation |
|---|---|---|---|---|---:|---|
| Apex Components | 4, 5, 4, 4 = **4.25** | 3, 2, 3, 3 = **2.75** | 4, 4, 5, 4 = **4.25** | 4.25 / 2.75 / 4.25 | **3.875** | Strong capability and net synergy case, but systems integration is a key execution risk. |
| Beacon Analytics | 4, 4, 4, 3 = **3.75** | 5, 4, 4, 4 = **4.25** | 4, 3, 3, 4 = **3.50** | 3.75 / 4.25 / 3.50 | **3.788** | Easiest integration and solid resilience; less compelling value capture at current price. |
| Cedar Health Systems | 5, 5, 4, 5 = **4.75** | 3, 3, 3, 4 = **3.25** | 4, 3, 4, 3 = **3.50** | 4.75 / 3.25 / 3.50 | **3.938** | Best strategic fit in this fictional set; valuation and synergy realization need close scrutiny. |

With the default weights, the provisional order is **Cedar (3.938), Apex (3.875), Beacon (3.788)**. The narrow gap makes this a question list, not a confident winner. Cedar’s example value bridge is below price despite its high strategic score; that should prompt price/structure and synergy validation and can trigger a financial hard screen if the buyer’s hurdle requires it.

## 6. Sensitivity checks

The workbook includes the following weighted-priority and assumption stresses, calculated from the example criterion scores. These are illustrative ranking changes, not precise forecasts.

| Scenario | Apex | Beacon | Cedar | Order | Lesson |
|---|---:|---:|---:|---|---|
| Base: 40% / 25% / 35% | 3.875 | 3.788 | 3.938 | Cedar > Apex > Beacon | Default gives a narrow spread. |
| Integration-first: 30% / 45% / 25% | 3.575 | 3.913 | 3.763 | Beacon > Cedar > Apex | A buyer with scarce integration capacity should favor the easier target. |
| Strategic-first: 55% / 20% / 25% | 3.950 | 3.788 | 4.138 | Cedar > Apex > Beacon | Higher strategic priority strengthens Cedar’s lead. |
| Financial-first: 25% / 20% / 55% | 3.950 | 3.713 | 3.763 | Apex > Beacon > Cedar | Price/value discipline changes the top choice. |
| Apex synergy haircut: synergy score 5 → 3 | 3.700 | 3.788 | 3.938 | Cedar > Beacon > Apex | A 50% lower realization assumption can reverse Apex’s position. |
| Apex integration cost stress: synergy score 5 → 4 | 3.788 | 3.788 | 3.938 | Cedar > Apex = Beacon | A smaller cost stress erases Apex’s lead over Beacon. |
| Downside: Apex resilience 4 → 3; Cedar 3 → 2 | 3.788 | 3.788 | 3.850 | Cedar > Apex = Beacon | Downside resilience changes the lower ranks but not Cedar’s lead. |

Also test criterion score ranges, plausible purchase price, timing and probability of synergies, integration costs, financing cost, and downside operating cases. If modest changes move the leader, do not claim a stable ranking. Identify the assumption with the highest decision impact and diligence it first. Reweighting should be approved and documented before looking at which target benefits.

## 7. Reusable scorecard workflow

1. Set mandate, hard-screen thresholds, return hurdle, and weights before reviewing target scores.
2. Enter target names and pass/hold/fail gates in the workbook. Keep evidence notes and source links in a companion issue log or add columns.
3. Score every criterion against the anchors and record confidence plus plausible score range. Keep integration scoring in the “ease” direction.
4. Build one standalone and synergy value bridge per candidate using a consistent valuation convention. Score price and net value capture against the same approved hurdle.
5. Review ranks with the team, then run the supplied weight and assumption stresses. Discuss absolute thresholds and gate status before ordinal rank.
6. Move only candidates with resolved gates, decision-relevant upside, and manageable downside into deeper diligence. Refresh scores as evidence changes; preserve old scores and reasons for auditability.

## 8. Information to gather before a serious-candidate decision

- **Strategic:** approved thesis and “why buy”; build/partner/buy alternatives; product roadmap and defensibility; customer overlap and conflicts; market size, competitive position, and access evidence.
- **Financial:** at least three years of audited statements and current management accounts; quality-of-earnings analysis; revenue/customer concentration; backlog, churn and cohort data; working capital, capex, debt, leases, pensions, tax, and contingent liabilities; cash conversion and forecast-to-actual history.
- **Price and value:** seller expectations and process; proposed transaction perimeter and consideration; comparable transactions/trading evidence; standalone valuation; return hurdle and financing terms; sensitivity to price and structure.
- **Synergies:** bottom-up source by source owner, baseline, timing, gross value, probability, taxes, capex/working capital, one-time costs, recurring costs, dis-synergies, customer attrition, and accountable executive. Identify overlap with the standalone plan.
- **Integration:** systems architecture, data lineage, cyber incidents and controls, technical debt, process maps, TSA needs, carve-out readiness, licenses/consents, operational continuity, integration leadership, capacity, critical path, and costed plan.
- **People and culture:** key-person dependency, retention commitments, compensation, labor obligations, leadership assessment, culture evidence, change capacity, and succession.
- **Legal, regulatory, and integrity:** ownership and title, contracts/change-of-control clauses, litigation, IP chain of title, privacy, competition, sector approvals, sanctions, anti-bribery, employment, environmental, safety, and reputation reviews.
- **Downside and funding:** bear-case demand and margin, customer loss, delayed synergies, cost overrun, working-capital shock, rate/refinancing stress, liquidity runway, covenants, and the buyer’s ability to absorb the combined downside.

For each item, record the evidence source, date, responsible reviewer, finding, score impact, confidence, and open question. Escalate any potential gate failure immediately rather than waiting for the total score to reveal it.
