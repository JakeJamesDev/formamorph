# 10: Playwright spec

Status: ready-for-agent
Blocked by: 06, 08
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Testing Decisions)

Model rationale: one spec in an existing suite with a stubbed server.

## What to build

One end-to-end spec that proves the two guest paths in a real browser.

## Acceptance criteria

- [ ] A guest opens the community browser, presses a heart, and sees it filled with the count raised. After a reload the heart is still filled.
- [ ] A guest plays a downloaded world to the fifteenth turn and sees the card. After a like, the card is gone and does not return on the next turn.
- [ ] The server is stubbed at the network layer. No real endpoint is called.
- [ ] Visibility is asserted from painted truth, not from a rect.
- [ ] The spec runs in the existing end-to-end suite, outside the four gates. State its run time in the hand-over.
