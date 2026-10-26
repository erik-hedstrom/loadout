# B11 cache-aware session report

Test rows are the evaluation result. Dev rows appear separately and are the only rows eligible for tuning. Invalid attempts are counted separately, never as quality failures. Wilson 95% intervals describe observed valid sessions; repeated tasks are not independent evidence of population-wide quality.

Token columns sum valid sessions. Input, cache read and cache write are disjoint prompt buckets ([OpenCode 1.19.3 usage normalization](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/opencode/src/session/session.ts#L321-L383)). Output excludes the separately recorded reasoning counter. First requests can already hit a cross-session cache; they are not assumed cold. Cache ratios pool tokens within each request position; later positions include only sessions that reached them.

Hypothetical paid costs reprice these measured tokens under each named sheet; tokenizers and cache policies differ across providers, so this does not predict their quality or actual billed usage. Weighted input = input + read × read/input price + write × write/input price. Session cost adds output and reasoning at the output rate, plus recorded Jev cost. Free model spend is $0; Jev spend includes invalid attempts in the attempts table.

## Valid completion by arm

Valid completion = (pass + fail) / all recorded attempts; retries remain separate attempts. This operational table pools models and dev/test splits; quality and cost remain split-separated below. Timeouts are invalid attempts, never quality failures. Any arm under 90% valid completion risks survivor bias: its surviving sessions may not represent quality or cost across all attempts.

| Arm | Valid sessions | Attempts | Valid completion | Assessment |
|---|---:|---:|---:|---|
| all | 0 | 22 | 0.00% | UNDER 90%: not usable in observed attempts |
| bare | 13 | 23 | 56.52% | UNDER 90% |
| gateway | 15 | 18 | 83.33% | UNDER 90% |
| mcp-all | 12 | 22 | 54.55% | UNDER 90% |
| preselect | 18 | 20 | 90.00% | at least 90% |
| skills-all | 0 | 27 | 0.00% | UNDER 90%: not usable in observed attempts |

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
| opencode/deepseek-v4.1-flash-free | all | 0 | 0 | 6 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/deepseek-v4.1-flash-free | bare | 3 | 0 | 3 | 50.00% | UNDER 90% | 100.00% (44–100%) | 7 | 650 | 48512 | 0 | 248 | 74 |
| opencode/deepseek-v4.1-flash-free | gateway | 5 | 0 | 1 | 83.33% | UNDER 90% | 100.00% (57–100%) | 16 | 22206 | 108928 | 0 | 968 | 211 |
| opencode/deepseek-v4.1-flash-free | mcp-all | 4 | 0 | 2 | 66.67% | UNDER 90% | 100.00% (51–100%) | 9 | 100121 | 805632 | 0 | 329 | 21 |
| opencode/deepseek-v4.1-flash-free | preselect | 5 | 1 | 1 | 85.71% | UNDER 90% | 83.33% (44–97%) | 18 | 7829 | 121472 | 0 | 824 | 500 |
| opencode/deepseek-v4.1-flash-free | skills-all | 0 | 0 | 6 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/glm-5.3-flash-free | all | 0 | 0 | 9 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/glm-5.3-flash-free | bare | 3 | 3 | 2 | 75.00% | UNDER 90% | 50.00% (19–81%) | 20 | 73296 | 69056 | 0 | 1023 | 1360 |
| opencode/glm-5.3-flash-free | gateway | 6 | 0 | 0 | 100.00% | at least 90% | 100.00% (61–100%) | 18 | 77897 | 60800 | 0 | 468 | 122 |
| opencode/glm-5.3-flash-free | mcp-all | 4 | 0 | 4 | 50.00% | UNDER 90% | 100.00% (51–100%) | 9 | 686135 | 198976 | 0 | 178 | 221 |
| opencode/glm-5.3-flash-free | preselect | 5 | 1 | 0 | 100.00% | at least 90% | 83.33% (44–97%) | 15 | 68308 | 34112 | 0 | 442 | 569 |
| opencode/glm-5.3-flash-free | skills-all | 0 | 0 | 12 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |

### Invalid usage and all-attempt Jev spend

Invalid reasons count attempts, including retries; zero token counters do not imply zero invalid attempts. Deadlines list distinct configured timeoutMs values; unknown (historical) marks omitted values. Groups with different deadlines remain pooled and are not a common-timeout comparison.

| Model | Arm | Invalid reasons | Deadlines (ms) | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | timeout 6 | unknown (historical) | 20 | 547352 | 2726016 | 0 | 2659 | 1350 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | bare | timeout 3 | unknown (historical) | 9 | 15623 | 55552 | 0 | 803 | 726 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | gateway | timeout 1 | unknown (historical) | 2 | 320 | 15616 | 0 | 68 | 47 | 4 | $0.002214 |
| opencode/deepseek-v4.1-flash-free | mcp-all | timeout 2 | unknown (historical) | 10 | 126562 | 954112 | 0 | 1835 | 1810 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | preselect | malformed-events 1 | unknown (historical) | 0 | 0 | 0 | 0 | 0 | 0 | 14 | $0.008014 |
| opencode/deepseek-v4.1-flash-free | skills-all | timeout 6 | unknown (historical) | 12 | 289825 | 964352 | 0 | 2057 | 861 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | all | timeout 9 | unknown (historical) | 13 | 1070509 | 1057024 | 0 | 1331 | 1290 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | bare | timeout 2 | unknown (historical) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | gateway | none | unknown (historical) | 0 | 0 | 0 | 0 | 0 | 0 | 4 | $0.002194 |
| opencode/glm-5.3-flash-free | mcp-all | timeout 4 | unknown (historical) | 3 | 116361 | 179904 | 0 | 172 | 155 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | preselect | none | unknown (historical) | 0 | 0 | 0 | 0 | 0 | 0 | 12 | $0.006885 |
| opencode/glm-5.3-flash-free | skills-all | timeout 12 | unknown (historical) | 12 | 533062 | 859584 | 0 | 807 | 690 | 0 | $0.000000 |

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

### Timing from event-arrival timestamps

Startup is process launch to first step_start; each step is step_start to step_finish, measured at event arrival. Startup is not proof of MCP discovery latency and may include provider/network time. Samples include known startup and completed-step durations from valid and invalid attempts. Historical missing latency and null durations are not shown; unfinished steps have no duration sample. Session wall time covers all attempts, including unfinished timeout waits, preselection, checks and cleanup. An attempt may never launch OpenCode; wall time measures the observed lifecycle, not pure model time. Startup and step durations do not partition wall time. Gaps from step_finish to next step_start can include tool/MCP work, request setup and network waits.

| Model | Arm | Phase | Samples | Mean ms | Median ms | Max ms |
|---|---|---|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | Session wall | 6 | 90354.67 | 90240.00 | 91005.00 |
| opencode/deepseek-v4.1-flash-free | all | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | Step 4 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | Step 5 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Session wall | 6 | 72755.00 | 85160.50 | 90112.00 |
| opencode/deepseek-v4.1-flash-free | bare | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 4 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 5 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | gateway | Session wall | 6 | 47297.33 | 45300.50 | 90061.00 |
| opencode/deepseek-v4.1-flash-free | gateway | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | gateway | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | gateway | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | gateway | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | gateway | Step 4 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Session wall | 6 | 64080.50 | 59576.00 | 90135.00 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 4 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 5 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 6 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 7 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 8 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | preselect | Session wall | 7 | 39107.29 | 32381.00 | 74791.00 |
| opencode/deepseek-v4.1-flash-free | preselect | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | preselect | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | preselect | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | preselect | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | preselect | Step 4 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | Session wall | 6 | 90304.83 | 90216.50 | 90615.00 |
| opencode/deepseek-v4.1-flash-free | skills-all | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | Session wall | 9 | 90281.11 | 90211.00 | 90645.00 |
| opencode/glm-5.3-flash-free | all | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | Step 4 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | Step 5 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Session wall | 8 | 65103.88 | 60354.00 | 90069.00 |
| opencode/glm-5.3-flash-free | bare | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 4 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 5 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 6 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | gateway | Session wall | 6 | 62310.00 | 57604.50 | 83041.00 |
| opencode/glm-5.3-flash-free | gateway | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | gateway | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | gateway | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | gateway | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | gateway | Step 4 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | Session wall | 8 | 77006.75 | 83003.50 | 90208.00 |
| opencode/glm-5.3-flash-free | mcp-all | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Session wall | 6 | 47367.17 | 45941.00 | 69969.00 |
| opencode/glm-5.3-flash-free | preselect | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | Session wall | 12 | 90515.33 | 90276.50 | 91601.00 |
| opencode/glm-5.3-flash-free | skills-all | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | Step 4 | 0 | not shown | not shown | not shown |

### Hypothetical paid cost per valid session

**Caution: survivor bias in quality and cost.** Under 90% valid completion: opencode/deepseek-v4.1-flash-free / all; opencode/deepseek-v4.1-flash-free / bare; opencode/deepseek-v4.1-flash-free / gateway; opencode/deepseek-v4.1-flash-free / mcp-all; opencode/deepseek-v4.1-flash-free / preselect; opencode/deepseek-v4.1-flash-free / skills-all; opencode/glm-5.3-flash-free / all; opencode/glm-5.3-flash-free / bare; opencode/glm-5.3-flash-free / mcp-all; opencode/glm-5.3-flash-free / skills-all. These costs describe surviving valid sessions, not the cost of all attempted work; zero-valid arms are not usable in observed attempts.

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

not shown: no common valid gateway/size-sweep panel.

## Dev split

| Model | Arm | Pass | Fail | Invalid attempts | Valid completion | Assessment | Success among valid (Wilson 95%) | Steps | Uncached input | Cache read | Cache write | Output | Reasoning |
|---|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | 0 | 0 | 3 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/deepseek-v4.1-flash-free | bare | 0 | 1 | 2 | 33.33% | UNDER 90% | 0.00% (0–79%) | 1 | 819 | 6144 | 0 | 58 | 158 |
| opencode/deepseek-v4.1-flash-free | gateway | 3 | 0 | 0 | 100.00% | at least 90% | 100.00% (44–100%) | 12 | 12231 | 91008 | 0 | 669 | 101 |
| opencode/deepseek-v4.1-flash-free | mcp-all | 2 | 0 | 1 | 66.67% | UNDER 90% | 100.00% (34–100%) | 6 | 99173 | 503936 | 0 | 274 | 13 |
| opencode/deepseek-v4.1-flash-free | preselect | 1 | 2 | 1 | 75.00% | UNDER 90% | 33.33% (6–79%) | 10 | 11069 | 62464 | 0 | 768 | 821 |
| opencode/deepseek-v4.1-flash-free | skills-all | 0 | 0 | 3 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/glm-5.3-flash-free | all | 0 | 0 | 4 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |
| opencode/glm-5.3-flash-free | bare | 0 | 3 | 3 | 50.00% | UNDER 90% | 0.00% (0–56%) | 9 | 23338 | 40768 | 0 | 597 | 1028 |
| opencode/glm-5.3-flash-free | gateway | 1 | 0 | 2 | 33.33% | UNDER 90% | 100.00% (21–100%) | 4 | 9402 | 21760 | 0 | 116 | 55 |
| opencode/glm-5.3-flash-free | mcp-all | 2 | 0 | 3 | 40.00% | UNDER 90% | 100.00% (34–100%) | 7 | 201097 | 487680 | 0 | 157 | 190 |
| opencode/glm-5.3-flash-free | preselect | 1 | 2 | 0 | 100.00% | at least 90% | 33.33% (6–79%) | 18 | 67510 | 98752 | 0 | 1043 | 1509 |
| opencode/glm-5.3-flash-free | skills-all | 0 | 0 | 6 | 0.00% | UNDER 90%: not usable in observed attempts | not usable in observed attempts | 0 | 0 | 0 | 0 | 0 | 0 |

### Invalid usage and all-attempt Jev spend

Invalid reasons count attempts, including retries; zero token counters do not imply zero invalid attempts. Deadlines list distinct configured timeoutMs values; unknown (historical) marks omitted values. Groups with different deadlines remain pooled and are not a common-timeout comparison.

| Model | Arm | Invalid reasons | Deadlines (ms) | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | timeout 3 | unknown (historical) | 6 | 2691 | 1088512 | 0 | 963 | 829 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | bare | timeout 2 | unknown (historical) | 16 | 11230 | 157568 | 0 | 1665 | 2479 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | gateway | none | unknown (historical) | 0 | 0 | 0 | 0 | 0 | 0 | 2 | $0.001079 |
| opencode/deepseek-v4.1-flash-free | mcp-all | timeout 1 | unknown (historical) | 7 | 45642 | 785920 | 0 | 1356 | 1043 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | preselect | timeout 1 | unknown (historical) | 0 | 0 | 0 | 0 | 0 | 0 | 8 | $0.004752 |
| opencode/deepseek-v4.1-flash-free | skills-all | timeout 3 | unknown (historical) | 10 | 183570 | 893952 | 0 | 2544 | 1192 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | all | timeout 4 | unknown (historical) | 6 | 797762 | 265216 | 0 | 565 | 362 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | bare | timeout 3 | unknown (historical) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | gateway | timeout 2 | unknown (historical) | 3 | 16967 | 7616 | 0 | 67 | 172 | 2 | $0.001103 |
| opencode/glm-5.3-flash-free | mcp-all | timeout 3 | unknown (historical) | 3 | 106614 | 188864 | 0 | 82 | 185 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | preselect | none | unknown (historical) | 0 | 0 | 0 | 0 | 0 | 0 | 6 | $0.003550 |
| opencode/glm-5.3-flash-free | skills-all | timeout 6 | unknown (historical) | 8 | 212410 | 659776 | 0 | 1521 | 961 | 0 | $0.000000 |

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

### Timing from event-arrival timestamps

Startup is process launch to first step_start; each step is step_start to step_finish, measured at event arrival. Startup is not proof of MCP discovery latency and may include provider/network time. Samples include known startup and completed-step durations from valid and invalid attempts. Historical missing latency and null durations are not shown; unfinished steps have no duration sample. Session wall time covers all attempts, including unfinished timeout waits, preselection, checks and cleanup. An attempt may never launch OpenCode; wall time measures the observed lifecycle, not pure model time. Startup and step durations do not partition wall time. Gaps from step_finish to next step_start can include tool/MCP work, request setup and network waits.

| Model | Arm | Phase | Samples | Mean ms | Median ms | Max ms |
|---|---|---|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | all | Session wall | 3 | 90429.67 | 90265.00 | 90840.00 |
| opencode/deepseek-v4.1-flash-free | all | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Session wall | 3 | 67679.00 | 90090.00 | 90100.00 |
| opencode/deepseek-v4.1-flash-free | bare | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 4 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 5 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 6 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 7 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 8 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 9 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 10 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 11 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | bare | Step 12 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | gateway | Session wall | 3 | 37694.00 | 37764.00 | 52683.00 |
| opencode/deepseek-v4.1-flash-free | gateway | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | gateway | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | gateway | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | gateway | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | gateway | Step 4 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Session wall | 3 | 80510.33 | 83555.00 | 90072.00 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 4 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 5 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 6 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 7 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | preselect | Session wall | 4 | 56281.25 | 52457.50 | 90822.00 |
| opencode/deepseek-v4.1-flash-free | preselect | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | preselect | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | preselect | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | preselect | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | preselect | Step 4 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | Session wall | 3 | 90236.33 | 90218.00 | 90304.00 |
| opencode/deepseek-v4.1-flash-free | skills-all | Startup | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/deepseek-v4.1-flash-free | skills-all | Step 4 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | Session wall | 4 | 90259.00 | 90254.50 | 90341.00 |
| opencode/glm-5.3-flash-free | all | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Session wall | 6 | 65704.33 | 71982.50 | 90144.00 |
| opencode/glm-5.3-flash-free | bare | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 4 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | bare | Step 5 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | gateway | Session wall | 3 | 89909.33 | 90071.00 | 90100.00 |
| opencode/glm-5.3-flash-free | gateway | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | gateway | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | gateway | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | gateway | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | gateway | Step 4 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | Session wall | 5 | 81785.80 | 90065.00 | 90069.00 |
| opencode/glm-5.3-flash-free | mcp-all | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | mcp-all | Step 4 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Session wall | 3 | 52906.67 | 42187.00 | 76997.00 |
| opencode/glm-5.3-flash-free | preselect | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 3 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 4 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 5 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 6 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 7 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 8 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 9 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 10 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | preselect | Step 11 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | Session wall | 6 | 90560.67 | 90400.50 | 91069.00 |
| opencode/glm-5.3-flash-free | skills-all | Startup | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | Step 1 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | Step 2 | 0 | not shown | not shown | not shown |
| opencode/glm-5.3-flash-free | skills-all | Step 3 | 0 | not shown | not shown | not shown |

### Hypothetical paid cost per valid session

**Caution: survivor bias in quality and cost.** Under 90% valid completion: opencode/deepseek-v4.1-flash-free / all; opencode/deepseek-v4.1-flash-free / bare; opencode/deepseek-v4.1-flash-free / mcp-all; opencode/deepseek-v4.1-flash-free / preselect; opencode/deepseek-v4.1-flash-free / skills-all; opencode/glm-5.3-flash-free / all; opencode/glm-5.3-flash-free / bare; opencode/glm-5.3-flash-free / gateway; opencode/glm-5.3-flash-free / mcp-all; opencode/glm-5.3-flash-free / skills-all. These costs describe surviving valid sessions, not the cost of all attempted work; zero-valid arms are not usable in observed attempts.

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

not shown: no common valid gateway/size-sweep panel.
