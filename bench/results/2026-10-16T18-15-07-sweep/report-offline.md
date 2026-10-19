# Sweep: 2026-10-16T18-15-07-sweep

300 requests; offline scoring, no model calls, $0 scoring cost.
Request generation/expansion: gpt-6.1-sol (unverified).
Stored provenance: claude / opus, effort default. Warning: files producer is unverified; family separation is not established.
Blind answers reused from bench/results/2026-10-08T13-13-52-sweep/judge-blind.jsonl.
Prior ratings reused from bench/results/2026-10-08T13-13-52-sweep/judge-verdicts.jsonl.
Precision bounds: unrated loads counted not-useful / counted useful, each with a Wilson interval. Other usefulness metrics count known helpful skills only; misleading loads count known misleading ratings only. Missed better: not shown (requires adjudication of the current loaded set).
Routing cost $0.3531; mean 1.63 s per decision.
Coverage: every request judged blind; unrated loads retained in scores.

Percentages include 95% Wilson intervals; load-level intervals do not account for within-request correlation.

| | Dev | Test | All |
|---|---:|---:|---:|
| n | 99 | 201 | 300 |
| needed | 44 | 84 | 128 |
| usefulLoaded | 68% (30/44), 53–80% | 70% (59/84), 60–79% | 70% (89/128), 61–77% |
| usefulAvailable | 80% (35/44), 65–89% | 80% (67/84), 70–87% | 80% (102/128), 72–86% |
| helpfulLoadedOnEssential | 88% (7/8), 53–98% | 90% (9/10), 60–98% | 89% (16/18), 67–97% |
| missedBetter | not shown | not shown | not shown |
| quietWhenNone | 75% (41/55), 62–84% | 75% (88/117), 67–82% | 75% (129/172), 68–81% |
| loadPrecision | 71% (47/66), 59–81% / 74% (49/66), 63–83% | 67% (76/113), 58–75% / 70% (79/113), 61–78% | 69% (123/179), 62–75% / 72% (128/179), 64–78% |
| unratedLoads | 2 | 3 | 5 |
| misleadingLoads | 2% (1/66), 0–8% | 2% (2/113), 0–6% | 2% (3/179), 1–5% |
| injectPrecision | 83% (5/6), 44–97% / 83% (5/6), 44–97% | 86% (18/21), 65–95% / 90% (19/21), 71–97% | 85% (23/27), 68–94% / 89% (24/27), 72–96% |
| avgLoaded | 0.67 | 0.56 | 0.60 |

| Category | n | needs a skill | useful loaded | useful available | quiet when none | load precision | misleading loads | missed better |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| web | 24 | 21 | 67% (14/21), 45–83% | 76% (16/21), 55–89% | 67% (2/3), 21–94% | 84% (21/25), 65–94% / 84% (21/25), 65–94% | 8% (2/25), 2–25% | not shown |
| backend | 19 | 12 | 75% (9/12), 47–91% | 92% (11/12), 65–99% | 71% (5/7), 36–92% | 75% (12/16), 51–90% / 75% (12/16), 51–90% | 0% (0/16), 0–19% | not shown |
| integrations | 19 | 7 | 71% (5/7), 36–92% | 86% (6/7), 49–97% | 75% (9/12), 47–91% | 55% (6/11), 28–79% / 55% (6/11), 28–79% | 0% (0/11), 0–26% | not shown |
| documents | 29 | 21 | 67% (14/21), 45–83% | 76% (16/21), 55–89% | 88% (7/8), 53–98% | 84% (16/19), 62–94% / 89% (17/19), 69–97% | 0% (0/19), 0–17% | not shown |
| business | 29 | 4 | 50% (2/4), 15–85% | 100% (4/4), 51–100% | 32% (8/25), 17–52% | 21% (4/19), 9–43% / 32% (6/19), 15–54% | 5% (1/19), 1–25% | not shown |
| data | 19 | 10 | 80% (8/10), 49–94% | 80% (8/10), 49–94% | 56% (5/9), 27–81% | 60% (9/15), 36–80% / 67% (10/15), 42–85% | 0% (0/15), 0–20% | not shown |
| ml | 14 | 7 | 43% (3/7), 16–75% | 43% (3/7), 16–75% | 71% (5/7), 36–92% | 50% (3/6), 19–81% / 50% (3/6), 19–81% | 0% (0/6), 0–39% | not shown |
| science | 10 | 4 | 100% (4/4), 51–100% | 100% (4/4), 51–100% | 83% (5/6), 44–97% | 80% (4/5), 38–96% / 80% (4/5), 38–96% | 0% (0/5), 0–43% | not shown |
| devops | 19 | 11 | 64% (7/11), 35–85% | 91% (10/11), 62–98% | 63% (5/8), 31–86% | 80% (12/15), 55–93% / 80% (12/15), 55–93% | 0% (0/15), 0–20% | not shown |
| security | 14 | 5 | 80% (4/5), 38–96% | 80% (4/5), 38–96% | 67% (6/9), 35–88% | 71% (5/7), 36–92% / 71% (5/7), 36–92% | 0% (0/7), 0–35% | not shown |
| debug | 14 | 8 | 88% (7/8), 53–98% | 88% (7/8), 53–98% | 67% (4/6), 30–90% | 77% (17/22), 57–90% / 82% (18/22), 61–93% | 0% (0/22), 0–15% | not shown |
| everyday | 33 | 0 | — | — | 97% (32/33), 85–99% | 0% (0/1), 0–79% / 0% (0/1), 0–79% | 0% (0/1), 0–79% | not shown |
| media | 14 | 8 | 88% (7/8), 53–98% | 100% (8/8), 68–100% | 83% (5/6), 44–97% | 89% (8/9), 56–98% / 89% (8/9), 56–98% | 0% (0/9), 0–30% | not shown |
| writing | 14 | 0 | — | — | 86% (12/14), 60–96% | 0% (0/2), 0–66% / 0% (0/2), 0–66% | 0% (0/2), 0–66% | not shown |
| productivity | 10 | 0 | — | — | 100% (10/10), 72–100% | — / — | — | not shown |
| apps | 10 | 10 | 50% (5/10), 24–76% | 50% (5/10), 24–76% | — | 86% (6/7), 49–97% / 86% (6/7), 49–97% | 0% (0/7), 0–35% | not shown |
| questions | 9 | 0 | — | — | 100% (9/9), 70–100% | — / — | — | not shown |

## Misses and misleading loads

- **c1-web-02** (web, judge: helpful) I want a simple portfolio site for my photography, with large images and a contact page. Assume the photographs should be the main focus, wi
  loaded: — · offered: — · judge: frontend-design, minimalist-ui, webapp-testing, frontend-ui-engineering
- **c1-web-04** (web, judge: none) Can you rewrite my homepage headline so it sounds less corporate? I want it to feel natural, clear, and approachable while preserving what m
  loaded: content-creation, draft-content · offered: — · judge: —
- **c1-web-07** (web, judge: helpful) I’d like my bakery’s website to show today’s menu, opening hours, and directions without making visitors hunt around. Assume these are the m
  loaded: — · offered: impeccable, design-taste-frontend, core · judge: frontend-ui-engineering, webapp-testing, accessibility-review
- **c1-web-10** (web, judge: helpful) My footer floats halfway up short pages. Fix the page layout so the footer sits at the bottom of the viewport when content is short and foll
  loaded: — · offered: — · judge: webapp-testing, surgical-patch
- **c1-web-14** (web, judge: helpful) Help me write a friendly message for my site’s 404 page. I want visitors to understand that the page could not be found and have a clear way
  loaded: ux-copy, brand-guidelines--getsentry · offered: — · judge: ux-copy · misleading: brand-guidelines--getsentry
- **c1-web-16** (web, judge: helpful) I’d like a browser-based timer that keeps accurate time when I switch tabs and lets me name each session. Assume I mean an elapsed-time stop
  loaded: — · offered: — · judge: frontend-ui-engineering, webapp-testing
- **c1-web-17** (web, judge: helpful) I need to add Spanish to my existing website, including navigation, error messages, and language-specific URLs. Review the current framework
  loaded: — · offered: source-driven-development · judge: frontend-ui-engineering, webapp-testing
- **c1-web-19** (web, judge: helpful) I want a Playwright test covering signup, email verification, and the first successful login using test accounts. Review the existing authen
  loaded: — · offered: webapp-testing · judge: webapp-testing, playwright
- **c1-web-22** (web, judge: helpful) I want customers to upload a CSV in their browser, preview the rows, and correct validation errors before submitting. Review the existing su
  loaded: collect-user-input · offered: frontend-ui-engineering · judge: frontend-ui-engineering, accessibility-review, webapp-testing, api-and-interface-design · misleading: collect-user-input
- **c1-backend-02** (backend, judge: helpful) Help me build an endpoint that accepts a CSV upload, validates each row, and returns errors with row numbers. First check the existing backe
  loaded: — · offered: — · judge: api-and-interface-design, test-driven-development--addyosmani
- **c1-backend-05** (backend, judge: helpful) I’d like a background job that emails customers when their invoices become overdue, without sending duplicate reminders. Check the existing 
  loaded: — · offered: incremental-implementation, investigate-first, supabase-postgres-best-practices · judge: supabase-postgres-best-practices, test-driven-development--addyosmani
- **c1-backend-08** (backend, judge: none) I wanna stop duplicate orders when someone double-clicks checkout. Inspect the checkout flow, order creation, database constraints, and paym
  loaded: implement · offered: test-driven-development--addyosmani, surgical-patch · judge: —
- **c1-backend-09** (backend, judge: none) I need a webhook receiver that verifies Stripe signatures and safely handles repeated events. Check my existing backend framework, persisten
  loaded: security-and-hardening · offered: source-driven-development, test-driven-development--addyosmani · judge: —
- **c1-backend-19** (backend, judge: helpful) Help me write integration tests for an order endpoint that reserves stock, records payment status, and rolls back when inventory is insuffic
  loaded: tdd · offered: testing-strategy · judge: testing-strategy, code-testing-agent
- **c1-integrations-04** (integrations, judge: none) I'm trying to send Shopify orders to our warehouse API, but failed requests keep creating duplicate shipments. Help me fix the retry logic s
  loaded: investigate-first · offered: systematic-debugging, debugging-and-error-recovery, implement, test-driven-development--addyosmani · judge: —
- **c1-integrations-07** (integrations, judge: none) I need to move my Evernote notes into Notion without losing attachments or notebook groupings. Help me plan and carry out a migration that p
  loaded: migration, planning-and-task-breakdown · offered: wizard · judge: —
- **c1-integrations-08** (integrations, judge: helpful) I’ve got two customer spreadsheets, and I need help deciding which columns should match before I combine them. Ask me for the column headers
  loaded: — · offered: explore-data, xlsx · judge: xlsx, explore-data
- **c1-integrations-11** (integrations, judge: none) I wanna dump my saved Pocket links into a CSV. Help me figure out what export or saved-data options I have available, without assuming I can
  loaded: xlsx · offered: — · judge: —
- **c1-integrations-12** (integrations, judge: helpful) I need help designing a nightly sync from PostgreSQL to BigQuery that handles both updated rows and deleted records. I want a design I can i
  loaded: architecture · offered: brainstorming, sql-queries · judge: bigquery-basics, bigquery-optimization
- **c1-documents-03** (documents, judge: essential) Please convert my attached Word document to PDF, preserving its layout and clickable links. Keep the page size, margins, fonts, headings, ta
  loaded: — · offered: pdf--openai, pdf · judge: docx, pdf, pdf--openai
- **c1-documents-04** (documents, judge: helpful) I don't understand this insurance letter. Please explain in plain language what it means, what I need to do, and by when. Start with a short
  loaded: — · offered: — · judge: pdf
- **c1-documents-06** (documents, judge: helpful) I have three versions of a policy document. Please compare all three and list every substantive change with its section number. Establish th
  loaded: — · offered: — · judge: docx, pdf
- **c1-documents-09** (documents, judge: helpful) I need this report shortened to two pages without losing its findings or recommendations. Preserve the meaning, key evidence, important qual
  loaded: — · offered: docx, writing-shape, pdf--openai, scientific-writing · judge: docx, pdf
- **c1-documents-13** (documents, judge: helpful) I want a plain-English summary of this lease, especially the fees, renewal terms, and responsibilities. Use only the lease’s contents and id
  loaded: contract-review · offered: — · judge: pdf, contract-review
- **c1-documents-14** (documents, judge: none) Put my rough instructions into a clear, practical checklist that I can follow from start to finish. Preserve every requirement, warning, dea
  loaded: runbook · offered: planning-and-task-breakdown, process-doc, documentation · judge: —
- **c1-documents-21** (documents, judge: helpful) I want a simple permission slip for my school's museum trip, including emergency contact and parent signature fields. Draft a clear, printab
  loaded: — · offered: — · judge: docx, pdf
- **c1-documents-28** (documents, judge: helpful) I want a glossary of the acronyms in the supplied technical report, based strictly on the report itself. Review the full document, including
  loaded: — · offered: — · judge: pdf, liteparse, pdf--openai
- **c1-business-03** (business, judge: none) I need a one-page business case for hiring a customer success manager at our 30-person software company. Assume the audience is our leadersh
  loaded: org-planning · offered: — · judge: —
- **c1-business-05** (business, judge: none) Help me turn our vague goal of improving customer retention into exactly three measurable quarterly objectives. Start by clarifying our busi
  loaded: define-goal · offered: interview-me · judge: —
- **c1-business-06** (business, judge: helpful) I want to understand who might buy a subscription service that delivers replacement air filters to homeowners. Assume I mean home HVAC filte
  loaded: — · offered: customer-persona, market-research-reports, product-brainstorming, user-research · judge: customer-persona, market-research-reports
- **c1-business-07** (business, judge: none) I've got too many meetings. Help me decide which ones my team can drop while preserving decisions, coordination, and accountability. Start b
  loaded: process-optimization · offered: brainstorming · judge: —
- **c1-business-08** (business, judge: none) I need an agenda for a two-hour strategy workshop with six department heads, ending with agreed priorities and owners. Assume I will facilit
  loaded: notion-meeting-intelligence · offered: — · judge: —
- **c1-business-09** (business, judge: helpful) I sell handmade furniture online. Help me identify customer segments worth considering and ways to test their demand cheaply. Ask for the pr
  loaded: — · offered: interview-me, customer-persona, user-research, idea-refine · judge: customer-persona
- **c1-business-11** (business, judge: none) I'm considering opening a second café. Give me a practical decision checklist covering demand, staffing, cash flow, and operational readines
  loaded: risk-assessment · offered: discernment-nudge · judge: —
- **c1-business-12** (business, judge: none) I need to choose between two suppliers: one is cheaper, while the other delivers faster and has fewer defects. Help me compare their total b
  loaded: vendor-review · offered: — · judge: —
- **c1-business-13** (business, judge: none) I want a simple SWOT analysis for my neighborhood dog-walking business. Organize it into strengths, weaknesses, opportunities, and threats, 
  loaded: competitor-teardown · offered: — · judge: —
- **c1-business-14** (business, judge: none) Help me draft a respectful message explaining why my team is postponing a project. I want to communicate the decision clearly, acknowledge i
  loaded: draft-response · offered: stakeholder-update, internal-comms, discernment-nudge · judge: —
- **c1-business-15** (business, judge: none) I manage twelve people across three time zones. Help me design a weekly operating rhythm that minimizes meetings while keeping work coordina
  loaded: process-optimization · offered: brainstorming · judge: —
- **c1-business-16** (business, judge: none) I want to compare selling directly to consumers with selling through retailers for my new skincare brand. Help me decide which channel to pr
  loaded: consciousness-council · offered: idea-refine · judge: — · misleading: consciousness-council
- **c1-business-17** (business, judge: none) My cofounder and I disagree about expanding internationally. Help me structure a discussion that ends with a clear decision while preserving
  loaded: consciousness-council · offered: notion-meeting-intelligence, idea-refine · judge: —
- **c1-business-18** (business, judge: none) I need a launch plan for a bookkeeping service aimed at independent tradespeople, with milestones for the first ninety days. My goal is to v
  loaded: planning-and-task-breakdown · offered: discernment-nudge, compliance-check · judge: —
- **c1-business-20** (business, judge: none) I want to identify the biggest assumptions in my business plan before I spend money building the product. Help me separate evidence from bel
  loaded: idea-refine · offered: doubt-driven-development, product-brainstorming, risk-assessment, grill-me · judge: —
- **c1-business-22** (business, judge: none) I run an agency with uneven workloads. Help me decide when to hire employees versus use freelancers, balancing cost, delivery quality, flexi
  loaded: org-planning · offered: capacity-plan · judge: —
- **c1-business-23** (business, judge: none) I need exactly five customer interview questions to learn why small retailers abandon inventory software. Assume I’m interviewing owners or 
  loaded: user-research · offered: — · judge: —
- **c1-business-25** (business, judge: none) I want to assess whether my company should centralize purchasing or let each branch choose its own vendors. Help me compare those options an
  loaded: consciousness-council · offered: risk-assessment, idea-refine · judge: —
- **c1-business-26** (business, judge: none) My sales and support teams keep blaming each other for churn. Help me define shared responsibilities and a practical escalation process that
  loaded: process-doc · offered: — · judge: —
- **c1-data-01** (data, judge: helpful) I need my contact list deduplicated by email, keeping the most recently updated entry for each address. Assume email matching ignores surrou
  loaded: — · offered: — · judge: xlsx
- **c1-data-05** (data, judge: none) I want a quick summary of these survey responses, including common themes and a few representative quotes. Base the summary only on the supp
  loaded: research-synthesis, synthesize-research · offered: — · judge: —
- **c1-data-07** (data, judge: helpful) My expense categories are a mess. I want you to suggest a consistent grouping and flag transactions you can't confidently classify. Review t
  loaded: — · offered: — · judge: xlsx
- **c1-data-11** (data, judge: none) I’d like a concise executive summary of the supplied quarterly performance table, centered on the three most important findings. Use only th
  loaded: metrics-review · offered: performance-report, analyze, variance-analysis · judge: —
- **c1-data-17** (data, judge: none) I need my JSON records converted to CSV, with nested address fields flattened into clearly named columns such as address_street, address_cit
  loaded: xlsx · offered: polars · judge: —
- **c1-data-16** (data, judge: none) I’m tracking support tickets and want the median resolution time by priority, with an explanation of how unresolved tickets affect interpret
  loaded: analyze · offered: exploratory-data-analysis, report-builder · judge: —
- **c1-ml-05** (ml, judge: none) I'm predicting house prices and want to understand when I should use linear regression versus a random forest. Explain the trade-offs in ter
  loaded: scikit-learn · offered: — · judge: —
- **c1-ml-06** (ml, judge: helpful) My validation score seems suspiciously good. Review my preprocessing pipeline for data leakage and determine whether the score reflects perf
  loaded: — · offered: analyze-project, exploratory-data-analysis, investigate-first · judge: scikit-learn
- **c1-ml-08** (ml, judge: helpful) I've got unlabeled support tickets. Help me group them into useful topics and judge whether the clusters make sense.

Assume my goal is to i
  loaded: — · offered: synthesize-research, research-synthesis, bigquery-ai-ml · judge: scikit-learn, umap-learn, train-sentence-transformers
- **c1-ml-09** (ml, judge: helpful) I want to forecast weekly sales across 40 stores. Design a validation strategy that respects time order and handles stores with little histo
  loaded: — · offered: aeon · judge: statsmodels, aeon
- **c1-ml-12** (ml, judge: helpful) I'm fine-tuning a text classifier on uneven class sizes. Help me compare weighted loss, oversampling, and collecting more examples, and deci
  loaded: scikit-learn · offered: scientific-brainstorming, scientific-critical-thinking · judge: experimental-design, statistical-analysis, transformers
- **c1-ml-14** (ml, judge: none) I’m building recommendations from purchase history. Propose a simple baseline and an evaluation plan that avoids using future purchases. Ass
  loaded: scikit-learn · offered: brainstorming, planning-and-task-breakdown · judge: —
- **c1-science-03** (science, judge: none) I want to understand what a small p-value tells me and why it doesn’t prove a scientific hypothesis. Explain this in plain English, assuming
  loaded: scientific-critical-thinking · offered: statistical-analysis--anthropics, statistical-analysis · judge: —
- **c1-devops-02** (devops, judge: helpful) My deploy broke; help me roll back safely and restore service. First establish the deployment platform, affected environment, symptoms, curr
  loaded: — · offered: shipping-and-launch, debugging-and-error-recovery, migration, runbook · judge: incident-response, debugging-and-error-recovery, deploy-checklist
- **c1-devops-04** (devops, judge: helpful) I want my GitHub Actions workflow to test pull requests and deploy to staging only after merges. Check the existing workflow, test commands,
  loaded: — · offered: — · judge: ci-cd-and-automation, gha-security-review, gh-cli
- **c1-devops-07** (devops, judge: none) I keep running out of disk space on my Ubuntu server. Help me find what's growing and understand why before suggesting cleanup. Start with a
  loaded: investigate-first · offered: runbook, debugging-and-error-recovery · judge: —
- **c1-devops-10** (devops, judge: helpful) I'm new to on-call work. Give me a beginner-friendly checklist for what to check first when an uptime alert fires. Organize it in the order 
  loaded: — · offered: runbook, incident-response, documentation · judge: incident-response, runbook
- **c1-devops-11** (devops, judge: helpful) Help me stop secrets from appearing in my CI logs. Ask which CI platform I use and review relevant pipeline configuration and redacted log e
  loaded: — · offered: ci-cd-and-automation · judge: ci-cd-and-automation, security-and-hardening, gha-security-review
- **c1-devops-14** (devops, judge: none) I'd like to schedule nightly PostgreSQL backups and verify that I can restore them. Help me turn this into a reliable, repeatable process fo
  loaded: runbook · offered: writing-plans · judge: —
- **c1-devops-15** (devops, judge: none) I need a short maintenance notice for a planned thirty-minute outage. Write a concise, customer-facing message that states when maintenance 
  loaded: draft-response · offered: ux-copy, brand-guidelines--getsentry, stakeholder-update · judge: —
- **c1-security-05** (security, judge: none) I need a practical security checklist before I launch a small online store that accepts payments through Stripe. Assume I have a small team 
  loaded: security-and-hardening · offered: shipping-and-launch · judge: —
- **c1-security-06** (security, judge: none) Help me configure SSH on my Ubuntu server so only key-based logins are allowed. First check my Ubuntu and OpenSSH versions, effective SSH co
  loaded: runbook · offered: verification-before-completion, migration, doubt-driven-development · judge: —
- **c1-security-12** (security, judge: none) Help me write a policy for securely disposing of old laptops and backup drives. Assume this is for a small organization unless I provide dif
  loaded: process-doc · offered: documentation · judge: —
- **c1-security-14** (security, judge: helpful) Draft a tabletop exercise for my team involving ransomware, unavailable backups, and a suspected customer data leak. Assume a 90-minute, dis
  loaded: — · offered: discernment-nudge · judge: incident-response
- **c1-debug-01** (debug, judge: helpful) My Python script hangs after printing 'connected.' Help me figure out exactly where it's getting stuck. Start by asking for the smallest use
  loaded: — · offered: — · judge: systematic-debugging, investigate-first, diagnosing-bugs
- **c1-debug-06** (debug, judge: none) I changed my Excel formula, and now every total is zero. Help me identify the likely mistake without overwriting my original data. Ask me fo
  loaded: xlsx · offered: debugging-and-error-recovery · judge: —
- **c1-debug-08** (debug, judge: none) My Docker container exits immediately, but the same app runs locally. Help me find the difference causing it to stop. Ask for the Dockerfile
  loaded: debugging-and-error-recovery, debug · offered: — · judge: —
- **c1-everyday-10** (everyday, judge: none) Help me write a return request for shoes that arrived in the wrong size. I want a short, polite but firm message I can send to the seller. E
  loaded: draft-response · offered: — · judge: —
- **c1-media-08** (media, judge: essential) I want a mellow instrumental loop for my cooking videos, featuring acoustic guitar and no vocals. Assume a 20–30-second loop unless I specif
  loaded: — · offered: elevenlabs-music, ai-music, ace-step, ai-music-generation · judge: ai-music, elevenlabs-music-generation, ai-music-generation, elevenlabs-music, ace-step
- **c1-media-09** (media, judge: none) Give me exactly three funny captions for my photo of a cat sitting inside a mixing bowl. Keep each caption short, punchy, and ready to post.
  loaded: ai-social-media-content · offered: draft-content · judge: —
- **c1-writing-04** (writing, judge: none) I’m announcing that my bakery will close on Mondays starting next month. Draft a friendly Instagram caption that clearly explains the change
  loaded: draft-content · offered: ai-social-media-content, social-content-engine, canva-creator · judge: —
- **c1-writing-07** (writing, judge: none) I need a subject line for an overdue invoice reminder. Assume this is a professional reminder to a customer, and keep the tone polite, clear
  loaded: draft-content · offered: invoice-chase, draft-response, email-design · judge: —
- **c1-apps-01** (apps, judge: helpful) I want a simple app for tracking books I’ve read. Help me turn that into a small, usable first version. Assume it’s for personal use, with b
  loaded: — · offered: — · judge: lean-build, webapp-testing, frontend-ui-engineering
- **c1-apps-02** (apps, judge: helpful) Help me build a shared grocery list where my housemates can add items, mark them bought, and see who changed what. Assume we need one househ
  loaded: — · offered: — · judge: lean-build, supabase, webapp-testing, frontend-ui-engineering
- **c1-apps-04** (apps, judge: helpful) I need a small web app for splitting trip expenses among friends, including costs shared by only some people. Assume one currency per trip a
  loaded: — · offered: — · judge: lean-build, webapp-testing, property-based-testing
- **c1-apps-06** (apps, judge: helpful) I wanna track my plants and watering dates. Help me make a simple app where I can add a plant, record when I water it, and see its latest wa
  loaded: — · offered: — · judge: lean-build, frontend-ui-engineering, webapp-testing
- **c1-apps-09** (apps, judge: helpful) Help me create an offline notes app that saves locally and lets me export everything as Markdown. My goal is a simple, dependable app for wr
  loaded: — · offered: — · judge: webapp-testing, frontend-ui-engineering, verification-before-completion
