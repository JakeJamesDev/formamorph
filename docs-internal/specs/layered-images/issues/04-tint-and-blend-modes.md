# 04: Tint and Blend Modes

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Each Layer gets a tint color and a blend mode. The spec covers this in Q4, Q8, Q9.

- **Shape.** A Layer gains an optional tint color and a blend mode (Normal, Multiply, Screen, Add; default Normal).
- **Render.** The picture component applies them. Add is `plus-lighter`. Tint multiplies the Layer by its color and keeps its alpha.
- **Resolver.** The resolved stack carries tint and blend mode, so ticket 06 can lay script tint over it and ticket 07 can flatten it.
- **Editor.** A color control and a blend mode control per Layer in ticket 02's editor.
- **Docs.** The World Editor Media page describes both controls.

## Acceptance criteria

- [x] A tinted gray Layer draws in the tint color in the preview and in play, and transparent pixels stay transparent. Frames show the rose bar with rounded transparent corners; the tint is an SVG color-matrix filter that leaves alpha alone (`PictureImg.test.tsx`). Play uses the same `PictureImg`.
- [x] Each blend mode applies over a base, checked by computed style. Computed `mix-blend-mode` read in the preview: multiply, screen, plus-lighter; `PictureImg.test.tsx` checks the inline style.
- [x] Frames `.scratch/frames/layered-blend-modes-light.png` and `.scratch/frames/layered-blend-modes-dark.png` show all four modes and a tint.
- [x] Changelog fragment written.

⚠️ Export shape: Layers gain tint and blend mode.

## Landed

**Not verified**
- Tint on a remote (not embedded) image: it goes through the same `RemoteImg` as the Layer's image, but I drew only embedded art.
- A pixel-level alpha check of a tinted edge: the filter leaves alpha alone by construction; no test samples pixels.

**For you**
- Open `.scratch/layered-images-04/frames/layered-blend-modes-light.png` and the dark frame: check the four blend modes and the rose tint read right.
- Media tab, Blend Rig card: pick a Layer, change Blend Mode and Tint, and check the color control and Clear Tint feel right.
