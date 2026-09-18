# 04: Choices as Player Bubbles

Status: ready-for-human
Base: 6f7bd1ec
Blocked by: 01
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

In Chat, the choices show only under the latest narration. They look like unsent player bubbles: right
aligned, the action bubble shape, a dashed border, and a light fill. Hover and focus fill a choice to the
solid action style. A staged choice shows filled; once sent, it becomes the next action bubble. A **Re-generate Choices** icon button
sits under the choices.

## Acceptance criteria

- [x] Choices render for the latest turn only. Past turns show no choices.
- [x] The Continue the Story choice uses the same bubble style.
- [x] A choice click stages its text in the input as in Pages, the append gesture works, and the staged choice shows filled. Choices are disabled while a reply streams.
- [x] Re-generate Choices is an icon button (list-restart icon) with a tooltip and an accessible label. It shows a busy state and calls the existing handler.
- [x] Both themes checked. The focus ring follows the shared inset ring rule.
- [x] GamePanels harness tests cover: latest only, click stages, the re-generate handler is called.
- [x] Verified in the preview with static frames. Four gates green.

## Comments

- **Superseded (spec session ruling, 2026-09-18):** "A choice click submits that text" is replaced. Chat keeps
  the Pages contract: a click stages the text, Ctrl/Cmd+click or a long press appends, and the player sends.
  Chat reuses the Pages handlers.
- **Pre-existing, not changed:** the staged-choice fill uses `playerInput.includes(choice)`, a substring
  match, as Pages does. A short choice shows filled when a longer staged text contains it.
- **For ticket 05:** `e2e/chat-pin.spec.ts` "Re-generate pins the new reply" clicks the row's Re-generate
  button, which 05 removes in Chat. The other 12 cases pass with the choices under the latest turn.
