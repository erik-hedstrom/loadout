<!-- Profile README for github.com/erik-hedstrom: copy into the repo erik-hedstrom/erik-hedstrom as README.md. Erik publishes. -->

<!-- Erik: one line about you (name, what you do, where you want to work) -->

## loadout

[loadout](https://github.com/erik-hedstrom/loadout) picks the skills, MCP servers and model tier for each coding-agent session or prompt, out of a library of any size. A very cheap model (TypeSafe's Jev) makes the call, at $0.0012 and 1.9 s per decision on average. It runs inside the stock `claude` and `codex` CLIs.

**Measured** ([C1](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#c1-2026-10-08-new-held-out-requests), [agent runs](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#do-agents-use-what-they-are-given); 95% Wilson intervals)
- On 201 test-split requests (of 300 new ones, untuned), a useful skill was loaded for 73% (62-81%) of the requests that need one.
- Claude Code opened a useful skill in 6 of 10 sessions (31-83%) with the search tool plus the prompt hook, against 2 of 10 (6-51%) with search alone. With the launcher preloading the selection, agents opened a loaded skill in 9 of 10 (60-98%) and 11 of 11 (74-100%) sessions.

**What did not hold**
- On those requests, 64% (55-72%) of loaded skills were useful, against 82% (75-87%) on the original test split ([v4](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#v4-2026-10-06-realistic-requests-on-the-real-library-judged)).
- Better work is not shown: in an 8-request blind pilot, loadout won 4, lost 3 and split 1 ([pilot](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md#is-the-work-better-outcome-pilot-2026-10-07)).

**Engineering**
- **Split, held-out data, cross-family judge.** Requests split by hash into a third for tuning and two thirds for reporting. The original 315 requests were used for tuning twice, so C1 wrote 300 new ones with a model that never saw the library. Codex wrote them and Claude judged.
- **Two reviews before merge.** A read-only Claude `pr-reviewer` and a Codex adversarial review, with CI on Linux for every push and on Linux, macOS and Windows before merge. The first round on the credential-hardening PR ([#4](https://github.com/erik-hedstrom/loadout/pull/4)) found 2 High and 1 Medium from Codex and 3 Medium from `pr-reviewer`.
- **Claude and Codex on one backlog.** Both build and review each other's PRs from [one backlog](https://github.com/erik-hedstrom/loadout/blob/main/docs/loop/BACKLOG.md); Claude judges.

More: the [README](https://github.com/erik-hedstrom/loadout#readme) and [all results](https://github.com/erik-hedstrom/loadout/blob/main/bench/RESULTS.md).

<!-- Erik: optional links (contact, other projects) -->
