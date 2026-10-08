# 06: Reveal after undo

Status: ready-for-agent
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Rationale: reuses the existing reveal path; the work is mapping slices to tabs and handling the gone-record cases.

Parent: [Editor Undo, Redo and History spec](../spec.md)

## What to build

After an undo or redo the editor shows what came back (Q6, stories 33 to 33c).

- A Step records the ids it touched. The editor opens the tab that owns the first touched record and selects it, through the reveal path the find bar and Take Me There use.
- A touched record that is gone clears that tab's selection.
- A connection reveals the Locations tab and selects the connection on the canvas.
- An overview field reveals the Overview tab.
- Reveal is skipped while the tour runs (Q21).

## Acceptance criteria

- [ ] From the Entities tab, undo a stat edit: the Stats tab opens with that stat selected.
- [ ] Undo an add while the added record is selected: the selection clears and the panel shows the empty state.
- [ ] Undo a connection edit: Locations tab, canvas view, the connection selected.
- [ ] Undo a thumbnail change: the Overview tab opens.
- [ ] During the tour, an undo through the hook changes no tab or selection.
- [ ] Gates green: `typecheck`, `lint`, `test`, `build`.
