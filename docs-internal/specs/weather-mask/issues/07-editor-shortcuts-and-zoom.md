# 07: Brush Editor Shortcuts, Zoom and Slider Values

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The brush editor gets desktop zoom, pan and shortcuts, a weather dropdown, and slider values. The spec covers this in Q22–Q25.

- **Weather dropdown.** The corner card's Rain, Snow, Storm and Bright Sun buttons become one select.
- **Shortcuts (desktop).** B: brush. E: eraser. Ctrl + wheel: brush size up and down. Wheel: zoom toward the pointer. Middle-button drag: pan. 0: back to the fit view. Shortcuts never fire while typing in a field or while a stroke is in progress, and never reach the browser's own zoom.
- **Zoom.** From the fit view (today's contain fit) to 800%. Pan stays inside the picture's bounds. A Fit button in the controls shows the zoom percentage and returns to the fit view. The tint, the weather preview and the brush ring all follow the zoomed picture. Touch keeps one-finger painting only.
- **Brush size in image pixels.** The stroke covers the same part of the picture at every zoom; the ring scales with the view. Pick a size range that suits pictures up to the 1920 cap.
- **Sliders.** Soft Edge starts at 25%. While Size or Soft Edge changes, by drag, keyboard or Ctrl + wheel, a tooltip on the slider shows the value (size in image pixels, soft edge in percent).
- **Docs.** The wiki location page lists the shortcuts.

## Acceptance criteria

- [ ] The weather preview is one dropdown; picking a kind keeps one preview canvas.
- [ ] B and E switch tools; Ctrl + wheel changes the size and shows its tooltip; none of them fire while a field has focus.
- [ ] Wheel zoom keeps the picture point under the pointer fixed; middle-drag pans; 0 and Fit return to the fit view; zoom stops at the fit view and at 800%.
- [ ] A stroke at 200% zoom marks the same mask pixels as the same stroke at fit scaled by the zoom (pure-function test on the view math).
- [ ] Soft Edge opens at 25%; each slider shows its value tooltip while it changes.
- [ ] A Playwright check of wheel zoom, middle-drag pan and the size tooltip in a real browser (jsdom has no wheel or layout), desktop project only.
- [ ] Frames: zoomed in with the ring and tooltip visible, desktop dark.
