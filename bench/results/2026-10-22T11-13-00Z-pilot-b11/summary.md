# B11 cache-aware session report

Test rows are the evaluation result. Dev rows appear separately and are the only rows eligible for tuning. Invalid attempts are counted separately, never as quality failures. Wilson 95% intervals describe observed valid sessions; repeated tasks are not independent evidence of population-wide quality.

Token columns sum valid sessions. Input, cache read and cache write are disjoint prompt buckets ([OpenCode 1.19.3 usage normalization](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/opencode/src/session/session.ts#L321-L383)). Output excludes the separately recorded reasoning counter. First requests can already hit a cross-session cache; they are not assumed cold. Cache ratios pool tokens within each request position; later positions include only sessions that reached them.

Hypothetical paid costs reprice these measured tokens under each named sheet; tokenizers and cache policies differ across providers, so this does not predict their quality or actual billed usage. Weighted input = input + read × read/input price + write × write/input price. Session cost adds output and reasoning at the output rate, plus recorded Jev cost. Free model spend is $0; Jev spend includes invalid attempts in the attempts table.

## Valid completion by arm

Valid completion = (pass + fail) / all recorded attempts; retries remain separate attempts. This operational table pools models and dev/test splits; quality and cost remain split-separated below. Timeouts are invalid attempts, never quality failures. Any arm under 90% valid completion risks survivor bias: its surviving sessions may not represent quality or cost across all attempts.

| Arm | Valid sessions | Attempts | Valid completion | Assessment |
|---|---:|---:|---:|---|
| bare | 9 | 9 | 100.00% | at least 90% |
| mcp-all | 0 | 6 | 0.00% | UNDER 90%: not usable in observed attempts |

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
| opencode/glm-5.3-flash-free | bare | 1 | 5 | 0 | 100.00% | at least 90% | 16.67% (3–56%) | 28 | 62817 | 144896 | 0 | 1796 | 2796 |
| opencode/glm-5.3-flash-free | mcp-all | 0 | 0 | 5 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |

### Invalid usage and all-attempt Jev spend

Invalid reasons count attempts, including retries; zero token counters do not imply zero invalid attempts. Deadlines list distinct configured timeoutMs values; unknown (historical) marks omitted values. Groups with different deadlines remain pooled and are not a common-timeout comparison.

| Model | Arm | Invalid reasons | Deadlines (ms) | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | mcp-all | timeout 5 | 300000 | 1 | 101439 | 0 | 0 | 21 | 101 | 0 | $0.000000 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | 1 (first / cross-session) | 6 | 33759 | 6528 | 0 | 16.20% |
| opencode/glm-5.3-flash-free | bare | 2 (later) | 6 | 2648 | 39168 | 0 | 93.67% |
| opencode/glm-5.3-flash-free | bare | 3 (later) | 6 | 2565 | 40448 | 0 | 94.04% |
| opencode/glm-5.3-flash-free | bare | 4 (later) | 5 | 8467 | 28864 | 0 | 77.32% |
| opencode/glm-5.3-flash-free | bare | 5 (later) | 3 | 9887 | 13568 | 0 | 57.85% |
| opencode/glm-5.3-flash-free | bare | 6 (later) | 1 | 4306 | 6528 | 0 | 60.25% |
| opencode/glm-5.3-flash-free | bare | 7 (later) | 1 | 1185 | 9792 | 0 | 89.20% |

### Timing from event-arrival timestamps

Startup is process launch to first step_start; each step is step_start to step_finish, measured at event arrival. Startup is not proof of MCP discovery latency and may include provider/network time. Samples include known startup and completed-step durations from valid and invalid attempts. Historical missing latency and null durations are not shown; unfinished steps have no duration sample. Session wall time covers all attempts, including unfinished timeout waits, preselection, checks and cleanup. An attempt may never launch OpenCode; wall time measures the observed lifecycle, not pure model time. Startup and step durations do not partition wall time. Gaps from step_finish to next step_start can include tool/MCP work, request setup and network waits.

| Model | Arm | Phase | Samples | Mean ms | Median ms | Max ms |
|---|---|---|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | Session wall | 6 | 16812.67 | 15401.00 | 33489.00 |
| opencode/glm-5.3-flash-free | bare | Startup | 6 | 5000.47 | 5015.20 | 6333.15 |
| opencode/glm-5.3-flash-free | bare | Step 1 | 6 | 1020.62 | 838.91 | 2463.55 |
| opencode/glm-5.3-flash-free | bare | Step 2 | 6 | 481.86 | 347.33 | 1199.34 |
| opencode/glm-5.3-flash-free | bare | Step 3 | 6 | 2058.70 | 1465.09 | 4622.83 |
| opencode/glm-5.3-flash-free | bare | Step 4 | 5 | 1647.67 | 2084.04 | 3037.73 |
| opencode/glm-5.3-flash-free | bare | Step 5 | 3 | 1910.60 | 1936.26 | 3338.28 |
| opencode/glm-5.3-flash-free | bare | Step 6 | 1 | 1946.79 | 1946.79 | 1946.79 |
| opencode/glm-5.3-flash-free | bare | Step 7 | 1 | 4388.62 | 4388.62 | 4388.62 |
| opencode/glm-5.3-flash-free | mcp-all | Session wall | 5 | 300138.80 | 300105.00 | 300214.00 |
| opencode/glm-5.3-flash-free | mcp-all | Startup | 1 | 13165.53 | 13165.53 | 13165.53 |
| opencode/glm-5.3-flash-free | mcp-all | Step 1 | 1 | 1665.46 | 1665.46 | 1665.46 |

### Hypothetical paid cost per valid session

**Caution: survivor bias in quality and cost.** Under 90% valid completion: opencode/glm-5.3-flash-free / mcp-all. These costs describe surviving valid sessions, not the cost of all attempted work; zero-valid arms are not usable in observed attempts.

| Model | Arm | Sheet | Mean steps | Mean weighted input | Mean input USD | Mean output/reasoning USD | Mean Jev USD | Mean total USD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | deepseek-flash-off-peak | 4.67 | 10952.49 | $0.001643 | $0.000459 | $0.000000 | $0.002102 |
| opencode/glm-5.3-flash-free | bare | deepseek-flash-peak | 4.67 | 10952.49 | $0.003286 | $0.000918 | $0.000000 | $0.004204 |
| opencode/glm-5.3-flash-free | bare | glm-5.3-flash | 4.67 | 15299.37 | $0.002295 | $0.000383 | $0.000000 | $0.002678 |
| opencode/glm-5.3-flash-free | bare | claude-sonnet-5.5-5m | 4.67 | 11676.97 | $0.023354 | $0.007653 | $0.000000 | $0.031007 |
| opencode/glm-5.3-flash-free | bare | gpt-6.1-sol-30m | 4.67 | 11676.97 | $0.023354 | $0.007653 | $0.000000 | $0.031007 |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |

### Size sweep and observed break-even

Comparisons use the common valid task/repetition panel across gateway and every observed size in a family. Sizes are recorded skill counts or tool counts (MCP), including planted items. The gateway horizontal band is the observed session-cost min/max, not a confidence interval. Break-even is the first measured native size at or above the gateway mean; no interpolation or extrapolation. Cost includes Jev. Chart x labels are categorical measured sizes.

not shown: no common valid gateway/size-sweep panel.

## Dev split

| Model | Arm | Pass | Fail | Invalid attempts | Valid completion | Assessment | Success among valid (Wilson 95%) | Steps | Uncached input | Cache read | Cache write | Output | Reasoning |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | 2 | 1 | 0 | 100.00% | at least 90% | 66.67% (21–94%) | 29 | 69999 | 201052 | 0 | 2818 | 7614 |
| opencode/glm-5.3-flash-free | mcp-all | 0 | 0 | 1 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |

### Invalid usage and all-attempt Jev spend

Invalid reasons count attempts, including retries; zero token counters do not imply zero invalid attempts. Deadlines list distinct configured timeoutMs values; unknown (historical) marks omitted values. Groups with different deadlines remain pooled and are not a common-timeout comparison.

| Model | Arm | Invalid reasons | Deadlines (ms) | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | mcp-all | timeout 1 | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | 1 (first / cross-session) | 3 | 13715 | 6528 | 0 | 32.25% |
| opencode/glm-5.3-flash-free | bare | 2 (later) | 3 | 1287 | 19584 | 0 | 93.83% |
| opencode/glm-5.3-flash-free | bare | 3 (later) | 3 | 7944 | 13696 | 0 | 63.29% |
| opencode/glm-5.3-flash-free | bare | 4 (later) | 3 | 8497 | 14080 | 0 | 62.36% |
| opencode/glm-5.3-flash-free | bare | 5 (later) | 2 | 1336 | 14628 | 0 | 91.63% |
| opencode/glm-5.3-flash-free | bare | 6 (later) | 2 | 765 | 15780 | 0 | 95.38% |
| opencode/glm-5.3-flash-free | bare | 7 (later) | 2 | 2165 | 15444 | 0 | 87.71% |
| opencode/glm-5.3-flash-free | bare | 8 (later) | 2 | 2917 | 16896 | 0 | 85.28% |
| opencode/glm-5.3-flash-free | bare | 9 (later) | 2 | 11129 | 9728 | 0 | 46.64% |
| opencode/glm-5.3-flash-free | bare | 10 (later) | 1 | 564 | 10496 | 0 | 94.90% |
| opencode/glm-5.3-flash-free | bare | 11 (later) | 1 | 637 | 10880 | 0 | 94.47% |
| opencode/glm-5.3-flash-free | bare | 12 (later) | 1 | 11767 | 0 | 0 | 0.00% |
| opencode/glm-5.3-flash-free | bare | 13 (later) | 1 | 1591 | 10880 | 0 | 87.24% |
| opencode/glm-5.3-flash-free | bare | 14 (later) | 1 | 2847 | 11968 | 0 | 80.78% |
| opencode/glm-5.3-flash-free | bare | 15 (later) | 1 | 2242 | 14144 | 0 | 86.32% |
| opencode/glm-5.3-flash-free | bare | 16 (later) | 1 | 596 | 16320 | 0 | 96.48% |

### Timing from event-arrival timestamps

Startup is process launch to first step_start; each step is step_start to step_finish, measured at event arrival. Startup is not proof of MCP discovery latency and may include provider/network time. Samples include known startup and completed-step durations from valid and invalid attempts. Historical missing latency and null durations are not shown; unfinished steps have no duration sample. Session wall time covers all attempts, including unfinished timeout waits, preselection, checks and cleanup. An attempt may never launch OpenCode; wall time measures the observed lifecycle, not pure model time. Startup and step durations do not partition wall time. Gaps from step_finish to next step_start can include tool/MCP work, request setup and network waits.

| Model | Arm | Phase | Samples | Mean ms | Median ms | Max ms |
|---|---|---|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | Session wall | 3 | 58950.67 | 44661.00 | 121569.00 |
| opencode/glm-5.3-flash-free | bare | Startup | 3 | 4236.79 | 4061.86 | 4828.51 |
| opencode/glm-5.3-flash-free | bare | Step 1 | 3 | 675.15 | 533.83 | 1289.53 |
| opencode/glm-5.3-flash-free | bare | Step 2 | 3 | 1403.13 | 1059.43 | 2175.89 |
| opencode/glm-5.3-flash-free | bare | Step 3 | 3 | 2451.00 | 1853.37 | 5217.72 |
| opencode/glm-5.3-flash-free | bare | Step 4 | 3 | 2189.75 | 1167.01 | 4781.53 |
| opencode/glm-5.3-flash-free | bare | Step 5 | 2 | 1734.62 | 1734.62 | 2107.76 |
| opencode/glm-5.3-flash-free | bare | Step 6 | 2 | 2441.05 | 2441.05 | 3532.06 |
| opencode/glm-5.3-flash-free | bare | Step 7 | 2 | 3923.90 | 3923.90 | 6854.14 |
| opencode/glm-5.3-flash-free | bare | Step 8 | 2 | 1272.29 | 1272.29 | 1673.04 |
| opencode/glm-5.3-flash-free | bare | Step 9 | 2 | 1304.17 | 1304.17 | 2282.24 |
| opencode/glm-5.3-flash-free | bare | Step 10 | 1 | 1838.57 | 1838.57 | 1838.57 |
| opencode/glm-5.3-flash-free | bare | Step 11 | 1 | 888.21 | 888.21 | 888.21 |
| opencode/glm-5.3-flash-free | bare | Step 12 | 1 | 9410.70 | 9410.70 | 9410.70 |
| opencode/glm-5.3-flash-free | bare | Step 13 | 1 | 23823.76 | 23823.76 | 23823.76 |
| opencode/glm-5.3-flash-free | bare | Step 14 | 1 | 27253.48 | 27253.48 | 27253.48 |
| opencode/glm-5.3-flash-free | bare | Step 15 | 1 | 10961.77 | 10961.77 | 10961.77 |
| opencode/glm-5.3-flash-free | bare | Step 16 | 1 | 11209.09 | 11209.09 | 11209.09 |
| opencode/glm-5.3-flash-free | mcp-all | Session wall | 1 | 300087.00 | 300087.00 | 300087.00 |
| opencode/glm-5.3-flash-free | mcp-all | Startup | 0 | not shown | not shown | not shown |

### Hypothetical paid cost per valid session

**Caution: survivor bias in quality and cost.** Under 90% valid completion: opencode/glm-5.3-flash-free / mcp-all. These costs describe surviving valid sessions, not the cost of all attempted work; zero-valid arms are not usable in observed attempts.

| Model | Arm | Sheet | Mean steps | Mean weighted input | Mean input USD | Mean output/reasoning USD | Mean Jev USD | Mean total USD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | bare | deepseek-flash-off-peak | 9.67 | 24673.35 | $0.003701 | $0.002086 | $0.000000 | $0.005787 |
| opencode/glm-5.3-flash-free | bare | deepseek-flash-peak | 9.67 | 24673.35 | $0.007402 | $0.004173 | $0.000000 | $0.011575 |
| opencode/glm-5.3-flash-free | bare | glm-5.3-flash | 9.67 | 36736.47 | $0.005510 | $0.001739 | $0.000000 | $0.007249 |
| opencode/glm-5.3-flash-free | bare | claude-sonnet-5.5-5m | 9.67 | 26683.87 | $0.053368 | $0.034773 | $0.000000 | $0.088141 |
| opencode/glm-5.3-flash-free | bare | gpt-6.1-sol-30m | 9.67 | 26683.87 | $0.053368 | $0.034773 | $0.000000 | $0.088141 |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |

### Size sweep and observed break-even

Comparisons use the common valid task/repetition panel across gateway and every observed size in a family. Sizes are recorded skill counts or tool counts (MCP), including planted items. The gateway horizontal band is the observed session-cost min/max, not a confidence interval. Break-even is the first measured native size at or above the gateway mean; no interpolation or extrapolation. Cost includes Jev. Chart x labels are categorical measured sizes.

not shown: no common valid gateway/size-sweep panel.
