# 05: Remove The Entity Image Cap

Status: ready-for-human
Status note: Entities only, by user decision 2026-09-10: a filled location background still asks before Generate replaces it. The live preview check did not run (hidden pane); the tests render the real uploader.
Base: bfc64827
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

The image widget's slot, drop, upload, and generation branches all read the cap, and the generate tests assert the replace dialog. Removing a rule from a widget with this many paths, and rewriting its tests rather than deleting them, wants Opus.

## Parent

`docs-internal/specs/publish-size/spec.md`

## What to build

An entity carries as many uploaded images as the author adds. Upload is always allowed, a multi-file drop adds every file, and AI generation always adds a new image. The "Replace which image?" dialog, the "Upload limit reached" note, and the swapped paste placeholder are gone. Replacing an image still works through its own slot. Locations keep one background image by slot count. Per-image caps, the downscale prompt, and the oversized-image finding are unchanged. Imported worlds with long image lists load as before.

## Acceptance criteria

- [x] The embedded-image limit constant, the widget prop, and every branch that reads it are gone
- [x] Generation with every slot filled adds a new image and no replace dialog appears
- [x] A drop of three files onto an entity with two images yields five
- [x] No "Upload limit reached" text renders anywhere
- [x] Replacing through a slot still works; a location still has one background slot
- [x] Existing generate tests are rewritten, not deleted; each fails with the cap reinstated
- [x] Four gates green

## Blocked by

- None — can start immediately
