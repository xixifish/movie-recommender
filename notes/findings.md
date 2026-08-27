# Findings

What the search experiment showed. The method is in `notes/experiment-plan.md`.

Two runs so far, both 25 Aug 2026. Run 1 used fixed weights. Run 2 used
automatic per-query weights. Full output in `experiments/results/`.

---

## 1. Topic search works

vampire 0.558, time travel 0.527, really scary 0.488, courtroom drama 0.458.
Clean lists.

This is the core assumption, and it holds.

---

## 2. Mood search fails

"makes me cry" tops out at 0.243. Very low. Nothing in the set is close.

"a good movie for a bad day" is worse, because it scored **high** and was still
wrong. Run 1 returned Suburbicon, Speak No Evil, The Final Girls and Friday the
13th Part III. Slasher films, for a query asking to be cheered up.

The model is not confused about what these films are. It matches **how strong a
feeling is, and ignores which way the feeling points.** A description full of
feeling words scores high either way.

No wording fixes this. It needs a genre filter to set the direction.

---

## 3. A high score does not mean a right answer

In run 1, "a good movie for a bad day" scored **0.432** and was wrong.
"heist" scored **0.378** and was much more right.

So a score floor cannot work. Scores can be compared inside one query, never
between queries.

**Field confidence might do the job instead.** The gap between a field's top and
its middle separated good queries from bad ones where the raw score did not:

```
vampire       0.42
Tom Hanks     0.39
makes me cry  0.27
```

Worth checking against all sixteen queries.

---

## 4. One set of weights cannot work

"Tom Hanks" needs cast high. "vampire" needs cast near zero. A fixed set is
always wrong for one of them.

**Automatic weighting fixed it.** "a Tom Hanks movie" went from **0/10 to
10/10**, with no rule telling it the query was about a person. On "vampire" it
correctly dropped cast to 0.035.

This is the strongest result in the project.

---

## 5. Cast belongs in the score

Cast alone on "Tom Hanks" scored **0.729** and returned ten Tom Hanks films.
This was an interactive probe, not a saved run. Worth re-running and recording.

The field was never the problem. The weight was.

---

## 6. The words "film" and "movie" poison a query

In run 1, "a Tom Hanks movie" returned Mank, The Disaster Artist and 8MM. All
films about making films. It matched "movie", not "Tom Hanks".

Both words do it. Neither carries meaning here, and both pull hard toward films
about the film industry.

A job for the LLM layer: strip these words out.

---

## 7. In a two part query, the stronger part wins

- "fall in love with a city" gave romance. It read "fall in love"
- "friendship that falls apart" gave friendship films, not broken ones
- "Chinese civil war" gave Chinese martial arts films. It read "Chinese"

The model cannot hold two ideas and require both. This is the filter layer's job.

---

## 8. The must-appear films are missing

No Heat. No Ocean's Eleven. No Revenant. No Exorcist. No Zodiac.

"really scary" returns all horror, but Ouija and Annabelle instead of The
Exorcist.

Nothing in the score rewards a film for being good or well known.

---

## 9. Automatic weights let obscure films in

New in run 2: Sun in Buckets, Cado dalle nubi, Marry Me Dude, The Santa Claus
Gang, It Boy. "something funny" and "a road trip" both got worse.

**Why.** Automatic weighting hands power to whichever field has a standout. A
film with thin or odd text is **more likely** to be a standout by accident. So
the method quietly rewards films with poor data.

This is the same failure as the old thin-catalogue problem, arriving through a
new door.

---

## What it all means

Findings 2, 6 and 7 point one way: **embeddings are good at meaning and bad at
facts.** Filters are the opposite. The design needs both.

Findings 8 and 9 are one problem seen from two sides: **nothing rewards a film
for being known.**

---

# Next task: a quality term

Add a term to the score using `vote_count`, so known films rise and obscure ones
fall. Fixes 8 and 9 together.

**Keep the weight small,** around 0.1. It should nudge the ranking, not decide
it.

**Use `vote_count` first, not `vote_average`.** Vote count means known. Rating
means liked. Findings 8 and 9 are both about obscurity, not quality.

**Test it the same way.** Run all sixteen queries with the term off, then on.
Compare must-appear hits. That number is the measure.

**Watch for:** every query returning the same blockbusters. If that happens, the
weight is too high.

---

# After that: test the tap loop

Nothing here tests the tap loop. Every result above is cold search, which is the
part that already works.

The loop is the product. It needs its own experiment, and it needs no new data.

Two things to settle:

- **Q1.** How much does `liked`, `disliked` and `interested` each count?
- **Q2.** After a few taps, does the query keep its weight or give way to taste?

**Do not start from nothing.** This is a known problem called **relevance
feedback**, and Rocchio's algorithm answers both questions:

```
new query = a * original query
          + b * (average of the liked)
          - c * (average of the disliked)
```

Q1 is `b` and `c`. Q2 is `a`. Usual starting values are `b = 0.75` and
`c = 0.15`. Negative feedback counts for less, because a dislike says much less
about what you *do* want.

Reference: *Introduction to Information Retrieval*, Manning et al., chapter 9.
Free at [nlp.stanford.edu/IR-book](https://nlp.stanford.edu/IR-book/).

**The known failure is drift.** A few taps pull the list into one genre, and it
never comes back. Watch for it.

The measure is not written yet. That is the first job.

---

# Later: an LLM reads the query

**Direction only. Do not build it yet.**

The LLM splits a query into three parts. Named films go to the lookup. Hard
filters cut the set. The leftover meaning text goes to the embedding.

| Query | What it pulls out |
| --- | --- |
| a Tom Hanks film | cast: Tom Hanks |
| really scary | genre: Horror |
| something funny and short | genre: Comedy, runtime under 100 |
| Memories of Murder, Zodiac | film names, send to lookup |
| Chinese civil war | setting and period |

**Why it waits.** We do not know yet what it has to handle. Build it now and you
are guessing at the rules. You also cannot tell whether a good result came from
the embedding or the filter.

The queries that fail are the job list. **The experiment writes the spec.**

Later, one server function can parse and embed in the same round trip.

---

# Later: shipping the vectors

Six vector sets must reach the browser, because Finding 4 says the weights have
to be chosen per query. One baked vector would undo it.

| What | Size |
| --- | --- |
| 6 fields, 384 dims, float32 | 46 MB. Too big |
| Same, as int8 | 11.5 MB. Still heavy |
| PCA to 128 dims, then int8 | **3.8 MB. Fine** |

So all six can ship. Not yet tested for accuracy loss.

**One trap.** The same PCA transform must be used on the query and on the films.
If they differ, the scores still look fine and mean nothing.
