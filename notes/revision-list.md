# Revision List — after the embedding experiment

What I touched during the test, and what's worth going back to.

---

## Worth revising properly

### Embeddings and vector search
I used these but didn't derive them.

- What a vector space is. Why similar meanings land near each other.
- Cosine similarity. What it measures, and why it's bounded between -1 and 1.
- Why `normalize_embeddings=True` lets you use a plain dot product instead.
  (Normalising sets every vector to length 1, so the division in cosine similarity
  disappears. That's why searching is one line: `scores = vectors @ q`.)

My machine learning course covered the maths. Go back to that section now that
I've seen it work.

### Why score magnitude means something
"vampire" scored 0.50. "makes me cry" scored 0.26.

That gap is information, not noise. A low top score means *nothing in the space
is close* — the model is guessing.

This is the whole basis of the score floor decision (Q7).

### The limits of semantic search
The most important thing I found.

Embeddings capture what a text is **about**. They don't capture:
- how it feels (tone)
- what facts are true of it (year, runtime, country)

That's why "sad movies" returned *A Serbian Film*. A film **about** suffering and a
film that **makes you feel** sad look the same in a plot description.

Read about **hybrid search** — semantic ranking combined with structured filters.
That's the pattern I arrived at on my own. Worth knowing the proper name and the
standard approaches.

---

## Worth a quick look

### Dimensionality reduction (PCA)
Haven't done it yet. Will need it to get the vector file small enough to ship.

- What information is lost when going 768 → 128.
- Why the **same** transform must be applied to the query and the movies.
  If they differ, scores look plausible and are meaningless.

### REST API basics
Picked most of this up already. Just make sure these are solid:

- Status codes, especially `200` and `429`
- `Retry-After` header and backoff
- Pagination (`page`, results per page, max page limits)
- Query parameters vs path parameters
- Bearer token auth, and why secrets go in `.env`, not in code

These come up in interviews.

### Python patterns I asked about
Small things, but not yet automatic:

- `enumerate(items, 1)` — counter plus item, with a start value
- Slicing: `cast[:4]`
- f-strings, and adjacent string literals joining automatically
- `with open(...) as f:` — auto-closes, even on crash
- `dict.get("key", default)` — safe lookup with a fallback
- Functions that **return** a value vs functions that **change** something
  (`load_dotenv()` changes `os.environ`, returns nothing useful)

---

## The most valuable thing — and it isn't technical

### 1. Check the data before blaming the model
The first results looked like a model failure. They were a **catalogue** failure —
obscure films with thin descriptions polluting every search.

`vote_count.gte: 200` fixed more than any model change did.

This instinct separates people who can debug ML systems from people who just tune
parameters.

### 2. Change one thing at a time
Title first → title last → no title.

That's the only reason I know what caused what. If I'd changed the model, the
catalogue, and the blob together, I'd have learned nothing.

**Both of these are worth being able to say out loud in an interview.**
Better material than anything from revising the maths.

---

## Quick reference — what I actually built

```
TMDB API  →  fetch.py  →  movies.json  →  build_text()  →  sentence-transformers
                                                                    ↓
                                          search query  →  embed  →  dot product  →  ranked list
```

Final text blob: genres + tagline + overview + top 4 cast + top 10 keywords.
No title.
