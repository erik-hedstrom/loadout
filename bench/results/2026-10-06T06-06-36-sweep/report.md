# Sweep: 2026-10-06T06-06-36-sweep

315 requests, 1262 skills in the library, judge opus.
Routing cost $0.3397; mean 0.93 s per decision.
Coverage: every request judged blind; every disputed row adjudicated.

| | All |
|---|---:|
| n | 315 |
| needed | 189 |
| usefulLoaded | 78% (148/189) |
| usefulAvailable | 86% (162/189) |
| helpfulLoadedOnEssential | 96% (27/28) |
| missedBetter | 8% (26/315) |
| quietWhenNone | 83% (104/126) |
| loadPrecision | 83% (195/235) |
| misleadingLoads | 2% (4/235) |
| injectPrecision | 89% (54/61) |
| avgLoaded | 0.75 |

| Category | n | needs a skill | useful loaded | useful available | quiet when none | load precision | misleading loads | missed better |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| web | 25 | 21 | 76% (16/21) | 76% (16/21) | 25% (1/4) | 86% (24/28) | 0% (0/28) | 20% (5/25) |
| backend | 20 | 7 | 71% (5/7) | 86% (6/7) | 92% (12/13) | 86% (6/7) | 0% (0/7) | 0% (0/20) |
| integrations | 20 | 7 | 43% (3/7) | 43% (3/7) | 85% (11/13) | 50% (3/6) | 0% (0/6) | 15% (3/20) |
| documents | 30 | 30 | 90% (27/30) | 100% (30/30) | — | 94% (30/32) | 0% (0/32) | 17% (5/30) |
| business | 30 | 25 | 84% (21/25) | 92% (23/25) | 60% (3/5) | 84% (27/32) | 0% (0/32) | 7% (2/30) |
| data | 20 | 18 | 72% (13/18) | 83% (15/18) | 100% (2/2) | 89% (17/19) | 0% (0/19) | 5% (1/20) |
| ml | 15 | 9 | 44% (4/9) | 56% (5/9) | 83% (5/6) | 57% (4/7) | 29% (2/7) | 13% (2/15) |
| science | 10 | 9 | 56% (5/9) | 100% (9/9) | 100% (1/1) | 83% (5/6) | 17% (1/6) | 20% (2/10) |
| devops | 20 | 9 | 89% (8/9) | 89% (8/9) | 73% (8/11) | 91% (10/11) | 0% (0/11) | 0% (0/20) |
| security | 15 | 15 | 87% (13/15) | 87% (13/15) | — | 100% (16/16) | 0% (0/16) | 20% (3/15) |
| debug | 15 | 15 | 100% (15/15) | 100% (15/15) | — | 89% (31/35) | 0% (0/35) | 13% (2/15) |
| everyday | 35 | 0 | — | — | 94% (33/35) | 0% (0/2) | 0% (0/2) | 0% (0/35) |
| media | 15 | 9 | 89% (8/9) | 89% (8/9) | 50% (3/6) | 75% (12/16) | 0% (0/16) | 0% (0/15) |
| writing | 15 | 5 | 100% (5/5) | 100% (5/5) | 60% (6/10) | 56% (5/9) | 0% (0/9) | 0% (0/15) |
| productivity | 10 | 7 | 57% (4/7) | 71% (5/7) | 67% (2/3) | 57% (4/7) | 14% (1/7) | 10% (1/10) |
| apps | 10 | 3 | 33% (1/3) | 33% (1/3) | 100% (7/7) | 50% (1/2) | 0% (0/2) | 0% (0/10) |
| questions | 10 | 0 | — | — | 100% (10/10) | — | — | 0% (0/10) |

## Misses and misleading loads

- **web-17** (web, judge: none) I'd like to add breadcrumbs to our documentation site. First look at how the site is built (static site generator or framework, how pages an
  loaded: frontend-ui-engineering · offered: writing-plans · judge: —
  Generic UI/accessibility guidance. Harmless, but a strong agent can build breadcrumbs without it.
- **web-20** (web, judge: helpful) Our settings page is one very long scrolling page. I'd like to turn it into tabs, one per section, while keeping direct links to each sectio
  loaded: — · offered: core, plan-ui-change, impeccable · judge: frontend-ui-engineering, webapp-testing, accessibility-review · missed: frontend-ui-engineering
  Accessible tabs pattern with routing and responsive behavior; frontend-ui-engineering would help with ARIA and state.
- **web-01** (web, judge: helpful) I want a simple website for my dog grooming business. The two main things visitors need to do are see my prices and request an appointment.

  loaded: — · offered: impeccable · judge: frontend-design, netlify-deploy, deploy-to-vercel · missed: frontend-design
  Friendly visual design for small business site benefits from design guidance skill.
- **web-04** (web, judge: helpful) I'd like keyboard navigation added to this dropdown, and I want Escape to close it. Please find the dropdown component in the codebase and c
  loaded: — · offered: caveman-explore, test-driven-development--addyosmani, surgical-patch, audit-context-building · judge: frontend-ui-engineering, accessibility-review, webapp-testing · missed: frontend-ui-engineering
  Keyboard/ARIA menu pattern; frontend-ui-engineering covers WCAG patterns usefully.
- **web-07** (web, judge: none) The spacing on the pricing cards is off, and the buttons don't line up. Please fix it.

Find the pricing cards component and its styles. Wor
  loaded: impeccable · offered: surgical-patch · judge: —
  Simple flex alignment fix; broad design skill adds little.
- **web-10** (web, judge: none) Please add a dark mode toggle to my site and make it remember the visitor's choice on their next visit.

Requirements:
- Add an accessible t
  loaded: frontend-ui-engineering · offered: planning-and-task-breakdown · judge: —
  Dark mode toggle is standard work. The generic UI skill adds little.
- **web-11** (web, judge: helpful) I want to build a personal website with three parts: an About page, a Selected Projects section, and a small blog. The look should be clean 
  loaded: frontend-ui-engineering, design-taste-frontend · offered: minimalist-ui, writing-plans, impeccable, frontend-design · judge: frontend-design, minimalist-ui, frontend-ui-engineering · missed: minimalist-ui
  Typography-focused clean site fits minimalist-ui; design-taste is general.
- **web-14** (web, judge: helpful) The navbar jumps when I open the menu. Please find the cause and fix it so opening and closing is smooth.

What I need:
1. Find the navbar a
  loaded: — · offered: — · judge: investigate-first, frontend-ui-engineering, systematic-debugging, webapp-testing
  Common CSS layout-shift bug; strong programmer handles without skills, debugging skill optional.
- **web-15** (web, judge: helpful) Create a landing page for our online ceramics class using the photos in public/images.

Start by looking at public/images. List the photos y
  loaded: — · offered: — · judge: landing-page-design, frontend-design, design-taste-frontend, frontend-ui-engineering, web-perf · missed: frontend-design
  Landing page with visual tone benefits from design guidance.
- **backend-03** (backend, judge: helpful) Stripe sometimes sends the same webhook twice, and we're creating duplicate subscriptions. Please make webhook processing idempotent.

First
  loaded: — · offered: supabase-postgres-best-practices, incremental-implementation, surgical-patch, debugging-and-error-recovery · judge: investigate-first, systematic-debugging, supabase-postgres-best-practices
  Idempotent webhook handling is standard backend work; no skill needed.
- **backend-11** (backend, judge: helpful) I need a Django API for recording maintenance tickets and assigning them to technicians. Please build it, using Django REST Framework unless
  loaded: — · offered: — · judge: django-access-review
  Nothing loaded. A standard DRF build is fine without a skill; django-access-review would help only marginally.
- **backend-12** (backend, judge: none) Our webhook receiver currently parses or processes the payload before the signature is checked. Please change it so the signature is verifie
  loaded: security-and-hardening · offered: setup-zoom-webhooks, constant-time-analysis, test-driven-development--addyosmani · judge: —
  Generic hardening guidance. Verifying webhook HMAC signatures is well-known work that a strong engineer handles without a skill.
- **integrations-04** (integrations, judge: none) I want a command-line tool that lists my open Linear issues and lets me change their status. Please build it in the current working director
  loaded: cli-creator · offered: — · judge: —
  cli-creator targets Codex companion CLIs that return JSON. It's tangential here but harmless for a TypeScript Linear CLI.
- **integrations-09** (integrations, judge: helpful) I need a GitHub Action that posts a short release summary to our team's Slack channel whenever we publish a release. Please add it to this r
  loaded: — · offered: — · judge: gha-security-review, ci-cd-and-automation · missed: gha-security-review
  The workflow has injection concerns, so a GHA security review would help catch unsafe interpolation.
- **integrations-10** (integrations, judge: helpful) I want a support chatbot for our website that answers questions using our help center articles, and hands off to a human when it can't answe
  loaded: ai-rag-pipeline · offered: markitdown · judge: claude-api, ai-rag-pipeline · missed: claude-api
  ai-rag-pipeline centres on web search through inference.sh, not indexing local articles. claude-api would help more with the LLM integration.
- **integrations-14** (integrations, judge: helpful) I want to build an agent that checks incoming purchase orders against our catalog and drafts a reply for human review.

Flow:
1. Take an inc
  loaded: — · offered: — · judge: pdf, claude-api · missed: pdf
  The agent must extract line items from PDF purchase orders, so the pdf skill would help.
- **integrations-18** (integrations, judge: helpful) I want a Microsoft Teams bot that answers office location and Wi-Fi questions from a maintained FAQ.

Requirements:
- Users ask in personal 
  loaded: — · offered: — · judge: microsoft-foundry
  No catalog skill covers the Teams Bot Framework well. Leaving it empty is acceptable.
- **integrations-20** (integrations, judge: none) I want you to build a VS Code extension that inserts our team's standard ticket reference into commit messages.

I haven't given you the tic
  loaded: source-driven-development · offered: test-driven-development--addyosmani · judge: —
  Checking the VS Code docs is mildly useful, but standard extension work doesn't need a skill.
- **documents-03** (documents, judge: helpful) Please update my resume for the attached data analyst job posting. The result must fit on one page.

I'll attach my current resume and the j
  loaded: tailored-resume-generator · offered: docx · judge: docx, tailored-resume-generator, pdf · missed: docx
  The tailoring skill is useful, but keeping the format and fitting one page in Word needs the docx skill.
- **documents-08** (documents, judge: essential) I have a scanned copy of a lease that I need converted into editable text. Please find the scan in my working directory (if there are severa
  loaded: liteparse · offered: pdf, azure-ai · judge: docx, pdf, liteparse, pdf--openai · missed: docx
  liteparse covers the OCR, but the required .docx output with preserved structure needs the docx skill.
- **documents-17** (documents, judge: helpful) I need a rent receipt for September, using the payment details I'm providing with this request.

Please include:
- The receipt title, the da
  loaded: — · offered: docx, pdf, pdf--openai · judge: pdf, docx · missed: pdf
  The PDF and Word deliverables need the pdf and docx skills. Both were offered as optional but not loaded.
- **documents-21** (documents, judge: helpful) Create a printable checklist for opening and closing our bakery. Staff will use it every day.

Structure:
- Two sections, "Opening" and "Clo
  loaded: — · offered: docx, pdf, pdf--openai · judge: docx, pdf · missed: docx
  The PDF and Word deliverables need the docx and pdf skills, but none were loaded.
- **documents-24** (documents, judge: essential) I need you to extract the line items from the supplier invoices I've attached and combine them into a single CSV file.

For each line item, 
  loaded: — · offered: invoice-organizer, liteparse, python-executor, ap-processor · judge: pdf, pdf--openai, liteparse · missed: liteparse
  Extracting data from PDF and scanned invoices needs a parsing/OCR skill such as liteparse or pdf.
- **business-03** (business, judge: helpful) I'm a sole trader in the UK and I'm about to start my Self Assessment tax return. Give me a practical checklist of the records and documents
  loaded: — · offered: discernment-nudge · judge: tax-season-organizer
  tax-season-organizer is US-focused, so it doesn't fit UK Self Assessment. A general answer is fine.
- **business-04** (business, judge: none) Draft a short outreach email to independent bookstores asking them to stock our greeting cards. Keep it under 150 words, warm and profession
  loaded: outreach-composer, draft-outreach · offered: draft-content, content-creation, lark-mail · judge: —
  A simple templated email. These skills assume CRM, mail connectors and prospect research, so they add little.
- **business-05** (business, judge: helpful) Help me clean up duplicate contacts in our CRM. I'll share an export of the records (CSV or pasted rows). Find the duplicate pairs and, for 
  loaded: — · offered: xlsx, explore-data, crm-autopilot · judge: crm-hygiene-check, xlsx
  Pasted rows with recommendations only. A strong assistant handles this; crm-hygiene-check audits a different issue (missing fields and stale dates, not duplicates).
- **business-18** (business, judge: helpful) I need a polite but firm payment reminder I can send to clients whose invoices are more than 30 days overdue. Please draft it as an email wi
  loaded: draft-response · offered: invoice-chase, outreach-composer, lark-mail · judge: invoice-chase · missed: invoice-chase
  draft-response is generic customer-reply guidance. invoice-chase targets overdue-invoice reminders and tone tiers directly.
- **business-23** (business, judge: helpful) We need a customer support escalation policy covering three situations: billing problems, outages, and angry customers. Please draft it as a
  loaded: process-doc · offered: documentation · judge: customer-escalation, runbook, incident-response · missed: customer-escalation
  process-doc helps with the SOP structure. customer-escalation fits the escalation domain more directly.
- **business-24** (business, judge: helpful) Help me estimate the true, fully loaded annual cost of hiring my first employee in California. I want a realistic number rather than just th
  loaded: discernment-nudge · offered: — · judge: xlsx, comp-analysis
  Domain knowledge task. No skill in the catalog specifically covers California payroll costs.
- **business-29** (business, judge: none) Create a referral program for my cleaning company. I want a simple reward structure and clear eligibility rules that I can publish to custom
  loaded: compliance-check · offered: — · judge: —
  Only a light local-rules note is needed. A full compliance check is overkill.
- **data-01** (data, judge: helpful) Write a SQL query that finds customers who placed an order last quarter but haven't placed any order this quarter.

Assumptions to state, an
  loaded: — · offered: — · judge: write-query, sql-queries
  A standard SQL anti-join that a strong assistant writes well. The SQL skills would be optional.
- **data-02** (data, judge: helpful) I need you to clean a CSV file. The dates are in three different formats, and some of the amount values have currency symbols. Look for the 
  loaded: — · offered: — · judge: xlsx, explore-data
  Routine pandas cleaning; no skill needed.
- **data-05** (data, judge: helpful) Please create a Jupyter notebook that explores the bike share dataset in my working directory and saves the charts it produces. Start by loc
  loaded: — · offered: — · judge: jupyter-notebook, exploratory-data-analysis, create-viz, seaborn · missed: jupyter-notebook
  Creating a notebook benefits from the jupyter-notebook skill's templates and helper script.
- **data-12** (data, judge: helpful) I need a dbt model that gives me daily recurring revenue (MRR/ARR-style, expressed per day) from our subscription data, including cancellati
  loaded: — · offered: write-query, sql-queries · judge: sql-queries, write-query
  No dbt-specific skill exists. The SQL skills would be marginal.
- **data-19** (data, judge: helpful) I need a weekly operations report built from these shipment logs, covering late deliveries and their most common causes.

First inspect the 
  loaded: report-builder · offered: explore-data, analyze, xlsx, report-pack · judge: build-dashboard, create-viz, xlsx, data-visualization--anthropics
  report-builder targets connector-based SMB reports. The task is a script-plus-report; a general approach works.
- **ml-02** (ml, judge: helpful) I want to build an embedding search index over our product descriptions and evaluate how well it works using example queries that I'll provi
  loaded: — · offered: — · judge: train-sentence-transformers, transformers
  Standard embedding and FAISS work. A strong assistant can do it unaided.
- **ml-06** (ml, judge: helpful) I want an evaluation set for our document Q&A system. It should include questions the documents can't answer, so I can check that the system
  loaded: google-agents-cli-eval · offered: — · judge: markitdown, liteparse, pdf · misleading: google-agents-cli-eval
  ADK-agent-specific eval methodology doesn't fit building a generic document Q&A dataset.
- **ml-07** (ml, judge: helpful) I need help balancing a dataset without letting copies of the same sample end up in both train and test. I'll point you to the data in the w
  loaded: exploratory-data-analysis · offered: explore-data · judge: scikit-learn · missed: scikit-learn
  EDA skill covers leakage audits somewhat, but the core work is a group-aware stratified split and balancing, which fit scikit-learn better.
- **ml-09** (ml, judge: helpful) I have a local language model and I want to quantize it, then measure how much answer quality changes.

First, inspect the working directory
  loaded: — · offered: — · judge: huggingface-local-models, transformers, hf-mem · missed: huggingface-local-models
  Nothing was loaded. GGUF quant selection and llama.cpp guidance would materially help with local quantization.
- **ml-14** (ml, judge: helpful) I want to build a reranking experiment for our search results, using the relevance judgments in the file I've provided.

First, find the jud
  loaded: — · offered: train-sentence-transformers · judge: train-sentence-transformers, statistical-analysis, scikit-learn
  Nothing was loaded. A strong agent can handle IR eval and reranking, so no skill is clearly essential.
- **ml-15** (ml, judge: none) My GPU runs out of memory partway through training. I want you to profile memory usage and suggest a change that keeps the effective batch s
  loaded: optimize-for-gpu · offered: safe-debug, debugging-and-error-recovery · judge: — · misleading: optimize-for-gpu
  That skill accelerates CPU-bound scientific Python with RAPIDS, not PyTorch training OOM debugging. It points the wrong way.
- **science-02** (science, judge: helpful) I want to reproduce the main figure (the primary results figure, likely Figure 1 or 2; confirm which one you're targeting) from a paper usin
  loaded: ai-research-reproduction · offered: scientific-visualization, python-executor, data-visualization--anthropics · judge: pdf, scientific-visualization, matplotlib · missed: scientific-visualization · misleading: ai-research-reproduction
  It is a deep-learning repo reproduction workflow, not a figure reproduction from a dataset, so it would misdirect the effort.
- **science-01** (science, judge: helpful) I need you to analyze my qPCR results using the controls described in my experiment notes. Start by finding the qPCR data files and the expe
  loaded: — · offered: python-executor, statistical-analysis, statistical-analysis--anthropics · judge: statistical-analysis, scientific-visualization, matplotlib
  Nothing was loaded. Statistical-analysis could help, but a strong agent handles ddCq well, so the gap is acceptable.
- **science-03** (science, judge: essential) Build a bioinformatics workflow that aligns my RNA-seq reads and produces gene count tables. Start by looking in the working directory for t
  loaded: bulk-rnaseq · offered: nextflow, nextflow-development · judge: nextflow, bulk-rnaseq, nextflow-development · missed: nextflow
  bulk-rnaseq covers counts and strandedness well. A Nextflow/Snakemake skill would help with the workflow implementation itself.
- **science-06** (science, judge: helpful) Fit a dose-response curve to our assay data and report the IC50 with uncertainty. First find the data file(s) in the working directory and s
  loaded: — · offered: statistical-analysis, python-executor, uncertainty-and-units · judge: statistical-analysis, scientific-visualization, matplotlib
  A 4PL fit with scipy is standard work, so the empty set is acceptable.
- **science-10** (science, judge: helpful) Please help me balance the chemical equations and verify the molar quantities in my reaction worksheet.

First, locate and read the workshee
  loaded: — · offered: xlsx · judge: xlsx, sympy, docx
  The worksheet format is unknown, so xlsx is optional. Chemistry balancing is doable without a skill.
- **devops-01** (devops, judge: helpful) Please add a GitHub Actions workflow to this repository that runs our tests on every pull request.

First inspect the repo to identify the l
  loaded: — · offered: — · judge: ci-cd-and-automation
  A GitHub Actions test workflow is routine. ci-cd-and-automation would be mildly useful but is not essential.
- **devops-13** (devops, judge: none) Our disk filled up overnight and I need to understand why. Please investigate what's growing and propose a retention policy. Do not delete, 
  loaded: investigate-first · offered: debugging-and-error-recovery · judge: —
  It supports a read-only, evidence-ranked investigation before any changes, which fits the request.
- **devops-15** (devops, judge: none) I need to find out why the certificate on our staging environment isn't renewing automatically. Please investigate and tell me the root caus
  loaded: investigate-first · offered: debugging-and-error-recovery, debug · judge: —
  It supports diagnosing before editing with ranked hypotheses, which fits the cert renewal investigation.
- **devops-16** (devops, judge: none) I want to add a manual deployment approval step before the production job in our GitLab CI pipeline. Please update the `.gitlab-ci.yml` (and
  loaded: ci-cd-and-automation · offered: — · judge: —
  It is generic CI/CD guidance with nothing GitLab-specific. Harmless, but it adds little.
- **security-02** (security, judge: helpful) Please scan this repository for committed secrets and tell me what needs to be rotated.

Check both the current working tree and the full gi
  loaded: — · offered: — · judge: security-review, security-best-practices
  No dedicated secret-scanning skill exists. A strong agent can run gitleaks/trufflehog unaided.
- **security-03** (security, judge: helpful) I want you to review our dependency audit results and prioritize the findings that are actually reachable in this app, rather than just rank
  loaded: supply-chain-risk-auditor, trailmark · offered: vulnerability-triage-brocards, trailmark-finding-triage, security-and-hardening · judge: supply-chain-risk-auditor, trailmark-finding-triage, fp-check · missed: trailmark-finding-triage
  The auditor gives advisories. Trailmark supports reachability tracing, and finding-triage targets per-finding reachability more directly.
- **security-07** (security, judge: helpful) I want you to review the IAM permissions for our deployment role and reduce them to what it actually needs (least privilege).

First, find w
  loaded: — · offered: iam-helper-for-troubleshooting · judge: security-best-practices, security-review
  IAM least-privilege review is doable by a strong agent. The catalog's IAM skills are GCP-specific.
- **security-09** (security, judge: helpful) I want you to add audit logging for changes to user roles, and make sure it never records tokens or passwords.

First, explore the codebase 
  loaded: observability-and-instrumentation · offered: trailmark, audit-context-building, security-and-hardening, secret-serialization · judge: secret-serialization, observability-and-instrumentation, security-and-hardening · missed: secret-serialization
  It helps with the logging setup, but secret-serialization targets the core no-tokens-in-logs requirement directly.
- **security-14** (security, judge: helpful) Please validate the permissions on our signed download links. The intended behavior is that a link exposes only the requested file, and only
  loaded: security-and-hardening, security-best-practices · offered: trailmark, codeql, semgrep · judge: security-review, constant-time-analysis, sharp-edges · missed: constant-time-analysis
  Generic security skills fit the audit. Constant-time comparison is a key item, so a dedicated timing skill would add value.
- **debug-03** (debug, judge: helpful) This React component keeps rerendering even when its props haven't changed. Please find out why and fix it.

First find the component and wh
  loaded: investigate-first · offered: vercel-react-best-practices, browser-testing-with-devtools, debug, debugging-and-error-recovery · judge: vercel-react-best-practices, systematic-debugging, performance-optimization · missed: vercel-react-best-practices
  Investigation fits, but React rerender expertise would materially help here.
- **debug-04** (debug, judge: helpful) Our Playwright checkout test fails about one run in ten, and I need to find and fix the root cause of the flakiness. Please don't just incre
  loaded: investigate-first, systematic-debugging, debugging-and-error-recovery · offered: test-anti-patterns, debug, webapp-testing, playwright-interactive · judge: systematic-debugging, playwright, webapp-testing · missed: playwright
  Debugging process is covered. A Playwright-specific skill would help with tracing and repeat-each runs. The third debug skill is redundant.
- **everyday-08** (everyday, judge: none) I need a unit test for this clamp function. Please find it (the one I have open or selected; ask me if there are several candidates) and wri
  loaded: code-testing-agent · offered: test-driven-development--addyosmani · judge: —
  A simple clamp unit test needs no skill. This heavy pipeline adds little.
- **everyday-31** (everyday, judge: none) Add a test for an empty input to the `slugify` function. Find where `slugify` is defined and where its existing tests live, then follow the 
  loaded: code-testing-agent · offered: test-driven-development--addyosmani · judge: —
  One trivial test needs no skill. The pipeline is overkill but harmless.
- **media-04** (media, judge: none) I want a short looping GIF made from the moment in the attached video where the cat jumps onto the chair.

Steps and requirements:
- Find th
  loaded: python-executor · offered: slack-gif-creator, media-use · judge: —
  Local ffmpeg is enough. A remote sandbox adds little and complicates the file handling.
- **media-05** (media, judge: none) I want the background hum removed from the attached podcast clip, without making the voices sound metallic or processed.

Approach:
- First 
  loaded: python-executor · offered: — · judge: —
  A remote sandbox isn't needed; local Python or ffmpeg can do the notch filtering. It adds little, though it's harmless.
- **media-13** (media, judge: helpful) I need a simple animation of the moon's phases for a school presentation. Please create it so it's clear and easy to understand for a genera
  loaded: — · offered: — · judge: motion-graphics, hyperframes
  A strong agent can script this animation with matplotlib or HTML. Motion skills would be optional, not clearly better.
- **media-14** (media, judge: none) I want to share a dashcam video and need the license plates blurred first so they can't be read. Please process the video I point you to and
  loaded: python-executor · offered: — · judge: —
  Plate blurring should run locally with OpenCV. A remote sandbox adds little and may complicate local file access.
- **writing-06** (writing, judge: none) Write a short announcement, around 80–120 words, telling staff that our office is moving next month. Today is 2026-10-06, so "next month" me
  loaded: internal-comms · offered: draft-content, stakeholder-update · judge: —
  Fits topically, but a short announcement email needs no company format templates.
- **writing-08** (writing, judge: none) I'm going to paste our current onboarding instructions. Please rewrite them so a nontechnical customer can follow them on their own without 
  loaded: documentation · offered: kb-article, brand-guidelines--getsentry, ux-copy · judge: —
  Generic tech-docs skill. The plain-language rewrite is easy without it; kb-article would be no clear gain.
- **writing-11** (writing, judge: none) Write a concise README.md for this command line tool. Start by looking through the project (entry point, package or build files, any existin
  loaded: documentation · offered: — · judge: —
  README guidance is generic; a strong agent writes a concise README unaided.
- **writing-14** (writing, judge: none) Write three subject lines for this newsletter. I'll paste the newsletter content. If it isn't included, ask me for it first.

Requirements:

  loaded: draft-content · offered: email-design, content-creation · judge: —
  Subject-line options are covered in principle, but the task is trivial without the skill.
- **productivity-03** (productivity, judge: helpful) Find a 45-minute slot next week when everyone on this invite is free. Today is Tuesday, October 6, 2026, so "next week" means Monday, Octobe
  loaded: lark-calendar · offered: schedule-meeting · judge: schedule-meeting · missed: schedule-meeting · misleading: lark-calendar
  Lark/Feishu is the wrong platform unless the user uses it. schedule-meeting covers Google and Outlook availability.
- **apps-10** (apps, judge: helpful) I want you to build a desktop utility that previews batch filename changes before applying them. The core idea: I pick a folder (or drag in 
  loaded: — · offered: — · judge: test-driven-development, verification-before-completion, incremental-implementation
  A strong programmer can handle this. Testing skills would be optional.
- **productivity-05** (productivity, judge: none) I need a realistic task plan to finish my dissertation chapter by this Friday. Today is Tuesday, October 6, 2026, so Friday is October 9. Th
  loaded: planning-and-task-breakdown · offered: interview-me · judge: —
  Aimed at breaking down software work. A dissertation plan doesn't need it, but it's harmless.
- **productivity-08** (productivity, judge: helpful) I'm going to give you transcripts from several meetings. Please go through them and summarize what I still owe other people.

For each commi
  loaded: — · offered: — · judge: meeting-insights-analyzer
  A careful reading of the transcripts is enough. No skill is needed.
- **productivity-10** (productivity, judge: helpful) Our team wiki has become a mess, and I'd like you to propose a better structure and point out what should be cleaned up. I'll share an expor
  loaded: file-organizer · offered: — · judge: notion-research-documentation, file-organizer
  It's about local files, not a wiki's information architecture, so it adds little.
- **apps-03** (apps, judge: helpful) I want a browser-based word game where the player guesses a hidden word from progressively clearer clues. Please build it in the current wor
  loaded: — · offered: — · judge: webapp-testing, frontend-ui-engineering
  A simple vanilla JS game. webapp-testing is optional for the requested tests.
