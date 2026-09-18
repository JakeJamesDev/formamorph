# 04: Choices as Player Bubbles

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

In Chat, the choices show only under the latest narration. They look like unsent player bubbles: right
aligned, the action bubble shape, a dashed border, and a light fill. Hover and focus fill a choice to the
solid action style. A selected choice becomes the next action bubble. A **Re-generate Choices** icon button
sits under the choices.

## Acceptance criteria

- [ ] Choices render for the latest turn only. Past turns show no choices.
- [ ] The Continue the Story choice uses the same bubble style.
- [ ] A choice click submits that text. Choices are disabled while a reply streams.
- [ ] Re-generate Choices is an icon button (list-restart icon) with a tooltip and an accessible label. It shows a busy state and calls the existing handler.
- [ ] Both themes checked. The focus ring follows the shared inset ring rule.
- [ ] GamePanels harness tests cover: latest only, click submits, the re-generate handler is called.
- [ ] Verified in the preview with static frames. Four gates green.
