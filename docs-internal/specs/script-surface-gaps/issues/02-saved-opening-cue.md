# 02: Saved Opening Cue

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: one new save field and two read paths, but the re-roll paths in the game view are easy to get wrong.

## What to build

The save keeps the opening cue the player sent, so `turn.action` on page 1 reads the same after a re-roll or a reload (Q21). History keeps the "START GAME" stand-in, so later turns' requests stay byte-equal. The field is additive on the save envelope. A save without it reads the session's cue when there is one, else the drawn opening.

Spec: Q21, story 4.

## Acceptance criteria

- [ ] Starting a game with an edited cue writes the cue to the save; an Opening Narration start writes none
- [ ] A stats re-roll and a full re-roll of page 1 read `turn.action` as the saved cue
- [ ] After a reload, a page-1 re-roll reads the saved cue
- [ ] The narration request of turn 2 is byte-equal to the one before this change
- [ ] A save written before the field loads, and its page 1 reads the drawn opening

Remind the user in the landing: this is an additive save-shape change.

## Blocked by

- 01
