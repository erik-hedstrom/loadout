# B11 cache-aware session report

Test rows are the evaluation result. Dev rows appear separately and are the only rows eligible for tuning. Invalid attempts are counted separately, never as quality failures. Wilson 95% intervals describe observed valid sessions; repeated tasks are not independent evidence of population-wide quality.

Token columns sum valid sessions. Input, cache read and cache write are disjoint prompt buckets ([OpenCode 1.19.3 usage normalization](https://github.com/anomalyco/opencode/blob/v1.19.3/packages/opencode/src/session/session.ts#L321-L383)). Output excludes the separately recorded reasoning counter. First requests can already hit a cross-session cache; they are not assumed cold. Cache ratios pool tokens within each request position; later positions include only sessions that reached them.

Hypothetical paid costs reprice these measured tokens under each named sheet; tokenizers and cache policies differ across providers, so this does not predict their quality or actual billed usage. Weighted input = input + read × read/input price + write × write/input price. Session cost adds output and reasoning at the output rate, plus recorded Jev cost. Free model spend is $0; Jev spend includes invalid attempts in the attempts table.

## Valid completion by arm

Valid completion = (pass + fail) / all recorded attempts; retries remain separate attempts. This operational table pools models and dev/test splits; quality and cost remain split-separated below. Timeouts are invalid attempts, never quality failures. Any arm under 90% valid completion risks survivor bias: its surviving sessions may not represent quality or cost across all attempts.

| Arm | Valid sessions | Attempts | Valid completion | Assessment |
|---|---:|---:|---:|---|
| bare | 18 | 19 | 94.74% | at least 90% |
| gateway | 18 | 18 | 100.00% | at least 90% |
| heavy-max | 18 | 18 | 100.00% | at least 90% |
| mcp-all | 18 | 18 | 100.00% | at least 90% |
| preselect | 18 | 18 | 100.00% | at least 90% |

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
| opencode/deepseek-v4.1-flash-free | bare | 1 | 5 | 1 | 85.71% | UNDER 90% | 16.67% (3–56%) | 49 | 141556 | 912000 | 0 | 5672 | 7124 |
| opencode/deepseek-v4.1-flash-free | gateway | 6 | 0 | 0 | 100.00% | at least 90% | 100.00% (61–100%) | 36 | 50412 | 407552 | 0 | 3471 | 2958 |
| opencode/deepseek-v4.1-flash-free | heavy-max | 6 | 0 | 0 | 100.00% | at least 90% | 100.00% (61–100%) | 33 | 471248 | 4219776 | 0 | 3792 | 3813 |
| opencode/deepseek-v4.1-flash-free | mcp-all | 3 | 3 | 0 | 100.00% | at least 90% | 50.00% (19–81%) | 73 | 314640 | 8652672 | 0 | 11861 | 12591 |
| opencode/deepseek-v4.1-flash-free | preselect | 5 | 1 | 0 | 100.00% | at least 90% | 83.33% (44–97%) | 40 | 69690 | 446080 | 0 | 3621 | 2986 |
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
| opencode/deepseek-v4.1-flash-free | gateway | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 16 | $0.009455 |
| opencode/deepseek-v4.1-flash-free | heavy-max | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | mcp-all | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | preselect | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | $0.006608 |
| opencode/glm-5.3-flash-free | bare | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | gateway | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | $0.004649 |
| opencode/glm-5.3-flash-free | heavy-max | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | mcp-all | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | preselect | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 12 | $0.006585 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | bare | 1 (first / cross-session) | 6 | 13775 | 28032 | 0 | 67.05% |
| opencode/deepseek-v4.1-flash-free | bare | 2 (later) | 6 | 1770 | 41472 | 0 | 95.91% |
| opencode/deepseek-v4.1-flash-free | bare | 3 (later) | 6 | 2283 | 42752 | 0 | 94.93% |
| opencode/deepseek-v4.1-flash-free | bare | 4 (later) | 6 | 3345 | 44544 | 0 | 93.02% |
| opencode/deepseek-v4.1-flash-free | bare | 5 (later) | 4 | 2072 | 32256 | 0 | 93.96% |
| opencode/deepseek-v4.1-flash-free | bare | 6 (later) | 4 | 17590 | 34048 | 0 | 65.94% |
| opencode/deepseek-v4.1-flash-free | bare | 7 (later) | 3 | 19867 | 42240 | 0 | 68.01% |
| opencode/deepseek-v4.1-flash-free | bare | 8 (later) | 2 | 1817 | 51328 | 0 | 96.58% |
| opencode/deepseek-v4.1-flash-free | bare | 9 (later) | 1 | 300 | 43136 | 0 | 99.31% |
| opencode/deepseek-v4.1-flash-free | bare | 10 (later) | 1 | 671 | 43392 | 0 | 98.48% |
| opencode/deepseek-v4.1-flash-free | bare | 11 (later) | 1 | 1421 | 44032 | 0 | 96.87% |
| opencode/deepseek-v4.1-flash-free | bare | 12 (later) | 1 | 692 | 45440 | 0 | 98.50% |
| opencode/deepseek-v4.1-flash-free | bare | 13 (later) | 1 | 450 | 46080 | 0 | 99.03% |
| opencode/deepseek-v4.1-flash-free | bare | 14 (later) | 1 | 770 | 46464 | 0 | 98.37% |
| opencode/deepseek-v4.1-flash-free | bare | 15 (later) | 1 | 45540 | 2176 | 0 | 4.56% |
| opencode/deepseek-v4.1-flash-free | bare | 16 (later) | 1 | 9179 | 47232 | 0 | 83.73% |
| opencode/deepseek-v4.1-flash-free | bare | 17 (later) | 1 | 14734 | 56320 | 0 | 79.26% |
| opencode/deepseek-v4.1-flash-free | bare | 18 (later) | 1 | 3573 | 71040 | 0 | 95.21% |
| opencode/deepseek-v4.1-flash-free | bare | 19 (later) | 1 | 1151 | 74496 | 0 | 98.48% |
| opencode/deepseek-v4.1-flash-free | bare | 20 (later) | 1 | 556 | 75520 | 0 | 99.27% |
| opencode/deepseek-v4.1-flash-free | gateway | 1 (first / cross-session) | 6 | 12615 | 34304 | 0 | 73.11% |
| opencode/deepseek-v4.1-flash-free | gateway | 2 (later) | 6 | 3307 | 46464 | 0 | 93.36% |
| opencode/deepseek-v4.1-flash-free | gateway | 3 (later) | 6 | 20723 | 49280 | 0 | 70.40% |
| opencode/deepseek-v4.1-flash-free | gateway | 4 (later) | 6 | 2663 | 69632 | 0 | 96.32% |
| opencode/deepseek-v4.1-flash-free | gateway | 5 (later) | 4 | 2570 | 54272 | 0 | 95.48% |
| opencode/deepseek-v4.1-flash-free | gateway | 6 (later) | 2 | 4642 | 35072 | 0 | 88.31% |
| opencode/deepseek-v4.1-flash-free | gateway | 7 (later) | 1 | 1202 | 17536 | 0 | 93.59% |
| opencode/deepseek-v4.1-flash-free | gateway | 8 (later) | 1 | 1061 | 18688 | 0 | 94.63% |
| opencode/deepseek-v4.1-flash-free | gateway | 9 (later) | 1 | 790 | 19712 | 0 | 96.15% |
| opencode/deepseek-v4.1-flash-free | gateway | 10 (later) | 1 | 542 | 20480 | 0 | 97.42% |
| opencode/deepseek-v4.1-flash-free | gateway | 11 (later) | 1 | 153 | 20992 | 0 | 99.28% |
| opencode/deepseek-v4.1-flash-free | gateway | 12 (later) | 1 | 144 | 21120 | 0 | 99.32% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 1 (first / cross-session) | 6 | 417124 | 429824 | 0 | 50.75% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 2 (later) | 6 | 2644 | 846848 | 0 | 99.69% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 3 (later) | 6 | 1318 | 849280 | 0 | 99.85% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 4 (later) | 6 | 1687 | 850304 | 0 | 99.80% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 5 (later) | 1 | 14346 | 142592 | 0 | 90.86% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 6 (later) | 1 | 566 | 156928 | 0 | 99.64% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 7 (later) | 1 | 361 | 157440 | 0 | 99.77% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 8 (later) | 1 | 8647 | 157696 | 0 | 94.80% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 9 (later) | 1 | 1242 | 166272 | 0 | 99.26% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 10 (later) | 1 | 455 | 167424 | 0 | 99.73% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 11 (later) | 1 | 9858 | 0 | 0 | 0.00% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 12 (later) | 1 | 12839 | 141184 | 0 | 91.66% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 13 (later) | 1 | 161 | 153984 | 0 | 99.90% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 1 (first / cross-session) | 6 | 203969 | 417920 | 0 | 67.20% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 2 (later) | 6 | 1957 | 621568 | 0 | 99.69% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 3 (later) | 6 | 3611 | 623616 | 0 | 99.42% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 4 (later) | 6 | 28694 | 627328 | 0 | 95.63% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 5 (later) | 4 | 21824 | 447616 | 0 | 95.35% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 6 (later) | 3 | 985 | 365056 | 0 | 99.73% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 7 (later) | 3 | 1891 | 366336 | 0 | 99.49% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 8 (later) | 3 | 1092 | 368384 | 0 | 99.70% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 9 (later) | 3 | 874 | 369920 | 0 | 99.76% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 10 (later) | 3 | 2693 | 370944 | 0 | 99.28% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 11 (later) | 3 | 22288 | 373504 | 0 | 94.37% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 12 (later) | 3 | 8731 | 395776 | 0 | 97.84% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 13 (later) | 3 | 1636 | 405120 | 0 | 99.60% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 14 (later) | 3 | 2862 | 406912 | 0 | 99.30% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 15 (later) | 3 | 1733 | 410112 | 0 | 99.58% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 16 (later) | 3 | 2112 | 411904 | 0 | 99.49% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 17 (later) | 3 | 1358 | 414720 | 0 | 99.67% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 18 (later) | 3 | 1994 | 416512 | 0 | 99.52% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 19 (later) | 3 | 2431 | 418304 | 0 | 99.42% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 20 (later) | 3 | 1905 | 421120 | 0 | 99.55% |
| opencode/deepseek-v4.1-flash-free | preselect | 1 (first / cross-session) | 6 | 28261 | 16640 | 0 | 37.06% |
| opencode/deepseek-v4.1-flash-free | preselect | 2 (later) | 6 | 10697 | 44672 | 0 | 80.68% |
| opencode/deepseek-v4.1-flash-free | preselect | 3 (later) | 6 | 1430 | 55296 | 0 | 97.48% |
| opencode/deepseek-v4.1-flash-free | preselect | 4 (later) | 4 | 747 | 41472 | 0 | 98.23% |
| opencode/deepseek-v4.1-flash-free | preselect | 5 (later) | 3 | 576 | 34944 | 0 | 98.38% |
| opencode/deepseek-v4.1-flash-free | preselect | 6 (later) | 2 | 1803 | 27520 | 0 | 93.85% |
| opencode/deepseek-v4.1-flash-free | preselect | 7 (later) | 2 | 901 | 29440 | 0 | 97.03% |
| opencode/deepseek-v4.1-flash-free | preselect | 8 (later) | 2 | 1425 | 30592 | 0 | 95.55% |
| opencode/deepseek-v4.1-flash-free | preselect | 9 (later) | 2 | 1284 | 32128 | 0 | 96.16% |
| opencode/deepseek-v4.1-flash-free | preselect | 10 (later) | 2 | 21274 | 14080 | 0 | 39.83% |
| opencode/deepseek-v4.1-flash-free | preselect | 11 (later) | 1 | 79 | 23168 | 0 | 99.66% |
| opencode/deepseek-v4.1-flash-free | preselect | 12 (later) | 1 | 143 | 23296 | 0 | 99.39% |
| opencode/deepseek-v4.1-flash-free | preselect | 13 (later) | 1 | 492 | 23552 | 0 | 97.95% |
| opencode/deepseek-v4.1-flash-free | preselect | 14 (later) | 1 | 271 | 24448 | 0 | 98.90% |
| opencode/deepseek-v4.1-flash-free | preselect | 15 (later) | 1 | 307 | 24832 | 0 | 98.78% |
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
| opencode/deepseek-v4.1-flash-free | bare | Session wall | 7 | 34349.71 | 31864.00 | 91856.00 |
| opencode/deepseek-v4.1-flash-free | bare | Startup | 6 | 5230.78 | 4981.57 | 6472.24 |
| opencode/deepseek-v4.1-flash-free | bare | Step 1 | 6 | 651.66 | 521.47 | 1245.20 |
| opencode/deepseek-v4.1-flash-free | bare | Step 2 | 6 | 465.59 | 471.09 | 672.12 |
| opencode/deepseek-v4.1-flash-free | bare | Step 3 | 6 | 6741.90 | 1996.13 | 32052.00 |
| opencode/deepseek-v4.1-flash-free | bare | Step 4 | 6 | 608.27 | 596.52 | 1171.87 |
| opencode/deepseek-v4.1-flash-free | bare | Step 5 | 4 | 2327.60 | 2011.91 | 4774.25 |
| opencode/deepseek-v4.1-flash-free | bare | Step 6 | 4 | 3661.73 | 1607.24 | 10958.21 |
| opencode/deepseek-v4.1-flash-free | bare | Step 7 | 3 | 3048.07 | 2252.06 | 6626.56 |
| opencode/deepseek-v4.1-flash-free | bare | Step 8 | 2 | 551.65 | 551.65 | 643.24 |
| opencode/deepseek-v4.1-flash-free | bare | Step 9 | 1 | 1503.98 | 1503.98 | 1503.98 |
| opencode/deepseek-v4.1-flash-free | bare | Step 10 | 1 | 1869.28 | 1869.28 | 1869.28 |
| opencode/deepseek-v4.1-flash-free | bare | Step 11 | 1 | 2406.84 | 2406.84 | 2406.84 |
| opencode/deepseek-v4.1-flash-free | bare | Step 12 | 1 | 1494.78 | 1494.78 | 1494.78 |
| opencode/deepseek-v4.1-flash-free | bare | Step 13 | 1 | 1625.56 | 1625.56 | 1625.56 |
| opencode/deepseek-v4.1-flash-free | bare | Step 14 | 1 | 2386.34 | 2386.34 | 2386.34 |
| opencode/deepseek-v4.1-flash-free | bare | Step 15 | 1 | 3892.09 | 3892.09 | 3892.09 |
| opencode/deepseek-v4.1-flash-free | bare | Step 16 | 1 | 4844.82 | 4844.82 | 4844.82 |
| opencode/deepseek-v4.1-flash-free | bare | Step 17 | 1 | 3857.51 | 3857.51 | 3857.51 |
| opencode/deepseek-v4.1-flash-free | bare | Step 18 | 1 | 3593.21 | 3593.21 | 3593.21 |
| opencode/deepseek-v4.1-flash-free | bare | Step 19 | 1 | 440.92 | 440.92 | 440.92 |
| opencode/deepseek-v4.1-flash-free | bare | Step 20 | 1 | 951.82 | 951.82 | 951.82 |
| opencode/deepseek-v4.1-flash-free | gateway | Session wall | 6 | 22527.00 | 18867.50 | 48064.00 |
| opencode/deepseek-v4.1-flash-free | gateway | Startup | 6 | 5629.04 | 5747.54 | 6183.96 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 1 | 6 | 1475.79 | 1817.18 | 2317.81 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 2 | 6 | 985.24 | 814.65 | 2008.34 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 3 | 6 | 1537.17 | 1374.67 | 2785.24 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 4 | 6 | 807.02 | 407.38 | 2291.77 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 5 | 4 | 665.00 | 268.75 | 1988.34 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 6 | 2 | 3450.91 | 3450.91 | 6715.80 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 7 | 1 | 1665.80 | 1665.80 | 1665.80 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 8 | 1 | 927.32 | 927.32 | 927.32 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 9 | 1 | 2843.27 | 2843.27 | 2843.27 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 10 | 1 | 470.99 | 470.99 | 470.99 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 11 | 1 | 195.22 | 195.22 | 195.22 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 12 | 1 | 310.98 | 310.98 | 310.98 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Session wall | 6 | 38467.50 | 29433.50 | 91510.00 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Startup | 6 | 9720.77 | 10162.06 | 10432.56 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 1 | 6 | 866.87 | 872.94 | 1482.77 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 2 | 6 | 917.90 | 1053.29 | 1890.92 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 3 | 6 | 542.10 | 487.26 | 945.80 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 4 | 6 | 557.40 | 224.64 | 2240.29 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 5 | 1 | 2552.09 | 2552.09 | 2552.09 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 6 | 1 | 1575.96 | 1575.96 | 1575.96 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 7 | 1 | 4709.25 | 4709.25 | 4709.25 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 8 | 1 | 7190.16 | 7190.16 | 7190.16 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 9 | 1 | 1957.62 | 1957.62 | 1957.62 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 10 | 1 | 826.86 | 826.86 | 826.86 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 11 | 1 | 10906.06 | 10906.06 | 10906.06 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 12 | 1 | 341.33 | 341.33 | 341.33 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 13 | 1 | 132.60 | 132.60 | 132.60 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Session wall | 6 | 85620.33 | 79640.50 | 160024.00 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Startup | 6 | 8262.11 | 7881.73 | 10491.99 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 1 | 6 | 549.08 | 536.79 | 815.80 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 2 | 6 | 557.43 | 529.18 | 1030.85 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 3 | 6 | 1022.57 | 771.25 | 2628.70 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 4 | 6 | 790.69 | 775.90 | 1451.38 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 5 | 4 | 1816.87 | 2284.06 | 2486.05 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 6 | 3 | 4523.37 | 4682.78 | 5180.02 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 7 | 3 | 1402.71 | 1583.90 | 1877.27 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 8 | 3 | 3170.82 | 3537.53 | 5004.39 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 9 | 3 | 2107.98 | 2252.72 | 2515.38 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 10 | 3 | 1757.15 | 1638.30 | 2637.44 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 11 | 3 | 1936.28 | 1414.71 | 3968.18 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 12 | 3 | 3730.69 | 3532.13 | 4300.32 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 13 | 3 | 4305.72 | 2812.43 | 8873.99 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 14 | 3 | 4870.42 | 2192.20 | 10242.05 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 15 | 3 | 2313.21 | 884.66 | 5474.75 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 16 | 3 | 2480.97 | 1962.54 | 4990.58 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 17 | 3 | 5478.34 | 7602.08 | 7782.35 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 18 | 3 | 1598.83 | 1347.43 | 2511.52 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 19 | 3 | 4095.02 | 2736.74 | 7352.28 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 20 | 3 | 1382.80 | 1304.79 | 2766.28 |
| opencode/deepseek-v4.1-flash-free | preselect | Session wall | 6 | 28587.17 | 16242.00 | 84703.00 |
| opencode/deepseek-v4.1-flash-free | preselect | Startup | 6 | 6318.52 | 5856.16 | 8808.01 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 1 | 6 | 591.21 | 562.88 | 1026.84 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 2 | 6 | 781.69 | 710.11 | 1479.18 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 3 | 6 | 641.44 | 711.82 | 1089.25 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 4 | 4 | 651.34 | 634.66 | 1171.80 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 5 | 3 | 1286.18 | 1778.76 | 1875.58 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 6 | 2 | 3188.41 | 3188.41 | 5046.68 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 7 | 2 | 2552.17 | 2552.17 | 2775.39 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 8 | 2 | 1355.25 | 1355.25 | 2009.48 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 9 | 2 | 6840.81 | 6840.81 | 13506.70 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 10 | 2 | 547.67 | 547.67 | 993.45 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 11 | 1 | 722.50 | 722.50 | 722.50 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 12 | 1 | 1308.17 | 1308.17 | 1308.17 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 13 | 1 | 16892.59 | 16892.59 | 16892.59 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 14 | 1 | 1517.36 | 1517.36 | 1517.36 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 15 | 1 | 4530.71 | 4530.71 | 4530.71 |
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
| opencode/deepseek-v4.1-flash-free | bare | deepseek-flash-off-peak | 8.17 | 26632.67 | $0.003995 | $0.001280 | $0.000000 | $0.005274 |
| opencode/deepseek-v4.1-flash-free | bare | deepseek-flash-peak | 8.17 | 26632.67 | $0.007990 | $0.002559 | $0.000000 | $0.010549 |
| opencode/deepseek-v4.1-flash-free | bare | glm-5.3-flash | 8.17 | 53992.67 | $0.008099 | $0.001066 | $0.000000 | $0.009165 |
| opencode/deepseek-v4.1-flash-free | bare | claude-sonnet-5.5-5m | 8.17 | 31192.67 | $0.062385 | $0.021327 | $0.000000 | $0.083712 |
| opencode/deepseek-v4.1-flash-free | bare | gpt-6.1-sol-30m | 8.17 | 31192.67 | $0.062385 | $0.021327 | $0.000000 | $0.083712 |
| opencode/deepseek-v4.1-flash-free | gateway | deepseek-flash-off-peak | 6.00 | 9760.51 | $0.001464 | $0.000643 | $0.001576 | $0.003683 |
| opencode/deepseek-v4.1-flash-free | gateway | deepseek-flash-peak | 6.00 | 9760.51 | $0.002928 | $0.001286 | $0.001576 | $0.005790 |
| opencode/deepseek-v4.1-flash-free | gateway | glm-5.3-flash | 6.00 | 21987.07 | $0.003298 | $0.000536 | $0.001576 | $0.005410 |
| opencode/deepseek-v4.1-flash-free | gateway | claude-sonnet-5.5-5m | 6.00 | 11798.27 | $0.023597 | $0.010715 | $0.001576 | $0.035887 |
| opencode/deepseek-v4.1-flash-free | gateway | gpt-6.1-sol-30m | 6.00 | 11798.27 | $0.023597 | $0.010715 | $0.001576 | $0.035887 |
| opencode/deepseek-v4.1-flash-free | heavy-max | deepseek-flash-off-peak | 5.50 | 92607.25 | $0.013891 | $0.000760 | $0.000000 | $0.014652 |
| opencode/deepseek-v4.1-flash-free | heavy-max | deepseek-flash-peak | 5.50 | 92607.25 | $0.027782 | $0.001521 | $0.000000 | $0.029303 |
| opencode/deepseek-v4.1-flash-free | heavy-max | glm-5.3-flash | 5.50 | 219200.53 | $0.032880 | $0.000634 | $0.000000 | $0.033514 |
| opencode/deepseek-v4.1-flash-free | heavy-max | claude-sonnet-5.5-5m | 5.50 | 113706.13 | $0.227412 | $0.012675 | $0.000000 | $0.240087 |
| opencode/deepseek-v4.1-flash-free | heavy-max | gpt-6.1-sol-30m | 5.50 | 113706.13 | $0.227412 | $0.012675 | $0.000000 | $0.240087 |
| opencode/deepseek-v4.1-flash-free | mcp-all | deepseek-flash-off-peak | 12.17 | 81282.24 | $0.012192 | $0.002445 | $0.000000 | $0.014638 |
| opencode/deepseek-v4.1-flash-free | mcp-all | deepseek-flash-peak | 12.17 | 81282.24 | $0.024385 | $0.004890 | $0.000000 | $0.029275 |
| opencode/deepseek-v4.1-flash-free | mcp-all | glm-5.3-flash | 12.17 | 340862.40 | $0.051129 | $0.002038 | $0.000000 | $0.053167 |
| opencode/deepseek-v4.1-flash-free | mcp-all | claude-sonnet-5.5-5m | 12.17 | 124545.60 | $0.249091 | $0.040753 | $0.000000 | $0.289845 |
| opencode/deepseek-v4.1-flash-free | mcp-all | gpt-6.1-sol-30m | 12.17 | 124545.60 | $0.249091 | $0.040753 | $0.000000 | $0.289845 |
| opencode/deepseek-v4.1-flash-free | preselect | deepseek-flash-off-peak | 6.67 | 13101.93 | $0.001965 | $0.000661 | $0.001101 | $0.003727 |
| opencode/deepseek-v4.1-flash-free | preselect | deepseek-flash-peak | 6.67 | 13101.93 | $0.003931 | $0.001321 | $0.001101 | $0.006353 |
| opencode/deepseek-v4.1-flash-free | preselect | glm-5.3-flash | 6.67 | 26484.33 | $0.003973 | $0.000551 | $0.001101 | $0.005624 |
| opencode/deepseek-v4.1-flash-free | preselect | claude-sonnet-5.5-5m | 6.67 | 15332.33 | $0.030665 | $0.011012 | $0.001101 | $0.042778 |
| opencode/deepseek-v4.1-flash-free | preselect | gpt-6.1-sol-30m | 6.67 | 15332.33 | $0.030665 | $0.011012 | $0.001101 | $0.042778 |
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
| opencode/deepseek-v4.1-flash-free | bare | 2 | 1 | 0 | 100.00% | at least 90% | 66.67% (21–94%) | 27 | 37852 | 344320 | 0 | 3391 | 4944 |
| opencode/deepseek-v4.1-flash-free | gateway | 3 | 0 | 0 | 100.00% | at least 90% | 100.00% (44–100%) | 21 | 23465 | 247424 | 0 | 2403 | 1867 |
| opencode/deepseek-v4.1-flash-free | heavy-max | 3 | 0 | 0 | 100.00% | at least 90% | 100.00% (44–100%) | 12 | 140784 | 1557376 | 0 | 1174 | 738 |
| opencode/deepseek-v4.1-flash-free | mcp-all | 3 | 0 | 0 | 100.00% | at least 90% | 100.00% (44–100%) | 12 | 3058 | 1247232 | 0 | 1091 | 482 |
| opencode/deepseek-v4.1-flash-free | preselect | 2 | 1 | 0 | 100.00% | at least 90% | 66.67% (21–94%) | 28 | 14645 | 297984 | 0 | 2189 | 2759 |
| opencode/glm-5.3-flash-free | bare | 2 | 1 | 0 | 100.00% | at least 90% | 66.67% (21–94%) | 22 | 42010 | 138304 | 0 | 3123 | 4352 |
| opencode/glm-5.3-flash-free | gateway | 3 | 0 | 0 | 100.00% | at least 90% | 100.00% (44–100%) | 18 | 36503 | 137024 | 0 | 1716 | 1157 |
| opencode/glm-5.3-flash-free | heavy-max | 3 | 0 | 0 | 100.00% | at least 90% | 100.00% (44–100%) | 17 | 422932 | 1935104 | 0 | 1799 | 2155 |
| opencode/glm-5.3-flash-free | mcp-all | 3 | 0 | 0 | 100.00% | at least 90% | 100.00% (44–100%) | 11 | 307905 | 811776 | 0 | 890 | 819 |
| opencode/glm-5.3-flash-free | preselect | 2 | 1 | 0 | 100.00% | at least 90% | 66.67% (21–94%) | 31 | 56557 | 302784 | 0 | 3243 | 5828 |

### Invalid usage and all-attempt Jev spend

Invalid reasons count attempts, including retries; zero token counters do not imply zero invalid attempts. Deadlines list distinct configured timeoutMs values; unknown (historical) marks omitted values. Groups with different deadlines remain pooled and are not a common-timeout comparison.

| Model | Arm | Invalid reasons | Deadlines (ms) | Invalid steps | Invalid uncached | Invalid cache read | Invalid cache write | Invalid output | Invalid reasoning | Jev calls | Jev USD |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | bare | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | gateway | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | $0.002471 |
| opencode/deepseek-v4.1-flash-free | heavy-max | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | mcp-all | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/deepseek-v4.1-flash-free | preselect | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | $0.003732 |
| opencode/glm-5.3-flash-free | bare | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | gateway | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | $0.001207 |
| opencode/glm-5.3-flash-free | heavy-max | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | mcp-all | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | $0.000000 |
| opencode/glm-5.3-flash-free | preselect | none | 300000 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | $0.003731 |

### Cache by request position

| Model | Arm | Request position | Requests | Uncached | Cache read | Cache write | Cache-hit ratio |
|---|---|---|---:|---:|---:|---:|---:|
| opencode/deepseek-v4.1-flash-free | bare | 1 (first / cross-session) | 3 | 5369 | 15616 | 0 | 74.42% |
| opencode/deepseek-v4.1-flash-free | bare | 2 (later) | 3 | 5920 | 15616 | 0 | 72.51% |
| opencode/deepseek-v4.1-flash-free | bare | 3 (later) | 3 | 847 | 21504 | 0 | 96.21% |
| opencode/deepseek-v4.1-flash-free | bare | 4 (later) | 2 | 782 | 14848 | 0 | 95.00% |
| opencode/deepseek-v4.1-flash-free | bare | 5 (later) | 1 | 2249 | 7936 | 0 | 77.92% |
| opencode/deepseek-v4.1-flash-free | bare | 6 (later) | 1 | 637 | 10112 | 0 | 94.07% |
| opencode/deepseek-v4.1-flash-free | bare | 7 (later) | 1 | 502 | 10624 | 0 | 95.49% |
| opencode/deepseek-v4.1-flash-free | bare | 8 (later) | 1 | 709 | 11008 | 0 | 93.95% |
| opencode/deepseek-v4.1-flash-free | bare | 9 (later) | 1 | 1220 | 11648 | 0 | 90.52% |
| opencode/deepseek-v4.1-flash-free | bare | 10 (later) | 1 | 846 | 12800 | 0 | 93.80% |
| opencode/deepseek-v4.1-flash-free | bare | 11 (later) | 1 | 1064 | 13568 | 0 | 92.73% |
| opencode/deepseek-v4.1-flash-free | bare | 12 (later) | 1 | 2121 | 14592 | 0 | 87.31% |
| opencode/deepseek-v4.1-flash-free | bare | 13 (later) | 1 | 740 | 16640 | 0 | 95.74% |
| opencode/deepseek-v4.1-flash-free | bare | 14 (later) | 1 | 1547 | 17280 | 0 | 91.78% |
| opencode/deepseek-v4.1-flash-free | bare | 15 (later) | 1 | 826 | 18816 | 0 | 95.79% |
| opencode/deepseek-v4.1-flash-free | bare | 16 (later) | 1 | 6798 | 19584 | 0 | 74.23% |
| opencode/deepseek-v4.1-flash-free | bare | 17 (later) | 1 | 790 | 26368 | 0 | 97.09% |
| opencode/deepseek-v4.1-flash-free | bare | 18 (later) | 1 | 914 | 27136 | 0 | 96.74% |
| opencode/deepseek-v4.1-flash-free | bare | 19 (later) | 1 | 2581 | 28032 | 0 | 91.57% |
| opencode/deepseek-v4.1-flash-free | bare | 20 (later) | 1 | 1390 | 30592 | 0 | 95.65% |
| opencode/deepseek-v4.1-flash-free | gateway | 1 (first / cross-session) | 3 | 496 | 23040 | 0 | 97.89% |
| opencode/deepseek-v4.1-flash-free | gateway | 2 (later) | 3 | 905 | 23424 | 0 | 96.28% |
| opencode/deepseek-v4.1-flash-free | gateway | 3 (later) | 3 | 3763 | 24192 | 0 | 86.54% |
| opencode/deepseek-v4.1-flash-free | gateway | 4 (later) | 3 | 956 | 27776 | 0 | 96.67% |
| opencode/deepseek-v4.1-flash-free | gateway | 5 (later) | 2 | 1020 | 20096 | 0 | 95.17% |
| opencode/deepseek-v4.1-flash-free | gateway | 6 (later) | 2 | 927 | 20992 | 0 | 95.77% |
| opencode/deepseek-v4.1-flash-free | gateway | 7 (later) | 1 | 780 | 12672 | 0 | 94.20% |
| opencode/deepseek-v4.1-flash-free | gateway | 8 (later) | 1 | 13237 | 13440 | 0 | 50.38% |
| opencode/deepseek-v4.1-flash-free | gateway | 9 (later) | 1 | 954 | 26624 | 0 | 96.54% |
| opencode/deepseek-v4.1-flash-free | gateway | 10 (later) | 1 | 219 | 27520 | 0 | 99.21% |
| opencode/deepseek-v4.1-flash-free | gateway | 11 (later) | 1 | 208 | 27648 | 0 | 99.25% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 1 (first / cross-session) | 3 | 137987 | 285312 | 0 | 67.40% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 2 (later) | 3 | 881 | 423168 | 0 | 99.79% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 3 (later) | 3 | 1149 | 423936 | 0 | 99.73% |
| opencode/deepseek-v4.1-flash-free | heavy-max | 4 (later) | 3 | 767 | 424960 | 0 | 99.82% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 1 (first / cross-session) | 3 | 484 | 311040 | 0 | 99.84% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 2 (later) | 3 | 789 | 311424 | 0 | 99.75% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 3 (later) | 3 | 777 | 311936 | 0 | 99.75% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 4 (later) | 2 | 585 | 208384 | 0 | 99.72% |
| opencode/deepseek-v4.1-flash-free | mcp-all | 5 (later) | 1 | 423 | 104448 | 0 | 99.60% |
| opencode/deepseek-v4.1-flash-free | preselect | 1 (first / cross-session) | 3 | 244 | 20736 | 0 | 98.84% |
| opencode/deepseek-v4.1-flash-free | preselect | 2 (later) | 3 | 797 | 20736 | 0 | 96.30% |
| opencode/deepseek-v4.1-flash-free | preselect | 3 (later) | 3 | 764 | 21376 | 0 | 96.55% |
| opencode/deepseek-v4.1-flash-free | preselect | 4 (later) | 3 | 1062 | 21888 | 0 | 95.37% |
| opencode/deepseek-v4.1-flash-free | preselect | 5 (later) | 1 | 2298 | 7808 | 0 | 77.26% |
| opencode/deepseek-v4.1-flash-free | preselect | 6 (later) | 1 | 340 | 9984 | 0 | 96.71% |
| opencode/deepseek-v4.1-flash-free | preselect | 7 (later) | 1 | 487 | 10240 | 0 | 95.46% |
| opencode/deepseek-v4.1-flash-free | preselect | 8 (later) | 1 | 895 | 10624 | 0 | 92.23% |
| opencode/deepseek-v4.1-flash-free | preselect | 9 (later) | 1 | 923 | 11392 | 0 | 92.51% |
| opencode/deepseek-v4.1-flash-free | preselect | 10 (later) | 1 | 283 | 12288 | 0 | 97.75% |
| opencode/deepseek-v4.1-flash-free | preselect | 11 (later) | 1 | 355 | 12544 | 0 | 97.25% |
| opencode/deepseek-v4.1-flash-free | preselect | 12 (later) | 1 | 1092 | 12800 | 0 | 92.14% |
| opencode/deepseek-v4.1-flash-free | preselect | 13 (later) | 1 | 576 | 13824 | 0 | 96.00% |
| opencode/deepseek-v4.1-flash-free | preselect | 14 (later) | 1 | 190 | 14336 | 0 | 98.69% |
| opencode/deepseek-v4.1-flash-free | preselect | 15 (later) | 1 | 596 | 14464 | 0 | 96.04% |
| opencode/deepseek-v4.1-flash-free | preselect | 16 (later) | 1 | 1125 | 14976 | 0 | 93.01% |
| opencode/deepseek-v4.1-flash-free | preselect | 17 (later) | 1 | 718 | 16000 | 0 | 95.71% |
| opencode/deepseek-v4.1-flash-free | preselect | 18 (later) | 1 | 784 | 16640 | 0 | 95.50% |
| opencode/deepseek-v4.1-flash-free | preselect | 19 (later) | 1 | 605 | 17408 | 0 | 96.64% |
| opencode/deepseek-v4.1-flash-free | preselect | 20 (later) | 1 | 511 | 17920 | 0 | 97.23% |
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
| opencode/deepseek-v4.1-flash-free | bare | Session wall | 3 | 42020.00 | 18194.00 | 92603.00 |
| opencode/deepseek-v4.1-flash-free | bare | Startup | 3 | 7696.51 | 6663.38 | 11029.94 |
| opencode/deepseek-v4.1-flash-free | bare | Step 1 | 3 | 316.69 | 363.44 | 409.94 |
| opencode/deepseek-v4.1-flash-free | bare | Step 2 | 3 | 1370.70 | 1750.02 | 1754.93 |
| opencode/deepseek-v4.1-flash-free | bare | Step 3 | 3 | 298.93 | 263.04 | 599.07 |
| opencode/deepseek-v4.1-flash-free | bare | Step 4 | 2 | 199.94 | 199.94 | 399.07 |
| opencode/deepseek-v4.1-flash-free | bare | Step 5 | 1 | 1210.35 | 1210.35 | 1210.35 |
| opencode/deepseek-v4.1-flash-free | bare | Step 6 | 1 | 1008.24 | 1008.24 | 1008.24 |
| opencode/deepseek-v4.1-flash-free | bare | Step 7 | 1 | 1328.30 | 1328.30 | 1328.30 |
| opencode/deepseek-v4.1-flash-free | bare | Step 8 | 1 | 1384.44 | 1384.44 | 1384.44 |
| opencode/deepseek-v4.1-flash-free | bare | Step 9 | 1 | 2648.45 | 2648.45 | 2648.45 |
| opencode/deepseek-v4.1-flash-free | bare | Step 10 | 1 | 4664.75 | 4664.75 | 4664.75 |
| opencode/deepseek-v4.1-flash-free | bare | Step 11 | 1 | 5903.27 | 5903.27 | 5903.27 |
| opencode/deepseek-v4.1-flash-free | bare | Step 12 | 1 | 2126.13 | 2126.13 | 2126.13 |
| opencode/deepseek-v4.1-flash-free | bare | Step 13 | 1 | 5939.21 | 5939.21 | 5939.21 |
| opencode/deepseek-v4.1-flash-free | bare | Step 14 | 1 | 1420.56 | 1420.56 | 1420.56 |
| opencode/deepseek-v4.1-flash-free | bare | Step 15 | 1 | 2928.49 | 2928.49 | 2928.49 |
| opencode/deepseek-v4.1-flash-free | bare | Step 16 | 1 | 2994.96 | 2994.96 | 2994.96 |
| opencode/deepseek-v4.1-flash-free | bare | Step 17 | 1 | 11334.38 | 11334.38 | 11334.38 |
| opencode/deepseek-v4.1-flash-free | bare | Step 18 | 1 | 2739.79 | 2739.79 | 2739.79 |
| opencode/deepseek-v4.1-flash-free | bare | Step 19 | 1 | 1905.53 | 1905.53 | 1905.53 |
| opencode/deepseek-v4.1-flash-free | bare | Step 20 | 1 | 1295.53 | 1295.53 | 1295.53 |
| opencode/deepseek-v4.1-flash-free | gateway | Session wall | 3 | 26088.33 | 22484.00 | 42160.00 |
| opencode/deepseek-v4.1-flash-free | gateway | Startup | 3 | 6057.06 | 5950.91 | 6713.44 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 1 | 3 | 730.02 | 425.23 | 1520.60 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 2 | 3 | 842.20 | 456.87 | 1658.49 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 3 | 3 | 937.67 | 873.44 | 1236.82 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 4 | 3 | 1061.06 | 527.02 | 2590.56 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 5 | 2 | 2965.38 | 2965.38 | 4595.81 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 6 | 2 | 922.08 | 922.08 | 1537.55 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 7 | 1 | 1131.78 | 1131.78 | 1131.78 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 8 | 1 | 5031.98 | 5031.98 | 5031.98 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 9 | 1 | 640.86 | 640.86 | 640.86 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 10 | 1 | 198.38 | 198.38 | 198.38 |
| opencode/deepseek-v4.1-flash-free | gateway | Step 11 | 1 | 162.87 | 162.87 | 162.87 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Session wall | 3 | 23800.33 | 23902.00 | 28228.00 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Startup | 3 | 7928.91 | 8197.86 | 8388.61 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 1 | 3 | 853.86 | 901.57 | 1032.58 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 2 | 3 | 2268.13 | 1027.73 | 5776.49 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 3 | 3 | 450.09 | 439.51 | 910.67 |
| opencode/deepseek-v4.1-flash-free | heavy-max | Step 4 | 3 | 302.34 | 336.64 | 442.52 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Session wall | 3 | 25141.67 | 25305.00 | 30344.00 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Startup | 3 | 8243.71 | 7702.65 | 9451.76 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 1 | 3 | 666.74 | 634.01 | 918.23 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 2 | 3 | 479.44 | 63.49 | 1326.70 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 3 | 3 | 640.68 | 775.95 | 781.98 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 4 | 2 | 1304.59 | 1304.59 | 2186.06 |
| opencode/deepseek-v4.1-flash-free | mcp-all | Step 5 | 1 | 204.53 | 204.53 | 204.53 |
| opencode/deepseek-v4.1-flash-free | preselect | Session wall | 3 | 33376.67 | 13126.00 | 74712.00 |
| opencode/deepseek-v4.1-flash-free | preselect | Startup | 3 | 4703.98 | 4603.24 | 5545.91 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 1 | 3 | 338.72 | 345.69 | 499.91 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 2 | 3 | 612.35 | 566.24 | 778.85 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 3 | 3 | 1011.44 | 790.30 | 1594.45 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 4 | 3 | 500.14 | 668.48 | 831.85 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 5 | 1 | 0.15 | 0.15 | 0.15 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 6 | 1 | 1065.61 | 1065.61 | 1065.61 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 7 | 1 | 1960.76 | 1960.76 | 1960.76 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 8 | 1 | 4416.59 | 4416.59 | 4416.59 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 9 | 1 | 391.27 | 391.27 | 391.27 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 10 | 1 | 1649.56 | 1649.56 | 1649.56 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 11 | 1 | 1265.92 | 1265.92 | 1265.92 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 12 | 1 | 2148.16 | 2148.16 | 2148.16 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 13 | 1 | 1390.29 | 1390.29 | 1390.29 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 14 | 1 | 1331.22 | 1331.22 | 1331.22 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 15 | 1 | 1940.10 | 1940.10 | 1940.10 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 16 | 1 | 1065.06 | 1065.06 | 1065.06 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 17 | 1 | 4143.98 | 4143.98 | 4143.98 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 18 | 1 | 2856.73 | 2856.73 | 2856.73 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 19 | 1 | 1168.91 | 1168.91 | 1168.91 |
| opencode/deepseek-v4.1-flash-free | preselect | Step 20 | 1 | 1511.68 | 1511.68 | 1511.68 |
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
| opencode/deepseek-v4.1-flash-free | bare | deepseek-flash-off-peak | 9.00 | 14912.80 | $0.002237 | $0.001667 | $0.000000 | $0.003904 |
| opencode/deepseek-v4.1-flash-free | bare | deepseek-flash-peak | 9.00 | 14912.80 | $0.004474 | $0.003334 | $0.000000 | $0.007808 |
| opencode/deepseek-v4.1-flash-free | bare | glm-5.3-flash | 9.00 | 35572.00 | $0.005336 | $0.001389 | $0.000000 | $0.006725 |
| opencode/deepseek-v4.1-flash-free | bare | claude-sonnet-5.5-5m | 9.00 | 18356.00 | $0.036712 | $0.027783 | $0.000000 | $0.064495 |
| opencode/deepseek-v4.1-flash-free | bare | gpt-6.1-sol-30m | 9.00 | 18356.00 | $0.036712 | $0.027783 | $0.000000 | $0.064495 |
| opencode/deepseek-v4.1-flash-free | gateway | deepseek-flash-off-peak | 7.00 | 9471.16 | $0.001421 | $0.000854 | $0.000824 | $0.003098 |
| opencode/deepseek-v4.1-flash-free | gateway | deepseek-flash-peak | 7.00 | 9471.16 | $0.002841 | $0.001708 | $0.000824 | $0.005373 |
| opencode/deepseek-v4.1-flash-free | gateway | glm-5.3-flash | 7.00 | 24316.60 | $0.003647 | $0.000712 | $0.000824 | $0.005183 |
| opencode/deepseek-v4.1-flash-free | gateway | claude-sonnet-5.5-5m | 7.00 | 11945.40 | $0.023891 | $0.014233 | $0.000824 | $0.038948 |
| opencode/deepseek-v4.1-flash-free | gateway | gpt-6.1-sol-30m | 7.00 | 11945.40 | $0.023891 | $0.014233 | $0.000824 | $0.038948 |
| opencode/deepseek-v4.1-flash-free | heavy-max | deepseek-flash-off-peak | 4.00 | 57310.51 | $0.008597 | $0.000382 | $0.000000 | $0.008979 |
| opencode/deepseek-v4.1-flash-free | heavy-max | deepseek-flash-peak | 4.00 | 57310.51 | $0.017193 | $0.000765 | $0.000000 | $0.017958 |
| opencode/deepseek-v4.1-flash-free | heavy-max | glm-5.3-flash | 4.00 | 150753.07 | $0.022613 | $0.000319 | $0.000000 | $0.022932 |
| opencode/deepseek-v4.1-flash-free | heavy-max | claude-sonnet-5.5-5m | 4.00 | 72884.27 | $0.145769 | $0.006373 | $0.000000 | $0.152142 |
| opencode/deepseek-v4.1-flash-free | heavy-max | gpt-6.1-sol-30m | 4.00 | 72884.27 | $0.145769 | $0.006373 | $0.000000 | $0.152142 |
| opencode/deepseek-v4.1-flash-free | mcp-all | deepseek-flash-off-peak | 4.00 | 9334.21 | $0.001400 | $0.000315 | $0.000000 | $0.001715 |
| opencode/deepseek-v4.1-flash-free | mcp-all | deepseek-flash-peak | 4.00 | 9334.21 | $0.002800 | $0.000629 | $0.000000 | $0.003429 |
| opencode/deepseek-v4.1-flash-free | mcp-all | glm-5.3-flash | 4.00 | 84168.13 | $0.012625 | $0.000262 | $0.000000 | $0.012887 |
| opencode/deepseek-v4.1-flash-free | mcp-all | claude-sonnet-5.5-5m | 4.00 | 21806.53 | $0.043613 | $0.005243 | $0.000000 | $0.048856 |
| opencode/deepseek-v4.1-flash-free | mcp-all | gpt-6.1-sol-30m | 4.00 | 21806.53 | $0.043613 | $0.005243 | $0.000000 | $0.048856 |
| opencode/deepseek-v4.1-flash-free | preselect | deepseek-flash-off-peak | 9.33 | 6868.23 | $0.001030 | $0.000990 | $0.001244 | $0.003264 |
| opencode/deepseek-v4.1-flash-free | preselect | deepseek-flash-peak | 9.33 | 6868.23 | $0.002060 | $0.001979 | $0.001244 | $0.005284 |
| opencode/deepseek-v4.1-flash-free | preselect | glm-5.3-flash | 9.33 | 24747.27 | $0.003712 | $0.000825 | $0.001244 | $0.005781 |
| opencode/deepseek-v4.1-flash-free | preselect | claude-sonnet-5.5-5m | 9.33 | 9848.07 | $0.019696 | $0.016493 | $0.001244 | $0.037434 |
| opencode/deepseek-v4.1-flash-free | preselect | gpt-6.1-sol-30m | 9.33 | 9848.07 | $0.019696 | $0.016493 | $0.001244 | $0.037434 |
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
