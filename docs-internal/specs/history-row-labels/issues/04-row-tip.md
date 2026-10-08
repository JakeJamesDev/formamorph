# 04: Dedicated row tip

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: composes Base UI tooltip parts outside the shared Tip, adds a layout-dependent truncation check, and keeps the accessibility contract.

Parent: [History Row Labels spec](../spec.md)

## What to build

A truncated History row shows its whole label in a tip that looks like the row. A row shown in full gets no tip (Q1).

- The tip belongs to History. It is not the shared `Tip`, which takes a string only and names its child. It uses the Base UI tooltip parts the app's tooltip module exports, and the provider's shared delay.
- It renders the same parts and styling as the row: the italic name, the field chip, then the muted verb and type. Nothing truncates. The name wraps, and the chip wraps to the next line when needed. The popup is 18rem wide at most and opens on the left side.
- It opens on hover and on keyboard focus.
- It opens only when the row's name or field is cut off. Measure that at open time, not once at render, because the popover width and the text can change.
- The row's accessible name stays the joined label from ticket 01. The tip adds nothing for assistive technology.

## Acceptance criteria

- [ ] Render tests with a stubbed measurement: a truncated row opens a tip containing the full name and field, on hover and on focus. A row that fits opens none.
- [ ] Guard bites: removing the truncation check makes the "fits, opens none" test fail.
- [ ] Live check through `verify-ui`: hover a long-name row (the tip shows the full name wrapped, beside the list, themed in both modes), and hover a short row (no tip).
- [ ] The Undo and Redo button tips still use the shared `Tip` and the flat label.
- [ ] Four gates green.
