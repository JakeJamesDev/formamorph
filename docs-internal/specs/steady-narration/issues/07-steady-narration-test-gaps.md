# 07: Steady Narration Test Gaps

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Opened at the spec close: the landed tests fall short of the spec's Testing Decisions in three places.

- **Chat layout (user story 4).** Only the Pages layout has a harness case. Earlier turns in the chat layout must stay the same nodes while a new turn streams.
- **Mid-stream drive.** The harness changes the choices and writes the history after the turn commits. The spec asks for both during a live turn.
- **A guard that bites on the DOM.** Reinstating the old dependency fails only on a global build count, because the backstop keeps the node. A guard must fail on the narration's root node, with the backstop taken out of the path it tests.

## Acceptance criteria

- [x] A chat-layout harness case keeps an earlier turn's narration node across a live turn's choices and history writes. (`mid-reveal (chat layout)`: asserts the earlier turn's node and the live turn's node chain)
- [x] The Pages case drives choices and a history write while the turn is still revealing. (`mid-reveal (pages layout)`: a held stream keeps `isRevealingNarration` true)
- [x] Reinstating the Player View reach dependency with the backstop bypassed makes a DOM-node assertion fail. (committed-turn case with the backstop out; proved with a stand-in, see Landed)
- [x] The build-count assertion is scoped so an unrelated eager caller does not trip it, or it is removed in favor of the DOM guard. (removed, per the spec session)

## Landed

**Not verified**
- The live-reveal cases do not bite on the DOM. Since ticket 05 the renderer keys on the speaker JSON, and in the live reveal even a fresh color Map with equal content kept the paragraph and three ancestors. A provider-colors identity guard (`keeps one speaker-color identity with the backstop out of the path`) covers that window and fails with the stand-in dependency (saw 2 identities).
- The mutation was a stand-in: `fullMessageHistory` added to the card-rows memo deps, not the old save-state getter, because the getter is stable now. With it, the committed-turn case with the backstop out failed on the node, and the identity guard failed.
- The chat live-reveal case has the backstop on, so it has no mutation proof of its own.

**For you**
- None.
