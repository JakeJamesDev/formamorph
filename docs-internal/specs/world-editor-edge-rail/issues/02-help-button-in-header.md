# 02: Header Row: Help Button And Square Controls

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: moving one control between two rows of the same view, two class changes in the header row, a guide note, and harness tests; small and contained.

From the prototype branch `prototype/world-editor-tabs`, commits fdc2f52c and 47bcdfe1.

## What to build

The `?` help button renders in the World Editor's header row, right of Find, on desktop and mobile (Q7). Its topic still follows the active tab and it still remounts per topic so each tab's nudge reads its own seen state. The row above the list is the List Editor's toolbar alone; Overview, which has no list, renders no row, so its form starts under the header.

The World Editor guide's note on where the `?` sits changes to the header row, right of Find. Take Me There's route to Find keeps landing. One changelog fragment, Minor Added, 👤; if ticket 01's fragment already exists, this is a second line in the same fragment file's bucket.

The back arrow draws as a plain ghost icon with no outline, and every icon button in the header row keeps its square size and never shrinks, so Find is not squeezed when the row gets tight (Q13).

Mobile checked at 375px: the header row with the back arrow, Find, the Bench flask, Simple/Advanced and the `?` fits without wrapping or overflow, and Find is square.

## Acceptance criteria

- [ ] Desktop: the `?` is in the header row directly after Find; the list toolbar has no `?`.
- [ ] Mobile: the same, and the header fits at 375px.
- [ ] The back arrow has no border; Find measures square at 375px with every header control present.
- [ ] Overview renders no toolbar row; the form is the first thing under the header.
- [ ] Switching tabs changes the `?`'s topic; a tab without a topic hides the button.
- [ ] The Find route from Take Me There still lands on the Find button.
- [ ] Guard bites: putting the `?` back in the toolbar turns the header test red.
- [ ] World Editor guide note updated; changelog fragment written.
- [ ] Gates green; graph updated.

## Blocked by

- None (can start immediately)
