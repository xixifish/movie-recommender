"""
Fetch 5,000 movies from TMDB. Saves one film per line to movies.jsonl.

Safe to stop and re-run. Films already in the file are skipped, so a crash
or a lost connection costs only the films it had not reached yet.

Usage:
    uv run experiments/fetch.py
"""
import json
import os
import time

import requests

from pathlib import Path

from dotenv import load_dotenv
load_dotenv() # Reads the `.env` file and puts the values into `os.environ`

TOKEN = os.environ["TMDB_TOKEN"]
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
BASE = "https://api.themoviedb.org/3"

PAGES = 250      # 20 movies per page, so 250 pages -> 5,000 movies
DELAY = 0.15     # 6 or 7 requests per second, well under the 40/sec limit

OUT = Path(__file__).parent.parent / "data" / "movies.jsonl"


def get(url, params=None):
    """GET with a retry on 429 (means too many requests)."""
    for _ in range(3):
        r = requests.get(url, headers=HEADERS, params=params, timeout=20)
        if r.status_code == 429:
            # `r.headers.get()` looks for a header called `Retry-After`
            # If it's there, use its value
            # If it's missing, use `5` instead
            wait = int(r.headers.get("Retry-After", 5))
            print(f"rate limited, waiting {wait}s")
            time.sleep(wait)
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError(f"failed after retries: {url}")


def get_ids():
    """The 5,000 most voted film ids, in order."""
    ids = []
    for page in range(1, PAGES + 1):
        data = get(f"{BASE}/discover/movie", {
            # Find the movies with votes greater or equal to 200
            "vote_count.gte": 200,
            "sort_by": "vote_count.desc",
            "include_adult": "false",
            "language": "en-US",
            "page": page,
        })
        if not data["results"]:
            print("No more results")
            break
        ids += [m["id"] for m in data["results"]]
        print(f"page {page}: {len(ids)} ids so far")
        time.sleep(DELAY)
    return ids


def already_have():
    """Ids already in the file, so a re-run picks up where it stopped."""
    if not OUT.exists():
        return set()
    done = set()
    with open(OUT) as f:
        for line in f:
            if line.strip():
                done.add(json.loads(line)["id"])
    print(f"{len(done)} films already fetched, skipping those")
    return done


def fetch_details(ids, done):
    """Fetch each film and append it as its own line.

    `append_to_response` bundles keywords, credits and reviews into one request.
    No spaces. A space breaks it silently and drops the fields after it.
    """
    todo = [i for i in ids if i not in done]
    print(f"{len(todo)} films to fetch\n")

    # Append mode. One line per film, so nothing already written is rewritten.
    with open(OUT, "a") as f:
        for i, movie_id in enumerate(todo, 1):
            detail = get(f"{BASE}/movie/{movie_id}", {
                "append_to_response": "keywords,credits,reviews",
                "language": "en-US",
            })
            f.write(json.dumps(detail) + "\n")
            f.flush()   # on disk now, so a crash loses nothing

            if i % 100 == 0:
                print(f"fetched {i}/{len(todo)}")

            time.sleep(DELAY)


if __name__ == "__main__":
    OUT.parent.mkdir(exist_ok=True)

    done = already_have()
    ids = get_ids()
    fetch_details(ids, done)

    total = sum(1 for line in open(OUT) if line.strip())
    print(f"\ndone. {total} movies in {OUT}")
