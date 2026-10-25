# 02: Header Row

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A compact header over existing pieces: the worker-measured publish size, index helpers for type grouping, sorting and filters, per-device view state, and one finding's landing target. Contained UI work, so Sonnet.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

The Media tab's header becomes one row (spec P5):

- **A slim Publish Size meter** fills the left: a thin bar in the band colors and a "N MB / 100 MB" readout. It uses the same worker-measured publish size and bands as the World Doctor bar, never a main-thread measure. The World Doctor keeps its full bar.
- **Grouping** icon button: by parent (default) or by type (Images, Sounds, 3D Models, Avatars). In type grouping the stacking rules still apply inside Images, and each card names its parent.
- **Largest First** icon toggle: sorts cards by size inside each section. Off, the gallery keeps author order.
- **Filter** popover: All Media, Linked, Embedded, Has Visibility Rules, Over Size Budget. An active filter shows its name on the button. A stack forms from the images that pass the filter, so its count and total follow it (Q36).

The index module gains type grouping, size sorting and the filters. Grouping and sort are remembered per device and never reach the world. The filter resets when the editor closes.

The World Doctor's over-limit Publish Size finding now opens the Media tab instead of the Overview (Q20). Update its wiki line and the publish-size spec's note on ticket 04's target.

Changelog fragment: fold into ticket 01's line if it is still unreleased by landing time; otherwise its own line.

## Acceptance criteria

- [x] The header is one row at 1600×900 and at 390×844 (DOM read: 36 px high at both widths, no horizontal overflow, with the longest filter name on)
- [x] The meter's readout matches the World Doctor bar's figure for the same world, and its band color matches (`WorldEditor.mediaTab.test.tsx` › "reads the same figure and band as the World Doctor's bar")
- [x] Type grouping shows Images, Sounds, 3D Models and Avatars sections, with parent names on cards (test › "groups by type with parent names on the cards")
- [x] Largest First sorts each section by size and restores author order when off (test › "sorts each section's cards largest first")
- [x] Each filter narrows the gallery to the matching items; the active filter's name shows on its button (test › "narrows the gallery under %s")
- [x] Grouping and Largest First survive closing and reopening the editor; no world field changes (test › "keeps grouping and Largest First when the editor reopens")
- [x] The over-limit finding opens the Media tab (test › "opens the Media tab from the over-limit finding")
- [x] Frames: `.scratch/frames/media-header-dark.png` and `.scratch/frames/media-header-light.png` with a filter active

For you: judge whether the icon-only grouping and sort buttons read clearly enough with their tooltips.

## Landed

**Not verified**

- The 390 px label change (the "Publish Size" label turns screen-reader-only below 480 px) was made after the mobile check, and the preview has no hot reload. The one-row DOM read ran before it.

**For you**

- Judge whether the icon-only grouping and sort buttons read clearly enough with their tooltips. Frames: `.scratch/media-tab-02/frames/media-header-dark.png`, `.scratch/media-tab-02/frames/media-header-light.png`.
- Selecting a card and then filtering it out keeps its panel open (the selection survives a filter or grouping change). A selected section that a filter empties closes. Judge whether the card should close too.
- The changelog fragment lands as its own entry under the **Media Tab** group, not folded into ticket 01's line.
