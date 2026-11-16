# 05: Authored Quote Color

Status: done
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

- [x] A pinned color renders on that entity's quotes. Clearing it brings back the palette color. (`speakerPalette.test.ts` "gives a pinned entity its swatch…"; the editor test "clears the field when Auto is picked". GameViewer feeds `authoredEntities` into `speakerColors`, and 04's tests cover the path from map to span.)
- [ ] A low-contrast pick shows the warning and names the failing theme. (Superseded by Q56: authors pick only from vetted swatches, and `speakerPalette.test.ts` holds every swatch to 4.5:1 on every theme's background and card in each mode.)
- [x] World export and import round-trip the field. Worlds without it are unchanged. (`quoteColorFile.test.ts`, which also covers character cards per Q57.)
- [x] Frames: `.scratch/character-mentions-05/frames/editor-quote-color-light.png` and `editor-quote-color-dark.png`, plus the approved `swatch-sheet.png`.

## Landed

**Not verified**
- The contrast warning: Q56 replaced it with the swatch palette and its contrast test.
- A pinned swatch on a live turn with Character Mentions on: no dev fixture pins a color. The unit tests and 04's consumer tests cover the path.

**For you**
- Pin a swatch on an entity in the World Editor (Advanced mode, Profile tab, Quote Color). Then play a turn with Character Mentions on and check that its quotes take that color in light and dark mode.
- Swatch sheet: `.scratch/character-mentions-05/frames/swatch-sheet.png`.
