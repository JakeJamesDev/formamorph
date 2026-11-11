# 06: Preview Avatar Choice for World Rows

Status: ready-for-agent
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

- [ ] A world trait in a world with two playable Avatars shows the choice, opened on the first.
- [ ] A row with one Avatar shows no choice control.
- [ ] A drag on the first Avatar, a change to the second, and Save writes the drag.
- [ ] A slider only the first Avatar has is absent on the second, and its row is unchanged by Save.
- [ ] After a change of Avatar, a control's undo still returns to the saved value.
- [ ] Mutation: reset the draft on a change of Avatar, and the keep-changes test fails.
- [ ] Frame: `.scratch/frames/preview-avatar-choice-dark-1440.png`.

For you: in a world with two persona Avatars, switch between them in a Preview and judge the choice control's place.
