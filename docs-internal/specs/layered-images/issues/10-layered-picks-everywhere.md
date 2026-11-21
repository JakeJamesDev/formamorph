# 10: Layered Picks in Every Slot and Composed Gallery Tiles

Status: ready-for-agent
Blocked by: 02, 03
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Two gaps were left after tickets 02 and 03 landed. The spec covers this in Q6, Q13 and story 46.

- **Location and item slots choose Layered Images.** Ticket 03 draws a layered link in location and item slots, but only entity galleries list Layered Images in Choose. Location image slots and item image slots now list them too, with the composed thumbnail, as entity galleries do.
- **Composed gallery tiles.** A gallery slot that links a Layered Image shows ticket 01's gray Layers tile in the strip and the frame. It now shows the composed outside-play picture through ticket 02's `outsidePlayLayered` and the shared picture component, in every gallery that can link one.
- **Docs.** The World Editor Media page says location and item slots can choose a Layered Image.

## Acceptance criteria

- [ ] An author links a Layered Image into a location image slot and an item image slot from Choose, and play shows it.
- [ ] Entity, location and item gallery strips and frames show the composed picture for a layered link, not the gray tile.
- [ ] Tests cover Choose listing layered entries for location and item slots.
- [ ] Frames `.scratch/frames/layered-location-slot-dark.png` and `.scratch/frames/layered-gallery-tile-light.png` at a desktop width.
- [ ] Changelog fragment written.
