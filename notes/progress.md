# Progress

Where the project stands.
Source of truth for the product is `docs/01-introduction.md`.

Updated 21 Sep 2026

---

## The product

Type an idea, then get N films. Choose `liked` or `disliked` if watched, or `Save` it to watch later. Press refresh. The list moves closer to the user's taste. No sign-in needed.

The saved list can be sent to an email address later.

---

## Settled

| Thing      | Setting                                                                      |
| ---------- | ---------------------------------------------------------------------------- |
| Catalogue  | 4,999 films. One duplicate row removed, `experiments/dedupe.py`              |
| Source     | TMDB `discover`, `vote_count.gte=200`, sorted by `vote_count.desc`           |
| Fields     | genres, tagline, overview, keywords, cast, director, reviews                 |
| Vectors    | One per field. Not one text blob                                             |
| Titles     | Not in any vector. Titles will be handled later with another solution        |
| Model      | `all-MiniLM-L6-v2`, 384 dims                                                 |
| First load | 48 films, six per row at full width. `N_SHOWN` in `App.jsx`                  |
| Refresh    | Replaces the list. Films already seen are gone                               |
| New query  | The saved list stays. But ratings and saved from other queries don't score   |
| Saved list | Kept in the browser, by film id, so it survives a catalogue change           |
| Quality    | multiply `0.5 x quality`, `quality` combines `vote_count` and `vote_average` |
| Weight cap | No single field may take more than 0.35 of the vote                          |
| Screen     | Desktop only for now. `min-width: 700px`, and the card controls need hover   |
| Marks      | `liked`, `disliked`, `saved`                                                 |
| Shipped    | 192 dims, int8, 6.7MB. See finding 15                                        |
| Hosting    | App on Vercel, server on Render. `VITE_API` joins them                       |

---

## Interface

Designed 1 Sep. The rules are in `docs/04-interface.md`: card, lists, refresh,
copy, and the three scales of motion.

**One assumption of using the product.**

Popcorn is a light tool. Someone arrives, finds one or two films for tonight and leaves. So saves are few by design, and ratings are many, because rating is how they steer the list towards those one or two.

That is why `liked` and `disliked` stay on the poster at one click each, while `save` and `overview` fold into one button. Two buttons on a card, not four.

---

## Done

- Fetch. 5,000 films, all six fetched fields (`cast` includes `director`)
- Data check. All fields have good coverage. The lowest is Reviews 83%
- Embed. Seven vector files, 384 dims each. `director` was added on 27 Aug,
  pulled from the crew list that was already fetched
- Search run 1. Fixed weights
- Search run 2. Automatic per-query weights
- Search run `2026-08-31`. Added quality term, `Precision@10: 128/170`, `Recall@10: 14/45`. Recall@50 increases to `26/45`.
- App started 3 Sep. Vite and React. The grid renders, `films.json` and
  `vectors.bin` load in the browser
- Tap loop, 4 Sep. Marks, taste vector, scoring, the seen list. One field first
- All seven fields, 9 Sep. Confidence, automatic weights, quality, combined
- Weight ceiling, 9 Sep. `W_MAX = 0.35`, see finding 12
- `tasteFor` now skips films with no text in a field, 9 Sep
- The card, 11 Sep. Hover, rating pair, three dot menu, overview panel, the
  marked look, and the motion for all of it
- Rise, 13 Sep. The grid animates on refresh, 9ms apart
- The embedding server, 13 Sep. FastAPI, `POST /embed`, same model and
  normalisation as `embed.py`. Checked against `run-2026-08-31-1256`: identical
  vector, identical weights, identical top 10 for "alien movies"
- Search, 14 Sep. The query joins the taste vector as Rocchio's `a` term
- The page, 14 Sep. Header, hero, chips, tabs, both hint bars, the saved list
- Split into components, 14 and 15 Sep. `Search.jsx`, `Card.jsx`, and a css
  file each. `App.jsx` went from 362 lines to 231

- Default film list, 21 Sep. 240 films unlike each other, five screens of 48.
  `experiments/default_list.py`. Finding 14
- Vectors shrunk, 21 Sep. PCA to 192 dims then int8, 53.8MB to 6.7MB, 92% of the
  top 10 unchanged. `experiments/shrink.py`. Finding 15
- Deployed, 21 Sep. App on Vercel, server on Render running the model with ONNX
  instead of torch. TMDB credit in the footer
- A new search starts fresh, 21 Sep. Finding 16. The saved list now survives a
  reload, stored by film id

Results are in `docs/03-findings.md`. Runs are in `experiments/results/`.

---

## Where it stands

1. Search works for topics and names
2. Mood search now works, after the quality term. It scores 37/40.
3. Automatic weights works well. Each query gets its own field weights, with no rule telling it which field matters.
4. Director is a real search angle. The field was added on 27 Aug and works well.
5. LLM is necessary for queries that combine two ideas, like "fall in love with a city", which has never scored above 6/10.
6. The tap loop works in the browser. Marking three Christopher Nolan films
   returned nine Nolan films, with no name typed. The same run showed the
   clumping problem, and the weight ceiling fixed it. Finding 12.
7. The whole loop works end to end. Type an idea, get films, mark them, press
   Refresh, the list moves. Typing "alien movies" on a clean page puts
   _Alien_ (1979) first, which matches the Python run exactly.
8. It is live. The app is on Vercel, the server on Render, and `vectors.bin`
   is 6.7MB instead of 53MB. A search takes 2 to 3 seconds, because the free
   Render plan gives a tenth of a CPU. The server sleeps when unused, so the
   first search after a quiet spell takes much longer.

---

## Open questions

**Q3. How to measure the loop?**

Search was easy to judge. Every query has a rule saying which films count as right, in `experiments/query-rules.md`.

The loop has no right answer. It depends on the person. So the measure has to work without knowing what they want. **Idea**: Count only the films a person has not watched. Of those, what fraction do they save?

**One round tells nothing, but the direction does**

```
round 1   saved 2 of 15 unwatched
round 2   saved 4 of 14 unwatched
round 3   saved 6 of 12 unwatched
```

A rising fraction means the loop is working. A flat one means the taps are doing nothing, whatever the list looks like.

**One limit.** This measures the whole product, not the ranking. A low save rate could mean:

- the ranking is not learning
- the ranking is fine, but the card does not show enough to judge a film by

**A second limit.** A falling fraction can mean two opposite things:

```
round 1   saved 2 of 15
round 2   saved 2 of 14
round 3   saved 0 of 12
```

Either the ranking stopped learning, or the user already had four films for tonight
and was finished. The product is built for the second one, so it is not failure. It's
necessary to confirm with the user during the user test session.

**How to tell those apart, later.** An A/B test.

**Q4. Is 5,000 films the right size?**

Set for now. Bigger works technically.
10,000 is a 9MB download and a 25ms rerank. The blocker is the vote floor, which drops from 986 to about 450 and makes finding 8 worse. If it needs to grow later, split retrieval from reranking. Worked out in `docs/02-method.md`, section 9.

**Q6. What should the first list be?**

There should be a default film list for the user to mark from, and it should be films unlike each other rather than the most voted (current version), chosen by rules. And the rules haven't been confirmed yet.

---

Questions now answered:

- _Do reviews help?_ Yes. 83% coverage, and they earn real weight in run 2.
- _How should cast be used?_ As a normal field. Automatic weights solves it and the people's names search works well.
- _How much does each tap count?_ The numbers are set. In `rank.js`: W_QUERY:
  a = 1.00, W_LIKED: b = 0.75, W_SAVED: s = 0.60, W_DISLIKED: c = 0.15, stored
  as -0.15 and added. Recorded in finding 13, 15 Sep 2026. Whether they are the
  right numbers is still open, and needs people. See Q3.
- _Does the query fade?_ No, and nothing carries into the next search either.
  Decided 14 Sep that marks would carry across searches. Reversed 21 Sep. See
  finding 16 for the evidence: searching "really scary" after saving
  inspirational films returned _The Notebook_ and _The Blind Side_.
- _Should names be in vectors at all?_ The titles of the movies are not included in the vector, but the cast and crew's names are used. See finding 9 and `docs/02-method.md` step 5.

---

## Next

Items 1 to 4, shrinking the vectors, the default list, deploying, and the TMDB
credit, were all done on 21 September. See findings 14, 15 and 16.

1. **Test the tap loop with 5 to 10 people.** Tests whether the four tap
   numbers are right. Q3 says how to measure it. Do it on the live site.

2. **Send the saved list to an email.** The last thing in
   `docs/01-introduction.md` that has never been built. Needs the server, an
   email service, and a form for the address. The button and the icon are in;
   `sendEmail` is empty.

3. **The LLM filter layer.** Finding 5 needs two conditions held at once, and
   nothing else in the design can do that.

4. **A mobile version.** Two different jobs. The layout half is one media query:
   less padding, the section row stacking, the `min-width` removed.

   The controls half is a design question, and it is the hard part. Without
   hover there is no way to mark a film.

5. **A confidence floor on `director` and `genres`**, after adding more name
   queries. Least urgent, now that the ceiling is in.

6. Consider adding TV shows to the catalogue

**Baseline: 128/170 (75%), run 2026-08-31-1256.** Every change from now on gets
measured against that.
