# Progress

Where the project stands.
Source of truth for the product is `docs/01-introduction.md`.

Updated 31 Aug 2026

---

## The product

Type an idea, then get 50 films. Choose `watched` or `interested` on a few films. Press refresh. The list moves closer to the user's taste. Users can save the ones that interest them. No sign in. 

The interested-film list can be sent to an email address later. 

---

## Settled

| Thing | Setting |
| --- | --- |
| Catalogue | 5,000 films |
| Source | TMDB `discover`, `vote_count.gte=200`, sorted by `vote_count.desc` |
| Fields | genres, tagline, overview, keywords, cast, director, reviews |
| Vectors | One per field. Not one text blob |
| Titles | Not in any vector. Titles will be handled later with another solution |
| Model | `all-MiniLM-L6-v2`, 384 dims |
| First load | 50 films |
| Refresh | Replaces the list. Films already tapped are gone |
| New query | Starts a fresh round |
| Saved list | Lost on reload for now |
| Quality | multiply `0.5 x quality`, `quality` combines `vote_count` and `vote_average` |

---

## Interface

Designed 1 Sep. The rules are in `docs/04-interface.md`: card, lists, refresh,
copy, and the three scales of motion.

**One assumption of using the product.** 

Popcorn is a light tool. Someone arrives, finds one or two films for tonight and leaves. So saves are few by design, and ratings are many, because rating is how they steer the list towards those one or two. 

That is why `liked` and `disliked` stay on the poster at one click each, while `save` and `overview` fold into one button. Two buttons on a card, not four. 

Nothing open. Every case is settled and written down.

---

## Done

- Fetch. 5,000 films, all six fetched fields
- Data check. All fields have good coverage. The lowest is Reviews 83%
- Embed. Seven vector files, 384 dims each. `director` was added on 27 Aug,
  pulled from the crew list that was already fetched
- Search run 1. Fixed weights
- Search run 2. Automatic per-query weights
- Search run `2026-08-31`. Added quality term, `Precision@10: 128/170`, `Recall@10: 14/45`. Recall@50 increases to `26/45`.

Results are in `docs/03-findings.md`. Runs are in `experiments/results/`.

---

## Where it stands

1. Search works for topics and names
2. Mood search now works, after the quality term. It scores 37/40. 
3. Automatic weights works well. Each query gets its own field weights, with no rule telling it which field matters. 
4. Director is a real search angle. The field was added on 27 Aug and works well. 
5. LLM is necessary for queries that combine two ideas, like "fall in love with a city", which has never scored above 6/10.
6. The tap loop is untested. Design started 1 Sep.

---

## Open questions

**Q1. How much does each tap count?** Three numbers, not two, because `saved`
is a signal as well as an outcome.

```
new query = a * original query
          + b * (average of the liked)
          + s * (average of the saved)
          - c * (average of the disliked)
```

Starting point: `b = 0.75`, `c = 0.15`, `s = 0.6`. `c` is small because a
dislike says much less about what someone does want. `s` is a guess, pulled two
ways: a save is weaker evidence than a like, since it is based on a poster and
three lines, but the saved list is what the user actually leaves with.

A film can be both liked and saved. It then appears in both averages and pulls
harder, which needs no special case in the code. Disliked and saved together has
no coherent meaning and should be blocked.

**Q2. Does the query fade?** After a few taps, does the query keep its weight or
give way to taste? Not decided. Needs a test.

Q1 and Q2 both have a standard starting point. This is a known problem called
**relevance feedback**, and Rocchio's algorithm answers both. See
`docs/03-findings.md`. Will start from these numbers to test. 

**Q3. How to measure the loop?** Solved for search: one rule per query, in
`experiments/query-rules.md`. A candidate for the loop, worked out 1 Sep:

**Of the films a user has not seen, what fraction do they save?** That takes
their viewing history out of it. A film buff rates a lot and saves little because
they have seen everything, which says nothing about the ranking.

Then the real test: **does that fraction rise with each refresh?**

```
round 1   saved 2 of 15 unseen
round 2   saved 4 of 14 unseen
round 3   saved 6 of 12 unseen
```

A rising fraction is the loop working. A flat one means the taps are doing
nothing, whatever the list looks like.

**One limit.** This measures the whole product, not the ranking. A low save rate
could be a bad list, or a card that makes films hard to judge. The scored runs
measure the ranking alone. Two measures, two jobs.

**Q4. Is 5,000 films the right size?** Set for now. Bigger works technically.
10,000 is a 9MB download and a 25ms rerank. The blocker is the vote floor,
which drops from 986 to about 450 and makes Finding 8 worse. If it needs to grow later, split retrieval from reranking. Worked out in `docs/02-experiment-plan.md`, section 9.

**Q5. Should names be in vectors at all?** The titles of the movies are not included in the vector, but the cast and crew's names are used. 

See Finding 9 and `docs/02-experiment-plan.md` step 5.

**Q6. The searching results are hard to improve.** Some queries cannot get good results naturally, so it's worth considering whether the product should show a default film set before any query.

---

Two old questions are now answered:

- *Do reviews help?* Yes. 83% coverage, and they earn real weight in run 2.
- *How should cast be used?* As a normal field. Automatic weights solves it and the people's names search works well. 

---

## Next

1. Design and build
2. Test the tap loop. Answers Q1 and Q2
3. Try a confidence floor on `director`, after adding more name queries
4. Build the LLM filter layer
5. Shrink the vectors and ship

**Baseline: 128/170 (75%), run 2026-08-31-1256.** Every change from now on gets
measured against that.
