# 05: Authored Quote Color

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An author can pin a quote color on an entity. A pinned color beats the auto palette from ticket 04.

- **Field:** entities get an optional quote color field, edited in the World Editor with the existing color picker.
- **Contrast:** the editor warns when the color fails the contrast target in the light or dark theme.
- **Export shape:** world entities gain an optional field. The change is additive and the shape has not shipped, so no compatibility code is needed.
- **Changelog:** a fragment for the feature.

## Acceptance criteria

- [ ] A pinned color renders on that entity's quotes. Clearing it brings back the palette color.
- [ ] A low-contrast pick shows the warning and names the failing theme.
- [ ] World export and import round-trip the field. Worlds without it are unchanged.
- [ ] Frames: `.scratch/frames/editor-quote-color.png`, light and dark.
