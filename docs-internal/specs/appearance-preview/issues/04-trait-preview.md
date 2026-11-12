# 04: Trait Preview

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This ticket owns the Preview dialog and its draft logic. Tickets 05 and 06 extend both.

**Also wait for:** Avatar Pick Rules ticket 04 (Entity Rows List the Resolved Avatar). This ticket reads its lookup of the Avatars a row plays on. Do not start before it has landed.

## What to build

An author sets a trait's look on the Avatar itself (spec, The Preview; Q8, Q9, Q13, Q15, Q16).

- A Preview button sits at the top of a trait's Appearance tab. It opens a dialog with the Avatar viewer and the controls.
- The Avatar is the one the row resolves to. With several, this ticket opens the first; ticket 06 adds the choice.
- With no Avatar, the button is disabled beside the hint. An entity's 3D model is never previewed.
- The controls are the Avatar's Body Sliders, Head Features, and skin, eye and hair colors, from the shared control rows of ticket 01. Hair style, Hair Length and other colors are absent.
- A slider shows its Set To value, or the model's own where the trait has no row. A color does the same. Only this trait's rows apply.
- The draft logic is a pure module: rows in, control values out, a drag or pick in, rows out on Save. Ticket 05 adds the stat reading to it.
- Each control's undo returns to the value the dialog opened with and is disabled at it.
- Save: an existing row keeps its place and takes the control's value. A control with no row adds a row only when the author changed it. No row is removed.
- Save writes the trait once, as one step in the editor's history, and closes the dialog. It is disabled when nothing is changed.
- Closing with changes asks to discard them.
- The viewer mounts only while the dialog is open.
- Add a dev-route entry for the dialog.
- Update the traits wiki page and the trait sliders help topic.

## Acceptance criteria

- [x] The Preview opens the trait's resolved Avatar with its slider and color pins applied. (`TraitManager.preview.test.tsx` "opens the trait's resolved Avatar…"; frame)
- [x] A drag on a pinned slider and Save writes the new Set To on the same row. ("writes a drag on a pinned slider to the same row")
- [x] A drag on a slider with no row and Save adds a row. An untouched slider adds none. ("adds a row for a dragged slider…"; draft table tests)
- [x] A slider dragged and then put back with its undo adds no row. (Save disabled after the undo; draft table case "dragged and put back")
- [x] A color pick and Save writes the Set To color. ("writes a picked color…")
- [x] A control's undo returns to the trait's saved value, not the model's own, and is then disabled. (Ear Shape back to 0.6, Hair Color back to #ffffff; mutations to the model's own value fail both)
- [x] Save is disabled with no change. After Save, one Undo in the editor restores the trait as it was. (Save writes once; `GameDataContext.history.test.tsx` "undoes a Preview's Save…in one step")
- [x] Closing with a change asks to discard. Discard leaves the trait unchanged. ("asks before closing…"; mutation that skips the question fails it)
- [x] With no Avatar, the button is disabled and the hint shows. An entity with only a 3D model gets the same. (two tests; disabled frame)
- [x] Other traits' and stats' rows do not change the previewed Avatar. (fixture has a rival trait and a bound stat; viewer props read)
- [x] Table tests cover the draft logic: an existing row, a new row, an untouched control, a row whose slider the Avatar lacks. (`appearancePreview.test.ts`, 21 tests)
- [x] Mutation: make Save write every control, and the untouched-control test fails. (ran: 10 of 21 fail, the untouched case among them)
- [x] Frames: `.scratch/frames/trait-preview-dark-1440.png`, `.scratch/frames/trait-preview-light-1440.png`, and `.scratch/frames/trait-preview-disabled-dark-1440.png`. (Playwright; the Browser pane was hidden)

For you: open the Preview on an Elf-style trait, set the ears by eye, and judge the dialog's layout and the Save and discard flow.

## Landed

**Not verified**
- None.

**For you**
- For you: open the Preview on an Elf-style trait, set the ears by eye, and judge the dialog's layout and the Save and discard flow.
- The new hint beside the disabled button on an entity with only a 3D model: "Set an Avatar on the Profile tab to preview". A world row never shows it, because a world row with no Avatar has no model and shows the existing hint.
- Dialog words: title "Preview <trait>", the confirm "Discard Changes?" with "You'll lose the slider and color changes you made in this Preview.", and the section headings Head Features, Body Sliders, Colors.
- The color rows follow the shared channel order (Skin, Eye, Hair), not Avatar Customization's (Hair, Eye, Skin).
- Frames: `.scratch/appearance-preview-04/frames/trait-preview-dark-1440.png`, `.scratch/appearance-preview-04/frames/trait-preview-light-1440.png`, `.scratch/appearance-preview-04/frames/trait-preview-disabled-dark-1440.png`. The open frames use `aurelia-ears.vrm` in place of the bundled Avatar.
- For ticket 06: Save reads the look's keys, so a change on another Avatar's slider survives. The dialog still builds its draft from the first model it loads.
