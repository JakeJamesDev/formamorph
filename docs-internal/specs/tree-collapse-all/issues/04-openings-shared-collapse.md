# 04: Openings Owner List Joins the Shared Collapse

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one list swaps its own collapse code for ticket 01's store and keeps its behavior.

## What to build

Start only after Openings Tab ticket 05 has landed (`ready-for-human` or `done`). The Openings tab's owner list then moves onto the World Editor's per-tab collapsed set and the shared button (Q9). Its own collapse code goes away.

- Its search keeps the tree and shows matches inside collapsed parents, so the button stays enabled during a search (Q14).
- Its noun stays "groups" (Q15).
- This World and the rule between the trees still do not collapse.
- Ticket 05's behavior holds: collapsing the selected owner's parent keeps the selection and its pane.
- No changelog entry if the Openings tab is still unreleased; the behavior does not change for the author.

## Acceptance criteria

- [ ] Openings collapse state survives a tab switch and back (editor-bench test)
- [ ] Ticket 05's collapse, search and selection tests stay green through the shared button
- [ ] The Openings button stays enabled while search has text (editor-bench test)
- [ ] No Openings-only collapse state or toggle-all code remains
