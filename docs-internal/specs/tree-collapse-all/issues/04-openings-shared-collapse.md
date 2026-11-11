# 04: Openings Owner List Joins the Shared Collapse

Status: done
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

- [x] Openings collapse state survives a tab switch and back (editor-bench test: "keeps its folded groups through a tab switch and back")
- [x] Ticket 05's collapse, search and selection tests stay green through the shared button (unchanged `collapsing groups` cases; run at prepare)
- [x] The Openings button stays enabled while search has text (editor-bench test: "keeps the button enabled while the search has text")
- [x] No Openings-only collapse state or toggle-all code remains (`useState` and `toggleAll` removed from `useWorldOpeningsEditor.tsx`)

## Landed

**Not verified**
- The jsdom tests ran only at prepare, not in the review gates.

**For you**
- Open Openings with no nested owners: the Collapse All button now shows disabled instead of hidden (Q7). Look at the toolbar right of the search.
