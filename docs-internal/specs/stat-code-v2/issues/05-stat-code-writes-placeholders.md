# 05: Stat Code Writes Placeholders

Status: ready-for-agent
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

- [ ] A `value` write becomes a Code Pin that the next prompt's placeholder context reflects
- [ ] A Code Pin outranks a stat band pin and masks, not replaces, the Roll
- [ ] Undo restores the pre-write pins; a re-roll reproduces the write
- [ ] Bare-string assignment to the entry is accepted as a `value` write and gets a diagnostic suggesting `.value`
- [ ] Unknown placeholder name on write is dropped and reported
- [ ] Two stats writing one placeholder apply in stat order, last wins
- [ ] A save without Code Pins loads with none
- [ ] Test Code shows written placeholders
- [ ] Tests at the per-turn seam cover write, off-list text, bare-string, unknown name, and stat-order conflict; a pin-collection test covers rank; a save-load test covers the missing map
- [ ] Closing response states the save-shape change
- [ ] Four gates green; graph updated

## Blocked by

- 04 — Stat Code Reads Placeholders
