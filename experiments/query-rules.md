# Query rules

The **rule** is the yes or no test you apply to every film in the top 10.
The **must appear** films are a sanity check. If they are missing, something is
wrong even when the rest looks fine.

Record: accepted out of 10, the top score, and whether the must-appear films
turned up.

Write nothing after seeing results. You will bend the rule to fit.

---

## Topic

Expect high scores. This is what embeddings do well.

**vampire**
- rule: vampires are in it and matter to the plot
- must appear: Interview with the Vampire, Let the Right One In, What We Do in the Shadows

**time travel**
- rule: moving through time drives the plot
- must appear: Back to the Future, Looper, 12 Monkeys
- decide: does a time loop count?

**courtroom drama**
- rule: a trial is the centre of the film, not one scene
- must appear: 12 Angry Men, A Few Good Men, To Kill a Mockingbird

**heist**
- rule: a planned robbery is the centre of the plot
- must appear: Heat, Ocean's Eleven, Inside Man

**alien movies**
- rule: life from outside Earth appears and matters to the plot
- must appear: Alien, Arrival, E.T.

**survival in the wild**
- rule: staying alive in nature is the main problem
- must appear: The Revenant, Into the Wild, Cast Away

**a road trip**
- rule: the road journey is the shape of the film, not one scene in it
- must appear: Little Miss Sunshine, Thelma and Louise, Rain Man

---

## Mood

The hard ones. Expect low scores.

**makes me cry**
- rule: films known to make viewers cry
- must appear: Grave of the Fireflies, The Green Mile, Marley and Me

**something funny**
- rule: a comedy whose main job is to make you laugh
- must appear: Airplane!, The Hangover, Superbad
- decide: dark comedy counts

**really scary**
- rule: horror built to frighten. A tense thriller does not count
- must appear: The Exorcist, Hereditary, The Conjuring

**a good film for a bad day**
- rule: warm, easy, ends well. You feel better after it
- must appear: Paddington 2, Amelie, The Princess Bride
- note: no plot summary says "this will cheer you up". Expect it to fail the same way "makes me cry" does

---

## Theme

The interesting middle. No prediction.

**friendship that falls apart**
- rule: a friendship breaks down, and the break is the story
- must appear: The Banshees of Inisherin, The Social Network, Stand by Me

**fall in love with a city**
- rule: a real city is a main presence, and the film makes it appealing
- must appear: Midnight in Paris, Lost in Translation, Roman Holiday
- watch: films merely set in a city. Every film is set somewhere

---

## Special cases

Score these three on their own.

**gritty atmospheric mystery films, Memories of Murder, Zodiac**
- rule: slow, dark investigation, heavy atmosphere, often no clean answer
- must appear: Prisoners, Se7en, Zodiac
- this is "more like this", not search. The named films cannot be matched by name, since there is no title in the vectors. Judge the style match only

**Chinese civil war**
- rule: set during the Chinese civil war, roughly 1927 to 1949
- must appear: expect nothing
- tests the catalogue, not the model. The set is 98% English

**a Tom Hanks film**
- rule: Tom Hanks is in the main cast
- must appear: Forrest Gump, Cast Away, Saving Private Ryan
- tests the cast field only. Says nothing about meaning search


