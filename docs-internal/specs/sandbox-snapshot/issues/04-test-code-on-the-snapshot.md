# 04: Test Code on the Snapshot

Status: done
Blocked by: 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

The editor's Test Code button becomes the snapshot's second caller. Rulings Q4, Q6, Q11 (Test Code's lookup).

## What to build

An author presses Test Code in a script box and gets the same report as before: the value, the writes, the pending persona writes, the assumed stats and the dropped writes. Behind it, Test Code takes the authored world at turn one from the opening fold with no picks, no persona and an empty roll set, builds a snapshot with its two overlays as construction options, and runs the box's unit. The box's home carries the Owner; the separate owner type and the stat and trait lookups are gone.

## Acceptance criteria

- [ ] Test Code builds its turn-one state through `openingStateOf` and its snapshot through `snapshotOf`, with the pending persona and the assumed stats passed as construction options.
- [ ] Test Code hands `run` a unit built from the box's home. Its own owner type and its stat and trait lookups are deleted.
- [ ] Test Code's report shape is unchanged: value, error, writes, pending, assumed, dropped.
- [ ] Test Code no longer imports the executor or any sandbox entry builder.
- [ ] Existing Test Code tests stay green. An assertion changes only where a ruling changed the result, and each such change names the ruling in the test.
- [ ] Four gates green, exit codes read.
