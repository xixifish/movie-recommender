# Movie Recommender

A browser-based movie discovery tool. Type how you feel, get films back, and rate
them to reshape the results in real time.

**Status:** early. Search experiment running. Topic search works, mood search
does not, and I know why. No app built yet.

---

## The idea

Land on a search box. Type anything, like "something funny and short" or
"a heist that goes wrong". Posters appear below. Tap one to mark it *watched*
(then like or dislike) or *interested*. Rated cards stay in place, dimmed, so
nothing jumps while you are tapping. A refresh button collects a count. Press it
and the whole grid reranks at once. Interested films collect in a list you keep.

The point is the feedback loop. Results that visibly respond to you, with no
sign-up and no cold start.

---

## Architecture

**Everything runs in the browser.** A catalogue of 5,000 films with precomputed
vectors ships as a static file. Every rerank is a local dot product, so clicks
are instant.

The latency budget for the click loop is near zero. That is why computation moves
to the client and the catalogue is bounded. A deliberate tradeoff, not a shortcut.

```
TMDB API -> fetch -> raw JSON -> embed -> { texts.json, vec_<field>.npy }
                                                   |
                                               browser
                                                   |
           search query -> embed -> rank -> grid -> ratings -> rerank
```

One serverless function embeds the search query. Everything after that is local.

---

## How search works

Each film has six text fields: genres, tagline, overview, keywords, cast,
reviews. **Each field is embedded separately**, not glued into one paragraph.

That matters. In a single blob, length becomes weight by accident. A 300 word
review counts ten times more than a 30 word overview, and there is no way to turn
it down. Separate vectors make the weight a number you set.

The weights are then chosen **per query**, automatically. For each field, measure
how far its top results sit above its own middle, then turn those gaps into
weights. A field that finds something clear takes over. A field that finds
nothing gets little say.

---

## Stack

- Python and `uv` for the offline pipeline
- TMDB API for metadata and posters
- `sentence-transformers`, model `all-MiniLM-L6-v2`
- Frontend: not chosen yet
- Hosting: static, plus one function

---

## What the experiment found

Full runs are in `experiments/results/`. Each one records the settings and the
per-query weights that produced it.

**1. Topic search works.** vampire 0.558, time travel 0.527, really scary 0.488.
Clean lists.

**2. Mood search fails, and not for the reason I expected.** "Comforting and
uplifting" returned *Antichrist* at rank two, one of the most disturbing films
ever made. The model is not confused about what these films are. It matches
**emotional intensity and ignores emotional direction**. Descriptions full of
feeling words score high whichever way the feeling points. No phrasing fixes
this. It needs a genre filter to set direction.

**3. A high score does not mean a right answer.** "A good movie for a bad day"
scored 0.439 and was wrong. "Heist" scored 0.378 and was far more correct. So a
score floor cannot work. Scores are only comparable within a query, not between
queries.

**4. One set of weights cannot work.** "Tom Hanks" needs the cast field high.
"Vampire" needs it near zero. Automatic per-query weighting took the Tom Hanks
query from **0 out of 10 to 10 out of 10**, with no rule telling it the query was
about a person.

**5. The words "film" and "movie" poison a query.** "A Tom Hanks film" returned
*Mank*, *8MM* and *The Disaster Artist*. All films about filmmaking. It matched
"film", not "Tom Hanks".

**6. In a two part query, the stronger part wins.** "Fall in love with a city"
returned romance. "Chinese civil war" returned Chinese martial arts films. The
model cannot hold two ideas and require both.

**7. Thin data still pollutes, through a new door.** Automatic weighting hands
power to whichever field has a standout, and a film with thin text is more likely
to be a standout by accident. Obscure foreign comedies flooded "something funny".

Findings 2, 5 and 6 all point the same way: embeddings are good at meaning and
bad at facts. Filters are the opposite. The design needs both.

---

## Next

- Add a quality term to the ranking, so known films rise and obscure ones fall
- An LLM reads the query, pulls out named films and hard filters, and the
  embedding ranks what is left
- Reduce the vectors and export a binary file small enough to ship
- Design, then build

---

## Data

<img src="assets/tmdb_logo.svg" width="150">

Movie data from [TMDB](https://www.themoviedb.org/). This product uses the TMDB API
but is not endorsed or certified by TMDB.
