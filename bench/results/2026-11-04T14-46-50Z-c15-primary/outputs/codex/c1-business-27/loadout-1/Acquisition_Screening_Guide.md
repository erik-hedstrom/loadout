# Acquisition target screening framework

All targets, scores, prices, and financial figures below are fictional and explicitly hypothetical. Treat the framework as a decision aid for a first-pass shortlist, not a valuation opinion, investment recommendation, or substitute for legal, financial, tax, commercial, technical, and regulatory diligence.

## How to use it

1. Define the strategic need and disqualifying gates before scoring. Run the gates first; a FAIL removes a target from the shortlist unless the issue is demonstrably curable before signing or closing.
2. Score each criterion from 1 to 5 using evidence, not enthusiasm. The same scale applies throughout: **1 = materially weak / difficult / unattractive; 2 = below bar; 3 = adequate / mixed; 4 = strong / manageable; 5 = exceptional / easy / attractive. Higher is always better.** For integration criteria specifically, 5 means easiest and lowest-risk to integrate.
3. Use the suggested weights below, totaling 100%. For each target, calculate `SUM(weight × score) / 5`, yielding a 0–100 score. Do not award a score of 5 for an unverified claim. Record the source, date, owner, and confidence for every important input.
4. Rank only targets that pass gates. Show the raw score, confidence, and unresolved gates beside the rank. A score is a prioritization tool, not an automatic go/no-go.
5. Re-score after diligence, using a change log. Keep initial and revised scores visible so new evidence and changed assumptions are traceable.

The companion `Acquisition_Target_Scorecard.csv` is a reusable input sheet with the worked sample values. Edit the target score columns and add target columns as needed. For a weighted total use `=SUMPRODUCT(weight_range, score_range)/5` in a spreadsheet. Weights are suggested inputs; make explicit changes rather than silently adjusting scores to match a preferred answer.

## Nonnegotiable screening gates

Assess these separately as **PASS / FAIL / OPEN**. An OPEN item means the target is not yet cleared; do not let its weighted total imply that it is. Define acceptable thresholds for the buyer before reviewing targets.

- **Authority and ownership:** seller can convey the assets/shares; no unresolved ownership, title, or transfer restriction.
- **Legal, regulatory, and competition:** no known fatal prohibition; approvals and timing appear manageable within the buyer’s limits.
- **Integrity and sanctions:** no unacceptable bribery, sanctions, fraud, or serious conduct exposure.
- **Solvency and liabilities:** no unfinanceable debt, insolvency, tax, litigation, pension, environmental, privacy, or other exposure beyond agreed risk appetite.
- **Strategic minimum:** target meets a stated strategic need and has a plausible right to win.
- **Economics ceiling:** price plus financing, transaction, and committed integration costs fit the buyer’s return and capital limits under an agreed downside case.
- **Evidence threshold:** critical claims can be corroborated; unresolved critical unknowns have owners, deadlines, and a path to resolution.

Some issues may be addressed with price, escrow, indemnity, conditions, or a revised perimeter. Those remedies do not turn a truly fatal gate into a pass; document the remaining exposure and decision authority.

## Weighted criteria and suggested weights

Weights are percent of the total score. Strategic fit receives 35% because the deal must advance a clear strategy; integration receives 30% because execution failure can destroy value; financial attractiveness receives 35% because the buyer must earn adequate risk-adjusted returns. Rebalance only to reflect the buyer’s stated strategy and capital constraints.

| Dimension / criterion | Weight | Anchors for scoring |
|---|---:|---|
| **Strategic fit (35%)** |||
| Market adjacency | 10 | 1: little relevant overlap; 3: plausible adjacent demand; 5: large, evidenced, reachable market that matches priority |
| Capability / technology | 9 | 1: redundant or unproven; 3: useful but build/partner alternatives exist; 5: differentiated, validated capability materially closes a gap |
| Customer / channel access | 8 | 1: weak access or concentrated/fragile relationships; 3: useful access with caveats; 5: durable, transferable access with verified retention |
| Strategic durability | 8 | 1: easily copied or temporary; 3: some defensibility; 5: durable advantage supported by IP, data, cost, network, or regulatory position |
| **Integration (30%) — 5 means easier** |||
| Operating model compatibility | 8 | 1: incompatible processes/culture/decision rights; 3: manageable changes; 5: compatible model with clear owners and limited disruption |
| Systems / data compatibility | 8 | 1: severe technical debt, cyber, or migration burden; 3: material but bounded work; 5: compatible stack, clean data, and low-risk migration |
| People / regulatory complexity | 7 | 1: critical retention, labor, licensing, or approval obstacles; 3: material but manageable; 5: low complexity and clear continuity plan |
| Execution capacity / time to value | 7 | 1: no accountable capacity or long uncertain path; 3: resourced with dependencies; 5: named team, feasible milestones, quick value realization |
| **Financial attractiveness (35%)** |||
| Standalone cash generation | 9 | 1: weak/volatile conversion; 3: acceptable with identified normalization; 5: durable, well-supported cash generation |
| Price / valuation discipline | 10 | 1: price exceeds risk-adjusted value / return hurdle; 3: near hurdle; 5: meaningful headroom to disciplined standalone value and approved return hurdle |
| Synergy net value | 9 | 1: speculative or negligible net value; 3: plausible, partly evidenced; 5: bottom-up, owner-backed, probability-adjusted value after costs and dis-synergies |
| Downside resilience | 7 | 1: small shocks impair solvency/returns; 3: tolerates a reasonable stress case; 5: strong downside protection and limited irreversible exposure |

### Scoring and uncertainty

The initial score should reflect the best-supported estimate, not a confidence premium. Record confidence separately as **High / Medium / Low** (or a 0–1 factor). If useful, display a confidence-adjusted prioritization view such as `raw score × confidence factor`, but do not treat it as the deal’s expected value or use it to make an otherwise attractive score look precise. Prefer ranges: score 2–4 where evidence is weak, and show low/base/high totals. For shortlist decisions, unresolved high-impact assumptions should trigger a diligence question or gate, not be quietly averaged away.

A practical uncertainty log records: claim/assumption; current estimate and range; evidence/source/date; confidence; impact if wrong; diligence action/owner/deadline; score or model cells affected. Distinguish **unknown** from **bad**: unknown evidence lowers confidence and may widen the range; verified poor performance lowers the criterion score.

## Financial logic: price, synergies, costs, and downside without double counting

Use a consistent enterprise/equity value bridge and define whether cash, debt-like items, working capital, taxes, and transaction expenses are included. Do not compare a headline price to enterprise value without reconciling them.

For the illustrative net value check use:

`Net value = standalone value + present value of risk-adjusted synergies − purchase price − one-time integration costs − transaction/financing costs not already included.`

The scorecard's price and synergy ratings are **judgment criteria**; the separate net-value calculation is a reconciliation/check, not another weighted benefit. Avoid double counting as follows:

- Value standalone operations without buyer-specific synergies. Do not include synergies in both standalone value and synergy PV.
- Model synergy cash flows net of revenue leakage, customer churn, dis-synergies, taxes, required capex, and ongoing costs. Probability- and timing-adjust them; do not apply a second generic “synergy haircut” to a value already probability-adjusted.
- Deduct one-time integration costs once. If synergy PV is already net of those costs, do not deduct them again. The sample figures use **gross PV of synergies**, then subtract one-time integration costs separately.
- Compare price using a clear basis (equity or enterprise); count assumed debt and other debt-like items consistently. Include transaction and financing costs once.
- Score downside resilience on exposure/ability to withstand stress, not by subtracting the same downside losses again from the base net-value figure. Separately show a downside net-value scenario with lower revenue, margins, retention, synergies, and higher costs.
- Treat seller forecasts and buyer synergies as hypotheses until validated by independent evidence and named accountable owners.

## Worked comparison — hypothetical only

### Scores

| Criterion | Weight | Northstar | Juniper | Keystone |
|---|---:|---:|---:|---:|
| Market adjacency | 10 | 5 | 4 | 3 |
| Capability / technology | 9 | 4 | 5 | 3 |
| Customer / channel access | 8 | 4 | 3 | 5 |
| Strategic durability | 8 | 4 | 4 | 3 |
| Operating model compatibility | 8 | 3 | 4 | 2 |
| Systems / data compatibility | 8 | 3 | 4 | 2 |
| People / regulatory complexity | 7 | 4 | 3 | 2 |
| Execution capacity / time to value | 7 | 3 | 4 | 2 |
| Standalone cash generation | 9 | 4 | 3 | 5 |
| Price / valuation discipline | 10 | 3 | 4 | 2 |
| Synergy net value | 9 | 4 | 3 | 5 |
| Downside resilience | 7 | 3 | 4 | 2 |
| **Weighted score / 100** | **100** | **74.0** | **75.2** | **61.0** |

Juniper narrowly leads on the default weighting due to stronger capability fit, easier integration, and price discipline. Northstar is effectively close enough that evidence quality and strategic priorities could reverse their order. Keystone has appealing customer access and cash generation, but difficult integration and weak price/downside scores reduce its initial priority. These rankings assume all three pass the gates; no gate has actually been verified in this fictional example.

### Explicitly hypothetical financial figures ($ millions)

| Item | Northstar | Juniper | Keystone |
|---|---:|---:|---:|
| Purchase price (assumed enterprise value basis) | 500 | 420 | 650 |
| Standalone value (buyer case, excluding synergies) | 520 | 500 | 600 |
| Gross PV of synergies (risk/timing adjusted; before one-time costs) | 80 | 50 | 150 |
| One-time integration cost | 35 | 20 | 90 |
| **Illustrative net value** | **65** | **110** | **10** |

Calculations: Northstar 520 + 80 − 500 − 35 = **65**; Juniper 500 + 50 − 420 − 20 = **110**; Keystone 600 + 150 − 650 − 90 = **10**. Transaction/financing costs are assumed zero for simplicity and should be added in a real case. These are illustrative, not forecasts. If the synergy PV estimates were already net of integration costs, subtracting the cost again would be double counting. Conversely, if the standalone value included buyer synergies, the calculation would overstate value.

## Sensitivity checks

These tests change one priority or assumption at a time. Dimension scores below are criterion-weighted averages within each dimension; alternative totals use the same 1–5 inputs.

| Scenario | Strategic / integration / financial weights | Northstar | Juniper | Keystone | Rank |
|---|---:|---:|---:|---:|---|
| Base | 35 / 30 / 35 | 74.0 | 75.2 | 61.0 | Juniper, Northstar, Keystone |
| Strategy-led | 50 / 20 / 30 | 77.7 | 76.3 | 63.8 | Northstar, Juniper, Keystone |
| Integration-risk-led | 30 / 45 / 25 | 72.4 | 75.5 | 56.5 | Juniper, Northstar, Keystone |
| Cash/returns-led | 25 / 20 / 55 | 73.0 | 73.6 | 64.3 | Juniper, Northstar, Keystone |

Example assumption sensitivity: if Juniper’s capability score falls from 5 to 3 after product validation, its base total falls by 3.6 points (9% × 2 ÷ 5), from **75.2 to 71.6**, moving Northstar to first. If Keystone’s systems compatibility improves from 2 to 4 after architecture diligence, it gains 3.2 points (8% × 2 ÷ 5), from **61.0 to 64.2**, but remains third in this example. If Keystone’s gross synergy PV is cut 50% (150 to 75), its illustrative net value falls from **10 to −65**; the weighted score should also be reduced if the synergy criterion evidence/estimate changes. Do not subtract the same haircut from both the weighted score and the net-value calculation as if they were independent monetary losses: the score is a prioritization signal, while net value is the financial model.

## What deeper diligence can change

Diligence can raise or lower scores, change confidence/ranges, reveal new gates, revise the purchase price, and alter integration cost, synergy timing/probability, and standalone forecasts. Maintain a bridge from initial to updated view: **new evidence → affected assumption → updated score/model → ranking change → decision**. For material findings, show a base and downside case, plus break-even price or synergy needed to meet the buyer’s return hurdle. A target can rise in rank because price falls even if strategic fit is unchanged, or fall because a key capability is less differentiated than claimed.

## Before treating a target as serious

Gather at minimum:

- Strategic thesis, alternative build/partner/buy options, and specific capability gaps the target closes.
- Independently supportable market size, customer references, retention/churn cohorts, concentration, pipeline quality, pricing, and competitive alternatives.
- Audited statements and monthly financials; quality-of-earnings analysis; cash conversion; working-capital seasonality; debt-like items; tax, litigation, pension, environmental, and contingent liabilities.
- Price expectation, value basis, seller process/timing, ownership and transfer rights, financing feasibility, and likely deal structure.
- Product roadmap, IP chain of title, technical architecture, data rights/quality, cyber/privacy history, resilience, technical debt, and migration estimates.
- Key-person dependencies, employee retention needs, compensation/equity obligations, labor issues, operating dependencies, and cultural/decision-making fit.
- Regulatory/competition pathway, required approvals, licenses, customer/contract consents, and realistic timing.
- A bottom-up synergy register with each initiative’s owner, evidence, amount, timing, probability, implementation cost, dependencies, churn/dis-synergy risk, and measurement method.
- A resourced integration plan with accountable executive, workstream leads, milestones, one-time and recurring costs, business-continuity safeguards, and explicit stop/go checkpoints.

A target should enter serious diligence only after a plausible thesis, preliminary gate clearance, an affordable valuation range, and access to evidence needed to resolve the largest uncertainties.
