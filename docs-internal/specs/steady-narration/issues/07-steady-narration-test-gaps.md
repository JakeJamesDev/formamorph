# 07: Steady Narration Test Gaps

Status: needs-triage
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

Opened at the spec close: the landed tests fall short of the spec's Testing Decisions in three places.

- **Chat layout (user story 4).** Only the Pages layout has a harness case. Earlier turns in the chat layout must stay the same nodes while a new turn streams.
- **Mid-stream drive.** The harness changes the choices and writes the history after the turn commits. The spec asks for both during a live turn.
- **A guard that bites on the DOM.** Reinstating the old dependency fails only on a global build count, because the backstop keeps the node. A guard must fail on the narration's root node, with the backstop taken out of the path it tests.

## Acceptance criteria

- [ ] A chat-layout harness case keeps an earlier turn's narration node across a live turn's choices and history writes.
- [ ] The Pages case drives choices and a history write while the turn is still revealing.
- [ ] Reinstating the Player View reach dependency with the backstop bypassed makes a DOM-node assertion fail.
- [ ] The build-count assertion is scoped so an unrelated eager caller does not trip it, or it is removed in favor of the DOM guard.
