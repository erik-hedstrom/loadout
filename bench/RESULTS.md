# Routing benchmark — results

199 generated tasks (169 with a gold skill, 30 needing none) against libraries
of 1,000 to 20,000 real skills from GitSkills. Method and caveats:
[README.md](README.md). **All of these are routing results on synthetic tasks**:
they measure what reaches the agent, not whether the agent then finishes the
task.

## B1 method (preregistered)

Revised 2026-10-07 after PR #6 round 4, before any paid call. Results: [B1 results](#b1-results-2026-10-07-what-installed-skills-cost-per-request).

- Prompt: `Reply with exactly OK. Do not use tools, skills, commands, agents, or external services.`
- Named arms: baseline, obra/superpowers, anthropics/skills, skills.sh snapshot, pbakaus/impeccable, whole library, loadout MCP.
  “top50” means the first 50 saved rows by rank, including gaps, each matched to local provenance.
- Cap arms: Codex prefixes of one sorted, validated corpus at 16, 64, 256, 1024,
  omit sizes >= corpus size; full library is the final superset. Named packs supply deltas, not cap evidence.
- Two fresh Claude sessions per named arm, haiku: **14 paid CLI calls**. Codex paid
  runs are deferred on codex-cli 0.160.1 until unified_exec can be disabled.
  If all Codex gates pass, up to 22 additional gpt-5.6-luna calls (36 total); no default confirmations.
- `node --import tsx bench/overhead.ts --plan --library <dir>` prints argv/cwd, free/paid counts without running processes; retains temp files.
- Codex 0.160.1 measures **offline rendered-prompt characters and visible skill counts**, not tokens while paid runs are deferred.
  Characters are joined input_text blocks (UTF-16 length).
  Each arm saves copied/rejected, discovered/visible counts, context SHA-256 and AGENTS flag.
  Never retain context text/errors. Save offline rows despite refusal; disabled features must all read false for paid Codex. Claude runs independently.
  Shared model/sandbox/MCP/features apply to exec, prompt-input and model-free skills/list.
- Loadout MCP is required=true; Codex must expose find_skills/load_skill. Failed startup/discovery
  prevents a valid row. Free app-server queries create no threads/turns.
- Claude baseline is the **isolated CLI configuration**: `-p --output-format stream-json --verbose --no-session-persistence --restricted --setting-sources '' --settings '{"disableAllHooks":true}' --strict-mcp-config --mcp-config '{"mcpServers":{}}' --tools Skill --model haiku`.
  Record actual plugins, skills, slash commands and MCP names/statuses from init, including anything still loaded (such as synced plugins).
  Treatments add the b1 text plugin or loadout MCP; all remaining inventory must match baseline. Count pack skills by b1: prefix.
  Codex's ambient baseline with the explicit overrides above is separate from this Claude baseline.
  Baseline pair then smallest copied pack pair: both need discovered b1: skills and positive paired input deltas before other Claude arms.
  Reject zero-discovery treatments. No init-only offline CLI is documented; safe-mode pack compatibility is unverified.
  Claude missing entries are **omitted, cause unverified**; init does not prove visibility.
- Codex caps require nested discovery success and fewer visible than discovered; a character/token
  plateau alone proves nothing. Reported 2% context / 8,000-character fallback budget:
  https://developers.openai.com/codex/skills (not reverified offline).
- Codex superpowers must increase visible count, and input if paid. Claude input sums uncached/cache creation/cache read; retain numeric modelUsage
  per model. Codex total includes cached input. Preserve first/second counters. Costs in analysis; no population claim/intervals from pairs.
- Confined manifests need name/description; reject invalid files, escape/frame text, strip hooks.
  Exclude links, scripts, references, commands/agents and pack MCP/LSP servers: starting those executes downloaded code (AGENTS rule 5).
  Loadout uses repo code, a temp text library, lexical routing, no embeddings or Jev calls.
- Store sanitized rows/preflights under bench/results/<timestamp>-overhead, never transcripts/env.
  No config edits or credential copying. Host-owned state: Claude adds temp-cwd entries to
  ~/.claude.json; Codex writes logs. Outcome quality is not measured.

## B1 results (2026-10-07): what installed skills cost per request

Raw rows: [bench/results/2026-10-07T21-04-16-645Z-overhead/](results/2026-10-07T21-04-16-645Z-overhead/).
Claude Code CLI, haiku, two fresh sessions per arm, deltas over the
baseline's 6,728 input tokens (call 1 / call 2). The baseline is not bare:
inside the isolated CLI configuration it still lists 19 ambient skills and 2
claude.ai-synced plugins.

| Arm | Skills copied (discovered) | Claude input delta |
|---|---:|---:|
| impeccable | 1 (1) | +216 / +212 |
| superpowers | 15 (15) | +312 / +308 |
| anthropics | 19 (19) | +330 / +333 |
| top50 | 50 (50) | +477 / +476 |
| whole library | 1,262 (1,232; 30 omitted, cause unverified) | +12,283 / +12,284 |
| loadout MCP | 0 | +546 / +546 |

- The listing grows with the library: about **10 tokens per added skill**
  between 50 and 1,232 discovered skills, ((12,283 − 477) / 1,182). The
  listing cap does not bound it. Pack skills were listed under generated
  names (`b1:b1-0000`, …); the library's real folder names average 18.2
  characters against 7, so the cost with real names is not shown.
- The earlier ~140k-token figure for 1,262 skills summed full descriptions
  (HANDOFF). The measured cost is 12.3k tokens, about 11 times less. That
  estimate is withdrawn.
- **At 50 skills, loadout's tool definitions cost more than the native
  listing** (+546 against +477). A straight line between the 50- and
  1,232-skill arms crosses +546 near 57 skills. That is an interpolation of
  listing overhead only. Router calls, the skills loadout returns, and where
  real libraries cross over are not measured.
- Nearly all input was cache creation (uncached: 10 tokens). Multi-turn
  sessions, where the listing is read from cache after the first turn, are
  not measured, so cost in money per session is not shown.

Codex (codex-cli 0.160.1, offline `debug prompt-input`, rendered characters;
paid runs deferred, see the method): the whole rendered prompt stops growing
at about 15.7k characters over baseline by 50–64 skills (top50 +15,669,
cap-64 +15,725, cap-256 +15,766). All 256 skills in cap-256 stay visible. At 1,024
and 1,262 skills only **424 are visible** (the library arm adds +15,126).
Codex bounds the cost and drops skills instead. The loadout arm's MCP tool
definitions are not part of the rendered text, so its Codex cost is not
shown.

Validity: the first attempt
([2026-10-07T20-59-10-578Z-overhead](results/2026-10-07T20-59-10-578Z-overhead/))
stopped after 2 paid calls. The inventory guard fired when a claude.ai-synced
plugin disappeared between the two baseline calls. Four diagnostic probes,
each killed at its init event and not committed, then agreed. Whether a
model request had started is not verified, so they count as up to 4 more
calls. The rerun passed every guard. Spend: 16 haiku calls with rows (about
136k input tokens) plus up to 4 probes, on the subscription. No Jev or Codex
spend.

## v4 (2026-10-06): realistic requests on the real library, judged

The question here is different from v1–v3: on what people actually type, are
the choices **reasonable**? No gold labels exist for that, so a frontier model
judges them.

**Setup**
- **Library:** the user's real library, 1,262 skills from 32 sources: the
  v3 library, plus Anthropic's
  [knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)
  (finance, legal, sales, small business…) and the specific skills from
  [awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills)
  (invoice organizer, resume tailoring…).
- **Requests:** 315 seeds written by Codex (gpt-6.1-sol, no access to the
  library) across 17 categories, from invoices and payroll to MCP servers,
  RNA-seq and "rename this variable" ([seeds.jsonl](data/seeds.jsonl)). Each was
  expanded by Sonnet 5.5 into the detailed prompt a user's prompt-improvement
  step would send: 81–286 words, median 199
  ([requests.jsonl](data/requests.jsonl), [expand.ts](expand.ts)). Neither
  model saw the library.
- **Judge** ([judge.ts](judge.ts)): Claude Opus 5.5 with the whole catalog
  (1,262 keys and descriptions). It works in two passes:
  - **Blind:** without seeing loadout's choice, it says whether each request
    needs a skill (none / helpful / essential) and lists up to 5 useful skills,
    best first. Answers that contradict themselves ("none" with a list) are
    asked again. Result: 189 requests would benefit from a skill (28
    essential), and 126 need none.
  - **Adjudication:** where loadout disagrees with the blind answer, the judge
    rates each loaded skill (helpful / neutral / misleading) and names any
    clearly better skill that was missed. These ratings override the blind
    list.

  Cost: $4.41 for the first run's blind pass and adjudication, then $1–2 per
  re-adjudication.

**Three runs over the same 315 requests** (the rule was tuned on the dev split,
102 requests, and is reported on the test split, 213):

| Test split (121 need a skill, 92 need none) | A: v3 rule | B: new rule | C: new rule + embeddings |
|---|---:|---:|---:|
| A useful skill loaded | 63% | 72% | **76%** (68–83) |
| A useful skill loaded or offered | 83% | 81% | **86%** (79–91) |
| Nothing loaded when none is needed | 80% | 83% | **84%** (75–90) |
| Loaded skills that are useful | 75% | 80% | **82%** (75–87) |
| Loaded skills that would mislead | 2% | 3% | **1%** (0–4) |
| Injected skills that are useful | 77% | 77% | **84%** (67–93) |
| Skills loaded per request | 0.74 | 0.70 | 0.74 |

(95% Wilson intervals for C.) Across all 315 requests, C:
- loads a useful skill for 78% of the requests that need one;
- loads a helpful skill for 27 of the 28 essential ones;
- costs $0.0011 per decision.

Rows: `results/2026-10-06T{02-08-14,05-40-33,06-06-36}-sweep/`.

**What changed, and why**
1. **The winner rule (B).** On detailed prompts, the right file-format or
   domain skill often wins the close comparison clearly (`pdf` share 0.83 for
   "redact my phone number from this PDF") but is rated "helps with part",
   because a 200-word request asks for several things. Meanwhile generic
   process skills (`implement`, `planning-and-task-breakdown`) match a
   step-by-step request "exactly". New rule: load at P(exact) ≥ 0.8 with share ≥
   0.1, or the comparison's winner (share ≥ 0.5) with expected fit ≥ 0.7. On
   the v3 benchmark (test split) it keeps recall, top-1 and needless loads
   unchanged at all sizes and loads fewer skills (1.24 vs 1.50 at 20k).
2. **Embedding retrieval on by default (C).** Long prompts dilute BM25: the
   judge's best skill was in the top 200 candidates for 80% of requests with
   BM25 alone, and 87% with embeddings fused in (seeds: 67% → 78%). On the v2
   synthetic benchmark embeddings added nothing, which is why they were off.
3. **Mentions inside code are not mentions.** A Telegram bot request listing
   `` `/start` `` loaded a bio-research skill named `start`.

**Where it is still weak** (run C, by category):
- integrations, 3 of 7 (e.g. `mcp-builder` is still missed for one MCP-server
  request);
- ML, 4 of 9, with 2 misleading loads;
- apps, 1 of 3;
- productivity, 4 of 7;
- too eager on web and writing tasks that need nothing (quiet 1 of 4 and 6 of
  10): `frontend-ui-engineering` reads as an exact fit for most UI work.

It is strong on documents (27/30), business (21/25), debugging (15/15),
security (13/15), devops (8/9) and media (8/9). It stays quiet on 33 of 35
everyday edits and on 10 of 10 conceptual questions.

**Where the remaining misses come from** (run C, the 41 requests that need a
skill but got no useful one loaded):

| Stage | Requests |
|---|---:|
| Shortlisted with fit ≥ 0.7 and **offered**, not loaded | 14 |
| Below the need gate | 10 |
| Shortlisted, but Jev rated the fit low (the judge rated it useful) | 9 |
| Not shortlisted | 8 |

The agent can still reach the offered skills: they are in the generated
plugin, or listed by the hook. The rest are spread across stages, and no
category-specific rule fixes them without overfitting these 315 requests.

**Tried and dropped: a platform-mismatch veto** ([mismatch-probe.ts](mismatch-probe.ts),
$0.007). The 4 misleading loads all assume a product or stack the request
never mentions: `lark-calendar` for generic scheduling, a RAPIDS skill for a
PyTorch out-of-memory problem, a Google agent-framework eval skill for a
generic Q&A dataset. A per-candidate question ("does this skill depend on a
product, platform or stack the request doesn't mention?") did not separate
them. At ≥ 0.7 it vetoes 1 of the 4 but also 11 of 195 helpful loads, mostly
media skills built on one vendor's service, which the user is happy to use. A
second phrasing ("would it push the work onto a different stack?") caught none
at ≥ 0.7.

**Injection.** None of the injections that missed was misleading. All were
neutral general skills, mostly on requests the judge says need nothing (a test
pipeline for a one-line test, task breakdown for a dissertation schedule). A
higher need bar for injection does not separate them: it drops helpful ones
faster.

**Terse seeds vs detailed prompts** (v3 rule, not judged). The load rates are
similar (47% vs 49%). Where both load something, the top pick is the same 84
of 111 times. The judge's labels are not reused for the seeds: expansion adds
details (a framework, a format) that change which skills fit, so the seeds
would need their own blind pass.

**Caveats.**
- One judge model, from the same family as the expander.
- The rule was tuned on the dev third of these requests. The test-split numbers are
  the honest ones, and their intervals overlap between B and C.
- Requests are synthetic, even if independent of the library.
- 17 categories of 10–35 requests each, so the per-category numbers are rough.

### Do agents use what they are given?

Measured with [invoke.ts](invoke.ts) on requests from the sweep:
- runs are headless, capped at 8 turns (Claude) or 4 minutes;
- each starts in an empty folder where the agent may edit files but runs no
  unapproved commands;
- a note tells the agent to make up sample inputs where the request mentions
  attachments;
- Claude Code ran Sonnet 5.5 throughout and Codex ran gpt-6.1-sol.

A skill counts as opened when the agent invoked it (Claude's Skill tool),
read its SKILL.md, or loaded it through `load_skill`, and the call succeeded.

| | Claude Code | Codex |
|---|---:|---:|
| **Routed** (loadout's selection preloaded): opened a loaded skill | 9 of 10 | 11 of 11 |
| …and also searched the library for more | 4 of 10 | 3 of 11 |
| **Search only** (nothing preloaded; `find_skills` attached): searched on its own | 2 of 10 | 5 of 10 |
| …and loaded a skill the judge lists as useful | 2 of 2 | 5 of 5 |

- **Routed sessions work.** The agents use what loadout puts in front of them.
  For example, Claude invoked `contract-review`, `job-post-builder`,
  `background-removal` and `xlsx`. In 4 runs it also searched mid-task and
  added skills; for a map chart it found `geopandas`. The one miss implemented
  a Figma design without opening `figma-implement-design`.
- **Search alone is not enough.** When an agent searches, it finds the right
  skill every time (7 of 7). But it searches only when the task feels
  unfamiliar (PDF redaction, RNA-seq units, video generation). It skips the
  search for work it believes it knows, such as an MCP server, an Obsidian
  note, a changelog, a vendor review or a threat model, even though the
  library has a skill for each. Server instructions and tool wording raised
  Codex's rate from 3 to 5 of 10; Claude's stayed low. So the upfront router
  carries the load, and `find_skills` is the mid-session supplement, not a
  replacement.

**The prompt hook closes most of that gap** (2026-10-07). Same 10 requests,
Claude Code (Sonnet 5.5), nothing preloaded. As after `loadout setup
claude-code`, the session has the loadout MCP server plus the `UserPromptSubmit`
hook, which routes the prompt and adds the skills that fit as context:

| Claude Code, same 10 requests | Opened a skill the judge rates useful |
|---|---:|
| Search tool only | 2 of 10 |
| Search tool + prompt hook | **6 of 10** |

In the 4 misses the hook did offer the right skill, and Claude still did not
open it:
- it answered the changelog and vendor-review requests in text, without
  calling any tool;
- on the MCP server and the threat model it used up its 8 turns or 4 minutes
  first (shell commands are not approved in these runs).

These are small samples (10 requests per cell, capped runs), not outcome
measurements: they show whether the skill reaches the agent's context, not
whether the result is better.

### Is the work better? (outcome pilot, 2026-10-07)

[outcome.ts](outcome.ts) runs each request twice with Codex (gpt-6.1-sol) in
fresh folders, capped at 6 minutes:
- **bare:** nothing from loadout;
- **loadout:** the sweep's selection, which here is the judge's top skill,
  injected for 7 of the 8.

Claude Opus then compares the two sets of deliverables blind, in both orders.
A preference counts only if it holds both ways. Eight requests where a
specific skill exists:

| Request | Skill | Verdict | Notes |
|---|---|---|---|
| MCP server for a docs folder | `mcp-builder` | **loadout** | structured outputs, strict schemas, tool titles |
| Queue-backlog runbook | `runbook` | **loadout** | placeholders throughout, never guesses production names |
| GitHub Actions security review | `gha-security-review` | **loadout** | both timed out; low/medium confidence |
| Merge two Obsidian notes | `obsidian-markdown` | **loadout** | |
| Vendor quote comparison | `vendor-review` | split | loadout / tie |
| A/B test analysis | `statistical-analysis` | bare | bare's script takes any CSV |
| UV-Vis calculation review | `uncertainty-and-units` | bare | loadout timed out before writing the review document |
| Threat model for uploads | `security-threat-model` | bare | loadout timed out; bare's sample code was more realistic |

**Loadout better in 4, bare in 3, 1 split. No overall quality gain shows at
this size.**
- The verdicts are consistent: 7 of 8 held in both orders.
- The wins are where a skill encodes conventions a strong agent would not
  apply unprompted: MCP best practices, runbook safety, Obsidian specifics.
- Two of the three losses are runs where following the skill took longer and
  hit the time cap (loadout timed out 4 times, bare twice).
- gpt-6.1-sol does these tasks well on its own.

Limits:
- 8 requests;
- each arm made up its own sample inputs;
- both arms ran with the user's Codex configuration;
- a skill's template can show in its output, so the judge is not perfectly
  blind.

Next tests:
- fixed input fixtures and longer caps;
- the small tier (gpt-5.6-luna, Haiku), where loadout's cost argument says
  skills should matter most.

## v3 (2026-10-06): specificity gate, injection, mentions

Changes from v2, prompted by an adversarial review with Codex (gpt-6.1-sol,
high) and by dogfooding:
- the need score drops the request-level "names a product/format" question
  (it could not separate: 0.958 vs 0.946) for a per-candidate "is this skill
  specifically about what the request names?" question in the close request;
- a clear-winner rule injects the top skill's full SKILL.md;
- skills the user names are loaded and injected regardless of the router;
- Jev failures fall back to keyword ranking instead of aborting.

Raw rows: `results/2026-10-06T00-53-05-loadout/` (fresh Jev answers, $0.48).
Rule tuned on dev with needless loads ≤ 10% on dev, reported on test: load when
P(exact) ≥ 0.7 and close share ≥ 0.03, need ≥ 0.5, at most 3.

### Test split

| Library | Gold loaded | Gold available (incl. offered) | Ranked first | Loaded | Loaded + offered | Needless loads | $/decision | Latency |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 94% | 95% | 93% | 1.0 | 1.5 | 5% | $0.00080 | 0.96 s |
| 5,000 | 95% | 95% | 93% | 1.2 | 2.4 | 5% | $0.00082 | 0.99 s |
| 20,000 | 93% | 95% | 86% | 1.5 | 3.2 | 5% | $0.00082 | 0.95 s |

95% intervals, pooled over sizes: recall 90–96%, needless loads 2–14% (3 of 60
rows). These are optimistic, because each task appears at three sizes.

**v3 vs v2 is a wash at the default gate.** With fresh answers, the new gate
traces a slightly better curve around 0.45, but the difference is one or two
no-skill tasks:

| Gate | v2 recall / needless | v3 recall / needless |
|---:|---:|---:|
| 0.45 | 98% / 22% | 97% / 10% |
| 0.5 | 95% / 5% | 94% / 5% |
| 0.55 | 89% / 2% | 87% / 5% |

The specificity question stays because it is no worse and feeds the injection
rule.

### Need questions, compared (all 199 tasks, one Jev request each, $0.013)

AUC: probability that a gold task scores higher than a no-skill task (0.5 = coin flip).

| Question | Gold mean | No-skill mean | AUC |
|---|---:|---:|---:|
| expert follows a documented procedure, tool or workflow | 0.71 | 0.25 | 0.97 |
| a strong general programmer could just do it (inverted) | 0.58 | 0.87 | 0.97 |
| top candidate is specifically about what the request names | 0.96 | 0.76 | 0.95 |
| needs specialised domain knowledge | 0.74 | 0.21 | 0.95 |
| needs an external service | 0.40 | 0.09 | 0.88 |
| tool/format whose exact usage matters | 0.89 | 0.68 | 0.86 |
| project convention not given in the request | 0.70 | 0.48 | 0.84 |
| one of the shortlisted skills gives concrete instructions | 0.92 | 0.83 | 0.84 |
| prescribed steps not given in the request | 0.70 | 0.54 | 0.83 |
| request names a product, platform or format (v2) | 0.96 | 0.94 | 0.77 |

### Injection

The clear-winner rule (wide pick ≥ 0.5, close share ≥ 0.8, P(exact) ≥ 0.95,
need ≥ 0.5), replayed on the v3 rows:
- it fires on 77% of rows that have a gold skill;
- when it fires on such a row, it injects the gold skill in 387 of 389 cases (99.5%);
- counting its 2 firings on the 90 no-skill rows, 387 of its 391 injections (99.0%) are a gold skill.

### Real library, hand-written requests

1,022 skills installed from 30 repos (Superpowers, Impeccable, the skills.sh
top sources, openai/skills, google/skills, huggingface/skills,
trailofbits/skills, cloudflare/skills, getsentry/skills, dotnet/skills…),
with requests written by hand rather than generated from descriptions:

| Requests | Result |
|---|---|
| 11 niche tasks (zeroize audit, YARA rule, Durable Objects, JSON Canvas, ZeroGPU, MAUI Shell, BigQuery slots, Lean proof, Zarr, PyG, Remotion) | 11/11 loaded the right skill; 9 injected as clear winners |
| 2 tasks with several acceptable skills (planning, frontend design) | both loaded acceptable skills (`brainstorming` + `writing-plans`; `impeccable` + `frontend-design`) |
| 3 everyday tasks (rename, off-by-one question, dependency bump) | 3/3 loaded nothing (need 0.08–0.36) |
| 2 requests naming a skill (`/systematic-debugging`, `test-driven-development`) | 2/2 injected |

18/18 pass at the default settings ($0.018; reproduce with
`npx tsx bench/handwritten.ts`, cases in `bench/data/handwritten.jsonl`). One
everyday request ("bump lodash…") scored need 0.45, close to the 0.5 gate. A
small sample, not a benchmark, but free of the description-vocabulary bias.

### End to end in the agents

Headless (`claude -p`, `codex exec`, Codex CLI 0.160.1 with gpt-6.1-sol):

| Check | Claude Code | Codex |
|---|---|---|
| Selected skill reaches the agent and is read | ✓ (plugin) | ✓ (prompt listing; canary line reproduced) |
| Selected MCP server starts and its tool is called | ✓ (Windows claude.exe, WSL path translated) | ✓ (`-c mcp_servers.…`, with `autoApprove`) |
| Injected skill is followed | ✓ JSON Canvas on haiku | ✓ JSON Canvas on gpt-5.6-luna |

Claude declined to print the canary line from the test skill, calling it an
injected directive. That is reasonable behaviour, and it confirms the skill
was read.

### Caveats specific to the benchmark (from the review)

- The "top 50 most-installed" arm's 12% recall in v1/v2 is mostly a product of
  the sampling design (20 of 169 positive tasks target popular skills). It
  shows that a fixed popular set misses niche tasks; it is not a measured
  coverage rate.
- 4 of 169 tasks contain their gold skill's name written with spaces (e.g.
  "write behat scenarios"). The generator's leak check now catches that form.
- `jev-latest` is a moving target. The need probe was answered by
  `jev-1.13.0`. The v3 routing rows did not record the model (0 of 597); routing
  records now store it (`raw.model`).


## v2: two-stage Jev router (2026-10-05)

Router: BM25 retrieval to 200 candidates → wide Jev request (choice over all
200 + "no skill needed", three need questions, model tier) → close Jev request
on the top 8 (graded fit + choice) → selection rule in code. Details in
[DESIGN.md](../DESIGN.md#router).

**Tuned on dev, reported on test.** Tasks are split by hash: 69 dev tasks, 130
test tasks. The selection rule was grid-searched on the stored dev answers
(2,700 rules, no API calls) under the constraint "load something on at most 35%
of no-skill tasks". The test split was not looked at while choosing. Chosen:
load when P(made for exactly this) ≥ 0.6 and close share ≥ 0.03, only if need
≥ 0.5, at most 3; offer up to 4 more with fit ≥ 0.7. Raw rows and the
generated report: `results/2026-10-05T21-39-18-popular+bm25+hybrid+loadout/`.

### Headline: 20,000-skill library, test split

| Arm | Gold skill loaded | Gold ranked first | Skills loaded | Loads something when none is needed | Router cost / task | Latency |
|---|---:|---:|---:|---:|---:|---:|
| Top 50 most-installed | 12% | — | 50 | 100% | — | — |
| BM25 top 10 | 88% | 72% | 10 | 100% | ~$0 | 0.1 s |
| BM25 + embeddings top 10 | 90% | 75% | 10 | 100% | ~$0 | 0.2 s |
| Jev v1 (yes/no per skill) | 97% | 65% | 9.4 | 80% | $0.00086 | 0.8 s |
| **Jev v2 (loadout)** | **93%** | **90%** | **1.5** | **5%** | **$0.00077** | **1.0 s** |

With the optional extras, the gold skill is available to the agent in 95% of
tasks at 20k (3.2 skills loaded or offered). Pooled over 1k, 5k and 20k on
test: 95% loaded, 96% available, 92% ranked first, 1.3 loaded, 5% needless loads.

v2 trades 4 points of recall against v1 for an 84% cut in skills loaded, +25
points of top-1, and staying quiet on 95% of tasks that need no skill.

### The need gate is the main lever (test, pooled)

| Need ≥ | Gold loaded | Gold available | Loads something when none is needed |
|---:|---:|---:|---:|
| off | 98% | 99% | 72% |
| 0.4 | 98% | 99% | 68% |
| **0.5** | **95%** | **96%** | **5%** |
| 0.6 | 81% | 82% | 0% |
| 0.7 | 58% | 58% | 0% |

Without the gate, v2 loads the gold skill 98% of the time. The gate costs 3
points of recall and removes almost all needless loads.

### The fit number means something (dev, all reread candidates)

| Fit (expected level ÷ 3) | Candidates | Of which gold | Ranked first in close choice |
|---|---:|---:|---:|
| < 0.7 | 1,098 | 0% | 0–4% |
| 0.7–0.9 | 155 | 0–4% | 4–9% |
| 0.9–0.95 | 57 | 5% | 7% |
| 0.95–1 | 346 | 49% | 53% |

Below 0.7 a candidate is essentially never the gold skill, which is why 0.7 is
the threshold for offering extras. Within 0.95–1, roughly half are gold, and
most of the rest are near-duplicates that would serve the task as well. The
gold label is a lower bound on precision.

### Where the remaining misses are (test)

| Library | Gold among the 200 candidates | Gold in the close 8 | Gold loaded |
|---:|---:|---:|---:|
| 1,000 | 100% | 100% | 96% |
| 5,000 | 100% | 100% | 96% |
| 20,000 | 98% | 98% | 93% |

At 20k, 2 points are lost to retrieval and 5 to selection. Across all test
sizes, of 16 misses: 11 were the need gate silencing a real task, 2 never
reached the close shortlist, 2 were cut by the 3-skill cap, and 1 lost the
close choice to a lookalike. The need questions are the next thing to improve.

### Embeddings did not help retrieval (no API calls; all 169 gold tasks)

Recall@K: is the gold skill among the top K candidates?

| Library | Retriever | @10 | @50 | @150 | @200 |
|---:|---|---:|---:|---:|---:|
| 20,000 | BM25 | 86% | 93% | 96% | 98% |
| 20,000 | embeddings (bge-small-en) | 78% | 83% | 87% | 88% |
| 20,000 | BM25 + embeddings (RRF) | 87% | 93% | 96% | 97% |

Every combination tried (RRF; BM25 top N plus embedding top M) matched or
trailed plain BM25 with a larger cutoff. The skills BM25 misses, embeddings
miss too (e.g. `agent-browser` ranks 869th by BM25 and 7,769th by
embeddings for a "click through the staging checkout" task). Two caveats: the
tasks were written from the skill descriptions, which favours exact terms, and
bge-small is a small model. Embedding fusion stays in the code, opt-in, for
real-world queries.

### Caveats

- The dev split is small (69 tasks). The chosen rule is simple (3 thresholds,
  1 cap), and test results came out at or above dev.
- Tasks are synthetic (see v1 caveats below). A hand-written task set is still
  the most important missing check.
- No end-to-end runs yet: this measures what reaches the agent, not whether the
  agent then finishes the task.

## v1 results (superseded): one yes/no question per skill

199 generated tasks (169 with a gold skill, 30 needing none) against libraries
of 100 to 20,000 real skills from GitSkills. Method and caveats:
[README.md](README.md). Raw rows: `results/2026-10-05T20-59-50-popular+bm25+jev/`
and `results/2026-10-05T20-59-53-frontier/`.

### Headline: 20,000-skill library

| Arm | Recall | Skills in context | Description tokens / request | Router cost / task | Router latency |
|---|---:|---:|---:|---:|---:|
| Top 50 most-installed (today's default) | **12%** | 50 | 5,251 | — | — |
| Everything installed | — | 20,000 | ~1,507,000 (does not fit) | — | — |
| BM25 top 10 | 86% | 10 | 901 | ~$0 | 0.16 s |
| **loadout (Jev)** | **96%** | 9.4 | < 870 | **$0.00086** | **0.77 s** |
| Frontier model reads everything | — | — | — | infeasible at this size | — |

Jev at threshold 0.8 (now the default). The table at 0.5 is in the raw
summary; recall is the same, with 11.9 skills selected.

### Against a frontier model (same 20 tasks, 100-skill library)

| | Recall | Skills selected | Cost / task | Latency |
|---|---:|---:|---:|---:|
| Sonnet reads all 100 descriptions | 100% | 1.45 | $0.035 | 9.5 s |
| **Jev (threshold 0.8)** | **100%** | 2.1 | **$0.0004** (85× less) | **0.44 s** (22× faster) |

One frontier data point at 1,000 skills: $0.48 and 8.9 s for a single
routing decision (75k tokens of descriptions). Jev at 1,000: $0.0008, 0.68 s.

### Recall as the library grows

| Library | Top 50 installed | BM25 top 10 | Jev |
|---:|---:|---:|---:|
| 100 | 12% | 100% | 99% |
| 1,000 | 12% | 97% | 99% |
| 5,000 | 12% | 92% | 99% |
| 20,000 | 12% | 86% | 96% |

By bucket at 20,000: popular 85%, head 96%, torso 100%, tail 96%;
repo-specific skills 97%, general 93% (threshold 0.8).

### Ranking quality (recall@k: gold skill ranked within the top k)

| Library | Arm | @1 | @3 | @5 | @12 |
|---:|---|---:|---:|---:|---:|
| 1,000 | BM25 | 83% | 91% | 93% | 98% |
| 1,000 | Jev | 91% | 98% | 99% | 100% |
| 20,000 | BM25 | 69% | 79% | 84% | 87% |
| 20,000 | Jev | 63% | 88% | 92% | 96% |

### Findings

1. **The status quo misses almost everything.** The 50 most-installed skills
   cover 12% of tasks (only the ones written for popular skills) and cost
   5,251 tokens on every request.
2. **Jev holds recall as the library grows, for under a tenth of a cent.**
   It holds 96–99% recall from 100 to 20,000 skills, and puts fewer
   description tokens in context than the top-50 setup.
3. **Jev is a recall filter, not a precise ranker.** Its yes/no scores are
   compressed: the gold skill's median p is 0.95, while the top score on
   tasks that need no skill is 0.935. Consequences:
   - top-1 at 20k is worse than BM25 (63% vs 69%);
   - a threshold cannot detect "no skill needed": those tasks still get
     4.4 skills at 0.8;
   - the cutoff is a cliff: recall falls from 93% at 0.9 to 64% at 0.95.

   That fits the design (the agent makes the final call), but precision is
   the main thing left to improve.
4. **Prefilter misses account for most of the remaining misses.** 4 of 7
   misses at 20k never reached Jev: BM25 did not rank the gold skill in its
   top 200. These are paraphrases like "open the staging checkout and click
   through it" → `agent-browser`, and generic popular skills
   (`codebase-design`, `diagnosing-bugs`). An embedding prefilter is the
   obvious fix.

### Threats to validity

- **Tasks are written from skill descriptions**, so they share vocabulary with
  them. BM25 (and therefore the prefilter) is likely optimistic; real requests
  are terser and less aligned. A hand-written task set is needed to confirm.
- **The gold label is a lower bound.** Other selected skills may serve the
  task equally well; they count as noise here.
- **The frontier comparison is n = 20 at 100 skills**, plus one point at 1,000.
- **Model-tier choice is not evaluated yet** (Jev chose medium for 155/199
  tasks, small 31, large 13); that needs end-to-end runs.
- **Costs are API-equivalent** as reported by the Claude CLI (which includes
  cache-write premiums) and by TypeSafe's usage field.

### Next experiments

1. **Precision:** in the same Jev request, add one `choice` question over the
   candidates plus "none". Its probabilities are relative, which should fix
   top-1 and detect tasks that need no skill.
2. **Embedding prefilter** to remove the paraphrase misses.
3. **Hand-written tasks** (~30) as a check against the vocabulary bias.
4. **End-to-end pilot** (does the routed agent actually finish more tasks, for
   less?), possibly on `claude plugin eval`.
