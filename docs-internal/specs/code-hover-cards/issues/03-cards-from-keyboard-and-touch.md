# 03: Cards From Keyboard And Touch

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Two more triggers and announcement on top of 02's card. Sonnet at high: keymap and touch timing details, no new model.

## What to build

Ctrl+K Ctrl+I (Cmd on macOS) opens the card for the name at the caret. Ctrl+I alone keeps CodeMirror's select-syntax command. On touch, a tap that places the caret on a name opens its card after a short pause. The hover path doesn't open a second card for the same tap. Typing closes the card. A card opened from the keyboard is announced through a live region.

Spec: Q2, Q3, Q10; Implementation Decisions: Triggers, Screen readers.

## Acceptance criteria

- [ ] Ctrl+K Ctrl+I opens the card at the caret; Ctrl+I alone still selects syntax
- [ ] A caret pause after a tap opens one card; typing closes it
- [ ] The live region carries the card text when opened from the keyboard
- [ ] Changelog fragment; four gates green

## Blocked by

- 02
