# Experiment plan

**Question:** does a vector built from a film's text return films someone would accept? Judged by the rules in `experiments/query-rules.md`.

The results are in `docs/03-findings.md`.

Updated 15 Sep 2026

---

## 1. The catalogue (5,000 films)

`discover`, `vote_count.gte=200`, sorted by `vote_count.desc`. 5,000 films.

The reasons that I didn't use `top_rated` and `popular` API of `TMDB` are:

- Ratings are highly skewed across genres, such as horror films gets lower `vote_average` naturally.
- But `vote_count` doesn't have the same high skewness as ratings, it generates `1.8x` gap between the proportion of horror films and the top-rated genre. (The gap is `3.3x` by `vote_average`.)
- `popular` uses release date, so new films with thin text get a lift. It also moves every day, so two runs cannot be compared.
- **The logic**: Coverage is the catalogue's job. Quality is the ranking's job.

**Movie set**: These 5,000 films sit near a 1,000 vote floor.

Sources: [top rated](https://developer.themoviedb.org/reference/movie-top-rated-list),
[popularity](https://developer.themoviedb.org/docs/popularity-and-trending)

---

## 2. Fetch

`experiments/fetch.py`. About 13 minutes. Writes `data/movies.jsonl`, one film per line.

Six fields: `genres`, `tagline`, `overview`, `keywords`, `credits`, `reviews`. `credits` carries both cast and crew, so it becomes two fields later. (Notice that no space between different fields when using `append_to_response` in fetching data from API)

**Count the fields after fetching.** Any field far below 5,000 means the request is wrong, not the films.

---

## 3. Check the data

`experiments/check_data.py`. Done 25 Aug 2026.

| Field        | Films that have it |
| ------------ | ------------------ |
| overview     | 100%               |
| genres       | 100%               |
| keywords     | 99%                |
| cast (top 6) | 99%                |
| tagline      | 94%                |
| director     | 100%               |
| reviews      | 83%                |

**Reviews are usable.** Better coverage than expected. Median 3 per film.

**The model cuts long text.** `all-MiniLM-L6-v2` reads about 256 tokens, roughly
1,000 characters. Past that it is dropped, with no warning.

Reviews are long: median 991 characters, 90th 2,754, longest 25,841. So most of
a long review is thrown away anyway.

**Caps used:**

- reviews: first 300 characters of the top 3
- cast: top 6. TMDB orders by billing, so the leads come first
- keywords: top 10

Each field is capped on its own, for every film. Each field is embedded on its own, so nothing crowds anything else out.

---

## 4. One vector per field

`experiments/embed.py`. Seven files, `data/vec_<field>.npy`, 5,000 x 384 each.

Separate vectors make weight a number can be set:

```
score = w1 * sim(query, genres)
      + w2 * sim(query, overview)
      + w3 * sim(query, keywords)
      + w4 * sim(query, reviews)
      + w5 * sim(query, cast)
      + w6 * sim(query, tagline)
      + w7 * sim(query, director)
```

This buys three things:

- A field can be tested. Set its weight to zero, then to one. The gap is the answer
- A missing review scores zero on that term, instead of making a thin blob
- Different queries can use different weights

---

## 5. No titles in any vector

**Searching movie's title is rare.**

This product helps users find a movie they would like to watch, in most cases, users would not use this product to search the specific movies. But users might search similar movies with the exact movie titles. The loop already covers this case.

**Title cannot help search.**

The title is short, so it carries too much weight, and sometimes it means nothing. It also does not do the job. If "Zodiac" is in Zodiac's text, then "films like Zodiac" returns Zodiac.

---

## 6. Automatic weights

`experiments/search.py`.

One fixed set of weights cannot work. "Tom Hanks" needs cast high. "vampire" needs cast near zero.

So the weights are chosen per query:

1. For each field, score every film
2. Measure the gap (`confidence`): mean of the top 10, minus the median of that field
3. Softmax those gaps into weights, temperature 0.1
4. Blend 80% automatic with 20% fixed fallback

A field that finds something clear (higher confidence) takes over, and a field that finds nothing gets little say.

---

## 7. Quality term

The quality term comes from `vote_count` and `vote_average`. Each is turned into a percentile rank, then the two are averaged. They become percentile ranks because the raw values of these two are highly skewed, and they cannot sit next to a cosine score.

The search experiments showed `vote_count` alone still let obscure, low-rated films going into the list. Adding `vote_average` rules them out.

Runs `08-31-1112` and `08-31-1256` showed that **adding** (`score + 0.5 * q`) the quality term to the score didn't generate good results since famous films that do not fit get their scores raised too. **Multiplying** (`score * (1 + 0.5 * q)`) makes the bonus a share of how well the film already matched, so a poor match gets a small one and a good match gets a larger one.

The setting: `QUALITY = 0.5`, meaning the most famous films can lift a score at most half.

The details of the experiments are in `03-findings.md` and `progress.md`.

---

## 8. How to judge a run

Queries in `experiments/queries.txt`. Rules in `experiments/query-rules.md`.

Record three things per query:

- how many of the top 10 are accepted, like `7/10`
- the top score
- did the must-appear films turn up

The rules of defining what films are aligned with the queries, written before the getting the recommendation results.

Save every run with the settings that made it. Runs go in `experiments/results/`.

---

## 9. If the catalogue needs to grow

**Decision: stay at 5,000 for now.** This records why, and what to do if that
changes.

### The size is not the limit

At 128 dims, packed to one byte per number:

| Catalogue | Download | Rerank     |
| --------- | -------- | ---------- |
| 5,000     | 4.5MB    | about 10ms |
| 10,000    | 9MB      | about 25ms |
| 20,000    | 18MB     | about 50ms |

10,000 would work. So would 20,000. The download also overlaps with the user
reading the page and typing, so it will not block.

**Refreshing reloads the posters.** The whole vector file is 4.5MB, downloaded once and then cached. A grid of 50 posters is roughly 3MB, and each refresh pulls some that are not cached yet.

Use `lazy` loading and `async` decoding for the `<img>`.

### The obscure films come out

Measured from `movies.jsonl`:

| Rank   | Votes                  |
| ------ | ---------------------- |
| 1,000  | 5,192                  |
| 2,500  | 2,245                  |
| 5,000  | **986**, the floor now |
| 10,000 | about 450, estimated   |

Doubling means adding 5,000 films between roughly 450 and 986 votes. These films are less known, with thinner text and fewer reviews. **That would lead obscure films come out.** (This is already a problem at 5,000 films.)

So a bigger catalogue makes a known bug worse. The quality term has fixed the low-rated half (3 of 170 results are below 6.0.), but it did not fix the **lesser-known** problems: 20 of 170 sit under 1,500 votes, near the floor.

But the planned selection rules of the default list on catalogue selection could solve this problem.
