"""Create explicitly synthetic inputs once; refuse to overwrite existing files."""
import csv
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path


def main():
    paths = [Path("synthetic_ab_test.csv"), Path("synthetic_design.json")]
    if any(path.exists() for path in paths):
        raise FileExistsError("Synthetic inputs already exist; nothing overwritten")
    rng = random.Random(20261007)
    start = datetime(2026, 9, 14, tzinfo=timezone.utc)
    rows = []
    # Fixed totals make a compact, reproducible illustrative case, not a power simulation.
    for variant, conversions in [("A", 50), ("B", 65)]:
        outcomes = [1]*conversions + [0]*(500-conversions)
        rng.shuffle(outcomes)
        for index, converted in enumerate(outcomes):
            assigned = start + timedelta(days=index%14, seconds=rng.randrange(86400))
            rows.append({"user_id": f"synthetic_{variant}_{index:04d}", "variant": variant,
                         "converted": converted, "assigned_at": assigned.isoformat(),
                         "observed_at": (assigned+timedelta(hours=24)).isoformat()})
    rows.sort(key=lambda row: row["assigned_at"])
    with paths[0].open("x", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    design = {"synthetic": True, "seed": 20261007, "unit": "independent user",
              "primary_metric": "conversion within 24 hours of assignment",
              "expected_allocation": {"A": 0.5, "B": 0.5}, "alpha": 0.05,
              "target_power": 0.80, "planning_baseline": 0.10,
              "minimum_effect_absolute": 0.02, "outcome_window_hours": 24,
              "enrollment_start": start.isoformat(),
              "enrollment_end_exclusive": (start+timedelta(days=14)).isoformat(),
              "export_cutoff": (start+timedelta(days=15)).isoformat(),
              "stopping_rule": "illustrative fixed export; real stopping history unknown"}
    with paths[1].open("x") as stream:
        stream.write(json.dumps(design, indent=2)+"\n")
    print("Created 1,000 synthetic users and explicit design metadata.")


if __name__ == "__main__":
    main()
