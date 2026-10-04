# 17: Mascot presets

Status: ready-for-agent
Blocked by: 14
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Mascots are presets, chosen from a dropdown at the top of the Mascot tab, with a read-only Default that follows the code.

- The help settings value's single rig becomes a mascot preset store: an active id and the custom mascots, each a named rig. The Default is virtual and never stored. A stored value of the old shape reads as nothing; the value has never shipped.
- The top row mirrors the Prompts tab's preset row: a select with Default and the custom mascots; Duplicate and Import always; Rename, Delete, Export and Reset on a custom mascot only. With Default selected the rig controls are read-only.
- Reset puts the selected custom mascot back to the Default's rig and drops its own images, after a confirm (Q53). Duplicate shares image ids; Delete and Reset remove images no remaining mascot references.
- Import adds a new mascot named from the card's name field, or the file name, with a numbered suffix on a clash, and selects it (Q54). Export writes the name into the card. **Export-shape change: the card gains a name; say so in the response.**
- The window, the face call's enum and AI Context read the active mascot.

Spec: Q53, Q54; Implementation → Mascot presets.

Recommended model rationale: a store shape change through the codec, the image store's reference rules, the card, and the tab's top row in one slice.

## Acceptance criteria

- [ ] Codec tests: the store round-trips, a missing value reads as Default active with no customs, the old single-rig shape reads as nothing.
- [ ] Preset tests: Duplicate shares images, Delete and Reset drop only unreferenced images, Import names and suffixes, Reset restores the Default's rig.
- [ ] Card tests: the name round-trips; a card without one imports under the file name.
- [ ] Component tests: the row's controls per selection; the Default's rig controls are read-only; the window draws the active mascot after a switch.
- [ ] The four gates are green.
