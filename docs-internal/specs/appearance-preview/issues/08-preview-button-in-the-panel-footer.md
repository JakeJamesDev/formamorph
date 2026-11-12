# 08: Preview Button in the Panel Footer

Status: ready-for-human
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

- Preview sits alone on the left.
- On a link row, stat or trait: Edit Blueprint, then Reset to Blueprint, on the right. A link row has no Link To….
- On a Blueprint item in Advanced: Link To… on the right, as today.

**Edit Blueprint on stats**

- A stat's link row gets Edit Blueprint, which opens the original as a trait's does, wherever the host can open it.
- A trait link row loses Link To…. Traits already have Reset to Blueprint, so nothing is built for it.
- Rows with no footer today stay as they are, unless Edit Blueprint already shows there for traits. Stats and traits match.

**Unchanged**

- The disabled rules, and the hints in the Appearance tab (no Avatar, 3D model only, Max not above Min). Only the button moves.
- A read-only row behaves as it does today.
- Update the stats and traits wiki pages and the trait sliders help topic where they say where the button is.

## Acceptance criteria

- [x] On a plain world trait, the Preview button is in the panel's footer row while the Appearance tab is open, and the dialog opens from it. `previewFooter.test.tsx` (plain world trait); the dialog opens from the footer in `TraitManager.preview.test.tsx`.
- [x] The same on a plain world stat. `previewFooter.test.tsx` (plain world stat); `StatManager.preview.test.tsx`.
- [x] On another tab, the footer row has no Preview button. A plain row then has no footer row. "leaves the footer row empty on another tab"; the row hides by CSS when both sides are empty: Playwright read `display: none` on Details for a plain trait and stat.
- [x] The Appearance tab holds no Preview button. Asserted against the open tab panel in both plain-row tests.
- [x] On a link row, Preview is on the left and Edit Blueprint, then Reset to Blueprint, are on the right. "world stat link row" test; frame below. A trait link row is read-only and shows no Preview, as before.
- [x] On a Blueprint item in Advanced, Preview is on the left and Link To… is on the right. Blueprint stat and Blueprint trait tests.
- [x] An entity's stat and trait, and a library stat and trait, show the button in their footer rows. Library trait and stat tests, and the entity stat link row through the library host; all share `EntityStatsEditor`/`EntityTraitsEditor` on `ListEditor`.
- [x] With no Avatar, the footer button is disabled and the hint still shows in the tab. The no-Avatar tests in `TraitManager.preview.test.tsx`, now reading the button from the footer.
- [x] A stat link row shows Edit Blueprint, and it opens the original. "opens the Blueprint from a stat link row's Edit Blueprint". Mutation: drop the open action, and two tests fail.
- [x] A trait link row shows no Link To…. "leaves a trait link row … no Link To…". Mutation: put Link To… back, and it fails.
- [x] The existing Preview tests pass with the button in the footer.
- [x] Mutation: put the button in the footer on every tab, and the other-tab test fails.
- [x] Frames: `.scratch/frames/preview-footer-trait-dark-1440.png`, `.scratch/frames/preview-footer-stat-light-1440.png`, `.scratch/frames/preview-footer-link-row-dark-1440.png`. Taken with Playwright at 1440×900; the Browser pane captures only 800×600.

For you: judge the footer row on a plain trait, where it holds only Preview, and the new order on a link row.

## Landed

**Not verified**
- The mobile push layout has no Preview test of its own. It draws the same `DetailFooter` in the same scope as desktop.

**For you**
- For you: judge the footer row on a plain trait, where it holds only Preview, and the new order on a link row. `.scratch/appearance-preview-08/frames/preview-footer-trait-dark-1440.png`, `.scratch/appearance-preview-08/frames/preview-footer-link-row-dark-1440.png`.
- A placeholder copy's footer follows the shared order too: Edit Blueprint, then Reset to Blueprint, both on the right, with the pencil icon. Placeholders tab, a copy of a Blueprint placeholder.
- Spec line "the button sits beside that hint" (The Preview) now reads stale; the hint stays in the tab and the button is in the footer.
