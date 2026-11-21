# 01: Layered Image Core in Entity Galleries

Status: ready-for-agent
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

- [ ] A gallery slot linking a layered entry shows the composed picture in the entity panel, mention cards and image viewer.
- [ ] A Variant whose rule stops holding is replaced at the next commit by the next visible Variant, or by nothing.
- [ ] A gallery-level Visibility rule on the layered link still decides whether the rig shows at all.
- [ ] Two entities linking one rig each show their own state.
- [ ] Resolver tests on the entity visibility seam cover first-wins, empty Layers, bearers and an all-hidden rig.
- [ ] Frames `.scratch/frames/layered-entity-panel-light.png` and `.scratch/frames/layered-entity-panel-dark.png` at a desktop width show the fixture's composed picture.
- [ ] Changelog fragment written.

⚠️ Export shape: the world file gains the `layered` Media List kind.
