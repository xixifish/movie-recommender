# Interface

How the interface behaves, and how it moves. A reference for building.

Updated 17 Sep 2026

---

## The page (desktop)

| Thing     | Setting |
| --------- | ------- |
| Min-width | 800px   |
| Max-width | 1280px  |

## The card

| Thing    | Setting                                                     |
| -------- | ----------------------------------------------------------- |
| Width    | 180px, about 6 per row on a laptop                          |
| Rating   | `liked` and `disliked`, bottom centre, one click            |
| Interest | three dots, top right, opens to close, overview, save       |
| Overview | a panel over the card, opened and closed by the same button |

**Hovering card shows the marking buttons.** To simplise the card, collpase `overview` and `save` into one button, not as convenient as rating buttons. The design reason is in `progress.md`.

**Interaction**:

1. Both button groups collapse to one button after marking to keep the page simple and clean. In addition, it displays the important markings only on a greyed post, to help users glance the list.
2. **Clicking a marker again undoes it** and returns the card to normal.

**A card can be rated and saved at once.** The two markers sit in different places and do not collide.

---

## Lists

The cards in `recommendations` and `saved` are designed same.

**The saved list can be sent to an email address.**

---

## Refresh

**It always works.** Someone may just want a different list without expressing any taste. It is never blocked. If the user didn't mark any films, refreshing will load the next 50 films from the scored list.

---

## Three scales

Motion size should match how big the change is. These must not all run at the same speed, or they read as equally important.

| Scale  | What it is                          | Duration     |
| ------ | ----------------------------------- | ------------ |
| Small  | a button group expands or collapses | 150 to 200ms |
| Medium | a card greys and takes its marker   | 200 to 250ms |
| Large  | the whole grid swaps                | 300 to 400ms |

---

## Small: the button groups

**Interest.** One button, hover visible. Tapping it expands to three: close, overview, save. Tapping save or overview collapses back to one, and the one left is the action that was chosen.

**Overview.** When open, the overview button moves up to where the interest button sits and shows an active state. Tapping it again closes the panel and collapses to one button, the same as save.

The movement is the point. It says this is a different mode, and this is the way out. Keep it near 250ms so the eye can follow. Under about 200ms it does not read as a move, it just appears somewhere else.

**Rating.** Two buttons, hover visible, one tap. After choosing, the chosen button slides horizontally to the centre and shows an active state. The other one goes.

---

## Medium: a card is marked

The card greys. The collapsed button stays where it was and becomes the marker, so there is no second badge to design.

```
saved              button top right, card grey
liked or disliked  button bottom centre, card grey
```

A card can carry both.

---

## Large: the grid refreshes

The animation plan for the grid refreshing is rising. Each card fades and lifts, 9ms apart. 50 cards at 9ms of stagger is 450ms on top of the duration.

**No spinner.** The rerank runs locally in about 10ms, so nothing is waiting. A loading state would say the opposite of what the architecture is for.

---

## Rules for all of it

**Animate only `transform` and `opacity`.** Both run on the GPU.

**A second press interrupts the first.** Do not queue. The loop is meant to feel instant, and queued animations make it feel like waiting.

**`prefers-reduced-motion`.** Nothing moves. The active state carries the signal on its own. This matters most for the overview button, which without animation would teleport, and that is worse than not moving at all.
