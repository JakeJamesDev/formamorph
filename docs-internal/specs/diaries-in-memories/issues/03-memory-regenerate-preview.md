# 03: Memory Regenerate Preview

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

## What to build

Regenerate on a story memory shows the new text before it replaces anything, with **Keep** and **Discard** (spec Q21). Keep stores it as a kept rewrite (`source: 'ai'`) in the layer from ticket 01; Discard stores nothing. Cancel works while the request waits or runs. The button stays disabled while a turn is generating.

- **Shape.** This ticket owns the preview row: the new text, the text it would replace, and Keep / Discard. Ticket 05 reuses it for diary entries, so build it to take any entry, not a memory row only.
- The regenerate request resolves to the new text instead of writing it.
- Update the Memories help topic and the Memory wiki page where they describe Regenerate.

## Acceptance criteria

- [x] Regenerate on a memory shows the preview; nothing in the layer changes until Keep. (test "shows the new text and the text it replaces, and writes nothing until Keep")
- [x] Keep marks the memory Rewritten, and Revert to the Original returns the AI's first text. (test "Keep stores a kept rewrite, and reverting returns the AI first text")
- [x] Discard leaves the memory as it was. (test "Discard leaves the memory as it was")
- [x] Cancel stops a waiting or running request and leaves the memory as it was. (test "Cancel aborts the request…")
- [x] An empty or failed result says so and changes nothing. (tests "says so and changes nothing when the result is failed / empty")
- [x] The help topic and the wiki page describe the preview. (`docs/Memory.md`, `src/lib/helpTopics.ts`)
- [x] A changelog fragment: memory Regenerate shows the new text first. (`docs-internal/changelog.d/diaries-in-memories-03.md`)

## Landed

**Not verified**
- Live look at the preview row in the Memories window: not checked in the browser pane; jsdom tests only.

**For you**
- Open Memories on a save with a few turns, press Regenerate on a memory, and read the preview: new text on top, "Replaces:" line under it, Keep and Discard.
