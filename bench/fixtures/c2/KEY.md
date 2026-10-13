# C2 answer key

For the judge (see [PROTOCOL.md](PROTOCOL.md)). Each line is what a good answer
gets right, with the planted traps, so the judge can check correctness instead
of style. Numbers come from the committed inputs. Whether tests pass and files
open is checked by script, not here.

## docx-lease-amendment
- Clause 4: CPI limb gone; "up to 3%" and a fixed 3% both meet the request. Exhibit A updated to match (at 3%: $4,326.00 and $4,455.78, as maximums under a cap), not left at 5%.
- Clause 9: 60 days. Clause 6: roof, foundation, exterior walls and structure move to the landlord. Heating/cooling replacement is not structural and stays with the tenant.
- Clauses 11 (guaranty) and 3 unchanged. The paste-ready note is 2-3 sentences and says what changed.

## xlsx-budget-cleanup
- 56 entries, 2 exact duplicates (54 unique), 2 blank rows, 1 TOTAL row to drop. Amounts in text ("$1,200.00") become numbers; 5 parenthesised amounts are credits (negative).
- Departments collapse to four: Marketing, Engineering, Sales, Operations. Months become real dates; the "YYYY-MM" text ones included.
- Clean total is 252,841.98 (credits negative); 264,485.26 if parentheses are read as positive. The export's own TOTAL, 187,432.10, matches neither, and the answer says so.
- Summary cells are formulas (SUMIFS or similar) over Clean, not values.

## pdf-invoice-extract
- 9 line items on 3 invoices. INV-1042 total 825.50 (correct), INV-0388 855.00 + 7% tax 59.85 = 914.85 (correct), INV-2217 lines sum to 526.60 but total due says 626.60: overcharged 100.00.

## pptx-board-deck
- One message per slide, every figure unchanged ($4.82M vs plan $4.60M, 61% margin, 9 net new accounts, 2h 35m, 94.5%, CSAT 4.4, $38k, 15 November, and so on). Speaker notes on each slide. Dropping a figure is fine; changing one is not.

## docx-minutes
- Date base: Tuesday 10 March 2026. 2.3 ships Tue 24 March (the 17th was proposed and rejected). Dark mode out of 2.3, target 2.4.
- Owners and dates: Maya sends Colin the customer wording today (10 Mar); Colin then emails his three affected customers (no date given). Tomas cuts the release candidate by Tue 17 Mar. Ines finishes the remaining dark-mode screens Fri 13 Mar. Tomas estimates dark mode Wed 18 Mar. Tomas writes the BOM workaround Wed 11 Mar and fixes the BOM import bug in 2.3. Raj tags the BOM tickets by Fri 13 Mar. Ines puts logo assets on the site Fri 20 Mar.
- Open questions: cost per seat and team-tier price. Asking legal about shared workspaces has no owner and must be flagged, not assigned. Whether to skip the 17 March sync is decided Mon 16 Mar.

## web-pricing-fix
- No sideways scroll at about 360 px wide (fixed 960px widths). Contrast: #8aa4d6, #aaa, #bbb, #999 on white fail WCAG AA.
- Buttons are divs with onclick: not focusable. Make them links or buttons. `outline: none` on links removes the focus ring. The logo and the check/cross images need text alternatives. Missing viewport meta and lang; headings start at h2 and the FAQ jumps to h4; empty th.

## web-landing-new
- Uses only the brief's facts (41 groups, 19 self-reported coordinators, offline, $9, free tier and schools). No invented numbers, quotes or logos. Three points, proof, pricing, 3 FAQs, footer address, both CTAs.
- One file, nothing loaded from the network, usable at phone width, brand colours used with readable contrast.

## web-signup-form
- Rules: email format, password at least 10 characters with a digit, passwords match, terms checked. Errors beside fields, tied to inputs (aria-describedby, aria-invalid) and announced (live region or focus move). fetch call untouched. Rules in a module a Node test can import, with tests for `node --test`.

## data-sales-clean
- 336 rows, 6 exact duplicate order IDs. Mixed dates: ISO and 71 slash dates, 47 of them with a day above 12, which settles MM/DD/YYYY (and Q3 fits it). Region has case variants, padding and blanks. Some prices carry "$".
- Odd rows: ORD-1089 price 1450.00 (100x SKU-100's 14.50), ORD-1200 price 0.00, ORD-1251 discount 95% (but cancelled), ORD-1211 qty 0, ORD-1121 qty -2 but shipped. Refunds (negative qty, status refunded) are legitimate. Treatment of pending/cancelled orders is stated.
- Rerunnable script plus findings.md.

## data-ab-test
- Aggregate B 4.64% against A 3.86% is misleading. No significant per-device difference: desktop B 6.17% vs A 5.91% (z about 0.9), mobile B 2.15% vs A 2.50% (z about -1.85). B got 62% desktop traffic against A's 40%, and its traffic share dropped from 50% to 36% on day 8. Assignment looks broken. No evidence B wins; do not ship on this data. Says what to run instead.

## data-orders-sqlite
- 40 records, 38 people: C039 is C004 and C040 is C012 (same name, email in upper case), each with orders of its own. Net spend in cents, refunds subtracted. Two Lena Hale records (C008, C019) have different emails and are not shown to be one person.
- Top 3 after merging: C004 with C039 $752.00, C027 $733.00, C023 $545.00. Without merging, C004 ($419.00) drops out and C028 ($512.00) enters the top 3.
- Most refunded money: February 2025 ($128.00, by refund date; also February by order date). Customers with one order: 9 after merging, 11 before.
- A reusable build script, a normalised schema, money as integer cents.

## devops-ci-slow
- Same checks stay. Good changes: dependency cache, `npm ci`, the second `npm install` removed, concurrency cancel, jobs split in parallel where independent, newer action versions, a pinned Node and base image, Dockerfile copies package files before the source and builds in stages, `.dockerignore`, smoke test waits for health instead of `sleep 20`, image pushed by SHA as well as latest, least-privilege `permissions`.
- Does not claim measured minutes it cannot know.

## devops-compose-debug
- `localhost` in DATABASE_URL must be `db`. PORT 3000 against published 8080:8080. `depends_on` without a healthcheck. Volume path /var/lib/postgres must be /var/lib/postgresql/data (the data loss). Publishing 5432 is optional and can clash with a local Postgres.

## code-logsum-flags
- `--since` compares request dates (log lines span 8 to 11 March 2026); `--status` takes 5xx or an exact code; both together work; default output unchanged. The "-- logrotate" line still counts as unparsed.

## ctl-ratelimiter-bug
- Per-key buckets; refill divides elapsed ms by 1000; tokens capped at capacity. Tests unchanged. Test 6 (a rejected request takes nothing) already passes on the unfixed code.

## ctl-interval-merge
- Sorts a copy, merges overlapping and touching, rejects start > end, leaves the input untouched; tests cover empty, single, unsorted, touching, nested, duplicate and invalid input.

## ctl-merge-conflict
- No markers left. Both `volume_discount` and the `state` argument kept; discount applies before tax.

## ctl-customer-reply
- Under 150 words. Apologises once, mentions HARBOR15, does not blame the carrier, does not promise a delivery date. Either issues the refund now (she asked for her money back if the skillet cannot arrive by the 18th, and that cannot be promised) or offers the choice with the refund first; her choice is the only thing asked of her, no "get back to us". The refund for order 48213 is in the separate note.
