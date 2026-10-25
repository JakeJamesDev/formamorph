# 05: Image Panel

Status: done
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Changes a shared widget (controlled frame, hideable cog) without disturbing its Profile-tab host, then builds the panel the prototype settled. The widget is used in several editors, so Opus.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

Clicking a stack, or a card for an entity's or location's image, opens one **image panel** for that parent (spec P4). There is no separate item panel and no file list for gallery images.

- **Header:** the parent's name, image count and images' total, and **Go to <name>**. For an entity, the Avatar it picks shows as a link to that Avatar's card.
- **Gallery:** the existing gallery widget, with its strip, reorder, Make Primary, Generate with AI and Image Tags, under its existing mode rules (Image Tags in Advanced only, Generate in both).
- **Framed details,** below the gallery with spacing only, no outline or divider (P6): the framed image's slot name, size, budget and over-budget badge, the action row from ticket 04 (Replace, Download, Remove), and for an entity, the Visibility rule editor for that image.
- Clicking a strip tile frames that image and switches the details. The add tile frames the empty slot for upload. A stack opens framed on its primary; an image card opens framed on that image.

The gallery widget gains two optional inputs (P7): a controlled frame (the framed index and a change callback) and a switch that hides the strip's rule cog. The Media tab uses both and hides the cog. The Profile tab passes neither and behaves as before. Prior art for this prop shape: the prototype branch `prototype/media-tab`, commit `71a3c4e5d`.

A rule edited here shows on the Profile tab at once, and the other way round.

Update the wiki page from ticket 01 with the panel. Changelog fragment: fold into ticket 01's line if unreleased.

## Acceptance criteria

- [x] A stack opens the image panel framed on the primary; an image card opens framed on that image (mediaImagePanel: framing tests)
- [x] A strip click frames that image and the details below switch to it (mediaImagePanel: strip tile test)
- [x] The add tile frames the empty slot and an upload lands there (mediaImagePanel: add tile test, incl. the selection that drives undo reveal)
- [x] Replace, Download and Remove act on the framed image, each one history step (mediaImagePanel actions; mediaActions for the location background)
- [x] Reorder and Make Primary write the gallery order and undo in one step (keyboard drag of Image 3 to the front; Make Primary is drag-to-front, Q42)
- [x] A rule set in the panel shows on the entity's Profile tab, and a rule set there shows in the panel (mediaImagePanel: both directions)
- [x] The strip's rule cog is hidden in the Media tab and present on the Profile tab (mediaImagePanel + ImageTagsField.rules)
- [x] Image Tags show in Advanced only; Generate with AI shows in both modes (mediaImagePanel: per-mode test)
- [x] A location's background opens the same panel without a rule editor (mediaImagePanel: location test)
- [x] The entity's picked Avatar shows as a link in the header and opens that Avatar's card (mediaImagePanel: world, library and default picks)
- [x] Frames: `.scratch/frames/media-image-panel-dark.png` and `.scratch/frames/media-image-panel-light.png` at 1600×900 with a four-image entity framed on its third image (Playwright on the ticket's dev server)

For you: set a long Visibility rule in the panel and judge whether it reads better than on the Profile tab.

## Landed

**Not verified**
- None.

**For you**
- For you: set a long Visibility rule in the panel and judge whether it reads better than on the Profile tab.
- Frames: `.scratch/media-tab-05/frames/media-image-panel-dark.png` and `.scratch/media-tab-05/frames/media-image-panel-light.png`. Judge whether the framed details below the fold need the panel to scroll them into view on a strip click.
