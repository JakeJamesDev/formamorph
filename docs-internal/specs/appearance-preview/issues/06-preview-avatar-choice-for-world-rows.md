# 06: Preview Avatar Choice for World Rows

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

One control on an existing dialog. The Avatars come from another ticket's lookup.

**Also wait for:** Avatar Pick Rules ticket 05 (World Rows List the Playable Personas' Avatars). It gives a world row its list of Avatars. Do not start before it has landed.

## What to build

An author checks a world stat or trait on each Avatar a player can have (spec, The Preview; Avatar Pick Rules Q19).

- When a row resolves to several Avatars, the Preview dialog offers a choice between them, by Avatar name. It opens on the first.
- With one Avatar there is no choice control.
- Changing the Avatar keeps the unsaved changes. A control the new Avatar lacks is absent from the dialog, and its change is still saved.
- The undo bases stay the saved values of the stat or trait, on every Avatar.
- The choice works in a trait's Preview and in a stat's when ticket 05 has landed. Build it on the dialog, not per kind.
- Update the stats and traits wiki pages where they describe the Preview.

## Acceptance criteria

- [x] A world trait in a world with two playable Avatars shows the choice, opened on the first. (`offers the Avatars by name and opens on the first`)
- [x] A row with one Avatar shows no choice control. (`offers no choice with one Avatar`)
- [x] A drag on the first Avatar, a change to the second, and Save writes the drag. (`writes a drag made on the first Avatar after a switch to the second`)
- [x] A slider only the first Avatar has is absent on the second, and its row is unchanged by Save. (`hides a slider the second Avatar lacks…`)
- [x] After a change of Avatar, a control's undo still returns to the saved value. (`keeps a control's undo…`, `does not carry the first Avatar's own color…`)
- [x] Mutation: reset the draft on a change of Avatar, and the keep-changes test fails. (ran: two tests failed, then reverted)
- [ ] Frame: `.scratch/frames/preview-avatar-choice-dark-1440.png`. The frame shows the menu, but the Browser pane never loaded the model, so the controls are not in it.

For you: in a world with two persona Avatars, switch between them in a Preview and judge the choice control's place.

## Landed

**Not verified**
- The frame criterion: the pane stayed on "Loading Avatar…", so the frame shows the Avatar menu without sliders.
- A Preview with two Avatars that name one slider by different aliases. Save can write the second Avatar's own value over an edit made on the first.
- Stat Preview: ticket 05 builds it on the same dialog. The stats wiki page has no Preview section until then.

**For you**
- In a world with two persona Avatars, switch between them in a Preview and judge the Avatar menu's place at the top of the controls column.
