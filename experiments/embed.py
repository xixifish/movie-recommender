"""
Build the working text file, then embed each field.

Job 1: read the raw fetch, cut each field to size, save data/texts.json
Job 2: embed each field, save data/vec_<field>.npy

Usage:
    uv run experiments/embed.py

To redo a field: delete data/texts.json and that field's .npy, then run again.
"""

import json
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

DATA = Path(__file__).parent.parent / "data"
RAW = DATA / "movies.jsonl"
TEXTS = DATA / "texts.json"

MODEL = "all-MiniLM-L6-v2"

CAST_N = 6           # how many actors
KEYWORD_N = 10       # how many keywords
REVIEW_N = 3         # how many reviews
REVIEW_CHARS = 300   # characters kept from each review

# --- one getter per field ---

def overview(m):
    return m.get("overview") or ""


def tagline(m):
    return m.get("tagline") or ""


def genres(m):
    return ", ".join(g["name"] for g in m.get("genres", []))


def keywords(m):
    kw = (m.get("keywords") or {}).get("keywords", [])
    return ", ".join(k["name"] for k in kw[:KEYWORD_N])


def cast(m):
    people = (m.get("credits") or {}).get("cast", [])
    return ", ".join(c["name"] for c in people[:CAST_N])


def director(m):
    crew = (m.get("credits") or {}).get("crew", [])
    names = [c["name"] for c in crew if c.get("job") == "Director"]
    return ", ".join(dict.fromkeys(names))   # dedupe, keep order


def reviews(m):
    found = (m.get("reviews") or {}).get("results", [])
    return " ".join(r["content"][:REVIEW_CHARS] for r in found[:REVIEW_N])


FIELDS = {
    "overview": overview,
    "tagline": tagline,
    "genres": genres,
    "keywords": keywords,
    "cast": cast,
    "director": director,
    "reviews": reviews,
}

# --- job 1: build the texts file ---

def load_raw():
    """One film per line."""
    with open(RAW) as f:
        return [json.loads(line) for line in f if line.strip()]


def build_texts():
    print(f"reading {RAW.name} ...")
    movies = load_raw()

    rows = []
    for m in movies:
        row = {
            "id": m["id"],
            "title": m.get("title") or "",
            "year": (m.get("release_date") or "")[:4],
            "poster": m.get("poster_path") or "",
        }
        for name, getter in FIELDS.items():
            row[name] = getter(m)
        rows.append(row)

    TEXTS.write_text(json.dumps(rows))
    size = TEXTS.stat().st_size / 1_000_000
    print(f"wrote {TEXTS.name}: {len(rows)} films, {size:.1f}MB\n")
    return rows

# --- job 2: embed each field ---

def embed(rows):
    model = None   # load it only if something actually needs embedding

    for name in FIELDS:
        out = DATA / f"vec_{name}.npy"
        if out.exists():
            print(f"{name:10} already done, skipping")
            continue

        if model is None:
            print(f"loading {MODEL} ...")
            model = SentenceTransformer(MODEL)

        texts = [r[name] for r in rows]
        print(f"{name:10} embedding {len(texts)} texts ...")

        vectors = model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=True,
            batch_size=64,
        )
        np.save(out, vectors)

        empty = sum(1 for t in texts if not t)
        print(f"{name:10} saved {vectors.shape}, {empty} empty texts\n")


if __name__ == "__main__":
    if TEXTS.exists():
        print(f"{TEXTS.name} exists, reusing it")
        rows = json.loads(TEXTS.read_text())
    else:
        rows = build_texts()

    embed(rows)
    print("done")