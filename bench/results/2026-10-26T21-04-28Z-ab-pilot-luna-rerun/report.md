# A/B pilot report

12 measured runs, 2 warm-up runs, 0 excluded; 6 judged pairs. Three hand-picked prompts where the router loaded something the C1 judge rated useful, so no general claim follows. Two repeats per cell: ranges, not intervals. Tokens are the host's own usage report; uncached input, cache writes, cache reads and output are never summed.

## 1. Per run, measured runs only (warm-ups excluded)

Mean (min–max) over repeats. Cache share = cache read / (uncached + write + read). Effective input = uncached + 1.25 × 5-minute write + 2 × 1-hour write + 0.1 × read (Anthropic's published multipliers; Claude only). Cost is the stream's `total_cost_usd`, a nominal API price. Codex reports a thread total only.

| Host | Prompt | Arm | Runs | Uncached in | Cache write | Cache read | Output | Cache share | Effective in | Cost | Turns | Time | Hidden test | Judge (loadout vs bare) | Wrote a file |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| codex | c1-web-14 | bare | 2 | 2,349 (1,972–2,726) | 0 | 24,640 (11,392–37,888) | 262 (126–397) | 89% (85%–93%) | not shown | not shown | not shown | 8 s (5 s–10 s) | — |  | 1 of 2 |
| codex | c1-web-14 | loadout | 2 | 6,827 (3,780–9,873) | 0 | 35,008 (30,720–39,296) | 394 (374–413) | 83% (76%–91%) | not shown | not shown | not shown | 12 s (12 s–13 s) | — | loadout 1, bare 1, tie 0, split 0 | 2 of 2 |
| codex | c1-apps-08 | bare | 2 | 1,967 | 0 | 11,392 | 544 (473–615) | 85% | not shown | not shown | not shown | 9 s (9 s–9 s) | — |  | 0 of 2 |
| codex | c1-apps-08 | loadout | 2 | 8,398 (4,534–12,262) | 0 | 47,616 (39,552–55,680) | 1,319 (1,275–1,363) | 86% (82%–90%) | not shown | not shown | not shown | 21 s (20 s–21 s) | — | loadout 2, bare 0, tie 0, split 0 | 2 of 2 |
| codex | c1-debug-13 | bare | 2 | 8,834 (8,174–9,493) | 0 | 166,976 (164,736–169,216) | 2,446 (2,221–2,671) | 95% (95%–95%) | not shown | not shown | not shown | 33 s (30 s–36 s) | 2 of 2 |  | 2 of 2 |
| codex | c1-debug-13 | loadout | 2 | 15,759 (12,984–18,533) | 0 | 102,208 (95,872–108,544) | 2,131 (1,849–2,412) | 87% (85%–88%) | not shown | not shown | not shown | 34 s (32 s–37 s) | 2 of 2 | loadout 0, bare 1, tie 0, split 1 | 2 of 2 |

## 2. loadout − bare (mean of the repeats; negative is cheaper)

| Host | Prompt | Δ uncached | Δ cache write | Δ cache read | Δ output | Δ effective in | Δ cost | Hook context (chars) | Skills named / injected / opened |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| codex | c1-web-14 | +4,478 | 0 | +10,368 | +132 | not shown | not shown | 503 (0–1,006) | ux-copy, brand-guidelines--getsentry / — / — |
| codex | c1-apps-08 | +6,431 | 0 | +36,224 | +775 | not shown | not shown | 2,204 (1,196–3,211) | user-research, to-questionnaire, brainstorming / user-research / to-questionnaire, user-research, brainstorming |
| codex | c1-debug-13 | +6,925 | 0 | -64,768 | -315 | not shown | not shown | 0 | — / — / — |

## 3. Request 1 against requests 2+ (per request, uncached / write / read)

Request 1 carries the prompt-specific hook context, which cannot be cached on first use; later requests should read it from cache. A loadout − bare difference that stays in "uncached" or "write" on requests 2+ means the injected text is paid every turn. Subagent requests are billed in every total but left out of this split. Codex: not shown (`codex exec --json` reports one thread total).

| Host | Prompt | Arm | Request 1 | Requests 2+ (mean per request) | Main-thread requests per run | Subagent requests (all runs) |
| --- | --- | --- | --- | --- | ---: | ---: |

## 4. Cold start (warm-up run) against warm (measured runs)

The first run of each arm writes that arm's own prefix to the cache (the arms' prefixes differ), so it is reported here and excluded from every other table. Per request: uncached / write / read; Codex: whole-run totals.

| Host | Arm | Warm-up request 1 | Measured request 1 (mean) | Warm-up run total | Measured run total (mean) |
| --- | --- | --- | --- | --- | --- |
| codex | bare | not shown | not shown | 1,833 / 0 / 11,392 | 4,383 / 0 / 67,669 |
| codex | loadout | not shown | not shown | 1,833 / 0 / 11,392 | 10,328 / 0 / 61,611 |

## 5. Flags

- codex/loadout/c1-web-14/1: the hook added no context, so this run may measure the bare setup
- codex/loadout/c1-debug-13/1: the hook added no context, so this run may measure the bare setup
- codex/loadout/c1-debug-13/2: the hook added no context, so this run may measure the bare setup

## 6. Not shown

- Per-request usage for Codex, its model name and its cost: `codex exec --json` gives a thread total only.
- Quality beyond the blind pairwise judge and the hidden test; the judge sees saved files and final responses (when captured), with skill names removed, so a skill's own template can still reveal the arm.
- Anything about prompts other than these three, or about a random sample of requests.
