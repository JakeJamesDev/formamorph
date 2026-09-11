# 05: Stat Code Writes Placeholders

Status: ready-for-human
Base: d1a5bb5b
Blocked by: 04
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Adds a pin source to the collection, puts it in the snapshotted gameplay state, and makes the prompt and the immersive view read it. Pin rank and undo both have to be right, so this wants Opus at high effort.

## What to build

Assigning `placeholders.<name>.value` from code pins the placeholder. The write becomes a Code Pin: a pin source keyed by placeholder id holding the written text, ranked above every other pin source. The Roll underneath is never replaced, so the Roll returns when code stops pinning. A string assigned to the entry itself instead of its `value` counts as a write to `value`, and the editor suggests `.value`.

Code Pins live in the snapshotted gameplay state so undo and re-roll restore them. The resolver reads them everywhere it reads trait pins: prompt context, stat name resolution, the immersive view. The next prompt after a write sees the new text. A write to a placeholder name that does not exist is dropped and reported.

Two stats writing one placeholder in one run apply in stat order; the last write wins. Test Code shows every placeholder the run wrote.

This ticket changes the save envelope shape (an additive, optional Code Pins map in gameplay state). Say so in the closing response so the user can make the version call.

## Acceptance criteria

- [x] A `value` write becomes a Code Pin that the next prompt's placeholder context reflects
- [x] A Code Pin outranks a stat band pin and masks, not replaces, the Roll
- [x] Undo restores the pre-write pins; a re-roll reproduces the write
- [x] Bare-string assignment to the entry is accepted as a `value` write and gets a diagnostic suggesting `.value`
- [x] Unknown placeholder name on write is dropped and reported
- [x] Two stats writing one placeholder apply in stat order, last wins
- [x] A save without Code Pins loads with none
- [x] Test Code shows written placeholders
- [x] Tests at the per-turn seam cover write, off-list text, bare-string, unknown name, and stat-order conflict; a pin-collection test covers rank; a save-load test covers the missing map
- [x] Closing response states the save-shape change
- [x] Four gates green; graph updated

## Blocked by

- 04 — Stat Code Reads Placeholders

## Comments

- 2026-09-10, user decision: code releases a Code Pin with `placeholders.<name>.unpin()`. The release lands after the run, `value` keeps its run-start text mid-run, the last of a write and an unpin wins, and unpinning a placeholder no code pinned does nothing. `null` is not a release. Recorded in the spec; ticket 07 documents it.
- An unknown name reads as a placeholder with no text, as an unknown trait reads as one nobody has, so `placeholders.Nope.value = "x"` is dropped and reported instead of throwing. The editor flags it statically too. (Review fix, 2026-09-11.)
- A value that is not text or a finite number fails the run, as a non-number `self.value` does. A number is written as its text.
- A placeholder write is any assignment, not a change against the resolved text: the review found that a diff let an earlier stat win over a later one writing the run-start text, and skipped pinning a text an authored pin already showed. `withPinWrites` compares against the existing Code Pin, so rewriting the same text each turn is still a no-op.
- The stats-only re-roll resets Code Pins to the pre-turn snapshot and runs code over the pins as they stood before the turn, so code that reads the placeholder it writes lands once.
- Found in review, fixed 2026-09-11: the first coded turn of a session snapshotted before stat code settled (QuickJS loads after the deferred snapshot), so that turn's snapshot missed its Code Pins, bounds, and code values. The turn commit and the stats re-roll now await stat code before arming the snapshot, and arming schedules a commit of its own. The live check is the first-turn re-roll case in `e2e/stat-code-turn.spec.ts`.
