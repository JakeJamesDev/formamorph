# 02: Morph Art in the Library

Status: in-progress
Base: 22781db0
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

**Parent:** [Blank Entity Art](../spec.md)

**What to build:** The `EntityPlaceholderArt` component, shown wherever a library entity has no picture. The Entities tab's grid tiles, detailed cards and folder mosaics stop showing a gray box or the **Globe** icon.

**Rationale for the model:** a component plus wiring across a few library surfaces, with font and theme reactivity. Sonnet at high effort.

## Acceptance criteria

- [x] `EntityPlaceholderArt` renders the generator's output as inline SVG that fills its parent. Filter, mask and gradient ids come from `useId`, so many cards on one page never share an id.
- [x] Each shape is drawn in white inside a goo-filtered mask and filled with one gradient.
- [x] The art waits for `document.fonts.ready`. It redraws when the **Font** setting changes and when the theme switches between light and dark.
- [x] Seeding: the id seed is the record's `sourceId` when it has one, else its local id. So a downloaded entity matches its community card once ticket 05 lands.
- [x] Library Entities tab: the grid tile, the detailed card and a folder's mosaic cell show the art for an entity with no image. Worlds, dictionaries and avatars do not change.
- [x] The Design System showcase's Community Cards reference gains a blank entity. The guide's card pattern describes the art in one line.
- [x] Preview check at 1600 px and on a phone, in both themes. Include a folder that holds a blank entity.
- [x] Typecheck, lint, tests and build pass. Report the test wall time. Update the code graph. Add a 👤 changelog entry in the In Progress section.

## Scope notes

- **No world or save export-shape change.**
- Community Creations still shows the server silhouette until ticket 05.
