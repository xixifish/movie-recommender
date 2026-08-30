# Movie Recommender

User starts to use the recommender from entering an idea, then get a list of movies. Tap a few of them (liked/disliked, interested), and refresh the list moving closer to the user's taste. No need to sign in.

**Status:** early. Experimenting on the data currently, to see how to improve the recommendations. No app built yet. 

---

## The idea

Most film sites need users to maintain a long list of movies to recommend. This one doesn't need to sign in, starting from a simple idea. 

Users firstly land on a search box, and after they type something like "vampire" or "something scary", then the movie recommendations appear below. The user could tap a film to mark it **watched** -> **liked** or **disliked**, Or mark it **interested**, which are both signals for reranking the movie list. 

The interested movies can be saved into another list, and user could choose to send it to their email to watch later. 

Tapped movies go grey and stay in place, only `refresh` button starts re-ranking to change the list. 

**The tap loop is the product.** Search is only how it starts.

---

## Architecture

**The rerank runs in the browser.** A catalogue of 5,000 films with precomputed vectors ships as a static file, and every rerank is a local dot product.

The assumption is simple: doing the work locally gives the best experience.
Nothing to wait for, and no server to go cold while someone is thinking.

The catalogue is capped at 5,000 because the vectors have to reach the browser before they can be used. 5,000 films is 4.5MB once reduced and packed, and it
downloads while someone is reading the page and typing. One serverless function embeds the search query. Everything after that is local.

```
TMDB API -> fetch -> raw JSON -> embed -> { texts.json, vec_<field>.npy }
                                                   |
                                               browser
                                                   |
             query -> embed -> rank -> grid -> taps -> rerank
```

**None of this is built yet.** So far the work is the offline pipeline and the
search quality. Everything from `browser` down is the assumption being tested,
not a measurement.

---

## How search works

Each film has seven text fields: genres, tagline, overview, keywords, cast,
director, reviews. **Each field is embedded separately**, not glued into one
paragraph.

That is because in one blob, length becomes weight by accident. A 300 word review counts ten times more than a 30 word overview. Separated vectors can make the weight of each to be set. 

**The weights are then chosen per query, automatically.** For each field,
measure how far its top results sit above its own middle, then turn those gaps
into weights. A field that finds something clear takes over. A field that finds nothing gets little say.

"Tom Hanks" needs the cast field high. "vampire" needs it near zero. No fixed set of weights can serve both. Automatic weighting took "a Tom Hanks movie" from **0 out of 10** for fixed weights to **10 out of 10**, with no rule anywhere telling it the query was about a person.

---

## What the experiment found

Topic search works. vampire 0.558, time travel 0.527, really scary 0.488.
Clean lists.

Mood search fails, and not for the reason I expected. The model reads how strong a feeling is, but not which way it points. Measured on the model itself, "comforting" sits closer to "disturbing" than to "heartwarming".

So "a good movie for a bad day" returned slasher films. No wording fixes that, and neither does the obvious cheap fix: choosing a genre by vector similarity ranks Horror above Comedy for a comfort query. It needs something that can reason.

The wider lesson: **embeddings are good at meaning and bad at facts.** Filters are the opposite. The design needs both.

Full write-up in [`docs/03-findings.md`](docs/03-findings.md). Raw runs, with the settings and per-query weights that produced each one, in `experiments/results/`.

---

## Stack

- Python and `uv` for the offline pipeline
- TMDB API for metadata and posters
- `sentence-transformers`, model `all-MiniLM-L6-v2`, 384 dims
- Frontend: not chosen yet
- Hosting: static, plus one function

---

## Repo

```
docs/         the product document
notes/        plan, findings, and what to study next
experiments/  fetch, embed, search, and saved runs
data/         raw JSON and vectors (not committed)
```

---

## Next

1. Add a quality term to the ranking, so known films rise and obscure ones fall
2. Test the tap loop. Nothing tests it yet, and it is the point of the product
3. Design
4. An LLM reads the query, pulls out named films and hard filters, and the
   embedding ranks what is left
5. Shrink the vectors and ship them as one binary file
6. Build

---

## Data

<img src="assets/tmdb_logo.svg" width="150">

Movie data from [TMDB](https://www.themoviedb.org/). This product uses the TMDB
API but is not endorsed or certified by TMDB.
