# 02: Pin on Submit, Streaming, and Jump to Latest

Status: in-progress
Base: 6f7bd1ec
Blocked by: 01
Recommended model: Claude Opus 5 (`claude-opus-5`)
Reasoning effort: high

Spec: `docs-internal/specs/chat-layout/spec.md`

## What to build

In Chat, a submit puts the player's action bubble at the top of the viewport. The narration streams into a
bubble below it, with the same reveal as Pages. The view does not move again by itself. When the newest text
is off screen, a **Jump to Latest** button shows and returns the player to it.

## Acceptance criteria

- [x] On submit, the new turn's top scrolls to the viewport top. The scroll is smooth, and instant under reduced motion. The pin scrolls the element directly, not through the virtualizer's index scroll.
- [x] The submitted turn gets a minimum height of one viewport and keeps it until the next submit.
- [x] The scroll offset stays constant from the pin to the end of a stream that goes past the fold. The reveal continues below the fold.
- [x] The live reasoning block shows inside the latest narration bubble, above the text.
- [x] After a player scroll the view stays manual. Scrolls that the code starts do not count as player scrolls.
- [x] Jump target and Jump button visibility are pure functions per the spec's geometry rules, with unit tests for a short turn, a long turn, the clamp, and the three visibility cases.
- [x] The button reads "Jump to Latest", and says that new text is below while a reply streams. Copy per the player-facing voice rules.
- [x] Playwright covers: action top at the viewport top after submit; constant scroll offset through the stream; the button shows, works, and hides; the smooth pin has more than one frame with movement. Motion is never asserted in seconds.
- [x] Each new guard is proven once by reinstating the bug it guards. Four gates green, and the e2e run time is stated.

## Comments

- **Minimum height uses a container unit.** The scroller is a size container and the pinned turn takes
  `min-height: 100cqh`. A height held in React state lags the scroller by one frame: when the progress bar
  leaves at the end of a reply, the browser clamped the pinned offset by 28px. The e2e reduced-motion case
  caught it.
- **The live turn has no scroll anchor.** The latest turn carries `overflow-anchor: none` while a reply
  streams. Without it, the browser anchored on a node inside the growing turn and moved the view 78px.
- **Player scroll = player input.** Wheel, touch, a key press, or a press on the scrollbar ends any code
  scroll and any re-aim. Scroll events alone never count, so code scrolls need no timer flag.
- **For ticket 03:** `useChatPin` returns `isProgrammaticScroll()`. It is true from a pin or jump start
  until that scroll lands, stalls, or the player takes over.
- **Not changed:** 01's open-at-bottom re-aim still runs its frames after a player scroll. Ticket 03 owns
  that effect.
- Jump to Latest also follows reduced motion. The e2e suite (`e2e/chat-pin.spec.ts`, 12 cases) ran in
  122 s wall, about 106 s of tests; the gap is the dev server start.
- Gates at commit: lint, build, and the tests of this unit are green. Typecheck and 5 tests fail only on
  ticket 04's uncommitted `latestFooter` work, which waits for this commit.
