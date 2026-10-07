B1 deltas over each host baseline; costs are computed in analysis.
Claude baseline: isolated CLI configuration plus the actual inventory recorded from init, including any synced plugins.
Codex baseline: user's ambient setup with the declared model/sandbox/MCP/features overrides.
| Host | Configuration | Call | Input | Delta | Uncached | Cache creation | Cache read | Copied | Discovered pack | Visible pack | Rejected |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| claude | baseline | 1 | 6728 | 0 | 10 | 6718 | 0 | 0 | 0 | unverified | 0 |
| claude | baseline | 2 | 6727 | 0 | 10 | 6717 | 0 | 0 | 0 | unverified | 0 |
| claude | impeccable | 1 | 6944 | 216 | 10 | 6934 | 0 | 1 | 1 | unverified | 0 |
| claude | impeccable | 2 | 6939 | 212 | 10 | 6929 | 0 | 1 | 1 | unverified | 0 |
| claude | superpowers | 1 | 7040 | 312 | 10 | 7030 | 0 | 15 | 15 | unverified | 0 |
| claude | superpowers | 2 | 7035 | 308 | 10 | 7025 | 0 | 15 | 15 | unverified | 0 |
| claude | anthropics | 1 | 7058 | 330 | 10 | 7048 | 0 | 19 | 19 | unverified | 0 |
| claude | anthropics | 2 | 7060 | 333 | 10 | 7050 | 0 | 19 | 19 | unverified | 0 |
| claude | top50 | 1 | 7205 | 477 | 10 | 7195 | 0 | 50 | 50 | unverified | 0 |
| claude | top50 | 2 | 7203 | 476 | 10 | 7193 | 0 | 50 | 50 | unverified | 0 |
| claude | library | 1 | 19011 | 12283 | 10 | 19001 | 0 | 1262 | 1232 | unverified | 0 |
| claude | library | 2 | 19011 | 12284 | 10 | 19001 | 0 | 1262 | 1232 | unverified | 0 |
| claude | loadout | 1 | 7274 | 546 | 10 | 7264 | 0 | 0 | 0 | unverified | 0 |
| claude | loadout | 2 | 7273 | 546 | 10 | 2908 | 4355 | 0 | 0 | unverified | 0 |
Claude baseline init names: {"skills":["design","slides","design-sync","dataviz","artifact-diagramming","artifact-capabilities","update-config","verify","debug","code-review","simplify","batch","fewer-permission-prompts","doctor","loop","schedule","claude-api","run","run-skill-generator"],"plugins":["agents-md","telemetry"],"slashCommands":["design","slides","design-sync","dataviz","artifact-diagramming","artifact-capabilities","update-config","verify","debug","code-review","simplify","batch","fewer-permission-prompts","doctor","loop","schedule","claude-api","run","run-skill-generator","advisor","agents","auto-mode-setup","autocompact","clear","color","compact","config","output-style","context","effort","fast","focus","heapdump","init","mcp","import","model","__remote-workflow","workflow-launch-exec","reload-plugins","reload-skills","rename","ultrareview","security-review","usage-credits","extra-usage","usage","insights","recap","skill-doctor","goal","design-consent","design-revoke","list-agents","team-onboarding"],"mcp":[],"agents":["claude","claude-code-guide","Explore","general-purpose","Plan","statusline-setup"]}.
Claude library/1: omitted, cause unverified (1232/1262).
Claude library/2: omitted, cause unverified (1232/1262).
Codex offline baseline: rendered 21146 characters; copied 0, discovered 0, visible 0.
Codex paid calls deferred (baseline): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex offline superpowers: rendered 24364 characters; copied 15, discovered 15, visible 15.
Codex paid calls deferred (superpowers): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex offline anthropics: rendered 31448 characters; copied 19, discovered 19, visible 19.
Codex paid calls deferred (anthropics): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex offline top50: rendered 36815 characters; copied 50, discovered 50, visible 50.
Codex paid calls deferred (top50): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex offline impeccable: rendered 22189 characters; copied 1, discovered 1, visible 1.
Codex paid calls deferred (impeccable): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex offline library: rendered 36272 characters; copied 1262, discovered 1262, visible 424.
Codex paid calls deferred (library): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex offline loadout: rendered 21144 characters; copied 0, discovered 0, visible 0.
Codex paid calls deferred (loadout): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex offline cap-16: rendered 30340 characters; copied 16, discovered 16, visible 16.
Codex paid calls deferred (cap-16): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex offline cap-64: rendered 36871 characters; copied 64, discovered 64, visible 64.
Codex paid calls deferred (cap-64): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex offline cap-256: rendered 36912 characters; copied 256, discovered 256, visible 256.
Codex paid calls deferred (cap-256): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex offline cap-1024: rendered 36275 characters; copied 1024, discovered 1024, visible 424.
Codex paid calls deferred (cap-1024): preflight: disabled feature unified_exec is enabled or unrecognized.
Codex nested 16: truncation not shown.
Codex nested 64: truncation not shown.
Codex nested 256: truncation not shown.
Codex nested 1024: visible listing truncated.
Codex nested 1262: visible listing truncated.
Codex cap evidence uses nested prefixes of one validated corpus, not unrelated named packs. Reported budget: 2% of context or fallback 8,000 characters (https://developers.openai.com/codex/skills; not reverified offline). A token plateau alone establishes no cause.
Calls 1 and 2 are first/second fresh sessions, not guaranteed cold/warm: use the observed counters. No cache flushing or session resumes. Different arms can share cached prefixes.
Not measured: hooks, scripts, references, commands/agents, pack MCP/LSP servers (starting them executes downloaded code), router calls and output quality. Claude visibility is not exposed by init.
