# 04: Tint and Blend Modes

Status: ready-for-agent
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

- [ ] A tinted gray Layer draws in the tint color in the preview and in play, and transparent pixels stay transparent.
- [ ] Each blend mode applies over a base, checked by computed style.
- [ ] Frames `.scratch/frames/layered-blend-modes-light.png` and `.scratch/frames/layered-blend-modes-dark.png` show all four modes and a tint.
- [ ] Changelog fragment written.

⚠️ Export shape: Layers gain tint and blend mode.
