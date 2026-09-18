"""
Pick the films shown before the user searches. 

Not the most voted (since the most voted films have many similar ones), which 
gives 17 action films from 2009. This default film list should include the films 
unlike each other, so the user could have better chance to find some to mark, 
and the first refresh could learn something. 

Write `data/default.json`, a list of 250 catalogue indices, in order. `export.py` 
reads it. Kept separate so tuning does not rewrite vectors.bin. 

Usage:
    uv run experiments/default_list.py
"""
import json
from collections import Counter
from pathlib import Path

import numpy as np

DATA = Path(__file__).parent.parent / "data"

K = 240 # 5 screens of 48
SCREEN = 48
MIN_RATING = 7.0
VOTE_OLD = 3000 # older films have more years to collect votes
VOTE_NEW = 1500 # newer films have not
V = np.load(DATA / "vec_overview.npy").astype(np.float32)
V /= np.linalg.norm(V, axis=1, keepdims=True)

rows = json.loads((DATA / "texts.json").read_text())

def allowed(r):
    """Known enough to recognise, good enough to want."""
    floor = VOTE_NEW if int(r["year"]) >= 2020 else VOTE_OLD
    return r["vote_count"] >= floor and r["vote_average"] >= MIN_RATING

pool = [i for i, r in enumerate(rows) if allowed(r)]
pos = {p:n for n, p in enumerate(pool)}
P = V[pool]
print(f"Pool: {len(pool)} films, {len(set(rows[i]['director'] for i in pool))} directors")

chosen = [0] # Start from the most voted film
picked = {0} # chosen set, to improve the "in" checking (checking in set is instant, but array is not)
dirs = {rows[pool[0]]["director"]} # a set
sim = P @ P[0] # how close each film is to anything chosen

while len(chosen) < K:
    best, best_sim = None, 9.0 # cosine similarity between normalised vectors is [-1, 1]
    for n, p in enumerate(pool):
        if n in picked or rows[p]["director"] in dirs:
            continue
        if sim[n] < best_sim: # larger cosine similarity means more similar
            best, best_sim = n, sim[n]
    if best is None:
        print(f"ran out of films at {len(chosen)}")
        break
    chosen.append(best)
    picked.add(best)
    dirs.add(rows[pool[best]]["director"])
    sim = np.maximum(sim, P @ P[best])

default = [pool[n] for n in chosen]
(DATA / "default.json").write_text(json.dumps(default))
print(f"wrote {len(default)} films to data/default.json\n")

# what each screen looks like
for s in range(0, len(default), SCREEN):
    screen = [rows[i] for i in default[s: s + SCREEN]]
    yrs = [int(r["year"]) for r in screen]
    g = Counter(x for r in screen for x in r["genres"].split(", "))
    print(f"screen {s // SCREEN + 1}: median year {int(np.median(yrs))}, "
          f"since 2020: {sum(1 for y in yrs if y >= 2020)}, "
          f"top genres {g.most_common(3)}")

print("\nfirst 20:")
for n, i in enumerate(default[:20], 1):
    r = rows[i]
    print(f"{n:3}. {r['title'][:34]:34} {r['year']} {r['vote_average']:.1f} {r['genres'][:30]}")
