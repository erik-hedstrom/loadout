# Sweep stability

Latency in ms (nearest-rank percentiles); mean cost per decision in USD. Keyword fallbacks match the stored "used keyword ranking" warning. Empty sets have Jaccard 1 with each other.

| Run | Split | Rows | Keyword fallbacks | Latency p50 | Latency p95 | Mean cost |
|---|---|---:|---:|---:|---:|---:|
| bench/results/2026-10-16T17-54-45-sweep | dev | 99 | 0 | 1993.00 | 6750.00 | $0.001174 |
| bench/results/2026-10-16T17-54-45-sweep | test | 201 | 1 | 2029.00 | 5233.00 | $0.001172 |
| bench/results/2026-10-16T17-54-45-sweep | all | 300 | 1 | 2004.00 | 5479.00 | $0.001173 |
| bench/results/2026-10-16T18-15-07-sweep | dev | 99 | 0 | 1348.00 | 2262.00 | $0.001174 |
| bench/results/2026-10-16T18-15-07-sweep | test | 201 | 0 | 1272.00 | 2206.00 | $0.001178 |
| bench/results/2026-10-16T18-15-07-sweep | all | 300 | 0 | 1289.00 | 2213.00 | $0.001177 |
| bench/results/2026-10-16T18-22-14-sweep | dev | 99 | 0 | 901.00 | 1095.00 | $0.001173 |
| bench/results/2026-10-16T18-22-14-sweep | test | 201 | 0 | 908.00 | 1100.00 | $0.001178 |
| bench/results/2026-10-16T18-22-14-sweep | all | 300 | 0 | 904.00 | 1095.00 | $0.001177 |

| Split | Requests | Loaded identical in all runs | Loaded mean pairwise Jaccard | Loaded or offered identical in all runs | Loaded or offered mean pairwise Jaccard |
|---|---:|---:|---:|---:|---:|
| dev | 99 | 86.87% (86/99) | 0.940516 | 73.74% (73/99) | 0.920410 |
| test | 201 | 91.04% (183/201) | 0.952875 | 83.58% (168/201) | 0.943955 |
| all | 300 | 89.67% (269/300) | 0.948796 | 80.33% (241/300) | 0.936185 |

