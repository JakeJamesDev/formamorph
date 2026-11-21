# 10: Layered Picks in Every Slot and Composed Gallery Tiles

Status: done
Blocked by: 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Two gaps were left after tickets 02 and 03 landed. The spec covers this in Q6, Q13 and story 46.

- **Location and item slots choose Layered Images.** Ticket 03 draws a layered link in location and item slots, but only entity galleries list Layered Images in Choose. Location image slots and item image slots now list them too, with the composed thumbnail, as entity galleries do.
- **Composed gallery tiles.** A gallery slot that links a Layered Image shows ticket 01's gray Layers tile in the strip and the frame. It now shows the composed outside-play picture through ticket 02's `outsidePlayLayered` and the shared picture component, in every gallery that can link one.
- **Docs.** The World Editor Media page says location and item slots can choose a Layered Image.

## Acceptance criteria

- [ ] An author links a Layered Image into a location image slot and an item image slot from Choose, and play shows it. Linking is verified (`MediaImagePanel.layeredSlots.test.tsx`, `EntityFields.itemLayered.test.tsx`); play's drawing is ticket 03's and was not re-run.
- [x] Entity, location and item gallery strips and frames show the composed picture for a layered link, not the gray tile. `MediaImagePanel.layeredSlots.test.tsx` reads the strip and frame; `mediaGallery.test.ts` covers world and embedded rigs (Q40).
- [x] Tests cover Choose listing layered entries for location and item slots. Item slots use the shared entity widget, so the item test mounts it as `ItemManager` does.
- [ ] Frames `.scratch/frames/layered-location-slot-dark.png` and `.scratch/frames/layered-gallery-tile-light.png` at a desktop width.
- [x] Changelog fragment written. `docs-internal/changelog.d/layered-images-10.md`.

## Landed

**Not verified**
- Both frames. The Browser pane stayed hidden (no open window), and the page did not render.
- Play drawing a newly linked location or item Layered Image. Ticket 03 owns that draw.
- The item slot inside the real `ItemManager`. The test mounts the same widget with the same props.

**For you**
- Marsh or any location in the Media tab: link a Layered Image from Choose and look at the strip tile and frame. They show the stacked picture, not a gray tile.
- A library entity with a Layered Image: its gallery strip shows the default look.
