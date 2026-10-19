# Sweep stability

Latency in ms (nearest-rank percentiles); mean cost per decision in USD. Keyword fallbacks match the stored "used keyword ranking" warning. Empty sets have Jaccard 1 with each other.

| Run | Split | Rows | Keyword fallbacks | Latency p50 | Latency p95 | Mean cost |
|---|---|---:|---:|---:|---:|---:|
| bench/results/2026-10-16T17-39-02-sweep | dev | 102 | 0 | 2721.00 | 8242.00 | $0.001222 |
| bench/results/2026-10-16T17-39-02-sweep | test | 213 | 0 | 2766.00 | 6598.00 | $0.001219 |
| bench/results/2026-10-16T17-39-02-sweep | all | 315 | 0 | 2737.00 | 6925.00 | $0.001220 |
| bench/results/2026-10-16T18-07-05-sweep | dev | 102 | 0 | 2252.00 | 3911.00 | $0.001222 |
| bench/results/2026-10-16T18-07-05-sweep | test | 213 | 0 | 2197.00 | 4538.00 | $0.001219 |
| bench/results/2026-10-16T18-07-05-sweep | all | 315 | 0 | 2206.00 | 4345.00 | $0.001220 |
| bench/results/2026-10-16T18-19-29-sweep | dev | 102 | 0 | 989.00 | 1218.00 | $0.001222 |
| bench/results/2026-10-16T18-19-29-sweep | test | 213 | 0 | 986.00 | 1250.00 | $0.001219 |
| bench/results/2026-10-16T18-19-29-sweep | all | 315 | 0 | 986.00 | 1246.00 | $0.001220 |

| Split | Requests | Loaded identical in all runs | Loaded mean pairwise Jaccard | Loaded or offered identical in all runs | Loaded or offered mean pairwise Jaccard |
|---|---:|---:|---:|---:|---:|
| dev | 102 | 92.16% (94/102) | 0.966776 | 85.29% (87/102) | 0.953377 |
| test | 213 | 89.20% (190/213) | 0.945227 | 83.10% (177/213) | 0.947228 |
| all | 315 | 90.16% (284/315) | 0.952205 | 83.81% (264/315) | 0.949219 |

