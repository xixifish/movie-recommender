"""
Shrink the vectors for the browser, and measure what it costs.

Two compressions:
    384 floats -> 128 floats PCA, keeps the directions of the vectors
    128 floats -> 128 int8   one byte each instead of four

Compress the size but loses information, so this needs to run the 17 queries 
before and after and reports how much the top 10 lists agree.

Writes:
    data/pca.json: the mean and thee 384 x 128 metrix, for export and the server
    data/vec_<field>_i8.npy: seven quantised field sets

Usage:
    uv run experiments/shrink.py
"""
import json
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

HERE = Path(__file__).parent
DATA = HERE.parent / "data"

MODEL = "all-MiniLM-L6-v2"
DIMS = 192
TOP_N = 10

FIELDS = ["overview", "keywords", "reviews", "genres", "tagline", "cast", "director"]
W_FALLBACK = [0.38, 0.24, 0.14, 0.09, 0.05, 0.05, 0.05]
TEMPERATURE = 0.1
BLEND = 0.8
QUALITY = 0.5

# --- load once ---
print("loading ...")
rows = json.loads((DATA / "texts.json").read_text())
n = len(rows)

full_vectors = {}
masks = {}  # For knowing which field is empty
for name in FIELDS:
    full_vectors[name] = np.load(DATA / f"vec_{name}.npy").astype(np.float32)
    full_vectors[name] /= np.linalg.norm(full_vectors[name], axis=1, keepdims=True)
    masks[name] = np.array([bool(r[name]) for r in rows])

pct = lambda a: a.argsort().argsort() / (len(a) - 1)
quality = (
    pct(np.array([r["vote_count"] for r in rows], float)) + pct(np.array([r["vote_average"] for r in rows], float))
) / 2

# -- fit the PCA on every vector from every field --
stacked = np.concatenate([full_vectors[f] for f in FIELDS])

# eigenvectors of the covariance, largest first. Faster than an SVD of 35,000 rows.
g = (stacked.T @ stacked) / len(stacked)
vals, vecs = np.linalg.eigh(g)
order = vals.argsort()[::-1]
matrix = vecs[:, order[:DIMS]].astype(np.float32) # 384 x 128
kept = vals[order[:DIMS]].sum() / vals.sum()
print(f"PCA {stacked.shape[1]} -> {DIMS} dims, keeps {kept * 100:.1f}% of the variation")

def shrink(v):
    """384 floats to 128, the same way for films and for the query."""
    out = v @ matrix
    return out / np.linalg.norm(out, axis=-1, keepdims=True)

small = {f: shrink(full_vectors[f]) for f in FIELDS}

# --- quantise to int8 ---

scale = float(max(np.abs(small[f]).max() for f in FIELDS))
q8 = {f: np.round(small[f] * 127 / scale).astype(np.int8) for f in FIELDS}
back = {f: q8[f].astype(np.float32) * scale / 127 for f in FIELDS}
print(f"int8 scale {scale:.4f}")


# --- scoring, the same as search.py ---

def rank(sets, q):
    """Top TOP_N film indices for one query vector."""
    sims, confs = {}, []
    for f in FIELDS:
        s = np.where(masks[f], sets[f] @ q, -1.0)
        sims[f] = s
        valid = s[masks[f]]
        confs.append(np.sort(valid)[::-1][:10].mean() - np.median(valid))
    confs = np.array(confs)
    e = np.exp((confs - confs.max()) / TEMPERATURE)
    w = BLEND * (e / e.sum()) + (1 - BLEND) * np.array(W_FALLBACK)

    num = np.zeros(n)
    den = np.zeros(n)
    for i, f in enumerate(FIELDS):
        num += np.where(masks[f], w[i] * sims[f], 0)
        den += np.where(masks[f], w[i], 0)
    score = (num / np.maximum(den, 1e-9)) * (1 + QUALITY * quality)
    return list(np.argsort(score)[::-1][:TOP_N])


# --- compare ---

model = SentenceTransformer(MODEL)
queries = [q for q in (HERE / "queries.txt").read_text().splitlines() if q.strip()]

print(f"\n{'query':44} {'same films':>11} {'same order':>11}")
same_films = same_order = 0
for query in queries:
    qv = model.encode([query], normalize_embeddings=True)[0]
    before = rank(full_vectors, qv)
    after = rank(back, shrink(qv))
    overlap = len(set(before) & set(after))
    exact = sum(1 for a, b in zip(before, after) if a == b)
    same_films += overlap
    same_order += exact
    print(f"{query[:44]:44} {overlap:8}/10 {exact:8}/10")

total = len(queries) * TOP_N
print(f"\nsame films: {same_films}/{total} ({same_films / total * 100:.0f}%)")
print(f"same order: {same_order}/{total} ({same_order / total * 100:.0f}%)")


# --- save ---

(DATA / "pca.json").write_text(json.dumps({
    "dims": DIMS,
    "scale": scale,
    "matrix": matrix.T.tolist(),      # 128 rows of 384, easier to read back
}))
for f in FIELDS:
    np.save(DATA / f"vec_{f}_i8.npy", q8[f])
print(f"\nwrote data/pca.json and 7 int8 field files")