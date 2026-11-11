# 07: Close Review Gaps

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The close review of this effort found three gaps and a few standards breaches on the Presence tab. Fix them.

**1. A pick kept across a change of location shows the wrong Start (Q28).** An author selects an entity on one location's Presence tab and clicks another location where it also has a row. The entity stays selected, but the editor keeps the Start it had. It must show the Start already on show when that one names the new location, else the first Start that names it. The cause, as read in the code: the location panel remounts for each location, so the code that compares the last location to the new one starts equal and never runs.

The fix must not replace a Start that an undo or redo just put on show (Q28, Q31): a reveal that arrives at a Presence tab keeps the Start of the change, also when that Start does not name the location.

**2. Add Entity opens in Routine mode (Q35).** Today it carries the mode of the last selection, so after work in Known In mode an added entity opens in Known In and does not show its new Start. An added entity always opens in Routine mode on the new Start. A row click still keeps the current mode.

**3. Picked Locations beside the panel (Q34).** In the editor under the Presence list, Known In set to Picked Locations tells the author to click a location. Beside the panel a click selects the location, so the author cannot pick. Beside the panel:

- The hint says that locations are picked in full screen, and a button there opens full screen with this entity and Known In mode kept.
- The Routine-mode hint for a Generic entity ("Click a location to add it or remove it") has the same fault beside the panel. Give it wording that is true there.
- In full screen the hints and the click behavior are unchanged.
- The canvas beside the panel stays view-only.

Write the new hints under the Writing Guide from a facts list.

**4. Standards, from the same review.**

- The wiki pages for Locations and Entities bold **Add Entity**, but the visible text of that control is "Add an entity here". The Writing Guide says to copy the visible label exactly. Make the control and the pages agree, and keep it distinct from the Entities section's own Add Entity button.
- The two trash buttons (a Generic row's remove, a Known Here row's remove) do not turn destructive on hover as the Design System's "Lists With Controls or Metadata" requires. Use the documented row action.
- The remove button on a Presence row lacks the shared inset focus ring.
- The Design System page documents the selected status row with a chevron. This list has none, by the user's ruling (Q4, Q24). Record that variant on the Design System page so the page and the code agree.
- The Locations wiki page still says "line" in two places where its neighbors now say "row".

Spec rulings: Q28, Q34, Q35.

## Acceptance criteria

- [ ] With an entity that begins at location A on Start 1 and at location B on Start 2: select it on A, click B on the canvas, and the editor shows Start 2. The test fails on the code before the fix.
- [ ] The same change of location through the tree in the list view shows Start 2.
- [ ] An undo that arrives at a Presence tab with a Start that does not name the location keeps that Start on show. The test fails when the new code re-seats it.
- [ ] With a row selected in Known In mode, Add Entity opens the added entity in Routine mode on its new Start.
- [ ] A row click in Known In mode on another row keeps Known In mode.
- [ ] Beside the panel, with Known In set to Picked Locations, the hint names full screen and its button opens full screen with the same entity picked in Known In mode. In full screen the hint is the old one.
- [ ] Beside the panel, no hint in the editor region tells the author to click a location.
- [ ] The control's visible text and the two wiki pages use the same words for adding an entity to a location.
- [ ] Both trash buttons take the destructive hover of the documented row action, and the Presence row's remove button has the inset focus ring.
- [ ] The Design System page describes the selected row without a chevron as an approved variant.
- [ ] The copy sweep gives no notice on the new and changed strings.
- [ ] Frames: `.scratch/frames/presence-picked-hint-dark.png` and `-light.png`, at 1440 wide, with Known In set to Picked Locations beside the panel.
- [ ] Help vectors are rebuilt for the changed wiki sections. A changelog fragment covers what an author sees change; fixes to behavior that never shipped get none.

For you: read the new Picked Locations hint and its button beside the panel, and approve the words.
