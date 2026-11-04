# C15 native library comparison

40 measured runs; 2 warm-ups excluded; 0 invalid rows. Codex thread totals, not per-request usage.

Effective input = uncached input x 1 + cache write x 1 + cached input x 0.1. The 0.1 multiplier is a fixed price-sheet assumption ([OpenAI pricing](https://developers.openai.com/api/docs/pricing)), not verified Luna subscription billing. Output tokens and Jev costs are separate. Positive native minus loadout means input savings for loadout.

| Prompt | Repeat | Arm | Uncached | Cache write | Cached | Output | Effective input | Tool calls | Skills opened | Hook context chars | skillsBudget |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
| c1-questions-06 | 1 | loadout | 1,955 | 0 | 11,392 | 460 | 3,094.2 | 0 | none observed | 0 | null |
| c1-questions-06 | 1 | native | 8,180 | 0 | 11,392 | 523 | 9,319.2 | 0 | none observed | 0 | null |
| c1-business-26 | 1 | native | 21,781 | 0 | 61,824 | 3,469 | 27,963.4 | 2 | process-doc | 0 | null |
| c1-business-26 | 1 | loadout | 15,524 | 0 | 30,720 | 3,411 | 18,596 | 1 | none observed | 3519 | null |
| c1-documents-22 | 1 | loadout | 1,959 | 0 | 11,392 | 220 | 3,098.2 | 0 | none observed | 0 | null |
| c1-documents-22 | 1 | native | 12,664 | 0 | 6,912 | 212 | 13,355.2 | 0 | none observed | 0 | null |
| c1-integrations-06 | 1 | native | 8,186 | 0 | 11,392 | 139 | 9,325.2 | 0 | none observed | 0 | null |
| c1-integrations-06 | 1 | loadout | 1,961 | 0 | 11,392 | 128 | 3,100.2 | 0 | none observed | 0 | null |
| c1-business-27 | 1 | loadout | 31,218 | 0 | 151,424 | 8,477 | 46,360.4 | 7 | none observed | 716 | null |
| c1-business-27 | 1 | native | 10,552 | 0 | 184,448 | 5,783 | 28,996.8 | 7 | xlsx | 0 | null |
| c1-questions-07 | 1 | native | 8,177 | 0 | 11,392 | 364 | 9,316.2 | 0 | none observed | 0 | null |
| c1-questions-07 | 1 | loadout | 1,952 | 0 | 11,392 | 378 | 3,091.2 | 0 | none observed | 0 | null |
| c1-business-23 | 1 | loadout | 1,974 | 0 | 11,392 | 201 | 3,113.2 | 0 | none observed | 0 | null |
| c1-business-23 | 1 | native | 9,154 | 0 | 50,432 | 515 | 14,197.2 | 2 | none observed | 0 | null |
| c1-business-20 | 1 | native | 19,529 | 0 | 42,240 | 2,845 | 23,753 | 1 | none observed | 0 | null |
| c1-business-20 | 1 | loadout | 15,375 | 0 | 35,584 | 2,683 | 18,933.4 | 2 | none observed | 1056 | null |
| c1-productivity-09 | 1 | loadout | 6,432 | 0 | 6,912 | 91 | 7,123.2 | 0 | none observed | 0 | null |
| c1-productivity-09 | 1 | native | 9,031 | 0 | 50,304 | 463 | 14,061.4 | 1 | none observed | 0 | null |
| c1-debug-13 | 1 | native | 41,931 | 0 | 178,176 | 1,974 | 59,748.6 | 6 | none observed | 0 | null |
| c1-debug-13 | 1 | loadout | 17,022 | 0 | 87,296 | 1,446 | 25,751.6 | 5 | none observed | 0 | null |
| c1-questions-06 | 2 | native | 116 | 0 | 19,456 | 458 | 2,061.6 | 0 | none observed | 0 | null |
| c1-questions-06 | 2 | loadout | 1,955 | 0 | 11,392 | 418 | 3,094.2 | 0 | none observed | 0 | null |
| c1-business-26 | 2 | loadout | 19,027 | 0 | 27,264 | 3,208 | 21,753.4 | 2 | none observed | 3519 | null |
| c1-business-26 | 2 | native | 15,268 | 0 | 46,976 | 3,176 | 19,965.6 | 2 | none observed | 0 | null |
| c1-documents-22 | 2 | native | 8,184 | 0 | 11,392 | 207 | 9,323.2 | 0 | none observed | 0 | null |
| c1-documents-22 | 2 | loadout | 167 | 0 | 13,184 | 193 | 1,485.4 | 0 | none observed | 0 | null |
| c1-integrations-06 | 2 | loadout | 1,961 | 0 | 11,392 | 113 | 3,100.2 | 0 | none observed | 0 | null |
| c1-integrations-06 | 2 | native | 1,916 | 0 | 57,344 | 373 | 7,650.4 | 1 | none observed | 0 | null |
| c1-business-27 | 2 | native | 11,312 | 0 | 104,448 | 6,742 | 21,756.8 | 2 | none observed | 0 | null |
| c1-business-27 | 2 | loadout | 43,325 | 0 | 343,296 | 15,615 | 77,654.6 | 10 | xlsx | 716 | null |
| c1-questions-07 | 2 | loadout | 1,952 | 0 | 11,392 | 366 | 3,091.2 | 0 | none observed | 0 | null |
| c1-questions-07 | 2 | native | 8,177 | 0 | 11,392 | 338 | 9,316.2 | 0 | none observed | 0 | null |
| c1-business-23 | 2 | native | 8,199 | 0 | 11,392 | 204 | 9,338.2 | 0 | none observed | 0 | null |
| c1-business-23 | 2 | loadout | 1,974 | 0 | 11,392 | 198 | 3,113.2 | 0 | none observed | 0 | null |
| c1-business-20 | 2 | loadout | 11,692 | 0 | 40,064 | 3,536 | 15,698.4 | 1 | none observed | 1056 | null |
| c1-business-20 | 2 | native | 20,098 | 0 | 41,088 | 2,183 | 24,206.8 | 1 | none observed | 0 | null |
| c1-productivity-09 | 2 | native | 1,265 | 0 | 18,304 | 91 | 3,095.4 | 0 | none observed | 0 | null |
| c1-productivity-09 | 2 | loadout | 160 | 0 | 13,184 | 105 | 1,478.4 | 0 | none observed | 0 | null |
| c1-debug-13 | 2 | loadout | 11,699 | 0 | 93,696 | 1,678 | 21,068.6 | 4 | none observed | 0 | null |
| c1-debug-13 | 2 | native | 17,473 | 0 | 153,728 | 1,836 | 32,845.8 | 5 | none observed | 0 | null |

## Paired native minus loadout

| Prompt | Repeat | Uncached delta | Write delta | Cached delta | Output delta | Effective input delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| c1-questions-06 | 1 | 6,225 | 0 | 0 | 63 | 6,225 |
| c1-questions-06 | 2 | -1,839 | 0 | 8,064 | 40 | -1,032.6 |
| c1-business-26 | 1 | 6,257 | 0 | 31,104 | 58 | 9,367.4 |
| c1-business-26 | 2 | -3,759 | 0 | 19,712 | -32 | -1,787.8 |
| c1-documents-22 | 1 | 10,705 | 0 | -4,480 | -8 | 10,257 |
| c1-documents-22 | 2 | 8,017 | 0 | -1,792 | 14 | 7,837.8 |
| c1-integrations-06 | 1 | 6,225 | 0 | 0 | 11 | 6,225 |
| c1-integrations-06 | 2 | -45 | 0 | 45,952 | 260 | 4,550.2 |
| c1-business-27 | 1 | -20,666 | 0 | 33,024 | -2,694 | -17,363.6 |
| c1-business-27 | 2 | -32,013 | 0 | -238,848 | -8,873 | -55,897.8 |
| c1-questions-07 | 1 | 6,225 | 0 | 0 | -14 | 6,225 |
| c1-questions-07 | 2 | 6,225 | 0 | 0 | -28 | 6,225 |
| c1-business-23 | 1 | 7,180 | 0 | 39,040 | 314 | 11,084 |
| c1-business-23 | 2 | 6,225 | 0 | 0 | 6 | 6,225 |
| c1-business-20 | 1 | 4,154 | 0 | 6,656 | 162 | 4,819.6 |
| c1-business-20 | 2 | 8,406 | 0 | 1,024 | -1,353 | 8,508.4 |
| c1-productivity-09 | 1 | 2,599 | 0 | 43,392 | 372 | 6,938.2 |
| c1-productivity-09 | 2 | 1,105 | 0 | 5,120 | -14 | 1,617 |
| c1-debug-13 | 1 | 24,909 | 0 | 90,880 | 528 | 33,997 |
| c1-debug-13 | 2 | 5,774 | 0 | 60,032 | 158 | 11,777.2 |

Missing planned pairs: 0 of 20 (primary plan).

Paired effective-input median 6,225; range -55,897.8 to 33,997; n=20.
- c1-questions-06: median 2,596.2; range -1,032.6 to 6,225; n=2.
- c1-business-26: median 3,789.8; range -1,787.8 to 9,367.4; n=2.
- c1-documents-22: median 9,047.4; range 7,837.8 to 10,257; n=2.
- c1-integrations-06: median 5,387.6; range 4,550.2 to 6,225; n=2.
- c1-business-27: median -36,630.7; range -55,897.8 to -17,363.6; n=2.
- c1-questions-07: median 6,225; range 6,225 to 6,225; n=2.
- c1-business-23: median 8,654.5; range 6,225 to 11,084; n=2.
- c1-business-20: median 6,664; range 4,819.6 to 8,508.4; n=2.
- c1-productivity-09: median 4,277.6; range 1,617 to 6,938.2; n=2.
- c1-debug-13: median 22,887.1; range 11,777.2 to 33,997; n=2.

## Blind quality, both orders

| Prompt | Repeat | First order winner | Reverse order winner | Both-orders verdict |
| --- | ---: | --- | --- | --- |
| c1-questions-06 | 1 | tie | native | split |
| c1-questions-06 | 2 | loadout | loadout | loadout |
| c1-business-26 | 1 | native | native | native |
| c1-business-26 | 2 | loadout | native | split |
| c1-documents-22 | 1 | loadout | loadout | loadout |
| c1-documents-22 | 2 | native | native | native |
| c1-integrations-06 | 1 | tie | tie | tie |
| c1-integrations-06 | 2 | tie | tie | tie |
| c1-business-27 | 1 | loadout | loadout | loadout |
| c1-business-27 | 2 | loadout | loadout | loadout |
| c1-questions-07 | 1 | loadout | native | split |
| c1-questions-07 | 2 | loadout | loadout | loadout |
| c1-business-23 | 1 | native | native | native |
| c1-business-23 | 2 | loadout | tie | split |
| c1-business-20 | 1 | loadout | native | split |
| c1-business-20 | 2 | loadout | loadout | loadout |
| c1-productivity-09 | 1 | tie | tie | tie |
| c1-productivity-09 | 2 | tie | tie | tie |
| c1-debug-13 | 1 | loadout | loadout | loadout |
| c1-debug-13 | 2 | native | native | native |

Loadout wins 7; native wins (loadout loses) 4; ties 4; splits 5. Loadout-loses rate 4/20; Wilson 95% 8–42%.
Missing both-orders verdicts: 0 of 20 available pairs.
Hidden c1-debug-13 passes: native 2, loadout 2; 2 paired repeats; missing tests 0.
Primary quality screen: passes. Fixed rule: native wins minus loadout wins <= 2 of 20, and loadout hidden passes >= native. This is a screening rule, not proof of non-inferiority; repeated prompts are not independent population samples.
Sensitivity excluding c1-debug-13: paired effective-input median 6,225; range -55,897.8 to 11,084; n=18; loadout wins 6, native wins (loadout loses) 3, ties 4, splits 5. The fixture was previously selected using Jev and judge results; the primary screen is unchanged.
Blindness limitation: a skill's own template can still reveal the arm despite redaction. The judge sees saved files and final responses, not independent quality evidence.

## Cold starts and provenance

- codex/native/warmup/0: uncached 8,054, write 0, cached 11,392, output 5; valid.
- codex/loadout/warmup/0: uncached 1,829, write 0, cached 11,392, output 5; valid.
- {"librarySize":250,"corpusHash":"8af233e3a090ed0f07aecc67a393dacc0db73d88242ebb13812be6bb939b09a2","manifestHash":"c265c28cae5d7bd890d3dbd1b703f9e463a73241c4c064455c7f79de34b78318"}
- native: codexRetries 0 (including warm-up).
- native: hookTrustNotices 0 (including warm-up).
- loadout: codexRetries 0 (including warm-up).
- loadout: hookTrustNotices 42 (including warm-up).
- codex/native/c1-questions-07/2: coldCacheRisk

Not shown: general quality retention, actual subscription cost, per-request Codex usage, other hosts/models, whole-library quality, and Jev dollars (record separately). Ten prompts and an assumed cached price do not establish population savings.
