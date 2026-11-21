# 03: Location and Item Slots

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Location image slots and item image slots link Layered Images too. The spec covers this in Q6 and Q7.

- The location and item visibility functions return ticket 01's resolved stack for a layered link and keep their bearers: the persona for a location, the instance owner for an item (none while it lies at a location).
- The location backdrop draws the stack inside its own compositor layer, with the same cover sizing and overlay fade.
- Item views (entity popup rows, item popup, Item Instance images) draw the stack. Item icon rules do not change: Auto and a specific icon still beat the item image.
- **Docs.** The World Editor Media page lists location and item slots as places a Layered Image can go.

## Acceptance criteria

- [ ] A location with a layered link shows the composed backdrop, and a persona-owned Condition switches a Layer.
- [ ] An Item Instance's layered image follows its owner's state, and an ownerless Condition never holds while the instance lies at a location.
- [ ] Tests on the location and item visibility seams cover both bearers.
- [ ] Frame `.scratch/frames/layered-backdrop-dark.png` at a desktop width.
- [ ] Changelog fragment written.
