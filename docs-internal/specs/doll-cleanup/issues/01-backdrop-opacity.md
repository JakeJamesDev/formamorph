# 01: Backdrop Opacity

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Small, well-bounded change with a working prototype to copy from.

## What to build

An author with a too-bright Custom Image Backdrop moves an opacity slider in the Body Layout editor. The image fades in the editor and on the Inventory panel's doll. The value survives save, export and import. Default is 100%, so current worlds look the same.

This ticket also owns the larger dev fixture from the prototype (9 slots, worn items, a bright image Backdrop), so that tickets 02 and 04 can check against it.

Rulings: Q14. Prototype: branch `prototype/doll-cleanup`, commit a04717109.

## Acceptance criteria

- [x] The Body Layout editor shows an opacity slider for a Custom Image Backdrop only, not for Humanoid, Quadruped or Plain. (`WorldEditor.equipment.test.tsx`: "shows the Opacity slider for a Custom Image only")
- [x] Opacity applies in the editor and on the doll. (editor test reads the `img` opacity; `BodyBackdropArt.test.tsx`; the doll's `img` computed opacity read as 1 and 0.3 in the frames run)
- [x] The Backdrop parser keeps and clamps the value on load. A test fails when the parser drops it. (`bodyLayout.test.ts`; mutation: parser line removed, the test went red)
- [x] Replacing the image keeps the value. Absent reads as 100%. (`withBackdropImage` and `mediaParents.test.ts` replace tests, both red when the carry-over is removed)
- [x] A world export and import keeps the value. (`embedRemoteImages.test.ts` for export, red when the Backdrop is rebuilt; `parseBodies` for import)
- [x] The `items` dev fixture has 9 slots, worn items and a bright image Backdrop. (frames show 9 equipped boxes on the image)
- [x] Frames at 100% and 30%, in both themes at 1366: `.scratch/frames/opacity-100-light.png`, `opacity-100-dark.png`, `opacity-30-light.png`, `opacity-30-dark.png`. (Playwright, opacity read from the doll image)
- [x] Docs that describe Body Layouts name the slider, and a changelog fragment exists. (`docs/World-Editor-Items.md`, `docs/WorldFormat.md`, `docs-internal/changelog.d/doll-cleanup-01.md`)
- [ ] The response carries the export-shape reminder. (in the session's final message)

For you: a bright image of your own at a low opacity, on the doll in the Inventory panel. Does the fade make the boxes read?

## Landed

**Not verified**

- The export-shape reminder is a property of the final message, so it stays unticked here.
- No test mounts `BodyDoll` or the Inventory panel with a faded Backdrop. The doll shares `BodyBackdropArt`, which has its own test, and the frames run read the doll image at 1 and 0.3.
- No full export-file round trip. Export is covered at `embedWorldRemoteImages` and import at `parseBodies`.

**For you**

- A bright image of your own at a low opacity, on the doll in the Inventory panel. Does the fade make the boxes read?
- Frames: `.scratch/doll-cleanup-01/frames/opacity-100-light.png`, `opacity-100-dark.png`, `opacity-30-light.png`, `opacity-30-dark.png`.
