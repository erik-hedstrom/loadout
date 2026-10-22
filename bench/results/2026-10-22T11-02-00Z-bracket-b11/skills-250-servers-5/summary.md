# B11 cache-aware session report

Test rows are the evaluation result. Dev rows appear separately and are the only rows eligible for tuning. Invalid attempts are counted separately, never as quality failures. Wilson 95% intervals describe observed valid sessions; repeated tasks are not independent evidence of population-wide quality.

Token columns sum valid sessions. Input, cache read and cache write are disjoint prompt buckets ([OpenCode 1.19.3 usage normalization](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/opencode/src/session/session.ts#L321-L383)). Output excludes the separately recorded reasoning counter. First requests can already hit a cross-session cache; they are not assumed cold. Cache ratios pool tokens within each request position; later positions include only sessions that reached them.

Hypothetical paid costs reprice these measured tokens under each named sheet; tokenizers and cache policies differ across providers, so this does not predict their quality or actual billed usage. Weighted input = input + read × read/input price + write × write/input price. Session cost adds output and reasoning at the output rate, plus recorded Jev cost. Free model spend is $0; Jev spend includes invalid attempts in the attempts table.

## Valid completion by arm

Valid completion = (pass + fail) / all recorded attempts; retries remain separate attempts. This operational table pools models and dev/test splits; quality and cost remain split-separated below. Timeouts are invalid attempts, never quality failures. Any arm under 90% valid completion risks survivor bias: its surviving sessions may not represent quality or cost across all attempts.

| Arm | Valid sessions | Attempts | Valid completion | Assessment |
|---|---:|---:|---:|---|
| heavy-max | 4 | 4 | 100.00% | at least 90% |

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
| opencode/deepseek-v4.1-flash-free | heavy-max | 2 | 0 | 0 | 100.00% | at least 90% | 100.00% (34–100%) | 10 | 272045 | 1144576 | 0 | 607 | 92 |
| opencode/glm-5.3-flash-free | heavy-max | 1 | 1 | 0 | 100.00% | at least 90% | 50.00% (9–91%) | 9 | 281086 | 964544 | 0 | 333 | 479 |

### Invalid usage and all-attempt Jev spend

Invalid reasons count attempts, including retries; zero token counters do not imply zero invalid attempts. Deadlines list distinct configured timeoutMs values; unknown (historical) marks omitted values. Groups with different deadlines remain pooled and are not a common-timeout comparison.

| Model | Arm | Invalid reasons | Deadlines (ms) | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | heavy-max | none | 1200000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | heavy-max | none | 1200000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | heavy-max | 1 (first / cross-session) | 2 | 139239 | 143232 | 0 | 50.71% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 2 (later) | 2 | 131661 | 151424 | 0 | 53.49% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 3 (later) | 2 | 472 | 283008 | 0 | 99.83% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 4 (later) | 2 | 292 | 283392 | 0 | 99.90% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 5 (later) | 2 | 381 | 283520 | 0 | 99.87% |
| opencode/glm-5.3-flash-free | heavy-max | 1 (first / cross-session) | 2 | 274705 | 1088 | 0 | 0.39% |
| opencode/glm-5.3-flash-free | heavy-max | 2 (later) | 2 | 1550 | 274816 | 0 | 99.44% |
| opencode/glm-5.3-flash-free | heavy-max | 3 (later) | 2 | 1464 | 275200 | 0 | 99.47% |
| opencode/glm-5.3-flash-free | heavy-max | 4 (later) | 1 | 1710 | 137088 | 0 | 98.77% |
| opencode/glm-5.3-flash-free | heavy-max | 5 (later) | 1 | 717 | 138176 | 0 | 99.48% |
| opencode/glm-5.3-flash-free | heavy-max | 6 (later) | 1 | 940 | 138176 | 0 | 99.32% |

### Timing from event-arrival timestamps

Startup is process launch to first step_start; each step is step_start to step_finish, measured at event arrival. Startup is not proof of MCP discovery latency and may include provider/network time. Samples include known startup and completed-step durations from valid and invalid attempts. Historical missing latency and null durations are not shown; unfinished steps have no duration sample. Session wall time covers all attempts, including unfinished timeout waits, preselection, checks and cleanup. An attempt may never launch OpenCode; wall time measures the observed lifecycle, not pure model time. Startup and step durations do not partition wall time. Gaps from step_finish to next step_start can include tool/MCP work, request setup and network waits.

| Model | Arm | Phase | Samples | Mean ms | Median ms | Max ms |
|---|---|---|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | heavy-max | Session wall | 2 | 37230.50 | 37230.50 | 43216.00 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Startup | 2 | 9460.90 | 9460.90 | 10013.38 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 1 | 2 | 467.21 | 467.21 | 502.55 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 2 | 2 | 563.44 | 563.44 | 596.10 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 3 | 2 | 225.49 | 225.49 | 237.60 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 4 | 2 | 348.02 | 348.02 | 366.53 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 5 | 2 | 384.13 | 384.13 | 675.59 |
| opencode/glm-5.3-flash-free | heavy-max | Session wall | 2 | 25121.00 | 25121.00 | 35120.00 |
| opencode/glm-5.3-flash-free | heavy-max | Startup | 2 | 11439.30 | 11439.30 | 12156.12 |
| opencode/glm-5.3-flash-free | heavy-max | Step 1 | 2 | 891.83 | 891.83 | 1180.37 |
| opencode/glm-5.3-flash-free | heavy-max | Step 2 | 2 | 559.72 | 559.72 | 694.33 |
| opencode/glm-5.3-flash-free | heavy-max | Step 3 | 2 | 179.06 | 179.06 | 182.10 |
| opencode/glm-5.3-flash-free | heavy-max | Step 4 | 1 | 1091.85 | 1091.85 | 1091.85 |
| opencode/glm-5.3-flash-free | heavy-max | Step 5 | 1 | 4353.45 | 4353.45 | 4353.45 |
| opencode/glm-5.3-flash-free | heavy-max | Step 6 | 1 | 158.16 | 158.16 | 158.16 |

### Hypothetical paid cost per valid session

| Model | Arm | Sheet | Mean steps | Mean weighted input | Mean input USD | Mean output/reasoning USD | Mean Jev USD | Mean total USD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | heavy-max | deepseek-flash-off-peak | 5.00 | 147468.26 | $0.022120 | $0.000210 | $0.000000 | $0.022330 |
| opencode/deepseek-v4.1-flash-free | heavy-max | deepseek-flash-peak | 5.00 | 147468.26 | $0.044240 | $0.000419 | $0.000000 | $0.044660 |
| opencode/deepseek-v4.1-flash-free | heavy-max | glm-5.3-flash | 5.00 | 250480.10 | $0.037572 | $0.000175 | $0.000000 | $0.037747 |
| opencode/deepseek-v4.1-flash-free | heavy-max | claude-sonnet-5.5-5m | 5.00 | 164636.90 | $0.329274 | $0.003495 | $0.000000 | $0.332769 |
| opencode/deepseek-v4.1-flash-free | heavy-max | gpt-6.1-sol-30m | 5.00 | 164636.90 | $0.329274 | $0.003495 | $0.000000 | $0.332769 |
| opencode/glm-5.3-flash-free | heavy-max | deepseek-flash-off-peak | 4.50 | 150188.44 | $0.022528 | $0.000244 | $0.000000 | $0.022772 |
| opencode/glm-5.3-flash-free | heavy-max | deepseek-flash-peak | 4.50 | 150188.44 | $0.045057 | $0.000487 | $0.000000 | $0.045544 |
| opencode/glm-5.3-flash-free | heavy-max | glm-5.3-flash | 4.50 | 236997.40 | $0.035550 | $0.000203 | $0.000000 | $0.035753 |
| opencode/glm-5.3-flash-free | heavy-max | claude-sonnet-5.5-5m | 4.50 | 164656.60 | $0.329313 | $0.004060 | $0.000000 | $0.333373 |
| opencode/glm-5.3-flash-free | heavy-max | gpt-6.1-sol-30m | 4.50 | 164656.60 | $0.329313 | $0.004060 | $0.000000 | $0.333373 |

### Size sweep and observed break-even

Comparisons use the common valid task/repetition panel across gateway and every observed size in a family. Sizes are recorded skill counts or tool counts (MCP), including planted items. The gateway horizontal band is the observed session-cost min/max, not a confidence interval. Break-even is the first measured native size at or above the gateway mean; no interpolation or extrapolation. Cost includes Jev. Chart x labels are categorical measured sizes.

not shown: no common valid gateway/size-sweep panel.

## Dev split

not shown: no rows.
