# 02: Edit Layers in Location and Item Image Fields

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A location's or an item's image field that holds a Layered Image offers the same **Edit Layers** button and Layered Image title that ticket 01 gives a gallery slot (spec Q4, Q6). The entity gallery and the location and item image fields share one gallery component, so ticket 01's change already shows Edit Layers in all three. This ticket guards the location and item fields with tests, checks the title there, and ships the docs line.

- **Docs.** The World Editor Media page lists location and item fields among the places Edit Layers appears.

## Acceptance criteria

- [x] A location image field holding a Layered Image shows Edit Layers, which opens that Layered Image's editor. (`a location image field` test, real `LocationImageField`)
- [x] An item image field holding a Layered Image shows Edit Layers, which opens that Layered Image's editor. (`an item image field` test, `EntityImageWidget` as ItemManager mounts it)
- [x] Both fields title the slot with the Layered Image's name. (name input value "Lamp Rig" in both tests)
- [x] A flat image in either field shows no Edit Layers. (no `data-edit-layers` in the flat slot)
- [x] Each new guard fails with its bug put back. (`editLayers` default off: 3 red; layered check dropped in both the gallery and the button: 3 red)

## Landed

**Not verified:** none.

**For you:** nothing a player must judge; the docs line is in World-Editor-Media.md under "To edit one from a gallery".
