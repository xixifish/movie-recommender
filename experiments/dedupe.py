"""
Remove duplicate films. fetch.py collected id 1275779 twice, probably across a
page boundary when TMDB reordered between requests.

Deletes the row from texts.json and from all seven vec_<field>.npy, so the
index alignment holds. No re-embedding needed.

Then rerun: shrink.py, default_list.py, export.py

Usage:
    uv run experiments/dedupe.py
"""

import json
from pathlib import Path

import numpy as np

DATA = Path(__file__).parent.parent / "data"
FIELDS = ["overview", "keywords", "reviews", "genres", "tagline", "cast", "director"]

rows = json.loads((DATA / "texts.json").read_text())

seen, drop = set(), []
for i, r in enumerate(rows):
    if r["id"] in seen:
        drop.append(i)
        print(f"dropping row {i}: {r['title']} ({r['year']}), id {r['id']}")
    seen.add(r["id"])

if not drop:
    print("no duplicates")
    raise SystemExit

kept = [r for i, r in enumerate(rows) if i not in set(drop)]
(DATA / "texts.json").write_text(json.dumps(kept))

for f in FIELDS:
    path = DATA / f"vec_{f}.npy"
    v = np.load(path)
    np.save(path, np.delete(v, drop, axis=0))

print(f"{len(rows)} -> {len(kept)} films")