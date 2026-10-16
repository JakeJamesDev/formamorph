# 04: Chip Options Dialog Shell

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: replaces the chip pop-out for every chip family, inside a Lexical editor and inside other dialogs, with focus and dismissal rules that have bitten before.

Parent: [Chip Options spec](../spec.md)

## What to build

A single click on any placed chip opens **Chip Options**, a centered dialog, in place of today's popover. It holds today's rows; the Entities and Persona rows come in ticket 05. Layout follows prototype variant F on `prototype/chip-options`.

- Prompt chips get two panes. Left: one short row per piece, label on the left, control on the right. Right: a pane titled **What the AI Reads**, left as a placeholder for ticket 06. Placeholder chips and Tool argument chips get one column with their current rows and no pane (Q29).
- A pick-one axis with three or fewer options is a compact segmented control. Four or more is a dropdown. Pick-many rows are inline checkbox plus label pairs. Lock groups from the registry lock the last piece on.
- Today's rows in their chip's order, then Header, Prepend and Append below a rule. Label for Unique placeholder chips stays. A registry help line becomes the control's tooltip.
- Re-Pick swaps the body for the drill picker with a Back control. Edit Value closes the dialog and opens the value.
- A read-only editor opens the dialog with every control disabled. Changing a control does not close the dialog. Escape and the close button do.
- Centered on every screen size, scrolling inside; the panes stack on narrow screens. It nests inside the Settings dialog and the entity editor. It has a `devRoutes` entry and a `surface` id.

Rulings: Q1, Q2, Q11, Q17, Q18, Q19, Q20, Q28, Q29.

## Acceptance criteria

- [ ] Every placed chip opens Chip Options; Built-in chips still open nothing.
- [ ] Each row writes its id to the token and reads it back on reopen.
- [ ] Scope is a dropdown; Content and Format are segmented; the Stats chip's pieces are checkboxes with the last one locked.
- [ ] Re-Pick, Edit Value, Label, Header, Prepend and Append work as before.
- [ ] A read-only preset shows the dialog disabled.
- [ ] Two changes in a row do not close the dialog; closing it does not close Settings.
- [ ] The dev-router opens it; the surface registry reports it.
