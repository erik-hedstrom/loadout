# loadout and the alternatives

What each alternative solves, what its own documentation says about limits,
and what loadout adds. Facts about other projects come from their docs, README
or source, read on **2026-10-12**; "not found" means a primary source did not
state it. Facts about loadout come from
[RESULTS](../bench/RESULTS.md) or [hosts.md](hosts.md). Nothing here is a
head-to-head measurement: loadout was not run against any row below, and
"not compared" says so.

| Alternative | What it solves, and its limits | Sources (read 2026-10-12) | What loadout adds |
|---|---|---|---|
| **Claude Code, native skills** | Lists every skill name plus its description to the model on every turn. Budget: 1% of the context window; past it, descriptions are dropped starting with the least-invoked skills, names stay. Each description (with `when_to_use`) is capped at 1,536 characters. Tunable with `skillListingBudgetFraction`, `SLASH_COMMAND_TOOL_CHAR_BUDGET`, `skillListingMaxDescChars`; `skillOverrides` can list a skill by name only. | [Skills docs](https://code.claude.com/docs/en/skills), "Skill descriptions are cut short" and the frontmatter reference | The library stays outside the host listing, so the per-request cost does not follow library size by design. Measured in B1 ([RESULTS](../bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)): the listing grew about 10 tokens per skill, to +12,283 input tokens for 1,232 skills on the first request, against +546 for the loadout MCP server (isolated CLI configuration, generated skill names). About 10 tokens per generated skill name fits the documented behaviour (descriptions dropped, names kept); the cost with real skill names is not shown. |
| **Codex, native skills** | Lists name, description and path of each skill. Budget: about 2% of the context window, 8,000 characters when the window is unknown. Past it, descriptions are shortened first (each capped at 1,024 characters in the source), then dropped, then skills are omitted with a warning. | Source: [`render.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/ext/skills/src/render.rs) (constants and warning text), commit 0c329ad. The [Codex skills docs](https://developers.openai.com/codex/skills) could not be fetched from this session; a search excerpt of them gave the same 2% / 8,000 figures. | Same decoupling. B1 (offline, rendered characters only): with 1,024 and 1,262 skills installed, **424** were visible to Codex. Codex's token cost and loadout's cost in Codex are not shown. |
| **Claude Code, MCP tool search** | Defers MCP tool definitions: only tool names and server instructions load at start, the model searches and loads the rest. On by default; `ENABLE_TOOL_SEARCH=auto:N` defers only past N% of the window; `alwaysLoad` exempts a server. Needs Sonnet 4.5, Haiku 4.5, Opus 4.5 or later. Off by default with a non-first-party `ANTHROPIC_BASE_URL`; setting `ENABLE_TOOL_SEARCH` explicitly overrides that. The page describes MCP tools only; skills are not mentioned. | [MCP docs, "Scale with MCP tool search"](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search) | Not compared. loadout's gateway (`server_tools`, `call_server_tool`) does a similar job for library servers marked `"gateway": true`; it is untested in every host that supports it ([hosts.md](hosts.md)). What loadout does differently is pick which MCP servers a session gets from a library, instead of searching tools of servers already configured. |
| **Codex, `tool_search`** | A built-in `tool_search` tool ranks deferred tools with BM25 (default 8 results). The source says MCP tools are always deferred when `tool_search` is available. Which models or settings make it available: not found. No Codex docs page for it was reachable. | Source: [`features/src/lib.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/features/src/lib.rs), [`search_tool/tool_description.md`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/core/templates/search_tool/tool_description.md), [`tool_discovery.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/tools/src/tool_discovery.rs), commit 0c329ad | Not compared; same note as the Claude Code row. Whether it covers skills: not found. |
| **MCP gateway: [toolsift](https://github.com/abdulmunimjemal/toolsift)** | A local MCP proxy: it connects to the upstream servers, indexes their tools, and exposes `search_tools` and `invoke_tool`. BM25 by default; optional local embeddings or a hybrid. No API key, no telemetry, MIT. Its README reports, on its own 28-tool set, recall@5 0.89 (BM25) to 1.00 (embeddings) with 82-83% fewer tokens; its end-to-end accuracy mode is on its roadmap. The README does not mention skills. Live tool-list changes are not wired in yet. | [README](https://github.com/abdulmunimjemal/toolsift) (the BENCHMARKS.md it cites was not read) | Not compared. If the problem is only many MCP servers, toolsift needs no key and no model call. loadout adds skills, a model-tier pick, and a model judgement of fit instead of lexical or embedding rank alone. That judgement costs two Jev requests per routed decision (together a mean $0.0012 and 1.92 s in [C1](../bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)) |
| **Model router: [jev-router](https://github.com/gargpratyush/jev-router)** | Picks a model tier for each fresh user turn with one Jev call, then launches Claude Code or Codex on that model (Haiku / Sonnet / Opus, gpt-5.6-luna / terra / sol; an opt-in long tier, Fable / `gpt-6-astra`, with `JEV_ALLOW_FABLE=1`). It needs `JEV_API_KEY` or `TYPESAFE_API_KEY`, and sends the user's prompt text to TypeSafe for each decision, as loadout does. The README says it forwards the CLI's authorization headers, and Claude Code goes through `ANTHROPIC_BASE_URL`. MIT. It reports no benchmark or savings figure. It does not route skills or MCP servers; it ships one `jev-explain` skill. | [README](https://github.com/gargpratyush/jev-router) | Tier choice is one of loadout's outputs, and [DESIGN](../DESIGN.md) credits jev-router for the tier criteria, but loadout's tier pick is untested in a host and not shown to be sensible (backlog C3, [hosts.md](hosts.md) note 2). loadout does not proxy traffic ([DESIGN non-goals](../DESIGN.md#non-goals)); hosts without a launcher keep the user's model. It adds skill and MCP selection, which jev-router does not do. Not compared on tier quality. |
| **Directory: [skills.sh](https://github.com/vercel-labs/skills) and its `npx skills` CLI** | A directory and installer for `SKILL.md` skills: `npx skills add <repo>` installs skills into the agent's skills folder by symlink to a canonical copy (recommended) or as copies (`--copy`), for Claude Code, Codex, Cursor and others. The README mentions security-audit requests for public GitHub repos; what skills.sh audits and shows could not be checked (the site was blocked). Number of skills listed: not found (skills.sh could not be fetched; a third-party count was not used). | [vercel-labs/skills README](https://github.com/vercel-labs/skills) | A directory finds and installs skills; it does not choose among them per request, so every installed skill still lands in, or is dropped from, the host listing above. loadout keeps downloaded skills in its own library and treats their text as untrusted ([AGENTS.md](../AGENTS.md), rule 5). It does not host, rate or vet a directory. Not compared with directory search. |
| **List: [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)** | A hand-curated list of agent skills from "official dev teams and the community" ("1000+" in its About text, "1497+" in a badge). Describes itself as hand-picked; the visible part of the README states no security review. | [README](https://github.com/VoltAgent/awesome-agent-skills) (first 100,000 of 227,137 characters read) | Same as the directory row. Not compared. |

## What loadout adds

- **A shortlist from a library of any size.** On the 1,262-skill library
  with Opus as the judge, on requests the router was never tuned on
  ([C1](../bench/RESULTS.md#c1-2026-10-08-new-held-out-requests), 95% Wilson):
  a useful skill was loaded for 73% (62-81) of the 84 test-split requests (of
  201) that need one. 64% (55-72) of loaded skills were useful and 7% would
  mislead. On v4's requests (since used for tuning)
  ([v4 run C](../bench/RESULTS.md#v4-2026-10-06-realistic-requests-on-the-real-library-judged))
  the figures were 76% (68-83), 82% (75-87) and 1%; C1 shows v4 overstated
  precision.
- **Skills, MCP servers and a model tier from one routing decision**, inside the stock
  CLIs, through hooks, plugin and MCP rather than a proxy
  ([hosts.md](hosts.md) says which parts are verified in which host).
- **Agents use what is put in front of them**
  ([RESULTS](../bench/RESULTS.md#do-agents-use-what-they-are-given); small
  samples). Launched with `loadout claude|codex`, 9 of 10 (Claude Code) and 11
  of 11 (Codex) sessions opened a loaded skill. With the prompt hook and search
  tool instead (no launcher), 6 of 10 Claude Code sessions opened a useful
  skill.

## What loadout does not do, or does not show

- **No outcome gain is shown.** The 8-request pilot gave loadout better in 4,
  bare in 3, one split
  ([RESULTS](../bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)).
- **Small libraries: native listing is cheaper.** At 50 skills loadout's tool
  definitions cost more than the native listing (+546 against +477 tokens in
  Claude Code). The crossover on real libraries is not measured.
- **It needs a TypeSafe key and two Jev requests per routed decision**;
  native skills, tool search and toolsift need neither.
- **Multi-turn cost in money is not shown**, for loadout or for the native
  listings (B1 measured the first request only).
