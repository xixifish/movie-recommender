# Findings

What the search experiment showed, run by run. The method and the settled
settings are in `02-method.md`.

Six query runs so far, three of them scored by hand against `experiments/query-rules.md`. Raw output is in `experiments/results/`.

Finding 12 is different. It comes from the app, from marking films rather than
typing a query.

Updated 15 Sep 2026

---

## Where it stands

Best run: `run-2026-08-31-1256.md`. Seven fields, automatic weights, quality term multiplied at 0.5.

| Query type     | Score       |         |
| -------------- | ----------- | ------- |
| name           | 19/20       | 95%     |
| mood           | 37/40       | 93%     |
| topic          | 44/50       | 88%     |
| theme          | 28/50       | 56%     |
| catalogue test | 0/10        |         |
| **total**      | **128/170** | **75%** |

Must-appear films found: **14/45** in the top 10. But the product shows 50 films, not 10, and at 50 it is **26/45**. The test is harder than the product.

**The core assumption holds.** A vector built from a film's text does return films a person would accept, for the query types people actually use.

---

# What works

## 1. Topic search

vampire, time travel, alien films, courtroom drama. 44/50.

This was the thing to prove, and it works. The lists are clean and the scores are high. When a film is wrong, it is close to right, not random.

## 2. Person names search

```
a Tom Hanks movie          9/10
a Christopher Nolan movie  10/10
```

Both were 0/10 at first. Cast fixed one, director fixed the other, and neither needed a rule telling the system that the query was about a person.

## 3. Mood, after the quality term

**This corrects an earlier conclusion.**

The old experiments showed mood search fails. The quality term solves this problem.

```
                             before   after
makes me cry                    6       10
something funny                10       10
really scary                   10       10
a good movie for a bad day      4        7
```

The mood failures were mostly **obscure films with odd descriptions**, not a failure to understand mood. Remove those and mood queries work.

The direction problem is real but smaller than it looked. For example, measured on the model itself:

```
comforting  vs  disturbing     0.54
comforting  vs  heartwarming   0.50
```

It thinks "comforting" is closer to "disturbing" than to "heartwarming". Feelings of the same strength sit near each other whichever way they point. That still shows: _The Shining_ is still in "a good movie for a bad day".

But it costs about 3 marks out of 40, on one query. Before the quality term, mood looked broken.

---

# What does not work

## 4. The catalogue, not the model

"Chinese civil war" scores 0/10 and always has. The catalogue is 98% English. This was designed as a catalogue test, and it did its job. Nothing in the ranking can fix it.

## 5. Two ideas at once

**This is the only substantial failure left.**

```
fall in love with a city    0/10
survival in the wild        5/10
gritty atmospheric mystery  6/10
```

Each asks for two things:

| Query                      | Part one      | Part two          |
| -------------------------- | ------------- | ----------------- |
| fall in love with a city   | a city        | make it appealing |
| survival in the wild       | staying alive | in nature         |
| gritty atmospheric mystery | a mystery     | gritty, heavy     |

The model takes the stronger half and drops the other.

- "fall in love with a city" returns romance. It read "fall in love"
- "gritty atmospheric mystery" returns _See How They Run_, a comedy whodunit. It read "mystery"
- "Chinese civil war" returned Chinese martial arts films. It read "Chinese"

**"Fall in love with a city" has never worked**, at any setting: 4, then 6, then 0. It is the clearest case in the project for the filter layer, because a filter would keep only films that are romances and are set in a city, then rank what survives.

The LLM's job is only to split the sentence into those two conditions. Untested.

---

# How the ranking was built

## 6. A high score does not mean a right answer

In run 1, "a good movie for a bad day" scored **0.432** and was wrong. "heist"
scored **0.378** and was much more right.

Scores can be compared inside one query, never between queries. And now that the quality term multiplies the score, they cannot be compared between settings either.

**Field confidence works where the raw score did not.** The gap between a field's top 10 and its own median separates a good query from a bad one.

## 7. Fixed weights cannot work

"Tom Hanks" needs cast high. "vampire" needs cast near zero. A fixed set is always wrong for one of them.

**Automatic weighting fixed it.** For each field, measure how far its top results sit above its own middle, then softmax those gaps into weights.

```
a Tom Hanks movie   0/10  ->  10/10
```

with no rule anywhere about people.

Then the same method of adding `director` to fix "a Christopher Nolan movie" from 0/10 to 10/10, with **no change to the weighting code**. The method handled a field it had never seen, with no tuning.

Two settings matter:

- **Do not divide by the standard deviation.** The fields all have a similar spread, about 0.061 to 0.081, so it corrects nothing. But it makes every number about 13 times bigger, which breaks the temperature
- **Temperature must match the size of the gaps.** Gaps run 0.1 to 0.4, so temperature must be near 0.1. At 1.0 the softmax is flat and does nothing

## 8. The quality term: multiply, do not add

**The problem.** Nothing rewarded a film for being known or liked. "something funny" returned _Sun in Buckets_ and _Cado dalle nubi_. "a good movie for a bad day" returned _Date Movie_, rated 4.27, one of the lowest in the catalogue.

**The fix.** A quality score from `vote_count` and `vote_average`, each turned into a percentile rank so they sit on the same scale as a cosine score, then averaged.

Both signals are needed. `vote_count` means known, `vote_average` means liked. Date Movie has 1,078 votes, above the catalogue floor, so vote count alone would not have caught it.

**Adding it failed.**

```
score = similarity + 0.3 * quality      121/170, down from 127
```

Every film got the same bonus regardless of how well it matched. Famous films that did not fit get rised anyway: WALL·E and Blade Runner for "heist", Schindler's List for "a Tom Hanks movie". _The Shining_ appeared in four different queries.

**Multiplying worked.**

```
score = similarity * (1 + 0.5 * quality)     128/170
```

The bonus is now a share of how well the film already matched. A poor match gets a small boost, a good match gets a large one. The blockbusters stayed down, and the well-known films that _did_ match rose instead.

|                      | precision   | must-appear |
| -------------------- | ----------- | ----------- |
| no quality term      | 127/170     | 12/45       |
| adding, 0.3          | 121/170     | 18/45       |
| **multiplying, 0.5** | **128/170** | **14/45**   |

**It is not a clean win.** By group:

```
             baseline   multiply 0.5
mood            30/40      37/40     +7
theme           33/50      28/50     -5
topic           45/50      44/50     -1
```

Mood gained a lot. Theme lost. Part of the theme drop is a stricter second look at "fall in love with a city", scored 4 then 0, so the comparison is not clean.

## 9. The model matches text, not facts

Cast and director both work, and both go wrong in the same way.

```
a Tom Hanks movie  ->  See How They Run, directed by Tom George
```

**Worse: the noise arrives in clumps.** Every film by one director has an identical director vector. So when a name scores high by accident, that director's whole filmography rises together.

```
"a good movie for a bad day"  ->  every Stanley Kubrick film scores 0.421
"alien movies"                ->  every Ridley Scott film scores 0.514
```

That is why _The Shining_ sits in "a good movie for a bad day", and why _Alien_ entered "alien movies" for the first time. **The right answer, for the wrong reason.**

**It is not only names.** The clump happens wherever many films carry the same text. Films whose field is word for word identical to another film's:

| field    | films sharing their text | biggest group |
| -------- | ------------------------ | ------------- |
| genres   | 4202                     | 221           |
| director | 3793                     | 33            |
| tagline  | 74                       | 3             |
| cast     | 30                       | 3             |
| keywords | 11                       | 3             |
| overview | 8                        | 2             |
| reviews  | 4                        | 2             |

**Genres is worse than director.** 221 films have a genre field that is the one word "Drama", so all 221 score the same, every query. Director's biggest group is 33.

The other five are almost all unique, so they cannot clump.

**What would fix it**

```
The size of the problem:

5,000 films, 2114 directors
Spielberg 33 films, Eastwood 26, Ridley Scott 25
63 directors are called John, 52 are called David
```

1. Limit each director in the list
2. Do not turn a director into a vector
3. The LLM filter layer for searching side

## 10. Confidence can be fake

Finding 7 shows the program trusts whichever field looks most sure. However, finding 9 shows a field can look sure by accident.

The measure cannot tell these two apart:

- the field found the ten right films, which is director on Nolan
- the field found one name that scores high, and that name is on eight films, which is Kubrick

In both cases the top 10 sit far above the middle. That is the only thing the measure looks at, so both read as certainty.

**The fix, untested.** Two fields need it, not one. Director and genres are the two that clump, so they are the two that can fake a gap.

Director confidence separates cleanly:

```
a Christopher Nolan movie   0.643
everything else             0.354 and below
```

A floor near 0.5 would let the real name query through and block the rest. Need more name queries to to test.

Genres has no number yet. It went over 0.35 once in the best run, at 0.521, and the ceiling catches that. Whether genres also needs a floor is untested.

## 11. The words "film" and "movie" poison a query

In run 1, "a Tom Hanks movie" returned _Mank_, _The Disaster Artist_ and _8MM_.
All films about making films. It matched "movie", not "Tom Hanks".

Neither word carries meaning here, and both pull hard towards the film industry.
A job for the LLM layer: strip them out.

## 12. A ceiling on any one field

The first measurement from the app, not from the experiment. No words were typed.
Three Christopher Nolan films were marked, then Refresh.

The weights came out like this:

| field        | weight    |
| ------------ | --------- |
| overview     | 0.094     |
| keywords     | 0.061     |
| reviews      | 0.058     |
| genres       | 0.025     |
| tagline      | 0.027     |
| cast         | 0.023     |
| **director** | **0.712** |

Director took 7.5 times more of the vote than overview. That is not a seven field ranking. It is a director ranking.

**Why it happens.** Finding 9 says every film by one director shares the same director vector. So a taste vector built from three Nolan films is just the Nolan vector again.

Scoring then compares that vector with itself:

```
director top 10 scores:  1.0  1.0  1.0  1.0  1.0  1.0  1.0  1.0  1.0  1.0
```

Exactly 1, not near it. The gap over the median is 0.659. For overview it is 0.317. The temperature is 0.1, which is low, so a gap twice as wide turns into a weight 7.5 times as heavy.

This is finding 10 again, reached from marking instead of typing. The confidence measure cannot tell these two apart:

- this field sorted the catalogue well
- this field handed the input straight back

**The program does not know the actual reason of marking.** It picks a field with high confidence, and that field might not the right reason.

**The fix: a ceiling.** No field may hold more than `W_MAX = 0.35`. Whatever is cut off then is given back to the other six fields, each taking a share the size of what it already had. Their order does not change, only the field that took too much moves.

| field    | before | after |
| -------- | ------ | ----- |
| overview | 0.094  | 0.210 |
| keywords | 0.061  | 0.134 |
| reviews  | 0.058  | 0.132 |
| genres   | 0.025  | 0.055 |
| tagline  | 0.027  | 0.066 |
| cast     | 0.023  | 0.052 |
| director | 0.712  | 0.350 |

**What it did to the grid.** Same three marks, 30 films back:

|                    | before | after |
| ------------------ | ------ | ----- |
| Nolan              | 9      | 9     |
| Kubrick            | 10     | 4     |
| Ridley Scott       | 7      | 4     |
| distinct directors | 6      | 12    |

Nolan stayed at 9, and still took positions 1 to 8 and 10. Breaking the clump cost nothing that was working.

**What left.** _Paths of Glory_, _The Killing_, _Spartacus_, _Barry Lyndon_, _Full Metal Jacket_, _Dr. Strangelove_, _Gladiator_, _Black Hawk Down_ and _The Martian_. A Roman epic has nothing to do with _Memento_. They were there because one director vector pulled in every film by that director.

**What arrived.** _The Batman_ and _Batman_ (1989), from marking _Batman Begins_, both by other directors. _Se7en_, _Prisoners_ and _Minority Report_, which are the dark puzzle films that _Memento_ and _The Prestige_ really resemble. Also _Blade Runner 2049_ and _Dune_.

That is overview and keywords doing work they could not do at 0.094.

**A ceiling, not a floor.** Finding 10 asked for a floor on director, to be tuned once more name queries exist.

```
floor     ignore a field unless it is very sure
ceiling   listen to every field, but none may take more than 0.35
```

A floor has to be set field by field, from data that does not exist yet. A ceiling needs no tuning and does not care which field misbehaves.

**It does not fix the cause.** The confidence measure is still fooled. The ceiling only stops the damage taking the whole grid. Identical vectors inside one director are still the real problem, and finding 9 still stands.

|          |       |
| -------- | ----- |
| overview | 0.094 |
| keywords | 0.061 |
| reviews  | 0.058 |
| genres   | 0.025 |
| tagline  | 0.027 |
| cast     | 0.023 |
| director | 0.712 |

Director outvoted overview 7.5 to 1, dominating scoring.

**Why it happens.** Finding 9 says every film by one director shares an identical director vector. So the director taste vector built from three Nolan films _is_ just the Nolan vector again. Scoring the catalogue then compares that vector to itself:

```
director top 10 scores:  1.0  1.0  1.0  1.0  1.0  1.0  1.0  1.0  1.0  1.0
```

Exactly 1, not near it. The gap over the median is 0.659, against 0.317 for overview. Temperature 0.1 is sharp, so a gap twice as wide becomes a weight 7.5 times as heavy.

This is finding 10 seen from the marking side instead of the query side. The confidence measure cannot tell "this field sorted the catalogue well" from "this field handed the input back".

**It cannot read the reason.** If those three films were marked for their time bending plots and not for their director, the weights would be identical.
Three films by one director always produce that perfect 1.0.

**The fix: a ceiling.** No field may hold more than `W_MAX = 0.35`. Whatever is cut off is shared among the rest, in proportion to what they already hold. Every field under the cap is multiplied by the same number, so their order and their gaps do not change. Only the greedy field moves.

| field    | before | after |
| -------- | ------ | ----- |
| overview | 0.094  | 0.210 |
| keywords | 0.061  | 0.134 |
| reviews  | 0.058  | 0.132 |
| genres   | 0.025  | 0.055 |
| tagline  | 0.027  | 0.066 |
| cast     | 0.023  | 0.052 |
| director | 0.712  | 0.350 |

**What it did to the grid.** Same three marks, 30 films back, before and after:

|                    | before | after |
| ------------------ | ------ | ----- |
| Nolan              | 9      | 9     |
| Kubrick            | 10     | 4     |
| Ridley Scott       | 7      | 4     |
| distinct directors | 6      | 12    |

Nolan held, and still took positions 1 to 8 and 10.

What left was filmography: _Paths of Glory_, _The Killing_, _Spartacus_, _Barry Lyndon_, _Full Metal Jacket_, _Dr. Strangelove_, _Gladiator_, _Black Hawk Down_, _The Martian_. A Roman epic has nothing to do with _Memento_. They were there because one director vector dragged the whole shelf in.

What arrived was taste: _The Batman_ and _Batman_ (1989), from marking _Batman Begins_, both by other directors. _Se7en_, _Prisoners_ and _Minority Report_, which are the dark puzzle thrillers that _Memento_ and _The Prestige_ actually resemble. Also _Blade Runner 2049_ and _Dune_.

That is overview and keywords starting to affect.

**A ceiling, not a floor.** Finding 10 proposed a confidence floor on director, to be tuned once more name queries exist. The ceiling is a different tool and needs no tuning against examples. A floor asks whether a field deserves to be heard. A ceiling only limits how loudly any field may speak, whichever field it turns out to be.

**It does not fix the cause.** The confidence measure is still fooled. The ceiling only stops the damage from taking the whole grid. Identical vectors inside a director remain the real problem, and finding 9 still stands.

## 13. How a mark counts

Every mark changes the query. The rule is Rocchio's algorithm, from
_Introduction to Information Retrieval_, Manning et al., chapter 9:

```
new query = a * the typed query
          + b * (average of the liked)
          + s * (average of the saved)
          - c * (average of the disliked)
```

In `rank.js`:

- a = 1.00 W_QUERY
- b = 0.75 W_LIKED
- s = 0.60 W_SAVED
- c = 0.15 W_DISLIKED, stored as -0.15 and added.

**Why these sizes.** A like says the most, so it counts most. A dislike says much less about what someone does want, so it counts least. A save sits between: it is weaker evidence than a like, because it is made from a poster and a short overview.

**How to calculate the taste vector from the query and the marked films?** The query is one piece of text, so it is one vector. Each marked film has 7 field vectors. For each field, the marked films' vectors are averaged and the query is added to that average, using the weights above. 7 fields, 7 taste vectors.

**A film with no text in a field is skipped.** The cast average only includes marked films that have a cast.

**Marks are averaged, not added.** Ten likes carry the same total weight as one like. What changes is that the direction becomes steadier, saying the common attributes matter more, and the different parts are canceled.

**Taste vector is normalised before scoring.** So only the 4 ratios matter.

**The taste does carry across searches.** The taste vector can keep working on the next searches.

**What is not measured.** Whether these 4 numbers are right. They are the textbook's starting values. Answering that needs people, and the method is in `notes/progress.md`, Q3.

## 14 The first default list has a different job

Before anyone types anything, 50 films are on screen. The old first list was the catalogue in vote order, and the films are concentrating in Action, Adventrue, Science Fiction. Besides, older films have accumulated more votes then newer ones, so much more older films appear in this default list.

Someone with no idea marks a few and presses Refresh. The first list's job is to make that Refresh informative. If every film is Marvel-shaped, marking any of them says almost nothing, because those films already sit near each other as vectors.

**New selective rules**

- vote_count >= 3000, or 1500 for films since 2020 recognisable
- vote_average >= 7.0
- at most one film per director no clumping

**The method**

Start from the most voted film that clears the floors. Then repeatedly pick the film whose doesn't match the already-chosen in the furthest. Each film is judged by its nearest neighbour, not by an average, so nothing gets in that duplicates something already there.

Similarity comes from the overview vectors, which describe what a film is about.

**No genre or decade caps.** They were tried and dropped. Every genre landed exactly on its cap, which meant the cap choosing the list over the greedy method.

**250 films**

The greedy method produces an order and is sliced into five screens of 50 with no repeats. And after 250 the catalogue takes over.

**Program files:** `experiments/default_list.py` writes `data/default.json`. `export.py` reads it into `films.json`.

---

# What the design still needs

**1. The LLM filter layer.** It is not optional. Finding 5 needs two conditions held at once, and nothing else in the design can do that.

The LLM splits a query into three parts. Named films go to a lookup, hard filters cut the set, the leftover meaning text goes to the embedding.

| Query                     | What it pulls out                |
| ------------------------- | -------------------------------- |
| really scary              | genre: Horror                    |
| something funny and short | genre: Comedy, runtime under 100 |
| fall in love with a city  | setting: a city, tone: appealing |
| a Tom Hanks film          | cast: Tom Hanks, strip "film"    |

**Three conflicts to handle when building it:**

- **The filter can take away what the ranking needs.** Pull "Tom Hanks" out as a filter and the leftover text is "movie", which means nothing. The LLM must be able to return nothing.

- **Confidence needs a big set.** Filter "really scary" down to 738 horror films and every field's gap shrinks. Below a few hundred films the measure stops meaning anything, so skip the auto-weighing and fall back to fixed weights.

- **Temperature was tuned on the unfiltered set.** Filtering could shrink the gaps, and softmax divides the gaps by the temperature. So the temperature has to shrink with them, to amplify the gaps.

**2. Shipping.** Seven vector sets must reach the browser, because finding 7 says the weights are chosen per query. One baked vector would undo it.

| What                        | Size                |
| --------------------------- | ------------------- |
| 7 fields, 384 dims, float32 | 54MB. Too big       |
| Same, as int8               | 13.4MB. Still heavy |
| PCA to 128 dims, then int8  | **4.5MB. Fine**     |

The same PCA transform must be used on the query and on the films. If they differ, the scores still look fine and mean nothing.
