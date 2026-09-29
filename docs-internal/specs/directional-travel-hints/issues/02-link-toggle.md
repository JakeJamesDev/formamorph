# 02: Link toggle for Travel Hints

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: new shared component with derived state, a memory-only restore, and canvas undo integration.

Parent: [Directional Travel Hints spec](../spec.md)

## What to build

A two-way Connection's two Travel Hint boxes get a vertical link toggle to their right. Linked, the first hint applies to both directions and the second box is read-only, showing the first box's text. Unlinked, both boxes are editable. A new two-way Connection starts linked. The link state is derived from the data and never saved.

One shared component renders the pair and the toggle for both the canvas inspector and the location panel. Clicking one arrow of a Connection on the Locations Canvas focuses that leg's box.

## Acceptance criteria

- [ ] The toggle sits to the right of both boxes and spans their height. The icon is a vertical chain: `link-2` when linked, `link-2-off` when unlinked, rotated 90°.
- [ ] The toggle is a button with `aria-pressed`. Tooltips: **Link Travel Hints** / **Unlink Travel Hints**.
- [ ] The panel opens linked when both legs exist and their hints are equal (both absent counts). Otherwise it opens unlinked.
- [ ] Link writes the first leg's hint into the second leg and keeps the second box's earlier text in memory. Unlink writes that text back. The text is lost when the component unmounts.
- [ ] While linked, editing the first box updates both legs.
- [ ] The read-only box tells screen readers that it copies the first hint.
- [ ] A one-way Connection shows one box and no toggle. Switching to two-way shows the second box, linked.
- [ ] Link, unlink, and hint edits on the canvas are undoable. A run of keystrokes in one box is one undo step.
- [ ] Clicking an arrow selects its Connection and focuses that leg's box.
- [ ] The pattern has an entry in the Design System doc and the dev-router showcase.
- [ ] The Design System Locations reference includes a two-way pair with different hints, so the outer-side arrow labels (ruling from ticket 01) show there.
- [ ] RTL tests through the location panel's Connections list cover the linked, unlinked, restore, and one-way cases.
- [ ] Changelog line in In Progress (fold into 01's entry if it is still unreleased).
