# 02: Saved Opening Cue

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

Opus at medium: one new save field and two read paths, but the re-roll paths in the game view are easy to get wrong.

## What to build

The save keeps the opening cue the player sent, so `turn.action` on page 1 reads the same after a re-roll or a reload (Q21). History keeps the "START GAME" stand-in, so later turns' requests stay byte-equal. The field is additive on the save envelope. A save without it reads the session's cue when there is one, else the drawn opening.

Spec: Q21, story 4.

## Acceptance criteria

- [x] Starting a game with an Opening Action, edited or not, writes the cue to the save; an Opening Narration start writes an empty cue (Q47). `GameViewer.openingCue.test.tsx` "the save keeps the opening cue"; `GameplayContext.openingCue.test.tsx` round trip
- [x] A stats re-roll of page 1 reads `turn.action` as the saved cue; a full re-roll is a new opening turn that reads the cue it sends, which replaces the saved one (Q47). "reads the cue a full re-roll sends" and ticket 01's "page-one stats re-roll"
- [x] After a reload, a page-1 re-roll reads the saved cue. "reads it on a stats re-roll after a reload"
- [x] The narration request of turn 2 is byte-equal before and after a reload, with "START GAME" and no cue. "sends turn 2 the same bytes"
- [x] A save written before the field loads, and its page 1 reads the drawn opening. "reads the drawn opening on a save written before the field"

Remind the user in the landing: this is an additive save-shape change.

## Blocked by

- 01

## Landed

**Not verified**
- A reloaded narration-start save in a world that mixes Opening Actions and Narrations. The test world holds one narration, where the old fallback also reads empty; the save's empty cue is covered by the write and round-trip tests.
- An opening turn that fails sets the cue before it fails. A manual save before the next opening holds that cue; the next opening replaces it. No test covers this.

**For you**
- Additive save-shape change: the save envelope gains an optional `openingCue` string.
- No changelog entry: ticket 01's unreleased `turn` entry already promises the re-roll reading.
