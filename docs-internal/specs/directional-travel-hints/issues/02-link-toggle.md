# 02: Link toggle for Travel Hints

Status: ready-for-human
Base: e29aaa9e
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Rationale: new shared component with derived state, a memory-only restore, and canvas undo integration.

Parent: [Directional Travel Hints spec](../spec.md)

## What to build

A two-way Connection's two Travel Hint boxes get a vertical link toggle to their right. Linked, the first hint applies to both directions and the second box is read-only, showing the first box's text. Unlinked, both boxes are editable. A new two-way Connection starts linked. The link state is derived from the data and never saved.

One shared component renders the pair and the toggle for both the canvas inspector and the location panel. Clicking one arrow of a Connection on the Locations Canvas focuses that leg's box.

## Acceptance criteria

- [x] The toggle sits to the right of both boxes and spans their height. The icon is a vertical chain: `link` when linked, `unlink` when unlinked, turned upright by -45°.
- [x] The toggle is a button with `aria-pressed`. Tooltips: **Link Travel Hints** / **Unlink Travel Hints**.
- [x] The panel opens linked when both legs exist and their hints are equal (both absent counts). Otherwise it opens unlinked.
- [x] Link writes the first leg's hint into the second leg and keeps the second box's earlier text in memory. Unlink writes that text back. The text is lost when the component unmounts.
- [x] While linked, editing the first box updates both legs.
- [x] The read-only box tells screen readers that it copies the first hint.
- [x] A one-way Connection shows one box and no toggle. Switching to two-way shows the second box, linked.
- [x] Link, unlink, and hint edits on the canvas are undoable. A run of keystrokes in one box is one undo step.
- [x] Clicking an arrow selects its Connection and focuses that leg's box.
- [x] The pattern has an entry in the Design System doc and the dev-router showcase.
- [x] The Design System Locations reference includes a two-way pair with different hints, so the outer-side arrow labels (ruling from ticket 01) show there.
- [x] RTL tests through the location panel's Connections list cover the linked, unlinked, restore, and one-way cases.
- [x] Changelog line in In Progress (fold into 01's entry if it is still unreleased).

## Comments

- The pair keeps each Connection's link state with the record it last wrote. A record that arrives from anywhere else, such as a canvas undo, is read again from its hints, so undoing a link or an unlink also restores the toggle.
- Unlink with no held text (the pair opened linked) keeps the copied text in the second box.
- The toggle's accessible name stays **Link Travel Hints** with `aria-pressed`. Only the tooltip switches to **Unlink Travel Hints**, so a screen reader does not hear the state twice.
- Each arrow of a pair now takes clicks only on its own outer side (`FloatingEdge` draws its own hit path for a `paired` edge). The two arrows sit 10px apart with 20px hit strokes, so a click on one arrow's line selected its partner leg. A lone arrow keeps its centered hit stroke.
- Review fold-in: `hintIntent` became `updateIntent`, since the pair hands it a whole rewritten record; `TravelHintFocus.at` became `nonce`; copy fixes in the changelog and the Design System entry.
- Not covered by a test: the tooltip switching to **Unlink Travel Hints** (Base UI tooltips don't open in jsdom).
- `e2e/locations-reference.spec.ts` covers the canvas path: arrow click focus, link, one undo step per keystroke run, and undo of the link.
