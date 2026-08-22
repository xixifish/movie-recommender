"""
Embed the movies and search them. 
This is the test. Does "makes me cry" return sensible films?

Usage: 
    python search.py
"""

import json

import numpy as np
from sentence_transformers import SentenceTransformer

def build_text(m):
    genres = ", ".join(g["name"] for g in m.get("genres", []))
    tagline = m.get("tagline") or ""
    overview = m.get("overview") or ""
    # title = m.get("title") or ""

    keywords = ", ".join(
        k["name"] for k in m.get("keywords", {}).get("keywords", [])[:10]
    )

    cast = ", ".join(
        c["name"] for c in m.get("credits", {}).get("cast", [])[:4]
    )

    return (
        f"{genres}. "
        f"{tagline} "
        f"{overview} "
        f"Starring {cast}. "
        f"Keywords: {keywords}."
        # f"{title}."
    )

# Load and build
movies = json.load(open("movies.json"))
texts = [build_text(m) for m in movies]

print("first movie's text blob:\n")
print(texts[0])
print("\n" + "-" * 60 + "\n")

have = sum(1 for m in movies if m.get("tagline"))
print(f"{have}/{len(movies)} have taglines")

# Embed
model = SentenceTransformer("all-mpnet-base-v2")

print(f"embedding {len(texts)} movies...")
vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
# `normalize_embeddings=True` means cosine similarity is just a dot product

# Search
def search(query, top_n=10):
    # Generate vector of query
    q = model.encode([query], normalize_embeddings=True)[0]
    # Calcuate similarity
    scores = vectors @ q
    # Get the best top_n
    best = np.argsort(-scores)[:top_n]

    for rank, i in enumerate(best, 1):
        m = movies[i]
        year = (m.get("release_date") or "----")[:4]
        print(f"{rank:2}. {scores[i]:.3f} {m["title"]} ({year})")

print("\nType a search. Empty line quits.\n")
print("Try: makes me cry / underrated sci-fi / something funny and short\n")

while True:
    try:
        query = input("> ").strip()
    except (EOFError, KeyboardInterrupt):
        break
    if not query:
        break
    search(query)
    print()
