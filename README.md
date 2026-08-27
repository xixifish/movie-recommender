# Movie Recommender

Type an idea. Get films. Tap a few, and the list moves closer to your taste.
No sign in.

**Status:** early. The search experiment is running. Topic search works. Mood
search does not, and I know why. No app built yet.

---

## The idea

Most film sites want a long watch history before they help you. This one wants
one sentence.

Land on a search box. Type anything, like "something funny and short" or
"a heist that goes wrong". Posters appear below. Tap a film to mark it
*watched*, then *liked* or *disliked*. Or mark it *interested*, which is both a
signal and a save.

Tapped cards go grey and stay in place, so nothing jumps while you tap. When you
press refresh, the whole grid reranks at once.

**The tap loop is the product.** Search is only how it starts.

---

## Architecture

**The rerank runs in the browser.** A catalogue of 5,000 films with precomputed
vectors ships as a static file, and every rerank is a local dot product.

Here is why.

A rerank has to land in under 100ms, or the grid feels slow. And it does not
happen once. It happens on every press of refresh, again and again. That is the
loop, so it is the cost that counts.

| Where the rerank runs | Time |
| --- | --- |
| In the browser | about 10ms |
| A server nearby | 50 to 150ms |
| A server far away | 200 to 400ms |
| Serverless, cold start | 1 to 3 **seconds** |

One 300ms wait is fine. Ten of them in a row is what makes an app feel heavy.
And a cold start would hit exactly when someone comes back after a pause.

So the rerank is local.

**The catalogue is capped at 5,000 for the same reason.** To rerank in the
browser, the vectors have to be in the browser, so they have to download first.
5,000 films is 3.8MB after the vectors are reduced and packed. 50,000 films
would be 38MB, and nobody waits that long to see a poster.

**One thing does get a server call.** Embedding the query, once, when you press
enter. That happens at the start of a session, not in the loop, and there is
about 500ms to spare while the user's hands are still on the keyboard.

```
TMDB API -> fetch -> raw JSON -> embed -> { texts.json, vec_<field>.npy }
                                                   |
                                               browser
                                                   |
             query -> embed -> rank -> grid -> taps -> rerank
                        ^                               ^
                   one server call            local, on every press
```

---

## How search works

Each film has six text fields: genres, tagline, overview, keywords, cast,
reviews. **Each field is embedded separately**, not glued into one paragraph.

That matters. In one blob, length becomes weight by accident. A 300 word review
counts ten times more than a 30 word overview, and there is no way to turn it
down. Separate vectors make weight a number you set.

**The weights are then chosen per query, automatically.** For each field,
measure how far its top results sit above its own middle, then turn those gaps
into weights. A field that finds something clear takes over. A field that finds
nothing gets little say.

This is the part I am most pleased with. "Tom Hanks" needs the cast field high.
"vampire" needs it near zero. No fixed set of weights can serve both. Automatic
weighting took "a Tom Hanks movie" from **0 out of 10 to 10 out of 10**, with no
rule anywhere telling it the query was about a person.

---

## What the experiment found

Topic search works. vampire 0.558, time travel 0.527, really scary 0.488.
Clean lists.

Mood search fails, and not for the reason I expected. The model reads how strong
a feeling is, but not which way it points. "A good movie for a bad day" returned
slasher films. No wording fixes that. It needs a filter to set the direction.

The wider lesson: **embeddings are good at meaning and bad at facts.** Filters
are the opposite. The design needs both.

Full write-up in [`notes/findings.md`](notes/findings.md). Raw runs, with the
settings and per-query weights that produced each one, in
`experiments/results/`.

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
