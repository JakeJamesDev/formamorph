# 02: Layered Image Editor

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Authors build Layered Images in the Media tab and link them from slots. The spec covers this in Q3, Q13, Q21, Q25, its Prototype section (the layout verdict) and its Editor section.

- **Layout.** Desktop: the pane summary plus the full-screen canvas-first editor (prototype variant C). Mobile: the in-pane master–detail (variant B). The prototype branch is the visual reference; rewrite it properly, never copy it.
- **Create.** A New Layered Image action in the Media tab. Names follow Media List rules (unique, auto-suffix).
- **Layer list.** Top Layer first, drag to reorder, add, rename (unique within the rig), delete. Per-Layer opacity slider. On desktop, an eye toggle hides a Layer in the editor only.
- **Zoomed thumbnails.** Variant tiles and Layer row thumbnails zoom to the Layer's drawn area (spec Prototype section).
- **Variants.** Pick or import Media List images per Layer, reorder, remove. Each Variant takes the gallery cog rule popover, badge and summary sentence.
- **Preview.** A live composed preview, and a Preview As entity picker that evaluates rules through ticket 01's resolver at the world's starting state.
- **Size check.** One shared check owned here: a Variant whose size or aspect differs from the bottom Layer. The editor warns; ticket 08 reuses the check.
- **Slots.** The Choose popover lists layered entries next to images, with a composed thumbnail. Used By counts Variant uses; delete confirms list them.
- **Copy and UI.** Writing Guide facts list first; Design System patterns; a dev-route entry for the editor. A new visual pattern needs the user's approval.
- **Docs.** The World Editor Media page explains building and linking a Layered Image.

## Acceptance criteria

- [x] An author can create a rig, add Layers and Variants with rules, and link it into an entity gallery without the fixture world. (`LayeredImageEditor.test.tsx` "creates a rig…" on a blank world; Choose lists and hands back the rig, "Choose with Layered Images"; `mediaGallery.test.ts` "links a Layered Image picked into a new slot by its tile")
- [x] Layer reorder changes draw order in the preview and in play. (Playwright keyboard drag on the dev route: Hood below Face, preview drew Body, Hood, Face; `layeredEdit.test.ts` "moves a Layer, which changes the order the stack draws in", through the same resolver play uses)
- [x] Preview As shows a picked entity's Variants. (`LayeredImageEditor.test.tsx` "previews as a picked entity…"; DOM read on the dev route: Corin calm, no hood)
- [x] A mismatched Variant shows the size warning. (`LayeredImageEditor.test.tsx` "warns on a Variant whose size differs…"; `imageVisibility.layered.test.ts` `layeredSizeMismatches`)
- [x] Deleting an image used as a Variant lists that use in the confirm. (`LayeredImageEditor.test.tsx` "lists a Variant use in Used By and in the delete confirm…")
- [x] Frames `.scratch/frames/layered-editor-light.png` and `.scratch/frames/layered-editor-dark.png` of the full-screen editor at a desktop width, and `.scratch/frames/layered-editor-mobile.png` of the master–detail pane at mobile width. (Playwright, 1440×900 and 390×844)
- [x] Changelog fragment written. (`docs-internal/changelog.d/layered-images-02.md`)

## Landed

Dev route: `#dev?view=mainMenu&modal=layeredEditor&tab=media`. Frames: `.scratch/layered-images-02/frames/layered-editor-light.png`, `.scratch/layered-images-02/frames/layered-editor-dark.png`, `.scratch/layered-images-02/frames/layered-editor-mobile.png`.

**Not verified**
- Layer drag reorder has no committed test: jsdom gives dnd-kit no layout. The Playwright run above checked it once.

**For you**
- For you: build a three-Layer character in the editor and judge whether the flow reads clearly (Media tab).
- Judge the new Media tab pieces nobody asked for by name: a Layered Image's card shows its composed picture (not Q24's generic icon), and images only Layers use sit in a new **Layered Image Variants** section of the default grouping (without it they showed nowhere).
- A gallery slot that links a Layered Image still shows ticket 01's gray Layers tile in the strip and frame, not the composed picture. Say whether that needs its own ticket.
- The size warning names "the picture's" size, since the canvas can come from a Layer above an emptied bottom one (Q27).
- Layer renames offer no script rewrite yet; whichever of 02 and 06 lands second wires it (Q33).
