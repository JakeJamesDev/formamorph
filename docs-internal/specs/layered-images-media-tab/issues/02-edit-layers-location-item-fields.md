# 02: Edit Layers in Location and Item Image Fields

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

A location's or an item's image field that holds a Layered Image offers the same **Edit Layers** button and Layered Image title that ticket 01 gives a gallery slot (spec Q4, Q6). It reuses ticket 01's action-row button rather than building another.

- **Docs.** The World Editor Media page lists location and item fields among the places Edit Layers appears.

## Acceptance criteria

- [ ] A location image field holding a Layered Image shows Edit Layers, which opens that Layered Image's editor.
- [ ] An item image field holding a Layered Image shows Edit Layers, which opens that Layered Image's editor.
- [ ] Both fields title the slot with the Layered Image's name.
- [ ] A flat image in either field shows no Edit Layers.
- [ ] Each new guard fails with its bug put back.
