# 10: Map Background

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A new world gallery with Visibility rules, drawn in two React Flow hosts (the editor canvas and the player's Map) with a placement mode, plus Media tab cards and a new image cap. The canvas is large and gesture-heavy, so Opus.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

A world can hold an optional **Map Background** gallery (Q68–Q75).

- **Shape:** the world overview gains an optional map background: a gallery of images in the shape entities and locations use, each with optional rule rows, plus one shared frame (canvas position, size and opacity). Every image fits inside the frame at its own aspect ratio (Q75). Additive and unreleased, so no migration. It counts toward the publish size like other media.
- **Rules (Q74):** a bearer-less row reads the played persona, as on a location (Q48). In play the Map shows the first visible image in author order, and no image when none passes. The time Condition works here. The canvas and other authoring lenses show slot 0.
- **Canvas:** the image draws behind every location box, in canvas space, so it pans and zooms with the layout. It is locked by default: dragging, selecting and connecting locations never touch it.
- **Adjust Background:** a toggle (canvas context menu, and the panel's own button) puts the image in front for editing. The author drags it and resizes it by its corners at its own aspect ratio. A small canvas panel shows an **Opacity** slider and **Remove** while Adjust is on. Each drag, resize or slider release is one history step.
- **Set Background Image…** in the canvas context menu uploads or links an image. A first image covers the bounding box of the locations (or the visible area when there are none).
- **Map:** the player's in-game Map draws the same image at the same place, size and opacity, behind the boxes.
- **Media tab:** World › Map Background cards that stack at two or more images, like an entity's. They open the image panel (ticket 05) with the gallery, each image's Visibility rule editor, Replace, Download, Remove and **Go to Locations**. With no image it shows as a blank card under **No Images** (ticket 09), and its upload lands at the default placement.
- **Budget:** a new map cap of 2560 px and 2.5 MB. Optimize Images and the Over Size Budget filter use it.

Ship the docs it stales: the Locations page (canvas section), the Media tab page, and the world format page. Changelog fragment of its own, plus the export-shape reminder in the landing message.

## Acceptance criteria

- [ ] **Set Background Image…** adds an image that covers the locations' bounding box
- [ ] With Adjust off, the image never moves, and location drags, selection and connections work as before
- [ ] With Adjust on, drag and corner resize move and scale the image at a fixed aspect ratio; each is one undo step
- [ ] The Opacity slider changes canvas and Map alike, and one release is one undo step
- [ ] The player's Map shows the image at the same place, size and opacity
- [ ] A second image with a rule shows on the Map only while a row holds, in the same frame; a bearer-less stat Condition reads the played persona
- [ ] The canvas shows slot 0 whatever the rules say
- [ ] The Media tab stacks a multi-image Map Background; its image panel edits each image's rule; Replace, Download and Remove work, each one undo step
- [ ] **No Images** shows a blank Map Background card when the world has none, and its upload lands at the default placement
- [ ] Optimize Images and Over Size Budget use the 2560 px, 2.5 MB cap
- [ ] Export, publish and import keep the images, their rules, the frame and the opacity
- [ ] Frames: `.scratch/frames/map-background-adjust-dark.png` and `.scratch/frames/map-background-map-light.png` at 1600×900

For you: trace a hand-drawn world map behind your locations, add a ruined version ruled on a story stat, then open the Map in play and watch it swap.
