# 06: Destructive List-Row X

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: one shared row's action button plus its showcase. The care is in contrast on a selected row.

## What to build

The X that deletes a list row is an icon button that turns destructive red on hover (Q10). The change goes in the shared editor row, so every World Editor list and tree, the library editors and the Mascot tab pick it up. Other row actions, such as Duplicate, keep their neutral hover.

On a selected row (primary fill), the hovered X must stay readable. It takes the destructive color as a fill or chip, not as red text on the fill.

Changelog fragment: a Fixed entry stating that a list row's delete button turns red on hover.

## Acceptance criteria

- [ ] Hovering a row's delete X shows the destructive color on plain and selected rows, readable in light and dark.
- [ ] Other row actions keep their neutral hover.
- [ ] Keyboard focus on the X shows its focus ring.
- [ ] A test asserts the X's destructive hover. Prove it bites by removing the hover.
- [ ] The Design System guide (Lists with controls) and showcase updated. Changelog fragment written.
- [ ] Gates green.

## Blocked by

- None (can start immediately)
