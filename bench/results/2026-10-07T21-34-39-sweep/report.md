# Sweep: 2026-10-07T21-34-39-sweep

315 requests, 1262 skills in the library, judge claude / opus, effort default.
Request generation/expansion: not recorded.
Stored provenance: not recorded (legacy), claude / opus, effort default.
Blind answers reused from bench/results/2026-10-06T02-08-14-sweep/judge-blind.jsonl.
Routing cost $0.3846; mean 1.25 s per decision.
Coverage: every request judged blind; every disputed row adjudicated.

Percentages include 95% Wilson intervals; load-level intervals do not account for within-request correlation.

| | Dev | Test | All |
|---|---:|---:|---:|
| n | 102 | 213 | 315 |
| needed | 68 | 121 | 189 |
| usefulLoaded | 79% (54/68), 68–87% | 72% (87/121), 63–79% | 75% (141/189), 68–80% |
| usefulAvailable | 84% (57/68), 73–91% | 85% (103/121), 78–90% | 85% (160/189), 79–89% |
| helpfulLoadedOnEssential | 100% (12/12), 76–100% | 94% (15/16), 72–99% | 96% (27/28), 82–99% |
| missedBetter | 11% (11/102), 6–18% | 11% (23/213), 7–16% | 11% (34/315), 8–15% |
| quietWhenNone | 79% (27/34), 63–90% | 82% (75/92), 72–88% | 81% (102/126), 73–87% |
| loadPrecision | 86% (66/77), 76–92% | 80% (123/153), 73–86% | 82% (189/230), 77–87% |
| misleadingLoads | 3% (2/77), 1–9% | 1% (2/153), 0–5% | 2% (4/230), 1–4% |
| injectPrecision | 91% (21/23), 73–98% | 79% (22/28), 60–90% | 84% (43/51), 72–92% |
| avgLoaded | 0.75 | 0.72 | 0.73 |

| Category | n | needs a skill | useful loaded | useful available | quiet when none | load precision | misleading loads | missed better |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| web | 25 | 21 | 71% (15/21), 50–86% | 76% (16/21), 55–89% | 25% (1/4), 5–70% | 88% (23/26), 71–96% | 0% (0/26), 0–13% | 16% (4/25), 6–35% |
| backend | 20 | 7 | 57% (4/7), 25–84% | 71% (5/7), 36–92% | 92% (12/13), 67–99% | 83% (5/6), 44–97% | 0% (0/6), 0–39% | 10% (2/20), 3–30% |
| integrations | 20 | 7 | 43% (3/7), 16–75% | 43% (3/7), 16–75% | 85% (11/13), 58–96% | 50% (3/6), 19–81% | 0% (0/6), 0–39% | 10% (2/20), 3–30% |
| documents | 30 | 30 | 90% (27/30), 74–97% | 100% (30/30), 89–100% | — | 94% (30/32), 80–98% | 0% (0/32), 0–11% | 17% (5/30), 7–34% |
| business | 30 | 25 | 84% (21/25), 65–94% | 92% (23/25), 75–98% | 40% (2/5), 12–77% | 82% (27/33), 66–91% | 0% (0/33), 0–10% | 13% (4/30), 5–30% |
| data | 20 | 18 | 61% (11/18), 39–80% | 83% (15/18), 61–94% | 100% (2/2), 34–100% | 83% (15/18), 61–94% | 0% (0/18), 0–18% | 15% (3/20), 5–36% |
| ml | 15 | 9 | 44% (4/9), 19–73% | 56% (5/9), 27–81% | 83% (5/6), 44–97% | 67% (4/6), 30–90% | 33% (2/6), 10–70% | 20% (3/15), 7–45% |
| science | 10 | 9 | 56% (5/9), 27–81% | 100% (9/9), 70–100% | 100% (1/1), 21–100% | 86% (6/7), 49–97% | 14% (1/7), 3–51% | 30% (3/10), 11–60% |
| devops | 20 | 9 | 78% (7/9), 45–94% | 89% (8/9), 56–98% | 73% (8/11), 43–90% | 64% (7/11), 35–85% | 0% (0/11), 0–26% | 5% (1/20), 1–24% |
| security | 15 | 15 | 87% (13/15), 62–96% | 87% (13/15), 62–96% | — | 100% (18/18), 82–100% | 0% (0/18), 0–18% | 7% (1/15), 1–30% |
| debug | 15 | 15 | 100% (15/15), 80–100% | 100% (15/15), 80–100% | — | 94% (31/33), 80–98% | 0% (0/33), 0–10% | 7% (1/15), 1–30% |
| everyday | 35 | 0 | — | — | 94% (33/35), 81–98% | 0% (0/2), 0–66% | 0% (0/2), 0–66% | 0% (0/35), 0–10% |
| media | 15 | 9 | 78% (7/9), 45–94% | 89% (8/9), 56–98% | 50% (3/6), 19–81% | 73% (11/15), 48–89% | 0% (0/15), 0–20% | 20% (3/15), 7–45% |
| writing | 15 | 5 | 100% (5/5), 57–100% | 100% (5/5), 57–100% | 50% (5/10), 24–76% | 50% (5/10), 24–76% | 0% (0/10), 0–28% | 0% (0/15), 0–20% |
| productivity | 10 | 7 | 57% (4/7), 25–84% | 71% (5/7), 36–92% | 67% (2/3), 21–94% | 57% (4/7), 25–84% | 14% (1/7), 3–51% | 10% (1/10), 2–40% |
| questions | 10 | 0 | — | — | 100% (10/10), 72–100% | — | — | 0% (0/10), 0–28% |
| apps | 10 | 3 | 0% (0/3), 0–56% | 0% (0/3), 0–56% | 100% (7/7), 65–100% | — | — | 10% (1/10), 2–40% |

## Misses and misleading loads

- **web-20** (web, judge: helpful) Our settings page is one very long scrolling page. I'd like to turn it into tabs, one per section, while keeping direct links to each sectio
  loaded: — · offered: plan-ui-change, impeccable, core · judge: frontend-ui-engineering, webapp-testing, accessibility-review · missed: frontend-ui-engineering
  Nothing loaded; frontend-ui-engineering covers accessible tabs, state, responsive behavior. Testing skill would also help.
- **web-17** (web, judge: none) I'd like to add breadcrumbs to our documentation site. First look at how the site is built (static site generator or framework, how pages an
  loaded: frontend-ui-engineering · offered: writing-plans · judge: —
  Breadcrumbs are routine; skill adds little beyond general practice but is harmless.
- **web-01** (web, judge: helpful) I want a simple website for my dog grooming business. The two main things visitors need to do are see my prices and request an appointment.

  loaded: — · offered: impeccable, vercel-deploy, netlify-deploy · judge: frontend-design, netlify-deploy, deploy-to-vercel · missed: frontend-design
  Nothing loaded; a design skill would improve the friendly look; deploy skills also useful.
- **web-04** (web, judge: helpful) I'd like keyboard navigation added to this dropdown, and I want Escape to close it. Please find the dropdown component in the codebase and c
  loaded: — · offered: — · judge: frontend-ui-engineering, accessibility-review, webapp-testing · missed: frontend-ui-engineering
  Nothing loaded; frontend-ui-engineering covers WCAG keyboard and ARIA patterns.
- **web-07** (web, judge: none) The spacing on the pricing cards is off, and the buttons don't line up. Please fix it.

Find the pricing cards component and its styles. Wor
  loaded: impeccable · offered: surgical-patch · judge: —
  This is a small, ordinary CSS alignment fix. A broad design skill adds little, but it does no harm.
- **web-10** (web, judge: none) Please add a dark mode toggle to my site and make it remember the visitor's choice on their next visit.

Requirements:
- Add an accessible t
  loaded: frontend-ui-engineering · offered: planning-and-task-breakdown · judge: —
  A dark mode toggle is routine work. The general UI skill touches on accessibility but adds little beyond what a capable developer already knows.
- **web-14** (web, judge: helpful) The navbar jumps when I open the menu. Please find the cause and fix it so opening and closing is smooth.

What I need:
1. Find the navbar a
  loaded: — · offered: — · judge: investigate-first, frontend-ui-engineering, systematic-debugging, webapp-testing
  Fixing a jumpy navbar is ordinary CSS debugging. A debugging skill could help a little, but none is clearly required.
- **web-15** (web, judge: helpful) Create a landing page for our online ceramics class using the photos in public/images.

Start by looking at public/images. List the photos y
  loaded: — · offered: — · judge: landing-page-design, frontend-design, design-taste-frontend, frontend-ui-engineering, web-perf · missed: landing-page-design
  The request is a landing page with a hero, CTAs and conversion-focused sections, so landing-page-design would materially improve structure and layout.
- **web-25** (web, judge: helpful) I want the booking calendar to show unavailable days more clearly, because customers keep trying to click them.

Please find the booking cal
  loaded: — · offered: — · judge: accessibility-review, frontend-ui-engineering
  Making disabled calendar days clear and accessible is ordinary work. An accessibility skill would help a little, but it isn't essential.
- **backend-03** (backend, judge: helpful) Stripe sometimes sends the same webhook twice, and we're creating duplicate subscriptions. Please make webhook processing idempotent.

First
  loaded: — · offered: supabase-postgres-best-practices, incremental-implementation, surgical-patch, security-and-hardening · judge: investigate-first, systematic-debugging, supabase-postgres-best-practices
  A strong engineer can build idempotent webhook handling without a skill. supabase-postgres-best-practices fits only if the project uses Postgres.
- **backend-11** (backend, judge: helpful) I need a Django API for recording maintenance tickets and assigning them to technicians. Please build it, using Django REST Framework unless
  loaded: — · offered: — · judge: django-access-review · missed: django-access-review
  django-access-review would help get the technician and staff permission scoping right and avoid IDOR bugs in the DRF viewsets.
- **backend-12** (backend, judge: none) Our webhook receiver currently parses or processes the payload before the signature is checked. Please change it so the signature is verifie
  loaded: security-and-hardening · offered: setup-zoom-webhooks, constant-time-analysis, test-driven-development--addyosmani · judge: —
  Generic hardening guidance; webhook signature verification is standard work for a strong engineer.
- **backend-20** (backend, judge: helpful) We need tenant isolation in this Rails app. Please review the query paths and make sure one company can't read another company's records.

C
  loaded: — · offered: security-and-hardening, audit-context-building, find-bugs, code-review--anthropics · judge: security-review, variant-analysis · missed: security-review
  Tenant-isolation audit is IDOR/access-control review; security-review would structure the audit.
- **integrations-04** (integrations, judge: none) I want a command-line tool that lists my open Linear issues and lets me change their status. Please build it in the current working director
  loaded: cli-creator · offered: — · judge: —
  Codex-oriented CLI-with-JSON pattern doesn't fit an interactive Linear SDK tool well, but it does little harm.
- **integrations-10** (integrations, judge: helpful) I want a support chatbot for our website that answers questions using our help center articles, and hands off to a human when it can't answe
  loaded: ai-rag-pipeline · offered: markitdown · judge: claude-api, ai-rag-pipeline
  inference.sh web-search RAG doesn't match local help-center indexing; adds little.
- **integrations-09** (integrations, judge: helpful) I need a GitHub Action that posts a short release summary to our team's Slack channel whenever we publish a release. Please add it to this r
  loaded: — · offered: planning-and-task-breakdown · judge: gha-security-review, ci-cd-and-automation · missed: gha-security-review
  Workflow injection risks via release notes; GHA security guidance would materially help.
- **integrations-14** (integrations, judge: helpful) I want to build an agent that checks incoming purchase orders against our catalog and drafts a reply for human review.

Flow:
1. Take an inc
  loaded: — · offered: — · judge: pdf, claude-api · missed: pdf
  PDF PO extraction benefits from pdf skill's extraction tooling.
- **integrations-18** (integrations, judge: helpful) I want a Microsoft Teams bot that answers office location and Wi-Fi questions from a maintained FAQ.

Requirements:
- Users ask in personal 
  loaded: — · offered: — · judge: microsoft-foundry
  No catalog skill covers Teams bot/Agents SDK specifically; none loaded is reasonable.
- **integrations-20** (integrations, judge: none) I want you to build a VS Code extension that inserts our team's standard ticket reference into commit messages.

I haven't given you the tic
  loaded: source-driven-development · offered: test-driven-development--addyosmani · judge: —
  Checking VS Code docs is mildly useful but general practice.
- **documents-03** (documents, judge: helpful) Please update my resume for the attached data analyst job posting. The result must fit on one page.

I'll attach my current resume and the j
  loaded: tailored-resume-generator · offered: docx · judge: docx, tailored-resume-generator, pdf · missed: docx
  Tailoring guidance helps; docx skill needed for preserving format and verifying one page.
- **documents-08** (documents, judge: essential) I have a scanned copy of a lease that I need converted into editable text. Please find the scan in my working directory (if there are severa
  loaded: liteparse · offered: pdf, azure-ai · judge: docx, pdf, liteparse, pdf--openai · missed: docx
  Liteparse handles OCR with layout. The Word output still needs the docx skill to keep structure and the inline tags.
- **documents-17** (documents, judge: helpful) I need a rent receipt for September, using the payment details I'm providing with this request.

Please include:
- The receipt title, the da
  loaded: — · offered: pdf, docx, pdf--openai · judge: pdf, docx · missed: pdf
  A print-ready PDF plus a docx is wanted. The pdf skill would help produce a clean one-page receipt.
- **documents-21** (documents, judge: helpful) Create a printable checklist for opening and closing our bakery. Staff will use it every day.

Structure:
- Two sections, "Opening" and "Clo
  loaded: — · offered: docx, pdf, pdf--openai · judge: docx, pdf · missed: docx
  An editable Word checklist with checkboxes plus a PDF are needed. The docx skill would materially help.
- **documents-24** (documents, judge: essential) I need you to extract the line items from the supplier invoices I've attached and combine them into a single CSV file.

For each line item, 
  loaded: — · offered: liteparse, invoice-organizer, python-executor, xlsx · judge: pdf, pdf--openai, liteparse · missed: pdf
  Reading scanned and PDF invoices needs PDF extraction and OCR guidance. The pdf skill clearly helps.
- **business-03** (business, judge: helpful) I'm a sole trader in the UK and I'm about to start my Self Assessment tax return. Give me a practical checklist of the records and documents
  loaded: — · offered: discernment-nudge · judge: tax-season-organizer
  Tax-season-organizer is US-focused. A UK Self Assessment checklist is general knowledge.
- **business-04** (business, judge: none) Draft a short outreach email to independent bookstores asking them to stock our greeting cards. Keep it under 150 words, warm and profession
  loaded: outreach-composer, draft-outreach · offered: draft-content, content-creation, lark-mail · judge: —
  A short, simple email draft. The outreach skills are built around CRM, sequence and voice-learning steps that don't apply here, though they do no harm.
- **business-05** (business, judge: helpful) Help me clean up duplicate contacts in our CRM. I'll share an export of the records (CSV or pasted rows). Find the duplicate pairs and, for 
  loaded: — · offered: explore-data, xlsx, crm-autopilot · judge: crm-hygiene-check, xlsx · missed: crm-hygiene-check
  crm-hygiene-check is a read-only CRM audit that produces a fix checklist, which matches this dedupe-recommendation task. xlsx would also help with the CSV.
- **business-18** (business, judge: helpful) I need a polite but firm payment reminder I can send to clients whose invoices are more than 30 days overdue. Please draft it as an email wi
  loaded: draft-response · offered: invoice-chase, outreach-composer, lark-mail · judge: invoice-chase · missed: invoice-chase
  invoice-chase is the dedicated skill for overdue-invoice reminders with tone matching. draft-response is generic customer-reply guidance.
- **business-22** (business, judge: helpful) I'm sharing ad results from our campaigns. Please analyze them and tell me which campaigns deserve more budget, and be clear about how uncer
  loaded: ad-manager · offered: performance-report, statistical-analysis--anthropics, statistical-analysis, analyze · judge: statistical-analysis--anthropics, analyze, ad-manager, validate-data · missed: statistical-analysis--anthropics
  ad-manager fits the budget recommendations. The confidence intervals and significance checks the user asked for need a statistics skill.
- **business-23** (business, judge: helpful) We need a customer support escalation policy covering three situations: billing problems, outages, and angry customers. Please draft it as a
  loaded: process-doc · offered: documentation · judge: customer-escalation, runbook, incident-response · missed: customer-escalation
  process-doc helps with the SOP structure and RACI. customer-escalation covers the escalation domain directly, and incident-response covers outages.
- **business-24** (business, judge: helpful) Help me estimate the true, fully loaded annual cost of hiring my first employee in California. I want a realistic number rather than just th
  loaded: discernment-nudge · offered: — · judge: xlsx, comp-analysis
  The follow-up-question nudge adds little. xlsx could help, but the user only asked for a table in the reply, so it isn't clearly better.
- **business-28** (business, judge: none) I'm planning to sell digital downloads (for example ebooks, templates, or software files) to customers in the EU, and I want to be ready for
  loaded: meeting-briefing · offered: compliance-check, discernment-nudge · judge: —
  A plain list of questions for an accountant. The legal meeting-briefing workflow is about the same area but adds little.
- **business-29** (business, judge: none) Create a referral program for my cleaning company. I want a simple reward structure and clear eligibility rules that I can publish to custom
  loaded: compliance-check · offered: — · judge: —
  The user wants only a short note on local checks. A full compliance-check workflow is overkill but harmless.
- **data-01** (data, judge: helpful) Write a SQL query that finds customers who placed an order last quarter but haven't placed any order this quarter.

Assumptions to state, an
  loaded: — · offered: — · judge: write-query, sql-queries · missed: write-query
  write-query or sql-queries would help with dialect notes and best practices. A strong programmer could manage without them, but loading one is reasonable.
- **data-02** (data, judge: helpful) I need you to clean a CSV file. The dates are in three different formats, and some of the amount values have currency symbols. Look for the 
  loaded: — · offered: — · judge: xlsx, explore-data
  Cleaning a CSV with Python is routine. explore-data or xlsx would help slightly, but neither is clearly needed.
- **data-05** (data, judge: helpful) Please create a Jupyter notebook that explores the bike share dataset in my working directory and saves the charts it produces. Start by loc
  loaded: — · offered: — · judge: jupyter-notebook, exploratory-data-analysis, create-viz, seaborn · missed: jupyter-notebook
  No skills were loaded. jupyter-notebook has notebook scaffolding templates and should have been loaded.
- **data-12** (data, judge: helpful) I need a dbt model that gives me daily recurring revenue (MRR/ARR-style, expressed per day) from our subscription data, including cancellati
  loaded: — · offered: write-query, sql-queries · judge: sql-queries, write-query
  No skills were loaded. dbt conventions come from the repo itself, and the SQL skills would add only a little.
- **data-16** (data, judge: helpful) Using the customer export I'm providing, make a map of sales by postcode.

Inspect the file first to find the postcode, country, and sales o
  loaded: — · offered: geopandas, create-viz, python-executor, data-visualization--anthropics · judge: geopandas, data-visualization--anthropics, create-viz · missed: geopandas
  No skills were loaded. geopandas would help with postcode boundary joins and choropleths.
- **data-18** (data, judge: helpful) In this notebook, add confidence intervals to the conversion chart.

First, read the notebook to find the conversion chart and the data behi
  loaded: — · offered: jupyter-notebook, scientific-visualization, statistical-analysis--anthropics, statistical-analysis · judge: jupyter-notebook, statistical-analysis, matplotlib
  No skills were loaded. Wilson intervals in an existing notebook are routine for a strong programmer.
- **data-19** (data, judge: helpful) I need a weekly operations report built from these shipment logs, covering late deliveries and their most common causes.

First inspect the 
  loaded: report-builder · offered: explore-data, xlsx, analyze, report-pack · judge: build-dashboard, create-viz, xlsx, data-visualization--anthropics
  report-builder targets connector-based SMB reports, so it only partly fits. A custom script approach is fine here.
- **ml-02** (ml, judge: helpful) I want to build an embedding search index over our product descriptions and evaluate how well it works using example queries that I'll provi
  loaded: — · offered: — · judge: train-sentence-transformers, transformers
  Nothing was loaded. Standard sentence-transformers plus FAISS work is doable without a skill, and the training skill doesn't fit.
- **ml-05** (ml, judge: none) I want to benchmark an ONNX model on CPU and get latency numbers at different batch sizes. I'll point you to the model file in the working d
  loaded: python-executor · offered: — · judge: — · misleading: python-executor
  A remote sandbox can't benchmark the local CPU or reach the local model file, so it would distort the latency numbers.
- **ml-06** (ml, judge: helpful) I want an evaluation set for our document Q&A system. It should include questions the documents can't answer, so I can check that the system
  loaded: google-agents-cli-eval · offered: — · judge: markitdown, liteparse, pdf · missed: markitdown · misleading: google-agents-cli-eval
  The ADK agent eval methodology doesn't match building a document QA set. Document parsing would help more.
- **ml-07** (ml, judge: helpful) I need help balancing a dataset without letting copies of the same sample end up in both train and test. I'll point you to the data in the w
  loaded: — · offered: exploratory-data-analysis, explore-data · judge: scikit-learn · missed: scikit-learn
  Group-aware stratified splitting and resampling are covered by the scikit-learn guidance. Without it the agent is still mostly fine.
- **ml-09** (ml, judge: helpful) I have a local language model and I want to quantize it, then measure how much answer quality changes.

First, inspect the working directory
  loaded: — · offered: — · judge: huggingface-local-models, transformers, hf-mem · missed: huggingface-local-models
  GGUF quantization and llama.cpp guidance would materially help here.
- **ml-14** (ml, judge: helpful) I want to build a reranking experiment for our search results, using the relevance judgments in the file I've provided.

First, find the jud
  loaded: — · offered: train-sentence-transformers · judge: train-sentence-transformers, statistical-analysis, scikit-learn
  Nothing was loaded. A strong agent can handle IR evaluation well enough. Cross-encoder skills would be a marginal help.
- **science-01** (science, judge: helpful) I need you to analyze my qPCR results using the controls described in my experiment notes. Start by finding the qPCR data files and the expe
  loaded: python-executor · offered: statistical-analysis, statistical-analysis--anthropics · judge: statistical-analysis, scientific-visualization, matplotlib · missed: statistical-analysis · misleading: python-executor
  The remote sandbox can't read the local working files. Statistical test guidance would help more.
- **science-02** (science, judge: helpful) I want to reproduce the main figure (the primary results figure, likely Figure 1 or 2; confirm which one you're targeting) from a paper usin
  loaded: — · offered: ai-research-reproduction, scientific-visualization, python-executor, data-visualization--anthropics · judge: pdf, scientific-visualization, matplotlib
  Nothing was loaded. PDF or visualization skills would help a little, but none is clearly required.
- **science-05** (science, judge: helpful) Compare the protein sequences I've provided and mark the conserved regions. Look in the working directory for the sequence files (FASTA or s
  loaded: biopython · offered: — · judge: phylogenetics, biopython · missed: phylogenetics
  Biopython is useful for parsing and alignment work. The phylogenetics skill covers running MAFFT.
- **science-06** (science, judge: helpful) Fit a dose-response curve to our assay data and report the IC50 with uncertainty. First find the data file(s) in the working directory and s
  loaded: — · offered: python-executor, statistical-analysis, uncertainty-and-units · judge: statistical-analysis, scientific-visualization, matplotlib
  Fitting a 4PL curve with scipy is standard work, and the agent can do it fine without a skill.
- **science-09** (science, judge: helpful) I'd like you to review our statistical analysis and tell me whether it properly accounts for repeated measurements from the same animal (pse
  loaded: — · offered: statistical-analysis, scientific-critical-thinking, validate-data, statsmodels · judge: statistical-analysis, statsmodels, experimental-design · missed: statistical-analysis
  Mixed-model and pseudoreplication guidance from statistical-analysis or statsmodels would make the review stronger.
- **devops-01** (devops, judge: helpful) Please add a GitHub Actions workflow to this repository that runs our tests on every pull request.

First inspect the repo to identify the l
  loaded: — · offered: google-agents-cli-scaffold · judge: ci-cd-and-automation · missed: ci-cd-and-automation
  Nothing was loaded. A generic CI/CD skill would help modestly with quality gates and pipeline conventions.
- **devops-13** (devops, judge: none) Our disk filled up overnight and I need to understand why. Please investigate what's growing and propose a retention policy. Do not delete, 
  loaded: investigate-first · offered: — · judge: —
  The user already gave a detailed read-only plan. A generic investigation skill adds little.
- **devops-15** (devops, judge: none) I need to find out why the certificate on our staging environment isn't renewing automatically. Please investigate and tell me the root caus
  loaded: investigate-first · offered: debugging-and-error-recovery, debug · judge: —
  The user already gave a structured diagnosis plan. The skill is harmless but adds little.
- **devops-16** (devops, judge: none) I want to add a manual deployment approval step before the production job in our GitLab CI pipeline. Please update the `.gitlab-ci.yml` (and
  loaded: ci-cd-and-automation · offered: — · judge: —
  Generic CI/CD guidance with no GitLab-specific approval knowledge. Harmless.
- **devops-20** (devops, judge: helpful) Please review our cloud bill and find idle resources and obvious configuration waste that we could cut.

Use the billing exports, cost repor
  loaded: — · offered: cost-optimization, google-cloud-waf-cost-optimization · judge: cost-optimization, google-cloud-waf-cost-optimization, gke-cost-analysis
  The provider is unknown, and the cost skills are tied to Azure or GCP. Loading nothing is reasonable.
- **security-02** (security, judge: helpful) Please scan this repository for committed secrets and tell me what needs to be rotated.

Check both the current working tree and the full gi
  loaded: — · offered: — · judge: security-review, security-best-practices
  No dedicated secret-scanning skill exists. Generic security review skills add marginal value.
- **security-07** (security, judge: helpful) I want you to review the IAM permissions for our deployment role and reduce them to what it actually needs (least privilege).

First, find w
  loaded: — · offered: iam-helper-for-troubleshooting · judge: security-best-practices, security-review
  The provider is unknown, and the IAM helpers are GCP-specific. Loading nothing is acceptable.
- **security-09** (security, judge: helpful) I want you to add audit logging for changes to user roles, and make sure it never records tokens or passwords.

First, explore the codebase 
  loaded: observability-and-instrumentation · offered: trailmark, security-and-hardening, audit-context-building, secret-serialization · judge: secret-serialization, observability-and-instrumentation, security-and-hardening · missed: secret-serialization
  Logging guidance helps. secret-serialization targets the main risk here, secrets leaking when objects are serialized into logs, so it should have been loaded.
- **debug-03** (debug, judge: helpful) This React component keeps rerendering even when its props haven't changed. Please find out why and fix it.

First find the component and wh
  loaded: investigate-first · offered: vercel-react-best-practices, browser-testing-with-devtools, debug, surgical-patch · judge: vercel-react-best-practices, systematic-debugging, performance-optimization · missed: vercel-react-best-practices
  Collecting evidence first helps. The React performance skill directly covers memoization, unstable prop identity and context splitting.
- **everyday-08** (everyday, judge: none) I need a unit test for this clamp function. Please find it (the one I have open or selected; ask me if there are several candidates) and wri
  loaded: code-testing-agent · offered: test-driven-development--addyosmani · judge: —
  Simple clamp tests don't need a skill. A full test-generation pipeline is overkill but harmless.
- **everyday-31** (everyday, judge: none) Add a test for an empty input to the `slugify` function. Find where `slugify` is defined and where its existing tests live, then follow the 
  loaded: code-testing-agent · offered: test-driven-development--addyosmani · judge: —
  Adding one trivial test needs no skill. The heavy pipeline adds little.
- **media-02** (media, judge: helpful) I want a square product image featuring the bottle in the photo I've attached, placed on a soft beige background.

Requirements:
- Output a 
  loaded: image-edit, nano-banana-edit · offered: background-removal, product-photography, imagegen, ai-image-generation--prime-skills · judge: background-removal, ai-product-photography, product-photography, image-edit · missed: background-removal
  Edit models swap backgrounds well but may redraw the label. A clean BiRefNet cutout plus compositing keeps the branding most faithful.
- **media-04** (media, judge: none) I want a short looping GIF made from the moment in the attached video where the cat jumps onto the chair.

Steps and requirements:
- Find th
  loaded: python-executor · offered: media-use · judge: —
  A standard ffmpeg GIF job needs no skill. The sandbox doesn't hurt but adds little.
- **media-05** (media, judge: none) I want the background hum removed from the attached podcast clip, without making the voices sound metallic or processed.

Approach:
- First 
  loaded: python-executor · offered: — · judge: —
  Notch-filter hum removal is ordinary DSP. A generic sandbox adds little.
- **media-10** (media, judge: helpful) I have a screen recording that I want to turn into a polished 30-second demo video. Please edit it down to about 30 seconds total, keeping o
  loaded: — · offered: hyperframes, general-video · judge: hyperframes, general-video, hyperframes-keyframes · missed: hyperframes
  Nothing loaded. HyperFrames covers keyframed zooms and video rendering, which would help with eased zoom editing.
- **media-14** (media, judge: none) I want to share a dashcam video and need the license plates blurred first so they can't be read. Please process the video I point you to and
  loaded: python-executor · offered: — · judge: —
  Plate detection and blurring is custom CV code. No catalog skill targets it, and the sandbox adds little.
- **media-13** (media, judge: helpful) I need a simple animation of the moon's phases for a school presentation. Please create it so it's clear and easy to understand for a genera
  loaded: — · offered: — · judge: motion-graphics, hyperframes · missed: motion-graphics
  Doable with plain code, but motion-graphics/HyperFrames would help with a polished, looping, labeled animation.
- **writing-08** (writing, judge: none) I'm going to paste our current onboarding instructions. Please rewrite them so a nontechnical customer can follow them on their own without 
  loaded: documentation · offered: kb-article, ux-copy, brand-guidelines--getsentry · judge: —
  Rewriting for plain language is ordinary writing work. The documentation skill adds little and doesn't mislead.
- **writing-06** (writing, judge: none) Write a short announcement, around 80–120 words, telling staff that our office is moving next month. Today is 2026-10-06, so "next month" me
  loaded: internal-comms · offered: draft-content · judge: —
  A simple announcement email; the internal-comms formats add little but do no harm.
- **writing-11** (writing, judge: none) Write a concise README.md for this command line tool. Start by looking through the project (entry point, package or build files, any existin
  loaded: documentation · offered: — · judge: —
  Generic documentation guidance; writing a short README from the code is routine work.
- **writing-13** (writing, judge: none) Turn this technical design into an explanation for our sales team. I'll paste or point you to the design document. If it isn't provided, ask
  loaded: writing-shape · offered: documentation · judge: —
  An article-shaping workflow is a loose fit for a one-page sales explainer, but it is harmless.
- **writing-14** (writing, judge: none) Write three subject lines for this newsletter. I'll paste the newsletter content. If it isn't included, ask me for it first.

Requirements:

  loaded: draft-content · offered: email-design, content-creation · judge: —
  Its subject-line options overlap with the task, but the user's constraints already cover what matters.
- **productivity-03** (productivity, judge: helpful) Find a 45-minute slot next week when everyone on this invite is free. Today is Tuesday, October 6, 2026, so "next week" means Monday, Octobe
  loaded: lark-calendar · offered: schedule-meeting · judge: schedule-meeting · missed: schedule-meeting · misleading: lark-calendar
  Assumes Feishu/Lark without evidence; schedule-meeting covers Google Calendar and Outlook availability.
- **apps-10** (apps, judge: helpful) I want you to build a desktop utility that previews batch filename changes before applying them. The core idea: I pick a folder (or drag in 
  loaded: — · offered: — · judge: test-driven-development, verification-before-completion, incremental-implementation
  Nothing was loaded; testing skills might help a little, but none is clearly needed.
- **productivity-05** (productivity, judge: none) I need a realistic task plan to finish my dissertation chapter by this Friday. Today is Tuesday, October 6, 2026, so Friday is October 9. Th
  loaded: planning-and-task-breakdown · offered: interview-me · judge: —
  Built for breaking down software tasks; a dissertation plan doesn't need it.
- **productivity-08** (productivity, judge: helpful) I'm going to give you transcripts from several meetings. Please go through them and summarize what I still owe other people.

For each commi
  loaded: — · offered: — · judge: meeting-insights-analyzer
  Extracting commitments from transcripts is a careful reading task that needs no skill.
- **productivity-10** (productivity, judge: helpful) Our team wiki has become a mess, and I'd like you to propose a better structure and point out what should be cleaned up. I'll share an expor
  loaded: file-organizer · offered: — · judge: notion-research-documentation, file-organizer
  Organizes files on a computer, not wiki pages; only loosely relevant.
- **apps-03** (apps, judge: helpful) I want a browser-based word game where the player guesses a hidden word from progressively clearer clues. Please build it in the current wor
  loaded: — · offered: — · judge: webapp-testing, frontend-ui-engineering
  A vanilla-JS game is routine; webapp-testing is optional, not clearly needed.
- **apps-04** (apps, judge: helpful) Please add biometric unlock to our React Native journal app, with a fallback for when biometrics aren't available. Start by exploring the co
  loaded: — · offered: incremental-implementation · judge: vercel-react-native-skills, security-and-hardening · missed: vercel-react-native-skills
  Nothing loaded. The React Native/Expo best-practices skill would help with native module, config and app-state lifecycle work.
