# 06: Opening Condition

Status: ready-for-human
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

- [x] A trait gated on one Opening is active on page one when that Opening is drawn and inactive when another is, through the opening fold and gate states. `openingCondition.test.ts` › "holds a trait gated on the drawn Opening…"; guard proven by dropping the fold's key.
- [x] A redraw to another Opening re-settles the trait. `openingCondition.test.ts` › "re-settles on a redraw"; GameViewer's `settleStartUnder` passes the redraw's key.
- [x] The trait stays active on later turns and after a save round trip. `openingCondition.test.ts` › "keeps holding from the save record after a round trip" (save JSON → `readOpeningKey` → `liveOpeningKey` → gate).
- [x] Not inverts the result, including with no drawn Opening. `openingCondition.test.ts` › "holds only under Not with no Drawn Opening" and "reads a deleted Drawn Opening as none"; guard proven by dropping Not.
- [x] An image Visibility rule on the Opening shows and hides to match. `openingCondition.test.ts` › "shows under the drawn Opening and hides under another" (`ruleStates`).
- [x] The picker groups every Opening by owner and shows derived labels for unnamed rows. `RequirementRowsField.opening.test.tsx` › "groups every Opening by owner…" and the many-Openings drill-down tests; live DOM read in the prototype preview.
- [x] A Condition listing a deleted Opening renders unresolved, and saving the row drops the dead key. `RequirementRowsField.opening.test.tsx` › "shows a deleted Opening as unresolved, and the next edit drops its key" (spec ruling: drop on edit, no save sweep).
- [x] The Test Bench pick drives the Condition outside play. `openingCondition.test.ts` › "reads the shared Opening pick, else none" (editor gate) and "drives the Test Bench readout of who is in play"; guard proven by dropping the bench key.

⚠️ World `.json` shape change: the Opening Condition kind.

## Landed

**Not verified**
- None of the criteria; every box above has a test.

**For you**
- The Opening chip's picker in the World Editor: Requires → Add Requirement → Opening, then open the chip. Check Select All, the flat list, and the owner pages past 8 Openings. The prototype that settled its form is `prototype/drawn-opening-06` (`npm run dev -- --port 5251`, `#dev?modal=worldEditor&tab=traits&fixture=openingCondition`); frames at `.scratch/drawn-opening-06/frames/`.
- Enter World shows a trait locked by an Opening Condition alone as **Locked**, by design (Q23).
- Not covered here: `docs/WorldFormat.md` still says Time and Weather requirements have no `not` (ticket 05's doc gap).

