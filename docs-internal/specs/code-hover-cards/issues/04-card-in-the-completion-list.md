# 04: Card In The Completion List

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Reuses 02's renderer in CodeMirror's info pane. Sonnet at medium: one renderer hook-up plus laziness.

## What to build

The completion list's info pane, always open as today, shows the same card as hover. The card is built only for the option on screen, never for every option on every keystroke.

Spec: Q4; Implementation Decisions: Completion pane.

## Acceptance criteria

- [ ] The info pane shows the full card for the selected option
- [ ] Card models build only for the shown option; a test counts the builds
- [ ] Changelog fragment; four gates green

## Blocked by

- 02
