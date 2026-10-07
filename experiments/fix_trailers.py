"""
Fill in missing trailers by asking TMDB in each film's own language.

fetch.py asked with language=en-US, and for videos that is also a filter: only
English ones come back. So a film whose trailer is in Italian or French got none.

Changes only the `trailer` value in texts.json, so every row stays lined up with
its vectors. Do not rebuild texts.json from movies.jsonl instead: that file still
has the duplicate dedupe.py removed, and every row after it would shift by one.

Then run: export.py

Usage:
    uv run experiments/fix_trailers.py
"""

import json
import time
from pathlib import Path

from embed import trailer
from fetch import BASE, DELAY, get

DATA = Path(__file__).parent.parent / "data"
TEXTS = DATA / "texts.json"
RAW = DATA / "movies.jsonl"

rows = json.loads(TEXTS.read_text())

# texts.json has no language, so look it up in the raw fetch, by id
language = {}
with open(RAW) as f:
    for line in f:
        if line.strip():
            m = json.loads(line)
            language[m["id"]] = m.get("original_language") or "en"

missing = [r for r in rows if not r["trailer"]]
print(f"{len(missing)} films without a trailer\n")

filled = 0
for r in missing:
    lang = language[r["id"]]
    if lang == "en":
        continue  # already asked in English, nothing new to find

    videos = get(f"{BASE}/movie/{r['id']}/videos", {"language": lang})
    key = trailer({"videos": videos})  # same picking rules as embed.py
    if key:
        r["trailer"] = key
        filled += 1
        print(f"  {r['title']} ({lang}): {key}")
    time.sleep(DELAY)

TEXTS.write_text(json.dumps(rows))
print(f"\nfilled {filled} of {len(missing)}")
