# 10: Map Background

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

A new world field drawn in two React Flow hosts (the editor canvas and the player's Map) with a placement mode, plus a Media tab card and a new image cap. The canvas is large and gesture-heavy, so Opus.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

A world can hold one optional **Map Background** image (Q68–Q73).

- **Shape:** the world overview gains an optional map background: the image (upload or link, like other image fields), its canvas position and size, and an opacity. Additive and unreleased, so no migration. It counts toward the publish size like other media.
- **Canvas:** the image draws behind every location box, in canvas space, so it pans and zooms with the layout. It is locked by default: dragging, selecting and connecting locations never touch it.
- **Adjust Background:** a toggle (canvas context menu, and the panel's own button) puts the image in front for editing. The author drags it and resizes it by its corners at its own aspect ratio. A small canvas panel shows an **Opacity** slider and **Remove** while Adjust is on. Each drag, resize or slider release is one history step.
- **Set Background Image…** in the canvas context menu uploads or links an image. A first image covers the bounding box of the locations (or the visible area when there are none).
- **Map:** the player's in-game Map draws the same image at the same place, size and opacity, behind the boxes.
- **Media tab:** a World › Map Background card with its size and budget, and an item panel with Replace, Download, Remove and **Go to Locations**. With no image it shows as a blank card under **No Images** (ticket 09), and its upload lands at the default placement.
- **Budget:** a new map cap of 2560 px and 2.5 MB. Optimize Images and the Over Size Budget filter use it.

Ship the docs it stales: the Locations page (canvas section), the Media tab page, and the world format page. Changelog fragment of its own, plus the export-shape reminder in the landing message.

## Acceptance criteria

- [ ] **Set Background Image…** adds an image that covers the locations' bounding box
- [ ] With Adjust off, the image never moves, and location drags, selection and connections work as before
- [ ] With Adjust on, drag and corner resize move and scale the image at a fixed aspect ratio; each is one undo step
- [ ] The Opacity slider changes canvas and Map alike, and one release is one undo step
- [ ] The player's Map shows the image at the same place, size and opacity
- [ ] The Media tab shows a World › Map Background card; Replace, Download and Remove work; Remove is one undo step
- [ ] **No Images** shows a blank Map Background card when the world has none, and its upload lands at the default placement
- [ ] Optimize Images and Over Size Budget use the 2560 px, 2.5 MB cap
- [ ] Export, publish and import keep the image, placement and opacity
- [ ] Frames: `.scratch/frames/map-background-adjust-dark.png` and `.scratch/frames/map-background-map-light.png` at 1600×900

For you: trace a hand-drawn world map behind your locations, then open the Map in play.
