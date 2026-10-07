# Sweep: 2026-10-06T02-08-14-sweep

315 requests, 1262 skills in the library, judge opus.
Routing cost $0.3352; mean 0.89 s per decision.
Coverage: every request judged blind; every disputed row adjudicated.

| | All |
|---|---:|
| n | 315 |
| needed | 189 |
| usefulLoaded | 65% (123/189) |
| usefulAvailable | 82% (155/189) |
| helpfulLoadedOnEssential | 82% (23/28) |
| missedBetter | 11% (34/315) |
| quietWhenNone | 82% (103/126) |
| loadPrecision | 78% (180/231) |
| misleadingLoads | 2% (5/231) |
| injectPrecision | 84% (53/63) |
| avgLoaded | 0.73 |

| Category | n | needs a skill | useful loaded | useful available | quiet when none | load precision | misleading loads | missed better |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| web | 25 | 21 | 67% (14/21) | 71% (15/21) | 50% (2/4) | 89% (25/28) | 0% (0/28) | 8% (2/25) |
| backend | 20 | 7 | 43% (3/7) | 57% (4/7) | 62% (8/13) | 27% (4/15) | 0% (0/15) | 20% (4/20) |
| integrations | 20 | 7 | 29% (2/7) | 43% (3/7) | 85% (11/13) | 50% (2/4) | 25% (1/4) | 10% (2/20) |
| documents | 30 | 30 | 77% (23/30) | 100% (30/30) | — | 93% (28/30) | 0% (0/30) | 23% (7/30) |
| business | 30 | 25 | 76% (19/25) | 92% (23/25) | 80% (4/5) | 78% (29/37) | 3% (1/37) | 7% (2/30) |
| data | 20 | 18 | 67% (12/18) | 78% (14/18) | 100% (2/2) | 79% (15/19) | 0% (0/19) | 15% (3/20) |
| ml | 15 | 9 | 0% (0/9) | 44% (4/9) | 83% (5/6) | 0% (0/1) | 0% (0/1) | 13% (2/15) |
| science | 10 | 9 | 44% (4/9) | 89% (8/9) | 100% (1/1) | 75% (6/8) | 25% (2/8) | 10% (1/10) |
| devops | 20 | 9 | 67% (6/9) | 78% (7/9) | 73% (8/11) | 64% (7/11) | 0% (0/11) | 10% (2/20) |
| security | 15 | 15 | 80% (12/15) | 87% (13/15) | — | 93% (13/14) | 0% (0/14) | 20% (3/15) |
| debug | 15 | 15 | 100% (15/15) | 100% (15/15) | — | 91% (32/35) | 0% (0/35) | 7% (1/15) |
| everyday | 35 | 0 | — | — | 91% (32/35) | 0% (0/3) | 0% (0/3) | 0% (0/35) |
| media | 15 | 9 | 67% (6/9) | 89% (8/9) | 83% (5/6) | 85% (11/13) | 8% (1/13) | 13% (2/15) |
| writing | 15 | 5 | 100% (5/5) | 100% (5/5) | 70% (7/10) | 67% (6/9) | 0% (0/9) | 0% (0/15) |
| productivity | 10 | 7 | 29% (2/7) | 71% (5/7) | 33% (1/3) | 50% (2/4) | 0% (0/4) | 10% (1/10) |
| apps | 10 | 3 | 0% (0/3) | 33% (1/3) | 100% (7/7) | — | — | 20% (2/10) |
| questions | 10 | 0 | — | — | 100% (10/10) | — | — | 0% (0/10) |

## Misses and misleading loads

- **web-18** (web, judge: helpful) Can you make the error messages on our contact form readable by screen readers? Find the contact form and its validation code, and check how
  loaded: — · offered: accessibility-review, browser-testing-with-devtools, impeccable, web-design-guidelines · judge: accessibility-review, frontend-ui-engineering, webapp-testing, browser-testing-with-devtools · missed: accessibility-review
  Nothing loaded; an a11y audit skill would help with WCAG error-handling checks and verification.
- **web-20** (web, judge: helpful) Our settings page is one very long scrolling page. I'd like to turn it into tabs, one per section, while keeping direct links to each sectio
  loaded: — · offered: plan-ui-change, core · judge: frontend-ui-engineering, webapp-testing, accessibility-review
  Strong engineer handles accessible tabs; optional skills marginal. Nothing loaded is acceptable.
- **web-17** (web, judge: none) I'd like to add breadcrumbs to our documentation site. First look at how the site is built (static site generator or framework, how pages an
  loaded: frontend-ui-engineering · offered: — · judge: —
  Accessible breadcrumbs are standard work. The generic UI skill does no harm but adds little.
- **web-01** (web, judge: helpful) I want a simple website for my dog grooming business. The two main things visitors need to do are see my prices and request an appointment.

  loaded: — · offered: — · judge: frontend-design, netlify-deploy, deploy-to-vercel
  Simple site; design/deploy skills would be minor improvements only.
- **web-04** (web, judge: helpful) I'd like keyboard navigation added to this dropdown, and I want Escape to close it. Please find the dropdown component in the codebase and c
  loaded: — · offered: test-driven-development--addyosmani, investigate-first · judge: frontend-ui-engineering, accessibility-review, webapp-testing
  Keyboard menu pattern is well-known; skills optional.
- **web-09** (web, judge: helpful) I have a data table in this project that is hard to use on mobile screens. Please make it usable on small viewports without hiding any of it
  loaded: — · offered: — · judge: frontend-ui-engineering
  Nothing loaded. frontend-ui-engineering could help a little with responsive, accessible tables, but it isn't clearly required.
- **web-10** (web, judge: none) Please add a dark mode toggle to my site and make it remember the visitor's choice on their next visit.

Requirements:
- Add an accessible t
  loaded: frontend-ui-engineering · offered: — · judge: —
  A dark mode toggle with no flash is a well-known pattern. The skill does no harm but adds little.
- **web-14** (web, judge: helpful) The navbar jumps when I open the menu. Please find the cause and fix it so opening and closing is smooth.

What I need:
1. Find the navbar a
  loaded: — · offered: — · judge: investigate-first, frontend-ui-engineering, systematic-debugging, webapp-testing
  Debugging layout shift is standard; skills marginal.
- **web-15** (web, judge: helpful) Create a landing page for our online ceramics class using the photos in public/images.

Start by looking at public/images. List the photos y
  loaded: — · offered: — · judge: landing-page-design, frontend-design, design-taste-frontend, frontend-ui-engineering, web-perf · missed: frontend-design
  A design-direction skill would materially improve landing page quality.
- **backend-01** (backend, judge: none) Add cursor-based pagination to the orders endpoint.

First look at the existing orders endpoint, its framework, data layer, and any current 
  loaded: api-and-interface-design, implement · offered: incremental-implementation, sql-queries · judge: —
  The spec is already detailed. Generic API and implementation guidance adds little to keyset pagination.
- **backend-02** (backend, judge: helpful) We need a password reset feature in our FastAPI app. Reset links must expire and must only work once.

First inspect the existing app: user 
  loaded: — · offered: — · judge: security-and-hardening, security-best-practices · missed: security-and-hardening
  Nothing loaded. A security hardening skill would help with the token, enumeration and rate-limit details.
- **backend-03** (backend, judge: helpful) Stripe sometimes sends the same webhook twice, and we're creating duplicate subscriptions. Please make webhook processing idempotent.

First
  loaded: — · offered: test-driven-development--addyosmani, supabase-postgres-best-practices, surgical-patch, debugging-and-error-recovery · judge: investigate-first, systematic-debugging, supabase-postgres-best-practices
  Nothing loaded. A strong engineer can handle idempotent webhooks. The optional skills are fine but not clearly needed.
- **backend-05** (backend, judge: none) Move PDF generation out of the request handler and into a background queue.

First find the handler that generates PDFs, what library it use
  loaded: implement, planning-and-task-breakdown · offered: — · judge: —
  Generic process skills. They do no harm but don't help much with this background-queue refactor.
- **backend-07** (backend, judge: helpful) Can you implement refresh token rotation in our Express auth service?

First read the existing auth code: how access and refresh tokens are 
  loaded: implement, doubt-driven-development · offered: test-driven-development--addyosmani · judge: security-and-hardening · missed: security-and-hardening
  Adversarial review suits security-sensitive auth. A dedicated security skill would add more.
- **backend-08** (backend, judge: none) I need a backend endpoint that accepts CSV file uploads and immediately returns a job ID, so clients can later check the progress of their i
  loaded: api-and-interface-design · offered: dotnet-webapi, planning-and-task-breakdown · judge: —
  A general API design skill adds little here. It doesn't hurt.
- **backend-10** (backend, judge: none) I want to add soft delete for customers in our backend. Deleting a customer should mark them as deleted, for example with a deleted_at times
  loaded: planning-and-task-breakdown, incremental-implementation · offered: test-driven-development--addyosmani · judge: —
  Generic process skills. Soft delete is ordinary work.
- **backend-11** (backend, judge: helpful) I need a Django API for recording maintenance tickets and assigning them to technicians. Please build it, using Django REST Framework unless
  loaded: api-and-interface-design, incremental-implementation · offered: — · judge: django-access-review · missed: django-access-review
  The generic skills add little. A Django access-control review would help with the permission requirements.
- **backend-19** (backend, judge: none) Please implement retry handling for our failed delivery jobs, with a retry limit and a place where I can inspect jobs that never succeed.

F
  loaded: implement · offered: incremental-implementation, test-driven-development--addyosmani · judge: —
  Generic. The task is standard retry and dead-letter work.
- **backend-20** (backend, judge: helpful) We need tenant isolation in this Rails app. Please review the query paths and make sure one company can't read another company's records.

C
  loaded: — · offered: find-bugs, codeql · judge: security-review, variant-analysis · missed: security-review
  A cross-tenant data-access audit would benefit from a structured security review skill.
- **integrations-04** (integrations, judge: none) I want a command-line tool that lists my open Linear issues and lets me change their status. Please build it in the current working director
  loaded: cli-creator · offered: source-driven-development · judge: —
  Aimed at Codex-oriented CLIs with JSON output and a companion skill. Only partly fits a user-facing Linear CLI.
- **integrations-07** (integrations, judge: helpful) Can you build an MCP server around our read-only inventory API? Please create it in the current working directory.

I haven't given you the 
  loaded: — · offered: claude-api, source-driven-development, planning-and-task-breakdown · judge: mcp-builder · missed: mcp-builder
  The MCP server-building guide fits this exactly and should have been loaded.
- **integrations-08** (integrations, judge: none) I want a Telegram bot for logging expenses. If I send a message like `12.50 lunch`, it should save the expense and reply with a confirmation
  loaded: start · offered: — · judge: — · misleading: start
  A bio-research setup skill, irrelevant to a Telegram bot.
- **integrations-09** (integrations, judge: helpful) I need a GitHub Action that posts a short release summary to our team's Slack channel whenever we publish a release. Please add it to this r
  loaded: — · offered: — · judge: gha-security-review, ci-cd-and-automation · missed: gha-security-review
  The injection-safe workflow requirement would benefit from GitHub Actions security guidance.
- **integrations-10** (integrations, judge: helpful) I want a support chatbot for our website that answers questions using our help center articles, and hands off to a human when it can't answe
  loaded: — · offered: ai-rag-pipeline · judge: claude-api, ai-rag-pipeline
  A strong engineer can build this RAG bot. The optional ai-rag-pipeline is only marginal.
- **integrations-14** (integrations, judge: helpful) I want to build an agent that checks incoming purchase orders against our catalog and drafts a reply for human review.

Flow:
1. Take an inc
  loaded: — · offered: — · judge: pdf, claude-api
  A PDF skill would help a little with extraction, but it is not clearly essential.
- **integrations-18** (integrations, judge: helpful) I want a Microsoft Teams bot that answers office location and Wi-Fi questions from a maintained FAQ.

Requirements:
- Users ask in personal 
  loaded: — · offered: spec-driven-development · judge: microsoft-foundry
  No catalog skill clearly covers Teams bots.
- **documents-08** (documents, judge: essential) I have a scanned copy of a lease that I need converted into editable text. Please find the scan in my working directory (if there are severa
  loaded: — · offered: liteparse, pdf, azure-ai · judge: docx, pdf, liteparse, pdf--openai · missed: docx
  OCR to .docx needs the docx skill, plus pdf or liteparse for OCR.
- **documents-17** (documents, judge: helpful) I need a rent receipt for September, using the payment details I'm providing with this request.

Please include:
- The receipt title, the da
  loaded: — · offered: pdf, docx, pdf--openai · judge: pdf, docx · missed: pdf
  A PDF plus DOCX deliverable benefits from the pdf and docx skills.
- **documents-19** (documents, judge: essential) I want to share the attached PDF publicly, but first I need my phone number and home address permanently removed from it.

Please:
- Find ev
  loaded: — · offered: pdf, pdf--openai · judge: pdf, pdf--openai · missed: pdf
  Nothing loaded; true PDF redaction, plus checking metadata and annotations, needs the pdf skill.
- **documents-21** (documents, judge: helpful) Create a printable checklist for opening and closing our bakery. Staff will use it every day.

Structure:
- Two sections, "Opening" and "Clo
  loaded: — · offered: docx, pdf--openai, pdf · judge: docx, pdf · missed: docx
  The editable Word plus PDF deliverables benefit from the docx skill, and pdf would help as well.
- **documents-25** (documents, judge: essential) I'd like you to create a two-page product brochure using the copy I've provided and the attached photos.

Goals and constraints:
- Exactly t
  loaded: — · offered: pdf--openai · judge: pdf, canvas-design, pdf--openai · missed: pdf--openai
  A print-ready PDF brochure with visual checks needs a PDF creation and rendering skill.
- **documents-24** (documents, judge: essential) I need you to extract the line items from the supplier invoices I've attached and combine them into a single CSV file.

For each line item, 
  loaded: — · offered: invoice-organizer, pdf, ap-processor, xlsx · judge: pdf, pdf--openai, liteparse · missed: pdf
  Extracting invoice data from PDFs, including scans, needs the pdf skill.
- **documents-29** (documents, judge: essential) Please convert the PowerPoint I've attached to a PDF and check carefully that none of the charts or labels are cut off.

What I need:
- Expo
  loaded: — · offered: pptx, pdf--openai · judge: pptx, pdf--openai, pdf · missed: pptx
  Converting PPTX to PDF and fixing the copy needs the pptx skill, with PDF rendering checks.
- **business-02** (business, judge: helpful) Help me calculate payroll for my hourly employees for the current pay period, including overtime, using the wage and hour rules for our stat
  loaded: — · offered: payroll-prep, discernment-nudge · judge: xlsx, payroll-prep
  A strong assistant can do the calculation directly. payroll-prep is optional and connector-oriented.
- **business-03** (business, judge: helpful) I'm a sole trader in the UK and I'm about to start my Self Assessment tax return. Give me a practical checklist of the records and documents
  loaded: — · offered: discernment-nudge · judge: tax-season-organizer
  A UK checklist is general knowledge. tax-season-organizer is US-focused.
- **business-04** (business, judge: none) Draft a short outreach email to independent bookstores asking them to stock our greeting cards. Keep it under 150 words, warm and profession
  loaded: draft-outreach, outreach-composer, draft-content · offered: brand-voice-enforcement · judge: —
  A simple email draft needs no skill. The CRM and sequence features in these skills are irrelevant here.
- **business-05** (business, judge: helpful) Help me clean up duplicate contacts in our CRM. I'll share an export of the records (CSV or pasted rows). Find the duplicate pairs and, for 
  loaded: crm-autopilot · offered: explore-data, xlsx · judge: crm-hygiene-check, xlsx · missed: crm-hygiene-check · misleading: crm-autopilot
  crm-autopilot creates and updates records, but the user wants recommendations only. The read-only hygiene audit fits better.
- **business-12** (business, judge: helpful) I need help categorizing a batch of business expenses for bookkeeping. I'll paste or attach the expense list (date, vendor, amount, and any 
  loaded: — · offered: xlsx, ap-processor · judge: xlsx, ap-processor
  Categorizing into a CSV is straightforward. xlsx is optional.
- **business-18** (business, judge: helpful) I need a polite but firm payment reminder I can send to clients whose invoices are more than 30 days overdue. Please draft it as an email wi
  loaded: draft-response · offered: invoice-chase, outreach-composer, brand-voice-enforcement, lark-mail · judge: invoice-chase
  A simple reminder template. draft-response fits loosely. invoice-chase targets the ledger workflow, so it isn't clearly better.
- **business-23** (business, judge: helpful) We need a customer support escalation policy covering three situations: billing problems, outages, and angry customers. Please draft it as a
  loaded: process-doc · offered: — · judge: customer-escalation, runbook, incident-response · missed: customer-escalation
  process-doc helps with the SOP format. customer-escalation is directly about escalations, though it's per-case packaging.
- **business-24** (business, judge: helpful) Help me estimate the true, fully loaded annual cost of hiring my first employee in California. I want a realistic number rather than just th
  loaded: discernment-nudge · offered: — · judge: xlsx, comp-analysis
  This is a knowledge-based estimate. The nudge adds only follow-up questions.
- **data-01** (data, judge: helpful) Write a SQL query that finds customers who placed an order last quarter but haven't placed any order this quarter.

Assumptions to state, an
  loaded: — · offered: — · judge: write-query, sql-queries
  A strong programmer writes this query easily. write-query would be a minor help.
- **data-02** (data, judge: helpful) I need you to clean a CSV file. The dates are in three different formats, and some of the amount values have currency symbols. Look for the 
  loaded: — · offered: — · judge: xlsx, explore-data
  Ordinary pandas cleaning; a strong agent manages without skills. xlsx would be marginal for CSV.
- **data-05** (data, judge: helpful) Please create a Jupyter notebook that explores the bike share dataset in my working directory and saves the charts it produces. Start by loc
  loaded: — · offered: — · judge: jupyter-notebook, exploratory-data-analysis, create-viz, seaborn · missed: jupyter-notebook
  A notebook deliverable; the jupyter-notebook scaffolding would help. EDA and viz skills would be optional.
- **data-12** (data, judge: helpful) I need a dbt model that gives me daily recurring revenue (MRR/ARR-style, expressed per day) from our subscription data, including cancellati
  loaded: — · offered: incremental-implementation · judge: sql-queries, write-query
  dbt SQL modeling; sql-queries could help slightly, but a strong agent handles this.
- **data-13** (data, judge: helpful) Our Looker dashboard and our finance spreadsheet show different totals for March revenue, and I need to find out why. Please investigate and
  loaded: investigate-first · offered: reconciliation, explore-data, debugging-and-error-recovery · judge: reconciliation, validate-data, xlsx, analyze · missed: reconciliation
  investigate-first fits the evidence-ranked diagnosis. reconciliation directly matches building a reconciliation table that sums to the gap.
- **data-14** (data, judge: helpful) I want to normalize the country names in this dataset and keep a complete record of every change made.

Find the country column (ask me if i
  loaded: — · offered: xlsx · judge: xlsx
  Country normalization is a plain scripting task, so no skill is needed.
- **data-16** (data, judge: helpful) Using the customer export I'm providing, make a map of sales by postcode.

Inspect the file first to find the postcode, country, and sales o
  loaded: create-viz · offered: — · judge: geopandas, data-visualization--anthropics, create-viz · missed: geopandas
  create-viz helps with the charts. A choropleth needs geospatial joins, so geopandas would materially help.
- **data-19** (data, judge: helpful) I need a weekly operations report built from these shipment logs, covering late deliveries and their most common causes.

First inspect the 
  loaded: report-builder · offered: explore-data, build-agent, analyze, xlsx · judge: build-dashboard, create-viz, xlsx, data-visualization--anthropics
  report-builder relies on connected sources; here it's a local log script. Marginal, not harmful.
- **ml-01** (ml, judge: helpful) I want to fine-tune a small text classifier on a set of labeled support tickets and compare it against a simple baseline. I'll point you to 
  loaded: — · offered: transformers, explore-data, python-executor · judge: transformers, scikit-learn, huggingface-llm-trainer · missed: transformers
  Fine-tuning with HF Trainer; the transformers skill would materially help and was offered.
- **ml-02** (ml, judge: helpful) I want to build an embedding search index over our product descriptions and evaluate how well it works using example queries that I'll provi
  loaded: — · offered: — · judge: train-sentence-transformers, transformers
  A simple embedding search a strong agent can build. train-sentence-transformers is marginal since no training is needed.
- **ml-03** (ml, judge: helpful) My model scores very well on validation but performs badly in production, and I suspect the train/validation split has data leakage. Please 
  loaded: — · offered: exploratory-data-analysis, analyze-project, scikit-learn · judge: scikit-learn, analyze-project
  Leakage audit is general ML expertise; scikit-learn would be optional.
- **ml-06** (ml, judge: helpful) I want an evaluation set for our document Q&A system. It should include questions the documents can't answer, so I can check that the system
  loaded: — · offered: — · judge: markitdown, liteparse, pdf
  Writing an eval set needs judgment more than tools. Document parsing skills are optional.
- **ml-07** (ml, judge: helpful) I need help balancing a dataset without letting copies of the same sample end up in both train and test. I'll point you to the data in the w
  loaded: — · offered: explore-data · judge: scikit-learn
  Group-aware split plus balancing is standard sklearn work. No skill clearly needed.
- **ml-09** (ml, judge: helpful) I have a local language model and I want to quantize it, then measure how much answer quality changes.

First, inspect the working directory
  loaded: — · offered: get-available-resources, explore-run · judge: huggingface-local-models, transformers, hf-mem · missed: huggingface-local-models
  GGUF/llama.cpp quantization guidance would materially help choose quants and tooling.
- **ml-10** (ml, judge: helpful) We need to detect damaged packaging from photos. I want a baseline classifier and an analysis of where it fails.

First, look in the working
  loaded: — · offered: huggingface-vision-trainer, python-executor, exploratory-data-analysis · judge: huggingface-vision-trainer, scikit-learn, matplotlib
  Baseline PyTorch classifier is standard. huggingface-vision-trainer is optional.
- **ml-13** (ml, judge: helpful) I want to measure precision and recall separately for each language in our moderation dataset.

First, look in the working directory for the
  loaded: — · offered: jupyter-notebook, analyze · judge: scikit-learn, statistical-analysis, data-visualization--anthropics
  Per-language metrics with bootstrap is routine. No skill needed.
- **ml-14** (ml, judge: helpful) I want to build a reranking experiment for our search results, using the relevance judgments in the file I've provided.

First, find the jud
  loaded: — · offered: python-executor, train-sentence-transformers · judge: train-sentence-transformers, statistical-analysis, scikit-learn
  Reranking eval is doable without skills. train-sentence-transformers would be optional for the cross-encoder.
- **ml-15** (ml, judge: none) My GPU runs out of memory partway through training. I want you to profile memory usage and suggest a change that keeps the effective batch s
  loaded: investigate-first · offered: optimize-for-gpu, safe-debug, debug · judge: —
  Generic diagnosis discipline; the user already gave a detailed procedure. Doesn't hurt.
- **science-01** (science, judge: helpful) I need you to analyze my qPCR results using the controls described in my experiment notes. Start by finding the qPCR data files and the expe
  loaded: python-executor · offered: statistical-analysis, statistical-analysis--anthropics · judge: statistical-analysis, scientific-visualization, matplotlib · missed: statistical-analysis · misleading: python-executor
  A remote inference.sh sandbox is the wrong fit for local files. Statistical test selection guidance would help more.
- **science-02** (science, judge: helpful) I want to reproduce the main figure (the primary results figure, likely Figure 1 or 2; confirm which one you're targeting) from a paper usin
  loaded: — · offered: scientific-visualization, python-executor, data-visualization--anthropics · judge: pdf, scientific-visualization, matplotlib
  Nothing loaded. Visualization or PDF skills would be mildly useful, but none is clearly essential.
- **science-05** (science, judge: helpful) Compare the protein sequences I've provided and mark the conserved regions. Look in the working directory for the sequence files (FASTA or s
  loaded: — · offered: biopython, scikit-bio · judge: phylogenetics, biopython
  Biopython or phylogenetics (MAFFT) skills would help a little; a strong agent can do this without them.
- **science-06** (science, judge: helpful) Fit a dose-response curve to our assay data and report the IC50 with uncertainty. First find the data file(s) in the working directory and s
  loaded: — · offered: statistical-analysis, python-executor, uncertainty-and-units · judge: statistical-analysis, scientific-visualization, matplotlib
  A standard 4PL fit with scipy; skills add only modest value.
- **science-07** (science, judge: helpful) Summarize the evidence in these papers for and against the proposed mechanism. Look in the working directory for the papers (PDFs or text), 
  loaded: scientific-critical-thinking, paperclip · offered: literature-review, scientific-writing, peer-review · judge: scientific-critical-thinking, pdf, literature-review · misleading: paperclip
  Critical thinking fits evidence appraisal. Paperclip is an external search CLI; the papers are local and outside literature is discouraged.
- **science-10** (science, judge: helpful) Please help me balance the chemical equations and verify the molar quantities in my reaction worksheet.

First, locate and read the workshee
  loaded: — · offered: — · judge: xlsx, sympy, docx
  The worksheet format is unknown and the chemistry is straightforward. No skill is clearly needed.
- **devops-01** (devops, judge: helpful) Please add a GitHub Actions workflow to this repository that runs our tests on every pull request.

First inspect the repo to identify the l
  loaded: — · offered: — · judge: ci-cd-and-automation
  ci-cd-and-automation would help a bit, but a GitHub Actions test workflow is routine.
- **devops-12** (devops, judge: helpful) I want structured logging and request IDs across both our API and our background worker, so I can trace a request from the API through to an
  loaded: — · offered: test-driven-development--addyosmani · judge: observability-and-instrumentation · missed: observability-and-instrumentation
  Structured logging and request-ID propagation match the observability skill directly.
- **devops-13** (devops, judge: none) Our disk filled up overnight and I need to understand why. Please investigate what's growing and propose a retention policy. Do not delete, 
  loaded: investigate-first · offered: discernment-nudge, debugging-and-error-recovery · judge: —
  A read-only disk investigation is well specified already. The generic skill adds little.
- **devops-15** (devops, judge: none) I need to find out why the certificate on our staging environment isn't renewing automatically. Please investigate and tell me the root caus
  loaded: investigate-first · offered: debugging-and-error-recovery, debug · judge: —
  Certificate renewal debugging is well specified. The generic investigation skill adds little.
- **devops-16** (devops, judge: none) I want to add a manual deployment approval step before the production job in our GitLab CI pipeline. Please update the `.gitlab-ci.yml` (and
  loaded: ci-cd-and-automation · offered: — · judge: —
  Relevant to pipeline modification and deployment gates.
- **devops-20** (devops, judge: helpful) Please review our cloud bill and find idle resources and obvious configuration waste that we could cut.

Use the billing exports, cost repor
  loaded: — · offered: cost-optimization, google-cloud-waf-cost-optimization · judge: cost-optimization, google-cloud-waf-cost-optimization, gke-cost-analysis · missed: cost-optimization
  If the cloud turns out to be Azure, cost-optimization fits idle-resource hunting. The provider is unknown, so this is moderate.
- **security-03** (security, judge: helpful) I want you to review our dependency audit results and prioritize the findings that are actually reachable in this app, rather than just rank
  loaded: trailmark · offered: supply-chain-risk-auditor, vulnerability-triage-brocards, trailmark-finding-triage · judge: supply-chain-risk-auditor, trailmark-finding-triage, fp-check · missed: supply-chain-risk-auditor
  Trailmark graphs could help trace reachability but are heavy. The supply-chain auditor targets dependency advisories directly.
- **security-02** (security, judge: helpful) Please scan this repository for committed secrets and tell me what needs to be rotated.

Check both the current working tree and the full gi
  loaded: — · offered: — · judge: security-review, security-best-practices
  No dedicated secret-scanning skill exists. A general agent can use gitleaks or trufflehog.
- **security-07** (security, judge: helpful) I want you to review the IAM permissions for our deployment role and reduce them to what it actually needs (least privilege).

First, find w
  loaded: — · offered: — · judge: security-best-practices, security-review
  IAM least-privilege review is mostly IaC reasoning; no catalog skill clearly fits beyond generic security review.
- **security-08** (security, judge: helpful) I want you to test our own search endpoint for SQL injection in the local test environment. This is authorized testing of our own app and on
  loaded: security-and-hardening · offered: security-review · judge: security-review, fp-check, post-patch-validation · missed: security-review
  Hardening helps with the fixes; security-review's injection-focused methodology would add value for the testing report.
- **security-09** (security, judge: helpful) I want you to add audit logging for changes to user roles, and make sure it never records tokens or passwords.

First, explore the codebase 
  loaded: observability-and-instrumentation · offered: audit-context-building, trailmark, secret-serialization · judge: secret-serialization, observability-and-instrumentation, security-and-hardening · missed: secret-serialization
  Observability helps with logging conventions; secret-serialization directly targets preventing token leaks into logs.
- **debug-03** (debug, judge: helpful) This React component keeps rerendering even when its props haven't changed. Please find out why and fix it.

First find the component and wh
  loaded: investigate-first, debug · offered: browser-testing-with-devtools, surgical-patch, frontend-ui-engineering, debugging-and-error-recovery · judge: vercel-react-best-practices, systematic-debugging, performance-optimization · missed: vercel-react-best-practices
  Debug process skills help; React rerender expertise from vercel-react-best-practices would be more targeted.
- **everyday-08** (everyday, judge: none) I need a unit test for this clamp function. Please find it (the one I have open or selected; ask me if there are several candidates) and wri
  loaded: code-testing-agent · offered: test-driven-development--addyosmani · judge: —
  Simple clamp tests; a heavy testing pipeline adds little and could overcomplicate things.
- **everyday-23** (everyday, judge: none) The function that writes CSV output isn't escaping commas and quotes correctly, so fields containing them corrupt the file. Please fix it.


  loaded: surgical-patch · offered: test-driven-development--addyosmani, systematic-debugging, xlsx · judge: —
  This is a simple CSV escaping fix. A narrow-patch skill is harmless but adds little.
- **everyday-31** (everyday, judge: none) Add a test for an empty input to the `slugify` function. Find where `slugify` is defined and where its existing tests live, then follow the 
  loaded: code-testing-agent · offered: test-driven-development--addyosmani · judge: —
  Adding one trivial test needs no skill. The heavy testing pipeline could over-engineer it.
- **media-04** (media, judge: none) I want a short looping GIF made from the moment in the attached video where the cat jumps onto the chair.

Steps and requirements:
- Find th
  loaded: media-use · offered: slack-gif-creator · judge: — · misleading: media-use
  media-use is tied to HyperFrames projects. Plain ffmpeg GIF extraction needs no skill.
- **media-07** (media, judge: helpful) I want a clear diagram showing how a request travels from the browser through the API to the database, and back.

Content:
- Show three main
  loaded: — · offered: markdown-mermaid-writing · judge: markdown-mermaid-writing · missed: markdown-mermaid-writing
  The Mermaid skill would help produce the editable diagram source and handle rendering.
- **media-10** (media, judge: helpful) I have a screen recording that I want to turn into a polished 30-second demo video. Please edit it down to about 30 seconds total, keeping o
  loaded: — · offered: hyperframes, general-video · judge: hyperframes, general-video, hyperframes-keyframes · missed: hyperframes
  Edited demos with eased zooms benefit from the HyperFrames video workflow and keyframes.
- **media-13** (media, judge: helpful) I need a simple animation of the moon's phases for a school presentation. Please create it so it's clear and easy to understand for a genera
  loaded: — · offered: — · judge: motion-graphics, hyperframes
  A code-built animation is doable without a skill. motion-graphics could help, but it isn't clearly needed.
- **writing-08** (writing, judge: none) I'm going to paste our current onboarding instructions. Please rewrite them so a nontechnical customer can follow them on their own without 
  loaded: documentation · offered: kb-article · judge: —
  Rewriting in plain language is an ordinary writing task. The documentation skill adds little.
- **writing-11** (writing, judge: none) Write a concise README.md for this command line tool. Start by looking through the project (entry point, package or build files, any existin
  loaded: documentation · offered: — · judge: —
  The README requirements are clear and simple. The documentation skill does no harm but isn't needed.
- **writing-14** (writing, judge: none) Write three subject lines for this newsletter. I'll paste the newsletter content. If it isn't included, ask me for it first.

Requirements:

  loaded: draft-content · offered: email-design · judge: —
  Writing subject lines is trivial. draft-content is relevant but not needed.
- **apps-10** (apps, judge: helpful) I want you to build a desktop utility that previews batch filename changes before applying them. The core idea: I pick a folder (or drag in 
  loaded: — · offered: — · judge: test-driven-development, verification-before-completion, incremental-implementation
  A strong programmer can build this. Verification skills would be a marginal gain only.
- **productivity-03** (productivity, judge: helpful) Find a 45-minute slot next week when everyone on this invite is free. Today is Tuesday, October 6, 2026, so "next week" means Monday, Octobe
  loaded: — · offered: schedule-meeting · judge: schedule-meeting · missed: schedule-meeting
  The scheduling skill covers calendar availability lookup, which this task depends on.
- **productivity-05** (productivity, judge: none) I need a realistic task plan to finish my dissertation chapter by this Friday. Today is Tuesday, October 6, 2026, so Friday is October 9. Th
  loaded: planning-and-task-breakdown · offered: interview-me · judge: —
  The skill is software-oriented. Personal study planning needs no skill.
- **productivity-06** (productivity, judge: none) Please find duplicate files in this folder by content, not just by filename. The working directory is the folder to scan, and it should incl
  loaded: file-organizer · offered: — · judge: —
  Hash-based duplicate detection is straightforward. The organizer's cleanup bias conflicts slightly with the read-only rule.
- **productivity-07** (productivity, judge: helpful) I want a project tracker in Notion built from a list of deliverables and deadlines, which I'll paste in below.

Please set it up as a databa
  loaded: — · offered: notion-spec-to-implementation, agent-browser · judge: notion-spec-to-implementation, notion-knowledge-capture
  No Notion skill clearly covers database and view creation. A CSV fallback is easy.
- **productivity-08** (productivity, judge: helpful) I'm going to give you transcripts from several meetings. Please go through them and summarize what I still owe other people.

For each commi
  loaded: — · offered: update · judge: meeting-insights-analyzer
  Extracting commitments from transcripts is plain reading comprehension. No skill is needed.
- **productivity-09** (productivity, judge: helpful) Please add study sessions to my calendar, scheduled around my existing classes.

First, read my calendar for the coming weeks so you can see
  loaded: — · offered: planning-and-task-breakdown · judge: lark-calendar
  The calendar provider is unknown, so no catalog calendar skill clearly fits.
- **productivity-10** (productivity, judge: helpful) Our team wiki has become a mess, and I'd like you to propose a better structure and point out what should be cleaned up. I'll share an expor
  loaded: — · offered: file-organizer · judge: notion-research-documentation, file-organizer
  Wiki restructuring is a general analysis task; nothing loaded is reasonable. file-organizer is local-filesystem focused, marginal.
- **apps-03** (apps, judge: helpful) I want a browser-based word game where the player guesses a hidden word from progressively clearer clues. Please build it in the current wor
  loaded: — · offered: — · judge: webapp-testing, frontend-ui-engineering · missed: webapp-testing
  Simple vanilla game is doable unaided, but webapp-testing would help verify the requested win/loss rounds in a browser.
- **apps-04** (apps, judge: helpful) Please add biometric unlock to our React Native journal app, with a fallback for when biometrics aren't available. Start by exploring the co
  loaded: — · offered: vercel-react-native-skills · judge: vercel-react-native-skills, security-and-hardening · missed: vercel-react-native-skills
  RN biometric work benefits from React Native/Expo best practices; the optional skill should have been loaded.
