# B11 cache-aware session report

Test rows are the evaluation result. Dev rows appear separately and are the only rows eligible for tuning. Invalid attempts are counted separately, never as quality failures. Wilson 95% intervals describe observed valid sessions; repeated tasks are not independent evidence of population-wide quality.

Token columns sum valid sessions. Input, cache read and cache write are disjoint prompt buckets ([OpenCode 1.19.3 usage normalization](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/opencode/src/session/session.ts#L321-L383)). Output excludes the separately recorded reasoning counter. First requests can already hit a cross-session cache; they are not assumed cold. Cache ratios pool tokens within each request position; later positions include only sessions that reached them.

Hypothetical paid costs reprice these measured tokens under each named sheet; tokenizers and cache policies differ across providers, so this does not predict their quality or actual billed usage. Weighted input = input + read × read/input price + write × write/input price. Session cost adds output and reasoning at the output rate, plus recorded Jev cost. Free model spend is $0; Jev spend includes invalid attempts in the attempts table.

## Valid completion by arm

Valid completion = (pass + fail) / all recorded attempts; retries remain separate attempts. This operational table pools models and dev/test splits; quality and cost remain split-separated below. Timeouts are invalid attempts, never quality failures. Any arm under 90% valid completion risks survivor bias: its surviving sessions may not represent quality or cost across all attempts.

| Arm | Valid sessions | Attempts | Valid completion | Assessment |
|---|---:|---:|---:|---|
| skills-all | 0 | 1 | 0.00% | UNDER 90%: not usable in observed attempts |

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
| opencode/glm-5.3-flash-free | skills-all | 0 | 0 | 1 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |

### Invalid usage and all-attempt Jev spend

Invalid reasons count attempts, including retries; zero token counters do not imply zero invalid attempts. Deadlines list distinct configured timeoutMs values; unknown (historical) marks omitted values. Groups with different deadlines remain pooled and are not a common-timeout comparison.

| Model | Arm | Invalid reasons | Deadlines (ms) | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | skills-all | timeout 1 | unknown (historical) | 110 | 489878 | 9284992 | 0 | 45262 | 3030 | 0 | $0.000000 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|

### Timing from event-arrival timestamps

Startup is process launch to first step_start; each step is step_start to step_finish, measured at event arrival. Startup is not proof of MCP discovery latency and may include provider/network time. Samples include known startup and completed-step durations from valid and invalid attempts. Historical missing latency and null durations are not shown; unfinished steps have no duration sample. Session wall time covers all attempts, including unfinished timeout waits, preselection, checks and cleanup. An attempt may never launch OpenCode; wall time measures the observed lifecycle, not pure model time. Startup and step durations do not partition wall time. Gaps from step_finish to next step_start can include tool/MCP work, request setup and network waits.

| Model | Arm | Phase | Samples | Mean ms | Median ms | Max ms |
|---|---|---|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | skills-all | Session wall | 1 | 1200202.00 | 1200202.00 | 1200202.00 |
| opencode/glm-5.3-flash-free | skills-all | Startup | 1 | 23569.76 | 23569.76 | 23569.76 |
| opencode/glm-5.3-flash-free | skills-all | Step 1 | 1 | 1706.07 | 1706.07 | 1706.07 |
| opencode/glm-5.3-flash-free | skills-all | Step 2 | 1 | 5887.01 | 5887.01 | 5887.01 |
| opencode/glm-5.3-flash-free | skills-all | Step 3 | 1 | 1175.05 | 1175.05 | 1175.05 |
| opencode/glm-5.3-flash-free | skills-all | Step 4 | 1 | 5170.84 | 5170.84 | 5170.84 |
| opencode/glm-5.3-flash-free | skills-all | Step 5 | 1 | 1361.79 | 1361.79 | 1361.79 |
| opencode/glm-5.3-flash-free | skills-all | Step 6 | 1 | 4912.90 | 4912.90 | 4912.90 |
| opencode/glm-5.3-flash-free | skills-all | Step 7 | 1 | 824.80 | 824.80 | 824.80 |
| opencode/glm-5.3-flash-free | skills-all | Step 8 | 1 | 6041.88 | 6041.88 | 6041.88 |
| opencode/glm-5.3-flash-free | skills-all | Step 9 | 1 | 326.81 | 326.81 | 326.81 |
| opencode/glm-5.3-flash-free | skills-all | Step 10 | 1 | 5776.51 | 5776.51 | 5776.51 |
| opencode/glm-5.3-flash-free | skills-all | Step 11 | 1 | 1317.54 | 1317.54 | 1317.54 |
| opencode/glm-5.3-flash-free | skills-all | Step 12 | 1 | 6365.08 | 6365.08 | 6365.08 |
| opencode/glm-5.3-flash-free | skills-all | Step 13 | 1 | 2109.97 | 2109.97 | 2109.97 |
| opencode/glm-5.3-flash-free | skills-all | Step 14 | 1 | 5848.70 | 5848.70 | 5848.70 |
| opencode/glm-5.3-flash-free | skills-all | Step 15 | 1 | 607.80 | 607.80 | 607.80 |
| opencode/glm-5.3-flash-free | skills-all | Step 16 | 1 | 5513.42 | 5513.42 | 5513.42 |
| opencode/glm-5.3-flash-free | skills-all | Step 17 | 1 | 3005.00 | 3005.00 | 3005.00 |
| opencode/glm-5.3-flash-free | skills-all | Step 18 | 1 | 6248.51 | 6248.51 | 6248.51 |
| opencode/glm-5.3-flash-free | skills-all | Step 19 | 1 | 872.42 | 872.42 | 872.42 |
| opencode/glm-5.3-flash-free | skills-all | Step 20 | 1 | 6282.78 | 6282.78 | 6282.78 |
| opencode/glm-5.3-flash-free | skills-all | Step 21 | 1 | 5624.01 | 5624.01 | 5624.01 |
| opencode/glm-5.3-flash-free | skills-all | Step 22 | 1 | 6550.51 | 6550.51 | 6550.51 |
| opencode/glm-5.3-flash-free | skills-all | Step 23 | 1 | 649.07 | 649.07 | 649.07 |
| opencode/glm-5.3-flash-free | skills-all | Step 24 | 1 | 6680.79 | 6680.79 | 6680.79 |
| opencode/glm-5.3-flash-free | skills-all | Step 25 | 1 | 3464.68 | 3464.68 | 3464.68 |
| opencode/glm-5.3-flash-free | skills-all | Step 26 | 1 | 6369.42 | 6369.42 | 6369.42 |
| opencode/glm-5.3-flash-free | skills-all | Step 27 | 1 | 1781.36 | 1781.36 | 1781.36 |
| opencode/glm-5.3-flash-free | skills-all | Step 28 | 1 | 5889.66 | 5889.66 | 5889.66 |
| opencode/glm-5.3-flash-free | skills-all | Step 29 | 1 | 5373.11 | 5373.11 | 5373.11 |
| opencode/glm-5.3-flash-free | skills-all | Step 30 | 1 | 6104.19 | 6104.19 | 6104.19 |
| opencode/glm-5.3-flash-free | skills-all | Step 31 | 1 | 4941.25 | 4941.25 | 4941.25 |
| opencode/glm-5.3-flash-free | skills-all | Step 32 | 1 | 6373.05 | 6373.05 | 6373.05 |
| opencode/glm-5.3-flash-free | skills-all | Step 33 | 1 | 5049.15 | 5049.15 | 5049.15 |
| opencode/glm-5.3-flash-free | skills-all | Step 34 | 1 | 7190.89 | 7190.89 | 7190.89 |
| opencode/glm-5.3-flash-free | skills-all | Step 35 | 1 | 3453.91 | 3453.91 | 3453.91 |
| opencode/glm-5.3-flash-free | skills-all | Step 36 | 1 | 7406.31 | 7406.31 | 7406.31 |
| opencode/glm-5.3-flash-free | skills-all | Step 37 | 1 | 4055.18 | 4055.18 | 4055.18 |
| opencode/glm-5.3-flash-free | skills-all | Step 38 | 1 | 7380.69 | 7380.69 | 7380.69 |
| opencode/glm-5.3-flash-free | skills-all | Step 39 | 1 | 3970.13 | 3970.13 | 3970.13 |
| opencode/glm-5.3-flash-free | skills-all | Step 40 | 1 | 7815.84 | 7815.84 | 7815.84 |
| opencode/glm-5.3-flash-free | skills-all | Step 41 | 1 | 3423.12 | 3423.12 | 3423.12 |
| opencode/glm-5.3-flash-free | skills-all | Step 42 | 1 | 7703.12 | 7703.12 | 7703.12 |
| opencode/glm-5.3-flash-free | skills-all | Step 43 | 1 | 5987.93 | 5987.93 | 5987.93 |
| opencode/glm-5.3-flash-free | skills-all | Step 44 | 1 | 8233.39 | 8233.39 | 8233.39 |
| opencode/glm-5.3-flash-free | skills-all | Step 45 | 1 | 4617.39 | 4617.39 | 4617.39 |
| opencode/glm-5.3-flash-free | skills-all | Step 46 | 1 | 7740.64 | 7740.64 | 7740.64 |
| opencode/glm-5.3-flash-free | skills-all | Step 47 | 1 | 4226.04 | 4226.04 | 4226.04 |
| opencode/glm-5.3-flash-free | skills-all | Step 48 | 1 | 8475.78 | 8475.78 | 8475.78 |
| opencode/glm-5.3-flash-free | skills-all | Step 49 | 1 | 3755.57 | 3755.57 | 3755.57 |
| opencode/glm-5.3-flash-free | skills-all | Step 50 | 1 | 8118.83 | 8118.83 | 8118.83 |
| opencode/glm-5.3-flash-free | skills-all | Step 51 | 1 | 5863.29 | 5863.29 | 5863.29 |
| opencode/glm-5.3-flash-free | skills-all | Step 52 | 1 | 7109.35 | 7109.35 | 7109.35 |
| opencode/glm-5.3-flash-free | skills-all | Step 53 | 1 | 4893.10 | 4893.10 | 4893.10 |
| opencode/glm-5.3-flash-free | skills-all | Step 54 | 1 | 8177.65 | 8177.65 | 8177.65 |
| opencode/glm-5.3-flash-free | skills-all | Step 55 | 1 | 3781.36 | 3781.36 | 3781.36 |
| opencode/glm-5.3-flash-free | skills-all | Step 56 | 1 | 6583.50 | 6583.50 | 6583.50 |
| opencode/glm-5.3-flash-free | skills-all | Step 57 | 1 | 4672.56 | 4672.56 | 4672.56 |
| opencode/glm-5.3-flash-free | skills-all | Step 58 | 1 | 7255.41 | 7255.41 | 7255.41 |
| opencode/glm-5.3-flash-free | skills-all | Step 59 | 1 | 5956.45 | 5956.45 | 5956.45 |
| opencode/glm-5.3-flash-free | skills-all | Step 60 | 1 | 7903.13 | 7903.13 | 7903.13 |
| opencode/glm-5.3-flash-free | skills-all | Step 61 | 1 | 5693.11 | 5693.11 | 5693.11 |
| opencode/glm-5.3-flash-free | skills-all | Step 62 | 1 | 8425.94 | 8425.94 | 8425.94 |
| opencode/glm-5.3-flash-free | skills-all | Step 63 | 1 | 6290.01 | 6290.01 | 6290.01 |
| opencode/glm-5.3-flash-free | skills-all | Step 64 | 1 | 7588.59 | 7588.59 | 7588.59 |
| opencode/glm-5.3-flash-free | skills-all | Step 65 | 1 | 5580.56 | 5580.56 | 5580.56 |
| opencode/glm-5.3-flash-free | skills-all | Step 66 | 1 | 7917.56 | 7917.56 | 7917.56 |
| opencode/glm-5.3-flash-free | skills-all | Step 67 | 1 | 5093.77 | 5093.77 | 5093.77 |
| opencode/glm-5.3-flash-free | skills-all | Step 68 | 1 | 7566.59 | 7566.59 | 7566.59 |
| opencode/glm-5.3-flash-free | skills-all | Step 69 | 1 | 3460.87 | 3460.87 | 3460.87 |
| opencode/glm-5.3-flash-free | skills-all | Step 70 | 1 | 7885.53 | 7885.53 | 7885.53 |
| opencode/glm-5.3-flash-free | skills-all | Step 71 | 1 | 3557.87 | 3557.87 | 3557.87 |
| opencode/glm-5.3-flash-free | skills-all | Step 72 | 1 | 7313.71 | 7313.71 | 7313.71 |
| opencode/glm-5.3-flash-free | skills-all | Step 73 | 1 | 4072.09 | 4072.09 | 4072.09 |
| opencode/glm-5.3-flash-free | skills-all | Step 74 | 1 | 6845.05 | 6845.05 | 6845.05 |
| opencode/glm-5.3-flash-free | skills-all | Step 75 | 1 | 5107.12 | 5107.12 | 5107.12 |
| opencode/glm-5.3-flash-free | skills-all | Step 76 | 1 | 7670.97 | 7670.97 | 7670.97 |
| opencode/glm-5.3-flash-free | skills-all | Step 77 | 1 | 4313.38 | 4313.38 | 4313.38 |
| opencode/glm-5.3-flash-free | skills-all | Step 78 | 1 | 7449.20 | 7449.20 | 7449.20 |
| opencode/glm-5.3-flash-free | skills-all | Step 79 | 1 | 2443.30 | 2443.30 | 2443.30 |
| opencode/glm-5.3-flash-free | skills-all | Step 80 | 1 | 9539.51 | 9539.51 | 9539.51 |
| opencode/glm-5.3-flash-free | skills-all | Step 81 | 1 | 4154.72 | 4154.72 | 4154.72 |
| opencode/glm-5.3-flash-free | skills-all | Step 82 | 1 | 8033.31 | 8033.31 | 8033.31 |
| opencode/glm-5.3-flash-free | skills-all | Step 83 | 1 | 5745.07 | 5745.07 | 5745.07 |
| opencode/glm-5.3-flash-free | skills-all | Step 84 | 1 | 9620.05 | 9620.05 | 9620.05 |
| opencode/glm-5.3-flash-free | skills-all | Step 85 | 1 | 4142.33 | 4142.33 | 4142.33 |
| opencode/glm-5.3-flash-free | skills-all | Step 86 | 1 | 9560.53 | 9560.53 | 9560.53 |
| opencode/glm-5.3-flash-free | skills-all | Step 87 | 1 | 6035.48 | 6035.48 | 6035.48 |
| opencode/glm-5.3-flash-free | skills-all | Step 88 | 1 | 11123.93 | 11123.93 | 11123.93 |
| opencode/glm-5.3-flash-free | skills-all | Step 89 | 1 | 2085.06 | 2085.06 | 2085.06 |
| opencode/glm-5.3-flash-free | skills-all | Step 90 | 1 | 8449.60 | 8449.60 | 8449.60 |
| opencode/glm-5.3-flash-free | skills-all | Step 91 | 1 | 4067.95 | 4067.95 | 4067.95 |
| opencode/glm-5.3-flash-free | skills-all | Step 92 | 1 | 8360.58 | 8360.58 | 8360.58 |
| opencode/glm-5.3-flash-free | skills-all | Step 93 | 1 | 11315.00 | 11315.00 | 11315.00 |
| opencode/glm-5.3-flash-free | skills-all | Step 94 | 1 | 9041.16 | 9041.16 | 9041.16 |
| opencode/glm-5.3-flash-free | skills-all | Step 95 | 1 | 6147.46 | 6147.46 | 6147.46 |
| opencode/glm-5.3-flash-free | skills-all | Step 96 | 1 | 8469.14 | 8469.14 | 8469.14 |
| opencode/glm-5.3-flash-free | skills-all | Step 97 | 1 | 5348.18 | 5348.18 | 5348.18 |
| opencode/glm-5.3-flash-free | skills-all | Step 98 | 1 | 8970.72 | 8970.72 | 8970.72 |
| opencode/glm-5.3-flash-free | skills-all | Step 99 | 1 | 3781.01 | 3781.01 | 3781.01 |
| opencode/glm-5.3-flash-free | skills-all | Step 100 | 1 | 9006.20 | 9006.20 | 9006.20 |
| opencode/glm-5.3-flash-free | skills-all | Step 101 | 1 | 5464.49 | 5464.49 | 5464.49 |
| opencode/glm-5.3-flash-free | skills-all | Step 102 | 1 | 9008.34 | 9008.34 | 9008.34 |
| opencode/glm-5.3-flash-free | skills-all | Step 103 | 1 | 4639.20 | 4639.20 | 4639.20 |
| opencode/glm-5.3-flash-free | skills-all | Step 104 | 1 | 8946.80 | 8946.80 | 8946.80 |
| opencode/glm-5.3-flash-free | skills-all | Step 105 | 1 | 4809.47 | 4809.47 | 4809.47 |
| opencode/glm-5.3-flash-free | skills-all | Step 106 | 1 | 9257.44 | 9257.44 | 9257.44 |
| opencode/glm-5.3-flash-free | skills-all | Step 107 | 1 | 4617.49 | 4617.49 | 4617.49 |
| opencode/glm-5.3-flash-free | skills-all | Step 108 | 1 | 8791.11 | 8791.11 | 8791.11 |
| opencode/glm-5.3-flash-free | skills-all | Step 109 | 1 | 7512.68 | 7512.68 | 7512.68 |
| opencode/glm-5.3-flash-free | skills-all | Step 110 | 1 | 9615.22 | 9615.22 | 9615.22 |

### Hypothetical paid cost per valid session

**Caution: survivor bias in quality and cost.** Under 90% valid completion: opencode/glm-5.3-flash-free / skills-all. These costs describe surviving valid sessions, not the cost of all attempted work; zero-valid arms are not usable in observed attempts.

| Model | Arm | Sheet | Mean steps | Mean weighted input | Mean input USD | Mean output/reasoning USD | Mean Jev USD | Mean total USD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | skills-all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |

### Size sweep and observed break-even

Comparisons use the common valid task/repetition panel across gateway and every observed size in a family. Sizes are recorded skill counts or tool counts (MCP), including planted items. The gateway horizontal band is the observed session-cost min/max, not a confidence interval. Break-even is the first measured native size at or above the gateway mean; no interpolation or extrapolation. Cost includes Jev. Chart x labels are categorical measured sizes.

not shown: no common valid gateway/size-sweep panel.

## Dev split

not shown: no rows.
