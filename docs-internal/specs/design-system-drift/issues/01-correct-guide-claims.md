# 01: Correct the seven guide claims

Status: in-progress
Base: c87369b8
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Doc-only edits to the Design System guide. Each edit changes one sentence or table cell so the guide describes the code as it ships. The code does not change.

## Parent

[spec.md](../spec.md), items 1, 2, 5, 6, 7, 8, 9.

## What to build

An agent who reads the guide finds claims that the cited production code supports. The seven corrections:

1. **Palettes and status tokens.** The foundations table says only the base light and dark blocks define the semantic status tokens, and every palette keeps them. Remove the contradiction with the later sentence that already says semantic colors stay constant across palettes.
2. **Canvas search names.** The Bounded Spatial Workspace overflow row says search rows truncate, and only the reference's selected-location output exposes the complete name.
3. **Font citation.** The foundations table cites where the app font variable is defined (the stylesheet), where it is set (the settings context), and where the sans stack consumes it (the Tailwind config). The settings defaults module stays cited for the font registry only.
4. **Toolbar hairlines.** The Focused Markdown Authoring composition says the formatting group sits at the left, history sits at the row end, and one hairline separates history from the view controls.
5. **Fullscreen additions.** The canvas mapping says fullscreen adds the toolbar, search, and minimap. Drag, nesting, and the context menu's Auto Arrange work in the embedded view.
6. **Fullscreen button owner.** The canvas controls row says the controls component renders zoom in, zoom out, and fit, and the canvas supplies the fullscreen button.
7. **Editor density.** The markdown density line replaces the 1rem rhythm claim with the real measure: the label text role with its line height, and the editor surface's horizontal and vertical padding.

Keep the Writing Guide's functional voice. No version pin. No reference to agent-only files.

## Acceptance criteria

- [ ] Each of the seven sentences or cells matches the cited code on a fresh read.
- [ ] The palette rule appears once with no contradicting sentence.
- [ ] Every relative link in the edited rows resolves to an existing file.
- [ ] No other guide sentence changes.
- [ ] The four gates pass. No changelog entry.

## Blocked by

- None — can start immediately.
