# B11 cache-aware session report

Test rows are the evaluation result. Dev rows appear separately and are the only rows eligible for tuning. Invalid attempts are counted separately, never as quality failures. Wilson 95% intervals describe observed valid sessions; repeated tasks are not independent evidence of population-wide quality.

Token columns sum valid sessions. Input, cache read and cache write are disjoint prompt buckets ([OpenCode 1.19.3 usage normalization](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/opencode/src/session/session.ts#L321-L383)). Output excludes the separately recorded reasoning counter. First requests can already hit a cross-session cache; they are not assumed cold. Cache ratios pool tokens within each request position; later positions include only sessions that reached them.

Hypothetical paid costs reprice these measured tokens under each named sheet; tokenizers and cache policies differ across providers, so this does not predict their quality or actual billed usage. Weighted input = input + read × read/input price + write × write/input price. Session cost adds output and reasoning at the output rate, plus recorded Jev cost. Free model spend is $0; Jev spend includes invalid attempts in the attempts table.

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

| Model | Arm | Pass | Fail | Invalid attempts | Success (Wilson 95%) | Steps | Uncached input | Cache read | Cache write | Output | Reasoning |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | 0 | 0 | 6 | not shown | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/deepseek-v4.1-flash-free | bare | 3 | 0 | 3 | 100.00% (44–100%) | 7 | 650 | 48512 | 0 | 248 | 74 |
| opencode/deepseek-v4.1-flash-free | gateway | 5 | 0 | 1 | 100.00% (57–100%) | 16 | 22206 | 108928 | 0 | 968 | 211 |
| opencode/deepseek-v4.1-flash-free | mcp-all | 4 | 0 | 2 | 100.00% (51–100%) | 9 | 100121 | 805632 | 0 | 329 | 21 |
| opencode/deepseek-v4.1-flash-free | preselect | 5 | 1 | 1 | 83.33% (44–97%) | 18 | 7829 | 121472 | 0 | 824 | 500 |
| opencode/deepseek-v4.1-flash-free | skills-all | 0 | 0 | 6 | not shown | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/glm-5.3-flash-free | all | 0 | 0 | 9 | not shown | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/glm-5.3-flash-free | bare | 3 | 3 | 2 | 50.00% (19–81%) | 20 | 73296 | 69056 | 0 | 1023 | 1360 |
| opencode/glm-5.3-flash-free | gateway | 6 | 0 | 0 | 100.00% (61–100%) | 18 | 77897 | 60800 | 0 | 468 | 122 |
| opencode/glm-5.3-flash-free | mcp-all | 4 | 0 | 4 | 100.00% (51–100%) | 9 | 686135 | 198976 | 0 | 178 | 221 |
| opencode/glm-5.3-flash-free | preselect | 5 | 1 | 0 | 83.33% (44–97%) | 15 | 68308 | 34112 | 0 | 442 | 569 |
| opencode/glm-5.3-flash-free | skills-all | 0 | 0 | 12 | not shown | 0 | 0 | 0 | 0 | 0 | 0 |

### Invalid usage and all-attempt Jev spend

| Model | Arm | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | 20 | 547352 | 2726016 | 0 | 2659 | 1350 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | bare | 9 | 15623 | 55552 | 0 | 803 | 726 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | gateway | 2 | 320 | 15616 | 0 | 68 | 47 | 4 | $0.002214 |
| opencode/deepseek-v4.1-flash-free | mcp-all | 10 | 126562 | 954112 | 0 | 1835 | 1810 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | preselect | 0 | 0 | 0 | 0 | 0 | 0 | 14 | $0.008014 |
| opencode/deepseek-v4.1-flash-free | skills-all | 12 | 289825 | 964352 | 0 | 2057 | 861 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | all | 13 | 1070509 | 1057024 | 0 | 1331 | 1290 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | bare | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | gateway | 0 | 0 | 0 | 0 | 0 | 0 | 4 | $0.002194 |
| opencode/glm-5.3-flash-free | mcp-all | 3 | 116361 | 179904 | 0 | 172 | 155 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | preselect | 0 | 0 | 0 | 0 | 0 | 0 | 12 | $0.006885 |
| opencode/glm-5.3-flash-free | skills-all | 12 | 533062 | 859584 | 0 | 807 | 690 | 0 | $0.000000 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | bare | 1 (first / cross-session) | 3 | 111 | 20736 | 0 | 99.47% |
| opencode/deepseek-v4.1-flash-free | bare | 2 (later) | 3 | 385 | 20736 | 0 | 98.18% |
| opencode/deepseek-v4.1-flash-free | bare | 3 (later) | 1 | 154 | 7040 | 0 | 97.86% |
| opencode/deepseek-v4.1-flash-free | gateway | 1 (first / cross-session) | 5 | 12526 | 27008 | 0 | 68.32% |
| opencode/deepseek-v4.1-flash-free | gateway | 2 (later) | 5 | 7562 | 33024 | 0 | 81.37% |
| opencode/deepseek-v4.1-flash-free | gateway | 3 (later) | 3 | 1576 | 23808 | 0 | 93.79% |
| opencode/deepseek-v4.1-flash-free | gateway | 4 (later) | 3 | 542 | 25088 | 0 | 97.89% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 1 (first / cross-session) | 4 | 418 | 401920 | 0 | 99.90% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 2 (later) | 4 | 99439 | 303232 | 0 | 75.31% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 3 (later) | 1 | 264 | 100480 | 0 | 99.74% |
| opencode/deepseek-v4.1-flash-free | preselect | 1 (first / cross-session) | 6 | 5226 | 36608 | 0 | 87.51% |
| opencode/deepseek-v4.1-flash-free | preselect | 2 (later) | 6 | 1477 | 41472 | 0 | 96.56% |
| opencode/deepseek-v4.1-flash-free | preselect | 3 (later) | 4 | 799 | 28672 | 0 | 97.29% |
| opencode/deepseek-v4.1-flash-free | preselect | 4 (later) | 2 | 327 | 14720 | 0 | 97.83% |
| opencode/glm-5.3-flash-free | bare | 1 (first / cross-session) | 6 | 40141 | 0 | 0 | 0.00% |
| opencode/glm-5.3-flash-free | bare | 2 (later) | 6 | 14913 | 26112 | 0 | 63.65% |
| opencode/glm-5.3-flash-free | bare | 3 (later) | 3 | 1384 | 20224 | 0 | 93.59% |
| opencode/glm-5.3-flash-free | bare | 4 (later) | 2 | 8104 | 7040 | 0 | 46.49% |
| opencode/glm-5.3-flash-free | bare | 5 (later) | 2 | 1113 | 14592 | 0 | 92.91% |
| opencode/glm-5.3-flash-free | bare | 6 (later) | 1 | 7641 | 1088 | 0 | 12.46% |
| opencode/glm-5.3-flash-free | gateway | 1 (first / cross-session) | 6 | 32928 | 12480 | 0 | 27.48% |
| opencode/glm-5.3-flash-free | gateway | 2 (later) | 6 | 26443 | 19584 | 0 | 42.55% |
| opencode/glm-5.3-flash-free | gateway | 3 (later) | 3 | 8435 | 15168 | 0 | 64.26% |
| opencode/glm-5.3-flash-free | gateway | 4 (later) | 3 | 10091 | 13568 | 0 | 57.35% |
| opencode/glm-5.3-flash-free | mcp-all | 1 (first / cross-session) | 4 | 294173 | 99008 | 0 | 25.18% |
| opencode/glm-5.3-flash-free | mcp-all | 2 (later) | 4 | 391681 | 1792 | 0 | 0.46% |
| opencode/glm-5.3-flash-free | mcp-all | 3 (later) | 1 | 281 | 98176 | 0 | 99.71% |
| opencode/glm-5.3-flash-free | preselect | 1 (first / cross-session) | 6 | 33733 | 6528 | 0 | 16.21% |
| opencode/glm-5.3-flash-free | preselect | 2 (later) | 6 | 33412 | 7616 | 0 | 18.56% |
| opencode/glm-5.3-flash-free | preselect | 3 (later) | 3 | 1163 | 19968 | 0 | 94.50% |

### Hypothetical paid cost per valid session

| Model | Arm | Sheet | Mean steps | Mean weighted input | Mean input USD | Mean output/reasoning USD | Mean Jev USD | Mean total USD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | deepseek-flash-off-peak | 2.33 | 540.08 | $0.000081 | $0.000064 | $0.000000 | $0.000145 |
| opencode/deepseek-v4.1-flash-free | bare | deepseek-flash-peak | 2.33 | 540.08 | $0.000162 | $0.000129 | $0.000000 | $0.000291 |
| opencode/deepseek-v4.1-flash-free | bare | glm-5.3-flash | 2.33 | 3450.80 | $0.000518 | $0.000054 | $0.000000 | $0.000571 |
| opencode/deepseek-v4.1-flash-free | bare | claude-sonnet-5.5-5m | 2.33 | 1025.20 | $0.002050 | $0.001073 | $0.000000 | $0.003124 |
| opencode/deepseek-v4.1-flash-free | bare | gpt-6.1-sol-30m | 2.33 | 1025.20 | $0.002050 | $0.001073 | $0.000000 | $0.003124 |
| opencode/deepseek-v4.1-flash-free | gateway | deepseek-flash-off-peak | 3.20 | 4876.91 | $0.000732 | $0.000141 | $0.000443 | $0.001316 |
| opencode/deepseek-v4.1-flash-free | gateway | deepseek-flash-peak | 3.20 | 4876.91 | $0.001463 | $0.000283 | $0.000443 | $0.002189 |
| opencode/deepseek-v4.1-flash-free | gateway | glm-5.3-flash | 3.20 | 8798.32 | $0.001320 | $0.000118 | $0.000443 | $0.001880 |
| opencode/deepseek-v4.1-flash-free | gateway | claude-sonnet-5.5-5m | 3.20 | 5530.48 | $0.011061 | $0.002358 | $0.000443 | $0.013862 |
| opencode/deepseek-v4.1-flash-free | gateway | gpt-6.1-sol-30m | 3.20 | 5530.48 | $0.011061 | $0.002358 | $0.000443 | $0.013862 |
| opencode/deepseek-v4.1-flash-free | mcp-all | deepseek-flash-off-peak | 2.25 | 29058.41 | $0.004359 | $0.000053 | $0.000000 | $0.004411 |
| opencode/deepseek-v4.1-flash-free | mcp-all | deepseek-flash-peak | 2.25 | 29058.41 | $0.008718 | $0.000105 | $0.000000 | $0.008823 |
| opencode/deepseek-v4.1-flash-free | mcp-all | glm-5.3-flash | 2.25 | 65311.85 | $0.009797 | $0.000044 | $0.000000 | $0.009841 |
| opencode/deepseek-v4.1-flash-free | mcp-all | claude-sonnet-5.5-5m | 2.25 | 35100.65 | $0.070201 | $0.000875 | $0.000000 | $0.071076 |
| opencode/deepseek-v4.1-flash-free | mcp-all | gpt-6.1-sol-30m | 2.25 | 35100.65 | $0.070201 | $0.000875 | $0.000000 | $0.071076 |
| opencode/deepseek-v4.1-flash-free | preselect | deepseek-flash-off-peak | 3.00 | 1709.74 | $0.000256 | $0.000132 | $0.001142 | $0.001531 |
| opencode/deepseek-v4.1-flash-free | preselect | deepseek-flash-peak | 3.00 | 1709.74 | $0.000513 | $0.000265 | $0.001142 | $0.001920 |
| opencode/deepseek-v4.1-flash-free | preselect | glm-5.3-flash | 3.00 | 5353.90 | $0.000803 | $0.000110 | $0.001142 | $0.002055 |
| opencode/deepseek-v4.1-flash-free | preselect | claude-sonnet-5.5-5m | 3.00 | 2317.10 | $0.004634 | $0.002207 | $0.001142 | $0.007983 |
| opencode/deepseek-v4.1-flash-free | preselect | gpt-6.1-sol-30m | 3.00 | 2317.10 | $0.004634 | $0.002207 | $0.001142 | $0.007983 |
| opencode/deepseek-v4.1-flash-free | skills-all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | deepseek-flash-off-peak | 3.33 | 12446.19 | $0.001867 | $0.000238 | $0.000000 | $0.002105 |
| opencode/glm-5.3-flash-free | bare | deepseek-flash-peak | 3.33 | 12446.19 | $0.003734 | $0.000477 | $0.000000 | $0.004210 |
| opencode/glm-5.3-flash-free | bare | glm-5.3-flash | 3.33 | 14517.87 | $0.002178 | $0.000199 | $0.000000 | $0.002376 |
| opencode/glm-5.3-flash-free | bare | claude-sonnet-5.5-5m | 3.33 | 12791.47 | $0.025583 | $0.003972 | $0.000000 | $0.029555 |
| opencode/glm-5.3-flash-free | bare | gpt-6.1-sol-30m | 3.33 | 12791.47 | $0.025583 | $0.003972 | $0.000000 | $0.029555 |
| opencode/glm-5.3-flash-free | gateway | deepseek-flash-off-peak | 3.00 | 13185.50 | $0.001978 | $0.000059 | $0.000366 | $0.002403 |
| opencode/glm-5.3-flash-free | gateway | deepseek-flash-peak | 3.00 | 13185.50 | $0.003956 | $0.000118 | $0.000366 | $0.004439 |
| opencode/glm-5.3-flash-free | gateway | glm-5.3-flash | 3.00 | 15009.50 | $0.002251 | $0.000049 | $0.000366 | $0.002666 |
| opencode/glm-5.3-flash-free | gateway | claude-sonnet-5.5-5m | 3.00 | 13489.50 | $0.026979 | $0.000983 | $0.000366 | $0.028328 |
| opencode/glm-5.3-flash-free | gateway | gpt-6.1-sol-30m | 3.00 | 13489.50 | $0.026979 | $0.000983 | $0.000366 | $0.028328 |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-off-peak | 2.25 | 172528.63 | $0.025879 | $0.000060 | $0.000000 | $0.025939 |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-peak | 2.25 | 172528.63 | $0.051759 | $0.000120 | $0.000000 | $0.051878 |
| opencode/glm-5.3-flash-free | mcp-all | glm-5.3-flash | 2.25 | 181482.55 | $0.027222 | $0.000050 | $0.000000 | $0.027272 |
| opencode/glm-5.3-flash-free | mcp-all | claude-sonnet-5.5-5m | 2.25 | 174020.95 | $0.348042 | $0.000997 | $0.000000 | $0.349039 |
| opencode/glm-5.3-flash-free | mcp-all | gpt-6.1-sol-30m | 2.25 | 174020.95 | $0.348042 | $0.000997 | $0.000000 | $0.349039 |
| opencode/glm-5.3-flash-free | preselect | deepseek-flash-off-peak | 2.50 | 11498.37 | $0.001725 | $0.000101 | $0.001148 | $0.002973 |
| opencode/glm-5.3-flash-free | preselect | deepseek-flash-peak | 2.50 | 11498.37 | $0.003450 | $0.000202 | $0.001148 | $0.004799 |
| opencode/glm-5.3-flash-free | preselect | glm-5.3-flash | 2.50 | 12521.73 | $0.001878 | $0.000084 | $0.001148 | $0.003110 |
| opencode/glm-5.3-flash-free | preselect | claude-sonnet-5.5-5m | 2.50 | 11668.93 | $0.023338 | $0.001685 | $0.001148 | $0.026170 |
| opencode/glm-5.3-flash-free | preselect | gpt-6.1-sol-30m | 2.50 | 11668.93 | $0.023338 | $0.001685 | $0.001148 | $0.026170 |
| opencode/glm-5.3-flash-free | skills-all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |

### Size sweep and observed break-even

Comparisons use the common valid task/repetition panel across gateway and every observed size in a family. Sizes are recorded skill counts or tool counts (MCP), including planted items. The gateway horizontal band is the observed session-cost min/max, not a confidence interval. Break-even is the first measured native size at or above the gateway mean; no interpolation or extrapolation. Cost includes Jev. Chart x labels are categorical measured sizes.

**opencode/deepseek-v4.1-flash-free / mcp / deepseek-flash-off-peak**: 3 matched sessions; gateway $0.000530 [$0.000174, $0.001061]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.005648 | $0.000530 | $0.000174–$0.001061 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.005647722]
  line [0.000530482]
  line [0.000174348]
  line [0.001060950]
```

**opencode/glm-5.3-flash-free / mcp / deepseek-flash-off-peak**: 4 matched sessions; gateway $0.001598 [$0.000382, $0.002322]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.025939 | $0.001598 | $0.000382–$0.002322 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.025939144]
  line [0.001597578]
  line [0.000382068]
  line [0.002322000]
```

**opencode/deepseek-v4.1-flash-free / mcp / deepseek-flash-peak**: 3 matched sessions; gateway $0.001061 [$0.000349, $0.002122]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.011295 | $0.001061 | $0.000349–$0.002122 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.011295444]
  line [0.001060964]
  line [0.000348696]
  line [0.002121900]
```

**opencode/glm-5.3-flash-free / mcp / deepseek-flash-peak**: 4 matched sessions; gateway $0.003195 [$0.000764, $0.004644]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.051878 | $0.003195 | $0.000764–$0.004644 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.051878289]
  line [0.003195156]
  line [0.000764136]
  line [0.004644000]
```

**opencode/deepseek-v4.1-flash-free / mcp / glm-5.3-flash**: 3 matched sessions; gateway $0.001025 [$0.000583, $0.001307]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.011081 | $0.001025 | $0.000583–$0.001307 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.011081070]
  line [0.001025170]
  line [0.000583080]
  line [0.001306950]
```

**opencode/glm-5.3-flash-free / mcp / glm-5.3-flash**: 4 matched sessions; gateway $0.001831 [$0.000730, $0.002316]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.027272 | $0.001831 | $0.000730–$0.002316 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.027272258]
  line [0.001831205]
  line [0.000729880]
  line [0.002315800]
```

**opencode/deepseek-v4.1-flash-free / mcp / claude-sonnet-5.5-5m**: 3 matched sessions; gateway $0.008546 [$0.003520, $0.014986]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.087570 | $0.008546 | $0.003520–$0.014986 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.087570400]
  line [0.008545733]
  line [0.003519600]
  line [0.014986000]
```

**opencode/glm-5.3-flash-free / mcp / claude-sonnet-5.5-5m**: 4 matched sessions; gateway $0.022014 [$0.005972, $0.031084]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.349039 | $0.022014 | $0.005972–$0.031084 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.349039400]
  line [0.022014100]
  line [0.005971600]
  line [0.031084000]
```

**opencode/deepseek-v4.1-flash-free / mcp / gpt-6.1-sol-30m**: 3 matched sessions; gateway $0.008546 [$0.003520, $0.014986]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.087570 | $0.008546 | $0.003520–$0.014986 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.087570400]
  line [0.008545733]
  line [0.003519600]
  line [0.014986000]
```

**opencode/glm-5.3-flash-free / mcp / gpt-6.1-sol-30m**: 4 matched sessions; gateway $0.022014 [$0.005972, $0.031084]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.349039 | $0.022014 | $0.005972–$0.031084 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.349039400]
  line [0.022014100]
  line [0.005971600]
  line [0.031084000]
```


## Dev split

| Model | Arm | Pass | Fail | Invalid attempts | Success (Wilson 95%) | Steps | Uncached input | Cache read | Cache write | Output | Reasoning |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | 0 | 0 | 3 | not shown | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/deepseek-v4.1-flash-free | bare | 0 | 1 | 2 | 0.00% (0–79%) | 1 | 819 | 6144 | 0 | 58 | 158 |
| opencode/deepseek-v4.1-flash-free | gateway | 3 | 0 | 0 | 100.00% (44–100%) | 12 | 12231 | 91008 | 0 | 669 | 101 |
| opencode/deepseek-v4.1-flash-free | mcp-all | 2 | 0 | 1 | 100.00% (34–100%) | 6 | 99173 | 503936 | 0 | 274 | 13 |
| opencode/deepseek-v4.1-flash-free | preselect | 1 | 2 | 1 | 33.33% (6–79%) | 10 | 11069 | 62464 | 0 | 768 | 821 |
| opencode/deepseek-v4.1-flash-free | skills-all | 0 | 0 | 3 | not shown | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/glm-5.3-flash-free | all | 0 | 0 | 4 | not shown | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/glm-5.3-flash-free | bare | 0 | 3 | 3 | 0.00% (0–56%) | 9 | 23338 | 40768 | 0 | 597 | 1028 |
| opencode/glm-5.3-flash-free | gateway | 1 | 0 | 2 | 100.00% (21–100%) | 4 | 9402 | 21760 | 0 | 116 | 55 |
| opencode/glm-5.3-flash-free | mcp-all | 2 | 0 | 3 | 100.00% (34–100%) | 7 | 201097 | 487680 | 0 | 157 | 190 |
| opencode/glm-5.3-flash-free | preselect | 1 | 2 | 0 | 33.33% (6–79%) | 18 | 67510 | 98752 | 0 | 1043 | 1509 |
| opencode/glm-5.3-flash-free | skills-all | 0 | 0 | 6 | not shown | 0 | 0 | 0 | 0 | 0 | 0 |

### Invalid usage and all-attempt Jev spend

| Model | Arm | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | 6 | 2691 | 1088512 | 0 | 963 | 829 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | bare | 16 | 11230 | 157568 | 0 | 1665 | 2479 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | gateway | 0 | 0 | 0 | 0 | 0 | 0 | 2 | $0.001079 |
| opencode/deepseek-v4.1-flash-free | mcp-all | 7 | 45642 | 785920 | 0 | 1356 | 1043 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | preselect | 0 | 0 | 0 | 0 | 0 | 0 | 8 | $0.004752 |
| opencode/deepseek-v4.1-flash-free | skills-all | 10 | 183570 | 893952 | 0 | 2544 | 1192 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | all | 6 | 797762 | 265216 | 0 | 565 | 362 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | bare | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | gateway | 3 | 16967 | 7616 | 0 | 67 | 172 | 2 | $0.001103 |
| opencode/glm-5.3-flash-free | mcp-all | 3 | 106614 | 188864 | 0 | 82 | 185 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | preselect | 0 | 0 | 0 | 0 | 0 | 0 | 6 | $0.003550 |
| opencode/glm-5.3-flash-free | skills-all | 8 | 212410 | 659776 | 0 | 1521 | 961 | 0 | $0.000000 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | bare | 1 (first / cross-session) | 1 | 819 | 6144 | 0 | 88.24% |
| opencode/deepseek-v4.1-flash-free | gateway | 1 (first / cross-session) | 3 | 316 | 23424 | 0 | 98.67% |
| opencode/deepseek-v4.1-flash-free | gateway | 2 (later) | 3 | 8709 | 17408 | 0 | 66.65% |
| opencode/deepseek-v4.1-flash-free | gateway | 3 (later) | 3 | 2605 | 23936 | 0 | 90.18% |
| opencode/deepseek-v4.1-flash-free | gateway | 4 (later) | 3 | 601 | 26240 | 0 | 97.76% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 1 (first / cross-session) | 2 | 98435 | 102272 | 0 | 50.96% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 2 (later) | 2 | 395 | 200960 | 0 | 99.80% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 3 (later) | 2 | 343 | 200704 | 0 | 99.83% |
| opencode/deepseek-v4.1-flash-free | preselect | 1 (first / cross-session) | 3 | 5066 | 15872 | 0 | 75.80% |
| opencode/deepseek-v4.1-flash-free | preselect | 2 (later) | 3 | 1259 | 20736 | 0 | 94.28% |
| opencode/deepseek-v4.1-flash-free | preselect | 3 (later) | 3 | 934 | 21760 | 0 | 95.88% |
| opencode/deepseek-v4.1-flash-free | preselect | 4 (later) | 1 | 3810 | 4096 | 0 | 51.81% |
| opencode/glm-5.3-flash-free | bare | 1 (first / cross-session) | 3 | 13608 | 6528 | 0 | 32.42% |
| opencode/glm-5.3-flash-free | bare | 2 (later) | 2 | 6327 | 7616 | 0 | 54.62% |
| opencode/glm-5.3-flash-free | bare | 3 (later) | 2 | 1118 | 13568 | 0 | 92.39% |
| opencode/glm-5.3-flash-free | bare | 4 (later) | 1 | 1001 | 6528 | 0 | 86.70% |
| opencode/glm-5.3-flash-free | bare | 5 (later) | 1 | 1284 | 6528 | 0 | 83.56% |
| opencode/glm-5.3-flash-free | gateway | 1 (first / cross-session) | 1 | 7558 | 0 | 0 | 0.00% |
| opencode/glm-5.3-flash-free | gateway | 2 (later) | 1 | 1215 | 6528 | 0 | 84.31% |
| opencode/glm-5.3-flash-free | gateway | 3 (later) | 1 | 297 | 7616 | 0 | 96.25% |
| opencode/glm-5.3-flash-free | gateway | 4 (later) | 1 | 332 | 7616 | 0 | 95.82% |
| opencode/glm-5.3-flash-free | mcp-all | 1 (first / cross-session) | 2 | 196610 | 0 | 0 | 0.00% |
| opencode/glm-5.3-flash-free | mcp-all | 2 (later) | 2 | 3067 | 193664 | 0 | 98.44% |
| opencode/glm-5.3-flash-free | mcp-all | 3 (later) | 2 | 824 | 196096 | 0 | 99.58% |
| opencode/glm-5.3-flash-free | mcp-all | 4 (later) | 1 | 596 | 97920 | 0 | 99.40% |
| opencode/glm-5.3-flash-free | preselect | 1 (first / cross-session) | 3 | 13622 | 6528 | 0 | 32.40% |
| opencode/glm-5.3-flash-free | preselect | 2 (later) | 3 | 14426 | 6528 | 0 | 31.15% |
| opencode/glm-5.3-flash-free | preselect | 3 (later) | 3 | 1388 | 20096 | 0 | 93.54% |
| opencode/glm-5.3-flash-free | preselect | 4 (later) | 2 | 823 | 14080 | 0 | 94.48% |
| opencode/glm-5.3-flash-free | preselect | 5 (later) | 1 | 764 | 7296 | 0 | 90.52% |
| opencode/glm-5.3-flash-free | preselect | 6 (later) | 1 | 469 | 7808 | 0 | 94.33% |
| opencode/glm-5.3-flash-free | preselect | 7 (later) | 1 | 315 | 8064 | 0 | 96.24% |
| opencode/glm-5.3-flash-free | preselect | 8 (later) | 1 | 584 | 8192 | 0 | 93.35% |
| opencode/glm-5.3-flash-free | preselect | 9 (later) | 1 | 2094 | 8576 | 0 | 80.37% |
| opencode/glm-5.3-flash-free | preselect | 10 (later) | 1 | 11572 | 10496 | 0 | 47.56% |
| opencode/glm-5.3-flash-free | preselect | 11 (later) | 1 | 21453 | 1088 | 0 | 4.83% |

### Hypothetical paid cost per valid session

| Model | Arm | Sheet | Mean steps | Mean weighted input | Mean input USD | Mean output/reasoning USD | Mean Jev USD | Mean total USD |
|---|---|---|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | deepseek-flash-off-peak | 1.00 | 941.88 | $0.000141 | $0.000130 | $0.000000 | $0.000271 |
| opencode/deepseek-v4.1-flash-free | bare | deepseek-flash-peak | 1.00 | 941.88 | $0.000283 | $0.000259 | $0.000000 | $0.000542 |
| opencode/deepseek-v4.1-flash-free | bare | glm-5.3-flash | 1.00 | 2047.80 | $0.000307 | $0.000108 | $0.000000 | $0.000415 |
| opencode/deepseek-v4.1-flash-free | bare | claude-sonnet-5.5-5m | 1.00 | 1126.20 | $0.002252 | $0.002160 | $0.000000 | $0.004412 |
| opencode/deepseek-v4.1-flash-free | bare | gpt-6.1-sol-30m | 1.00 | 1126.20 | $0.002252 | $0.002160 | $0.000000 | $0.004412 |
| opencode/deepseek-v4.1-flash-free | gateway | deepseek-flash-off-peak | 4.00 | 4683.72 | $0.000703 | $0.000154 | $0.000360 | $0.001216 |
| opencode/deepseek-v4.1-flash-free | gateway | deepseek-flash-peak | 4.00 | 4683.72 | $0.001405 | $0.000308 | $0.000360 | $0.002073 |
| opencode/deepseek-v4.1-flash-free | gateway | glm-5.3-flash | 4.00 | 10144.20 | $0.001522 | $0.000128 | $0.000360 | $0.002010 |
| opencode/deepseek-v4.1-flash-free | gateway | claude-sonnet-5.5-5m | 4.00 | 5593.80 | $0.011188 | $0.002567 | $0.000360 | $0.014114 |
| opencode/deepseek-v4.1-flash-free | gateway | gpt-6.1-sol-30m | 4.00 | 5593.80 | $0.011188 | $0.002567 | $0.000360 | $0.014114 |
| opencode/deepseek-v4.1-flash-free | mcp-all | deepseek-flash-off-peak | 3.00 | 54625.86 | $0.008194 | $0.000086 | $0.000000 | $0.008280 |
| opencode/deepseek-v4.1-flash-free | mcp-all | deepseek-flash-peak | 3.00 | 54625.86 | $0.016388 | $0.000172 | $0.000000 | $0.016560 |
| opencode/deepseek-v4.1-flash-free | mcp-all | glm-5.3-flash | 3.00 | 99980.10 | $0.014997 | $0.000072 | $0.000000 | $0.015069 |
| opencode/deepseek-v4.1-flash-free | mcp-all | claude-sonnet-5.5-5m | 3.00 | 62184.90 | $0.124370 | $0.001435 | $0.000000 | $0.125805 |
| opencode/deepseek-v4.1-flash-free | mcp-all | gpt-6.1-sol-30m | 3.00 | 62184.90 | $0.124370 | $0.001435 | $0.000000 | $0.125805 |
| opencode/deepseek-v4.1-flash-free | preselect | deepseek-flash-off-peak | 3.33 | 4106.09 | $0.000616 | $0.000318 | $0.001196 | $0.002130 |
| opencode/deepseek-v4.1-flash-free | preselect | deepseek-flash-peak | 3.33 | 4106.09 | $0.001232 | $0.000636 | $0.001196 | $0.003064 |
| opencode/deepseek-v4.1-flash-free | preselect | glm-5.3-flash | 3.33 | 7853.93 | $0.001178 | $0.000265 | $0.001196 | $0.002639 |
| opencode/deepseek-v4.1-flash-free | preselect | claude-sonnet-5.5-5m | 3.33 | 4730.73 | $0.009461 | $0.005297 | $0.001196 | $0.015954 |
| opencode/deepseek-v4.1-flash-free | preselect | gpt-6.1-sol-30m | 3.33 | 4730.73 | $0.009461 | $0.005297 | $0.001196 | $0.015954 |
| opencode/deepseek-v4.1-flash-free | skills-all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | deepseek-flash-off-peak | 3.00 | 8051.12 | $0.001208 | $0.000325 | $0.000000 | $0.001533 |
| opencode/glm-5.3-flash-free | bare | deepseek-flash-peak | 3.00 | 8051.12 | $0.002415 | $0.000650 | $0.000000 | $0.003065 |
| opencode/glm-5.3-flash-free | bare | glm-5.3-flash | 3.00 | 10497.20 | $0.001575 | $0.000271 | $0.000000 | $0.001845 |
| opencode/glm-5.3-flash-free | bare | claude-sonnet-5.5-5m | 3.00 | 8458.80 | $0.016918 | $0.005417 | $0.000000 | $0.022334 |
| opencode/glm-5.3-flash-free | bare | gpt-6.1-sol-30m | 3.00 | 8458.80 | $0.016918 | $0.005417 | $0.000000 | $0.022334 |
| opencode/glm-5.3-flash-free | gateway | deepseek-flash-off-peak | 4.00 | 9837.20 | $0.001476 | $0.000103 | $0.001103 | $0.002681 |
| opencode/glm-5.3-flash-free | gateway | deepseek-flash-peak | 4.00 | 9837.20 | $0.002951 | $0.000205 | $0.001103 | $0.004259 |
| opencode/glm-5.3-flash-free | gateway | glm-5.3-flash | 4.00 | 13754.00 | $0.002063 | $0.000086 | $0.001103 | $0.003251 |
| opencode/glm-5.3-flash-free | gateway | claude-sonnet-5.5-5m | 4.00 | 10490.00 | $0.020980 | $0.001710 | $0.001103 | $0.023793 |
| opencode/glm-5.3-flash-free | gateway | gpt-6.1-sol-30m | 4.00 | 10490.00 | $0.020980 | $0.001710 | $0.001103 | $0.023793 |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-off-peak | 3.50 | 105425.30 | $0.015814 | $0.000104 | $0.000000 | $0.015918 |
| opencode/glm-5.3-flash-free | mcp-all | deepseek-flash-peak | 3.50 | 105425.30 | $0.031628 | $0.000208 | $0.000000 | $0.031836 |
| opencode/glm-5.3-flash-free | mcp-all | glm-5.3-flash | 3.50 | 149316.50 | $0.022397 | $0.000087 | $0.000000 | $0.022484 |
| opencode/glm-5.3-flash-free | mcp-all | claude-sonnet-5.5-5m | 3.50 | 112740.50 | $0.225481 | $0.001735 | $0.000000 | $0.227216 |
| opencode/glm-5.3-flash-free | mcp-all | gpt-6.1-sol-30m | 3.50 | 112740.50 | $0.225481 | $0.001735 | $0.000000 | $0.227216 |
| opencode/glm-5.3-flash-free | preselect | deepseek-flash-off-peak | 6.00 | 23161.68 | $0.003474 | $0.000510 | $0.001183 | $0.005168 |
| opencode/glm-5.3-flash-free | preselect | deepseek-flash-peak | 6.00 | 23161.68 | $0.006949 | $0.001021 | $0.001183 | $0.009153 |
| opencode/glm-5.3-flash-free | preselect | glm-5.3-flash | 6.00 | 29086.80 | $0.004363 | $0.000425 | $0.001183 | $0.005972 |
| opencode/glm-5.3-flash-free | preselect | claude-sonnet-5.5-5m | 6.00 | 24149.20 | $0.048298 | $0.008507 | $0.001183 | $0.057988 |
| opencode/glm-5.3-flash-free | preselect | gpt-6.1-sol-30m | 6.00 | 24149.20 | $0.048298 | $0.008507 | $0.001183 | $0.057988 |
| opencode/glm-5.3-flash-free | skills-all | deepseek-flash-off-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | deepseek-flash-peak | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | glm-5.3-flash | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | claude-sonnet-5.5-5m | not shown | not shown | not shown | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | gpt-6.1-sol-30m | not shown | not shown | not shown | not shown | not shown | not shown |

### Size sweep and observed break-even

Comparisons use the common valid task/repetition panel across gateway and every observed size in a family. Sizes are recorded skill counts or tool counts (MCP), including planted items. The gateway horizontal band is the observed session-cost min/max, not a confidence interval. Break-even is the first measured native size at or above the gateway mean; no interpolation or extrapolation. Cost includes Jev. Chart x labels are categorical measured sizes.

**opencode/deepseek-v4.1-flash-free / mcp / deepseek-flash-off-peak**: 2 matched sessions; gateway $0.001074 [$0.000348, $0.001800]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.008280 | $0.001074 | $0.000348–$0.001800 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.008279979]
  line [0.001073862]
  line [0.000347532]
  line [0.001800192]
```

**opencode/deepseek-v4.1-flash-free / mcp / deepseek-flash-peak**: 2 matched sessions; gateway $0.002148 [$0.000695, $0.003600]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.016560 | $0.002148 | $0.000695–$0.003600 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.016559958]
  line [0.002147724]
  line [0.000695064]
  line [0.003600384]
```

**opencode/deepseek-v4.1-flash-free / mcp / glm-5.3-flash**: 2 matched sessions; gateway $0.001847 [$0.001180, $0.002514]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.015069 | $0.001847 | $0.001180–$0.002514 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.015068765]
  line [0.001846620]
  line [0.001179620]
  line [0.002513620]
```

**opencode/deepseek-v4.1-flash-free / mcp / claude-sonnet-5.5-5m**: 2 matched sessions; gateway $0.016565 [$0.007038, $0.026092]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.125805 | $0.016565 | $0.007038–$0.026092 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.125804800]
  line [0.016565400]
  line [0.007038400]
  line [0.026092400]
```

**opencode/deepseek-v4.1-flash-free / mcp / gpt-6.1-sol-30m**: 2 matched sessions; gateway $0.016565 [$0.007038, $0.026092]. First measured size at/above gateway: 488.

| Native arm | Listing size | Mean session USD | Gateway mean USD | Gateway observed band USD |
|---|---:|---:|---:|---|
| mcp-all | 488 | $0.125805 | $0.016565 | $0.007038–$0.026092 |

Lines: native mean; gateway mean; gateway lower bound; gateway upper bound.

```mermaid
xychart-beta
  x-axis "MCP tools" [488]
  y-axis "USD/session"
  line [0.125804800]
  line [0.016565400]
  line [0.007038400]
  line [0.026092400]
```

