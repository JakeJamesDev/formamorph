# 01: Layered Image Core in Entity Galleries

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The tracer bullet. A world's Media List can hold a Layered Image, an entity gallery slot can link it, and play shows the composed picture. The spec covers this in Q1, Q2, Q3, Q7, Q11, Q21.

- **Shape.** The Media List kind gains `layered`. A layered entry holds ordered Layers (id, unique name, opacity, Variants). A Variant links an image entry plus an optional Visibility rule. Tickets 04 and 05 add tint, blend mode and transition; do not stub them.
- **Resolver.** The one deep module from the spec's Resolution section. The entity visibility function returns a resolved stack when the visible gallery link is layered. The first Variant with an empty or holding rule wins; else the Layer is empty. Ownerless Conditions read the entity (Q7). Script settings are ticket 06; the resolver takes an empty settings input now.
- **Picture component.** The shared component from the spec's Rendering section: one image per non-empty Layer, stretched to the bottom Layer's canvas, with opacity. Every in-play entity surface (entity panel, mention cards, image viewer) routes a layered link through it.
- **Authoring stopgap.** No editor yet (ticket 02). A dev fixture world with a layered entity and a dev route prove it.
- **Docs.** None; ticket 02 writes the World Editor Media section, since authors cannot build one before it.

## Acceptance criteria

- [x] A gallery slot linking a layered entry shows the composed picture in the entity panel, mention cards and image viewer. DOM reads on the `layeredImages` fixture (panel, persona row, entity modal, zoom viewer); `EntityVisual.test.tsx` "draws the stack in the panel and in the zoom viewer"; `MentionCards.layered.test.tsx` (card and pick list).
- [x] A Variant whose rule stops holding is replaced at the next commit by the next visible Variant, or by nothing. `imageVisibility.layered.test.ts` "shows each Layer's first visible Variant, and the next one…" and "leaves a Layer empty…", against changed gate input.
- [x] A gallery-level Visibility rule on the layered link still decides whether the rig shows at all. `imageVisibility.layered.test.ts` "lets the gallery link's own rule decide…".
- [x] Two entities linking one rig each show their own state. Resolver test "reads the showing entity…"; fixture DOM read (Wren hurt and hooded, Corin calm, no hood).
- [x] Resolver tests on the entity visibility seam cover first-wins, empty Layers, bearers and an all-hidden rig. `src/lib/imageVisibility.layered.test.ts`; each guard mutation-tested.
- [x] Frames `.scratch/frames/layered-entity-panel-light.png` and `.scratch/frames/layered-entity-panel-dark.png` at a desktop width show the fixture's composed picture. 1440×900, `#dev?view=gameViewer&fixture=layeredImages`.
- [x] Changelog fragment written. `docs-internal/changelog.d/layered-images-01.md`.

⚠️ Export shape: the world file gains the `layered` Media List kind.

## Landed

**Not verified**
- The swap "at the next commit" was checked through the resolver against changed gate input, not by playing a turn in a live game.

**For you**
- Look at the composed picture in play: `#dev?view=gameViewer&fixture=layeredImages` (Wren in the panel and persona row; add `&modal=entity` for Corin, click the picture for the viewer). Frames: `.scratch/layered-images-01/frames/layered-entity-panel-light.png`, `.scratch/layered-images-01/frames/layered-entity-panel-dark.png`.
- Until ticket 02, a gallery slot that links a Layered Image shows a gray Layers tile in the entity editor's gallery, and the Media tab shows a layered card with no preview or file actions. Judge whether that placeholder reads well enough for now.
- Cropped thumbnails (mention cards, pick list, persona row) cover their box top-anchored at the canvas's aspect, with every Layer stretched to the canvas.
