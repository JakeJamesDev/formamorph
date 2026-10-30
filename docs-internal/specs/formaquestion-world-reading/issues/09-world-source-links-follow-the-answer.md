# 09: World Source Links Follow the Answer

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: carry one field from the answer to its source chips.

## What to build

A world source shows as a link or a plain name based on the world registered now, not the screen the answer came from. Opening the in-game World Editor turns earlier game answers' sources into editor links, and editor answers show plain names back in game. Each answer keeps the lean it was asked under, and its world sources follow that lean: editor answers link to the item while the editor is open, and game answers stay plain names on every screen.

Found in the close review. Spec: "In the editor, a world source opens its item… In game, it is a plain name."

## Acceptance criteria

- [ ] A game answer's world sources stay plain names after the in-game World Editor opens
- [ ] An editor answer's world sources link while the editor is open, and show as plain names once no editor is open
- [ ] The test fails when the chip reads the registered world's lean again
