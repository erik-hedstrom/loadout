<!-- Profile README for github.com/erik-hedstrom: copy into the repo erik-hedstrom/erik-hedstrom as README.md. Erik publishes. -->

<!-- Erik: one line about you (name, what you do, where you want to work) -->

## loadout

[loadout](https://github.com/erik-hedstrom/loadout) picks the skills for each coding-agent prompt, and the MCP servers and model tier too when it launches the session (`loadout claude|codex`; whether the tier reaches the agent, and whether Jev picks sensible tiers, is not yet verified), out of a large library (1,262 skills in the realistic benchmark). TypeSafe's Jev makes the call, so routed prompts go to TypeSafe's API. Each routing decision (query embedding, retrieval and two Jev requests) cost $0.0012 and took 1.92 s on average over C1's 300 decisions, 2 of which fell back to keyword ranking, run in-process two at a time on one machine, without the hook's start-up ([C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)). It plugs into the stock `claude` and `codex` CLIs through plugins, hooks and MCP; there, the prompt hook adds skills and the user keeps their model. In Claude Code the hook ran in headless `claude -p` sessions (the plugin in one run, a settings-file hook in 10); in Codex the plugin was installed only offline and no live session has run it ([hosts](https://github.com/erik-hedstrom/loadout/blob/main/docs/hosts.md)).

**Measured** (95% Wilson intervals)
- **C1:** on 201 test-split requests (of 300 new ones, untuned), a useful skill was loaded for 61 of the 84 that need one: 73% (62-81%) ([C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)).
- **Hook:** in Claude Code (Sonnet 5.5), 10 requests, runs capped at 8 turns or 4 minutes, nothing preloaded, a useful skill was opened in 6 sessions (31-83%) with MCP search plus the prompt hook, against 2 (6-51%) with search alone; the intervals overlap, so the gain is not shown at this size ([agent runs](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#do-agents-use-what-they-are-given)).

**Not shown, or did not hold**
- **Precision:** on the same 201 requests, 64% of 128 loaded skills (55-72%) were useful and 9 (7%, 4-13%) would mislead. With the same code on v4's 213 test-split requests, which came from a set already used for tuning, it was 80% of 153 (73-86%) and 2 (1%, 0-5%). Intervals here are per loaded skill and ignore within-request correlation ([C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)).
- **Better work:** not shown. In an 8-request, nominally blind pilot with Codex, on requests picked because a specific skill exists (a skill's template can show in the output, so the judge may tell the arms apart), loadout was better in 4 (22-78%), worse in 3 and split in 1; two of the three losses hit the 6-minute cap ([pilot](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)).
- **Latency:** an earlier C1 run, while Jev was slow, fell back to keyword ranking on 98 of 300 requests and took a median 9.8 s on the 202 that answered ([C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)).

**Engineering**
- **Split and held-out data.** Requests split by hash into a third for tuning and two thirds for reporting. The original 315 requests had been used for tuning twice, so the C1 benchmark used 300 new ones, recorded as written by Codex (gpt-6.1-sol) with no library in view; the files backend leaves that provenance, and so the cross-family judging, unverified. Claude Opus judged ([C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)).
- **Two reviews in the merge gate.** Each PR is meant to get a read-only Claude `pr-reviewer` pass and a Codex adversarial review. CI runs on Linux for each push to `main` or a PR, and on Linux, macOS and Windows once a PR is labelled for merge. `main` has no branch protection, so this is process, not enforcement. On the credential-hardening PR ([#4](https://github.com/erik-hedstrom/loadout/pull/4)), both reviewers found High or Medium issues in the first round, and the PR went through several more review rounds before both approved.
- **Claude and Codex on one backlog.** Codex (Sol) and Claude workers build items from [one backlog](https://github.com/erik-hedstrom/loadout/blob/main/docs/loop/BACKLOG.md), and a Claude orchestrator merges.

More: the [README](https://github.com/erik-hedstrom/loadout#readme) and [all results](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md).

<!-- Erik: optional links (contact, other projects) -->
