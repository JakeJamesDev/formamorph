# 04: Chat Choice States

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Recommended model rationale: one class list and its tests. The care is in the focus and quote-color rules.

## What to build

In the Chat layout, a staged choice (its text is in the input box) stands out from a hovered one (Q12).

- **Hover:** solid border, a light primary tint (25%) and the foreground text color.
- **Keyboard focus:** looks like hover, plus its focus ring, so a focused choice never reads as staged.
- **Staged:** the full primary fill, as today.

Quoted dialogue inside a choice keeps the surrounding text color whenever the bubble is filled.

Rendered target: `_coloraudit/chat-choices-before-after.png`.

Changelog fragment: a Fixed entry stating that in Chat, a choice you picked stays filled and a hovered choice shows only a light tint.

## Acceptance criteria

- [ ] A hovered or focused unstaged choice shows the solid border and the light tint, not the fill.
- [ ] A staged choice shows the primary fill. Hovering it keeps the fill.
- [ ] The focus ring stays visible on the tint in every theme.
- [ ] Quoted text is readable on the tint and on the fill.
- [ ] A test asserts the states. Prove it bites by restoring the hover fill.
- [ ] The Design System guide's chat choices entry updated, if one exists. Changelog fragment written.
- [ ] Gates green.

## Blocked by

- None (can start immediately)
