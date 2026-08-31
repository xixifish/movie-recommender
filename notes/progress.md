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
6. The tap loop is untested. 

---

## Open questions

**Q1. How much does each tap count?** `liked`, `disliked`, `interested`.
Not decided. Needs a test.

**Q2. Does the query fade?** After a few taps, does the query keep its weight or
give way to taste? Not decided. Needs a test.

Q1 and Q2 both have a standard starting point. This is a known problem called
**relevance feedback**, and Rocchio's algorithm answers both. See
`docs/03-findings.md`. Will start from these numbers to test. 

**Q3. How do we measure the loop?** Solved for search: one rule per query, in
`experiments/query-rules.md`. Not solved for the loop.

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
