# 02: White Thumbnail Background

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: low

A one-line render change plus one small tool. The close-up framing already landed.

## What to build

A generated Avatar thumbnail renders on an opaque white background. Thumbnails already stored keep their old look.

This ticket also owns the capture tool that tickets 04 and 05 use. The tool sits in the spec's `tools` folder and renders a `.vrm` to a PNG with the app's framing and the white background. Start from the harness in the main checkout's `.scratch/avatar-license/` (`thumb.html`, `thumb.mjs`). The spec's `tools/embed-thumbnail.py` already writes a PNG into a file and sets the pixiv author. Add a flag so it can leave the author alone, because Sei keeps hers.

Rulings: Q24.

## Acceptance criteria

- [ ] A generated thumbnail has an opaque white background, proved by a pixel read in a real browser render.
- [ ] A stored thumbnail is not regenerated.
- [ ] The capture tool writes a PNG from any `.vrm` path, with no scratch path hard-coded.
- [ ] `embed-thumbnail.py` can write a thumbnail with the author unchanged.
- [ ] A changelog fragment is added. Fold it with the existing thumbnail entry if that entry is unreleased.
- [ ] Frame: `.scratch/frames/thumbnail-white.png`, one generated card in the Model Library at 1366, light theme.

For you: the white background on a library card, in the frame above.
