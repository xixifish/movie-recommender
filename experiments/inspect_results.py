"""
Show the top 10 for a query, with the facts needed to score it.

The film's genres, keywords and overview

Usage:
    uv run experiments/inspect_results.py "heist"
    uv run experiments/inspect_results.py --all
"""

import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import search   # noqa: E402  (loads the vectors and the model)

import numpy as np   # noqa: E402


def report(query, k=10):
    scores, weights, conf = search.score_all(query)
    lines = [f"## {query}", ""]
    for rank, i in enumerate(np.argsort(-scores)[:k], 1):
        r = search.rows[i]
        lines += [
            f"{rank:2}. {scores[i]:.3f}  {r['title']} ({r['year']})",
            f"      genres  : {r['genres']}",
            f"      keywords: {r['keywords'][:110]}",
            f"      plot    : {r['overview'][:170]}",
            "",
        ]
    return "\n".join(lines)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--all"]

    if "--all" in sys.argv:
        queries = [q.strip() for q in (HERE / "queries.txt").read_text().splitlines() if q.strip()]
    elif args:
        queries = [" ".join(args)]
    else:
        print(__doc__)
        sys.exit(1)

    for q in queries:
        print(report(q))
        print()
