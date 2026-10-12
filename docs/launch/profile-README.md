<!-- Profile README for github.com/erik-hedstrom: copy into the repo erik-hedstrom/erik-hedstrom as README.md. Erik publishes. -->

<!-- Erik: one line about you (name, what you do, where you want to work) -->

## loadout

[loadout](https://github.com/erik-hedstrom/loadout) picks the skills for each coding-agent prompt, and the MCP servers and model tier too when it launches the session (`loadout claude|codex`), out of a large library (1,262 skills in the realistic benchmark). A small model (TypeSafe's Jev) makes the call: $0.0012 and 1.92 s per decision, the mean of 300 routing calls run in-process, without the hook's start-up ([C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)). It plugs into the stock `claude` and `codex` CLIs through plugins, hooks and MCP; there, the prompt hook adds skills and the user keeps their model. The Claude Code CLI hook is checked in headless sessions; the Codex hook is not ([hosts](https://github.com/erik-hedstrom/loadout/blob/main/docs/hosts.md)).

**Measured** (95% Wilson intervals)
- **C1:** on 201 test-split requests (of 300 new ones, untuned), a useful skill was loaded for 73% (62-81%) of the 84 that need one ([C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)).
- **Hook:** in Claude Code (Sonnet 5.5), 10 requests, runs capped at 8 turns or 4 minutes, nothing preloaded, a useful skill was opened in 6 sessions (31-83%) with MCP search plus the prompt hook, against 2 (6-51%) with search alone ([agent runs](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#do-agents-use-what-they-are-given)).

**What did not hold**
- **Precision:** on the same 201 requests, 64% (55-72%) of loaded skills were useful and 7% (4-13%) would mislead. With the same code on v4's 213 test-split requests, which came from a set already used for tuning, it was 80% (73-86%) and 1% (0-5%). Intervals here are per loaded skill and ignore within-request correlation ([C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests)).
- **Better work:** not shown. In an 8-request blind pilot with Codex, loadout was better in 4 (22-78%), worse in 3 and split in 1; two of the three losses hit the 6-minute cap ([pilot](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)).

**Engineering**
- **Split, held-out data, cross-family judge.** Requests split by hash into a third for tuning and two thirds for reporting. The original 315 requests were used for tuning twice, so C1 wrote 300 new ones with a model that never saw the library. Codex wrote them and Claude judged.
- **Two reviews before merge.** A read-only Claude `pr-reviewer` and a Codex adversarial review, with CI on Linux for every push and on Linux, macOS and Windows before merge. On the credential-hardening PR ([#4](https://github.com/erik-hedstrom/loadout/pull/4)), both reviewers found High or Medium issues in the first round, which were fixed before merge.
- **Claude and Codex on one backlog.** Both build and review each other's PRs from [one backlog](https://github.com/erik-hedstrom/loadout/blob/main/docs/loop/BACKLOG.md); Claude judges.

More: the [README](https://github.com/erik-hedstrom/loadout#readme) and [all results](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md).

<!-- Erik: optional links (contact, other projects) -->
