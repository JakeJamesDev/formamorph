# 02: Steady Card Rows and Speaker Colors

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

The fix the player sees (Q4, Q7). With Character Mentions on, the narration reveals once and stays put while choices stream and passes write to the story.

- The mention card rows and the pick list use ticket 01's builder. Their memo depends on its inputs, presence, the resolver and the met list. It no longer depends on the Player View reach or the save-state getter.
- The count of closed turns that sets the chain length is memoized as a number, so history writes inside a turn do not change it.
- This ticket owns the backstop helper: a map keeps its previous identity when the new map has the same keys and equal values. Speaker colors compare values directly. Card rows compare rows shallowly, with image data compared by reference. A real color change still gives a new map.

## Acceptance criteria

- [x] In the game viewer render harness, with Character Mentions on and a colored quote on screen, streaming choices leaves the narration's root DOM node the same node. (`GameViewer.steadyNarration.test.tsx`, Pages layout, committed turn)
- [x] In the same test, a history write that changes no entity state leaves the node the same. (a summary write on the turn)
- [x] In the same test, a new speaker becoming visible replaces the node once. (MutationObserver counts one removal)
- [x] Reinstating the dependency on the Player View reach makes the first criterion's test fail. (fails on the build count, 11 vs 8; with the backstop in place the DOM node holds, so the count is the check; with the backstop off too, the node check fails)
- [x] The backstop helper returns the previous map for equal content, and a new map for an added, removed or changed entry. (`keepEqualMap.test.ts`)
- [x] The existing quote speaker identity tests still pass unchanged. (`quoteSpeakers.test.ts`)
- [x] The mention cards show the same rows, and the pick list offers the same people, as before. Existing mention card tests pass. (`MentionCards.test.tsx`, `MentionCards.portrait.test.tsx`; builder inputs traced against the old reach in review)

## Landed

**Not verified**
- A new speaker's quote does not take its color after the remount. Fixed by ticket 05.
- The build count in the test is global: a future eager `buildPlayerView` caller (ticket 04's area) also turns it red.
- Chat layout has no harness case; only Pages is tested.
- No changelog fragment: Character Mentions is unreleased, so the fix folds into it.

**For you**
- Play a turn with dialogue and Character Mentions on: the narration reveals once without flicker, in both Pages and chat layouts.
