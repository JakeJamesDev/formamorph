# 02: Eyedropper in the Color Picker

Status: ready-for-agent
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

- [ ] With the interface present, the picker shows the eyedropper button. With it absent, the picker has no such button.
- [ ] A pick sets the color and calls the change handler once.
- [ ] A canceled pick calls no change handler and leaves the color as it was.
- [ ] The picker is still open after a pick and after a cancel, inside a dialog too.
- [ ] In an Avatar viewer, the Avatar's animation is paused during a pick and runs again after a pick and after a cancel.
- [ ] A pick in the World Editor is one step in the editor's history.
- [ ] The result of the desktop app check is written in the ticket's Landed section.
- [ ] Mutation: remove the feature check, and the "absent" test fails.
- [ ] Frames: `.scratch/frames/color-picker-dropper-dark.png` and `.scratch/frames/color-picker-dropper-light.png`.

For you: pick a color from a reference image and from the Avatar in the desktop app, and judge the button's place in the picker.
