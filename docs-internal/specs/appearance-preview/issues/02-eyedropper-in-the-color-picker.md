# 02: Eyedropper in the Color Picker

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

One component and one browser interface. The first step is a check in the desktop app, which the spec has not confirmed.

## What to build

The themed color picker picks a color from anywhere on the screen, where the browser can do it (spec, Eyedropper; Q10).

- First confirm that the native `EyeDropper` interface works in our desktop app build. If it does not, stop and report before building.
- The picker shows an eyedropper button when the browser has the interface. The button is absent elsewhere. There is no fallback of our own.
- A pick goes through the picker's existing commit path: one change and one history step.
- A canceled pick changes nothing and shows no error.
- The picker stays open through a pick, also inside a dialog.
- The picker keeps no game dependency. It takes optional callbacks for pick start and pick end. The Avatar viewers pass them and pause the Avatar's animation between the two.
- No magnifier and no hover preview of our own.
- Ticket 01 edits the Avatar viewers' control file at the same time. Touch it only for the two callbacks.
- Update the Design System page and showcase entry for the color picker, and the wiki text that describes picking a color.

## Acceptance criteria

- [x] With the interface present, the picker shows the eyedropper button. With it absent, the picker has no such button. (`color-picker.test.tsx`: "shows no button where the browser has no EyeDropper"; button read in the preview DOM)
- [x] A pick sets the color and calls the change handler once. ("commits a pick once, keeps the picker open, and reports start and end")
- [x] A canceled pick calls no change handler and leaves the color as it was. ("leaves the color alone on a canceled pick")
- [x] The picker is still open after a pick and after a cancel, inside a dialog too. (both tests above read the hex field after; "keeps the picker open through a pick inside a dialog" fires an outside pointer and Escape mid-pick)
- [x] In an Avatar viewer, the Avatar's animation is paused during a pick and runs again after a pick and after a cancel. (`useVrmCustomization.test.tsx`, eyedropper block: `viewerProps.animate`)
- [ ] A pick in the World Editor is one step in the editor's history.
- [x] The result of the desktop app check is written in the ticket's Landed section.
- [x] Mutation: remove the feature check, and the "absent" test fails. (also: disable the dismissal guard, and the dialog test fails; drop the queued-frame cancel, and the drag-frame test fails)
- [x] Frames: `.scratch/frames/color-picker-dropper-dark.png` and `.scratch/frames/color-picker-dropper-light.png`.

For you: pick a color from a reference image and from the Avatar in the desktop app, and judge the button's place in the picker.

## Landed

**Desktop app check:** passes. A probe window in the bundled Electron 42.5.0 (Chromium 148) on the production `app://` secure scheme reports `EyeDropper` present, and `open()` starts the sampler (it ended with `AbortError` only when the probe aborted it). On a `data:` page the interface is absent, because it needs a secure context. The app's own pages are secure.

**Not verified**
- A pick in the World Editor is one history step. The picker sends one change per pick through its existing commit path, and the tests assert one call. No World Editor history test ran.
- A real pick with a real click. Only a stubbed `EyeDropper` ran in tests, and the Electron probe aborted its own pick.

**For you**
- Pick a color from a reference image and from the Avatar in the desktop app, and judge the button's place in the picker. Frames: `.scratch/appearance-preview-02/frames/color-picker-dropper-dark.png`, `.scratch/appearance-preview-02/frames/color-picker-dropper-light.png`.
