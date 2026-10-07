"""Create a reproducible synthetic example; refuse to overwrite an existing file."""
import csv
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path


def main():
    rng = random.Random(20261007)
    assignments = ["A"] * 2000 + ["B"] * 2000
    rng.shuffle(assignments)
    converted = {
        "A": set(rng.sample(range(2000), 200)),
        "B": set(rng.sample(range(2000), 230)),
    }
    seen = {"A": 0, "B": 0}
    start = datetime(2026, 9, 14, tzinfo=timezone.utc)
    path = Path(__file__).with_name("synthetic_ab_test.csv")
    with path.open("x", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["user_id", "variant", "converted", "exposed_at"])
        for i, variant in enumerate(assignments):
            outcome = int(seen[variant] in converted[variant])
            seen[variant] += 1
            timestamp = start + timedelta(seconds=i * 14 * 86400 // 4000)
            writer.writerow([f"synthetic_user_{i:05d}", variant, outcome, timestamp.isoformat()])
    print(f"Created {path.name}: 4000 synthetic users; no real experiment data.")


if __name__ == "__main__":
    main()
