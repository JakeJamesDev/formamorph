# 09: World Source Links Follow the Answer

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: carry one field from the answer to its source chips.

## What to build

A world source shows as a link or a plain name based on the world registered now, not the screen the answer came from. Opening the in-game World Editor turns earlier game answers' sources into editor links, and editor answers show plain names back in game. Each answer keeps the lean it was asked under, and its world sources follow that lean: editor answers link to the item while the editor is open, and game answers stay plain names on every screen.

Found in the close review. Spec: "In the editor, a world source opens its item… In game, it is a plain name."

## Acceptance criteria

- [x] A game answer's world sources stay plain names after the in-game World Editor opens (`stays a plain name for a game answer after the editor opens`)
- [x] An editor answer's world sources link while the editor is open, and show as plain names once no editor is open (`opens its item for an editor answer…`, `is a plain name for an editor answer once no editor is open`)
- [x] The test fails when the chip reads the registered world's lean again (reinstated `registered?.open`: the game-after-editor test went red; restored)

## Landed

**Not verified**
- Not checked in the running app: no real editor-over-game session was driven. Component tests only.

**For you**
- Ask a question in game, open the in-game World Editor, and check the earlier answer's world sources stay plain names. Ask one in the editor, close it, and check that answer's sources turn plain.
