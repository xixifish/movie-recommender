# Findings

What the search experiment showed. The method is in `02-experiment-plan.md`.

Six runs so far, three of them scored by hand against `experiments/query-rules.md`.
Raw output is in `experiments/results/`.

Updated 31 Aug 2026

---

## Where it stands

Best run: `run-2026-08-31-1256.md`. Seven fields, automatic weights, quality term
multiplied at 0.5.

| Query type | Score | |
| --- | --- | --- |
| name | 19/20 | 95% |
| mood | 37/40 | 93% |
| topic | 44/50 | 88% |
| theme | 28/50 | 56% |
| catalogue test | 0/10 | |
| **total** | **128/170** | **75%** |

Must-appear films found: **14/45** in the top 10. But the product shows 50 films,
not 10, and at 50 it is **26/45**. The test is harder than the product.

**The core assumption holds.** A vector built from a film's text does return films
a person would accept, for the query types people actually use. What is left is
one specific failure, described in finding 5.

---

# What works

## 1. Topic search

vampire, time travel, alien films, courtroom drama. 44/50.

This was the thing to prove, and it holds. Clean lists, high scores, and the
failures are films that are *nearly* right rather than nonsense.

## 2. Names, once the fields exist

```
a Tom Hanks movie          9/10
a Christopher Nolan movie  10/10
```

Both were 0/10 at first. Cast fixed one, director fixed the other, and neither
needed a rule telling the system that the query was about a person. See
finding 7.

## 3. Mood, after the quality term

**This corrects an earlier conclusion.**

The old finding said mood search fails. With the quality term it scores 37/40,
the second best group.

```
                             before   after
makes me cry                    6       10
something funny                10       10
really scary                   10       10
a good movie for a bad day      4        7
```

The mood failures were mostly **obscure films with odd descriptions**, not a
failure to understand mood. Remove those and mood queries work.

The direction problem is real but smaller than it looked. Measured on the model
itself:

```
comforting  vs  disturbing     0.54
comforting  vs  heartwarming   0.50
```

It thinks "comforting" is closer to "disturbing" than to "heartwarming". Feelings
of the same strength sit near each other whichever way they point. That still
shows: *The Shining* is still in "a good movie for a bad day".

But it costs about three marks now, not thirty.

---

# What does not work

## 4. The catalogue, not the model

"Chinese civil war" scores 0/10 and always has. The catalogue is 98% English.

This was designed as a catalogue test, and it did its job. Nothing in the ranking
can fix it.

## 5. Two ideas at once

**This is the only substantial failure left.**

```
fall in love with a city    0/10
survival in the wild        5/10
gritty atmospheric mystery  6/10
```

Each asks for two things:

| Query | Part one | Part two |
| --- | --- | --- |
| fall in love with a city | a city | make it appealing |
| survival in the wild | staying alive | in nature |
| gritty atmospheric mystery | a mystery | gritty, heavy |

The model takes the stronger half and drops the other.

- "fall in love with a city" returns romance. It read "fall in love"
- "gritty atmospheric mystery" returns *See How They Run*, a comedy whodunit. It
  read "mystery"
- "Chinese civil war" returned Chinese martial arts films. It read "Chinese"

**"Fall in love with a city" has never worked**, at any setting: 4, then 6, then
0. It is the clearest case in the project for the filter layer, because a filter
can require both conditions and an embedding cannot.

---

# How the ranking was built

## 6. A high score does not mean a right answer

In run 1, "a good movie for a bad day" scored **0.432** and was wrong. "heist"
scored **0.378** and was much more right.

So a score floor cannot work. Scores can be compared inside one query, never
between queries. And now that the quality term multiplies the score, they cannot
be compared between settings either.

**Field confidence works where the raw score did not.** The gap between a field's
top 10 and its own median separates a good query from a bad one.

## 7. One set of weights cannot work

"Tom Hanks" needs cast high. "vampire" needs cast near zero. A fixed set is
always wrong for one of them.

**Automatic weighting fixed it.** For each field, measure how far its top results
sit above its own middle, then softmax those gaps into weights.

```
a Tom Hanks movie   0/10  ->  10/10
```

with no rule anywhere about people.

Then the same method found a field it had never seen. Adding `director` fixed
"a Christopher Nolan movie" from 0/10 to 10/10, with **no change to the weighting
code**. That is the strongest evidence that the method generalises rather than
being tuned to what it was built on.

Two settings matter:

- **Do not divide by the standard deviation.** The fields all have a similar
  spread, about 0.061 to 0.081, so it corrects nothing. But it makes every number
  about 13 times bigger, which breaks the temperature
- **Temperature must match the size of the gaps.** Gaps run 0.1 to 0.4, so
  temperature must be near 0.1. At 1.0 the softmax is flat and does nothing

## 8. The quality term: multiply, do not add

**The problem.** Nothing rewarded a film for being known or liked. "something
funny" returned *Sun in Buckets* and *Cado dalle nubi*. "a good movie for a bad
day" returned *Date Movie*, rated 4.27, one of the lowest in the catalogue.

**The fix.** A quality score from `vote_count` and `vote_average`, each turned
into a percentile rank so they sit on the same scale as a cosine score, then
averaged.

Both signals are needed. `vote_count` means known, `vote_average` means liked.
Date Movie has 1,078 votes, above the catalogue floor, so vote count alone would
not have caught it.

**Adding it failed.**

```
score = similarity + 0.3 * quality      121/170, down from 127
```

Every film got the same bonus regardless of how well it matched. Famous films
that did not fit rose anyway: WALL·E and Blade Runner for "heist", Schindler's
List for "a Tom Hanks movie". *The Shining* appeared in four different queries.

This is exactly what the plan warned about: every query returning the same
blockbusters.

**Multiplying worked.**

```
score = similarity * (1 + 0.5 * quality)     128/170
```

The bonus is now a share of how well the film already matched. A poor match gets
a small boost, a good match gets a large one. The blockbusters stayed down, and
the well-known films that *did* match rose instead.

| | precision | must-appear |
| --- | --- | --- |
| no quality term | 127/170 | 12/45 |
| adding, 0.3 | 121/170 | 18/45 |
| **multiplying, 0.5** | **128/170** | **14/45** |

**It is not a clean win.** By group:

```
             baseline   multiply 0.5
mood            30/40      37/40     +7
theme           33/50      28/50     -5
topic           45/50      44/50     -1
```

Mood gained a lot. Theme lost. Part of the theme drop is a stricter second look
at "fall in love with a city", scored 4 then 0, so the comparison is not clean.
**Two things changed at once: the setting, and the scorer.** Worth avoiding next
time.

## 9. A name is a fact, and facts leak

Cast and director both work, and both leak.

```
a Tom Hanks movie  ->  See How They Run, directed by Tom George
```

A shared first name was enough. The model cannot tell two people apart. It sees
similar looking text.

**Worse: the noise arrives in clumps.** Every film by one director has an
identical director vector. So when a name scores high by accident, that
director's whole filmography rises together.

```
"a good movie for a bad day"  ->  every Stanley Kubrick film scores 0.421
"alien movies"                ->  every Ridley Scott film scores 0.514
```

That is why *The Shining* sits in "a good movie for a bad day", and why *Alien*
entered "alien movies" for the first time. **The right answer, for the wrong
reason.**

## 10. Confidence can be fake

Finding 7 rewards whichever field looks most sure. Finding 9 shows a field can
look sure by accident.

The measure cannot tell these apart:

- "I found the ten right films", which is director on Nolan
- "I found one name that scores high, and it appears eight times", which is
  Kubrick

Both produce a clean gap between the top 10 and the median.

**The fix, untested.** Director confidence separates cleanly:

```
a Christopher Nolan movie   0.643
everything else             0.354 and below
```

A floor near 0.5 should keep the wins and cut the noise. But there is only one
real name query so far, so any cut-off would be fitted to a single example. Add
more name queries first.

## 11. The words "film" and "movie" poison a query

In run 1, "a Tom Hanks movie" returned *Mank*, *The Disaster Artist* and *8MM*.
All films about making films. It matched "movie", not "Tom Hanks".

Neither word carries meaning here, and both pull hard towards the film industry.
A job for the LLM layer: strip them out.

---

# What it all means

**Embeddings are good at meaning and bad at facts.** Filters are the opposite.
The design needs both.

Findings 5, 9 and 11 all say the same thing from different directions. A city, a
person, a year, a genre: these are facts, and a vector can only say "this text
looks similar". That is why the filter layer is not an improvement to the design.
It is half of it.

**The automatic weighting is the best idea in the project**, and its weakness is
the same as its strength. It trusts whichever field looks most certain, and
certainty can be an accident.

---

# Next

**1. Build.** The search is good enough. 88 to 95% on the query types people
actually use, with the exceptions understood. Further tuning will return less
each time.

**2. The tap loop is untested, and the build is the test.** It cannot be judged
without a person tapping, so a script cannot answer it. Rocchio's algorithm gives
starting values for both open questions:

```
new query = a * original query
          + b * (average of the liked)
          - c * (average of the disliked)
```

Usual starting values are `b = 0.75` and `c = 0.15`. Negative feedback counts for
less, because a dislike says much less about what you do want. Watch for
**drift**: a few taps pulling the list into one genre with no way back.

Reference: *Introduction to Information Retrieval*, Manning et al., chapter 9.
Free at [nlp.stanford.edu/IR-book](https://nlp.stanford.edu/IR-book/).

**3. The confidence floor**, after adding two or three more name queries.

**4. The LLM filter layer.** It is not optional. Finding 5 needs two conditions
held at once, and nothing else in the design can do that.

The LLM splits a query into three parts. Named films go to a lookup, hard filters
cut the set, the leftover meaning text goes to the embedding.

| Query | What it pulls out |
| --- | --- |
| really scary | genre: Horror |
| something funny and short | genre: Comedy, runtime under 100 |
| fall in love with a city | setting: a city, tone: appealing |
| a Tom Hanks film | cast: Tom Hanks, strip "film" |

**Three conflicts to handle when building it:**

- **The filter can take away what the ranking needs.** Pull "Tom Hanks" out as a
  filter and the leftover text is "movie", which ranks *Man Bites Dog* and
  *Sex Tape*. The LLM must be able to say there is no meaning text
- **Confidence needs a big set.** Filter "really scary" down to 738 horror films
  and every field's gap shrinks. Below a few hundred films the measure stops
  meaning anything, so fall back to fixed weights
- **Temperature was tuned on the unfiltered set.** Smaller gaps at the same
  temperature means a flatter softmax, so the weighting quietly turns itself down
  at the moment you added a filter to make things better

**5. Shipping.** Seven vector sets must reach the browser, because finding 7 says
the weights are chosen per query. One baked vector would undo it.

| What | Size |
| --- | --- |
| 7 fields, 384 dims, float32 | 54MB. Too big |
| Same, as int8 | 13.4MB. Still heavy |
| PCA to 128 dims, then int8 | **4.5MB. Fine** |

The same PCA transform must be used on the query and on the films. If they
differ, the scores still look fine and mean nothing.
