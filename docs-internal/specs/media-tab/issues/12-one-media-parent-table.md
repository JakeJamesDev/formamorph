# 12: One Media Parent Table

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Two close-spec review findings, one seam. The spec says the World Editor and Optimize Images both read the media index. Optimize's count does, but its shrink pass walks each image field by hand. The editor also branches on the parent's kind (world, map, entity, location, dictionary) in five places. A new image slot or parent kind needs edits in all of them.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

**One per-kind table (the user's call).** Each media parent kind gets one entry: how to read its gallery or slots from the world, how to write them back as one history step, its image cap, which rule host its rows use, and where **Go to** lands. These sites read the table in place of their own branches:

- the item actions' write (`useMediaItemActions`)
- the image panel's rule write and rule host (`MediaImagePanel`)
- the **Go to** button and the World Editor's go-to handler
- the index's stack test and its hand-built parent key (use `mediaParentKey`)

The two Map Background write paths join it, so a map image step reads the same label from both the canvas and the Media tab.

**Optimize through the index.**

Optimize Images finds the images to shrink, and each image's cap, through the media index, and writes each result back by the item's slot. The thumbnail, entity galleries, location galleries, dictionary cover images and Map Background images all come through that one path. A new image slot in the index reaches Optimize with no second edit.

Behavior stays the same: the same images, the same caps (thumbnail, entity, background, map), the same progress count, cancel, consent dialog and one history step. Gallery rule rows and order survive a run untouched.

No docs or changelog change: nothing a player sees moves, except the map step label now matching across hosts.

## Acceptance criteria

- [x] One table holds each parent kind's read, write, cap, rule host and go-to target; the five sites above have no kind branch of their own (`src/lib/mediaParents.ts`; the panel keeps only its field-widget choice)
- [x] A map image edit records the same history label from the canvas and the Media tab (`mediaParents.test.ts` label test; both sides call `mapGalleryStepLabel`)
- [x] Existing Media tab, image panel, location and Map Background tests stay green (164 tests, 8 files)
- [x] The shrink pass takes its image list and caps from the media index, not from per-field code (`worldImageItems`)
- [x] A world with every image kind optimizes to the same result as before (existing optimize tests stay green)
- [x] Rule rows, gallery order and linked images come through a run unchanged (guard test compares ids, rules and order)
- [x] A guard test fails when an image slot the index lists is skipped by the shrink pass (proved by disabling the dictionary write)

## Landed

**Not verified**
- The Media tab and canvas were not driven in a browser. Jsdom tests cover the panel, actions and Go to.

**For you**
- Add the first Map Background image from a blank Media tab card and read the step label. It now uses the canvas wording ("Set Map Background").
