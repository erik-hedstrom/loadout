# A/B pilot report

12 measured runs, 2 warm-up runs, 0 excluded; 6 judged pairs. Three hand-picked prompts where the router loaded something the C1 judge rated useful, so no general claim follows. Two repeats per cell: ranges, not intervals. Tokens are the host's own usage report; uncached input, cache writes, cache reads and output are never summed.

## 1. Per run, measured runs only (warm-ups excluded)

Mean (min–max) over repeats. Cache share = cache read / (uncached + write + read). Effective input = uncached + 1.25 × 5-minute write + 2 × 1-hour write + 0.1 × read (Anthropic's published multipliers; Claude only). Cost is the stream's `total_cost_usd`, a nominal API price. Codex reports a thread total only.

| Host | Prompt | Arm | Runs | Uncached in | Cache write | Cache read | Output | Cache share | Effective in | Cost | Turns | Time | Hidden test | Judge (loadout vs bare) |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| codex | c1-web-14 | bare | 2 | 3,299 (1,959–4,638) | 0 | 23,680 (11,392–35,968) | 262 (118–406) | 87% (85%–89%) | not shown | not shown | not shown | 10 s (7 s–12 s) | — |  |
| codex | c1-web-14 | loadout | 2 | 8,007 (6,642–9,371) | 0 | 42,496 (37,248–47,744) | 462 (358–565) | 84% (84%–85%) | not shown | not shown | not shown | 20 s (19 s–20 s) | — | loadout 1, bare 0, tie 0, split 1 |
| codex | c1-apps-08 | bare | 2 | 1,954 | 0 | 11,392 | 463 (434–491) | 85% | not shown | not shown | not shown | 11 s (10 s–13 s) | — |  |
| codex | c1-apps-08 | loadout | 2 | 10,291 (9,014–11,568) | 0 | 41,152 (34,176–48,128) | 903 (722–1,083) | 80% (79%–81%) | not shown | not shown | not shown | 25 s (20 s–29 s) | — | loadout 2, bare 0, tie 0, split 0 |
| codex | c1-debug-13 | bare | 2 | 13,850 (7,755–19,944) | 0 | 135,232 (99,200–171,264) | 2,188 (2,088–2,287) | 91% (90%–93%) | not shown | not shown | not shown | 41 s (41 s–42 s) | 0 of 2 |  |
| codex | c1-debug-13 | loadout | 2 | 17,170 (13,282–21,057) | 0 | 95,232 (82,816–107,648) | 1,850 (1,645–2,054) | 84% (80%–89%) | not shown | not shown | not shown | 41 s (38 s–44 s) | 2 of 2 | loadout 0, bare 2, tie 0, split 0 |

## 2. loadout − bare (mean of the repeats; negative is cheaper)

| Host | Prompt | Δ uncached | Δ cache write | Δ cache read | Δ output | Δ effective in | Δ cost | Hook context (chars) | Skills named / injected / opened |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| codex | c1-web-14 | +4,708 | 0 | +18,816 | +200 | not shown | not shown | 2,810 (1,006–4,614) | ux-copy, brand-guidelines--getsentry / ux-copy / ux-copy |
| codex | c1-apps-08 | +8,337 | 0 | +29,760 | +440 | not shown | not shown | 3,211 | user-research, to-questionnaire, brainstorming / user-research / — |
| codex | c1-debug-13 | +3,320 | 0 | -40,000 | -338 | not shown | not shown | 0 | — / — / — |

## 3. Request 1 against requests 2+ (per request, uncached / write / read)

Request 1 carries the prompt-specific hook context, which cannot be cached on first use; later requests should read it from cache. A loadout − bare difference that stays in "uncached" or "write" on requests 2+ means the injected text is paid every turn. Subagent requests are billed in every total but left out of this split. Codex: not shown (`codex exec --json` reports one thread total).

| Host | Prompt | Arm | Request 1 | Requests 2+ (mean per request) | Main-thread requests per run | Subagent requests (all runs) |
| --- | --- | --- | --- | --- | ---: | ---: |

## 4. Cold start (warm-up run) against warm (measured runs)

The first run of each arm writes that arm's own prefix to the cache (the arms' prefixes differ), so it is reported here and excluded from every other table. Per request: uncached / write / read; Codex: whole-run totals.

| Host | Arm | Warm-up request 1 | Measured request 1 (mean) | Warm-up run total | Measured run total (mean) |
| --- | --- | --- | --- | --- | --- |
| codex | bare | not shown | not shown | 1,820 / 0 / 11,392 | 6,367 / 0 / 56,768 |
| codex | loadout | not shown | not shown | 1,820 / 0 / 11,392 | 11,822 / 0 / 59,627 |

## 5. Flags

- codex/loadout/c1-debug-13/1: the hook added no context, so this run may measure the bare setup
- codex/loadout/c1-debug-13/2: the hook added no context, so this run may measure the bare setup

## 6. Not shown

- Per-request usage for Codex, its model name and its cost: `codex exec --json` gives a thread total only.
- Quality beyond the blind pairwise judge and the hidden test; the judge sees file contents only, with skill names removed, so a skill's own template can still reveal the arm.
- Anything about prompts other than these three, or about a random sample of requests.
