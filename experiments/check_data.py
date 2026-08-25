"""
Look at the fetched movie data.
Prints coverage and text lengths. Saves nothing. 

Usage:
    uv run experiments/inspect.py
"""

import json
from pathlib import Path

PATH = Path(__file__).parent.parent / "data" / "movies.json"
LIMIT = 1000   # characters. MiniLM reads about 256 tokens, roughly this many

print(f"loading {PATH.name} ...")
movies = json.load(open(PATH))
n = len(movies)
print(f"{n} films\n")

# --- helpers ---

def have(getter):
    """How many films have a non-empty value."""
    return sum(1 for m in movies if getter(m))


def stats(values):
    """median, 90th, max."""
    values = sorted(values)
    return values[len(values) // 2], values[int(len(values) * 0.9)], values[-1]

# --- one getter per field ---

def overview(m):
    return m.get("overview") or ""


def tagline(m):
    return m.get("tagline") or ""


def genres(m):
    return ", ".join(g["name"] for g in m.get("genres", []))


def keywords(m):
    kw = (m.get("keywords") or {}).get("keywords", [])
    return ", ".join(k["name"] for k in kw)


def cast(m):
    people = (m.get("credits") or {}).get("cast", [])
    return ", ".join(c["name"] for c in people[:8])


def review_list(m):
    return [r["content"] for r in (m.get("reviews") or {}).get("results", [])]


def reviews(m):
    return " ".join(review_list(m))

FIELDS = {
    "overview": overview,
    "tagline": tagline,
    "genres": genres,
    "keywords": keywords,
    "cast (top 8)": cast,
    "reviews": reviews,
}

# --- coverage ---

print("COVERAGE")
for name, getter in FIELDS.items():
    c = have(getter)
    print(f"  {name:14} {c:5}/{n}  {c * 100 // n:3}%")


# --- text length ---

print(f"\nTEXT LENGTH (characters)")
print(f"  {'field':14} {'median':>7} {'90th':>7} {'max':>7} {'over 1000':>10}")
for name, getter in FIELDS.items():
    lengths = [len(getter(m)) for m in movies]
    med, p90, mx = stats(lengths)
    over = sum(1 for x in lengths if x > LIMIT)
    print(f"  {name:14} {med:7} {p90:7} {mx:7} {over:10}")


# --- reviews in detail ---

print("\nREVIEWS")
counts = [len(review_list(m)) for m in movies]
withr = [c for c in counts if c]
med, p90, mx = stats(withr)
print(f"  films with at least one: {len(withr)} ({len(withr) * 100 // n}%)")
print(f"  reviews per film:        median {med}, 90th {p90}, max {mx}")

each = [len(r) for m in movies for r in review_list(m)]
med, p90, mx = stats(each)
print(f"  one review, characters:  median {med}, 90th {p90}, max {mx}")


# --- cast in detail ---

print("\nCAST")
counts = [len((m.get("credits") or {}).get("cast", [])) for m in movies]
med, p90, mx = stats(counts)
print(f"  entries per film: median {med}, 90th {p90}, max {mx}")
print(f"  films with none:  {sum(1 for c in counts if c == 0)}")


# --- one film, to see the shape ---

print("\nSAMPLE (first film)")
m = movies[0]
print(f"  title: {m.get('title')}")
for name, getter in FIELDS.items():
    text = getter(m)
    cut = "..." if len(text) > 120 else ""
    print(f"  {name:14} {text[:120]}{cut}")