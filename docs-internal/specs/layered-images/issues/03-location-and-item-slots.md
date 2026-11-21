# 03: Location and Item Slots

Status: done
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

- [x] A location with a layered link shows the composed backdrop, and a persona-owned Condition switches a Layer. DOM read on the `layeredImages` fixture: room and rain Layers drawn, rain shown at the persona's Warmth 20; test "reads the persona for a Variant rule with no owner".
- [x] An Item Instance's layered image follows its owner's state, and an ownerless Condition never holds while the instance lies at a location. Tests "reads the owning entity…" and "never holds an ownerless Condition while the instance lies at a location"; both fail when the owner rule is broken.
- [x] Tests on the location and item visibility seams cover both bearers. `imageVisibility.layeredSlots.test.ts`, plus the script readers still skipping layered links (Q24).
- [x] Frame `.scratch/frames/layered-backdrop-dark.png` at a desktop width. 1440 wide, `layeredImages` fixture.
- [x] Changelog fragment written. `docs-internal/changelog.d/layered-images-03-location-and-item-slots.md`.

## Landed

**Not verified**
- Motion: Layer transitions on a location or item stack are ticket 02's, so none were checked here.
- Light theme: the backdrop frame is dark only.

**For you**
- Open the `layeredImages` fixture (`#dev?view=gameViewer&fixture=layeredImages`): the White Room backdrop shows rain behind the panels. Frame: `.scratch/layered-images-03/frames/layered-backdrop-dark.png`.
- Open the Inventory tab there: the worn Rig Cloak draws as a stack on the Body Doll and in the equipped list, with its hood showing.
- The Body Doll now draws a layered item (spec Q26).
