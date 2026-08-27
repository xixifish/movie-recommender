# Experiment plan

**Question:** does a vector built from a film's text return films a person
would accept?

This is the method. The results are in `notes/findings.md`.

Updated 27 Aug 2026

---

## 1. The catalogue

`discover`, `vote_count.gte=200`, sorted by `vote_count.desc`. 5,000 films.

**Why not `top_rated`.** It is the same call with a different sort. Sorting by
rating changes the catalogue a lot. Top 1,000 films of our 5,000:

| | by vote count | by rating |
| --- | --- | --- |
| Drama | 31% | 60% |
| Action | 41% | 19% |
| English | 98% | 74% |
| Before 2000 | 18% | 38% |

Only 355 films are in both lists.

Ratings are not even across genres. Documentary 7.35, Drama 7.07, Comedy 6.64,
Horror 6.41. So sorting by rating is partly sorting by genre. It thins out the
things users ask for.

**Why not `popular`.** It uses release date, so new films with thin text get a
lift. It also moves every day, so two runs cannot be compared.

**The principle.** Coverage is the catalogue's job. Quality is the ranking's job.
If good films should win, add rating as a small term in the score.

**Know the set.** These 5,000 films sit near a 1,000 vote floor. The set is
mainstream, not broad. If a search returns nothing good, check the film is even
in the set before blaming the model.

Sources: [top rated](https://developer.themoviedb.org/reference/movie-top-rated-list),
[popularity](https://developer.themoviedb.org/docs/popularity-and-trending)

---

## 2. Fetch

`experiments/fetch.py`. About 13 minutes. Writes `data/movies.jsonl`, one film
per line.

**Safe to stop and re-run.** It reads the ids already in the file and skips
them. A crash or a dropped connection costs only the films it had not reached.

**Why one film per line, not one big JSON list.** The first version rewrote the
whole growing file every 100 films. By the end that was 270MB, written fifty
times over. Appending a line writes each film exactly once, and it means a
half-finished file is still readable.

Six fields: `genres`, `tagline`, `overview`, `keywords`, `credits`, `reviews`.

**Trap: no spaces in `append_to_response`.** A space breaks it, and it breaks
quietly. `"keywords, credits"` returns keywords and drops credits. No error.
Write `keywords,credits,reviews`.

**Count the fields after fetching.** Any field far below 5,000 means the request
is wrong, not the films. This caught the trap above.

---

## 3. Check the data

`experiments/check_data.py`. Done 25 Aug 2026.

| Field | Films that have it |
| --- | --- |
| overview | 100% |
| genres | 100% |
| keywords | 99% |
| cast | 99% |
| tagline | 94% |
| reviews | 83% |

**Reviews are usable.** Better coverage than expected. Median 3 per film. Keep
them.

**The model cuts long text.** `all-MiniLM-L6-v2` reads about 256 tokens, roughly
1,000 characters. Past that it is dropped, with no warning.

Reviews are long: median 991 characters, 90th 2,754, longest 25,841. So most of
a long review is thrown away anyway.

**Caps used:**

- reviews: first 300 characters of the top 3
- cast: top 6. TMDB orders by billing, so the leads come first
- keywords: top 10

The cap is **per field**, not per film. Each field is embedded on its own, so
nothing crowds anything else out.

---

## 4. One vector per field

`experiments/embed.py`. Six files, `data/vec_<field>.npy`, 5,000 x 384 each.

**Why not one blob.** In a blob, length becomes weight by accident. A 300 word
review counts ten times more than a 30 word overview. You cannot turn it down.

Separate vectors make weight a number you set:

```
score = w1 * sim(query, genres)
      + w2 * sim(query, overview)
      + w3 * sim(query, keywords)
      + w4 * sim(query, reviews)
      + w5 * sim(query, cast)
      + w6 * sim(query, tagline)
```

This buys three things:

- A field can be tested. Set its weight to zero, then to one. The gap is the answer
- A missing review scores zero on that term, instead of making a thin blob
- Different queries can use different weights

**Watch.** `genres` and `cast` are very short. Thin vectors may behave oddly.

---

## 5. No titles. Names by lookup.

No title goes in any vector.

The title is short, so it carries too much weight. A film with a common word in
its title matches that word whatever the film is about.

It also does not do the job. If "Zodiac" is in Zodiac's text, then "films like
Zodiac" returns Zodiac.

Do this instead:

1. Spot the film name in the query
2. Look it up by name. Plain text match, no vectors
3. Use that film's vector as the query vector
4. Return its neighbours, minus itself

Name matching and meaning matching stay apart. A name lookup is needed anyway,
because users will type titles.

---

## 6. Automatic weights

`experiments/search.py`.

One fixed set of weights cannot work. "Tom Hanks" needs cast high. "vampire"
needs cast near zero.

So the weights are chosen per query:

1. For each field, score every film
2. Measure the gap: mean of the top 10, minus the median of that field
3. Softmax those gaps into weights, temperature 0.1
4. Blend 80% automatic with 20% fixed fallback

A field that finds something clear takes over. A field that finds nothing gets
little say.

**Two settings matter, and both were wrong at first:**

- **Do not divide by standard deviation.** Taglines are short, so their spread is
  narrow, so dividing inflated their confidence and tagline stole the weight.
  Use the plain gap in cosine terms
- **Temperature must match the size of the gaps.** Gaps run 0.1 to 0.4, so
  temperature must be near 0.1. At 1.0 the softmax is flat and does nothing

---

## 7. How to judge a run

Queries in `experiments/queries.txt`. Rules in `experiments/query-rules.md`.

Record three things per query:

- how many of the top 10 are accepted, like `7/10`
- the top score
- did the must-appear films turn up

**Write no rules after seeing results.** You will bend them to fit.

**Do not score a run when you know which setting made it.** You will favour the
one you expect to win. Print two lists side by side with no labels, then pick.

Save every run with the settings that made it. Runs go in `experiments/results/`.
