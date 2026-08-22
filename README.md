# Movie Recommender

A browser-based movie discovery tool. Type how you feel, get films back, and rate
them to reshape the results in real time.

**Status:** early. Embedding approach tested and validated. Design in progress.
No app built yet.

---

## The idea

Land on a search box. Type anything — "something funny and short", "underrated sci-fi".
Posters appear below. Tap one to mark it *watched* (then like/dislike) or *interested*.
Rated cards stay in place in a dimmed state, so nothing jumps while you're tapping.
A refresh button collects a count; press it and the whole grid reranks at once.
Interested films collect in a list you keep.

The point is the feedback loop — results that visibly respond to you, with no
sign-up and no cold start.

---

## Architecture

**Everything runs in the browser.** A curated catalogue of ~5,000 movies with
precomputed vectors ships as a static file. Every rerank is a local dot product,
so clicks are instant.

The latency budget for the click loop is near zero. That's why computation moves
to the client and the catalogue is bounded — a deliberate tradeoff, not a shortcut.

```
TMDB API → fetch script → raw JSON → build script → { display.json, vectors.bin }
                                                              ↓
                                                          browser
                                                              ↓
                              search query → embed → rank → grid → ratings → rerank
```

One serverless function embeds the search query (~150ms). Everything after that
is local.

---

## Stack

- Python + `uv` — offline data pipeline
- TMDB API — movie metadata and posters
- `sentence-transformers` — semantic embeddings
- Frontend — TBD
- Hosting — static, plus one function

---

## Progress

**Done**

- Interaction design settled
- Architecture decided: browser-side, curated catalogue
- Embedding approach tested on 300 then 5,000 movies — it works
- Text blob recipe finalised through experiment

**Next**

- Finish Figma designs
- PCA down to 64–128 dimensions, export binary vector file
- Build the app

---

## What the embedding test found

Four findings, in `documents/`:

1. **Catalogue quality mattered more than the model.** Obscure films with thin
   descriptions polluted every search. Filtering by vote count fixed more than
   any model change.
2. **Low scores usually mean poor coverage,** not a broken model. "Vampire" failed
   at 300 movies and worked at 5,000.
3. **Titles in the embedding caused word-matching.** "Something funny" returned
   *Funny Games*, a brutal thriller. Removing the title fixed it.
4. **Embeddings can't separate tone from subject.** "Sad movies" returns extreme
   horror, because films *about* suffering look like films that *make you feel* sad.
   No embedding fixes this — it needs genre filtering.

Finding 4 shapes the design: an LLM parses the query into structured filters,
embeddings rank within them. Neither works alone.

---

## Data

<img src="assets/tmdb_logo.svg" width="150">

Movie data from [TMDB](https://www.themoviedb.org/). This product uses the TMDB API
but is not endorsed or certified by TMDB.
