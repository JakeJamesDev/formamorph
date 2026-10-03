# 29: Surface label table

Status: done
Base: ed5c3173
Blocked by: 23
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The surface hint names the open screen, dialog and tab with the exact labels the player sees (Q51). Ticket 23 derives the names from camelCase ids, so an id that differs from its UI label reads wrong in the request.

- One table maps every reported surface id to its UI label. Take each label from the component or copy constant that renders it. Where a label is already a shared constant, import it; do not copy the text.
- The surface hint reads the table. The camelCase rule is removed, not kept as a fallback.
- A test fails when a surface id that can report has no label entry. Prove it bites.
- The `designSystemGroupPicker.*` ids get the Groups dialog's player label.

No prompt text changes, so no probe is needed. If a label change moves the ticket 23 "here" cases, rerun its probe and report.

Recommended model rationale: a mechanical table with one coverage test.

## Acceptance criteria

- [ ] Every reporting surface id has a UI label in one table
- [ ] Labels that exist as shared constants are imported, not copied
- [ ] The surface hint uses the table, and the derived-name rule is gone
- [ ] A test fails for a reporting id with no label, proven to bite
- [ ] A request on Settings → Display names "Display", exactly as the tab shows it
- [ ] Four gates green
