# 10: Playwright spec

Status: ready-for-human
Status note: Built as `e2e/anonymous-likes.spec.ts`. Four tests (two specs across the desktop and mobile projects) pass in 31.8 s wall clock, 14.9 s of test time; the rest is dev-server start-up. Four gates green: typecheck 0 errors, lint 0 errors, 12 093 tests pass in 131 s, build succeeds. The first suite run had 2 failures in `VariableNode.label.test.tsx`; the re-run was fully green and this unit touches no `src/` file.
Base: 1745a81f
Blocked by: 06, 08
Recommended model: Claude Sonnet 5 (`claude-sonnet-5`)
Reasoning effort: medium
Repo: formamorph
Spec: ../spec.md (Testing Decisions)

Model rationale: one spec in an existing suite with a stubbed server.

## What to build

One end-to-end spec that proves the two guest paths in a real browser.

## Acceptance criteria

- [x] A guest opens the community browser, presses a heart, and sees it filled with the count raised. After a reload the heart is still filled.
- [x] A guest plays a downloaded world to the fifteenth turn and sees the card. After a like, the card is gone and does not return on the next turn.
- [x] The server is stubbed at the network layer. No real endpoint is called.
- [x] Visibility is asserted from painted truth, not from a rect.
- [x] The spec runs in the existing end-to-end suite, outside the four gates. State its run time in the hand-over.

## Notes

**How the fifteenth turn is reached.** The save the `whiteRoom` fixture boots is rebuilt by
`buildLongSave` to `LIKE_PROMPT_TURNS - 1` turns, so one scripted turn is the fifteenth. The fixture
world is served with an id, and its stored record carries `sourceId` and `downloadedAt`, because the
download link is wrapper metadata rather than world content.

**No real endpoint.** A catch-all handler over the live API host goes on first, so the named routes
registered after it win. Anything the catch-all sees is recorded and fails the test.

**Each assertion was proved to fail.** One turn short of the threshold: no card. The heart's fill
class removed: the painted-fill compare fails. The already-liked skip and the prompted mark both
removed: the card returns on the sixteenth turn. The Install id cleared before the reload: the heart
comes back empty.
