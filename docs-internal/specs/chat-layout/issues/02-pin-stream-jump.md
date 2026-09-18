# 02: Pin on Submit, Streaming, and Jump to Latest

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

In Chat, a submit puts the player's action bubble at the top of the viewport. The narration streams into a
bubble below it, with the same reveal as Pages. The view does not move again by itself. When the newest text
is off screen, a **Jump to Latest** button shows and returns the player to it.

## Acceptance criteria

- [ ] On submit, the new turn's top scrolls to the viewport top. The scroll is smooth, and instant under reduced motion. The pin scrolls the element directly, not through the virtualizer's index scroll.
- [ ] The submitted turn gets a minimum height of one viewport and keeps it until the next submit.
- [ ] The scroll offset stays constant from the pin to the end of a stream that goes past the fold. The reveal continues below the fold.
- [ ] The live reasoning block shows inside the latest narration bubble, above the text.
- [ ] After a player scroll the view stays manual. Scrolls that the code starts do not count as player scrolls.
- [ ] Jump target and Jump button visibility are pure functions per the spec's geometry rules, with unit tests for a short turn, a long turn, the clamp, and the three visibility cases.
- [ ] The button reads "Jump to Latest", and says that new text is below while a reply streams. Copy per the player-facing voice rules.
- [ ] Playwright covers: action top at the viewport top after submit; constant scroll offset through the stream; the button shows, works, and hides; the smooth pin has more than one frame with movement. Motion is never asserted in seconds.
- [ ] Each new guard is proven once by reinstating the bug it guards. Four gates green, and the e2e run time is stated.
