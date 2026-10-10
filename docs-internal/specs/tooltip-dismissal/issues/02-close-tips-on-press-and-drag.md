# 02: Close Tips on Press and Drag

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Rationale: the held-button state has edge cases (pointer cancel, release outside the window) that need care.

Parent: [Tooltip Dismissal spec](../spec.md)

## What to build

A press anywhere, a right-click, or a native drag closes the open tip (Q2). No tip opens from hover while a pointer button is held, so a drag across the library board or the Trait Tree opens nothing (Q3). Tips work again after the button is released. Both the shared root and the wrapped `Tooltip` root read the same press state.

## Acceptance criteria

- [ ] `pointerdown` anywhere closes an open tip.
- [ ] `contextmenu` closes an open tip.
- [ ] Native `dragstart` closes an open tip.
- [ ] Hover opens no tip while a pointer button is held.
- [ ] The hold ends on `pointerup` and on `pointercancel`, and hover tips work again.
- [ ] The wrapped `Tooltip` root follows the same rules.
- [ ] Tests at the tooltip seam. Each fails when its guard is removed.
