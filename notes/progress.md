# Progress

Where the project stands.
Source of truth for the product is `docs/01-introduction.md`.

Updated 27 Aug 2026

---

## The product

Type an idea, then get 50 films. Choose `watched` or `interest` on a few of films. Press refresh. The list moves closer to the user's taste. Users can save the ones interest them. No sign in. 

The interested-film list can be sent to an email address later. 

---

## Settled

| Thing | Setting |
| --- | --- |
| Catalogue | 5,000 films |
| Source | TMDB `discover`, `vote_count.gte=200`, sorted by `vote_count.desc` |
| Fields | genres, tagline, overview, keywords, cast, director, reviews |
| Vectors | One per field. Not one text blob |
| Titles | Not in any vector. Titles will be handled later with other solution |
| Model | `all-MiniLM-L6-v2`, 384 dims |
| First load | 50 films |
| Refresh | Replaces the list. Films already tapped are gone |
| New query | Starts a fresh round |
| Saved list | Lost on reload for now |

---

## Done

- Fetch. 5,000 films, all seven fetched fields
- Data check. All fields have good coverage. The lowest is Reviews 83%
- Embed. Seven vector files, 384 dims each. `director` was added on 27 Aug,
  pulled from the crew list that was already fetched
- Search run 1. Fixed weights
- Search run 2. Automatic per-query weights

Results are in `docs/03-findings.md`. Runs are in `experiments/results/`.

---

## Where it stands

**Search works for topics.** vampire, time travel, heist, aliens. Clean lists.

**Search fails for moods.** The model reads how strong a feeling is, not which
way it points. Measured on the model itself, "comforting" is closer to
"disturbing" (0.54) than to "heartwarming" (0.50).

Better wording does not fix it, and neither does the cheap filter: picking
genres by vector similarity ranks Horror 4th and Comedy 5th for "comforting".
This needs an LLM, which makes the LLM required rather than an improvement.

**Weights must change per query.** "Tom Hanks" needs cast high. "vampire" needs
cast near zero. Automatic weighting fixed this. It also let obscure films in.

**The method generalises.** Adding `director` as a seventh field fixed
"a Christopher Nolan movie" and "Wes Anderson", both 0/10 to 10/10, with no
change to the weighting code. But it leaks: a shared first name is enough, and
one director's whole filmography moves together. See Finding 10.

**The tap loop is untested.** No experiment covers it yet. This is the gap.

---

## Open questions

**Q1. How much does each tap count?** `liked`, `disliked`, `interested`.
Not decided. Needs a test.

**Q2. Does the query fade?** After a few taps, does the query keep its weight or
give way to taste? Not decided. Needs a test.

Q1 and Q2 both have a standard starting point. This is a known problem called
**relevance feedback**, and Rocchio's algorithm answers both. See
`docs/03-findings.md`. Start from those numbers, then test.

**Q3. How do we measure the loop?** Solved for search: one rule per query, in
`experiments/query-rules.md`. Not solved for the loop.

**Q4. Is 5,000 films the right size?** Set for now. Bigger works technically.
10,000 is a 9MB download and a 25ms rerank. The blocker is the vote floor,
which drops from 986 to about 450 and makes Finding 9 worse. If it needs to
grow later, split retrieval from reranking. Worked out in
`docs/02-experiment-plan.md`, section 8.

**Q5. Should names be in vectors at all?** The plan says no titles in any
vector, because a name is a fact and a vector cannot match facts exactly. But
`cast` and `director` put two kinds of name in vectors anyway.

It half works. Nolan and Wes Anderson score 10/10. But "Tom George" scored on
"Tom Hanks", because a vector only sees similar-looking text. It cannot tell two
people apart.

So the design is inconsistent: films get a lookup, people get a vector.

**For now, keep them as vectors.** They work, they need no extra machinery, and
they generalise for free. The name lookup has to be built anyway, for titles.
Once it exists, test whether people belong in it too.

See Finding 10 and `docs/02-experiment-plan.md` step 5.

**Q6. The searching results are hard to improve.** Some queries cannot get good results natually, so it's worth to consider if the product displays the default film set without any query?

---

Two old questions are now answered:

- *Do reviews help?* Yes. 83% coverage, and they earn real weight in run 2.
- *How should cast be used?* As a normal field. Cast alone scored 0.729 on
  "Tom Hanks". The field was fine. The weight was wrong.

---

## Next

1. Add a quality term, so known and well-liked films rise
2. Try a confidence floor on `director`, after adding more name queries
3. Test the tap loop. Answers Q1 and Q2
4. Design
5. Build the LLM filter layer
6. Shrink the vectors and ship

**Baseline: 125/170 (73%), run 2026-08-30-1411.** Every change from now on gets
measured against that.

Why this order.

**Step 1 first, because it is the widest problem.** Must-appear is about 12 of
45. "something funny" and "really scary" both scored 10/10 with no must-appear
film at all. Perfect precision, almost no recall. That affects every query.
`Date Movie`, rated 4.27, at rank 4 shows `vote_count` alone will not fix it, so
try `vote_average` too.

**Step 2 second, because it is narrower.** The director field clearly damages one
query, putting *The Shining* at rank 2 for "a good movie for a bad day". It also
needs more name queries before the floor can be set: right now there is only one,
so any cut-off would be fitted to a single example.

Step 3 tests the product itself, and it is cheap, because it needs no new data.
Steps 5 and 6 are big builds, and both get easier once the ranking is settled.
