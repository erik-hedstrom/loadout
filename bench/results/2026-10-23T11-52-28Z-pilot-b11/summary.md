# B11 cache-aware session report

Test rows are the evaluation result. Dev rows appear separately and are the only rows eligible for tuning. Invalid attempts are counted separately, never as quality failures. Wilson 95% intervals describe observed valid sessions; repeated tasks are not independent evidence of population-wide quality.

Token columns sum valid sessions. Input, cache read and cache write are disjoint prompt buckets ([OpenCode 1.19.3 usage normalization](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/opencode/src/session/session.ts#L321-L383)). Output excludes the separately recorded reasoning counter. First requests can already hit a cross-session cache; they are not assumed cold. Cache ratios pool tokens within each request position; later positions include only sessions that reached them.

Hypothetical paid costs reprice these measured tokens under each named sheet; tokenizers and cache policies differ across providers, so this does not predict their quality or actual billed usage. Weighted input = input + read × read/input price + write × write/input price. Session cost adds output and reasoning at the output rate, plus recorded Jev cost. Free model spend is $0; Jev spend includes invalid attempts in the attempts table.

## Valid completion by arm

Valid completion = (pass + fail) / all recorded attempts; retries remain separate attempts. This operational table pools models and dev/test splits; quality and cost remain split-separated below. Timeouts are invalid attempts, never quality failures. Any arm under 90% valid completion risks survivor bias: its surviving sessions may not represent quality or cost across all attempts.

| Arm | Valid sessions | Attempts | Valid completion | Assessment |
|---|---:|---:|---:|---|
| bare | 11 | 12 | 91.67% | at least 90% |
| gateway | 9 | 9 | 100.00% | at least 90% |
| heavy-max | 9 | 9 | 100.00% | at least 90% |
| mcp-all | 9 | 9 | 100.00% | at least 90% |
| preselect | 9 | 9 | 100.00% | at least 90% |

## Price snapshots

USD per million tokens. GLM and DeepSeek have no extra storage/write charge; newly written prompt tokens retain their ordinary input processing cost. Anthropic uses 5-minute writes and OpenAI uses 30-minute writes. No batch, geography, long-context, or promotional adjustment is inferred.

| Sheet | Input | Cache read | Cache write | Output | Read/input | Retrieved | Source |
|---|---:|---:|---:|---:|---:|---|---|
| DeepSeek V4.1 Flash, off-peak | 0.15 | 0.003 | 0.15 | 0.6 | 0.020 | 2026-10-22 | [Official pricing](https://api-docs.deepseek.com/quick_start/pricing/) |
| DeepSeek V4.1 Flash, peak | 0.3 | 0.006 | 0.3 | 1.2 | 0.020 | 2026-10-22 | [Official pricing](https://api-docs.deepseek.com/quick_start/pricing/) |
| Z.ai GLM-5.3-Flash, free cache storage | 0.15 | 0.03 | 0.15 | 0.5 | 0.200 | 2026-10-22 | [Official pricing](https://docs.z.ai/guides/overview/pricing) |
| Anthropic Sonnet 5.5, 5-minute cache | 2 | 0.1 | 2.5 | 10 | 0.050 | 2026-10-22 | [Official pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| OpenAI GPT-6.1 Sol, standard short context, 30-minute cache | 2 | 0.1 | 2.5 | 10 | 0.050 | 2026-10-22 | [Official pricing](https://developers.openai.com/api/docs/pricing) |

## Test split

| Model | Arm | Pass | Fail | Invalid attempts | Valid completion | Assessment | Success among valid (Wilson 95%) | Steps | Uncached input | Cache read | Cache write | Output | Reasoning |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | bare | 0 | 2 | 1 | 66.67% | UNDER 90% | 0.00% (0–66%) | 14 | 11931 | 100608 | 0 | 1246 | 2157 |
| opencode/glm-5.3-flash-free | bare | 1 | 5 | 0 | 100.00% | at least 90% | 16.67% (3–56%) | 40 | 98905 | 293504 | 0 | 2190 | 5553 |
| opencode/glm-5.3-flash-free | gateway | 5 | 1 | 0 | 100.00% | at least 90% | 83.33% (44–97%) | 45 | 121960 | 399744 | 0 | 2229 | 2877 |
| opencode/glm-5.3-flash-free | heavy-max | 6 | 0 | 0 | 100.00% | at least 90% | 100.00% (61–100%) | 23 | 746914 | 2430848 | 0 | 1099 | 878 |
| opencode/glm-5.3-flash-free | mcp-all | 3 | 3 | 0 | 100.00% | at least 90% | 50.00% (19–81%) | 47 | 1060306 | 3795968 | 0 | 2412 | 7026 |
| opencode/glm-5.3-flash-free | preselect | 5 | 1 | 0 | 100.00% | at least 90% | 83.33% (44–97%) | 24 | 78575 | 131648 | 0 | 1012 | 1502 |

### Invalid usage and all-attempt Jev spend

Invalid reasons count attempts, including retries; zero token counters do not imply zero invalid attempts. Deadlines list distinct configured timeoutMs values; unknown (historical) marks omitted values. Groups with different deadlines remain pooled and are not a common-timeout comparison.

| Model | Arm | Invalid reasons | Deadlines (ms) | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | bare | usage-limit 1 | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | bare | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | gateway | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | $0.004649 |
| opencode/glm-5.3-flash-free | heavy-max | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | mcp-all | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | preselect | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | $0.006585 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | bare | 1 (first / cross-session) | 2 | 5713 | 8192 | 0 | 58.91% |
| opencode/deepseek-v4.1-flash-free | bare | 2 (later) | 2 | 506 | 13824 | 0 | 96.47% |
| opencode/deepseek-v4.1-flash-free | bare | 3 (later) | 2 | 789 | 14080 | 0 | 94.69% |
| opencode/deepseek-v4.1-flash-free | bare | 4 (later) | 2 | 1346 | 14592 | 0 | 91.55% |
| opencode/deepseek-v4.1-flash-free | bare | 5 (later) | 2 | 909 | 15872 | 0 | 94.58% |
| opencode/deepseek-v4.1-flash-free | bare | 6 (later) | 2 | 1328 | 16640 | 0 | 92.61% |
| opencode/deepseek-v4.1-flash-free | bare | 7 (later) | 1 | 118 | 8704 | 0 | 98.66% |
| opencode/deepseek-v4.1-flash-free | bare | 8 (later) | 1 | 1222 | 8704 | 0 | 87.69% |
| opencode/glm-5.3-flash-free | bare | 1 (first / cross-session) | 6 | 39153 | 1088 | 0 | 2.70% |
| opencode/glm-5.3-flash-free | bare | 2 (later) | 6 | 13288 | 28544 | 0 | 68.23% |
| opencode/glm-5.3-flash-free | bare | 3 (later) | 6 | 7068 | 35968 | 0 | 83.58% |
| opencode/glm-5.3-flash-free | bare | 4 (later) | 4 | 3457 | 27776 | 0 | 88.93% |
| opencode/glm-5.3-flash-free | bare | 5 (later) | 4 | 9385 | 22784 | 0 | 70.83% |
| opencode/glm-5.3-flash-free | bare | 6 (later) | 2 | 2330 | 13056 | 0 | 84.86% |
| opencode/glm-5.3-flash-free | bare | 7 (later) | 1 | 274 | 7616 | 0 | 96.53% |
| opencode/glm-5.3-flash-free | bare | 8 (later) | 1 | 1230 | 7616 | 0 | 86.10% |
| opencode/glm-5.3-flash-free | bare | 9 (later) | 1 | 406 | 8704 | 0 | 95.54% |
| opencode/glm-5.3-flash-free | bare | 10 (later) | 1 | 680 | 8704 | 0 | 92.75% |
| opencode/glm-5.3-flash-free | bare | 11 (later) | 1 | 963 | 8704 | 0 | 90.04% |
| opencode/glm-5.3-flash-free | bare | 12 (later) | 1 | 1307 | 8704 | 0 | 86.94% |
| opencode/glm-5.3-flash-free | bare | 13 (later) | 1 | 438 | 9792 | 0 | 95.72% |
| opencode/glm-5.3-flash-free | bare | 14 (later) | 1 | 14062 | 9792 | 0 | 41.05% |
| opencode/glm-5.3-flash-free | bare | 15 (later) | 1 | 1272 | 22848 | 0 | 94.73% |
| opencode/glm-5.3-flash-free | bare | 16 (later) | 1 | 413 | 23936 | 0 | 98.30% |
| opencode/glm-5.3-flash-free | bare | 17 (later) | 1 | 631 | 23936 | 0 | 97.43% |
| opencode/glm-5.3-flash-free | bare | 18 (later) | 1 | 2548 | 23936 | 0 | 90.38% |
| opencode/glm-5.3-flash-free | gateway | 1 (first / cross-session) | 6 | 44066 | 1088 | 0 | 2.41% |
| opencode/glm-5.3-flash-free | gateway | 2 (later) | 6 | 11059 | 35712 | 0 | 76.36% |
| opencode/glm-5.3-flash-free | gateway | 3 (later) | 6 | 11376 | 44992 | 0 | 79.82% |
| opencode/glm-5.3-flash-free | gateway | 4 (later) | 6 | 17262 | 40640 | 0 | 70.19% |
| opencode/glm-5.3-flash-free | gateway | 5 (later) | 5 | 3898 | 47936 | 0 | 92.48% |
| opencode/glm-5.3-flash-free | gateway | 6 (later) | 3 | 2787 | 31872 | 0 | 91.96% |
| opencode/glm-5.3-flash-free | gateway | 7 (later) | 2 | 2520 | 25600 | 0 | 91.04% |
| opencode/glm-5.3-flash-free | gateway | 8 (later) | 2 | 18515 | 9792 | 0 | 34.59% |
| opencode/glm-5.3-flash-free | gateway | 9 (later) | 2 | 1359 | 27200 | 0 | 95.24% |
| opencode/glm-5.3-flash-free | gateway | 10 (later) | 1 | 347 | 17408 | 0 | 98.05% |
| opencode/glm-5.3-flash-free | gateway | 11 (later) | 1 | 515 | 17408 | 0 | 97.13% |
| opencode/glm-5.3-flash-free | gateway | 12 (later) | 1 | 697 | 17408 | 0 | 96.15% |
| opencode/glm-5.3-flash-free | gateway | 13 (later) | 1 | 4991 | 17408 | 0 | 77.72% |
| opencode/glm-5.3-flash-free | gateway | 14 (later) | 1 | 794 | 21760 | 0 | 96.48% |
| opencode/glm-5.3-flash-free | gateway | 15 (later) | 1 | 845 | 21760 | 0 | 96.26% |
| opencode/glm-5.3-flash-free | gateway | 16 (later) | 1 | 929 | 21760 | 0 | 95.91% |
| opencode/glm-5.3-flash-free | heavy-max | 1 (first / cross-session) | 6 | 588504 | 238912 | 0 | 28.87% |
| opencode/glm-5.3-flash-free | heavy-max | 2 (later) | 6 | 149246 | 679552 | 0 | 81.99% |
| opencode/glm-5.3-flash-free | heavy-max | 3 (later) | 6 | 4972 | 824768 | 0 | 99.40% |
| opencode/glm-5.3-flash-free | heavy-max | 4 (later) | 4 | 3808 | 549440 | 0 | 99.31% |
| opencode/glm-5.3-flash-free | heavy-max | 5 (later) | 1 | 384 | 138176 | 0 | 99.72% |
| opencode/glm-5.3-flash-free | mcp-all | 1 (first / cross-session) | 6 | 506344 | 102336 | 0 | 16.81% |
| opencode/glm-5.3-flash-free | mcp-all | 2 (later) | 6 | 204694 | 404928 | 0 | 66.42% |
| opencode/glm-5.3-flash-free | mcp-all | 3 (later) | 6 | 2644 | 607808 | 0 | 99.57% |
| opencode/glm-5.3-flash-free | mcp-all | 4 (later) | 5 | 104664 | 405504 | 0 | 79.48% |
| opencode/glm-5.3-flash-free | mcp-all | 5 (later) | 3 | 4247 | 302784 | 0 | 98.62% |
| opencode/glm-5.3-flash-free | mcp-all | 6 (later) | 3 | 4904 | 303168 | 0 | 98.41% |
| opencode/glm-5.3-flash-free | mcp-all | 7 (later) | 3 | 107070 | 203584 | 0 | 65.53% |
| opencode/glm-5.3-flash-free | mcp-all | 8 (later) | 3 | 6198 | 305408 | 0 | 98.01% |
| opencode/glm-5.3-flash-free | mcp-all | 9 (later) | 2 | 4863 | 203392 | 0 | 97.66% |
| opencode/glm-5.3-flash-free | mcp-all | 10 (later) | 1 | 597 | 104064 | 0 | 99.43% |
| opencode/glm-5.3-flash-free | mcp-all | 11 (later) | 1 | 933 | 104448 | 0 | 99.11% |
| opencode/glm-5.3-flash-free | mcp-all | 12 (later) | 1 | 105448 | 0 | 0 | 0.00% |
| opencode/glm-5.3-flash-free | mcp-all | 13 (later) | 1 | 1278 | 104448 | 0 | 98.79% |
| opencode/glm-5.3-flash-free | mcp-all | 14 (later) | 1 | 1641 | 105536 | 0 | 98.47% |
| opencode/glm-5.3-flash-free | mcp-all | 15 (later) | 1 | 1068 | 106624 | 0 | 99.01% |
| opencode/glm-5.3-flash-free | mcp-all | 16 (later) | 1 | 1405 | 106624 | 0 | 98.70% |
| opencode/glm-5.3-flash-free | mcp-all | 17 (later) | 1 | 1125 | 107712 | 0 | 98.97% |
| opencode/glm-5.3-flash-free | mcp-all | 18 (later) | 1 | 365 | 108800 | 0 | 99.67% |
| opencode/glm-5.3-flash-free | mcp-all | 19 (later) | 1 | 818 | 108800 | 0 | 99.25% |
| opencode/glm-5.3-flash-free | preselect | 1 (first / cross-session) | 6 | 43328 | 0 | 0 | 0.00% |
| opencode/glm-5.3-flash-free | preselect | 2 (later) | 6 | 12826 | 32576 | 0 | 71.75% |
| opencode/glm-5.3-flash-free | preselect | 3 (later) | 6 | 7136 | 39040 | 0 | 84.55% |
| opencode/glm-5.3-flash-free | preselect | 4 (later) | 3 | 5316 | 19072 | 0 | 78.20% |
| opencode/glm-5.3-flash-free | preselect | 5 (later) | 1 | 8605 | 7936 | 0 | 47.98% |
| opencode/glm-5.3-flash-free | preselect | 6 (later) | 1 | 498 | 16384 | 0 | 97.05% |
| opencode/glm-5.3-flash-free | preselect | 7 (later) | 1 | 866 | 16640 | 0 | 95.05% |

### Timing from event-arrival timestamps

Startup is process launch to first step_start; each step is step_start to step_finish, measured at event arrival. Startup is not proof of MCP discovery latency and may include provider/network time. Samples include known startup and completed-step durations from valid and invalid attempts. Historical missing latency and null durations are not shown; unfinished steps have no duration sample. Session wall time covers all attempts, including unfinished timeout waits, preselection, checks and cleanup. An attempt may never launch OpenCode; wall time measures the observed lifecycle, not pure model time. Startup and step durations do not partition wall time. Gaps from step_finish to next step_start can include tool/MCP work, request setup and network waits.

| Model | Arm | Phase | Samples | Mean ms | Median ms | Max ms |
|---|---|---|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | bare | Session wall | 3 | 19346.00 | 20245.00 | 34418.00 |
| opencode/deepseek-v4.1-flash-free | bare | Startup | 2 | 4851.31 | 4851.31 | 4972.91 |
| opencode/deepseek-v4.1-flash-free | bare | Step 1 | 2 | 471.11 | 471.11 | 480.89 |
| opencode/deepseek-v4.1-flash-free | bare | Step 2 | 2 | 464.82 | 464.82 | 672.12 |
| opencode/deepseek-v4.1-flash-free | bare | Step 3 | 2 | 1813.98 | 1813.98 | 2817.16 |
| opencode/deepseek-v4.1-flash-free | bare | Step 4 | 2 | 425.91 | 425.91 | 680.02 |
| opencode/deepseek-v4.1-flash-free | bare | Step 5 | 2 | 2011.91 | 2011.91 | 3418.83 |
| opencode/deepseek-v4.1-flash-free | bare | Step 6 | 2 | 1465.56 | 1465.56 | 2456.90 |
| opencode/deepseek-v4.1-flash-free | bare | Step 7 | 1 | 6626.56 | 6626.56 | 6626.56 |
| opencode/deepseek-v4.1-flash-free | bare | Step 8 | 1 | 460.05 | 460.05 | 460.05 |
| opencode/glm-5.3-flash-free | bare | Session wall | 6 | 26268.50 | 17208.00 | 73630.00 |
| opencode/glm-5.3-flash-free | bare | Startup | 6 | 4232.68 | 4096.84 | 5601.89 |
| opencode/glm-5.3-flash-free | bare | Step 1 | 6 | 1298.26 | 844.71 | 3440.23 |
| opencode/glm-5.3-flash-free | bare | Step 2 | 6 | 550.68 | 472.81 | 1147.99 |
| opencode/glm-5.3-flash-free | bare | Step 3 | 6 | 3865.31 | 3138.10 | 8535.67 |
| opencode/glm-5.3-flash-free | bare | Step 4 | 4 | 1198.76 | 1372.24 | 1991.91 |
| opencode/glm-5.3-flash-free | bare | Step 5 | 4 | 1158.86 | 791.51 | 2542.00 |
| opencode/glm-5.3-flash-free | bare | Step 6 | 2 | 3040.16 | 3040.16 | 4026.79 |
| opencode/glm-5.3-flash-free | bare | Step 7 | 1 | 6539.89 | 6539.89 | 6539.89 |
| opencode/glm-5.3-flash-free | bare | Step 8 | 1 | 2021.90 | 2021.90 | 2021.90 |
| opencode/glm-5.3-flash-free | bare | Step 9 | 1 | 4386.46 | 4386.46 | 4386.46 |
| opencode/glm-5.3-flash-free | bare | Step 10 | 1 | 1814.74 | 1814.74 | 1814.74 |
| opencode/glm-5.3-flash-free | bare | Step 11 | 1 | 3270.68 | 3270.68 | 3270.68 |
| opencode/glm-5.3-flash-free | bare | Step 12 | 1 | 3703.67 | 3703.67 | 3703.67 |
| opencode/glm-5.3-flash-free | bare | Step 13 | 1 | 1698.31 | 1698.31 | 1698.31 |
| opencode/glm-5.3-flash-free | bare | Step 14 | 1 | 3161.72 | 3161.72 | 3161.72 |
| opencode/glm-5.3-flash-free | bare | Step 15 | 1 | 2563.51 | 2563.51 | 2563.51 |
| opencode/glm-5.3-flash-free | bare | Step 16 | 1 | 3141.06 | 3141.06 | 3141.06 |
| opencode/glm-5.3-flash-free | bare | Step 17 | 1 | 1925.15 | 1925.15 | 1925.15 |
| opencode/glm-5.3-flash-free | bare | Step 18 | 1 | 3853.18 | 3853.18 | 3853.18 |
| opencode/glm-5.3-flash-free | gateway | Session wall | 6 | 32006.00 | 23284.00 | 80250.00 |
| opencode/glm-5.3-flash-free | gateway | Startup | 6 | 5715.08 | 4629.51 | 8530.77 |
| opencode/glm-5.3-flash-free | gateway | Step 1 | 6 | 1447.86 | 1309.33 | 2858.60 |
| opencode/glm-5.3-flash-free | gateway | Step 2 | 6 | 870.33 | 925.21 | 1391.88 |
| opencode/glm-5.3-flash-free | gateway | Step 3 | 6 | 1425.89 | 1522.45 | 2974.90 |
| opencode/glm-5.3-flash-free | gateway | Step 4 | 6 | 2970.56 | 1516.68 | 8111.15 |
| opencode/glm-5.3-flash-free | gateway | Step 5 | 5 | 940.54 | 729.60 | 2316.16 |
| opencode/glm-5.3-flash-free | gateway | Step 6 | 3 | 3714.30 | 1471.20 | 8721.52 |
| opencode/glm-5.3-flash-free | gateway | Step 7 | 2 | 1315.11 | 1315.11 | 2521.09 |
| opencode/glm-5.3-flash-free | gateway | Step 8 | 2 | 1019.00 | 1019.00 | 1277.09 |
| opencode/glm-5.3-flash-free | gateway | Step 9 | 2 | 1132.10 | 1132.10 | 1501.18 |
| opencode/glm-5.3-flash-free | gateway | Step 10 | 1 | 19611.86 | 19611.86 | 19611.86 |
| opencode/glm-5.3-flash-free | gateway | Step 11 | 1 | 1143.06 | 1143.06 | 1143.06 |
| opencode/glm-5.3-flash-free | gateway | Step 12 | 1 | 2974.06 | 2974.06 | 2974.06 |
| opencode/glm-5.3-flash-free | gateway | Step 13 | 1 | 1611.65 | 1611.65 | 1611.65 |
| opencode/glm-5.3-flash-free | gateway | Step 14 | 1 | 462.17 | 462.17 | 462.17 |
| opencode/glm-5.3-flash-free | gateway | Step 15 | 1 | 140.55 | 140.55 | 140.55 |
| opencode/glm-5.3-flash-free | gateway | Step 16 | 1 | 415.64 | 415.64 | 415.64 |
| opencode/glm-5.3-flash-free | heavy-max | Session wall | 6 | 27366.83 | 26273.50 | 39458.00 |
| opencode/glm-5.3-flash-free | heavy-max | Startup | 6 | 11232.12 | 11163.39 | 12745.77 |
| opencode/glm-5.3-flash-free | heavy-max | Step 1 | 6 | 1191.92 | 671.19 | 2838.86 |
| opencode/glm-5.3-flash-free | heavy-max | Step 2 | 6 | 338.17 | 197.65 | 824.47 |
| opencode/glm-5.3-flash-free | heavy-max | Step 3 | 6 | 1627.98 | 651.33 | 6557.64 |
| opencode/glm-5.3-flash-free | heavy-max | Step 4 | 4 | 1031.12 | 785.86 | 2159.55 |
| opencode/glm-5.3-flash-free | heavy-max | Step 5 | 1 | 1254.68 | 1254.68 | 1254.68 |
| opencode/glm-5.3-flash-free | mcp-all | Session wall | 6 | 59059.67 | 41259.00 | 158247.00 |
| opencode/glm-5.3-flash-free | mcp-all | Startup | 6 | 9264.52 | 9146.57 | 14634.34 |
| opencode/glm-5.3-flash-free | mcp-all | Step 1 | 6 | 719.82 | 717.65 | 1206.77 |
| opencode/glm-5.3-flash-free | mcp-all | Step 2 | 6 | 506.86 | 385.43 | 1342.12 |
| opencode/glm-5.3-flash-free | mcp-all | Step 3 | 6 | 1186.07 | 1462.89 | 2123.66 |
| opencode/glm-5.3-flash-free | mcp-all | Step 4 | 5 | 1289.09 | 1683.42 | 2564.60 |
| opencode/glm-5.3-flash-free | mcp-all | Step 5 | 3 | 3007.94 | 915.76 | 7384.17 |
| opencode/glm-5.3-flash-free | mcp-all | Step 6 | 3 | 2559.48 | 2105.57 | 4201.96 |
| opencode/glm-5.3-flash-free | mcp-all | Step 7 | 3 | 7141.34 | 8209.58 | 12190.39 |
| opencode/glm-5.3-flash-free | mcp-all | Step 8 | 3 | 2303.21 | 2497.48 | 2986.16 |
| opencode/glm-5.3-flash-free | mcp-all | Step 9 | 2 | 1762.95 | 1762.95 | 1983.89 |
| opencode/glm-5.3-flash-free | mcp-all | Step 10 | 1 | 3704.88 | 3704.88 | 3704.88 |
| opencode/glm-5.3-flash-free | mcp-all | Step 11 | 1 | 371.14 | 371.14 | 371.14 |
| opencode/glm-5.3-flash-free | mcp-all | Step 12 | 1 | 3592.37 | 3592.37 | 3592.37 |
| opencode/glm-5.3-flash-free | mcp-all | Step 13 | 1 | 17526.87 | 17526.87 | 17526.87 |
| opencode/glm-5.3-flash-free | mcp-all | Step 14 | 1 | 8293.35 | 8293.35 | 8293.35 |
| opencode/glm-5.3-flash-free | mcp-all | Step 15 | 1 | 4909.45 | 4909.45 | 4909.45 |
| opencode/glm-5.3-flash-free | mcp-all | Step 16 | 1 | 13235.83 | 13235.83 | 13235.83 |
| opencode/glm-5.3-flash-free | mcp-all | Step 17 | 1 | 4970.28 | 4970.28 | 4970.28 |
| opencode/glm-5.3-flash-free | mcp-all | Step 18 | 1 | 6209.48 | 6209.48 | 6209.48 |
| opencode/glm-5.3-flash-free | mcp-all | Step 19 | 1 | 1799.59 | 1799.59 | 1799.59 |
| opencode/glm-5.3-flash-free | preselect | Session wall | 6 | 26340.50 | 17591.00 | 79072.00 |
| opencode/glm-5.3-flash-free | preselect | Startup | 6 | 6690.07 | 5723.03 | 12691.14 |
| opencode/glm-5.3-flash-free | preselect | Step 1 | 6 | 1474.01 | 1069.81 | 3103.39 |
| opencode/glm-5.3-flash-free | preselect | Step 2 | 6 | 1411.62 | 1085.36 | 3083.88 |
| opencode/glm-5.3-flash-free | preselect | Step 3 | 6 | 2192.25 | 1094.03 | 8358.24 |
| opencode/glm-5.3-flash-free | preselect | Step 4 | 3 | 16021.93 | 835.49 | 47125.76 |
| opencode/glm-5.3-flash-free | preselect | Step 5 | 1 | 4273.38 | 4273.38 | 4273.38 |
| opencode/glm-5.3-flash-free | preselect | Step 6 | 1 | 2659.68 | 2659.68 | 2659.68 |
| opencode/glm-5.3-flash-free | preselect | Step 7 | 1 | 2909.07 | 2909.07 | 2909.07 |

### Hypothetical paid cost per valid session

**Caution: survivor bias in quality and cost.** Under 90% valid completion: opencode/deepseek-v4.1-flash-free / bare. These costs describe surviving valid sessions, not the cost of all attempted work; zero-valid arms are not usable in observed attempts.

| Model | Arm | Sheet | Mean steps | Mean weighted input | Mean input USD | Mean output/reasoning USD | Mean Jev USD | Mean total USD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | bare | deepseek-flash-off-peak | 7.00 | 6971.58 | $0.001046 | $0.001021 | $0.000000 | $0.002067 |
| opencode/deepseek-v4.1-flash-free | bare | deepseek-flash-peak | 7.00 | 6971.58 | $0.002091 | $0.002042 | $0.000000 | $0.004133 |
| opencode/deepseek-v4.1-flash-free | bare | glm-5.3-flash | 7.00 | 16026.30 | $0.002404 | $0.000851 | $0.000000 | $0.003255 |
| opencode/deepseek-v4.1-flash-free | bare | claude-sonnet-5.5-5m | 7.00 | 8480.70 | $0.016961 | $0.017015 | $0.000000 | $0.033976 |
| opencode/deepseek-v4.1-flash-free | bare | gpt-6.1-sol-30m | 7.00 | 8480.70 | $0.016961 | $0.017015 | $0.000000 | $0.033976 |
| opencode/glm-5.3-flash-free | bare | deepseek-flash-off-peak | 6.67 | 17462.51 | $0.002619 | $0.000774 | $0.000000 | $0.003394 |
| opencode/glm-5.3-flash-free | bare | deepseek-flash-peak | 6.67 | 17462.51 | $0.005239 | $0.001549 | $0.000000 | $0.006787 |
| opencode/glm-5.3-flash-free | bare | glm-5.3-flash | 6.67 | 26267.63 | $0.003940 | $0.000645 | $0.000000 | $0.004585 |
| opencode/glm-5.3-flash-free | bare | claude-sonnet-5.5-5m | 6.67 | 18930.03 | $0.037860 | $0.012905 | $0.000000 | $0.050765 |
| opencode/glm-5.3-flash-free | bare | gpt-6.1-sol-30m | 6.67 | 18930.03 | $0.037860 | $0.012905 | $0.000000 | $0.050765 |
| opencode/glm-5.3-flash-free | gateway | deepseek-flash-off-peak | 7.50 | 21659.15 | $0.003249 | $0.000511 | $0.000775 | $0.004534 |
| opencode/glm-5.3-flash-free | gateway | deepseek-flash-peak | 7.50 | 21659.15 | $0.006498 | $0.001021 | $0.000775 | $0.008294 |
| opencode/glm-5.3-flash-free | gateway | glm-5.3-flash | 7.50 | 33651.47 | $0.005048 | $0.000426 | $0.000775 | $0.006248 |
| opencode/glm-5.3-flash-free | gateway | claude-sonnet-5.5-5m | 7.50 | 23657.87 | $0.047316 | $0.008510 | $0.000775 | $0.056601 |
| opencode/glm-5.3-flash-free | gateway | gpt-6.1-sol-30m | 7.50 | 23657.87 | $0.047316 | $0.008510 | $0.000775 | $0.056601 |
| opencode/glm-5.3-flash-free | heavy-max | deepseek-flash-off-peak | 3.83 | 132588.49 | $0.019888 | $0.000198 | $0.000000 | $0.020086 |
| opencode/glm-5.3-flash-free | heavy-max | deepseek-flash-peak | 3.83 | 132588.49 | $0.039777 | $0.000395 | $0.000000 | $0.040172 |
| opencode/glm-5.3-flash-free | heavy-max | glm-5.3-flash | 3.83 | 205513.93 | $0.030827 | $0.000165 | $0.000000 | $0.030992 |
| opencode/glm-5.3-flash-free | heavy-max | claude-sonnet-5.5-5m | 3.83 | 144742.73 | $0.289485 | $0.003295 | $0.000000 | $0.292780 |
| opencode/glm-5.3-flash-free | heavy-max | gpt-6.1-sol-30m | 3.83 | 144742.73 | $0.289485 | $0.003295 | $0.000000 | $0.292780 |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-off-peak | 7.83 | 189370.89 | $0.028406 | $0.000944 | $0.000000 | $0.029349 |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-peak | 7.83 | 189370.89 | $0.056811 | $0.001888 | $0.000000 | $0.058699 |
| opencode/glm-5.3-flash-free | mcp-all | glm-5.3-flash | 7.83 | 303249.93 | $0.045487 | $0.000786 | $0.000000 | $0.046274 |
| opencode/glm-5.3-flash-free | mcp-all | claude-sonnet-5.5-5m | 7.83 | 208350.73 | $0.416701 | $0.015730 | $0.000000 | $0.432431 |
| opencode/glm-5.3-flash-free | mcp-all | gpt-6.1-sol-30m | 7.83 | 208350.73 | $0.416701 | $0.015730 | $0.000000 | $0.432431 |
| opencode/glm-5.3-flash-free | preselect | deepseek-flash-off-peak | 4.00 | 13534.66 | $0.002030 | $0.000251 | $0.001097 | $0.003379 |
| opencode/glm-5.3-flash-free | preselect | deepseek-flash-peak | 4.00 | 13534.66 | $0.004060 | $0.000503 | $0.001097 | $0.005661 |
| opencode/glm-5.3-flash-free | preselect | glm-5.3-flash | 4.00 | 17484.10 | $0.002623 | $0.000210 | $0.001097 | $0.003930 |
| opencode/glm-5.3-flash-free | preselect | claude-sonnet-5.5-5m | 4.00 | 14192.90 | $0.028386 | $0.004190 | $0.001097 | $0.033673 |
| opencode/glm-5.3-flash-free | preselect | gpt-6.1-sol-30m | 4.00 | 14192.90 | $0.028386 | $0.004190 | $0.001097 | $0.033673 |

### Size sweep and observed break-even

Comparisons use the common valid task/repetition panel across gateway and every observed size in a family. Sizes are recorded skill counts or tool counts (MCP), including planted items. The gateway horizontal band is the observed session-cost min/max, not a confidence interval. Break-even is the first measured native size at or above the gateway mean; no interpolation or extrapolation. Cost includes Jev. Chart x labels are categorical measured sizes.

not shown: no common valid gateway/size-sweep panel.

## Dev split

| Model | Arm | Pass | Fail | Invalid attempts | Valid completion | Assessment | Success among valid (Wilson 95%) | Steps | Uncached input | Cache read | Cache write | Output | Reasoning |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | 2 | 1 | 0 | 100.00% | at least 90% | 66.67% (21–94%) | 22 | 42010 | 138304 | 0 | 3123 | 4352 |
| opencode/glm-5.3-flash-free | gateway | 3 | 0 | 0 | 100.00% | at least 90% | 100.00% (44–100%) | 18 | 36503 | 137024 | 0 | 1716 | 1157 |
| opencode/glm-5.3-flash-free | heavy-max | 3 | 0 | 0 | 100.00% | at least 90% | 100.00% (44–100%) | 17 | 422932 | 1935104 | 0 | 1799 | 2155 |
| opencode/glm-5.3-flash-free | mcp-all | 3 | 0 | 0 | 100.00% | at least 90% | 100.00% (44–100%) | 11 | 307905 | 811776 | 0 | 890 | 819 |
| opencode/glm-5.3-flash-free | preselect | 2 | 1 | 0 | 100.00% | at least 90% | 66.67% (21–94%) | 31 | 56557 | 302784 | 0 | 3243 | 5828 |

### Invalid usage and all-attempt Jev spend

Invalid reasons count attempts, including retries; zero token counters do not imply zero invalid attempts. Deadlines list distinct configured timeoutMs values; unknown (historical) marks omitted values. Groups with different deadlines remain pooled and are not a common-timeout comparison.

| Model | Arm | Invalid reasons | Deadlines (ms) | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | gateway | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | $0.001207 |
| opencode/glm-5.3-flash-free | heavy-max | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | mcp-all | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | preselect | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | $0.003731 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | 1 (first / cross-session) | 3 | 20243 | 0 | 0 | 0.00% |
| opencode/glm-5.3-flash-free | bare | 2 (later) | 3 | 1048 | 19584 | 0 | 94.92% |
| opencode/glm-5.3-flash-free | bare | 3 (later) | 3 | 1318 | 20096 | 0 | 93.85% |
| opencode/glm-5.3-flash-free | bare | 4 (later) | 3 | 1553 | 20864 | 0 | 93.07% |
| opencode/glm-5.3-flash-free | bare | 5 (later) | 2 | 2192 | 14592 | 0 | 86.94% |
| opencode/glm-5.3-flash-free | bare | 6 (later) | 2 | 1375 | 16384 | 0 | 92.26% |
| opencode/glm-5.3-flash-free | bare | 7 (later) | 2 | 11074 | 8576 | 0 | 43.64% |
| opencode/glm-5.3-flash-free | bare | 8 (later) | 2 | 1898 | 18368 | 0 | 90.63% |
| opencode/glm-5.3-flash-free | bare | 9 (later) | 2 | 1309 | 19840 | 0 | 93.81% |
| opencode/glm-5.3-flash-free | gateway | 1 (first / cross-session) | 3 | 8087 | 14592 | 0 | 64.34% |
| opencode/glm-5.3-flash-free | gateway | 2 (later) | 3 | 1165 | 22144 | 0 | 95.00% |
| opencode/glm-5.3-flash-free | gateway | 3 (later) | 3 | 4256 | 22784 | 0 | 84.26% |
| opencode/glm-5.3-flash-free | gateway | 4 (later) | 3 | 19608 | 10752 | 0 | 35.42% |
| opencode/glm-5.3-flash-free | gateway | 5 (later) | 2 | 1562 | 21312 | 0 | 93.17% |
| opencode/glm-5.3-flash-free | gateway | 6 (later) | 2 | 664 | 22656 | 0 | 97.15% |
| opencode/glm-5.3-flash-free | gateway | 7 (later) | 2 | 1161 | 22784 | 0 | 95.15% |
| opencode/glm-5.3-flash-free | heavy-max | 1 (first / cross-session) | 3 | 413807 | 0 | 0 | 0.00% |
| opencode/glm-5.3-flash-free | heavy-max | 2 (later) | 3 | 1608 | 412544 | 0 | 99.61% |
| opencode/glm-5.3-flash-free | heavy-max | 3 (later) | 3 | 1542 | 412928 | 0 | 99.63% |
| opencode/glm-5.3-flash-free | heavy-max | 4 (later) | 3 | 2259 | 413056 | 0 | 99.46% |
| opencode/glm-5.3-flash-free | heavy-max | 5 (later) | 1 | 486 | 138240 | 0 | 99.65% |
| opencode/glm-5.3-flash-free | heavy-max | 6 (later) | 1 | 834 | 138496 | 0 | 99.40% |
| opencode/glm-5.3-flash-free | heavy-max | 7 (later) | 1 | 1216 | 139136 | 0 | 99.13% |
| opencode/glm-5.3-flash-free | heavy-max | 8 (later) | 1 | 598 | 140160 | 0 | 99.58% |
| opencode/glm-5.3-flash-free | heavy-max | 9 (later) | 1 | 582 | 140544 | 0 | 99.59% |
| opencode/glm-5.3-flash-free | mcp-all | 1 (first / cross-session) | 3 | 304439 | 0 | 0 | 0.00% |
| opencode/glm-5.3-flash-free | mcp-all | 2 (later) | 3 | 1152 | 303744 | 0 | 99.62% |
| opencode/glm-5.3-flash-free | mcp-all | 3 (later) | 3 | 1407 | 304384 | 0 | 99.54% |
| opencode/glm-5.3-flash-free | mcp-all | 4 (later) | 2 | 907 | 203648 | 0 | 99.56% |
| opencode/glm-5.3-flash-free | preselect | 1 (first / cross-session) | 3 | 13715 | 6528 | 0 | 32.25% |
| opencode/glm-5.3-flash-free | preselect | 2 (later) | 3 | 7739 | 13056 | 0 | 62.78% |
| opencode/glm-5.3-flash-free | preselect | 3 (later) | 3 | 1311 | 20224 | 0 | 93.91% |
| opencode/glm-5.3-flash-free | preselect | 4 (later) | 3 | 1530 | 20992 | 0 | 93.21% |
| opencode/glm-5.3-flash-free | preselect | 5 (later) | 3 | 1362 | 21888 | 0 | 94.14% |
| opencode/glm-5.3-flash-free | preselect | 6 (later) | 2 | 2004 | 15232 | 0 | 88.37% |
| opencode/glm-5.3-flash-free | preselect | 7 (later) | 1 | 1557 | 9344 | 0 | 85.72% |
| opencode/glm-5.3-flash-free | preselect | 8 (later) | 1 | 367 | 10752 | 0 | 96.70% |
| opencode/glm-5.3-flash-free | preselect | 9 (later) | 1 | 1033 | 10880 | 0 | 91.33% |
| opencode/glm-5.3-flash-free | preselect | 10 (later) | 1 | 1883 | 11776 | 0 | 86.21% |
| opencode/glm-5.3-flash-free | preselect | 11 (later) | 1 | 7498 | 6528 | 0 | 46.54% |
| opencode/glm-5.3-flash-free | preselect | 12 (later) | 1 | 1167 | 13056 | 0 | 91.79% |
| opencode/glm-5.3-flash-free | preselect | 13 (later) | 1 | 394 | 14144 | 0 | 97.29% |
| opencode/glm-5.3-flash-free | preselect | 14 (later) | 1 | 631 | 14144 | 0 | 95.73% |
| opencode/glm-5.3-flash-free | preselect | 15 (later) | 1 | 792 | 14144 | 0 | 94.70% |
| opencode/glm-5.3-flash-free | preselect | 16 (later) | 1 | 5690 | 14144 | 0 | 71.31% |
| opencode/glm-5.3-flash-free | preselect | 17 (later) | 1 | 1575 | 19584 | 0 | 92.56% |
| opencode/glm-5.3-flash-free | preselect | 18 (later) | 1 | 1428 | 20672 | 0 | 93.54% |
| opencode/glm-5.3-flash-free | preselect | 19 (later) | 1 | 3123 | 21760 | 0 | 87.45% |
| opencode/glm-5.3-flash-free | preselect | 20 (later) | 1 | 1758 | 23936 | 0 | 93.16% |

### Timing from event-arrival timestamps

Startup is process launch to first step_start; each step is step_start to step_finish, measured at event arrival. Startup is not proof of MCP discovery latency and may include provider/network time. Samples include known startup and completed-step durations from valid and invalid attempts. Historical missing latency and null durations are not shown; unfinished steps have no duration sample. Session wall time covers all attempts, including unfinished timeout waits, preselection, checks and cleanup. An attempt may never launch OpenCode; wall time measures the observed lifecycle, not pure model time. Startup and step durations do not partition wall time. Gaps from step_finish to next step_start can include tool/MCP work, request setup and network waits.

| Model | Arm | Phase | Samples | Mean ms | Median ms | Max ms |
|---|---|---|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | Session wall | 3 | 26164.67 | 29829.00 | 40236.00 |
| opencode/glm-5.3-flash-free | bare | Startup | 3 | 5476.27 | 4272.90 | 8772.59 |
| opencode/glm-5.3-flash-free | bare | Step 1 | 3 | 938.90 | 344.12 | 2339.77 |
| opencode/glm-5.3-flash-free | bare | Step 2 | 3 | 715.15 | 803.05 | 1268.58 |
| opencode/glm-5.3-flash-free | bare | Step 3 | 3 | 947.01 | 179.43 | 2512.72 |
| opencode/glm-5.3-flash-free | bare | Step 4 | 3 | 2314.29 | 1536.10 | 4995.89 |
| opencode/glm-5.3-flash-free | bare | Step 5 | 2 | 2985.29 | 2985.29 | 4758.82 |
| opencode/glm-5.3-flash-free | bare | Step 6 | 2 | 4051.35 | 4051.35 | 7889.20 |
| opencode/glm-5.3-flash-free | bare | Step 7 | 2 | 1580.66 | 1580.66 | 2052.06 |
| opencode/glm-5.3-flash-free | bare | Step 8 | 2 | 1266.88 | 1266.88 | 1561.60 |
| opencode/glm-5.3-flash-free | bare | Step 9 | 2 | 4798.96 | 4798.96 | 8283.09 |
| opencode/glm-5.3-flash-free | gateway | Session wall | 3 | 19059.33 | 12190.00 | 33597.00 |
| opencode/glm-5.3-flash-free | gateway | Startup | 3 | 4228.70 | 4286.53 | 4347.61 |
| opencode/glm-5.3-flash-free | gateway | Step 1 | 3 | 906.87 | 1104.72 | 1501.52 |
| opencode/glm-5.3-flash-free | gateway | Step 2 | 3 | 1179.17 | 550.22 | 2798.00 |
| opencode/glm-5.3-flash-free | gateway | Step 3 | 3 | 600.24 | 361.48 | 1281.54 |
| opencode/glm-5.3-flash-free | gateway | Step 4 | 3 | 1616.43 | 868.18 | 3424.00 |
| opencode/glm-5.3-flash-free | gateway | Step 5 | 2 | 1941.54 | 1941.54 | 3808.24 |
| opencode/glm-5.3-flash-free | gateway | Step 6 | 2 | 3815.33 | 3815.33 | 7597.53 |
| opencode/glm-5.3-flash-free | gateway | Step 7 | 2 | 847.61 | 847.61 | 1310.91 |
| opencode/glm-5.3-flash-free | heavy-max | Session wall | 3 | 41746.33 | 27413.00 | 75098.00 |
| opencode/glm-5.3-flash-free | heavy-max | Startup | 3 | 14089.55 | 12927.95 | 17212.51 |
| opencode/glm-5.3-flash-free | heavy-max | Step 1 | 3 | 1282.04 | 1434.43 | 1978.75 |
| opencode/glm-5.3-flash-free | heavy-max | Step 2 | 3 | 326.50 | 100.61 | 792.65 |
| opencode/glm-5.3-flash-free | heavy-max | Step 3 | 3 | 4322.14 | 487.72 | 12245.06 |
| opencode/glm-5.3-flash-free | heavy-max | Step 4 | 3 | 1096.51 | 901.01 | 1830.29 |
| opencode/glm-5.3-flash-free | heavy-max | Step 5 | 1 | 4207.62 | 4207.62 | 4207.62 |
| opencode/glm-5.3-flash-free | heavy-max | Step 6 | 1 | 6570.34 | 6570.34 | 6570.34 |
| opencode/glm-5.3-flash-free | heavy-max | Step 7 | 1 | 49.79 | 49.79 | 49.79 |
| opencode/glm-5.3-flash-free | heavy-max | Step 8 | 1 | 1848.11 | 1848.11 | 1848.11 |
| opencode/glm-5.3-flash-free | heavy-max | Step 9 | 1 | 1152.76 | 1152.76 | 1152.76 |
| opencode/glm-5.3-flash-free | mcp-all | Session wall | 3 | 18535.67 | 19985.00 | 21813.00 |
| opencode/glm-5.3-flash-free | mcp-all | Startup | 3 | 9694.59 | 9610.38 | 10066.27 |
| opencode/glm-5.3-flash-free | mcp-all | Step 1 | 3 | 493.06 | 368.66 | 807.16 |
| opencode/glm-5.3-flash-free | mcp-all | Step 2 | 3 | 2098.34 | 1583.55 | 4346.15 |
| opencode/glm-5.3-flash-free | mcp-all | Step 3 | 3 | 896.17 | 1275.50 | 1375.49 |
| opencode/glm-5.3-flash-free | mcp-all | Step 4 | 2 | 736.21 | 736.21 | 1120.06 |
| opencode/glm-5.3-flash-free | preselect | Session wall | 3 | 55352.00 | 20620.00 | 126361.00 |
| opencode/glm-5.3-flash-free | preselect | Startup | 3 | 4417.03 | 4221.45 | 5125.88 |
| opencode/glm-5.3-flash-free | preselect | Step 1 | 3 | 637.64 | 777.52 | 855.46 |
| opencode/glm-5.3-flash-free | preselect | Step 2 | 3 | 1166.04 | 1452.26 | 1661.51 |
| opencode/glm-5.3-flash-free | preselect | Step 3 | 3 | 675.09 | 282.09 | 1574.62 |
| opencode/glm-5.3-flash-free | preselect | Step 4 | 3 | 809.06 | 624.32 | 1738.93 |
| opencode/glm-5.3-flash-free | preselect | Step 5 | 3 | 1574.17 | 2078.49 | 2478.80 |
| opencode/glm-5.3-flash-free | preselect | Step 6 | 2 | 1161.45 | 1161.45 | 1510.41 |
| opencode/glm-5.3-flash-free | preselect | Step 7 | 1 | 492.80 | 492.80 | 492.80 |
| opencode/glm-5.3-flash-free | preselect | Step 8 | 1 | 4985.85 | 4985.85 | 4985.85 |
| opencode/glm-5.3-flash-free | preselect | Step 9 | 1 | 6900.54 | 6900.54 | 6900.54 |
| opencode/glm-5.3-flash-free | preselect | Step 10 | 1 | 2232.48 | 2232.48 | 2232.48 |
| opencode/glm-5.3-flash-free | preselect | Step 11 | 1 | 2318.17 | 2318.17 | 2318.17 |
| opencode/glm-5.3-flash-free | preselect | Step 12 | 1 | 4525.64 | 4525.64 | 4525.64 |
| opencode/glm-5.3-flash-free | preselect | Step 13 | 1 | 3783.85 | 3783.85 | 3783.85 |
| opencode/glm-5.3-flash-free | preselect | Step 14 | 1 | 263.09 | 263.09 | 263.09 |
| opencode/glm-5.3-flash-free | preselect | Step 15 | 1 | 1489.29 | 1489.29 | 1489.29 |
| opencode/glm-5.3-flash-free | preselect | Step 16 | 1 | 18557.69 | 18557.69 | 18557.69 |
| opencode/glm-5.3-flash-free | preselect | Step 17 | 1 | 17554.06 | 17554.06 | 17554.06 |
| opencode/glm-5.3-flash-free | preselect | Step 18 | 1 | 6799.75 | 6799.75 | 6799.75 |
| opencode/glm-5.3-flash-free | preselect | Step 19 | 1 | 8245.79 | 8245.79 | 8245.79 |
| opencode/glm-5.3-flash-free | preselect | Step 20 | 1 | 9452.84 | 9452.84 | 9452.84 |

### Hypothetical paid cost per valid session

| Model | Arm | Sheet | Mean steps | Mean weighted input | Mean input USD | Mean output/reasoning USD | Mean Jev USD | Mean total USD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | deepseek-flash-off-peak | 7.33 | 14925.36 | $0.002239 | $0.001495 | $0.000000 | $0.003734 |
| opencode/glm-5.3-flash-free | bare | deepseek-flash-peak | 7.33 | 14925.36 | $0.004478 | $0.002990 | $0.000000 | $0.007468 |
| opencode/glm-5.3-flash-free | bare | glm-5.3-flash | 7.33 | 23223.60 | $0.003484 | $0.001246 | $0.000000 | $0.004729 |
| opencode/glm-5.3-flash-free | bare | claude-sonnet-5.5-5m | 7.33 | 16308.40 | $0.032617 | $0.024917 | $0.000000 | $0.057533 |
| opencode/glm-5.3-flash-free | bare | gpt-6.1-sol-30m | 7.33 | 16308.40 | $0.032617 | $0.024917 | $0.000000 | $0.057533 |
| opencode/glm-5.3-flash-free | gateway | deepseek-flash-off-peak | 6.00 | 13081.16 | $0.001962 | $0.000575 | $0.000402 | $0.002939 |
| opencode/glm-5.3-flash-free | gateway | deepseek-flash-peak | 6.00 | 13081.16 | $0.003924 | $0.001149 | $0.000402 | $0.005476 |
| opencode/glm-5.3-flash-free | gateway | glm-5.3-flash | 6.00 | 21302.60 | $0.003195 | $0.000479 | $0.000402 | $0.004076 |
| opencode/glm-5.3-flash-free | gateway | claude-sonnet-5.5-5m | 6.00 | 14451.40 | $0.028903 | $0.009577 | $0.000402 | $0.038882 |
| opencode/glm-5.3-flash-free | gateway | gpt-6.1-sol-30m | 6.00 | 14451.40 | $0.028903 | $0.009577 | $0.000402 | $0.038882 |
| opencode/glm-5.3-flash-free | heavy-max | deepseek-flash-off-peak | 5.67 | 153878.03 | $0.023082 | $0.000791 | $0.000000 | $0.023873 |
| opencode/glm-5.3-flash-free | heavy-max | deepseek-flash-peak | 5.67 | 153878.03 | $0.046163 | $0.001582 | $0.000000 | $0.047745 |
| opencode/glm-5.3-flash-free | heavy-max | glm-5.3-flash | 5.67 | 269984.27 | $0.040498 | $0.000659 | $0.000000 | $0.041157 |
| opencode/glm-5.3-flash-free | heavy-max | claude-sonnet-5.5-5m | 5.67 | 173229.07 | $0.346458 | $0.013180 | $0.000000 | $0.359638 |
| opencode/glm-5.3-flash-free | heavy-max | gpt-6.1-sol-30m | 5.67 | 173229.07 | $0.346458 | $0.013180 | $0.000000 | $0.359638 |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-off-peak | 3.67 | 108046.84 | $0.016207 | $0.000342 | $0.000000 | $0.016549 |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-peak | 3.67 | 108046.84 | $0.032414 | $0.000684 | $0.000000 | $0.033098 |
| opencode/glm-5.3-flash-free | mcp-all | glm-5.3-flash | 3.67 | 156753.40 | $0.023513 | $0.000285 | $0.000000 | $0.023798 |
| opencode/glm-5.3-flash-free | mcp-all | claude-sonnet-5.5-5m | 3.67 | 116164.60 | $0.232329 | $0.005697 | $0.000000 | $0.238026 |
| opencode/glm-5.3-flash-free | mcp-all | gpt-6.1-sol-30m | 3.67 | 116164.60 | $0.232329 | $0.005697 | $0.000000 | $0.238026 |
| opencode/glm-5.3-flash-free | preselect | deepseek-flash-off-peak | 10.33 | 20870.89 | $0.003131 | $0.001814 | $0.001244 | $0.006188 |
| opencode/glm-5.3-flash-free | preselect | deepseek-flash-peak | 10.33 | 20870.89 | $0.006261 | $0.003628 | $0.001244 | $0.011133 |
| opencode/glm-5.3-flash-free | preselect | glm-5.3-flash | 10.33 | 39037.93 | $0.005856 | $0.001512 | $0.001244 | $0.008611 |
| opencode/glm-5.3-flash-free | preselect | claude-sonnet-5.5-5m | 10.33 | 23898.73 | $0.047797 | $0.030237 | $0.001244 | $0.079278 |
| opencode/glm-5.3-flash-free | preselect | gpt-6.1-sol-30m | 10.33 | 23898.73 | $0.047797 | $0.030237 | $0.001244 | $0.079278 |

### Size sweep and observed break-even

Comparisons use the common valid task/repetition panel across gateway and every observed size in a family. Sizes are recorded skill counts or tool counts (MCP), including planted items. The gateway horizontal band is the observed session-cost min/max, not a confidence interval. Break-even is the first measured native size at or above the gateway mean; no interpolation or extrapolation. Cost includes Jev. Chart x labels are categorical measured sizes.

not shown: no common valid gateway/size-sweep panel.
