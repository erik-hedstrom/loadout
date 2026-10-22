# B11 cache-aware session report

Test rows are the evaluation result. Dev rows appear separately and are the only rows eligible for tuning. Invalid attempts are counted separately, never as quality failures. Wilson 95% intervals describe observed valid sessions; repeated tasks are not independent evidence of population-wide quality.

Token columns sum valid sessions. Input, cache read and cache write are disjoint prompt buckets ([OpenCode 1.19.3 usage normalization](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/opencode/src/session/session.ts#L321-L383)). Output excludes the separately recorded reasoning counter. First requests can already hit a cross-session cache; they are not assumed cold. Cache ratios pool tokens within each request position; later positions include only sessions that reached them.

Hypothetical paid costs reprice these measured tokens under each named sheet; tokenizers and cache policies differ across providers, so this does not predict their quality or actual billed usage. Weighted input = input + read × read/input price + write × write/input price. Session cost adds output and reasoning at the output rate, plus recorded Jev cost. Free model spend is $0; Jev spend includes invalid attempts in the attempts table.

## Valid completion by arm

Valid completion = (pass + fail) / all recorded attempts; retries remain separate attempts. This operational table pools models and dev/test splits; quality and cost remain split-separated below. Timeouts are invalid attempts, never quality failures. Any arm under 90% valid completion risks survivor bias: its surviving sessions may not represent quality or cost across all attempts.

| Arm | Valid sessions | Attempts | Valid completion | Assessment |
|---|---:|---:|---:|---|
| heavy-max | 0 | 1 | 0.00% | UNDER 90%: not usable in observed attempts |

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
| opencode/glm-5.3-flash-free | heavy-max | 0 | 0 | 1 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |

### Invalid usage and all-attempt Jev spend

Invalid reasons count attempts, including retries; zero token counters do not imply zero invalid attempts. Deadlines list distinct configured timeoutMs values; unknown (historical) marks omitted values. Groups with different deadlines remain pooled and are not a common-timeout comparison.

| Model | Arm | Invalid reasons | Deadlines (ms) | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | heavy-max | provider-error 1 | 1200000 | 1 | 171784 | 0 | 0 | 27 | 125 | 0 | $0.000000 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|

### Timing from event-arrival timestamps

Startup is process launch to first step_start; each step is step_start to step_finish, measured at event arrival. Startup is not proof of MCP discovery latency and may include provider/network time. Samples include known startup and completed-step durations from valid and invalid attempts. Historical missing latency and null durations are not shown; unfinished steps have no duration sample. Session wall time covers all attempts, including unfinished timeout waits, preselection, checks and cleanup. An attempt may never launch OpenCode; wall time measures the observed lifecycle, not pure model time. Startup and step durations do not partition wall time. Gaps from step_finish to next step_start can include tool/MCP work, request setup and network waits.

| Model | Arm | Phase | Samples | Mean ms | Median ms | Max ms |
|---|---|---|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | heavy-max | Session wall | 1 | 12485.00 | 12485.00 | 12485.00 |
| opencode/glm-5.3-flash-free | heavy-max | Startup | 1 | 11629.06 | 11629.06 | 11629.06 |
| opencode/glm-5.3-flash-free | heavy-max | Step 1 | 1 | 653.11 | 653.11 | 653.11 |

### Hypothetical paid cost per valid session

**Caution: survivor bias in quality and cost.** Under 90% valid completion: opencode/glm-5.3-flash-free / heavy-max. These costs describe surviving valid sessions, not the cost of all attempted work; zero-valid arms are not usable in observed attempts.

| Model | Arm | Sheet | Mean steps | Mean weighted input | Mean input USD | Mean output/reasoning USD | Mean Jev USD | Mean total USD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| opencode/glm-5.3-flash-free | heavy-max | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | heavy-max | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | heavy-max | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | heavy-max | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | heavy-max | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |

### Size sweep and observed break-even

Comparisons use the common valid task/repetition panel across gateway and every observed size in a family. Sizes are recorded skill counts or tool counts (MCP), including planted items. The gateway horizontal band is the observed session-cost min/max, not a confidence interval. Break-even is the first measured native size at or above the gateway mean; no interpolation or extrapolation. Cost includes Jev. Chart x labels are categorical measured sizes.

not shown: no common valid gateway/size-sweep panel.

## Dev split

not shown: no rows.
