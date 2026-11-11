# 04: Trait Preview

Status: ready-for-agent
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

- [ ] The Preview opens the trait's resolved Avatar with its slider and color pins applied.
- [ ] A drag on a pinned slider and Save writes the new Set To on the same row.
- [ ] A drag on a slider with no row and Save adds a row. An untouched slider adds none.
- [ ] A slider dragged and then put back with its undo adds no row.
- [ ] A color pick and Save writes the Set To color.
- [ ] A control's undo returns to the trait's saved value, not the model's own, and is then disabled.
- [ ] Save is disabled with no change. After Save, one Undo in the editor restores the trait as it was.
- [ ] Closing with a change asks to discard. Discard leaves the trait unchanged.
- [ ] With no Avatar, the button is disabled and the hint shows. An entity with only a 3D model gets the same.
- [ ] Other traits' and stats' rows do not change the previewed Avatar.
- [ ] Table tests cover the draft logic: an existing row, a new row, an untouched control, a row whose slider the Avatar lacks.
- [ ] Mutation: make Save write every control, and the untouched-control test fails.
- [ ] Frames: `.scratch/frames/trait-preview-dark-1440.png`, `.scratch/frames/trait-preview-light-1440.png`, and `.scratch/frames/trait-preview-disabled-dark-1440.png`.

For you: open the Preview on an Elf-style trait, set the ears by eye, and judge the dialog's layout and the Save and discard flow.
