# 02: Unify Library Rows, Inspection, and Dictionary Ordering

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: GPT-5.6 Sol (`gpt-5.6-sol`)
Reasoning effort: high

## Parent

[Enter World consistency spec](../spec.md).

## What to build

Players scan editor-style entity rows and one ordered dictionary list, inspect full details independently of inclusion, and enter a real game with the same chosen additions and ordering. Deliver a usable list/detail flow at the existing desktop and phone layout boundaries; 03 adds the new container-width stages and motion guarantees.

Model rationale: a complete UI and state integration slice involving search, source identity, ordering, and real draft contracts, with established production components and test boundaries.

## Acceptance criteria

- [x] Reuse the production EditorRow and EditorRowList for separate Entities and Dictionaries sections. Combine world and library dictionaries into one ordered list with source labels and explicit enabled state.
- [x] Preserve source-qualified identity when world and library dictionaries have the same underlying ID. Disabled dictionaries retain their positions.
- [x] Inspecting a row does not change inclusion. Toggling a row checkbox does not switch the inspected item. Row/detail inclusion controls and totals stay synchronized.
- [x] Details expose full names, descriptions, artwork or meaningful missing-art fallbacks, inclusion, and dictionary order. Long row names truncate without losing access to their full text.
- [x] Search filters presentation without clearing inspection, choices, or order; distinguish empty content from no search matches.
- [x] Dragging filtered dictionaries changes visible relative order while hidden items retain their slots. Use the shared editor drag infrastructure, stable sortable identity, and translation without scale.
- [x] Move Up/Down operates on complete dictionary order, disables unavailable boundary actions, and provides an alternative to dragging for keyboard and touch users.
- [x] Use bounded shared ScrollArea viewports for list and details, with themed thumbs and reserved gutters. Verify overflow with realistic content in dark/light themes and a representative alternate palette/font.
- [x] Provide usable full-width details and Back at the existing narrow boundary. Preserve list scroll and inspected identity, move focus without automatic scrolling, and exclude inactive controls from interaction and accessibility navigation. The new three-stage responsive behavior and transition verification belong to 03.
- [x] Integrate with the existing draft owner: game continuation and explicit saved-additions actions receive the real choices and complete order. Preserve existing source-copy, cancellation, and finalization contracts without new schemas or APIs.
- [x] Extend the stateful workspace tests for independent actions, source-ID collisions, filtered ordering, disabled items, and boundary controls. Exercise actual dragging and game-entry integration through the existing browser flow and editor drag-test conventions.
- [x] Demonstrate important guards fail with their defect reinstated, complete applicable gates, and report test wall time. Do not weaken fixtures, ship sample data, or create a new app-wide list standard.

## Coordination

01 has no functional dependency on this ticket. Coordinate edits to the shared workspace; retain green behavior on both slices. Do not merge prototype copies wholesale into production.
