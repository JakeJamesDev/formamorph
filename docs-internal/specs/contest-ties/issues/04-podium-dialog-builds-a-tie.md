# 04: Podium Dialog Builds a Tie

Status: in-progress
Base: d1785716
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

**Parent:** [Contest Ties](../spec.md)

**What to build:** An admin builds a tie in the Podium dialog. The draft is an ordered list of rows, each with a world id and a tied-with-above flag; the first row's flag is always off. A pure helper derives each row's place by competition ranking, tested against the example table in the spec. Staff cannot stage an invalid podium, because the shape holds the rule.

The fixed three-slot strip becomes a list of rows. Each row shows its derived place with the metal plate, the world name, a clear button, and, below the first row, the **Tie With Above** toggle. A world can join when its derived place would be 3 or lower; a toggle that would push a later row past 3rd place is refused the same way. Click-to-place stays: append, trade with the row below, remove from the last row. The tied flag stays with the row position, not with the world, so a trade never changes the podium's shape.

Edit mode seeds the draft from the published placements with their places and sets the flag where two neighbors share a place. The re-seed signature includes the places. The announcement preview writes one line per place with tied names joined ("First place: A by X and B by Y"). The request carries `{ place, worldId }` per world with repeated places. The dialog copy describes the toggle.

The component tests mock the service, so this ticket does not wait for the server. A live check against the server needs ticket 01 deployed.

- [ ] The derivation helper passes the spec's example table
- [ ] The toggle makes a tie and every later place derives again (1, 1, 3)
- [ ] A click or toggle that would create a 4th place is refused; `1,2,3,3` is allowed
- [ ] A trade keeps the podium shape; clear closes the gap and derives the places again
- [ ] Judging a contest with no ties takes the same clicks as before
- [ ] Edit mode opens with published ties intact, and a re-render of the list behind the dialog does not reset a half-built draft
- [ ] The lost-listing refusal still blocks a re-save
- [ ] The request body carries repeated places; one world never holds two rows
- [ ] The preview shows the joined line
- [ ] The cycle and slot tests that assert the old model are replaced, and each new guard is proven to fail when its rule is removed
- [ ] Copy follows the help-copy pattern; the toggle is keyboard reachable with a ring-inset focus ring
- [ ] UI verified through the dev router with static evidence, in both themes and at mobile width
- [ ] Changelog In-Progress entry added; four gates green, test run time stated
