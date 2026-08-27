# Progress

Where the project stands.
Source of truth for the product is `docs/01-introduction.md`.

Updated 27 Aug 2026

---

## The product

Type an idea. Get 50 films. Tap a few. Press refresh. The list moves closer to
your taste. Save the ones you want. No sign in.

The tap loop is the point. Search is only how the loop starts.

---

## Settled

| Thing | Setting |
| --- | --- |
| Catalogue | 5,000 films, fixed |
| Source | TMDB `discover`, `vote_count.gte=200`, sorted by `vote_count.desc` |
| Fields | genres, tagline, overview, keywords, cast, reviews |
| Vectors | One per field. Not one text blob |
| Titles | Not in any vector. Names get their own lookup |
| Model | `all-MiniLM-L6-v2`, 384 dims |
| First load | 50 films |
| Refresh | Replaces the list. Films already tapped are gone |
| New query | Starts a fresh round |
| Saved list | Lost on reload for now |

---

## Done

- Fetch. 5,000 films, all six fields
- Data check. All fields have good coverage. Reviews 83%, the lowest
- Embed. Six vector files, 384 dims each
- Search run 1. Fixed weights
- Search run 2. Automatic per-query weights

Results are in `notes/findings.md`. Runs are in `experiments/results/`.

---

## Where it stands

**Search works for topics.** vampire, time travel, heist, aliens. Clean lists.

**Search fails for moods.** The model reads how strong a feeling is, not which
way it points. "Comforting" returns horror. This needs a filter, not better
wording.

**Weights must change per query.** "Tom Hanks" needs cast high. "vampire" needs
cast near zero. Automatic weighting fixed this. It also let obscure films in.

**The tap loop is untested.** No experiment covers it yet. This is the gap.

---

## Open questions

**Q1. How much does each tap count?** `liked`, `disliked`, `interested`.
Not decided. Needs a test.

**Q2. Does the query fade?** After a few taps, does the query keep its weight or
give way to taste? Not decided. Needs a test.

Q1 and Q2 both have a standard starting point. This is a known problem called
**relevance feedback**, and Rocchio's algorithm answers both. See
`findings.md`. Start from those numbers, then test.

**Q3. How do we measure the loop?** Solved for search: one rule per query, in
`experiments/query-rules.md`. Not solved for the loop.

**Q4. Is 5,000 films the right size?** Set for now.

Two old questions are now answered:

- *Do reviews help?* Yes. 83% coverage, and they earn real weight in run 2.
- *How should cast be used?* As a normal field. Cast alone scored 0.729 on
  "Tom Hanks". The field was fine. The weight was wrong.

---

## Next

1. Add a quality term, so known films rise and obscure ones fall
2. Test the tap loop. Answers Q1 and Q2
3. Design
4. Build the LLM filter layer
5. Shrink the vectors and ship

Why this order: step 1 fixes a known bug. Step 2 tests the product itself, and
it is cheap, because it needs no new data. Steps 4 and 5 are big builds, and
both get easier once 1 and 2 are settled.
