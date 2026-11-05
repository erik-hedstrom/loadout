# C15 native library comparison

20 measured runs; 2 warm-ups excluded; 0 invalid rows. Codex thread totals, not per-request usage.

Effective input = uncached input x 1 + cache write x 1 + cached input x 0.1. The 0.1 multiplier is a fixed price-sheet assumption ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)), not verified Luna subscription billing. Output tokens and Jev costs are separate. Positive native minus loadout means input savings for loadout.

| Prompt | Repeat | Arm | Uncached | Cache write | Cached | Output | Effective input | Tool calls | Skills opened | Hook context chars | skillsBudget |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| c1-questions-06 | 1 | loadout | 1,947 | 0 | 11,392 | 527 | 3,086.2 | 0 | none observed | 0 | null |
| c1-questions-06 | 1 | native | 8,692 | 0 | 11,392 | 536 | 9,831.2 | 0 | none observed | 0 | {"descriptionsRemoved":true,"omitted":888} |
| c1-business-26 | 1 | native | 12,153 | 0 | 51,456 | 3,066 | 17,298.6 | 1 | none observed | 0 | {"descriptionsRemoved":true,"omitted":888} |
| c1-business-26 | 1 | loadout | 9,647 | 0 | 36,864 | 3,423 | 13,333.4 | 1 | none observed | 3836 | null |
| c1-documents-22 | 1 | loadout | 1,951 | 0 | 11,392 | 197 | 3,090.2 | 0 | none observed | 0 | null |
| c1-documents-22 | 1 | native | 8,696 | 0 | 11,392 | 233 | 9,835.2 | 0 | none observed | 0 | {"descriptionsRemoved":true,"omitted":888} |
| c1-integrations-06 | 1 | native | 1,274 | 0 | 18,816 | 137 | 3,155.6 | 0 | none observed | 0 | {"descriptionsRemoved":true,"omitted":888} |
| c1-integrations-06 | 1 | loadout | 1,953 | 0 | 11,392 | 136 | 3,092.2 | 0 | none observed | 0 | null |
| c1-business-27 | 1 | loadout | 17,062 | 0 | 265,600 | 10,922 | 43,622 | 9 | none observed | 716 | null |
| c1-business-27 | 1 | native | 18,405 | 0 | 158,976 | 8,122 | 34,302.6 | 6 | none observed | 0 | {"descriptionsRemoved":true,"omitted":888} |
| c1-questions-07 | 1 | native | 8,689 | 0 | 11,392 | 386 | 9,828.2 | 0 | none observed | 0 | {"descriptionsRemoved":true,"omitted":888} |
| c1-questions-07 | 1 | loadout | 1,944 | 0 | 11,392 | 421 | 3,083.2 | 0 | none observed | 0 | null |
| c1-business-23 | 1 | loadout | 3,700 | 0 | 39,168 | 622 | 7,616.8 | 1 | none observed | 2862 | null |
| c1-business-23 | 1 | native | 10,861 | 0 | 50,176 | 551 | 15,878.6 | 2 | none observed | 0 | {"descriptionsRemoved":true,"omitted":888} |
| c1-business-20 | 1 | native | 5,596 | 0 | 82,560 | 2,073 | 13,852 | 2 | none observed | 0 | {"descriptionsRemoved":true,"omitted":888} |
| c1-business-20 | 1 | loadout | 9,080 | 0 | 73,088 | 2,945 | 16,388.8 | 3 | idea-refine | 1939 | null |
| c1-productivity-09 | 1 | loadout | 280 | 0 | 13,056 | 93 | 1,585.6 | 0 | none observed | 0 | null |
| c1-productivity-09 | 1 | native | 8,689 | 0 | 11,392 | 92 | 9,828.2 | 0 | none observed | 0 | {"descriptionsRemoved":true,"omitted":888} |
| c1-debug-13 | 1 | native | 18,851 | 0 | 157,312 | 1,977 | 34,582.2 | 5 | none observed | 0 | {"descriptionsRemoved":true,"omitted":888} |
| c1-debug-13 | 1 | loadout | 10,345 | 0 | 147,200 | 2,096 | 25,065 | 7 | none observed | 0 | null |

## Paired native minus loadout

| Prompt | Repeat | Uncached delta | Write delta | Cached delta | Output delta | Effective input delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| c1-questions-06 | 1 | 6,745 | 0 | 0 | 9 | 6,745 |
| c1-business-26 | 1 | 2,506 | 0 | 14,592 | -357 | 3,965.2 |
| c1-documents-22 | 1 | 6,745 | 0 | 0 | 36 | 6,745 |
| c1-integrations-06 | 1 | -679 | 0 | 7,424 | 1 | 63.4 |
| c1-business-27 | 1 | 1,343 | 0 | -106,624 | -2,800 | -9,319.4 |
| c1-questions-07 | 1 | 6,745 | 0 | 0 | -35 | 6,745 |
| c1-business-23 | 1 | 7,161 | 0 | 11,008 | -71 | 8,261.8 |
| c1-business-20 | 1 | -3,484 | 0 | 9,472 | -872 | -2,536.8 |
| c1-productivity-09 | 1 | 8,409 | 0 | -1,664 | -1 | 8,242.6 |
| c1-debug-13 | 1 | 8,506 | 0 | 10,112 | -119 | 9,517.2 |

Missing planned pairs: 10 of 20 (primary plan).

Paired effective-input median 6,745; range -9,319.4 to 9,517.2; n=10.
- c1-questions-06: median 6,745; range 6,745 to 6,745; n=1.
- c1-business-26: median 3,965.2; range 3,965.2 to 3,965.2; n=1.
- c1-documents-22: median 6,745; range 6,745 to 6,745; n=1.
- c1-integrations-06: median 63.4; range 63.4 to 63.4; n=1.
- c1-business-27: median -9,319.4; range -9,319.4 to -9,319.4; n=1.
- c1-questions-07: median 6,745; range 6,745 to 6,745; n=1.
- c1-business-23: median 8,261.8; range 8,261.8 to 8,261.8; n=1.
- c1-business-20: median -2,536.8; range -2,536.8 to -2,536.8; n=1.
- c1-productivity-09: median 8,242.6; range 8,242.6 to 8,242.6; n=1.
- c1-debug-13: median 9,517.2; range 9,517.2 to 9,517.2; n=1.

## Blind quality, both orders

| Prompt | Repeat | First order winner | Reverse order winner | Both-orders verdict |
| --- | ---: | --- | --- | --- |

Quality: not shown (unjudged).
Missing both-orders verdicts: 10 of 10 available pairs.
Hidden c1-debug-13 passes: native 1, loadout 1; 1 paired repeats; missing tests 0.
Primary quality screen: not shown (incomplete or secondary study). Fixed rule: native wins minus loadout wins <= 2 of 20, and loadout hidden passes >= native. This is a screening rule, not proof of non-inferiority; repeated prompts are not independent population samples.
Sensitivity excluding c1-debug-13: paired effective-input median 6,745; range -9,319.4 to 8,261.8; n=9; quality not shown (unjudged). The fixture was previously selected using Jev and judge results; the primary screen is unchanged.
Blindness limitation: a skill's own template can still reveal the arm despite redaction. The judge sees saved files and final responses, not independent quality evidence.

## Cold starts and provenance

- codex/native/warmup/0: uncached 8,566, write 0, cached 11,392, output 5; valid.
- codex/loadout/warmup/0: uncached 1,821, write 0, cached 11,392, output 5; valid.
- {"librarySize":1235,"corpusHash":"8af233e3a090ed0f07aecc67a393dacc0db73d88242ebb13812be6bb939b09a2","manifestHash":"8af233e3a090ed0f07aecc67a393dacc0db73d88242ebb13812be6bb939b09a2"}
- native: codexRetries 0 (including warm-up).
- native: hookTrustNotices 0 (including warm-up).
- loadout: codexRetries 0 (including warm-up).
- loadout: hookTrustNotices 22 (including warm-up).

Not shown: general quality retention, actual subscription cost, per-request Codex usage, other hosts/models, whole-library quality, and Jev dollars (record separately). Ten prompts and an assumed cached price do not establish population savings.
