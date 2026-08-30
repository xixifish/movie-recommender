"""
Search the movies. Weighted sum over per-field vectors.

The weights are chosen per query: each field's confidence is the gap between
its top results and its own median, softmaxed into weights.

Usage:
    uv run experiments/search.py          type queries, empty line quits
    uv run experiments/search.py --all    run queries.txt, save to results/
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

HERE = Path(__file__).parent
DATA = HERE.parent / "data"
RESULTS = HERE / "results"

MODEL = "all-MiniLM-L6-v2"
TOP_N = 10

# Guessed weights
WEIGHTS = {
    "overview": 0.38,
    "keywords": 0.24,
    "reviews":  0.14,
    "genres":   0.09,
    "tagline":  0.05,
    "cast":     0.05,
    "director": 0.05,
}


# --- load once ---
print("loading ...")
rows = json.loads((DATA / "texts.json").read_text())
n = len(rows)


vectors = {}
masks = {}  # For knowing which field is empty
for name in WEIGHTS:
    vectors[name] = np.load(DATA / f"vec_{name}.npy")
    masks[name] = np.array([bool(r[name]) for r in rows])   # does the film has this text?

model = SentenceTransformer(MODEL)
print(f"{n} films, {len(WEIGHTS)} fields\n")


# --- scoring ---
FIELDS = list(WEIGHTS)          # WEIGHTS is the manual fallback, blended in below
TEMPERATURE = 0.1               # lower = winner takes more
BLEND = 0.8                     # how much to trust the automatic weights


def field_sims(query):
    """Cosine scores for every field. Empty text is pushed to -1."""
    q = model.encode([query], normalize_embeddings=True)[0]
    return {
        # If a film has no text in this field, then -1.0 replaces its dot product
        name: np.where(masks[name], vectors[name] @ q, -1.0)
        for name in FIELDS
    }


def confidence(sims, k=10):
    """How far does this field's top stand out from its own spread?"""
    valid = sims[sims > -1.0]
    top = np.sort(valid)[-k:].mean()
    return top - np.median(valid)


def auto_weights(sims_by_field):
    z = np.array([confidence(sims_by_field[n]) for n in FIELDS])
    e = np.exp((z - z.max()) / TEMPERATURE)
    auto = e / e.sum()

    manual = np.array([WEIGHTS[n] for n in FIELDS])
    mixed = BLEND * auto + (1 - BLEND) * manual
    return dict(zip(FIELDS, mixed)), dict(zip(FIELDS, z))


def score_all(query):
    """Returns (scores, weights, confidence). The weights change per query,
    and the caller decides where they go."""
    sims = field_sims(query)
    weights, conf = auto_weights(sims)

    total = np.zeros(n)
    weight_used = np.zeros(n)
    for name in FIELDS:
        w = weights[name]
        present = masks[name]
        total += w * np.where(present, sims[name], 0.0) * present
        weight_used += w * present

    return total / np.maximum(weight_used, 1e-9), weights, conf


def show(query, k=TOP_N):
    """The weight table and the ranked list, as one block of text."""
    scores, weights, conf = score_all(query)

    lines = ["  field       conf   weight"]
    for name in FIELDS:
        lines.append(f"  {name:10} {conf[name]:6.3f}  {weights[name]:.3f}")
    lines.append(f"  best field confidence: {max(conf.values()):.3f}")
    lines.append("")

    for rank, i in enumerate(np.argsort(-scores)[:k], 1):
        lines.append(f"{rank:2}. {scores[i]:.3f}  {rows[i]['title']} ({rows[i]['year']})")

    return "\n".join(lines)


# --- mode 1: type a query ---

def interactive():
    print("Type a query. Empty line quits.\n")
    while True:
        try:
            query = input("> ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not query:
            break
        print(show(query))
        print()


# --- mode 2: run the whole list ---

def run_all():
    queries = [
        line.strip()
        for line in (HERE / "queries.txt").read_text().splitlines()
        if line.strip()
    ]

    RESULTS.mkdir(exist_ok=True)
    stamp = f"{datetime.now():%Y-%m-%d-%H%M}"
    out = RESULTS / f"run-{stamp}.md"

    # The real weights change per query, so they sit under each query below.
    # These are the settings that produced them.
    parts = [
        f"# Run {stamp}", "",
        "Settings:", "```",
        f"model        {MODEL}",
        f"temperature  {TEMPERATURE}",
        f"blend        {BLEND}",
        "fallback     " + ", ".join(f"{k} {v}" for k, v in WEIGHTS.items()),
        "```", "",
    ]

    for query in queries:
        print(f"  {query}")
        parts += [f"## {query}", "", "```", show(query), "```", "",
                  "score:  /10", "must appear:", "notes:", ""]

    out.write_text("\n".join(parts))
    print(f"\nwrote {out}")


if __name__ == "__main__":
    if "--all" in sys.argv:
        run_all()
    else:
        interactive()