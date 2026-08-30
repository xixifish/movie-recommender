# Findings

What the search experiment showed. The method is in `02-experiment-plan.md`.

Three runs so far. Run 1 used fixed weights, run 2 automatic per-query weights,
both on 25 Aug 2026 with six fields. Run 3 added a seventh field, `director`, on
27 Aug. Full output in `experiments/results/`.

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

No wording fixes this. It needs a filter to set the direction.

### Why the model is like this

Measured directly on the model, not on films:

```
comforting  vs  disturbing     0.54
comforting  vs  heartwarming   0.50
```

**It thinks "comforting" is closer to "disturbing" than to "heartwarming".**

| Comparison | Similarity |
| --- | --- |
| positive vs positive | 0.46 |
| negative vs negative | 0.66 |
| **positive vs negative** | **0.37** |
| emotion vs an unrelated word | 0.11 |

Opposite feelings sit at 0.37. Unrelated words sit at 0.11. So opposites are
three times closer than random things.

The model knows both words are about feeling. It does not know they point
opposite ways. Like a number where you can see the size but not the sign.

### And the cheap fix does not work either

The obvious cheap fix is to skip the LLM and pick genres by vector similarity:
match the query against the 19 genre names and filter on the best ones.

It works when the query names a genre:

```
"really scary"   ->  Horror 0.644, rank 1 of 19
```

It fails on exactly the queries that need it:

```
"something comforting and uplifting"
    Romance   0.308
    Thriller  0.298
    Music     0.294
    Horror    0.279   <- rank 4
    Comedy    0.238   <- rank 5
```

**Horror ranks above Comedy.** A vector-chosen genre filter would push a comfort
search towards horror, which is the error it was meant to fix.

The reason is the same one above. "Comforting" is not a similar *word* to
"Comedy". Connecting them needs reasoning, not distance.

**So for mood queries the LLM is not an optimisation. It is the whole fix.** The
only alternative is a hand-written word-to-genre map, which works for the words
you thought of and fails for the rest.

Note also that the working case is already covered. The `genres` field is this
same match, and automatic weighting already uses it. On "really scary" genres had
the highest confidence of all seven fields, 0.469. So a genre filter without an
LLM adds almost nothing that is not already there.

### The limit of genre filtering, even with an LLM

Genre is a stand-in for mood, and a rough one:

```
Man Bites Dog       Comedy, Crime      a disturbing film, tagged Comedy
Shaun of the Dead   Horror, Comedy     a comforting film, tagged Horror
```

An "include Comedy" filter lets Man Bites Dog through. An "exclude Horror"
filter throws Shaun of the Dead out.

**A better version:** label mood directly. Run an LLM over the 5,000 films once,
offline, and tag each with words like `warm, gentle, tense, bleak`. Then filter
on the tags instead of on genre. It runs once, it ships with the film data so the
filtering stays in the browser, and it fixes exactly this case. Untested.

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

## 10. The director field, added 27 Aug

Users search by director as often as by actor. The data was already fetched,
inside `credits`, and thrown away. Only `cast` was used.

Added `director` as a seventh field. Directors only, no other crew: the
catalogue holds 42,000 stunt credits and 15,000 executive producers, which would
be noise.

**The result on name queries:**

| Query | Before | After | Director weight |
| --- | --- | --- | --- |
| a Christopher Nolan movie | 0/10 | **10/10** | 0.712 |
| Wes Anderson | 0/10 | **10/10** | 0.762 |

"Wes Anderson" scored **0.836**, the highest score anything has reached in this
project. The old best was vampire at 0.558.

**The weighting code needed no changes.** It found the new field on its own,
exactly as it found cast. That is the strongest evidence so far that the method
generalises rather than being tuned to what it was built on.

### But it costs something

**A name is a fact, and embedding a name leaks.** "a Tom Hanks movie" dropped
from 10/10 to 9/10. The film that leaked in was *See How They Run*, directed by
**Tom George**. A shared first name was enough.

**Worse: the noise arrives in clumps.** Every film by one director has an
identical director vector. So when a name scores high by accident, that
director's whole filmography rises together.

"a good movie for a bad day" now returns *The Shining* at rank 2 and
*Dr. Strangelove* at rank 9. Both are Kubrick. They moved as a pair.

Director weight on queries containing no name at all:

```
gritty atmospheric mystery   0.147
alien movies                 0.118
a good movie for a bad day   0.107
Chinese civil war            0.081
```

This is Finding 9 again, sharper. Automatic weighting rewards a standout, and
now one standout can drag ten films with it.

### The fix to try next

Director confidence separates cleanly:

| Query | Director confidence |
| --- | --- |
| Wes Anderson | **0.696** |
| a Christopher Nolan movie | **0.643** |
| gritty atmospheric mystery | 0.332 |
| a good movie for a bad day | 0.260 |

There is a wide empty gap between about 0.35 and 0.64. Nothing sits in it.

So: give director weight only when its confidence clears a floor, around 0.5.
That should keep both 10/10 results and remove the noise. Untested.

### What is not measured yet

The seven field run is `run-2026-08-27-2041.md`. It is **not scored**.

Only two things are checked so far. Must-appear hits went from 6/45 to 7/45,
the gain being *Alien* entering "alien movies". And the two director queries
above were verified by hand, film by film.

The other fifteen queries changed but have not been judged. `queries.txt` now
holds 17 queries, including the Nolan one, so the next run covers it properly.

---

## What it all means

Findings 2, 6 and 7 point one way: **embeddings are good at meaning and bad at
facts.** Filters are the opposite. The design needs both.

Findings 8 and 9 are one problem seen from two sides: **nothing rewards a film
for being known.**

Finding 10 adds a third side to the same problem. Automatic weighting is only as
good as the field it hands power to, and a field can look confident by accident.
Cast and director both prove the method generalises. Both also leak, because a
name is a fact and facts do not belong in a vector.

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

**Do not build it yet, but it is not optional.** Finding 2 shows the cheap
alternative fails: choosing genres by vector similarity ranks Horror above
Comedy for "comforting". Mood queries need something that can reason, and
nothing else in the design can.

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

Seven vector sets must reach the browser, because Finding 4 says the weights
have to be chosen per query. One baked vector would undo it.

| What | Size |
| --- | --- |
| 7 fields, 384 dims, float32 | 54 MB. Too big |
| Same, as int8 | 13.4 MB. Still heavy |
| PCA to 128 dims, then int8 | **4.5 MB. Fine** |

So all seven can ship. Not yet tested for accuracy loss.

**One trap.** The same PCA transform must be used on the query and on the films.
If they differ, the scores still look fine and mean nothing.
