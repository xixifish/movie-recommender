"""
Fetch a few hundred popular movies from TMDB. 
Saves raw JSON to movies.json.

Usage: 
    Run once.
    python fetch.py
"""
import json
import os
import time

import requests

from dotenv import load_dotenv
load_dotenv() # Reads the `.env` file and puts the values into `os.environ`

TOKEN = os.environ["TMDB_TOKEN"]
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
BASE = "https://api.themoviedb.org/3"

PAGES = 250     # 20 movies per page -> 300 movies
DELAY = 0.15    # 6 or 7 requests per second, well under the 40/sec limit

def get(url, params=None):
    """GET with a retry on 429."""
    for attempt in range(3):
        r = requests.get(url, headers=HEADERS, params=params, timeout=20)
        if r.status_code == 429:
            # `get()` looks for a header called `Retry-After`
            # If it's there, use its value
            # If it's missing, use `5` instead
            wait = int(r.headers.get("Retry-After", 5))
            print(f"rate limited, waiting {wait}s")
            time.sleep(wait)
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError(f"failed after retries: {url}")        

# 1. Get the list of movie IDs
ids = []
for page in range(1, PAGES + 1):
    data = get(f"{BASE}/discover/movie", {
        "vote_count.gte": 200,
        "sort_by": "vote_count.desc",
        "include_adult": "false",
        "language": "en-US",
        "page": page,
    })
    if not data["results"]:
        print("no more results")
        break
    ids += [m["id"] for m in data["results"]]
    print(f"page {page}: {len(ids)} ids so far")
    time.sleep(DELAY)

# 2. Get the full details for each movie
# `append_to_response` bundles keywords + credits into the same request
movies = []
for i, movie_id in enumerate(ids, 1):
    detail = get(f"{BASE}/movie/{movie_id}", {
        "append_to_response": "keywords, credits",
        "language": "en-US",
    })
    movies.append(detail)

    if i % 25 == 0:
        print(f"fetched {i}/{len(ids)}")
        # Save some details, not wait until finish collecting all
        with open("movies.json", "w") as f:
            json.dump(movies, f)

    time.sleep(DELAY)

with open("movies.json", "w") as f:
    json.dump(movies, f)

print(f"\ndone. {len(movies)} movies saved to movies.json")