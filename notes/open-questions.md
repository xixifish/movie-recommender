# Open Questions — Movie Recommender

Decisions still to make, and decisions already settled.
Planner is tracked separately.

---

## PART 1 — STILL OPEN

### Scope

**Q1. What does "done" mean here?**
Current answer: the Figma file is the spec. Build every screen, then stop.
Nothing in the file, not in v1.
Caveat: interaction timing (Q2, Q3, Q4) can't be resolved in Figma and will change
once it's running. That's normal, not a broken spec.

### Interaction — decide by feel during the build, not now

**Q2. One tap or two?**
Current design: tap → watched / interested, then watched → like / dislike.
Alternative: liked / disliked / interested all visible, one tap each.
Two-tap is more elegant. One-tap is twice as fast, and speed is the point.
Prototype both.

**Q3. How much weight does "interested" carry, exactly?**
Settled that it's a real preference, not a fraction of one (see Part 2).
Still to tune: its weight relative to watched-and-liked, and how much lighter
the implicit negatives should be.

**Q4. How strongly do results change per refresh?**
Too little feels dead. Too much feels random.
Tune by feel.

### Data and setup

**Q5. TMDB attribution — exact wording and logo placement.**
They require their logo plus a line saying the product uses their API but isn't
endorsed by them. Copy the current wording from their site into the footer.
Still to confirm: that storing *derived embeddings* of their descriptions is fine.
Almost certainly yes, but check.

**Q6. Does `all-mpnet-base-v2` actually beat `all-MiniLM-L6-v2`?**
Untested properly — catalogue size changed at the same time, so the comparison was
confounded. MiniLM is 5x smaller and faster. Re-run both on the same 5,000 catalogue
with the final blob. If they're close, use MiniLM.

**Q7. Where should the score floor sit?**
Below ~0.25 the model is guessing. Ten weak results look broken; three good ones look
confident. Decide the cutoff, and what to show below it.

**Q8. Are the cast/keyword limits (4 and 10) right?**
Both were guesses. Try 8 cast, 20 keywords. Try removing the limits once to see how
badly it degrades — that teaches more than the working version.

**Q9. Which frontend stack?**
Whatever I'm fastest in. Not the place to learn something new.
Note: Motion (Framer Motion) `layoutId` / `LayoutGroup` for the reorder animation.
That effect is most of what makes it feel expensive.

**Q10. Where do I host it?**
Vercel / Netlify free tier. Static, plus one serverless function for query embedding.

### Presentation

**Q11. Have I put it in front of a few real people?**
Watching someone else tap through it finds the awkward parts faster than self-testing,
and it's the only way to settle the tune-by-feel questions honestly.

**Q12. Have I written a case study, not just a README?**
Problem → what I tried → what I changed and why.
This is my design background showing. Most dev portfolios don't have it.

---

## PART 2 — SETTLED

### Project scope

- Worth doing *because* of the interaction quality, not the algorithm.
  A mediocre version is the common student project. Execution is the whole point.
- Figma design file is complete before coding, and is public and linked from the README.
  Where the build diverges from the design, note why — those moments show judgement.

### Architecture

- **Fully browser-side, curated catalogue (~5,000 movies).**
  ~1.3MB of vectors loaded once, then every rerank is instant.
- Rationale for the write-up: the latency budget for the click loop is near zero,
  so computation moves to the client and the catalogue is bounded to make that possible.
  State this explicitly — it's a decision, not a shortcut.
- No backend for the core loop. One serverless function for query embedding only.
- Keep scoring logic in **one isolated module** — preference state in, ranked list out.
  If it's tangled into components, moving it server-side later means a rewrite.
- A server would add reach and depth (bigger catalogue, saved sessions), *not* speed.
  Every click would gain a round trip. Don't add one expecting it to feel better.

### Search

- **Embeddings, not keyword search.** One text blob per movie (overview, genres,
  keywords, cast) → embedding, precomputed offline.
- Query embedded at runtime via a serverless function (~100–200ms).
  Acceptable: users tolerate a beat after pressing enter. They don't after tapping a poster.
- Movie vectors and the user preference vector live in the **same space**,
  so the final score is a blend of query similarity + preference similarity.
  One representation, two uses.
- **Blend shifts over time:** query dominates at zero ratings, preference gains weight
  as ratings accumulate. Otherwise the ranking stops responding to clicks.
- Keyword/fuzzy search alone won't work — it can't handle "makes me cry."

### LLM use

- **LLM parses the query. It does not rank.**
  As a ranker it hallucinates titles, favours famous films, and can't see the catalogue.
- Parse free text into structured filters:
  `{ semantic: "funny science fiction", yearFrom: 1990, yearTo: 1999, maxRuntime: 110 }`
  Filter hard on the numbers, rank semantically on the rest.
- To hide the 1–2s latency: show embedding results immediately, apply filters when
  the LLM returns. Or only call it when the query contains constraints.
- Optional, build last: one-line reason per result ("you liked two other slow-burn thrillers").
- Worth saying in the write-up that I chose *not* to use an LLM for ranking.
  Knowing when not to use one is the part most portfolios get wrong.

### Data pipeline

- **Rate limits don't affect the architecture.** Fetching is a one-off script on my
  laptop (build time). The browser never calls the TMDB API — it loads precomputed
  files. Posters do load from TMDB's image CDN at runtime, which is separate and normal.
- **The math is comfortable.** `append_to_response` combines up to 20 sub-resource
  calls (credits, keywords, images) into one request, so it's ~1 request per movie.
  5,000 movies at 20 req/sec ≈ 4 minutes. At a deliberately polite 5/sec, under 20.
- Build in a delay between requests, retry on `429` with a pause, and save progress
  in batches so a crash doesn't cost the whole run.
- **Getting the list:** discover endpoint sorted by popularity, 20 per page = 250
  requests for the ID list, then one detail call each. (Daily ID exports exist at
  files.tmdb.org but only contain IDs and titles — still need the detail calls.)

### Storage — three files, not CSV

CSV can't hold TMDB's nested arrays (genres, cast, keywords) without ugly flattening.

1. **Raw JSON, stays on my laptop.** Exactly what TMDB returned, untouched.
   If I change my mind about which fields matter, no re-fetching.
2. **Display JSON, ships to browser.** id, title, year, poster path, runtime, overview.
   ~2–3MB for a few thousand movies, well under 1MB gzipped.
3. **Vectors as a binary file, ships to browser.** 5,000 × 64 as 8-bit ints = 320KB,
   read straight into a typed array with no parsing. The same data as JSON numbers
   would be several MB and take real time to parse. **This is why the click loop
   feels instant** — worth doing properly.

Also: record the fetch date, and keep the build script in the repo. It's the part of
this project that reads as data engineering.

### Vectors — embeddings, not hand-built

- **Embeddings, decided.** Hand-built genre/decade vectors can't match "makes me cry"
  or "underrated sci-fi" — I'd be forced back to genre chips, which I rejected.
  The search box is the front door; protect it.
- Cost is low: embed once, offline, in the build script. API = a few dollars and
  minutes. Or sentence-transformers locally on CPU = free, ~30 min, fully offline.
- **But use structured fields too.** Genres, decade, runtime are facts, not meanings,
  and embeddings handle them badly. They belong as filters and small score adjustments
  alongside the semantic similarity. This is what the LLM query parser feeds.
- **PCA down to 64–128 dims.** Raw embeddings are 384 or 768. Reduce them to get the
  small file above.
- ⚠️ **The one thing that can quietly break:** the query must be reduced with the
  *same* PCA transform as the movies. If they differ, similarity scores become
  meaningless while still looking plausible. Save the PCA parameters alongside the
  vectors so both sides use the same transform.

### Embedding experiment — results (300 then 5,000 movies)

Throwaway test: `fetch.py` + `search.py`, sentence-transformers, results in the terminal.
The approach works. Found three real problems, all fixed, plus one that can't be.

**Finding 1 — catalogue quality mattered more than anything else.**
At 300 movies, obscure films with thin descriptions appeared in *every* search.
Short text → vague vector → sits near the middle of the space → mildly close to everything.
Fix: `vote_count.gte: 200` and `sort_by: vote_count.desc`.
`popularity.desc` returns what's trending *right now* — the list was full of unreleased
2026 titles. `vote_count.desc` returns films people have actually seen.
Same query, same model, completely different quality. Fix the catalogue before
blaming the model.

**Finding 2 — coverage, not the model, caused bad results.**
At 300 movies "vampire" returned Twilight, then random dark films — there was only one
vampire movie to find, so it fell back to vague mood matching.
At 5,000: Underworld, Blade, Nosferatu, Vampire Academy, Thirst. All ~0.48.
Low scores across a whole result set usually mean *nothing good exists in the catalogue*.

**Finding 3 — the title in the blob caused word-matching, not meaning-matching.**
Title first: "makes me cry" → *Boys Don't Cry*. "something funny" → *Funny Games*
(a brutal thriller). "sad movies" → *The Sadness* (extreme horror). "fantasy" →
*Fantasy Island*. The title is short and sits first, so it dominates a 1–2 word query.
Moving it after keywords helped. **Removing it entirely was best:**
"makes me cry" → My Life as a Zucchini, Manchester by the Sea, Paris Texas, The Color Purple.
**Decision: no title in the blob.** Fuzzy title search handles name lookups separately.
Each part does one job.

**Score bands observed** (`all-mpnet-base-v2`, 5,000 movies):
- 0.45+ — confident and correct ("vampire" 0.50, "office" 0.52)
- 0.30–0.45 — decent
- under 0.25 — guessing ("encouraged" 0.17–0.21, random spread)

**Emotional queries are structurally weaker than subject queries.**
"vampire" hits 0.50; "makes me cry" tops out at 0.26. Subject matter is stated in the
text. Tone mostly isn't. A limit of embedding plot descriptions, not a bug.
Design around it — starter tips should favour queries the model handles well.

**⚠️ Finding 4 — the model can't separate tone from subject matter.**
Even with titles removed and a clean 5,000 catalogue:
- "sad movies" → Martyrs, A Serbian Film, Climax, Terrifier 2 (extreme horror)
- "something funny" → Terrifier 2, Carnage
Films *about* suffering and films that *make you feel* sad look similar in text.
**No embedding fix exists. This needs genre filtering.**
Which is what the LLM query parser is for:
```json
{ "semantic": "emotional story about loss",
  "includeGenres": ["Drama"],
  "excludeGenres": ["Horror"] }
```
Filter first, rank semantically within the result.
The experiment confirmed the planned architecture rather than changing it: embeddings
handle meaning, structured filters handle facts, neither works alone.

**Final text blob:** genres + tagline + overview + top 4 cast + top 10 keywords.
No title. (4706/5000 movies had a tagline, so it's worth including.)

**For the case study:** "semantic search alone returns *A Serbian Film* for 'sad movies'"
is concrete and evidence-backed — tested it, found a real failure, designed the fix.

### The interaction loop

1. Land on a search box with **starter tip buttons** — phrases, not genres.
   e.g. "something funny and short", "underrated sci-fi", "makes me cry".
   Clicking one fills the input (so the user sees how it works) and searches.
   Tips stay reachable so the empty state is never empty.
2. Posters appear below.
3. Tap a movie → watched (→ like / dislike) or interested.
4. **Rated cards stay in place** in a distinct state. Nothing moves while rating.
   Not removed — removal kills undo and hides progress.
   Dim + small badge; disliked dims harder so the eye skips it.
5. **Refresh is a button**, not an automatic timer. It accumulates a count,
   e.g. "Refresh (8)" — the count gives the user a reason to press it.
   Chosen over an automatic pause because the user keeps control of when
   the grid moves, and the button makes the batching visible rather than magical.
6. On refresh: rated movies clear out, new ranking animates in — one dramatic
   batched movement rather than constant disorienting shuffle.
7. Interested movies collect in a separate list the user can keep.

### Ranking details

- Preference vector starts at zero, nudged toward/away from each rated movie's vector.
- Decay old ratings slightly so recent clicks matter more.
- **"Interested" is the primary signal, not a side action.** Most users won't have
  watched many of the recommended films, so the watched → like/dislike path will be
  the rare one. Weight interested as a real preference, not a fraction of one.
  Interpretation differs though: interested = "this appeals from the poster and
  description", which is a judgment about presentation, not the film. Watched-and-liked
  stays the strongest signal because it's rarer and better informed.
- **Negative signal comes from implicit feedback, not a button.**
  Movies shown and passed over are a weak negative — considered, not tapped.
  Weight lightly, a fraction of a stated preference. Accumulates for free.
  Ideally track what actually scrolled into view; approximating with "everything in
  the batch at refresh time" is fine to start.
- **The interested list is the product's main output.** Arrive with nothing, tap for
  two minutes, leave with a watchlist. Stronger pitch than "reorders results" —
  reflect that in how prominent the list is.
- **MMR (Maximal Marginal Relevance)** for diversity, or five clicks collapses the
  results into near-identical films. ~10 lines of code.
- Drop already-rated movies from results on refresh.

### Rejected along the way

- ~~Pop-up asking "rerank now or keep rating?"~~ — an extra decision every action,
  answered identically within three taps, and it covers the grid it's meant to protect.
  Batching solved the same problem with no interruption.
- ~~Rated movies disappear on tap~~ — no undo, no visible progress.
- ~~Genre chips as starter tips~~ — every movie site does this, and it undersells
  what free-text search can do.
- ~~An explicit "not interested" button~~ — adds workload, and asking someone to judge
  a film they haven't seen produces unreliable signal. Unreliable signal is worse than
  none. Implicit negatives from impressions solve the same problem for free.
  Worth naming this choice in the write-up: most recommenders rely on implicit negatives
  precisely because almost nobody clicks dislike.
