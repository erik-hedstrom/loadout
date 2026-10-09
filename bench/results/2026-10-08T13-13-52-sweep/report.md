# Sweep: 2026-10-08T13-13-52-sweep

300 requests, 1262 skills in the library, judge claude / opus, effort default.
Request generation/expansion: gpt-6.1-sol (unverified).
Stored provenance: claude / opus, effort default. Warning: files producer is unverified; family separation is not established.
Routing cost $0.3506; mean 1.92 s per decision.
Coverage: every request judged blind; every disputed row adjudicated.

Percentages include 95% Wilson intervals; load-level intervals do not account for within-request correlation.

| | Dev | Test | All |
|---|---:|---:|---:|
| n | 99 | 201 | 300 |
| needed | 44 | 84 | 128 |
| usefulLoaded | 64% (28/44), 49–76% | 73% (61/84), 62–81% | 70% (89/128), 61–77% |
| usefulAvailable | 75% (33/44), 61–85% | 80% (67/84), 70–87% | 78% (100/128), 70–84% |
| helpfulLoadedOnEssential | 88% (7/8), 53–98% | 90% (9/10), 60–98% | 89% (16/18), 67–97% |
| missedBetter | 8% (8/99), 4–15% | 9% (18/201), 6–14% | 9% (26/300), 6–12% |
| quietWhenNone | 76% (42/55), 64–86% | 74% (86/117), 65–81% | 74% (128/172), 67–80% |
| loadPrecision | 70% (44/63), 58–80% | 64% (82/128), 55–72% | 66% (126/191), 59–72% |
| misleadingLoads | 2% (1/63), 0–8% | 7% (9/128), 4–13% | 5% (10/191), 3–9% |
| injectPrecision | 83% (5/6), 44–97% | 90% (18/20), 70–97% | 88% (23/26), 71–96% |
| avgLoaded | 0.64 | 0.64 | 0.64 |

| Category | n | needs a skill | useful loaded | useful available | quiet when none | load precision | misleading loads | missed better |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| web | 24 | 21 | 62% (13/21), 41–79% | 71% (15/21), 50–86% | 33% (1/3), 6–79% | 73% (22/30), 56–86% | 17% (5/30), 7–34% | 21% (5/24), 9–40% |
| backend | 19 | 12 | 75% (9/12), 47–91% | 92% (11/12), 65–99% | 71% (5/7), 36–92% | 75% (12/16), 51–90% | 0% (0/16), 0–19% | 5% (1/19), 1–25% |
| integrations | 19 | 7 | 71% (5/7), 36–92% | 86% (6/7), 49–97% | 75% (9/12), 47–91% | 55% (6/11), 28–79% | 0% (0/11), 0–26% | 16% (3/19), 6–38% |
| documents | 29 | 21 | 62% (13/21), 41–79% | 71% (15/21), 50–86% | 88% (7/8), 53–98% | 82% (14/17), 59–94% | 6% (1/17), 1–27% | 24% (7/29), 12–42% |
| business | 29 | 4 | 75% (3/4), 30–95% | 100% (4/4), 51–100% | 36% (9/25), 20–55% | 23% (5/22), 10–43% | 18% (4/22), 7–39% | 0% (0/29), 0–12% |
| data | 19 | 10 | 80% (8/10), 49–94% | 80% (8/10), 49–94% | 56% (5/9), 27–81% | 63% (10/16), 39–82% | 0% (0/16), 0–19% | 0% (0/19), 0–17% |
| ml | 14 | 7 | 43% (3/7), 16–75% | 43% (3/7), 16–75% | 71% (5/7), 36–92% | 43% (3/7), 16–75% | 0% (0/7), 0–35% | 7% (1/14), 1–31% |
| science | 10 | 4 | 100% (4/4), 51–100% | 100% (4/4), 51–100% | 83% (5/6), 44–97% | 80% (4/5), 38–96% | 0% (0/5), 0–43% | 0% (0/10), 0–28% |
| devops | 19 | 11 | 73% (8/11), 43–90% | 91% (10/11), 62–98% | 63% (5/8), 31–86% | 81% (13/16), 57–93% | 0% (0/16), 0–19% | 16% (3/19), 6–38% |
| security | 14 | 5 | 80% (4/5), 38–96% | 80% (4/5), 38–96% | 67% (6/9), 35–88% | 63% (5/8), 31–86% | 0% (0/8), 0–32% | 7% (1/14), 1–31% |
| debug | 14 | 8 | 88% (7/8), 53–98% | 88% (7/8), 53–98% | 67% (4/6), 30–90% | 82% (18/22), 61–93% | 0% (0/22), 0–15% | 7% (1/14), 1–31% |
| everyday | 33 | 0 | — | — | 97% (32/33), 85–99% | 0% (0/1), 0–79% | 0% (0/1), 0–79% | 0% (0/33), 0–10% |
| media | 14 | 8 | 88% (7/8), 53–98% | 100% (8/8), 68–100% | 83% (5/6), 44–97% | 89% (8/9), 56–98% | 0% (0/9), 0–30% | 14% (2/14), 4–40% |
| writing | 14 | 0 | — | — | 79% (11/14), 52–92% | 0% (0/4), 0–49% | 0% (0/4), 0–49% | 0% (0/14), 0–22% |
| productivity | 10 | 0 | — | — | 100% (10/10), 72–100% | — | — | 0% (0/10), 0–28% |
| apps | 10 | 10 | 50% (5/10), 24–76% | 50% (5/10), 24–76% | — | 86% (6/7), 49–97% | 0% (0/7), 0–35% | 20% (2/10), 6–51% |
| questions | 9 | 0 | — | — | 100% (9/9), 70–100% | — | — | 0% (0/9), 0–30% |

## Misses and misleading loads

- **c1-web-02** (web, judge: helpful) I want a simple portfolio site for my photography, with large images and a contact page. Assume the photographs should be the main focus, wi
  loaded: — · offered: — · judge: frontend-design, minimalist-ui, webapp-testing, frontend-ui-engineering · missed: frontend-design
  Nothing loaded; a design-direction skill like frontend-design or minimalist-ui would help the photography portfolio aesthetic.
- **c1-web-04** (web, judge: none) Can you rewrite my homepage headline so it sounds less corporate? I want it to feel natural, clear, and approachable while preserving what m
  loaded: content-creation, draft-content · offered: — · judge: —
  Rewriting a simple headline needs no skill; marketing content skills add little and may push SEO framing.
- **c1-web-07** (web, judge: helpful) I’d like my bakery’s website to show today’s menu, opening hours, and directions without making visitors hunt around. Assume these are the m
  loaded: business-pulse, brand-style, gh-address-comments · offered: — · judge: frontend-ui-engineering, webapp-testing, accessibility-review · missed: frontend-ui-engineering · misleading: business-pulse, brand-style, gh-address-comments
  All three are unrelated: a finance snapshot, a plugin branding tool and PR comments. A frontend UI skill is needed.
- **c1-web-10** (web, judge: helpful) My footer floats halfway up short pages. Fix the page layout so the footer sits at the bottom of the viewport when content is short and foll
  loaded: — · offered: — · judge: webapp-testing, surgical-patch
  Sticky-footer CSS fix is routine; no skill is clearly needed.
- **c1-web-14** (web, judge: helpful) Help me write a friendly message for my site’s 404 page. I want visitors to understand that the page could not be found and have a clear way
  loaded: ux-copy, brand-guidelines--getsentry · offered: — · judge: ux-copy · misleading: brand-guidelines--getsentry
  ux-copy is right; the Sentry brand guidelines would push the copy toward another company's voice.
- **c1-web-16** (web, judge: helpful) I’d like a browser-based timer that keeps accurate time when I switch tabs and lets me name each session. Assume I mean an elapsed-time stop
  loaded: — · offered: — · judge: frontend-ui-engineering, webapp-testing
  A timestamp-based timer is standard frontend work; skills would only help a little.
- **c1-web-17** (web, judge: helpful) I need to add Spanish to my existing website, including navigation, error messages, and language-specific URLs. Review the current framework
  loaded: — · offered: impeccable · judge: frontend-ui-engineering, webapp-testing
  Adding i18n depends on the framework; no catalog skill is specifically about localization.
- **c1-web-19** (web, judge: helpful) I want a Playwright test covering signup, email verification, and the first successful login using test accounts. Review the existing authen
  loaded: — · offered: webapp-testing · judge: webapp-testing, playwright · missed: webapp-testing
  Writing a Playwright E2E test would benefit from webapp-testing's Playwright tooling guidance.
- **c1-web-20** (web, judge: none) Help me choose five useful FAQ questions for my dog-walking website. Prioritize questions prospective customers need answered before booking
  loaded: brainstorming · offered: — · judge: —
  A simple FAQ copy task needs no skill. Brainstorming's feature-design workflow adds little here.
- **c1-web-23** (web, judge: helpful) My website's search results show outdated page titles. Investigate the metadata and indexing setup to identify the cause. First establish wh
  loaded: investigate-first · offered: seo-ai-visibility, seo-audit, diagnosing-bugs, agent-browser · judge: seo-audit, seo-ai-visibility, investigate-first · missed: seo-ai-visibility
  investigate-first fits the evidence-ranked diagnosis. An SEO skill covering titles, metadata and indexing would add domain checks the task needs.
- **c1-web-22** (web, judge: helpful) I want customers to upload a CSV in their browser, preview the rows, and correct validation errors before submitting. Review the existing su
  loaded: collect-user-input · offered: frontend-ui-engineering, xlsx, security-and-hardening · judge: frontend-ui-engineering, accessibility-review, webapp-testing, api-and-interface-design · missed: frontend-ui-engineering · misleading: collect-user-input
  collect-user-input is Blazor-specific, and nothing suggests this is a Blazor project. A general frontend UI skill fits better.
- **c1-web-24** (web, judge: helpful) I'd like a subtle page transition on my personal site that respects reduced-motion preferences and doesn't delay navigation. Review the exis
  loaded: — · offered: — · judge: vercel-react-view-transitions, frontend-ui-engineering, webapp-testing
  The framework is unknown, so the React view-transitions skill isn't certain to apply. A strong engineer can handle this without a skill.
- **c1-backend-02** (backend, judge: helpful) Help me build an endpoint that accepts a CSV upload, validates each row, and returns errors with row numbers. First check the existing backe
  loaded: — · offered: — · judge: api-and-interface-design, test-driven-development--addyosmani
  This is an ordinary backend endpoint plus tests, and the framework is unknown. No skill is clearly required.
- **c1-backend-05** (backend, judge: helpful) I’d like a background job that emails customers when their invoices become overdue, without sending duplicate reminders. Check the existing 
  loaded: — · offered: incremental-implementation, investigate-first, supabase-postgres-best-practices · judge: supabase-postgres-best-practices, test-driven-development--addyosmani
  Nothing loaded. That's acceptable: the stack is unknown, so Postgres guidance is speculative, and a strong engineer can handle this without a skill.
- **c1-backend-08** (backend, judge: none) I wanna stop duplicate orders when someone double-clicks checkout. Inspect the checkout flow, order creation, database constraints, and paym
  loaded: implement · offered: test-driven-development--addyosmani, surgical-patch · judge: —
  The implement skill expects a spec or tickets, and none exist here. It's harmless but adds little to an idempotency fix.
- **c1-backend-09** (backend, judge: none) I need a webhook receiver that verifies Stripe signatures and safely handles repeated events. Check my existing backend framework, persisten
  loaded: security-and-hardening · offered: source-driven-development, test-driven-development--addyosmani · judge: —
  General hardening is only loosely relevant. Stripe signature checks and dedup are standard work and the request already spells out the requirements.
- **c1-backend-19** (backend, judge: helpful) Help me write integration tests for an order endpoint that reserves stock, records payment status, and rolls back when inventory is insuffic
  loaded: tdd · offered: testing-strategy · judge: testing-strategy, code-testing-agent · missed: testing-strategy
  TDD means writing tests first, but this is about adding tests to existing code. testing-strategy is a better fit for planning integration tests.
- **c1-integrations-04** (integrations, judge: none) I'm trying to send Shopify orders to our warehouse API, but failed requests keep creating duplicate shipments. Help me fix the retry logic s
  loaded: investigate-first · offered: systematic-debugging, debugging-and-error-recovery, implement, test-driven-development--addyosmani · judge: —
  Useful for diagnosing the cause of duplicate shipments before changing the retry logic.
- **c1-integrations-07** (integrations, judge: none) I need to move my Evernote notes into Notion without losing attachments or notebook groupings. Help me plan and carry out a migration that p
  loaded: migration, planning-and-task-breakdown · offered: wizard · judge: —
  Both are aimed at code migrations and task planning, not an Evernote-to-Notion user migration. Harmless but marginal.
- **c1-integrations-08** (integrations, judge: helpful) I’ve got two customer spreadsheets, and I need help deciding which columns should match before I combine them. Ask me for the column headers
  loaded: — · offered: xlsx, interview-me · judge: xlsx, explore-data · missed: xlsx
  Nothing loaded. xlsx would help with reading the spreadsheets and with a safe, non-destructive merge later.
- **c1-integrations-11** (integrations, judge: none) I wanna dump my saved Pocket links into a CSV. Help me figure out what export or saved-data options I have available, without assuming I can
  loaded: xlsx · offered: — · judge: —
  Writing a CSV with proper escaping is simple; xlsx is harmless but adds little.
- **c1-integrations-12** (integrations, judge: helpful) I need help designing a nightly sync from PostgreSQL to BigQuery that handles both updated rows and deleted records. I want a design I can i
  loaded: architecture · offered: brainstorming, sql-queries · judge: bigquery-basics, bigquery-optimization · missed: bigquery-basics
  ADR framing is marginal. BigQuery MERGE and staging guidance would help more.
- **c1-integrations-19** (integrations, judge: helpful) I’m replacing an old accounting system. Help me plan the transfer of customers, invoices, and payment history, including checks that the tot
  loaded: migration, planning-and-task-breakdown · offered: deprecation-and-migration, write-spec · judge: reconciliation, migration, close-management · missed: reconciliation
  Migration covers rollback and preservation. Accounting reconciliation of totals is central here, and reconciliation was missed.
- **c1-documents-03** (documents, judge: essential) Please convert my attached Word document to PDF, preserving its layout and clickable links. Keep the page size, margins, fonts, headings, ta
  loaded: — · offered: pdf--openai, pdf · judge: docx, pdf, pdf--openai · missed: docx
  The PDF deliverable needs docx/pdf tooling. Loading nothing is a clear miss.
- **c1-documents-04** (documents, judge: helpful) I don't understand this insurance letter. Please explain in plain language what it means, what I need to do, and by when. Start with a short
  loaded: — · offered: — · judge: pdf
  Explaining the letter is mostly reading comprehension. Loading pdf would be marginal, so an empty set is acceptable.
- **c1-documents-07** (documents, judge: helpful) I'd like a reusable invoice template for my freelance translation work, with clear fields for payment details and due dates. Include placeho
  loaded: — · offered: — · judge: xlsx, docx · missed: docx
  An editable template file would benefit from docx or xlsx skills.
- **c1-documents-06** (documents, judge: helpful) I have three versions of a policy document. Please compare all three and list every substantive change with its section number. Establish th
  loaded: — · offered: — · judge: docx, pdf
  The comparison is mainly analysis. File-format skills would only help with reading the files, so an empty set is acceptable.
- **c1-documents-09** (documents, judge: helpful) I need this report shortened to two pages without losing its findings or recommendations. Preserve the meaning, key evidence, important qual
  loaded: — · offered: docx, writing-shape, scientific-writing · judge: docx, pdf · missed: docx
  The revised report must fit two pages exactly, so docx is needed to control layout.
- **c1-documents-13** (documents, judge: helpful) I want a plain-English summary of this lease, especially the fees, renewal terms, and responsibilities. Use only the lease’s contents and id
  loaded: contract-review · offered: — · judge: pdf, contract-review · missed: pdf
  contract-review is built for SMB vendor contracts and redlines, not tenant lease summaries. A PDF-reading skill would help extract the lease text with page references.
- **c1-documents-20** (documents, judge: none) Please turn my interview transcript into a readable Q&A, removing filler words without changing what either speaker meant. Keep the original
  loaded: writing-shape · offered: — · judge: — · misleading: writing-shape
  writing-shape reshapes raw material into an article, which conflicts with a light, faithful transcript cleanup. No skill is needed.
- **c1-documents-21** (documents, judge: helpful) I want a simple permission slip for my school's museum trip, including emergency contact and parent signature fields. Draft a clear, printab
  loaded: — · offered: — · judge: docx, pdf · missed: docx
  A printable one-page form benefits from docx (or pdf) to get the layout and signature fields right.
- **c1-documents-28** (documents, judge: helpful) I want a glossary of the acronyms in the supplied technical report, based strictly on the report itself. Review the full document, including
  loaded: — · offered: — · judge: pdf, liteparse, pdf--openai · missed: pdf
  The report is likely a PDF, and a PDF skill would help extract tables, footnotes and page references.
- **c1-documents-29** (documents, judge: essential) Please turn my event schedule into a polished, printable program with a welcome note and speaker biographies. Preserve the supplied session 
  loaded: pdf--openai · offered: docx, planning-and-task-breakdown · judge: pdf, docx, pdf--openai · missed: docx
  pdf--openai covers the print-ready PDF with visual checks. docx is needed for the editable version.
- **c1-business-03** (business, judge: none) I need a one-page business case for hiring a customer success manager at our 30-person software company. Assume the audience is our leadersh
  loaded: org-planning · offered: — · judge: —
  org-planning touches on headcount but adds little to a one-page business case. Not harmful.
- **c1-business-05** (business, judge: none) Help me turn our vague goal of improving customer retention into exactly three measurable quarterly objectives. Start by clarifying our busi
  loaded: define-goal · offered: interview-me · judge: —
  define-goal is aimed at agent goal tooling rather than business OKRs. It is related but adds little.
- **c1-business-07** (business, judge: none) I've got too many meetings. Help me decide which ones my team can drop while preserving decisions, coordination, and accountability. Start b
  loaded: process-optimization · offered: brainstorming · judge: —
  process-optimization is loosely relevant to cutting meetings, and a strong assistant handles this without it.
- **c1-business-09** (business, judge: helpful) I sell handmade furniture online. Help me identify customer segments worth considering and ways to test their demand cheaply. Ask for the pr
  loaded: — · offered: interview-me, customer-persona, user-research, idea-refine · judge: customer-persona
  customer-persona might help slightly, but nothing is clearly needed. Loading nothing is reasonable.
- **c1-business-08** (business, judge: none) I need an agenda for a two-hour strategy workshop with six department heads, ending with agreed priorities and owners. Assume I will facilit
  loaded: notion-meeting-intelligence · offered: — · judge: —
  Workshop agenda design is general facilitation; Notion-dependent context gathering adds little without a connected workspace.
- **c1-business-11** (business, judge: none) I'm considering opening a second café. Give me a practical decision checklist covering demand, staffing, cash flow, and operational readines
  loaded: risk-assessment · offered: idea-refine · judge: —
  Risk framing loosely relevant; a strong assistant builds this expansion checklist unaided.
- **c1-business-12** (business, judge: none) I need to choose between two suppliers: one is cheaper, while the other delivers faster and has fewer defects. Help me compare their total b
  loaded: vendor-review · offered: — · judge: —
  Side-by-side vendor TCO comparison matches the request closely, so it modestly improves structure.
- **c1-business-13** (business, judge: none) I want a simple SWOT analysis for my neighborhood dog-walking business. Organize it into strengths, weaknesses, opportunities, and threats, 
  loaded: competitor-teardown · offered: — · judge: —
  Simple SWOT needs no competitor research workflow or visual deliverables.
- **c1-business-14** (business, judge: none) Help me draft a respectful message explaining why my team is postponing a project. I want to communicate the decision clearly, acknowledge i
  loaded: draft-response, stakeholder-update · offered: internal-comms, discernment-nudge · judge: —
  A short postponement email is easy writing; these skills are only adjacent.
- **c1-business-15** (business, judge: none) I manage twelve people across three time zones. Help me design a weekly operating rhythm that minimizes meetings while keeping work coordina
  loaded: process-optimization · offered: brainstorming · judge: —
  Designing a meeting rhythm is general management advice. Process-optimization adds little.
- **c1-business-16** (business, judge: none) I want to compare selling directly to consumers with selling through retailers for my new skincare brand. Help me decide which channel to pr
  loaded: consciousness-council · offered: idea-refine · judge: — · misleading: consciousness-council
  Simulating archetypes would distract from the requested channel comparison and unit-economics framework.
- **c1-business-17** (business, judge: none) My cofounder and I disagree about expanding internationally. Help me structure a discussion that ends with a clear decision while preserving
  loaded: consciousness-council · offered: notion-meeting-intelligence, idea-refine, scientific-brainstorming · judge: —
  The user wants a real discussion agenda, not a simulated council. The skill is marginal.
- **c1-business-18** (business, judge: none) I need a launch plan for a bookkeeping service aimed at independent tradespeople, with milestones for the first ninety days. My goal is to v
  loaded: planning-and-task-breakdown · offered: discernment-nudge, compliance-check · judge: —
  This skill targets software task breakdown; a business launch plan needs no special skill.
- **c1-business-20** (business, judge: none) I want to identify the biggest assumptions in my business plan before I spend money building the product. Help me separate evidence from bel
  loaded: idea-refine · offered: doubt-driven-development, risk-assessment, product-brainstorming, grill-me · judge: —
  Stress-testing assumptions overlaps slightly; an assumptions register is standard work for a general assistant.
- **c1-business-23** (business, judge: none) I need exactly five customer interview questions to learn why small retailers abandon inventory software. Assume I’m interviewing owners or 
  loaded: brief, interview-me, academy-guide · offered: — · judge: — · misleading: brief, interview-me, academy-guide
  Nothing loaded fits. Brief covers legal work, interview-me interviews the user, and academy-guide covers Claude product help. A plain answer is enough.
- **c1-business-25** (business, judge: none) I want to assess whether my company should centralize purchasing or let each branch choose its own vendors. Help me compare those options an
  loaded: consciousness-council · offered: risk-assessment, idea-refine · judge: —
  The council format adds little to a structured decision framework. It's harmless, and no skill is needed.
- **c1-business-26** (business, judge: none) My sales and support teams keep blaming each other for churn. Help me define shared responsibilities and a practical escalation process that
  loaded: process-doc · offered: process-optimization · judge: —
  Its RACI and SOP structure helps with mapping responsibilities and writing the operating agreement.
- **c1-data-01** (data, judge: helpful) I need my contact list deduplicated by email, keeping the most recently updated entry for each address. Assume email matching ignores surrou
  loaded: — · offered: — · judge: xlsx
  Input format is unknown. If it's a spreadsheet, xlsx would help, but nothing loaded is a reasonable choice.
- **c1-data-05** (data, judge: none) I want a quick summary of these survey responses, including common themes and a few representative quotes. Base the summary only on the supp
  loaded: research-synthesis, synthesize-research · offered: — · judge: —
  Both overlap with the task, but they push toward recommendations and roadmaps, which the user didn't ask for. The basic synthesis is simple.
- **c1-data-07** (data, judge: helpful) My expense categories are a mess. I want you to suggest a consistent grouping and flag transactions you can't confidently classify. Review t
  loaded: — · offered: — · judge: xlsx
  Nothing loaded is reasonable. xlsx would only help if the file is a spreadsheet.
- **c1-data-11** (data, judge: none) I’d like a concise executive summary of the supplied quarterly performance table, centered on the three most important findings. Use only th
  loaded: metrics-review, analyze · offered: performance-report, variance-analysis · judge: —
  A short summary of a supplied table needs no skill. Both are harmless, but metrics-review may push toward recommendations.
- **c1-data-16** (data, judge: none) I’m tracking support tickets and want the median resolution time by priority, with an explanation of how unresolved tickets affect interpret
  loaded: analyze · offered: explore-data, exploratory-data-analysis, report-builder · judge: —
  A simple median calculation with caveats. The general analysis guidance adds little.
- **c1-data-17** (data, judge: none) I need my JSON records converted to CSV, with nested address fields flattened into clearly named columns such as address_street, address_cit
  loaded: xlsx · offered: polars · judge: —
  JSON-to-CSV is a simple conversion, so xlsx is marginal. It may help keep postal codes as text.
- **c1-ml-06** (ml, judge: helpful) My validation score seems suspiciously good. Review my preprocessing pipeline for data leakage and determine whether the score reflects perf
  loaded: — · offered: analyze-project, exploratory-data-analysis, investigate-first, doubt-driven-development · judge: scikit-learn · missed: scikit-learn
  A leakage review would benefit from scikit-learn guidance on fitting Pipeline steps within cross-validation folds. Loading nothing is weak but defensible.
- **c1-ml-05** (ml, judge: none) I'm predicting house prices and want to understand when I should use linear regression versus a random forest. Explain the trade-offs in ter
  loaded: scikit-learn · offered: — · judge: —
  This is a conceptual explanation. A strong assistant can answer it without the scikit-learn reference, which adds little but does no harm.
- **c1-ml-08** (ml, judge: helpful) I've got unlabeled support tickets. Help me group them into useful topics and judge whether the clusters make sense.

Assume my goal is to i
  loaded: — · offered: research-synthesis, synthesize-research, bigquery-ai-ml · judge: scikit-learn, umap-learn, train-sentence-transformers
  The task is mostly planning and evaluation design. Embedding or clustering skills would help slightly, but none is clearly essential.
- **c1-ml-09** (ml, judge: helpful) I want to forecast weekly sales across 40 stores. Design a validation strategy that respects time order and handles stores with little histo
  loaded: aeon · offered: — · judge: statsmodels, aeon
  The work is designing a validation strategy. aeon's library-specific details add little, and the agent can design time-ordered backtests without it.
- **c1-ml-12** (ml, judge: helpful) I'm fine-tuning a text classifier on uneven class sizes. Help me compare weighted loss, oversampling, and collecting more examples, and deci
  loaded: scikit-learn · offered: scientific-brainstorming, scientific-critical-thinking · judge: experimental-design, statistical-analysis, transformers
  This is mostly experiment-design reasoning. scikit-learn's metrics and sampling references help a little, and an experimental-design skill would add slightly more.
- **c1-ml-14** (ml, judge: none) I’m building recommendations from purchase history. Propose a simple baseline and an evaluation plan that avoids using future purchases. Ass
  loaded: scikit-learn · offered: brainstorming, planning-and-task-breakdown · judge: —
  The task is a simple recommender baseline and chronological evaluation. scikit-learn is not central, and no skill is needed.
- **c1-science-03** (science, judge: none) I want to understand what a small p-value tells me and why it doesn’t prove a scientific hypothesis. Explain this in plain English, assuming
  loaded: scientific-critical-thinking · offered: statistical-analysis--anthropics · judge: —
  Plain-English p-value explanations are standard knowledge. The loaded skill is related but adds little.
- **c1-devops-02** (devops, judge: helpful) My deploy broke; help me roll back safely and restore service. First establish the deployment platform, affected environment, symptoms, curr
  loaded: — · offered: shipping-and-launch, debugging-and-error-recovery, migration, runbook · judge: incident-response, debugging-and-error-recovery, deploy-checklist · missed: incident-response
  A rollback during an outage fits incident-response triage. The offered runbook and migration skills would also help.
- **c1-devops-04** (devops, judge: helpful) I want my GitHub Actions workflow to test pull requests and deploy to staging only after merges. Check the existing workflow, test commands,
  loaded: — · offered: — · judge: ci-cd-and-automation, gha-security-review, gh-cli · missed: ci-cd-and-automation
  A CI pipeline with gated staging deployment matches ci-cd-and-automation. gha-security-review would also help with keeping secrets away from PR runs.
- **c1-devops-07** (devops, judge: none) I keep running out of disk space on my Ubuntu server. Help me find what's growing and understand why before suggesting cleanup. Start with a
  loaded: investigate-first · offered: runbook, debugging-and-error-recovery · judge: —
  Disk diagnosis is routine work for a strong assistant. The investigate-first framing lines up with the request but adds little.
- **c1-devops-10** (devops, judge: helpful) I'm new to on-call work. Give me a beginner-friendly checklist for what to check first when an uptime alert fires. Organize it in the order 
  loaded: runbook · offered: incident-response, documentation · judge: incident-response, runbook · missed: incident-response
  Runbook helps with escalation structure, but incident-response matches triage, status communication and severity calls more directly.
- **c1-devops-11** (devops, judge: helpful) Help me stop secrets from appearing in my CI logs. Ask which CI platform I use and review relevant pipeline configuration and redacted log e
  loaded: — · offered: ci-cd-and-automation · judge: ci-cd-and-automation, security-and-hardening, gha-security-review
  Nothing loaded. The CI or security skills would add a little at most; a strong assistant handles log secret hygiene well on its own.
- **c1-devops-15** (devops, judge: none) I need a short maintenance notice for a planned thirty-minute outage. Write a concise, customer-facing message that states when maintenance 
  loaded: draft-response · offered: ux-copy, brand-guidelines--getsentry, stakeholder-update · judge: —
  A short maintenance notice is a trivial writing task. The customer-response skill fits loosely but adds little.
- **c1-devops-14** (devops, judge: none) I'd like to schedule nightly PostgreSQL backups and verify that I can restore them. Help me turn this into a reliable, repeatable process fo
  loaded: runbook · offered: writing-plans, documentation · judge: —
  The user explicitly asks for a restore runbook, so the runbook skill's structure helps with that deliverable.
- **c1-security-06** (security, judge: none) Help me configure SSH on my Ubuntu server so only key-based logins are allowed. First check my Ubuntu and OpenSSH versions, effective SSH co
  loaded: runbook · offered: verification-before-completion, migration, doubt-driven-development · judge: —
  SSH hardening is standard admin knowledge. The runbook format is harmless but adds little.
- **c1-security-05** (security, judge: none) I need a practical security checklist before I launch a small online store that accepts payments through Stripe. Assume I have a small team 
  loaded: security-and-hardening · offered: shipping-and-launch · judge: —
  The security-and-hardening skill covers third-party integrations, secrets and input validation, all relevant to a launch checklist for a payments store.
- **c1-security-12** (security, judge: none) Help me write a policy for securely disposing of old laptops and backup drives. Assume this is for a small organization unless I provide dif
  loaded: process-doc · offered: documentation · judge: —
  Policy drafting is general writing. The RACI/SOP framing adds little; it's harmless but not needed.
- **c1-security-14** (security, judge: helpful) Draft a tabletop exercise for my team involving ransomware, unavailable backups, and a suspected customer data leak. Assume a 90-minute, dis
  loaded: documentation · offered: discernment-nudge · judge: incident-response · missed: incident-response
  Generic tech-writing skill adds little. An incident-response workflow would better structure triage, communications, and escalation.
- **c1-debug-01** (debug, judge: helpful) My Python script hangs after printing 'connected.' Help me figure out exactly where it's getting stuck. Start by asking for the smallest use
  loaded: — · offered: — · judge: systematic-debugging, investigate-first, diagnosing-bugs · missed: systematic-debugging
  Nothing was loaded. A structured debugging skill would help guide hypothesis-driven diagnosis of the hang.
- **c1-debug-06** (debug, judge: none) I changed my Excel formula, and now every total is zero. Help me identify the likely mistake without overwriting my original data. Ask me fo
  loaded: xlsx · offered: debugging-and-error-recovery · judge: —
  The user is pasting formulas, not sharing a file, so the xlsx file-manipulation skill adds little.
- **c1-debug-08** (debug, judge: none) My Docker container exits immediately, but the same app runs locally. Help me find the difference causing it to stop. Ask for the Dockerfile
  loaded: debugging-and-error-recovery, debug · offered: — · judge: —
  Interactive Docker troubleshooting is standard work. The generic debugging skills are harmless but add little.
- **c1-everyday-10** (everyday, judge: none) Help me write a return request for shoes that arrived in the wrong size. I want a short, polite but firm message I can send to the seller. E
  loaded: draft-response · offered: — · judge: —
  Business-to-customer reply skill; this is a consumer writing to a seller. Plain writing is enough.
- **c1-media-08** (media, judge: essential) I want a mellow instrumental loop for my cooking videos, featuring acoustic guitar and no vocals. Assume a 20–30-second loop unless I specif
  loaded: — · offered: ai-music, elevenlabs-music, ai-music-generation, elevenlabs-music-generation · judge: ai-music, elevenlabs-music-generation, ai-music-generation, elevenlabs-music, ace-step · missed: ai-music
  Generating music needs a tool; nothing was loaded, so the agent can't deliver an audio file.
- **c1-media-09** (media, judge: none) Give me exactly three funny captions for my photo of a cat sitting inside a mixing bowl. Keep each caption short, punchy, and ready to post.
  loaded: ai-social-media-content · offered: draft-content · judge: —
  Three simple captions need no skill; media-generation tooling adds nothing.
- **c1-media-11** (media, judge: helpful) I want my vacation clips turned into a one-minute montage, with gentle transitions and the original ocean sounds clearly audible. Assume the
  loaded: general-video · offered: hyperframes, media-use · judge: hyperframes, general-video, hyperframes-audio · missed: hyperframes
  general-video covers montages, but hyperframes is the required entry point for video work.
- **c1-writing-04** (writing, judge: none) I’m announcing that my bakery will close on Mondays starting next month. Draft a friendly Instagram caption that clearly explains the change
  loaded: draft-content · offered: ai-social-media-content, social-content-engine, canva-creator · judge: —
  A short Instagram caption is trivial; the skill adds little.
- **c1-writing-07** (writing, judge: none) I need a subject line for an overdue invoice reminder. Assume this is a professional reminder to a customer, and keep the tone polite, clear
  loaded: draft-content · offered: invoice-chase, draft-response, email-design · judge: —
  Five subject lines need no skill.
- **c1-writing-13** (writing, judge: none) Draft a plain-language customer email based on this technical update: our database migration is complete, average page loads are 20% faster,
  loaded: draft-content, draft-response · offered: brand-guidelines--getsentry, product-changelog, stakeholder-update, content-creation · judge: —
  A simple plain-language email; the skills are harmless but unnecessary.
- **c1-apps-01** (apps, judge: helpful) I want a simple app for tracking books I’ve read. Help me turn that into a small, usable first version. Assume it’s for personal use, with b
  loaded: — · offered: — · judge: lean-build, webapp-testing, frontend-ui-engineering
  A strong programmer can build a small CRUD app; skills would be optional.
- **c1-apps-02** (apps, judge: helpful) Help me build a shared grocery list where my housemates can add items, mark them bought, and see who changed what. Assume we need one househ
  loaded: — · offered: — · judge: lean-build, supabase, webapp-testing, frontend-ui-engineering
  Shared persistence could benefit from supabase, but the backend choice is open; no skill is clearly required.
- **c1-apps-04** (apps, judge: helpful) I need a small web app for splitting trip expenses among friends, including costs shared by only some people. Assume one currency per trip a
  loaded: — · offered: — · judge: lean-build, webapp-testing, property-based-testing · missed: webapp-testing
  Nothing loaded. Browser testing with webapp-testing would help verify the app works; property-based testing would suit the balance-reconciliation invariant.
- **c1-apps-06** (apps, judge: helpful) I wanna track my plants and watering dates. Help me make a simple app where I can add a plant, record when I water it, and see its latest wa
  loaded: — · offered: — · judge: lean-build, frontend-ui-engineering, webapp-testing
  A simple CRUD app that a strong agent can build unaided. Testing or UI skills would help a little, but none is clearly needed.
- **c1-apps-09** (apps, judge: helpful) Help me create an offline notes app that saves locally and lets me export everything as Markdown. My goal is a simple, dependable app for wr
  loaded: — · offered: — · judge: webapp-testing, frontend-ui-engineering, verification-before-completion · missed: webapp-testing
  Verifying persistence, offline use and export in a real browser benefits from webapp-testing, and nothing was loaded.
