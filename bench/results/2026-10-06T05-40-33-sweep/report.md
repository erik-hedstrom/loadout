# Sweep: 2026-10-06T05-40-33-sweep

315 requests, 1262 skills in the library, judge opus.
Routing cost $0.3350; mean 0.86 s per decision.
Coverage: every request judged blind; every disputed row adjudicated.

| | All |
|---|---:|
| n | 315 |
| needed | 189 |
| usefulLoaded | 74% (139/189) |
| usefulAvailable | 80% (151/189) |
| helpfulLoadedOnEssential | 96% (27/28) |
| missedBetter | 9% (29/315) |
| quietWhenNone | 83% (105/126) |
| loadPrecision | 83% (181/218) |
| misleadingLoads | 2% (4/218) |
| injectPrecision | 84% (46/55) |
| avgLoaded | 0.69 |

| Category | n | needs a skill | useful loaded | useful available | quiet when none | load precision | misleading loads | missed better |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| web | 25 | 21 | 71% (15/21) | 71% (15/21) | 50% (2/4) | 88% (22/25) | 4% (1/25) | 16% (4/25) |
| backend | 20 | 7 | 43% (3/7) | 57% (4/7) | 77% (10/13) | 40% (4/10) | 0% (0/10) | 20% (4/20) |
| integrations | 20 | 7 | 29% (2/7) | 29% (2/7) | 92% (12/13) | 75% (3/4) | 0% (0/4) | 15% (3/20) |
| documents | 30 | 30 | 93% (28/30) | 97% (29/30) | — | 94% (30/32) | 0% (0/32) | 13% (4/30) |
| business | 30 | 25 | 84% (21/25) | 92% (23/25) | 60% (3/5) | 81% (26/32) | 0% (0/32) | 3% (1/30) |
| data | 20 | 18 | 72% (13/18) | 78% (14/18) | 100% (2/2) | 85% (17/20) | 5% (1/20) | 5% (1/20) |
| ml | 15 | 9 | 44% (4/9) | 56% (5/9) | 83% (5/6) | 80% (4/5) | 20% (1/5) | 7% (1/15) |
| science | 10 | 9 | 33% (3/9) | 89% (8/9) | 100% (1/1) | 75% (3/4) | 0% (0/4) | 30% (3/10) |
| devops | 20 | 9 | 78% (7/9) | 78% (7/9) | 73% (8/11) | 70% (7/10) | 0% (0/10) | 5% (1/20) |
| security | 15 | 15 | 80% (12/15) | 80% (12/15) | — | 93% (14/15) | 0% (0/15) | 20% (3/15) |
| debug | 15 | 15 | 93% (14/15) | 93% (14/15) | — | 97% (29/30) | 0% (0/30) | 13% (2/15) |
| everyday | 35 | 0 | — | — | 91% (32/35) | 33% (1/3) | 0% (0/3) | 0% (0/35) |
| media | 15 | 9 | 78% (7/9) | 89% (8/9) | 67% (4/6) | 85% (11/13) | 8% (1/13) | 7% (1/15) |
| writing | 15 | 5 | 100% (5/5) | 100% (5/5) | 70% (7/10) | 63% (5/8) | 0% (0/8) | 0% (0/15) |
| productivity | 10 | 7 | 57% (4/7) | 57% (4/7) | 67% (2/3) | 67% (4/6) | 0% (0/6) | 0% (0/10) |
| apps | 10 | 3 | 33% (1/3) | 33% (1/3) | 100% (7/7) | 100% (1/1) | 0% (0/1) | 10% (1/10) |
| questions | 10 | 0 | — | — | 100% (10/10) | — | — | 0% (0/10) |

## Misses and misleading loads

- **web-17** (web, judge: none) I'd like to add breadcrumbs to our documentation site. First look at how the site is built (static site generator or framework, how pages an
  loaded: frontend-ui-engineering · offered: — · judge: —
  Generic UI guidance. A strong agent builds accessible breadcrumbs without it. Harmless.
- **web-20** (web, judge: helpful) Our settings page is one very long scrolling page. I'd like to turn it into tabs, one per section, while keeping direct links to each sectio
  loaded: plan-ui-change · offered: core · judge: frontend-ui-engineering, webapp-testing, accessibility-review · missed: frontend-ui-engineering · misleading: plan-ui-change
  plan-ui-change is Blazor-specific, but the framework is unknown. Generic frontend/a11y guidance is the better fit.
- **web-01** (web, judge: helpful) I want a simple website for my dog grooming business. The two main things visitors need to do are see my prices and request an appointment.

  loaded: — · offered: — · judge: frontend-design, netlify-deploy, deploy-to-vercel
  A simple static site is doable without skills. Design or deploy skills would be optional.
- **web-04** (web, judge: helpful) I'd like keyboard navigation added to this dropdown, and I want Escape to close it. Please find the dropdown component in the codebase and c
  loaded: — · offered: test-driven-development--addyosmani, investigate-first · judge: frontend-ui-engineering, accessibility-review, webapp-testing · missed: frontend-ui-engineering
  Doable without skills, but an ARIA/keyboard-pattern skill would help. Mild miss.
- **web-09** (web, judge: helpful) I have a data table in this project that is hard to use on mobile screens. Please make it usable on small viewports without hiding any of it
  loaded: — · offered: — · judge: frontend-ui-engineering
  Nothing loaded. A responsive accessible table is a standard task, so frontend-ui-engineering would only add marginal value.
- **web-10** (web, judge: none) Please add a dark mode toggle to my site and make it remember the visitor's choice on their next visit.

Requirements:
- Add an accessible t
  loaded: frontend-ui-engineering · offered: — · judge: —
  Dark mode with a no-flash script is well-known work. The skill adds little but does no harm.
- **web-14** (web, judge: helpful) The navbar jumps when I open the menu. Please find the cause and fix it so opening and closing is smooth.

What I need:
1. Find the navbar a
  loaded: — · offered: — · judge: investigate-first, frontend-ui-engineering, systematic-debugging, webapp-testing
  A strong programmer can debug a layout-shift bug. Skills would be optional.
- **web-15** (web, judge: helpful) Create a landing page for our online ceramics class using the photos in public/images.

Start by looking at public/images. List the photos y
  loaded: — · offered: — · judge: landing-page-design, frontend-design, design-taste-frontend, frontend-ui-engineering, web-perf · missed: frontend-ui-engineering
  A landing page would benefit from frontend/design guidance. Mild miss.
- **web-16** (web, judge: helpful) Our product page has too much going on. Please simplify the layout while keeping the size guide, reviews, and delivery estimate easy to acce
  loaded: frontend-ui-engineering · offered: impeccable, redesign-existing-projects, plan-ui-change · judge: redesign-existing-projects, frontend-design, frontend-ui-engineering, accessibility-review, design-critique · missed: redesign-existing-projects
  A simplification redesign of an existing page fits redesign-existing-projects.
- **backend-02** (backend, judge: helpful) We need a password reset feature in our FastAPI app. Reset links must expire and must only work once.

First inspect the existing app: user 
  loaded: — · offered: — · judge: security-and-hardening, security-best-practices · missed: security-and-hardening
  A security-sensitive auth flow benefits from hardening guidance.
- **backend-01** (backend, judge: none) Add cursor-based pagination to the orders endpoint.

First look at the existing orders endpoint, its framework, data layer, and any current 
  loaded: api-and-interface-design, implement · offered: incremental-implementation, sql-queries · judge: —
  The spec is already detailed. Generic API-design and implement workflows add little to keyset pagination.
- **backend-03** (backend, judge: helpful) Stripe sometimes sends the same webhook twice, and we're creating duplicate subscriptions. Please make webhook processing idempotent.

First
  loaded: — · offered: test-driven-development--addyosmani, supabase-postgres-best-practices, surgical-patch, debugging-and-error-recovery · judge: investigate-first, systematic-debugging, supabase-postgres-best-practices
  Idempotency is standard engineering. Optional debugging skills only.
- **backend-05** (backend, judge: none) Move PDF generation out of the request handler and into a background queue.

First find the handler that generates PDFs, what library it use
  loaded: implement · offered: planning-and-task-breakdown · judge: —
  A generic implementation workflow. The detailed spec already covers the queue migration.
- **backend-07** (backend, judge: helpful) Can you implement refresh token rotation in our Express auth service?

First read the existing auth code: how access and refresh tokens are 
  loaded: implement, doubt-driven-development · offered: test-driven-development--addyosmani · judge: security-and-hardening · missed: security-and-hardening
  Doubt-driven review suits security-sensitive auth. Security-hardening guidance would be more directly useful. Generic implement adds little.
- **backend-11** (backend, judge: helpful) I need a Django API for recording maintenance tickets and assigning them to technicians. Please build it, using Django REST Framework unless
  loaded: api-and-interface-design · offered: incremental-implementation · judge: django-access-review · missed: django-access-review
  Generic API design is only marginal. The Django access-control review fits the permission and IDOR requirements better.
- **backend-19** (backend, judge: none) Please implement retry handling for our failed delivery jobs, with a retry limit and a place where I can inspect jobs that never succeed.

F
  loaded: implement · offered: incremental-implementation, test-driven-development--addyosmani · judge: —
  Ordinary backend work. The generic implement skill is harmless but adds little.
- **backend-20** (backend, judge: helpful) We need tenant isolation in this Rails app. Please review the query paths and make sure one company can't read another company's records.

C
  loaded: — · offered: find-bugs, audit-context-building, codeql, supabase-postgres-best-practices · judge: security-review, variant-analysis · missed: security-review
  A tenant-isolation audit is an authorization security review. Security-review or variant-analysis would help.
- **integrations-04** (integrations, judge: none) I want a command-line tool that lists my open Linear issues and lets me change their status. Please build it in the current working director
  loaded: cli-creator · offered: source-driven-development · judge: —
  CLI creation guidance with auth handling fits reasonably, though it is Codex-oriented.
- **integrations-07** (integrations, judge: helpful) Can you build an MCP server around our read-only inventory API? Please create it in the current working directory.

I haven't given you the 
  loaded: — · offered: source-driven-development, planning-and-task-breakdown · judge: mcp-builder · missed: mcp-builder
  Building an MCP server is exactly what mcp-builder covers.
- **integrations-09** (integrations, judge: helpful) I need a GitHub Action that posts a short release summary to our team's Slack channel whenever we publish a release. Please add it to this r
  loaded: — · offered: — · judge: gha-security-review, ci-cd-and-automation · missed: gha-security-review
  Preventing script injection in the workflow is the core concern, and GHA security guidance covers it.
- **integrations-10** (integrations, judge: helpful) I want a support chatbot for our website that answers questions using our help center articles, and hands off to a human when it can't answe
  loaded: ai-rag-pipeline · offered: — · judge: claude-api, ai-rag-pipeline
  This skill is about inference.sh web-search RAG, not indexing a local help center. Marginal fit.
- **integrations-14** (integrations, judge: helpful) I want to build an agent that checks incoming purchase orders against our catalog and drafts a reply for human review.

Flow:
1. Take an inc
  loaded: — · offered: — · judge: pdf, claude-api · missed: pdf
  Extracting line items from PDF purchase orders benefits from the PDF skill.
- **integrations-18** (integrations, judge: helpful) I want a Microsoft Teams bot that answers office location and Wi-Fi questions from a maintained FAQ.

Requirements:
- Users ask in personal 
  loaded: — · offered: source-driven-development, spec-driven-development · judge: microsoft-foundry
  No skill specific to Teams bots. Microsoft-foundry is a weak fit, so null is reasonable.
- **documents-03** (documents, judge: helpful) Please update my resume for the attached data analyst job posting. The result must fit on one page.

I'll attach my current resume and the j
  loaded: tailored-resume-generator · offered: docx · judge: docx, tailored-resume-generator, pdf · missed: docx
  Tailoring guidance helps, but the docx skill is needed to edit the file and check it stays one page.
- **documents-08** (documents, judge: essential) I have a scanned copy of a lease that I need converted into editable text. Please find the scan in my working directory (if there are severa
  loaded: liteparse · offered: pdf, azure-ai · judge: docx, pdf, liteparse, pdf--openai · missed: docx
  Liteparse handles OCR well. The .docx output still needs the docx skill to keep the structure.
- **documents-17** (documents, judge: helpful) I need a rent receipt for September, using the payment details I'm providing with this request.

Please include:
- The receipt title, the da
  loaded: — · offered: pdf, docx, pdf--openai · judge: pdf, docx · missed: pdf
  PDF output is required, with an optional docx version. The PDF skill would help.
- **documents-24** (documents, judge: essential) I need you to extract the line items from the supplier invoices I've attached and combine them into a single CSV file.

For each line item, 
  loaded: — · offered: invoice-organizer, ap-processor, xlsx · judge: pdf, pdf--openai, liteparse · missed: pdf
  Extracting from PDF and scanned invoices needs PDF or OCR tooling.
- **business-03** (business, judge: helpful) I'm a sole trader in the UK and I'm about to start my Self Assessment tax return. Give me a practical checklist of the records and documents
  loaded: — · offered: discernment-nudge · judge: tax-season-organizer
  UK Self Assessment; tax-season-organizer is US-federal and would mislead. No load is correct.
- **business-04** (business, judge: none) Draft a short outreach email to independent bookstores asking them to stock our greeting cards. Keep it under 150 words, warm and profession
  loaded: draft-outreach, outreach-composer · offered: draft-content, brand-voice-enforcement · judge: —
  Simple template email; CRM/sequence machinery adds little, though drafting guidance is harmless.
- **business-05** (business, judge: helpful) Help me clean up duplicate contacts in our CRM. I'll share an export of the records (CSV or pasted rows). Find the duplicate pairs and, for 
  loaded: — · offered: explore-data, xlsx, crm-autopilot · judge: crm-hygiene-check, xlsx
  Contact dedup recommendations from pasted data; crm-hygiene-check targets opportunities. No skill needed.
- **business-22** (business, judge: helpful) I'm sharing ad results from our campaigns. Please analyze them and tell me which campaigns deserve more budget, and be clear about how uncer
  loaded: ad-manager · offered: performance-report, statistical-analysis--anthropics, statistical-analysis, analyze · judge: statistical-analysis--anthropics, analyze, ad-manager, validate-data · missed: statistical-analysis--anthropics
  ad-manager is connector-focused; core need is uncertainty quantification, which the statistical skill covers.
- **business-24** (business, judge: helpful) Help me estimate the true, fully loaded annual cost of hiring my first employee in California. I want a realistic number rather than just th
  loaded: discernment-nudge · offered: — · judge: xlsx, comp-analysis
  Cost estimate in chat; follow-up nudge adds little but harmless.
- **business-29** (business, judge: none) Create a referral program for my cleaning company. I want a simple reward structure and clear eligibility rules that I can publish to custom
  loaded: content-creation · offered: — · judge: —
  Mostly program design; copy portion is minor and easy without skill.
- **data-01** (data, judge: helpful) Write a SQL query that finds customers who placed an order last quarter but haven't placed any order this quarter.

Assumptions to state, an
  loaded: — · offered: — · judge: write-query, sql-queries
  Standard anti-join SQL; strong programmer handles it unaided.
- **data-02** (data, judge: helpful) I need you to clean a CSV file. The dates are in three different formats, and some of the amount values have currency symbols. Look for the 
  loaded: — · offered: — · judge: xlsx, explore-data
  Routine pandas cleaning; no skill required.
- **data-03** (data, judge: helpful) I want a dashboard that shows weekly signups, activation rate, and retention, each broken down by acquisition channel.

Before building anyt
  loaded: build-dashboard, report-builder · offered: explore-data · judge: build-dashboard, write-query, data-visualization--anthropics · misleading: report-builder
  build-dashboard fits; report-builder pushes XLSX recurring-report pipeline instead of a dashboard.
- **data-05** (data, judge: helpful) Please create a Jupyter notebook that explores the bike share dataset in my working directory and saves the charts it produces. Start by loc
  loaded: — · offered: — · judge: jupyter-notebook, exploratory-data-analysis, create-viz, seaborn · missed: jupyter-notebook
  Creating a notebook from scratch; jupyter-notebook templates and helper script directly apply.
- **data-12** (data, judge: helpful) I need a dbt model that gives me daily recurring revenue (MRR/ARR-style, expressed per day) from our subscription data, including cancellati
  loaded: — · offered: incremental-implementation · judge: sql-queries, write-query
  dbt modeling following repo conventions; no catalog skill clearly needed.
- **data-19** (data, judge: helpful) I need a weekly operations report built from these shipment logs, covering late deliveries and their most common causes.

First inspect the 
  loaded: report-builder · offered: build-agent, explore-data, analyze, xlsx · judge: build-dashboard, create-viz, xlsx, data-visualization--anthropics
  Recurring report idea aligns, but user wants a script from log files, not connectors.
- **ml-02** (ml, judge: helpful) I want to build an embedding search index over our product descriptions and evaluate how well it works using example queries that I'll provi
  loaded: — · offered: — · judge: train-sentence-transformers, transformers
  Simple embedding search plus IR metrics; doable without a skill.
- **ml-06** (ml, judge: helpful) I want an evaluation set for our document Q&A system. It should include questions the documents can't answer, so I can check that the system
  loaded: — · offered: — · judge: markitdown, liteparse, pdf
  Document formats are unknown. A strong agent can build a QA eval set without a skill. Parsing skills would only be marginally useful.
- **ml-09** (ml, judge: helpful) I have a local language model and I want to quantize it, then measure how much answer quality changes.

First, inspect the working directory
  loaded: — · offered: get-available-resources, explore-run · judge: huggingface-local-models, transformers, hf-mem · missed: huggingface-local-models
  This skill covers GGUF quant selection and llama.cpp, which applies directly to comparing quantization levels.
- **ml-13** (ml, judge: helpful) I want to measure precision and recall separately for each language in our moderation dataset.

First, look in the working directory for the
  loaded: — · offered: jupyter-notebook, analyze, xlsx · judge: scikit-learn, statistical-analysis, data-visualization--anthropics
  Per-group metrics with a bootstrap are routine. Statistics and visualization skills would add little.
- **ml-14** (ml, judge: helpful) I want to build a reranking experiment for our search results, using the relevance judgments in the file I've provided.

First, find the jud
  loaded: — · offered: python-executor, train-sentence-transformers · judge: train-sentence-transformers, statistical-analysis, scikit-learn
  Reranking evaluation is doable without a skill. The sentence-transformers skill would add a little for cross-encoders.
- **ml-15** (ml, judge: none) My GPU runs out of memory partway through training. I want you to profile memory usage and suggest a change that keeps the effective batch s
  loaded: optimize-for-gpu · offered: safe-debug, debug, debugging-and-error-recovery · judge: — · misleading: optimize-for-gpu
  This skill is about porting CPU workloads to RAPIDS, not debugging PyTorch out-of-memory errors in training. It would push the work the wrong way.
- **science-01** (science, judge: helpful) I need you to analyze my qPCR results using the controls described in my experiment notes. Start by finding the qPCR data files and the expe
  loaded: python-executor · offered: statistical-analysis, statistical-analysis--anthropics · judge: statistical-analysis, scientific-visualization, matplotlib · missed: statistical-analysis
  Sandbox execution isn't needed for local files. A statistics skill would help with test selection and reporting.
- **science-03** (science, judge: essential) Build a bioinformatics workflow that aligns my RNA-seq reads and produces gene count tables. Start by looking in the working directory for t
  loaded: bulk-rnaseq · offered: nextflow, planning-and-task-breakdown, nextflow-development · judge: nextflow, bulk-rnaseq, nextflow-development · missed: nextflow
  bulk-rnaseq covers STAR, strandedness and counts. The Nextflow skill would materially help with authoring the workflow.
- **science-02** (science, judge: helpful) I want to reproduce the main figure (the primary results figure, likely Figure 1 or 2; confirm which one you're targeting) from a paper usin
  loaded: — · offered: ai-research-reproduction, scientific-visualization, python-executor, data-visualization--anthropics · judge: pdf, scientific-visualization, matplotlib
  A visualization skill might help a little. Nothing here is essential.
- **science-05** (science, judge: helpful) Compare the protein sequences I've provided and mark the conserved regions. Look in the working directory for the sequence files (FASTA or s
  loaded: — · offered: biopython, scikit-bio · judge: phylogenetics, biopython · missed: phylogenetics
  This skill covers MAFFT alignment workflows. biopython would also have been a reasonable choice.
- **science-06** (science, judge: helpful) Fit a dose-response curve to our assay data and report the IC50 with uncertainty. First find the data file(s) in the working directory and s
  loaded: — · offered: statistical-analysis, python-executor, uncertainty-and-units · judge: statistical-analysis, scientific-visualization, matplotlib
  4PL fitting with scipy is straightforward. Optional skills would add little.
- **science-09** (science, judge: helpful) I'd like you to review our statistical analysis and tell me whether it properly accounts for repeated measurements from the same animal (pse
  loaded: — · offered: statistical-analysis, validate-data, scientific-critical-thinking, statsmodels · judge: statistical-analysis, statsmodels, experimental-design
  A statistics skill could help, but reviewing for pseudoreplication is within general expertise.
- **science-10** (science, judge: helpful) Please help me balance the chemical equations and verify the molar quantities in my reaction worksheet.

First, locate and read the workshee
  loaded: — · offered: — · judge: xlsx, sympy, docx
  The worksheet format is unknown. Stoichiometry checks are general knowledge.
- **devops-01** (devops, judge: helpful) Please add a GitHub Actions workflow to this repository that runs our tests on every pull request.

First inspect the repo to identify the l
  loaded: — · offered: — · judge: ci-cd-and-automation
  A GitHub Actions test workflow is routine. The CI skill would be marginal.
- **devops-13** (devops, judge: none) Our disk filled up overnight and I need to understand why. Please investigate what's growing and propose a retention policy. Do not delete, 
  loaded: investigate-first · offered: discernment-nudge, debugging-and-error-recovery · judge: —
  Read-only diagnosis lines up with it, but the request already specifies the method.
- **devops-12** (devops, judge: helpful) I want structured logging and request IDs across both our API and our background worker, so I can trace a request from the API through to an
  loaded: — · offered: test-driven-development--addyosmani · judge: observability-and-instrumentation · missed: observability-and-instrumentation
  Nothing loaded. observability-and-instrumentation directly covers structured logging, correlation IDs and redaction, and would help with this standard but detailed task.
- **devops-16** (devops, judge: none) I want to add a manual deployment approval step before the production job in our GitLab CI pipeline. Please update the `.gitlab-ci.yml` (and
  loaded: ci-cd-and-automation · offered: — · judge: —
  Generic CI guidance. GitLab manual gates are well known.
- **devops-15** (devops, judge: none) I need to find out why the certificate on our staging environment isn't renewing automatically. Please investigate and tell me the root caus
  loaded: investigate-first · offered: debugging-and-error-recovery, debug · judge: —
  Evidence-first diagnosis fits, but adds little beyond what the request already asks for.
- **security-02** (security, judge: helpful) Please scan this repository for committed secrets and tell me what needs to be rotated.

Check both the current working tree and the full gi
  loaded: — · offered: — · judge: security-review, security-best-practices
  No dedicated secret-scanning skill exists in the catalog. A strong agent can run gitleaks/trufflehog unaided, so loading nothing is acceptable.
- **security-03** (security, judge: helpful) I want you to review our dependency audit results and prioritize the findings that are actually reachable in this app, rather than just rank
  loaded: trailmark · offered: supply-chain-risk-auditor, vulnerability-triage-brocards, trailmark-finding-triage · judge: supply-chain-risk-auditor, trailmark-finding-triage, fp-check · missed: supply-chain-risk-auditor
  Trailmark helps trace reachability. supply-chain-risk-auditor matches the advisory audit directly and should have been loaded too.
- **security-07** (security, judge: helpful) I want you to review the IAM permissions for our deployment role and reduce them to what it actually needs (least privilege).

First, find w
  loaded: — · offered: — · judge: security-best-practices, security-review
  Cloud provider is unknown and no generic IAM least-privilege skill exists. Loading nothing is reasonable.
- **security-09** (security, judge: helpful) I want you to add audit logging for changes to user roles, and make sure it never records tokens or passwords.

First, explore the codebase 
  loaded: observability-and-instrumentation · offered: trailmark, audit-context-building, secret-serialization · judge: secret-serialization, observability-and-instrumentation, security-and-hardening · missed: secret-serialization
  The logging guidance helps. secret-serialization directly covers keeping tokens and passwords out of logs, which is a core requirement.
- **security-14** (security, judge: helpful) Please validate the permissions on our signed download links. The intended behavior is that a link exposes only the requested file, and only
  loaded: security-best-practices · offered: trailmark, semgrep · judge: security-review, constant-time-analysis, sharp-edges · missed: security-review
  Best-practices is generic and language-gated. A systematic security review fits better for a signed-URL audit.
- **debug-02** (debug, judge: helpful) Some of our tests pass locally but fail in CI with a timezone mismatch. Please find the cause and fix it.

Start by getting the failing test
  loaded: — · offered: — · judge: systematic-debugging, debugging-and-error-recovery · missed: systematic-debugging
  A structured debugging method would help, but a timezone fix is manageable without one.
- **debug-03** (debug, judge: helpful) This React component keeps rerendering even when its props haven't changed. Please find out why and fix it.

First find the component and wh
  loaded: investigate-first · offered: browser-testing-with-devtools, debug, frontend-ui-engineering, surgical-patch · judge: vercel-react-best-practices, systematic-debugging, performance-optimization · missed: vercel-react-best-practices
  Evidence-first approach helps. React rerender and memoization guidance directly targets the fix.
- **everyday-08** (everyday, judge: none) I need a unit test for this clamp function. Please find it (the one I have open or selected; ask me if there are several candidates) and wri
  loaded: code-testing-agent · offered: test-driven-development--addyosmani · judge: —
  A heavy test-generation pipeline for one small clamp test. Harmless, but a strong programmer doesn't need it.
- **everyday-23** (everyday, judge: none) The function that writes CSV output isn't escaping commas and quotes correctly, so fields containing them corrupt the file. Please fix it.


  loaded: surgical-patch · offered: test-driven-development--addyosmani, systematic-debugging, xlsx · judge: —
  Matches the user's 'narrow fix, change nothing unrelated, add a regression test' constraints. Not strictly needed.
- **everyday-31** (everyday, judge: none) Add a test for an empty input to the `slugify` function. Find where `slugify` is defined and where its existing tests live, then follow the 
  loaded: code-testing-agent · offered: test-driven-development--addyosmani · judge: —
  Far too much machinery for one empty-input test case.
- **media-01** (media, judge: none) Trim the dead air from the beginning and end of this interview recording. I'll point you to the file. If I haven't, look in the current work
  loaded: media-use · offered: — · judge: — · misleading: media-use
  Built for HyperFrames projects. Trimming silence is a plain ffmpeg task, so this skill would push the agent off course.
- **media-04** (media, judge: none) I want a short looping GIF made from the moment in the attached video where the cat jumps onto the chair.

Steps and requirements:
- Find th
  loaded: slack-gif-creator · offered: — · judge: —
  Aimed at GIFs drawn from scratch for Slack. Its size limits help a little, but this task is cutting a clip from video with ffmpeg.
- **media-10** (media, judge: helpful) I have a screen recording that I want to turn into a polished 30-second demo video. Please edit it down to about 30 seconds total, keeping o
  loaded: — · offered: hyperframes, general-video · judge: hyperframes, general-video, hyperframes-keyframes · missed: hyperframes
  HyperFrames handles eased zoom keyframes and editing an existing recording into a polished demo.
- **media-13** (media, judge: helpful) I need a simple animation of the moon's phases for a school presentation. Please create it so it's clear and easy to understand for a genera
  loaded: — · offered: — · judge: motion-graphics, hyperframes
  A simple code-generated animation is easy without a skill. Motion-graphics skills are optional.
- **writing-08** (writing, judge: none) I'm going to paste our current onboarding instructions. Please rewrite them so a nontechnical customer can follow them on their own without 
  loaded: documentation · offered: kb-article · judge: —
  A plain-language rewrite needs no skill. The documentation skill is broadly related and harmless.
- **writing-11** (writing, judge: none) Write a concise README.md for this command line tool. Start by looking through the project (entry point, package or build files, any existin
  loaded: documentation · offered: — · judge: —
  A concise README is routine. The skill adds a little structure and nothing more.
- **writing-14** (writing, judge: none) Write three subject lines for this newsletter. I'll paste the newsletter content. If it isn't included, ask me for it first.

Requirements:

  loaded: draft-content · offered: email-design, brand-voice-enforcement · judge: —
  Subject lines are a simple task. draft-content mentions subject-line options, which helps marginally.
- **apps-10** (apps, judge: helpful) I want you to build a desktop utility that previews batch filename changes before applying them. The core idea: I pick a folder (or drag in 
  loaded: — · offered: — · judge: test-driven-development, verification-before-completion, incremental-implementation
  A strong engineer can build this small utility without a skill.
- **productivity-05** (productivity, judge: none) I need a realistic task plan to finish my dissertation chapter by this Friday. Today is Tuesday, October 6, 2026, so Friday is October 9. Th
  loaded: planning-and-task-breakdown · offered: interview-me · judge: —
  Written for software task breakdown. A dissertation schedule needs no special guidance.
- **productivity-08** (productivity, judge: helpful) I'm going to give you transcripts from several meetings. Please go through them and summarize what I still owe other people.

For each commi
  loaded: — · offered: update · judge: meeting-insights-analyzer
  Pulling commitments from transcripts is a reading task with no skill needed.
- **productivity-09** (productivity, judge: helpful) Please add study sessions to my calendar, scheduled around my existing classes.

First, read my calendar for the coming weeks so you can see
  loaded: — · offered: planning-and-task-breakdown · judge: lark-calendar
  The calendar provider is unknown, so no catalog skill clearly applies.
- **productivity-10** (productivity, judge: helpful) Our team wiki has become a mess, and I'd like you to propose a better structure and point out what should be cleaned up. I'll share an expor
  loaded: file-organizer · offered: — · judge: notion-research-documentation, file-organizer
  file-organizer targets local filesystem cleanup. It overlaps loosely with duplicate and structure analysis but adds little to a wiki proposal. Mostly reasoning.
- **apps-03** (apps, judge: helpful) I want a browser-based word game where the player guesses a hidden word from progressively clearer clues. Please build it in the current wor
  loaded: — · offered: — · judge: webapp-testing, frontend-ui-engineering · missed: webapp-testing
  The game is plain vanilla JS, but the user asks for tested win and loss rounds. Playwright-based webapp-testing would help verify the game in a real browser.
