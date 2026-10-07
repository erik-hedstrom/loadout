# loadout — design

## Problem

Every capability installed into a coding agent is paid for on every request,
whether it is relevant or not:

- **Tokens and latency.** Tool schemas and skill descriptions sit in context on
  every turn.
- **Accuracy.** Tool selection degrades as the menu grows; similar-looking
  tools get confused.
- **Model overkill.** Everything runs on the biggest model, even trivial edits.

The cost is global but the value is local. A niche skill that is excellent for
one repo is net-negative everywhere else, so people prune and the long tail of
very specific tools never gets installed.

**loadout decouples library size from per-request cost.** A very cheap
System One model ([Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev))
looks at the task and the repo, then picks the model and a deliberately
over-inclusive shortlist of skills and MCP servers from a library that can be
arbitrarily large. The agent still makes the final call from the shortlist.

## Non-goals

- **No traffic interception.** loadout never sits between a CLI and its model
  provider, never forwards a CLI's auth headers, and never depends on private
  request formats. Everything goes through official extension points (CLI
  flags, plugins, MCP, hooks), so vendors have no reason or mechanism to block
  it. (Contrast: [jev-router](https://github.com/gargpratyush/jev-router) routes
  per turn through a loopback proxy on `ANTHROPIC_BASE_URL`.)
- **No per-turn tool swapping.** Tool definitions sit at the front of the
  prompt cache; changing them per turn would cost more than the bloat saved.

## Architecture

```
            ┌──────────────── library (~/.loadout/library) ────────────────┐
            │ skills/<name>/SKILL.md      mcp.json (+ description per server) │
            └───────────────────────────────┬───────────────────────────────┘
                                            │ scan
 task + repo signals ──► [1] retrieve (BM25, local, free) ──► 200 candidates
                                            │
                         [2] Jev wide:  choice over 200 + "no skill needed"
                                        3 nouls → need score · model tier
                                            │ top 8
                         [3] Jev close: graded fit score per candidate
                                        choice among the 8 + "no skill needed"
                                            │
                         [4] decide (code): load ≤ 3 · offer fit ≥ 0.7 · or stay quiet
                                            │
            ┌───────────────────────────────┴────────────────────────────┐
     Claude Code launcher                                     Codex launcher
     --model <alias>                                          -m <model>
     --plugin-dir <generated plugin with chosen skills>       -c mcp_servers.<n>.…
     --mcp-config <generated mcp.json>                        skills + relevance note in the prompt
     --append-system-prompt <relevance note>
```

### Integration layers

loadout **adds** its selection to a session; it does not isolate one. The
user's own skills, plugins, MCP servers and approval policies stay active.
Isolation needs per-CLI support that is not uniform yet (Claude Code has
`--strict-mcp-config`; Codex `exec` has `--ignore-user-config`).


| Layer | When | Claude Code | Codex |
|---|---|---|---|
| **Launcher** (v0.1) | once per session | `--model`, `--plugin-dir`, `--mcp-config` | `-m`, `-c` overrides |
| **Search server** (`loadout mcp`) | mid-session, on demand | `find_skills`, `load_skill`, gateway to library MCP servers; attached by the launcher | same — Codex speaks MCP |
| **Prompt hook** (`loadout hook claude`) | every prompt | `UserPromptSubmit` adds the skills that fit as context (cache-safe: appended to the user turn), once per skill per session | if/when hooks support it |
| **HTTP** (`loadout mcp --http`) | remote hosts | — | ChatGPT chat, behind an HTTPS tunnel; skills only, optional bearer token |

The launcher fixes the session's tool set up front, which also keeps the prompt
cache intact. The gateway is the escape hatch when the router misses.

### Library

Capabilities live in `~/.loadout/library`, a directory no agent loads by
itself. Users install as many skills and MCP servers as they like; nothing is
paid for until loadout selects it.

- **Skills:** `skills/<name>/SKILL.md` (the [Agent Skills](https://agentskills.io)
  format: YAML frontmatter with `name` and `description`).
- **MCP servers:** `mcp.json`, standard `{"mcpServers": {...}}` plus an
  optional `description` per server (used for routing, stripped on launch).

Skills the user installed directly into `~/.claude/skills` stay always-on;
loadout does not touch them.

### Router

Two Jev requests, following TypeSafe's own
[skill-suggestion recipe](https://docs.typesafe.ai/cookbooks/skill_suggestion):
a cheap ranking over everything, then a close look at a few. Jev answers
literal, atomic questions; every decision rule is code (`decide()` in
`src/route.ts`), so it can be tuned on stored answers without new API calls.

1. **Retrieve.** BM25 over name + description, fused (RRF) with local
   `bge-small-en` embeddings when the optional `@huggingface/transformers` is
   installed; the query is the task text plus repo signals (name, top-level
   files, dependencies, languages). Keeps the top `maxCandidates` (200). Local
   and free: the library is embedded once (about a minute for 1,000 skills; new
   skills at `loadout add`). On the synthetic benchmark the embeddings added
   nothing; on realistic, detailed requests they kept the judge's best skill in
   the candidates 87% of the time vs 80% for BM25 alone, because long prompts
   dilute keyword scores (see [bench/RESULTS.md](bench/RESULTS.md), v4).
2. **Wide request.** All in one call, evaluated in parallel:
   - `pick`: one Choice over the candidates plus `no_skill_needed`. Its
     probabilities are relative, which separates lookalikes.
   - two Nouls about the request: does an expert follow a documented
     procedure, tool or service workflow? Could a strong general programmer
     do it with only reading/editing code and ordinary commands (inverted)?
   - `model_tier`: a Choice over small / medium / large, with structured
     criteria (what, signals, not for), after jev-router.
3. **Close request.** The top 8 wide picks are reread with their full
   description and the opening of their `SKILL.md`. Per candidate:
   - a graded Score: unrelated / same area but no help / helps with part /
     made for exactly this. The expected level ÷ 3 is the **fit** shown to the
     user (0–1).
   - a Noul: is this skill *specifically* about something the request names
     (a product, service, tool, format, framework, project process) rather than
     a general coding practice?

   Plus one Choice among the 8 and `no_skill_needed`, for ordering (**share**).
4. **Decide** (`decide()`, rules tuned on dev splits):
   - **need** = mean(procedure, ¬general, specificity of the top candidate);
     below 0.5, nothing is loaded or offered;
   - **load** candidates with P(made for exactly this) ≥ 0.8 and share ≥ 0.1,
     plus the **winner** of the close comparison (share ≥ 0.5) when its
     expected fit is ≥ 0.7; at most 3 skills and 2 MCP servers. The winner
     rule came from the judged sweep of detailed requests (v4): a long request
     asks for several things, so the right format or domain skill is "helps with
     part" while clearly the best, whereas generic process skills ("plan, then
     implement") match a step-by-step request "exactly";
   - **offer** up to 4 more skills with fit ≥ 0.7, marked optional, so the
     agent's scope is broader than the router's pick;
   - **inject** the top skill's full SKILL.md when it is a clear winner (wide
     pick ≥ 0.5, close share ≥ 0.8, P(exact) ≥ 0.95). Measured: it fires on
     ~77% of tasks that have a right skill. 99.0% of its injections are a gold
     skill (99.5% counting only tasks that have one).
5. **Mentions override.** A library skill the user explicitly names is loaded
   and injected whatever the router or gate said, in request order, at most 3
   (more gives a warning).
   - Counted: `/tdd`, `@pdf`, `$pdf`, `/loadout:pdf`, a multi-part name as
     written (`zx-ledger-reconcile`), or the name next to "skill" ("the pdf skill").
   - Not counted: path segments (`/pdf/report.py`), negations ("do not use
     /pdf"), and plain prose.
   - If several installed skills share the name, the one the router rated best
     is used, and it replaces the other copies.
6. **Tell the agent where to look**, without forcing it (TypeSafe's measured
   wording), via `--append-system-prompt` for Claude Code and the prompt for
   Codex:

   ```
   <skill_relevance>
   Most relevant to the current request: loadout:agent-browser. Also available if
   needed: loadout:playwright-debug. Ignore this if it does not fit what the user
   actually asked for.
   </skill_relevance>
   ```

   Injected skills go into the **user turn**, never the system prompt, as
   `<skill name="…" source="…" trust="third-party">` blocks:
   - capped at 12k characters, with a pointer to the full file;
   - the block cannot close itself early, and its header attributes are escaped;
   - the framing says the text is guidance that cannot override the user, the
     agent's instructions or approval settings.

   The system prompt only gains one line saying such blocks are reference
   material. Delimiters do not make prompt injection impossible: injection
   raises the authority of third-party text compared with listing the skill, so
   it is limited to clear winners and explicit mentions, and can be turned off
   (`"inject": {"enabled": false}`).
7. **Degrade, don't block.** Jev responses are validated; rate limits, server
   errors and timeouts are retried once; if Jev is still unavailable, loadout
   falls back to keyword ranking with a visible warning.

Cost: ~16k tokens wide plus ~4k close ≈ **$0.0008 and ~1 s per decision**.
Measured limits (2026-10-05): no per-request question cap below 200, state
billed once, Choice capped at 255 options, 64k-token context.

Things that did not work, and why they are not used:
- **One yes/no question per candidate (v1).** Scores came back compressed
  (gold ≈ 0.95, the best wrong candidate on a no-skill task ≈ 0.935), so no
  threshold could separate them; v1 loaded ~9 skills per task and loaded
  something on 80% of tasks that needed nothing.
- **Request-only "is this named/specialised?" questions.** `need_named`
  scored 0.958 on gold tasks and 0.946 on no-skill tasks (AUC 0.77): every
  request names *something*. Replaced by the per-candidate specificity
  question. Alternatives proposed in review ("prescribed steps not given",
  "project convention not given", "calls an external service") separated
  worse (AUC 0.83–0.88) than the current pair (0.97 each).
- **Letting an exact fit override the need gate.** In a 20k library some skill
  always looks like an exact fit for everyday requests; overriding brought
  needless loads back from 5% to 37–63%.

### Search server (`loadout mcp`)

The launcher decides once, up front. When the work drifts (a debugging
session turns into "now write the release notes"), the agent can search the
library itself, in its own words, through MCP:

- **`find_skills(goal, keywords?)`** runs the same two Jev requests on the
  agent's goal. It returns at most 5 matches with fit ≥ 0.5, one line each
  (key, fit, a 180-character description), with the exact next call. The need
  gate is softened, since the agent asked: when Jev judges the goal to be
  general work, only near-certain exact fits (P ≥ 0.8) are shown. Otherwise
  the answer says nothing fits and names the closest skill, so the agent does
  not load a near miss. About 1 s and $0.001 per search.
- The tool description and the server's `instructions` ask for a search
  before the first specialised step, even in a familiar domain, and again when
  the domain changes. Measured uptake is still partial (bench/RESULTS.md, v4),
  which is why the launcher's upfront pick stays the main path.
- **`load_skill(skill, file?)`** returns the SKILL.md as attributed
  third-party reference material (the same framing as injection) plus a list of
  the skill's files. A file is read only inside the skill folder: no `..`, no
  absolute paths, no links, no binaries, 256 KB at most.
- **Gateway**: `server_tools` / `call_server_tool` reach the library's MCP
  servers, started on first use and kept for the session. Registered only when
  the library has servers, so a skills-only library costs two tool definitions.

Context cost is the point: the two skill tools are ~400 tokens of definitions,
and a search returns ~150–300 tokens, versus thousands of tokens of skill
descriptions held in context all session.

Approvals: the launcher pre-approves only `find_skills` and `load_skill`
(Claude `--allowedTools`, Codex `tools.<tool>.approval_mode = "approve"`).
They only read the user's own library. `call_server_tool` keeps the host's
prompt, which shows the server, tool and arguments.

### Router backends

- `jev` (default): TypeSafe official API, `TYPESAFE_API_KEY`.
- `lexical`: prefilter only, no network. For offline use and as a benchmark arm.
- `openrouter` (planned): a small generative model with JSON output, for users
  without Jev access.

## Benchmark (the pitch)

Implemented in [bench/](bench/). First results, routing only:
[bench/RESULTS.md](bench/RESULTS.md).

Same task set, five arms:

1. **Bare** — no extra skills.
2. **Top-N by stars** — what people install today.
3. **Everything installed** — the full library dropped into the agent. Expect
   description budgets to truncate silently; showing that is itself a result.
4. **Native search** — the vendor's own tool search / deferred loading.
5. **loadout** — Jev routing over the full ~20k-skill library.

Metrics: task success, total cost (router included), latency, and router
recall (did the shortlist contain the skill the task needed). The headline
result to show: a niche skill that lifts a task in one specific repo while
every other repo pays nothing for it.

`claude plugin eval` already runs eval suites with a no-plugin baseline arm;
worth evaluating as the harness before building our own.

## Open questions

- **Native Codex skills per session.** Codex 0.160 discovers skills in
  `~/.codex/skills`, plugins and project `.agents/skills`, but has no
  per-session extra skill root. Today selected skills are listed in the prompt
  with their paths (verified: Codex reads and follows them) and clear winners
  are injected.
- **Isolation mode.** An opt-in flag that hides the user's own MCP servers and
  skills for a session.
- **Dynamic tool exposure.** The gateway exposes library MCP servers through
  one generic `call_server_tool`. MCP's `tools/list_changed` could add a
  server's real tools to the session instead (native schemas, per-tool
  approvals) on hosts that honour it.
- **Independent evaluation.** Requests written by people who never saw the
  skill descriptions, with several acceptable skills per request, and
  end-to-end task outcomes, not just what was loaded.
- **The model tier.** Jev's tier choice is not evaluated yet.
