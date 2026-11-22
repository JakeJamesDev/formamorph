# 06: Opening Condition

Status: ready-for-agent
Blocked by: 01, 03, 04, 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A new Opening Condition holds while the drawn Opening is any of a picked list, with optional Not (Q9, Q18). It is stored by the opening key from ticket 03, so renames and rewrites never break it. It is offered wherever the Weather and Time Conditions are (Q10), so traits and image Visibility rules share it.

- **Picker.** Lists every Opening in the world grouped by owner: World first, then each entity, then each location (Q21). Rows show by name or derived label (ticket 01).
- **In play.** The opening fold passes the drawn key, so the first settle of starting traits sees it, and a redraw re-settles. Every later turn commit reads it from the record, so it holds for the whole game (Q11). With no drawn Opening it does not hold, and with Not it holds.
- **Outside play.** It reads the Test Bench pick from ticket 04, else no Opening.
- **Missing Openings.** A listed key with no Opening shows the row as unresolved, and saving drops the dead key (Q19).
- **Lines.** Gate and "Shown while" lines read the picked names or labels.

Ships its own docs: the **Opening Condition** glossary entry, the authoring wiki's Conditions section, and a changelog fragment.

## Acceptance criteria

- [ ] A trait gated on one Opening is active on page one when that Opening is drawn and inactive when another is, through the opening fold and gate states.
- [ ] A redraw to another Opening re-settles the trait.
- [ ] The trait stays active on later turns and after a save round trip.
- [ ] Not inverts the result, including with no drawn Opening.
- [ ] An image Visibility rule on the Opening shows and hides to match.
- [ ] The picker groups every Opening by owner and shows derived labels for unnamed rows.
- [ ] A Condition listing a deleted Opening renders unresolved, and saving the row drops the dead key.
- [ ] The Test Bench pick drives the Condition outside play.

⚠️ World `.json` shape change: the Opening Condition kind.
