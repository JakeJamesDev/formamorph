# 17: Formaquestion on mobile

Status: ready-for-agent
Blocked by: 16
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

A player on mobile can open Formaquestion as a full-screen sheet (Q14). It has the same parts as the desktop window: contents, reader, search, and the ask field when tickets 20 and later land.

- The fixed button shows on mobile sizes, placed so it does not cover the action box or a screen's own controls.
- The sheet covers the screen. It has a close control and responds to the Android back action.
- The sheet opens above an open dialog and returns to it on close.
- With the on-screen keyboard open, the text field and the last lines of content stay in view.
- Contents and reader are one column: the contents list leads to the reader, and a back control returns.
- No drag, no resize and no stored position on mobile.

Follow the look the user approved in ticket 14's mobile frame.

Recommended model rationale: the keyboard viewport and the back action have known traps on Android; the layout itself is simple.

## Acceptance criteria

- [ ] At a mobile viewport the button shows and opens a full-screen sheet
- [ ] The sheet opens above an open dialog; closing it returns to that dialog with its state intact
- [ ] With the keyboard open, the focused text field is in view
- [ ] The Android back action closes the sheet, not the app
- [ ] Contents → reader → back works in one column
- [ ] `verify-ui` evidence at the mobile preset in both themes
- [ ] Changelog: folded into the Formaquestion In Progress entry
- [ ] Four gates green
