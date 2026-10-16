# 02: Edit Rebuilds the Scene List

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: writes both a page snapshot and the live Gameplay state from one save. The latest-page rule and the stand-in for the unstored planner cast need care.

## What to build

A player saves a narration edit. The edited page's scene list is rebuilt from the edited text. Viewing that page shows the new list. When the edited page is the latest page, the live Entities tab updates too. An edit to an older page leaves the live list alone.

The rebuild keeps each member of the page's previous scene list whose name or alias the edited text still names, by the loose match the live planner-confirmation source uses. The narration parse with no cast adds the rest. A narrated name not yet known joins as revealed. An unrevealed member kept by alias stays unrevealed. A discovered entity whose name the edit removed stays known and only leaves the list.

The pure function from 01 gains the scene list output. The rescan callback from 01 also writes the page snapshot and, on the latest page, the live list.

## Acceptance criteria

- [ ] The pure function returns the new scene list as above.
- [ ] Tests: a kept cast member stays by name and by alias; an unrevealed member stays unrevealed; a removed name leaves; a new name joins as revealed; a quoted-only name stays off.
- [ ] Game panels harness test: a latest-page edit updates that page's snapshot and the live list; an older-page edit updates its snapshot and leaves the live list.
- [ ] No discovered entity is removed by an edit.
- [ ] The 01 changelog entry says the Entities tab updates too. No second entry.
- [ ] The How to Play section on editing narration says the cast updates, if it describes the edit's effects.
- [ ] Four gates green.
