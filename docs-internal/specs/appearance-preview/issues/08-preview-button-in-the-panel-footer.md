# 08: Preview Button in the Panel Footer

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The footer row belongs to the list editors, outside the stat and trait editors that hold the Preview's state. This ticket owns the footer slot that joins them.

## What to build

The Preview button sits in the editor panel's footer row, not at the top of the Appearance tab (spec, The Preview). Tickets 04 and 05 built it in the tab.

**The footer slot**

- The detail layout gives its footer area a slot that the open editor can put an action into. The stat and trait editors put the Preview button there while the Appearance tab is open. The Preview's state stays in those editors.
- A plain stat or trait has no footer row today. It gets one while the Appearance tab is open, and it holds only the Preview button.
- Every host of the stat and trait editors gets it: world stats and traits, entity stats and traits, link rows, and the library stat and trait editors.
- Do not lift the Preview's state into each host's footer.

**Footer order**

- Preview sits on the left.
- Reset to Blueprint moves to the right. Link stays on the right. One row never has both Reset to Blueprint and Link.

**Reset to Blueprint on traits**

- A stat's link row has Reset to Blueprint. A trait's has none today. Give traits the same button, with the same behavior a stat's has.
- If a trait has no link-row state for a reset to act on, stop and ask the spec session before you build one.

**Unchanged**

- The disabled rules, and the hints in the Appearance tab (no Avatar, 3D model only, Max not above Min). Only the button moves.
- A read-only row behaves as it does today.
- Update the stats and traits wiki pages and the trait sliders help topic where they say where the button is.

## Acceptance criteria

- [ ] On a plain world trait, the Preview button is in the panel's footer row while the Appearance tab is open, and the dialog opens from it.
- [ ] The same on a plain world stat.
- [ ] On another tab, the footer row has no Preview button. A plain row then has no footer row.
- [ ] The Appearance tab holds no Preview button.
- [ ] On a link row, Preview is on the left and Reset to Blueprint is on the right.
- [ ] On a Blueprint item in Advanced, Preview is on the left and Link is on the right.
- [ ] An entity's stat and trait, and a library stat and trait, show the button in their footer rows.
- [ ] With no Avatar, the footer button is disabled and the hint still shows in the tab.
- [ ] A trait's link row has Reset to Blueprint, and it does what a stat's does.
- [ ] The existing Preview tests pass with the button in the footer.
- [ ] Mutation: put the button in the footer on every tab, and the other-tab test fails.
- [ ] Frames: `.scratch/frames/preview-footer-trait-dark-1440.png`, `.scratch/frames/preview-footer-stat-light-1440.png`, `.scratch/frames/preview-footer-link-row-dark-1440.png`.

For you: judge the footer row on a plain trait, where it holds only Preview, and the new order on a link row.
