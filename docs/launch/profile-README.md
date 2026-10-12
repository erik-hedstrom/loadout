<!-- Profile README for github.com/erik-hedstrom: copy into the repo erik-hedstrom/erik-hedstrom as README.md. Erik publishes. -->

<!-- Erik: one line about you (name, what you do, where you want to work) -->

## loadout

[loadout](https://github.com/erik-hedstrom/loadout) picks the skills, MCP servers and model tier for each coding-agent session or prompt, out of a library of any size. A very cheap model (TypeSafe's Jev) makes the call, for about $0.0011 and 1-2 s per decision ([v4](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#v4-2026-10-06-realistic-requests-on-the-real-library-judged)). It runs inside the stock `claude` and `codex` CLIs through a plugin, a hook and MCP. TypeScript, Apache-2.0.

**What is measured**
- **Cost of installed skills.** Claude Code lists about 10 more input tokens per installed skill: 12.3k tokens for 1,232 skills. loadout's MCP tool definitions cost 546. At 50 skills they cost more than the native listing (+546 vs +477). Measured with generated skill names, so the cost with real names is not shown ([B1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#b1-results-2026-10-07-what-installed-skills-cost-per-request)).
- **Routing quality**, judged by Claude Opus against a 1,262-skill library. On the test split, a useful skill was loaded for 76% of requests that need one, and 82% of loaded skills were useful ([v4](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#v4-2026-10-06-realistic-requests-on-the-real-library-judged)).
- **Agents use what they are given.** In headless runs, Claude Code opened a loaded skill in 9 of 10 sessions and Codex in 11 of 11 ([agent runs](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#do-agents-use-what-they-are-given)).

**What is not shown**
- **Better work.** An 8-request blind pilot with Codex: loadout won 4, lost 3, split 1. No quality gain shows at that size ([outcome pilot](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)).
- **Precision on new requests.** On 300 new requests the same rule loaded useful skills 64% of the time (95% interval 55-72), against 82% (75-87) on the original test split. Misleading loads rose from 1% to 7%. Recall held ([C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)).

**How the engineering is kept honest** (rules in [AGENTS.md](https://github.com/erik-hedstrom/loadout/blob/main/AGENTS.md))
- **Dev/test split.** Requests split by hash into a third for tuning and two thirds for reporting. Tuning on the test split is not allowed.
- **Held-out requests.** The original 315 requests had been used for tuning twice, so C1 wrote 300 new ones with a model that never saw the library. They exposed the precision drop above. Negative results go into RESULTS too, including a withdrawn token estimate (about 140k, measured at 12.3k).
- **Cross-family judging.** The Codex-written C1 requests were judged by Claude. The judge's first pass does not see loadout's choice.
- **Security.** Skill text is third-party input: it is escaped with `escapeSkillTags` and framed as third-party content, and skill files are read only through `readConfined`. loadout never proxies an agent's API traffic; it uses CLI flags, plugins, hooks and MCP.
- **Two reviews before merge.** Each PR needs a read-only Claude `pr-reviewer` pass and a Codex adversarial review, plus CI on Linux, macOS and Windows. The security hardening PR ([#4](https://github.com/erik-hedstrom/loadout/pull/4)) was blocked by both reviews on two High findings before it merged.
- **Claude and Codex on one backlog.** Codex (gpt-6.1-sol) builds; Claude subagents review, judge and write docs. State lives in branches, PRs and [one backlog file](https://github.com/erik-hedstrom/loadout/blob/main/docs/loop/BACKLOG.md); the [loop is documented](https://github.com/erik-hedstrom/loadout/blob/main/docs/loop/ORCHESTRATOR.md).

<!-- Erik: optional links (contact, other projects) -->
