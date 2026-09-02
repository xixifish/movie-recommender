import json, numpy as np
from pathlib import Path

DATA = Path(__file__).parent.parent / "data"
OUT =  Path(__file__).parent.parent / "app" / "public"
FIELDS = ["overview", "keywords", "reviews", "genres", "tagline", "cast", "director"]

rows = json.loads((DATA / "texts.json").read_text())

# Calculate quality percentile rank
votes = np.array([r["vote_count"] for r in rows], float)
rating = np.array([r["vote_average"] for r in rows], float)
pct = lambda a: a.argsort().argsort() / (len(a) - 1)
quality = (pct(votes) + pct(rating)) / 2

films = [{"id": r["id"], "t": r["title"], "y": r["year"], "p": r["poster"],
          "q": round(float(quality[i]), 4)} for i, r in enumerate(rows)]

masks = {f: "".join("1" if r[f] else "0" for r in rows) for f in FIELDS}

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "films.json").write_text(json.dumps(
    {"fields": FIELDS, "films": films, "masks": masks}))

blocks = [np.load(DATA / f"vec_{f}.npy").astype(np.float32) for f in FIELDS]
np.concatenate(blocks).tofile(OUT / "vectors.bin")

print(f"{len(films)} films, {(OUT/'vectors.bin').stat().st_size/1e6:.0f}MB")
