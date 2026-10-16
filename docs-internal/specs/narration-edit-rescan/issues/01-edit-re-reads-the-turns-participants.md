# 01: Edit Re-Reads the Turn's Participants

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: one handler moves behind a view callback, plus a pure function with table tests. Well bounded.

## What to build

A player saves a narration edit on any page. That turn's stored participants come from the edited text, read the same way a live turn reads its narration. A character named only inside quoted speech is no longer a participant. A new name the edit introduces becomes a participant, and the Background Pass Queue discovers it as it does for a live turn. Suppressed names stay out.

The next turn's choices, the `<IN SCENE>` chip, and stat code `inScene` read these stored participants, so they follow the edit with no further change.

The new pure function from the spec lands here with its participants output. The game view owns the character exclusions, so it hands the editor's save a rescan callback. The digest and diaries are still cleared as today. Action edits do not rescan.

## Acceptance criteria

- [ ] The pure function returns participants from the Narration Reading: quote-stripped known names plus narrated names.
- [ ] Tests: a removed name leaves; an added known name joins; a new name is a participant; a quoted-only name is not; a suppressed name is not.
- [ ] A narration edit on any page writes those participants to that turn in the history.
- [ ] Game panels harness test: a narration edit updates the stored participants; an action edit leaves them alone.
- [ ] Putting the old full-text match back makes the quoted-only and new-name cases fail.
- [ ] A changelog fragment adds one 👤 Fixed line: editing narration updates who is in the turn and discovers new characters.
- [ ] Four gates green.
