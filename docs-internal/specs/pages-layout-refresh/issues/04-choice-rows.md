# 04: Choice Rows

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Model rationale: one new presentational list with a known press contract and clear states.

## What to build

In Pages, the outlined choice buttons become numbered rows under the card. Each row is a button with a number
cell and the choice text with its bold and quoted runs. Rows are separated by a rule. A row fills lightly on
hover and takes the primary fill when its text is staged in the input; the quote color inherits on that fill.

The continue choice is the last row, with a chevron in place of a number. On a past page the rows are
disabled and the choice the player took is marked. The rows keep the shared press handlers, so a click
stages, and Ctrl/Cmd+click or a touch long press appends. Chat keeps its bubbles.

The choices builder's actions render as icons under the rows, on the latest page only.

Shares the narration panel file with 03 and 05; run them one at a time.

## Acceptance criteria

- [ ] Choices show as numbered rows; the old outlined buttons are gone from Pages
- [ ] Click stages the choice; Ctrl/Cmd+click and a long press append it
- [ ] A staged row shows the primary fill, with readable quoted text
- [ ] The continue choice is the last row with its own mark, under the same conditions as today
- [ ] Past page: rows disabled, the taken choice marked, no Re-generate Choices icon
- [ ] Focus ring is inset; rows are reachable by keyboard
- [ ] Rows fit at phone width
- [ ] Harness tests cover stage, append, and the past-page state
- [ ] Verified in the preview, both themes
- [ ] Four gates green
