# 03: Entity Stranger Field Layout

Status: ready-for-agent
Blocked by: 01 — Description-Only Strangers; 02 — Item Replacement Fields
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

This ticket reuses ticket 02's row and ticket 01's runtime rule. Most of the work is placing fields and writing help copy.

## What to build

The entity editor puts each Stranger field next to the field it replaces (Q1, Q2, Q4, Q6). The fields keep their gate: Advanced mode, World Editor only (Q7).

- Stranger Name joins Name in ticket 02's split name row. Outside the gate, Name stays full width.
- Stranger Description sits on the Descriptions tab directly under Player-Facing Description, before the AI-Facing fields. It always shows, even with a blank Stranger Name.
- The Stranger help topic splits in two: Stranger Name and Stranger Description. The inline hints go away; their content moves into the topics, written per the Writing Guide. The Stranger Description topic says it works alone: the player knows the Name but sees this description until they meet the entity (ticket 01). The Stranger Name topic says where Stranger Description now lives.
- Ticket 01 landed so that a script's `met` reads false for a description-only entity until the player meets it. Say so in the Stranger Description topic, and in the script docs if they describe `met`.
- Each topic carries a wiki page and anchor; update the entities wiki page's strangers section to match.
- The entity field-to-tab map sends `strangerName` to Profile and `strangerDescription` to Descriptions.
- Clearing either field never clears the other (Q3).
- Add a changelog fragment, folded into ticket 01's entry where they describe one change.

## Acceptance criteria

- [ ] In Advanced mode on the World Editor, Stranger Name renders beside Name; in Simple mode and the library editor, Name renders alone.
- [ ] Stranger Description renders directly after Player-Facing Description with a blank Stranger Name.
- [ ] Stranger Name and Stranger Description each have one help button that opens its own topic; no inline hint remains.
- [ ] A search hit on either field opens the tab that holds it.
- [ ] Clearing Stranger Name leaves Stranger Description unchanged.
- [ ] Frames of the entity Profile and Descriptions tabs at a narrow and a wide pane width, both themes: `.scratch/frames/entity-names-narrow-light.png`, `.scratch/frames/entity-names-wide-light.png`, `.scratch/frames/entity-names-narrow-dark.png`, `.scratch/frames/entity-names-wide-dark.png`, `.scratch/frames/entity-descriptions-light.png`, `.scratch/frames/entity-descriptions-dark.png`.
