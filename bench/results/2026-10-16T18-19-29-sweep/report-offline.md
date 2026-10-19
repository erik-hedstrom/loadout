# Sweep: 2026-10-16T18-19-29-sweep

315 requests; offline scoring, no model calls, $0 scoring cost.
Request generation/expansion: not recorded.
Stored provenance: not recorded (legacy), claude / opus, effort default.
Blind answers reused from bench/results/2026-10-06T02-08-14-sweep/judge-blind.jsonl.
Prior ratings reused from bench/results/2026-10-07T21-34-39-sweep/judge-verdicts.jsonl.
Precision bounds: unrated loads counted not-useful / counted useful, each with a Wilson interval. Other usefulness metrics count known helpful skills only; misleading loads count known misleading ratings only. Missed better: not shown (requires adjudication of the current loaded set).
Routing cost $0.3843; mean 1.02 s per decision.
Coverage: every request judged blind; unrated loads retained in scores.

Percentages include 95% Wilson intervals; load-level intervals do not account for within-request correlation.

| | Dev | Test | All |
|---|---:|---:|---:|
| n | 102 | 213 | 315 |
| needed | 68 | 121 | 189 |
| usefulLoaded | 78% (53/68), 67–86% | 74% (90/121), 66–81% | 76% (143/189), 69–81% |
| usefulAvailable | 82% (56/68), 72–90% | 87% (105/121), 80–92% | 85% (161/189), 79–90% |
| helpfulLoadedOnEssential | 100% (12/12), 76–100% | 94% (15/16), 72–99% | 96% (27/28), 82–99% |
| missedBetter | not shown | not shown | not shown |
| quietWhenNone | 79% (27/34), 63–90% | 82% (75/92), 72–88% | 81% (102/126), 73–87% |
| loadPrecision | 84% (63/75), 74–91% / 85% (64/75), 76–92% | 79% (121/153), 72–85% / 82% (126/153), 76–88% | 81% (184/228), 75–85% / 83% (190/228), 78–88% |
| unratedLoads | 1 | 5 | 6 |
| misleadingLoads | 3% (2/75), 1–9% | 1% (2/153), 0–5% | 2% (4/228), 1–4% |
| injectPrecision | 92% (22/24), 74–98% / 92% (22/24), 74–98% | 79% (22/28), 60–90% / 79% (22/28), 60–90% | 85% (44/52), 72–92% / 85% (44/52), 72–92% |
| avgLoaded | 0.74 | 0.72 | 0.72 |

| Category | n | needs a skill | useful loaded | useful available | quiet when none | load precision | misleading loads | missed better |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| web | 25 | 21 | 67% (14/21), 45–83% | 76% (16/21), 55–89% | 50% (2/4), 15–85% | 83% (19/23), 63–93% / 91% (21/23), 73–98% | 0% (0/23), 0–14% | not shown |
| backend | 20 | 7 | 57% (4/7), 25–84% | 71% (5/7), 36–92% | 92% (12/13), 67–99% | 83% (5/6), 44–97% / 83% (5/6), 44–97% | 0% (0/6), 0–39% | not shown |
| integrations | 20 | 7 | 43% (3/7), 16–75% | 43% (3/7), 16–75% | 85% (11/13), 58–96% | 50% (3/6), 19–81% / 50% (3/6), 19–81% | 0% (0/6), 0–39% | not shown |
| documents | 30 | 30 | 90% (27/30), 74–97% | 100% (30/30), 89–100% | — | 94% (30/32), 80–98% / 94% (30/32), 80–98% | 0% (0/32), 0–11% | not shown |
| business | 30 | 25 | 84% (21/25), 65–94% | 92% (23/25), 75–98% | 40% (2/5), 12–77% | 81% (26/32), 65–91% / 81% (26/32), 65–91% | 0% (0/32), 0–11% | not shown |
| data | 20 | 18 | 67% (12/18), 44–84% | 83% (15/18), 61–94% | 100% (2/2), 34–100% | 89% (16/18), 67–97% / 89% (16/18), 67–97% | 0% (0/18), 0–18% | not shown |
| ml | 15 | 9 | 44% (4/9), 19–73% | 56% (5/9), 27–81% | 83% (5/6), 44–97% | 57% (4/7), 25–84% / 71% (5/7), 36–92% | 29% (2/7), 8–64% | not shown |
| science | 10 | 9 | 67% (6/9), 35–88% | 100% (9/9), 70–100% | 100% (1/1), 21–100% | 88% (7/8), 53–98% / 88% (7/8), 53–98% | 13% (1/8), 2–47% | not shown |
| devops | 20 | 9 | 78% (7/9), 45–94% | 89% (8/9), 56–98% | 73% (8/11), 43–90% | 64% (7/11), 35–85% / 64% (7/11), 35–85% | 0% (0/11), 0–26% | not shown |
| security | 15 | 15 | 87% (13/15), 62–96% | 87% (13/15), 62–96% | — | 100% (17/17), 82–100% / 100% (17/17), 82–100% | 0% (0/17), 0–18% | not shown |
| debug | 15 | 15 | 100% (15/15), 80–100% | 100% (15/15), 80–100% | — | 88% (30/34), 73–95% / 94% (32/34), 81–98% | 0% (0/34), 0–10% | not shown |
| everyday | 35 | 0 | — | — | 94% (33/35), 81–98% | 0% (0/2), 0–66% / 0% (0/2), 0–66% | 0% (0/2), 0–66% | not shown |
| media | 15 | 9 | 78% (7/9), 45–94% | 89% (8/9), 56–98% | 33% (2/6), 10–70% | 67% (10/15), 42–85% / 73% (11/15), 48–89% | 0% (0/15), 0–20% | not shown |
| writing | 15 | 5 | 100% (5/5), 57–100% | 100% (5/5), 57–100% | 50% (5/10), 24–76% | 50% (5/10), 24–76% / 50% (5/10), 24–76% | 0% (0/10), 0–28% | not shown |
| productivity | 10 | 7 | 57% (4/7), 25–84% | 71% (5/7), 36–92% | 67% (2/3), 21–94% | 67% (4/6), 30–90% / 67% (4/6), 30–90% | 17% (1/6), 3–56% | not shown |
| apps | 10 | 3 | 33% (1/3), 6–79% | 33% (1/3), 6–79% | 100% (7/7), 65–100% | 100% (1/1), 21–100% / 100% (1/1), 21–100% | 0% (0/1), 0–79% | not shown |
| questions | 10 | 0 | — | — | 100% (10/10), 72–100% | — / — | — | not shown |

## Misses and misleading loads

- **web-17** (web, judge: none) I'd like to add breadcrumbs to our documentation site. First look at how the site is built (static site generator or framework, how pages an
  loaded: frontend-ui-engineering · offered: writing-plans · judge: —
- **web-20** (web, judge: helpful) Our settings page is one very long scrolling page. I'd like to turn it into tabs, one per section, while keeping direct links to each sectio
  loaded: — · offered: impeccable · judge: frontend-ui-engineering, webapp-testing, accessibility-review
- **web-01** (web, judge: helpful) I want a simple website for my dog grooming business. The two main things visitors need to do are see my prices and request an appointment.

  loaded: — · offered: impeccable, netlify-deploy · judge: frontend-design, netlify-deploy, deploy-to-vercel
- **web-03** (web, judge: helpful) My photography portfolio looks bad on phones. The landscape shots are getting cropped weirdly, so important parts of the scenes are cut off.
  loaded: — · offered: — · judge: webapp-testing, frontend-ui-engineering, browser-testing-with-devtools
- **web-04** (web, judge: helpful) I'd like keyboard navigation added to this dropdown, and I want Escape to close it. Please find the dropdown component in the codebase and c
  loaded: — · offered: test-driven-development--addyosmani, surgical-patch · judge: frontend-ui-engineering, accessibility-review, webapp-testing
- **web-10** (web, judge: none) Please add a dark mode toggle to my site and make it remember the visitor's choice on their next visit.

Requirements:
- Add an accessible t
  loaded: frontend-ui-engineering · offered: — · judge: —
- **web-14** (web, judge: helpful) The navbar jumps when I open the menu. Please find the cause and fix it so opening and closing is smooth.

What I need:
1. Find the navbar a
  loaded: — · offered: — · judge: investigate-first, frontend-ui-engineering, systematic-debugging, webapp-testing
- **web-15** (web, judge: helpful) Create a landing page for our online ceramics class using the photos in public/images.

Start by looking at public/images. List the photos y
  loaded: — · offered: — · judge: landing-page-design, frontend-design, design-taste-frontend, frontend-ui-engineering, web-perf
- **web-25** (web, judge: helpful) I want the booking calendar to show unavailable days more clearly, because customers keep trying to click them.

Please find the booking cal
  loaded: impeccable · offered: test-driven-development--addyosmani, accessibility-review, design-system, redesign-existing-projects · judge: accessibility-review, frontend-ui-engineering
- **backend-03** (backend, judge: helpful) Stripe sometimes sends the same webhook twice, and we're creating duplicate subscriptions. Please make webhook processing idempotent.

First
  loaded: — · offered: supabase-postgres-best-practices, incremental-implementation, surgical-patch, security-and-hardening · judge: investigate-first, systematic-debugging, supabase-postgres-best-practices
- **backend-11** (backend, judge: helpful) I need a Django API for recording maintenance tickets and assigning them to technicians. Please build it, using Django REST Framework unless
  loaded: — · offered: — · judge: django-access-review
- **backend-12** (backend, judge: none) Our webhook receiver currently parses or processes the payload before the signature is checked. Please change it so the signature is verifie
  loaded: security-and-hardening · offered: setup-zoom-webhooks, constant-time-analysis, test-driven-development--addyosmani · judge: —
- **backend-20** (backend, judge: helpful) We need tenant isolation in this Rails app. Please review the query paths and make sure one company can't read another company's records.

C
  loaded: — · offered: security-and-hardening, audit-context-building, find-bugs, code-review--anthropics · judge: security-review, variant-analysis
- **integrations-04** (integrations, judge: none) I want a command-line tool that lists my open Linear issues and lets me change their status. Please build it in the current working director
  loaded: cli-creator · offered: — · judge: —
- **integrations-09** (integrations, judge: helpful) I need a GitHub Action that posts a short release summary to our team's Slack channel whenever we publish a release. Please add it to this r
  loaded: — · offered: — · judge: gha-security-review, ci-cd-and-automation
- **integrations-10** (integrations, judge: helpful) I want a support chatbot for our website that answers questions using our help center articles, and hands off to a human when it can't answe
  loaded: ai-rag-pipeline · offered: markitdown · judge: claude-api, ai-rag-pipeline
- **integrations-14** (integrations, judge: helpful) I want to build an agent that checks incoming purchase orders against our catalog and drafts a reply for human review.

Flow:
1. Take an inc
  loaded: — · offered: — · judge: pdf, claude-api
- **integrations-18** (integrations, judge: helpful) I want a Microsoft Teams bot that answers office location and Wi-Fi questions from a maintained FAQ.

Requirements:
- Users ask in personal 
  loaded: — · offered: — · judge: microsoft-foundry
- **integrations-20** (integrations, judge: none) I want you to build a VS Code extension that inserts our team's standard ticket reference into commit messages.

I haven't given you the tic
  loaded: source-driven-development · offered: test-driven-development--addyosmani · judge: —
- **documents-17** (documents, judge: helpful) I need a rent receipt for September, using the payment details I'm providing with this request.

Please include:
- The receipt title, the da
  loaded: — · offered: docx, pdf, pdf--openai · judge: pdf, docx
- **documents-21** (documents, judge: helpful) Create a printable checklist for opening and closing our bakery. Staff will use it every day.

Structure:
- Two sections, "Opening" and "Clo
  loaded: — · offered: docx, pdf, pdf--openai · judge: docx, pdf
- **documents-24** (documents, judge: essential) I need you to extract the line items from the supplier invoices I've attached and combine them into a single CSV file.

For each line item, 
  loaded: — · offered: liteparse, invoice-organizer, python-executor, pdf · judge: pdf, pdf--openai, liteparse
- **business-03** (business, judge: helpful) I'm a sole trader in the UK and I'm about to start my Self Assessment tax return. Give me a practical checklist of the records and documents
  loaded: — · offered: discernment-nudge · judge: tax-season-organizer
- **business-04** (business, judge: none) Draft a short outreach email to independent bookstores asking them to stock our greeting cards. Keep it under 150 words, warm and profession
  loaded: outreach-composer, draft-outreach · offered: draft-content, content-creation, lark-mail · judge: —
- **business-05** (business, judge: helpful) Help me clean up duplicate contacts in our CRM. I'll share an export of the records (CSV or pasted rows). Find the duplicate pairs and, for 
  loaded: — · offered: explore-data, xlsx, crm-autopilot · judge: crm-hygiene-check, xlsx
- **business-18** (business, judge: helpful) I need a polite but firm payment reminder I can send to clients whose invoices are more than 30 days overdue. Please draft it as an email wi
  loaded: draft-response · offered: invoice-chase, outreach-composer, lark-mail · judge: invoice-chase
- **business-24** (business, judge: helpful) Help me estimate the true, fully loaded annual cost of hiring my first employee in California. I want a realistic number rather than just th
  loaded: discernment-nudge · offered: — · judge: xlsx, comp-analysis
- **business-28** (business, judge: none) I'm planning to sell digital downloads (for example ebooks, templates, or software files) to customers in the EU, and I want to be ready for
  loaded: meeting-briefing · offered: discernment-nudge, compliance-check · judge: —
- **business-29** (business, judge: none) Create a referral program for my cleaning company. I want a simple reward structure and clear eligibility rules that I can publish to custom
  loaded: compliance-check · offered: — · judge: —
- **data-01** (data, judge: helpful) Write a SQL query that finds customers who placed an order last quarter but haven't placed any order this quarter.

Assumptions to state, an
  loaded: — · offered: — · judge: write-query, sql-queries
- **data-02** (data, judge: helpful) I need you to clean a CSV file. The dates are in three different formats, and some of the amount values have currency symbols. Look for the 
  loaded: — · offered: — · judge: xlsx, explore-data
- **data-05** (data, judge: helpful) Please create a Jupyter notebook that explores the bike share dataset in my working directory and saves the charts it produces. Start by loc
  loaded: — · offered: — · judge: jupyter-notebook, exploratory-data-analysis, create-viz, seaborn
- **data-16** (data, judge: helpful) Using the customer export I'm providing, make a map of sales by postcode.

Inspect the file first to find the postcode, country, and sales o
  loaded: — · offered: geopandas, create-viz, python-executor, data-visualization--anthropics · judge: geopandas, data-visualization--anthropics, create-viz
- **data-18** (data, judge: helpful) In this notebook, add confidence intervals to the conversion chart.

First, read the notebook to find the conversion chart and the data behi
  loaded: — · offered: jupyter-notebook, scientific-visualization, statistical-analysis--anthropics, statistical-analysis · judge: jupyter-notebook, statistical-analysis, matplotlib
- **data-19** (data, judge: helpful) I need a weekly operations report built from these shipment logs, covering late deliveries and their most common causes.

First inspect the 
  loaded: report-builder · offered: explore-data, analyze, xlsx, report-pack · judge: build-dashboard, create-viz, xlsx, data-visualization--anthropics
- **ml-02** (ml, judge: helpful) I want to build an embedding search index over our product descriptions and evaluate how well it works using example queries that I'll provi
  loaded: — · offered: — · judge: train-sentence-transformers, transformers
- **ml-05** (ml, judge: none) I want to benchmark an ONNX model on CPU and get latency numbers at different batch sizes. I'll point you to the model file in the working d
  loaded: python-executor · offered: — · judge: — · misleading: python-executor
- **ml-06** (ml, judge: helpful) I want an evaluation set for our document Q&A system. It should include questions the documents can't answer, so I can check that the system
  loaded: google-agents-cli-eval · offered: — · judge: markitdown, liteparse, pdf · misleading: google-agents-cli-eval
- **ml-07** (ml, judge: helpful) I need help balancing a dataset without letting copies of the same sample end up in both train and test. I'll point you to the data in the w
  loaded: exploratory-data-analysis · offered: explore-data · judge: scikit-learn
- **ml-09** (ml, judge: helpful) I have a local language model and I want to quantize it, then measure how much answer quality changes.

First, inspect the working directory
  loaded: — · offered: — · judge: huggingface-local-models, transformers, hf-mem
- **ml-14** (ml, judge: helpful) I want to build a reranking experiment for our search results, using the relevance judgments in the file I've provided.

First, find the jud
  loaded: — · offered: train-sentence-transformers · judge: train-sentence-transformers, statistical-analysis, scikit-learn
- **science-01** (science, judge: helpful) I need you to analyze my qPCR results using the controls described in my experiment notes. Start by finding the qPCR data files and the expe
  loaded: python-executor · offered: statistical-analysis, statistical-analysis--anthropics · judge: statistical-analysis, scientific-visualization, matplotlib · misleading: python-executor
- **science-02** (science, judge: helpful) I want to reproduce the main figure (the primary results figure, likely Figure 1 or 2; confirm which one you're targeting) from a paper usin
  loaded: — · offered: ai-research-reproduction, scientific-visualization, python-executor, data-visualization--anthropics · judge: pdf, scientific-visualization, matplotlib
- **science-06** (science, judge: helpful) Fit a dose-response curve to our assay data and report the IC50 with uncertainty. First find the data file(s) in the working directory and s
  loaded: — · offered: statistical-analysis, python-executor, uncertainty-and-units · judge: statistical-analysis, scientific-visualization, matplotlib
- **devops-01** (devops, judge: helpful) Please add a GitHub Actions workflow to this repository that runs our tests on every pull request.

First inspect the repo to identify the l
  loaded: — · offered: — · judge: ci-cd-and-automation
- **devops-13** (devops, judge: none) Our disk filled up overnight and I need to understand why. Please investigate what's growing and propose a retention policy. Do not delete, 
  loaded: investigate-first · offered: — · judge: —
- **devops-15** (devops, judge: none) I need to find out why the certificate on our staging environment isn't renewing automatically. Please investigate and tell me the root caus
  loaded: investigate-first · offered: debugging-and-error-recovery, debug · judge: —
- **devops-16** (devops, judge: none) I want to add a manual deployment approval step before the production job in our GitLab CI pipeline. Please update the `.gitlab-ci.yml` (and
  loaded: ci-cd-and-automation · offered: — · judge: —
- **devops-20** (devops, judge: helpful) Please review our cloud bill and find idle resources and obvious configuration waste that we could cut.

Use the billing exports, cost repor
  loaded: — · offered: cost-optimization, google-cloud-waf-cost-optimization · judge: cost-optimization, google-cloud-waf-cost-optimization, gke-cost-analysis
- **security-02** (security, judge: helpful) Please scan this repository for committed secrets and tell me what needs to be rotated.

Check both the current working tree and the full gi
  loaded: — · offered: — · judge: security-review, security-best-practices
- **security-07** (security, judge: helpful) I want you to review the IAM permissions for our deployment role and reduce them to what it actually needs (least privilege).

First, find w
  loaded: — · offered: iam-helper-for-troubleshooting · judge: security-best-practices, security-review
- **everyday-08** (everyday, judge: none) I need a unit test for this clamp function. Please find it (the one I have open or selected; ask me if there are several candidates) and wri
  loaded: code-testing-agent · offered: test-driven-development--addyosmani · judge: —
- **everyday-31** (everyday, judge: none) Add a test for an empty input to the `slugify` function. Find where `slugify` is defined and where its existing tests live, then follow the 
  loaded: code-testing-agent · offered: test-driven-development--addyosmani · judge: —
- **media-01** (media, judge: none) Trim the dead air from the beginning and end of this interview recording. I'll point you to the file. If I haven't, look in the current work
  loaded: python-executor · offered: media-use · judge: —
- **media-04** (media, judge: none) I want a short looping GIF made from the moment in the attached video where the cat jumps onto the chair.

Steps and requirements:
- Find th
  loaded: python-executor · offered: slack-gif-creator, media-use, general-video · judge: —
- **media-05** (media, judge: none) I want the background hum removed from the attached podcast clip, without making the voices sound metallic or processed.

Approach:
- First 
  loaded: python-executor · offered: — · judge: —
- **media-10** (media, judge: helpful) I have a screen recording that I want to turn into a polished 30-second demo video. Please edit it down to about 30 seconds total, keeping o
  loaded: — · offered: hyperframes, general-video · judge: hyperframes, general-video, hyperframes-keyframes
- **media-13** (media, judge: helpful) I need a simple animation of the moon's phases for a school presentation. Please create it so it's clear and easy to understand for a genera
  loaded: — · offered: — · judge: motion-graphics, hyperframes
- **media-14** (media, judge: none) I want to share a dashcam video and need the license plates blurred first so they can't be read. Please process the video I point you to and
  loaded: python-executor · offered: — · judge: —
- **writing-06** (writing, judge: none) Write a short announcement, around 80–120 words, telling staff that our office is moving next month. Today is 2026-10-06, so "next month" me
  loaded: internal-comms · offered: draft-content · judge: —
- **writing-08** (writing, judge: none) I'm going to paste our current onboarding instructions. Please rewrite them so a nontechnical customer can follow them on their own without 
  loaded: documentation · offered: kb-article, ux-copy, brand-guidelines--getsentry · judge: —
- **writing-11** (writing, judge: none) Write a concise README.md for this command line tool. Start by looking through the project (entry point, package or build files, any existin
  loaded: documentation · offered: — · judge: —
- **writing-13** (writing, judge: none) Turn this technical design into an explanation for our sales team. I'll paste or point you to the design document. If it isn't provided, ask
  loaded: writing-shape · offered: documentation · judge: —
- **writing-14** (writing, judge: none) Write three subject lines for this newsletter. I'll paste the newsletter content. If it isn't included, ask me for it first.

Requirements:

  loaded: draft-content · offered: email-design, content-creation · judge: —
- **productivity-03** (productivity, judge: helpful) Find a 45-minute slot next week when everyone on this invite is free. Today is Tuesday, October 6, 2026, so "next week" means Monday, Octobe
  loaded: lark-calendar · offered: schedule-meeting · judge: schedule-meeting · misleading: lark-calendar
- **apps-10** (apps, judge: helpful) I want you to build a desktop utility that previews batch filename changes before applying them. The core idea: I pick a folder (or drag in 
  loaded: — · offered: — · judge: test-driven-development, verification-before-completion, incremental-implementation
- **productivity-05** (productivity, judge: none) I need a realistic task plan to finish my dissertation chapter by this Friday. Today is Tuesday, October 6, 2026, so Friday is October 9. Th
  loaded: planning-and-task-breakdown · offered: interview-me · judge: —
- **productivity-08** (productivity, judge: helpful) I'm going to give you transcripts from several meetings. Please go through them and summarize what I still owe other people.

For each commi
  loaded: — · offered: — · judge: meeting-insights-analyzer
- **productivity-10** (productivity, judge: helpful) Our team wiki has become a mess, and I'd like you to propose a better structure and point out what should be cleaned up. I'll share an expor
  loaded: — · offered: file-organizer · judge: notion-research-documentation, file-organizer
- **apps-03** (apps, judge: helpful) I want a browser-based word game where the player guesses a hidden word from progressively clearer clues. Please build it in the current wor
  loaded: — · offered: — · judge: webapp-testing, frontend-ui-engineering
