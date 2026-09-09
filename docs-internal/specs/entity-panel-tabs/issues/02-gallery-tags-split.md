# 02: Separate Image Tags From The Gallery Widget

Status: ready-for-human
Status note: Commits 013beaaa + 8eb5ad98. Prefactor only, no host renders the pieces apart yet; ticket 03 is what makes it visible.
Base: e16d4a91
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Prefactor. The tags field and the gallery share state (embedded-prompt adoption, tag generation, the Generate button's tag input), so the split has to keep one source of truth without a portal.

## What to build

The image widget exposes its Image Tags field as a separately placeable piece. A host can render the gallery (frame, thumbnail strip, Generate with AI button) in one place and the tags field in another, and both still act on the same value: adopting an uploaded picture's embedded prompt still fills the tags, and generated tags still land in the field. A host that renders the widget whole sees no change. The prototype proved the layout with a portal; production does not use a portal.

## Acceptance criteria

- [x] A host can place the tags field outside the gallery's own box, and the two stay in sync for embedded-prompt adoption and tag generation.
- [x] The Generate with AI button stays inside the gallery piece and keeps today's visibility in both modes.
- [x] Hosts that render the widget whole (entity, location background, any other) show the same labels and controls in the same order as before.
- [x] The widget's three existing suites pass unchanged.
- [x] One new case proves the separately placed tags field adopts an embedded prompt and receives generated tags.
- [x] Four gates green; graph updated.

## Blocked by

- None — can start immediately.
