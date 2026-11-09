# 03: Entity Stranger Field Layout

Status: ready-for-human
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

- [x] In Advanced mode on the World Editor, Stranger Name renders beside Name; in Simple mode and the library editor, Name renders alone. `EntityFields.stranger.test.tsx` (same row, Simple, library); DOM read in the preview: two columns wide, stacked narrow, no Stranger field in Simple.
- [x] Stranger Description renders directly after Player-Facing Description with a blank Stranger Name. `EntityFields.stranger.test.tsx` field order; DOM label order in the preview.
- [x] Stranger Name and Stranger Description each have one help button that opens its own topic; no inline hint remains. `EntityFields.stranger.test.tsx` (one `About` button each, no hint text).
- [x] A search hit on either field opens the tab that holds it. `worldSearch.test.ts` (Entity Stranger fields) and `entityPanelTabs.test.ts`, with Advanced-only indexing per spec Q20.
- [x] Clearing Stranger Name leaves Stranger Description unchanged. `EntityFields.stranger.test.tsx` (clear writes only `strangerName`).
- [x] Frames of the entity Profile and Descriptions tabs at a narrow and a wide pane width, both themes: `.scratch/frames/entity-names-narrow-light.png`, `.scratch/frames/entity-names-wide-light.png`, `.scratch/frames/entity-names-narrow-dark.png`, `.scratch/frames/entity-names-wide-dark.png`, `.scratch/frames/entity-descriptions-light.png`, `.scratch/frames/entity-descriptions-dark.png`.

## Landed

**Not verified**

- The jsdom tests (`EntityFields.stranger.test.tsx`, `worldSearch.test.ts`) run in prepare's gate list, not in the review gates. Typecheck and lint passed in the review gates.
- The library entity editor was not opened in the preview; a unit test covers it.

**For you**

- Open an entity in the World Editor, Advanced mode. Stranger Name should sit beside Name and stack when the pane narrows. Frames: `.scratch/stranger-fields-03/frames/entity-names-narrow-dark.png`, `entity-names-wide-dark.png`, `entity-names-narrow-light.png`, `entity-names-wide-light.png`.
- On the Descriptions tab, Stranger Description should sit under Player-Facing Description. Frames: `.scratch/stranger-fields-03/frames/entity-descriptions-dark.png`, `entity-descriptions-light.png`.
- Read the two help topics (Stranger Name, Stranger Description) for tone.
