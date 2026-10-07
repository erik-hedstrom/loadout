# loadout benchmark

Does the router put the skill a task needs in front of the agent, and what
does that cost, as the library grows from 100 to 20,000 skills?

## Data

| File | What | In git |
|---|---|---|
| `data/corpus.jsonl` | 20,000 distinct skills (name, description, repo, stars) | no — rebuild |
| `data/popular.jsonl` | skills.sh all-time top 100 by installs, resolved to descriptions | no — rebuild |
| `data/tasks.jsonl` | generated tasks with gold skills | yes |
| `results/<run>/` | `rows.jsonl` (per task × size × arm), `summary.md`, `summary.json` | yes |

**Corpus.** Built from [GitSkills](https://huggingface.co/datasets/mvaccargiu/gitskills)
(3.8M `SKILL.md` files from 282k public repos, July 2026; CC-BY-4.0
metadata, file contents under their repos' licenses). One skill per name (the
copy in the most-starred non-fork repo), templates and junk dropped, at most
150 skills per repo so skill-farm repos cannot dominate, top 20,000 by repo
stars. The skills.sh most-installed skills are forced in, falling back to
GitHub for skills newer than the snapshot.

**Tasks.** For a seeded sample of skills (20 from the skills.sh top 50, then
50 each from the head / torso / tail of the corpus by stars, English
descriptions only), a model writes the request a developer would type where
that skill would help, without naming it, plus a plausible repo context. 30
more tasks need no skill at all. Tasks that leak a multi-word skill name
verbatim are dropped.

## Arms

| Arm | What the agent gets |
|---|---|
| `popular` | the 50 most-installed skills.sh skills, always loaded: what people do today |
| `bm25` | top 10 by BM25: roughly lexical tool search |
| `hybrid` | top 10 by BM25 + embeddings (RRF) |
| `loadout` | the two-stage Jev router ([DESIGN.md](../DESIGN.md#router)); raw answers are stored per row |
| `frontier` | a frontier model reads every description and picks up to 12 (small libraries only) |
| everything | every description in context; reported as context size, since 20k skills do not fit |

For each task and size N the library is the gold skill plus N−1 random corpus
skills, nested across sizes. **Recall** = the gold skill was loaded. The
gold label is a lower bound: another skill in the library may serve the task
equally well and is counted as a miss.

Tasks are split by hash into **dev** (1/3) and **test** (2/3). `tune.ts` replays
the selection rule over the stored Jev answers on dev (no API calls), picks the
best rule per budget, and reports it on test.

## Reproduce

```bash
uv run --with duckdb --with pyyaml bench/scripts/build_corpus.py   # ~2 min, reads parquet metadata over HTTP
npx tsx bench/generate-tasks.ts                                    # ~$1 of Claude usage
npx tsx bench/retrieval-bench.ts                                   # retrieval recall@K, local only (embeds the corpus once, ~10 min)
TYPESAFE_API_KEY=... npx tsx bench/route-bench.ts                  # ~$0.45 of Jev for 199 tasks × 3 sizes
npx tsx bench/tune.ts bench/results/<run>                          # tune on dev, report on test, no API calls
npx tsx bench/route-bench.ts --arms none --frontier 20 --sizes 100 # frontier arm, ~$1 of Claude usage
TYPESAFE_API_KEY=... npx tsx bench/need-probe.ts bench/results/<run> # compare need questions (~$0.01)
npx tsx bench/handwritten.ts                                       # hand-written requests vs your real library
```

`claude -p` calls run with `--strict-mcp-config --disable-slash-commands
--tools ""` from a neutral directory. Without that, the configured MCP
servers alone added ~30k tokens to every call.

## Realistic requests on your library (v4)

This answers a different question: on what people actually type, against your
real library, are the choices reasonable, and do agents use them? There are no
gold labels; a frontier model judges.

```bash
# seeds: data/seeds.jsonl (315 requests written by Codex without seeing any library)
npx tsx bench/expand.ts bench/data/seeds.jsonl          # Sonnet expands each into a detailed prompt (~$3 of Claude usage)
npx tsx bench/sweep.ts                                  # route all 315 through your library (~$0.34 of Jev), stores raw answers
npx tsx bench/judge.ts bench/results/<sweep>            # Opus: blind pass, then adjudicates disagreements (~$5 first time)
npx tsx bench/judge.ts bench/results/<sweep2> --blind-from bench/results/<sweep>   # re-run after a change: adjudication only
npx tsx bench/invoke.ts bench/results/<sweep> --agent claude|codex --mode routed|search --ids a,b,c
```

- `judge.ts` writes `report.md` next to the decisions, with overall and
  per-category numbers and every miss.
- Run the judge sequentially (`--concurrency 1`), so the catalog prompt stays
  cached: about $0.10 per 20-request batch instead of $0.90.
- `invoke.ts` runs the real agents headless, which takes minutes per request
  and uses your subscriptions.
