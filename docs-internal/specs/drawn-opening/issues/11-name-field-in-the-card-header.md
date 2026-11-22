# 11: Name Field in the Card Header

Status: ready-for-human
Blocked by: 10
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Opening card shows its name twice: an editable field on its own row, and a read-only copy in the header. The header also shows a muted first-line summary of the text. Put the editable name field on the card's top row, and remove the separate row, the read-only copy and the summary (Q25). The empty field shows the derived label as its placeholder. The ticket 01 rules stay: trimmed, unique per owner, inline error on a duplicate, and the rename offer.

User ruling from the close review.

## Acceptance criteria

- [x] The card's top row holds the editable name field, and the card has no other name row. (names test: "has one name field per card, in the header row")
- [x] The header has no read-only name and no first-line summary. (names test; collapsed-rows test in useWorldOpeningsEditor)
- [x] A blank name shows the derived label (Q24) as the field's placeholder. (names test "heads each card with its name field")
- [x] A duplicate name shows the inline error and is not written; a rename still offers Update Code References. (existing names tests, unchanged and green)
- [x] Accessible labels and text search keep working. (`Name, Opening N` labels; search tests green)

## Landed

**Not verified**
- Layout in the browser pane: the dev-router preview of the World Editor Openings tab rendered blank, so no frame was taken.

**For you**
- Open the World Editor Openings tab: check the top row on a narrow pane, and that the duplicate-name error looks right under the field in the header.
- The chevron is now the only collapse target. The old label area no longer toggles the card.
- No changelog fragment: the unreleased "Openings can have names" entry stays accurate.
