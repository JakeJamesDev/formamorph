# 02: Item Replacement Fields

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

This ticket moves fields and adds help topics. It also builds one shared row component that ticket 03 reuses, which needs some care with layout.

## What to build

The item editor puts each unidentified field next to the field it replaces (Q5, Q8, Q9).

- **This ticket owns the split name row**: Name with a partner name field beside it. It splits when the pane has room and stacks otherwise, following the editor's existing pane-width approach (Q1). Both inputs line up on one row. Ticket 03 uses it for Stranger Name.
- Unidentified Name leaves the Descriptions tab and joins Name in that row.
- Unidentified Description sits directly under Player-Facing Description, before the AI-Facing fields. It always shows.
- Unidentified Name and Unidentified Description each get a help button with their own topic. The inline hints go away; their content moves into the topics, written per the Writing Guide. Each topic carries a wiki page and anchor; add the matching section to the items wiki page.
- The item field-to-tab map sends `unidentifiedName` to the tab that now holds Name, so search and Reveal Origin land on the field.
- Add a changelog fragment.

## Acceptance criteria

- [ ] Unidentified Name renders beside Name on the item's main tab, and no longer on the Descriptions tab.
- [ ] Unidentified Description renders directly after Player-Facing Description.
- [ ] Each of the two fields has one help button that opens its own topic; no inline hint remains.
- [ ] A search hit on Unidentified Name opens the tab that holds it.
- [ ] Clearing Unidentified Name leaves Unidentified Description unchanged.
- [ ] Frames of the item editor at a narrow and a wide pane width, both themes: `.scratch/frames/item-names-narrow-light.png`, `.scratch/frames/item-names-wide-light.png`, `.scratch/frames/item-names-narrow-dark.png`, `.scratch/frames/item-names-wide-dark.png`.
