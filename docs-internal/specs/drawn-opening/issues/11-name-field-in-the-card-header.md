# 11: Name Field in the Card Header

Status: ready-for-agent
Blocked by: 10
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The Opening card shows its name twice: an editable field on its own row, and a read-only copy in the header. The header also shows a muted first-line summary of the text. Put the editable name field on the card's top row, and remove the separate row, the read-only copy and the summary (Q25). The empty field shows the derived label as its placeholder. The ticket 01 rules stay: trimmed, unique per owner, inline error on a duplicate, and the rename offer.

User ruling from the close review.

## Acceptance criteria

- [ ] The card's top row holds the editable name field, and the card has no other name row.
- [ ] The header has no read-only name and no first-line summary.
- [ ] A blank name shows the derived label (Q24) as the field's placeholder.
- [ ] A duplicate name shows the inline error and is not written; a rename still offers Update Code References.
- [ ] Accessible labels and text search keep working.
