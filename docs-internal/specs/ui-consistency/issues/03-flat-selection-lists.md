# 03: Flat Selection Lists

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: two hand-built row buttons move to an existing shared row. The change is small and contained.

## What to build

The Settings **Tools** list and the **Code Template** library show the selected item with the primary fill, and a hovered item with the accent fill (Q11). Today both lists draw their own rows, with a muted hover and an accent selection that look the same.

Both lists use the shared compact selection row with its check mark off, so they take the Q7 states from one place. The Tools list keeps its enabled dot and monospace name. The Code Template library keeps its keyboard and selection behavior.

Rendered target: `_coloraudit/tools-list-before-after.png` and `_coloraudit/code-templates-before-after.png`.

Changelog fragment: a Fixed entry stating that the selected tool and code template stand out from the hovered one.

## Acceptance criteria

- [ ] In both lists the selected row shows the primary fill and primary foreground text. A hovered row shows the accent fill.
- [ ] The Tools list's enabled dot and name are readable on both the filled and the plain row.
- [ ] Selection, `aria-current` and keyboard behavior are unchanged. Existing tests stay green.
- [ ] A test asserts the selected row's state. Prove it bites by restoring the accent fill.
- [ ] The Design System guide's Code Template library line updated. Changelog fragment written.
- [ ] Gates green.

## Blocked by

- None (can start immediately)
