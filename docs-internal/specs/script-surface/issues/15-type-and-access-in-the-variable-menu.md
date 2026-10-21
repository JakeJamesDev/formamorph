# 15: Type And Access In The Variable Menu

Status: ready-for-agent
Blocked by: 13
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: a menu row pattern the user approves from a frame first, then built over every surface the menu serves without breaking its search, keyboard and insert paths.

## What to build

A Variable menu row shows what it inserts: the label on the left, the row's type on the right in muted mono, as the Tool editor's reference list prints a `detail`, and a small lock glyph on a read-only row (R9). A writable row has no glyph. A method shows no extra mark; its type, such as `(line) => void`, says what it is. The tooltip keeps the help line and the access sentence as today. Rows in a names level, the entity and stat lists, show no type. The row stays one line at the menu's width: a long type truncates with an ellipsis and the tooltip carries it whole. Before building, the ticket renders a static frame of the entity entry group and the `memories[0]` group from the design-system showcase and stops for the user's approval; the approved frame is the pattern and the Design System gets an entry for it.

Spec: R9; `docs/Design-System.md`.

## Acceptance criteria

- [ ] A static frame of the two groups with type and lock is stored at `.scratch/frames/menu-type-access.png` in both themes at desktop width, and the user approved it before the build
- [ ] Every field row renders its `detail` and a read-only row renders the lock; a writable row renders no glyph; a method row renders its function type; a test reads the DOM for one of each
- [ ] Search, keyboard navigation and insert behave as before; the existing menu tests pass unchanged
- [ ] A long type truncates on one line and the tooltip holds the full type
- [ ] The Design System gets the row pattern with its rule
- [ ] Four gates green

For you: open a script box, open **Variables**, and drill into an entity; the rows should read at a glance without the tooltip.

## Blocked by

- 13 (Verbs Last In A Group)
