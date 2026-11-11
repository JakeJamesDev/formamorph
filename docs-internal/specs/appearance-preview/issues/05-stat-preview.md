# 05: Stat Preview

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The dialog exists after ticket 04. A stat row is an amount, not a position, so the reading of a drag is the whole ticket.

## What to build

An author sets how the Avatar looks when a stat is full, and watches the path there (spec, The Preview, Stat; Q7, Q14).

- A stat's Appearance tab gets the same Preview button and dialog as a trait's.
- The rule, settled with the prototype in `.scratch/stat-preview-reading`:

  ```
  shown slider  = model's own value + progress × Change By
  a drag writes   Change By = dragged value − model's own value
  ```

- A scrubber runs from the stat's Min (`progress` 0) to its Max (`progress` 1). The dialog opens at Max.
- A drag or a color pick moves the scrubber to Max first, so a control always edits the look at Max.
- A color shows the blend from the model's own color toward the Target Color at `progress`, with the blend the game uses. A pick is the new Target Color.
- A Change By outside the slider's range shows the slider at its end with the number beside it. It changes only when the author drags it.
- One line of text says the change adds to the player's own value in play. There is no control to test a player's value.
- Undo, Save, new rows and the discard question follow ticket 04. The undo base is the look at Max from the saved Change By.
- Only numeric stats have the tab, so only they have the Preview.
- Update the stats wiki page.

## Acceptance criteria

- [ ] The Preview opens at Max with each bound slider at the model's own value plus its Change By.
- [ ] A drag to 0.8 on a slider whose model value is 0 writes Change By 0.8 on Save.
- [ ] With the scrubber at half, a slider with Change By 1 shows 0.5. A drag then moves the scrubber to Max and writes the dragged value.
- [ ] At Min, every bound slider and color shows the model's own.
- [ ] A color at half shows the game's blend of the model's color and the Target Color. A pick writes the Target Color.
- [ ] A saved Change By of 5 shows the slider at its end with "5" beside it, and Save without a drag leaves it 5.
- [ ] A slider with no row adds a row on Save only when dragged.
- [ ] A slider's undo returns to the look at Max from the saved Change By and is then disabled.
- [ ] The note about the player's own value shows in the dialog.
- [ ] Table tests cover the draft logic for a stat with the prototype's walkthrough cases.
- [ ] Mutation: write the dragged value at the scrubber's position without moving to Max, and the half-scrubber test fails.
- [ ] Frames: `.scratch/frames/stat-preview-max-dark-1440.png` and `.scratch/frames/stat-preview-half-dark-1440.png`.

For you: scrub a stat from Min to Max on the Avatar, and judge the scrubber, the jump to Max on a drag, and the note's wording.
