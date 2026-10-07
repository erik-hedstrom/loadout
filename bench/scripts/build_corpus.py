"""Build the benchmark skill corpus.

1. Fetch the most-installed skills from the skills.sh leaderboard (the
   "what people install today" baseline) -> bench/data/popular.jsonl.
2. From GitSkills (https://huggingface.co/datasets/mvaccargiu/gitskills), read
   only metadata columns over HTTP, keep one skill per name (the copy in the
   most-starred non-fork repo), drop templates and junk, cap each repo at
   PER_REPO skills so skill-farm repos cannot dominate, and take the top N by
   repo stars. Popular skills are forced in, replacing same-named rows.
   -> bench/data/corpus.jsonl

    uv run --with duckdb --with pyyaml bench/scripts/build_corpus.py [N]
"""
import json
import sys
import urllib.request
from pathlib import Path

import duckdb
import yaml

N = int(sys.argv[1]) if len(sys.argv) > 1 else 20_000
PER_REPO = 150
POPULAR = 100
DATA = Path(__file__).resolve().parents[1] / "data"
A = "hf://datasets/mvaccargiu/gitskills/data/artifacts/*.parquet"
R = "hf://datasets/mvaccargiu/gitskills/data/repos/*.parquet"


def fetch_popular(n: int) -> list[dict]:
    skills, page = [], 0
    while len(skills) < n:
        req = urllib.request.Request(f"https://skills.sh/api/skills/all-time/{page}", headers={"User-Agent": "loadout-bench"})
        with urllib.request.urlopen(req, timeout=30) as res:
            batch = json.load(res)["skills"]
        if not batch:
            break
        skills += batch
        page += 1
    return [{"source": s["source"], "name": s["skillId"], "installs": s["installs"], "popularity": i + 1}
            for i, s in enumerate(skills[:n])]


con = duckdb.connect()
con.sql("INSTALL httpfs; LOAD httpfs;")

# 1. Popular skills, with descriptions looked up in GitSkills. Only the
#    representative copy of each content hash carries front matter, so join
#    occurrences in the source repo to their representative by file hash.
popular = fetch_popular(POPULAR)
con.execute("CREATE TABLE pop(source VARCHAR, name VARCHAR, installs BIGINT, popularity INT)")
con.executemany("INSERT INTO pop VALUES (?, ?, ?, ?)", [(p["source"], p["name"], p["installs"], p["popularity"]) for p in popular])
found = con.sql(f"""
WITH occ AS (
  SELECT a.repo_full_name AS repo, a.path, a.file_sha, pop.name AS want, pop.installs, pop.popularity
  FROM '{A}' a JOIN pop ON lower(a.repo_full_name) = lower(pop.source)
  WHERE a.filename = 'SKILL.md' AND a.path LIKE '%' || pop.name || '/SKILL.md'
),
rep AS (SELECT file_sha, trim(name) AS name, regexp_replace(trim(description), '\\s+', ' ', 'g') AS description
        FROM '{A}' WHERE dedup_primary = 1 AND frontmatter_valid = 1)
SELECT DISTINCT ON (occ.want) occ.repo, occ.path, occ.want, rep.description, r.stars, occ.installs, occ.popularity
FROM occ JOIN rep USING (file_sha) JOIN '{R}' r ON r.full_name = occ.repo
WHERE length(rep.description) >= 20
ORDER BY occ.want, length(occ.path)
""").fetchall()
popular_rows = [{"name": want, "description": desc, "repo": repo, "path": path, "stars": stars, "installs": installs, "popularity": pop}
                for repo, path, want, desc, stars, installs, pop in found]

# GitSkills is a July 2026 snapshot; fetch newer popular skills from GitHub directly.
missing = [p for p in popular if p["name"] not in {r["name"] for r in popular_rows}]
trees: dict[str, list[str]] = {}
for p in missing:
    try:
        if p["source"] not in trees:
            req = urllib.request.Request(f"https://api.github.com/repos/{p['source']}/git/trees/HEAD?recursive=1",
                                         headers={"User-Agent": "loadout-bench", "Accept": "application/vnd.github+json"})
            with urllib.request.urlopen(req, timeout=30) as res:
                trees[p["source"]] = [t["path"] for t in json.load(res)["tree"] if t["path"].endswith("SKILL.md")]
        paths = sorted((t for t in trees[p["source"]] if t.endswith(f"{p['name']}/SKILL.md")), key=len)
        if not paths:
            continue
        with urllib.request.urlopen(f"https://raw.githubusercontent.com/{p['source']}/HEAD/{paths[0]}", timeout=30) as res:
            text = res.read().decode("utf-8", "replace")
        meta = yaml.safe_load(text.split("---")[1]) if text.startswith("---") else {}
        desc = " ".join(str(meta.get("description", "")).split())
        if len(desc) >= 20:
            popular_rows.append({"name": p["name"], "description": desc, "repo": p["source"], "path": paths[0], "stars": 0,
                                 "installs": p["installs"], "popularity": p["popularity"]})
    except Exception as e:  # rate limits, renamed repos: skip, the arm just has fewer skills
        print(f"  skip {p['source']}/{p['name']}: {e}", file=sys.stderr)
popular_rows.sort(key=lambda r: r["popularity"])
with (DATA / "popular.jsonl").open("w") as f:
    for row in popular_rows:
        f.write(json.dumps(row) + "\n")
print(f"popular: {len(popular_rows)}/{len(popular)} skills.sh top skills resolved (GitSkills, then GitHub)")

# 2. Long-tail corpus.
rows = con.sql(f"""
WITH skills AS (
  SELECT a.repo_full_name AS repo, a.path, trim(a.name) AS name,
         regexp_replace(trim(a.description), '\\s+', ' ', 'g') AS description,
         a.body_chars, r.stars
  FROM '{A}' a JOIN '{R}' r ON r.full_name = a.repo_full_name
  WHERE a.dedup_primary = 1 AND a.frontmatter_valid = 1 AND r.is_fork = 0
    AND a.filename = 'SKILL.md'
    AND length(trim(a.description)) BETWEEN 40 AND 1024
    AND regexp_matches(trim(a.name), '^[a-z0-9][a-z0-9-]{{1,63}}$')
    AND lower(a.name) NOT IN ('skill-name', 'my-skill', 'example', 'example-skill', 'template',
                              'template-skill', 'your-skill-name', 'test', 'test-skill', 'hello-world')
    AND NOT regexp_matches(lower(a.description),
        '(describe what this skill|replace with|todo:|lorem ipsum|\\[description\\]|your description here)')
),
ranked AS (
  SELECT *, row_number() OVER (PARTITION BY name ORDER BY stars DESC, body_chars DESC) AS k
  FROM skills
),
capped AS (
  SELECT *, row_number() OVER (PARTITION BY repo ORDER BY body_chars DESC, name) AS j
  FROM ranked WHERE k = 1
)
SELECT repo, path, name, description, stars
FROM capped WHERE j <= {PER_REPO}
ORDER BY stars DESC, name
LIMIT {N}
""").fetchall()

popular_names = {r["name"] for r in popular_rows}
corpus = [{"name": r["name"], "description": r["description"], "repo": r["repo"], "path": r["path"], "stars": r["stars"]}
          for r in popular_rows]
corpus += [{"name": name, "description": desc, "repo": repo, "path": path, "stars": stars}
           for repo, path, name, desc, stars in rows if name not in popular_names]
corpus = sorted(corpus[:N], key=lambda r: (-r["stars"], r["name"]))

with (DATA / "corpus.jsonl").open("w") as f:
    for rank, row in enumerate(corpus, 1):
        f.write(json.dumps({"id": f"skill:{row['name']}", **row, "rank": rank}) + "\n")
print(f"corpus: {len(corpus)} skills from {len({r['repo'] for r in corpus})} repos")
