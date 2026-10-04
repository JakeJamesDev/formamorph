# 17: Mascot presets and the draft

Status: ready-for-human
Blocked by: 14
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Mascots are presets, chosen from a dropdown at the top of the Mascot tab, with a read-only Default that follows the code, and the tab edits a draft that only Save commits.

- The tab edits a draft of the selected mascot. Save and Cancel sit in the footer. The preview and Head View render the draft; the window, the face call and AI Context keep the saved mascot until Save. Save writes the store and then deletes images no mascot references; Cancel drops the draft and those images. A dirty draft blocks a mascot switch, a tab change and the dialog's close behind the World Editor's unsaved-changes prompt (Q55, Q56).

- The help settings value's single rig becomes a mascot preset store: an active id and the custom mascots, each a named rig. The Default is virtual and never stored. A stored value of the old shape reads as nothing; the value has never shipped.
- The top row mirrors the Prompts tab's preset row: a select with Default and the custom mascots; Duplicate and Import always; Rename, Delete, Export and Reset on a custom mascot only. Every button is icon-only with an accessible name, as that row's are, and its tooltip states the full function in the help voice (the six lines in Q58); Reset takes the shared reset icon. With Default selected the rig controls are read-only.
- Reset replaces the draft with the Default's rig, with no confirm: Cancel reverts it, and ticket 18 makes it one undo step (Q53, Q57). Duplicate shares image ids; Delete removes images no remaining mascot references at once, and a Reset's orphaned images go at Save.
- Import adds a new mascot named from the card's name field, or the file name, with a numbered suffix on a clash, and selects it (Q54). Export writes the name into the card. **Export-shape change: the card gains a name; say so in the response.**
- The window, the face call's enum and AI Context read the active mascot.

Spec: Q53–Q56; Implementation → Mascot presets, Mascot draft.

Recommended model rationale: a store shape change through the codec, a draft with deferred image deletion, the card, and the tab's top row in one slice.

## Acceptance criteria

- [ ] Draft tests: an edit changes the preview and not the window; Save changes the window; Cancel restores the preview; a removed layer's image survives until Save; switch, tab change and close prompt on a dirty draft.
- [ ] Codec tests: the store round-trips, a missing value reads as Default active with no customs, the old single-rig shape reads as nothing.
- [ ] Preset tests: Duplicate shares images, Delete and Reset drop only unreferenced images, Import names and suffixes, Reset restores the Default's rig.
- [ ] Card tests: the name round-trips; a card without one imports under the file name.
- [ ] Component tests: the row's controls per selection; the Default's rig controls are read-only; the window draws the active mascot after a switch.
- [ ] The four gates are green.
