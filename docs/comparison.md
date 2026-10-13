# loadout and the alternatives

What each alternative solves, what its own documentation says about limits,
and what loadout adds. Facts about other projects come from their docs, README
or source. They were read on 2026-10-12 and read again in full on
**2026-10-13**: GitHub sources are pinned to the commit named in the Sources
column, and live documentation pages carry that access date. "Not found" means
a primary source did not state it; "not verified" means the source could not be
read from here. Facts about loadout come from its
source (`src/`), the [README](../README.md), [DESIGN](../DESIGN.md),
[AGENTS.md](../AGENTS.md), [RESULTS](../bench/RESULTS.md) and
[hosts.md](hosts.md). The only measurement against an alternative is B1,
quoted in the two native-skills rows: per-request input cost of the native
listings against adding loadout's MCP server. Nothing else was run head to
head, and "not compared" says so. Figures about other projects (toolsift's
recall and token savings) are theirs, quoted from their documentation; any
interval marked "computed for this page" was calculated here from their
numbers. Loadout's own figures are quoted from RESULTS, except the intervals
marked the same way.

| Alternative | What it solves, and its limits | Sources (read in full 2026-10-13) | What loadout adds |
|---|---|---|---|
| **Claude Code, native skills** | Lists every skill name plus its description to the model on every turn. Budget: 1% of the context window, with a fallback of 8,000 characters; past it, descriptions are dropped starting with the least-invoked skills, names stay. Each description (with `when_to_use`) is capped at 1,536 characters. Tunable with `skillListingBudgetFraction`, `SLASH_COMMAND_TOOL_CHAR_BUDGET`, `skillListingMaxDescChars`. Curation: `skillOverrides` can list a skill by name only or hide it (plugin skills excepted; those are managed through `/plugin`); `disable-model-invocation` removes a skill from Claude's context entirely; `paths` globs limit when a skill loads automatically; skills in nested folders load the first time Claude works on files there; `/skill-doctor` (Claude Code v2.1.252 or later) reports each skill's cost and use. | Live pages, accessed 2026-10-13 (no commit to pin): [Skills docs](https://code.claude.com/docs/en/skills): "Skill descriptions are cut short", the frontmatter reference, `skillOverrides`, nested directories; [env vars](https://code.claude.com/docs/en/env-vars) (`SLASH_COMMAND_TOOL_CHAR_BUDGET`) | The library stays outside the host listing, so the per-request cost does not follow library size by design. Measured in B1 ([RESULTS](../bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request); Haiku, first request, isolated CLI configuration, generated skill names): the listing grew about 10 tokens per skill, to +12,283 input tokens for 1,232 skills (30 of the 1,262 copied were not discovered), against +546 for adding the loadout MCP server (whether tool search deferred its tools was not recorded). The +546 leaves out the Jev calls and the hook's added context: about 1.6k characters in one measured run ([RESULTS](../bench/RESULTS.md#the-hook-plugin-in-the-claude-code-cli-2026-10-08)), plus up to 12,000 characters of `SKILL.md` for each skill it injects (one the user named, or a clear winner; `src/launch.ts`). RESULTS records that the listing cap does not bound the growth; whether descriptions were dropped was not recorded. The cost with real skill names is not shown. |
| **Codex, native skills** | Lists name, description and path of each skill; each description is capped at 1,024 characters. Budget: 2% of the context window, 8,000 characters when the window is unknown, or a configured budget capped at 10,000 tokens. Past it, descriptions are shortened, then dropped, then skills are omitted with a warning. The order depends on the render path: host-catalog skills are sorted by scope (system, admin, repo, user), then name; the extension path keeps catalog order and uses a skill's short description when it has one; when executor, cloud and host skills share one budget, their lines are laid out executor, cloud, host, and once even bare names no longer fit, the later lines (host last) are omitted first. Curation: an `include_instructions` switch drops the listing; per-skill `enabled` and `prompt_visible` flags hide a skill; a `$name` mention injects that skill's instructions. | Source at commit 0c329ad: [`render.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/ext/skills/src/render.rs) (constants, ordering, warning text; byte-identical to rust-v0.160.1, the version B1 ran), [`extension.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/ext/skills/src/extension.rs), [`world_state_catalogs.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/ext/skills/src/world_state_catalogs.rs), [`selection.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/ext/skills/src/selection.rs). The [Codex skills docs](https://developers.openai.com/codex/skills) are not verified: they could not be fetched from this session, so the figures above are the source's, not the docs'. | Same decoupling. B1 (offline, rendered characters only): the rendered prompt stops growing at about +15.7k characters by 50–64 skills; with 1,024 and 1,262 skills installed, **424** were visible to Codex. Because Codex bounds its listing, loadout's saving in Codex is bounded too; its size and Codex's token cost are not shown. |
| **Claude Code, MCP tool search** | Defers MCP tool definitions: only tool names and server instructions load at start, the model searches and loads the rest. On by default; `ENABLE_TOOL_SEARCH=auto:N` defers only past N% of the window; `alwaysLoad` exempts a server. Needs Sonnet 4.5, Haiku 4.5, Opus 4.5 or later. Off by default with a non-first-party `ANTHROPIC_BASE_URL`; setting `ENABLE_TOOL_SEARCH` explicitly overrides that. It cannot override three cases: `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` keeps tool search off (managed settings can keep it on); Microsoft Foundry deployments hosted on Azure reject it, so tools load upfront; and on Google Cloud's Agent Platform, models earlier than the Claude 4.5 generation keep loading tools upfront. That section of the docs covers MCP tools; it does not mention skills. | Live page, accessed 2026-10-13: [MCP docs, "Scale with MCP tool search"](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search) | Not compared. loadout's gateway (`server_tools`, `call_server_tool`) does a similar job for library servers marked `"gateway": true`; it is untested in every host that supports it ([hosts.md](hosts.md)). What loadout's launcher does differently is pick which MCP servers a session gets from a library, instead of searching tools of servers already configured. |
| **Codex, `tool_search`** | A built-in `tool_search` tool; its description template says it searches apps/connectors tool metadata with BM25 (default 8 results). The source keeps the old `tool_search` flag as a no-op "now that tool_search is always enabled", and says MCP tools are always deferred when it is available. It is offered only when the model's metadata sets `supports_search_tool` (false in the fallback metadata for unknown models); otherwise MCP tools load directly. A separate `skill_search` feature (stable, on by default) runs cheap skill selectors (BM25, LRU, character n-grams, routing cards) in shadow mode: it records metrics and does not change what the model sees. No Codex docs page for either was reachable, so neither is verified against the docs. | Source at commit 0c329ad: [`features/src/lib.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/features/src/lib.rs), [`search_tool/tool_description.md`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/core/templates/search_tool/tool_description.md), [`tool_discovery.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/tools/src/tool_discovery.rs), [`spec_plan.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/core/src/tools/spec_plan.rs), [`model_info.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/models-manager/src/model_info.rs), [`dynamic_skill_selector.rs`](https://github.com/openai/codex/blob/0c329ad2c9d5a2592128a1d536c66e16f9397e46/codex-rs/ext/skills/src/dynamic_skill_selector.rs) | Not compared; same note as the Claude Code row. Whether `tool_search` covers skills: not found. |
| **MCP gateway: [toolsift](https://github.com/abdulmunimjemal/toolsift)** | A local MCP proxy: it connects to the upstream servers, indexes their tools, and exposes `search_tools` and `invoke_tool`. BM25 by default; optional local embeddings or a hybrid (opt-in `@huggingface/transformers`). No API key, no telemetry, MIT. The figures in this row are toolsift's own, from its BENCHMARKS.md (not run by us, and not in [RESULTS](../bench/RESULTS.md)). That file measures retrieval only (is the labelled tool in the top 5), in a single run on one machine, on 129 queries its author wrote across six corpora "modelled on" public MCP servers. On all six merged (60 tools), recall@5 was 0.62 (BM25), 0.80 (hybrid) and 0.83 (embeddings), with 91-93% fewer tool-definition tokens (counted with `gpt-tokenizer`). On its 28-tool built-in set, 28 queries (the README's `toolsift eval` output), recall@5 was 0.89 (BM25) to 1.00 (embeddings), with 82-83% fewer tokens. Upstream gives rates and no intervals: the Wilson 95% intervals computed for this page, from the sample size and the rounded recall, are 53-70% (BM25) and 76-88% (embeddings) on the 129, and 73-96% and 88-100% on the 28. Whether the model then picks the tool is not measured; that eval mode is planned. Neither file mentions skills. Live tool-list change subscriptions are not wired in yet. | At commit 079158a: [README](https://github.com/abdulmunimjemal/toolsift/blob/079158a74cccbc8da867728c8f2b8aeef90476b4/README.md), [BENCHMARKS.md](https://github.com/abdulmunimjemal/toolsift/blob/079158a74cccbc8da867728c8f2b8aeef90476b4/BENCHMARKS.md) | Not compared. If the problem is only many MCP servers, toolsift needs no key and no model call. loadout adds skills, a model-tier pick, and a model judgement of fit instead of lexical or embedding rank alone. That judgement costs two Jev requests per routed decision; in [C1](../bench/RESULTS.md#c1-2026-10-08-new-held-out-requests) a whole routing decision took a mean 1.92 s and $0.0012. |
| **Model router: [jev-router](https://github.com/gargpratyush/jev-router)** | `jev-claude` and `jev-codex` each start a loopback proxy, launch the real CLI, and forward its authorization headers (Claude Code through `ANTHROPIC_BASE_URL`). One Jev call per fresh user turn picks a tier, and policy rules adjust it (an explicit "use opus" wins, failures keep the current model, low confidence never downgrades). Default models: Haiku / Sonnet / Opus, and gpt-5.6-luna / terra / sol (set with `JEV_CODEX_*_MODEL`); an opt-in long tier, Fable / `gpt-6-astra`, with `JEV_ALLOW_FABLE=1`. Routing is enabled by `JEV_API_KEY` (`TYPESAFE_API_KEY` also works); if Jev fails, the CLI keeps its current model. Its README says the user's prompt text is sent to TypeSafe for each decision and "Nothing else is", while its own example of the Jev request also shows the current tier and context size, and it says Jev is sent the models in the account's catalog. It was developed and tested on Windows against Claude Code v2.1.101 and Codex v0.154.0, and says those CLIs' request formats are not public contracts. MIT. It reports no benchmark or savings figure. Its README describes tier routing only, not skill or MCP-server selection, and it ships one `jev-explain` skill. | At commit 38da6b8: [README](https://github.com/gargpratyush/jev-router/blob/38da6b84ea01241bfc41fbddc0928d0f40a703f0/README.md) (whole README read, 2026-10-13) | Tier choice is one of loadout's outputs, and [DESIGN](../DESIGN.md) credits jev-router for the tier criteria. loadout's launcher picks a tier once, from the first prompt; that pick is untested in a host and not shown to be sensible (backlog C3, [hosts.md](hosts.md) note 2). loadout does not proxy traffic ([DESIGN non-goals](../DESIGN.md#non-goals)); hosts without a launcher keep the user's model. It adds skill and MCP selection, which jev-router's README does not describe. Not compared on tier quality. loadout sends TypeSafe more than the prompt: see [What loadout sends to TypeSafe](#what-loadout-sends-to-typesafe). |
| **Directory: [skills.sh](https://github.com/vercel-labs/skills) and its `npx skills` CLI** | A directory and installer for `SKILL.md` skills: `npx skills add <repo>` installs skills into the agent's skills folder by symlink to a canonical copy (recommended) or as copies (`--copy`), for Claude Code, Codex, Cursor and 75 more agents. `npx skills find` searches interactively or by keyword. `npx skills use <source>` writes the selected skill files to a temporary folder and, by default, only prints the generated prompt to stdout (the README pipes it to `claude`); with `--agent` it starts one supported agent interactively with that prompt. Neither mode installs the skill. Anonymous telemetry: GitHub repository and skill identifiers are sent only for repositories GitHub confirms are public, but other remote source types may include source and skill identifiers in install telemetry. Security-audit requests are limited to confirmed-public GitHub repositories. `DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` turns off both. skills.sh also links audits: the [audits page](https://www.skills.sh/audits) and the [API docs](https://www.skills.sh/docs/api). Neither could be fetched from this session (the egress proxy returned 403 on 2026-10-13), so what they cover, which providers report, and how complete the coverage is are not verified. Number of skills listed: not found (a third-party count was not used). | At commit 13e4063: [vercel-labs/skills README](https://github.com/vercel-labs/skills/blob/13e4063a1cf913f5606d57d42ab83a86f5001e04/README.md) (whole README read, 2026-10-13); skills.sh pages not verified | A directory finds and installs skills; its README describes no per-request choice among installed skills, so with `npx skills add` every installed skill still lands in, or is dropped from, the host listing above. `npx skills use` avoids that for one skill at a time, and the user picks the skill. loadout keeps downloaded skills in its own library and treats their text as untrusted ([AGENTS.md](../AGENTS.md), rule 5). It does not host, rate or vet a directory. Not compared with directory search. |
| **List: [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)** | A hand-picked list of "official Agent Skills from leading development teams and the community" ("1497+" in a README badge; 1,142 list entries, counted with `grep -c -E '^- \*\*\[' README.md`, so what the badge counts is not clear). The maintainers "do not audit, endorse, or guarantee the security or correctness of listed projects". | At commit bca04bc, the head of `main` on 2026-10-13: [README](https://github.com/VoltAgent/awesome-agent-skills/blob/bca04bcb9d33f8d59cd32300da63787e5594be4a/README.md) (whole README read; the badge and the entry count are both from this snapshot) | Same as the directory row. Not compared. |

## What loadout adds

- **A shortlist from a large library** (1,262 real skills here; 20,000 real
  skills on synthetic tasks in
  [v2](../bench/RESULTS.md#headline-20000-skill-library-test-split)). On the
  1,262-skill library with Opus as the judge, on requests the router was never
  tuned on
  ([C1](../bench/RESULTS.md#c1-2026-10-08-new-held-out-requests), 95% Wilson):
  a useful skill was loaded for 73% (62-81) of the 84 test-split requests (of
  201) that need one, and nothing was loaded for 74% (65-81) of those that
  need none. 64% (55-72) of loaded skills were useful and 7% (4-13) would
  mislead. The C1 table in RESULTS sets these against v4, whose numbers
  overstated precision.
- **Skills, MCP servers and a model tier from one routing decision, through
  the launcher only** (`loadout claude|codex`); the tier is set at launch and
  is untested ([hosts.md](hosts.md) note 2). Inside the stock CLIs, the prompt
  hook adds skills only, and `find_skills` searches skills, plus gateway
  servers over stdio. No API-traffic proxy: CLI flags, hooks, plugin and MCP
  ([hosts.md](hosts.md) says which parts are verified in which host).
- **Agents use what is put in front of them**
  ([RESULTS](../bench/RESULTS.md#do-agents-use-what-they-are-given); small
  samples; the 95% Wilson intervals are computed for this page, RESULTS gives
  counts only). In headless runs of `bench/invoke.ts`, which replays
  stored routing decisions (Claude Code on Sonnet 5.5, Codex on
  gpt-6.1-sol), 9 of 10 (60-98%, Claude Code) and 11 of 11 (74-100%, Codex)
  sessions opened a loaded skill. With nothing preloaded, the search tool and
  the prompt hook (installed through a settings file, as `loadout setup
  claude-code` prints it), 6 of 10 (31-83%) Claude Code sessions opened a
  useful skill. The hook-only plugin is not measured.

## What loadout sends to TypeSafe

With Jev routing on and a key set, each routed decision makes two Jev
requests (`src/route.ts`). Both carry:

- the task: the user's prompt (prompt hook; the launcher and `loadout route`,
  first prompt only), or the agent's goal and keywords (`find_skills`, over
  stdio and HTTP);
- signals from one folder: the session's folder for the hook, the folder the
  host started `loadout mcp` in (both transports), the current folder for the
  launcher and `loadout route`. They are its name; up to 40 top-level file
  and folder names, dotfiles included (only `.git*` and `node_modules` are
  left out); dependency names from `package.json`, and for other ecosystems
  only the manifest's file name (such as `Cargo.toml`); and file extensions
  (`src/repo.ts`);
- names and descriptions of candidates. When two share a name, the name adds
  its origin: a GitHub `owner/repo`, or a local folder's absolute path. The
  hook and `loadout mcp --http` send skills only; stdio `find_skills` sends
  skills and gateway servers; the launcher and `loadout route` send skills and
  all library MCP servers (`src/hook.ts`, `src/mcp.ts`, `src/cli.ts`).

The second request adds the opening of shortlisted `SKILL.md` files. The hook
routes every prompt of 3 words or more, and shorter ones with a word starting
with `/`, `@` or `$` (`isFollowUp` in `src/hook.ts`), in every project
([README](../README.md#search-mid-session-from-any-mcp-host), Privacy).
`"router": "lexical"` in loadout's config keeps all of it local.

## What loadout does not do, or does not show

- **No outcome gain is shown.** The 8-request pilot (Codex gpt-6.1-sol;
  requests picked because a specific skill exists; the loadout arm got the
  judge's top skill, injected for 7 of 8) gave loadout better in 4 (95%
  Wilson 22-78%, computed for this page), bare in 3 (14-69%), one split (2-47%)
  ([RESULTS](../bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)).
- **Small libraries: native listing is cheaper.** At 50 skills, adding
  loadout's MCP server cost more than the native listing (+546 against +477
  tokens in Claude Code; tool-search state not recorded). The crossover on
  real libraries is not measured.
- **Jev routing needs a TypeSafe key and two Jev requests per routed
  decision.** Without a key, `find_skills` and the launcher fall back to
  keyword ranking (the launcher with the default medium tier), and the prompt
  hook adds nothing unless the prompt names a skill. Native listings, tool
  search and toolsift make no call to a second model.
- **Latency.** The hook holds each routed prompt for 1,543 ms (p50) and
  1,645 ms (p95) before the agent starts (one WSL machine, n = 20,
  [RESULTS](../bench/RESULTS.md#routed-prompts-with-the-library-scan-cache-d11-2026-10-12)).
  A hung Jev request costs one 8 s timeout, plus start-up and any completed request, before the keyword
  fallback; the hook's deadline is 20 s
  ([RESULTS](../bench/RESULTS.md#the-hook-plugin-in-the-claude-code-cli-2026-10-08)).
- **Untested hosts and parts.** The Codex hook in a live session, the desktop
  and IDE hosts, the gateway and the tier ([hosts.md](hosts.md)).
- **Multi-turn cost in money is not shown**, for loadout or for the native
  listings (B1 measured the first request only).
