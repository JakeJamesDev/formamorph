# 01: Undo on Every Avatar Control

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

This ticket owns the control row with its base value and undo button. Ticket 04 gives the same row a different base.

## What to build

Every slider and color in an Avatar viewer can be put back alone, and the button says whether there is anything to put back (spec, Undo in Avatar viewers).

- Each slider and each color row in Avatar Customization and in the Model Library details panel has an undo button in its label row, not in the slider's row.
- The button returns the control to its base. Here the base is the model's own value.
- The button is disabled when the control is at its base, and on a control a trait holds.
- The existing color revert becomes this button. It is no longer always enabled.
- The base is an input of the control row, so the Preview in ticket 04 can pass the saved value of a stat or trait.
- Hair Length gets the button too. Hair style has none.
- Update the wiki text on Avatar Customization where it describes reverting a color.

## Acceptance criteria

- [x] In Avatar Customization, every Body Slider, Head Feature and Hair Length has an undo button in its label row. (`useVrmCustomization.test.tsx`: Head and Body sliders and Hair Length, each by its Undo name)
- [x] An untouched slider's undo is disabled. After a drag it is enabled, and a click returns the slider to the model's own value and disables the button. (`puts a … slider back alone`)
- [x] An untouched color's undo is disabled. After a pick it is enabled, and a click returns the model's own color. (`keeps an untouched color undo disabled…`)
- [x] A slider or color a checked trait holds has its undo disabled. (`EnterWorldFlow.customizationLock.test.tsx`: Undo EarShape and Undo Skin Color disabled)
- [ ] The Model Library details panel follows the same rules.
- [ ] A control row given another base returns to that base and is disabled at it.
- [x] Mutation: make the button always enabled, and the untouched-control tests fail. (both disabled rules set to `false`: 5 undo tests and the lock test failed; restored, 14 pass)
- [ ] Frames: `.scratch/frames/customization-undo-dark-1440.png` and `.scratch/frames/customization-undo-light-1440.png`, with one changed and one untouched control visible.

For you: judge the undo button's place in the label row and its disabled look.

## Landed

**Not verified**
- The Model Library details panel follows the same rules: it uses the same hook and no test mounts the panel.
- A control row given another base: rows take a `base` prop, but no test passes a non-default one (ticket 04 will).
- Other Colors undo: no test; it needs a viewer handle for `calcColor`.
- Frames: the model never loaded in the preview pane, so there are no slider frames. A DOM read on `#dev?modal=avatar` showed Hair Color undo enabled after a pick, Eye and Skin disabled.

**For you**
- Judge the undo button's place in the label row and its disabled look: `#dev?modal=avatar` with a model that has sliders.
- A color's untouched default changed from white to the picker's start color when the model reports no color.
