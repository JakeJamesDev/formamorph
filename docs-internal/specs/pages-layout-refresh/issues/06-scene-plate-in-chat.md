# 06: Scene Plate in Chat

Status: ready-for-human
Base: 5098d930
Blocked by: 05
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: high

Model rationale: a small swap, but inside the virtualized list, where a size change before load breaks the pin and the scroll anchor.

## What to build

Chat's inline scene image becomes the Scene Plate, under the narration inside the Turn Card, where the image
is today. Each turn that has images gets zoom, browse, and delete. Delete acts on that turn, from any scroll
position. The inline image component is removed.

This closes the open gap recorded in the Chat Layout spec: scene image controls in Chat.

The plate's box must hold its size before the image loads. A turn that changes height after mount moves the
virtualized list; check the pin and the open-at-bottom aim with the existing Playwright scroll cases.

## Acceptance criteria

- [x] Each Chat turn with images shows the plate under its narration; the inline image component is gone
- [x] Zoom, browse, and delete work on a past turn and on the latest turn
- [x] Delete removes the image from the turn whose plate was used, not from the viewed turn
- [x] The existing "image box sized before load" Chat test still passes
- [x] The existing Chat scroll cases in the e2e suite pass
- [x] Verified in the preview, both themes
- [x] Four gates green
