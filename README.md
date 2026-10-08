# Popcorn

A film recommender that learns from taps. Type an idea, get a list of films, mark a few, and press refresh. The list moves towards your taste. No sign-in.

**Live**: [movie-recommender-delta-flame.vercel.app](https://movie-recommender-delta-flame.vercel.app/)

---

## The idea

Most film sites provide detailed information for users to search, and need users to maintain a personal record to recommend. This product does it in a light and fast way even without owning an account.

Users firstly land on a search box, and after they type something like "vampire" or "something scary", then there will be a first batch of film recommendations for them.

Mark a film **liked** or **disliked**

The saved films can be checked in another list, and the user could send it to their email for later watching (Sending the saved list by email is planned).

**The tap loop is the product.** Search is only how it starts.

---

## Architecture

**The rerank runs in the browser.** A catalogue of 4,999 films with precomputed vectors ships as a static file, and every rerank is a local dot product.

So a rerank takes about 10ms, with no server to wait for or to go cold.

The catalogue is capped at 5,000 because everything has to reach the browser before it can be used. The film vectors are 6.7MB once reduced to 192 dimensions and packed as int8, and 3.6MB over the network.

The query is embedded in the browser too, by an 8-bit copy of the same model: 23MB, or 15.6MB over the network. It starts downloading as soon as the page opens, so it is usually ready before someone finishes typing. After the first visit, the browser keeps it. Nothing runs on a server.

---

## How search works

Each film has seven text fields: genres, tagline, overview, keywords, cast, director, reviews. **Each field is embedded separately**, and for every query the app decides how much each field counts, by how clearly it found a match. "Tom Hanks" needs the cast field. "vampire" barely needs it at all.

**Embedding search is good at meaning and weak at facts.** A name the model never learned, like "Carey Mulligan", finds none of her films. The planned fix is **hybrid search**: an exact match on cast, director and title first, with the embedding ranking the rest.

The method is in [`docs/02-method.md`](docs/02-method.md), and the results in [`docs/03-findings.md`](docs/03-findings.md).

---

## What the experiment found

Seventeen test queries, scored by hand against rules written before any results were seen.

| Query type                                         | Score       |
| -------------------------------------------------- | ----------- |
| names, like "a Christopher Nolan movie"            | 19/20       |
| mood, like "really scary"                          | 37/40       |
| topic, like "vampire"                              | 44/50       |
| two ideas at once, like "fall in love with a city" | 28/60       |
| **total**                                          | **128/170** |

These were scored in August, on the full-size vectors. The live app runs on compressed vectors and an 8-bit model in the browser, and 155 of the 170 films scored here still appear in its top 10 lists.

---

## Stack

- Python and `uv` for the offline pipeline
- TMDB API for metadata, posters and trailers
- `sentence-transformers`, model `all-MiniLM-L6-v2`: films embedded at 384 dims, then reduced to 192 with PCA and packed as int8
- React and Vite for the app
- `transformers.js` for the query, running an 8-bit copy of the same model in the browser
- Vercel for hosting. Static files only, no server

---

## Repo

```
app/          the React app, and the files it ships in public/
experiments/  the data pipeline (fetch, embed, shrink, export) and the experiments
docs/         the product, the method, the findings
notes/        where the project stands
data/         raw JSON, vectors and model files (not committed)
assets/       images for the docs
```

---

## Next

The app is built and live. A first user test with two people led to a full redesign. Next:

1. **Hybrid search**: exact matching for names and titles.
2. **A user test with 5 to 10 people**, to see whether the tap loop really moves the list towards what people want.
3. **An LLM filter** for queries that ask for two things at once.

---

## Data

<img src="assets/tmdb_logo.svg" width="150">

Movie data from [TMDB](https://www.themoviedb.org/). This product uses the TMDB
API but is not endorsed or certified by TMDB.
