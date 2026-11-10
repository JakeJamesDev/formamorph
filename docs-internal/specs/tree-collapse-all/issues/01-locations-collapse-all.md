# 01: Collapse All on the Locations Tab

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it lifts SortableTree's collapsed state to its host and builds every shared primitive the other tickets reuse, without breaking drag, reveal or the redraw guarantees.

## What to build

The tracer bullet. The Locations tab gets a working Collapse All button, and every shared piece lands here.

- **Host-owned collapsed state:** SortableTree reads its collapsed set from its host and reports changes. Its reveal-on-select and drag rules still apply to that set.
- **Collapse-all action:** derived from the adapter's full row list. It closes every parent at every depth when any is open, and opens every parent otherwise (Q5).
- **Per-tab store:** the World Editor keeps one collapsed set per tab for the visit. A tab that unmounts gets its set back. Closing the editor drops it. Nothing is saved (Q4).
- **The button:** the List Editor toolbar shows the shared Collapse All button in the slot after the search. The adapter supplies the noun ("locations") and whether a tree with parent rows is shown.
- **Disabled state:** the shared button gains one. The List Editor disables it while a search shows flat matches (Q3), when the tree has no parent rows (Q7), and in the canvas view (Q8). The rule is "no collapsible tree shown" (Q14).
- Changelog fragment `docs-internal/changelog.d/tree-collapse-all-01.md`. Update any World Editor docs that describe the Locations list toolbar.

## Acceptance criteria

- [ ] Collapse All hides every child row at every depth on Locations; Expand All shows them again; the tooltip reads "Collapse all locations" then "Expand all locations" (editor-bench test)
- [ ] Collapse Locations, switch to another tab and back: the rows stay collapsed (editor-bench test, mutation-tested: keeping state local to the tree turns it red)
- [ ] The button is disabled while a search is typed, and clearing the search brings back the collapsed rows (editor-bench test)
- [ ] The button is disabled in the canvas view and on a tree with no parent rows (editor-bench test)
- [ ] Selecting a location from outside the tree opens its collapsed parents (editor-bench test)
- [ ] The existing SortableTree redraw and drag tests stay green
- [ ] Frames `.scratch/frames/tree-collapse-01-dark.png` and `-light.png` at 1280×800 with the Locations tree collapsed
