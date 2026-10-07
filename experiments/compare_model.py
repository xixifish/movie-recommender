"""
Compare the full model with the 23MB quantised one.

The film vectors stay the same. Only the model that embeded the query changes.
Runs the 17 queries through both and reports how much the top 10 lists agree.

Run:
    uv run experiments/compare_model.py
"""

import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from fields import FIELDS
from tokenizers import Tokenizer

HERE = Path(__file__).parent
DATA = HERE.parent / "data"

TOP_N = 10
W_FALLBACK = [0.38, 0.24, 0.14, 0.09, 0.05, 0.05, 0.05]
TEMPERATURE = 0.1
BLEND = 0.8
QUALITY = 0.5

# --- The two models ---
tokenizer = Tokenizer.from_file(str(DATA / "tokenizer.json"))
# Turn off the padding behaviour of the tokenizer because transformers.js does not pad
tokenizer.no_padding()
session_full = ort.InferenceSession(str(DATA / "model.onnx"))
session_small = ort.InferenceSession(str(DATA / "model_quantized.onnx"))

pca = json.loads((DATA / "pca.json").read_text())
matrix = np.array(pca["matrix"], dtype=np.float32).T

# --- The films, as the app sees them ---
rows = json.loads((DATA / "texts.json").read_text())
n = len(rows)
masks = {f: np.array([bool(r[f]) for r in rows]) for f in FIELDS}

pct = lambda a: a.argsort().argsort() / (len(a) - 1)
quality = (
    pct(np.array([r["vote_count"] for r in rows], float))
    + pct(np.array([r["vote_average"] for r in rows], float))
) / 2
back = {
    f: np.load(DATA / f"vec_{f}_i8.npy").astype(np.float32) * pca["scale"] / 127
    for f in FIELDS
}


def embed(session, text):
    """Mean pool over the real tokens, normalise, then shrink with the PCA."""
    enc = tokenizer.encode(text)
    ids = np.array([enc.ids], dtype=np.int64)
    mask = np.array([enc.attention_mask], dtype=np.int64)

    out = session.run(
        None,
        {
            "input_ids": ids,
            "attention_mask": mask,
            "token_type_ids": np.zeros_like(ids),
        },
    )[0]

    m = mask[..., None].astype(np.float32)
    v = (out * m).sum(1) / m.sum(1)
    v = v[0] / np.linalg.norm(v[0])

    v = v @ matrix
    return v / np.linalg.norm(v)


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
    # Turn the seven confidences into seven weights that add up to 1
    e = np.exp((confs - confs.max()) / TEMPERATURE)
    # Calculate the final weights for each field combined with fallback weights
    w = BLEND * (e / e.sum()) + (1 - BLEND) * np.array(W_FALLBACK)

    num = np.zeros(n)
    den = np.zeros(n)
    for i, f in enumerate(FIELDS):
        num += np.where(masks[f], w[i] * sims[f], 0)  # this field's contribution
        den += np.where(masks[f], w[i], 0)  # this field's share of the total
    score = (num / np.maximum(den, 1e-9)) * (1 + QUALITY * quality)
    return list(np.argsort(score)[::-1][:TOP_N])


# --- compare ---
queries = [q for q in (HERE / "queries.txt").read_text().splitlines() if q.strip()]

print(f"\n{'query':44} {'closeness':>10} {'same films':>11} {'same order':>11}")
same_films = same_order = 0
lowest = 1.0
for query in queries:
    full = embed(session_full, query)
    small = embed(session_small, query)
    before = rank(back, full)
    after = rank(back, small)

    close = float(full @ small)
    overlap = len(set(before) & set(after))
    exact = sum(1 for a, b in zip(before, after) if a == b)

    lowest = min(lowest, close)
    same_films += overlap
    same_order += exact
    print(f"{query[:44]:44} {close:10.4f} {overlap:8}/10 {exact:8}/10")

total = len(queries) * TOP_N
print(f"\nlowest closeness: {lowest:.4f}")
print(f"same films: {same_films}/{total} ({same_films / total * 100:.0f}%)")
print(f"same order: {same_order}/{total} ({same_order / total * 100:.0f}%)")
