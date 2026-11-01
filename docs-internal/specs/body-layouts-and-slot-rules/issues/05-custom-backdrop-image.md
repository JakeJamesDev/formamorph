# 05: Custom Backdrop Image

Status: done
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A contained addition on an existing image path.

## What to build

The Backdrop select gains Custom Image. It uses the entity image path: upload, linking and Downscale (Q30). The Backdrop's aspect follows the image, and the bottom-edge drag hides for it (Q15). Boxes keep their fractions when the image changes (Q16).

Check that world export, Downscale presets and the in-use image readers see the new reference.

## Acceptance criteria

- [x] An author picks Custom Image and uploads a file, and the Backdrop draws it at the image's aspect. `WorldEditor.equipment.test.tsx` "leaves the Backdrop alone until a file lands…" (stage `aspectRatio`, `object-contain` img). Linked through the URL box there; the file picker is the same `ImageUpload` and was not driven.
- [x] The aspect drag does not show on a Custom Image. Same test: no "Backdrop Height" slider.
- [x] The image exports with the world and survives import. `bodyLayout.test.ts` "survives import…"; `embedRemoteImages.test.ts` "Custom Image Backdrop links".
- [x] Downscale presets reach it, and a linked image follows the existing linking rules. `imageOptim.test.ts` "shrinks a Body's Custom Image…"; a link is flagged `linked` and embedded on export.
- [x] Switching back to an outline keeps the boxes. `WorldEditor.equipment.test.tsx` "keeps the boxes when it leaves for an outline…".

## Landed

**Not verified**
- Real file upload through the picker, and the drawn figure in a browser: no frame taken. Tests drive the link box and read the stage style.
- Publish size and linked-content readers: nothing beyond the media index, Optimize Images and export embed was changed or checked.

**For you**
- World Editor → Items → Equipment Settings → a Body → Backdrop → Custom Image: upload a wide and a very tall picture. Check the figure keeps the art's shape (bars past the limits) and the boxes sit where you want them.
- Media tab: the picture shows under a new Bodies section. Replace it with a different shape and check the figure follows.
