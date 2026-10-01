# 17: Formaquestion on mobile

Status: in-progress
Base: 3b5d9139
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

- [x] At a mobile viewport the button shows and opens a full-screen sheet
- [x] The sheet opens above an open dialog; closing it returns to that dialog with its state intact
- [x] With the keyboard open, the focused text field is in view
- [x] The Android back action closes the sheet, not the app
- [x] Contents → reader → back works in one column
- [x] `verify-ui` evidence at the mobile preset in both themes
- [x] Changelog: folded into the Formaquestion In Progress entry
- [ ] Four gates green

## Answer

| Criterion | Proof |
|---|---|
| Button and full-screen sheet | `e2e/formaquestion.spec.ts` › "the Help tab opens a full-screen sheet and takes focus without a keyboard" (box = 375×812) and "does not cover the action box" |
| Above a dialog, state intact | › "the sheet opens above Settings, and Settings is as it was after the close" |
| Keyboard | › "with the keyboard open, the sheet and its field stay in the visible area". The sheet and the tab use `.app-viewport`, so a smaller `--app-h` shrinks the sheet. Emulated: the test sets `--app-h` as the visual viewport would |
| Android back | `AndroidBackHandler.test.tsx` › "closes Formaquestion before the dialog under it" and "when a guarded layer opened after it". A layer in the shielded layer is the top layer, and the top layer's own back stop runs first |
| One column | `Formaquestion.test.tsx` › "leads from the contents to the reader and back in one column" |
| verify-ui | Static frames at 375×812, both themes: `.scratch/fq17/frames/` (game tab, search, contents, reader, keyboard at 450px, above Settings, Settings after close) |

Rulings from the spec session (Q46): the sheet takes focus on its frame, so no keyboard opens on open; back closes Formaquestion first, on the sheet and on the tablet window; no Wide View, drag or resize on the sheet, and no "(F1)" in its Close tooltip.

Each new guard was reinstated as a bug and its test failed. The early focus return and a sheet that ignores `--app-h` fail only in Playwright, because jsdom focuses a hidden element and has no layout.

Not proven: a real phone's on-screen keyboard and the hardware back button on a device. Both rest on the existing `viewportHeight.ts` and `useHardwareBack` paths.
