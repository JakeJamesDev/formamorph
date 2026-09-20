# 10: Playwright spec

Status: ready-for-human
Status note: Built as `d6eb2d5d`, review findings folded in as `789cc2b8` (a separate commit, because two other sessions committed in between). `e2e/anonymous-likes.spec.ts`, four tests across the desktop and mobile projects, 36.5 s wall clock and 19.4 s of test time; the rest is dev-server start-up. Four gates run: typecheck 0 errors, lint 0 errors, build succeeds. The suite is 12 093 passing with failures only in `LikersDialog.test.tsx`, which is ticket 09's `deadde59`; this unit touches no `src/` file. The review found three real holes, all fixed: the stray-request guard was pinned to the live host and guarded nothing under `E2E_API_URL`, a write was never tied to a listing, and `toBeVisible` passed an `opacity: 0` card.
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

**No real endpoint.** A catch-all handler over the API origin goes on first, so the named routes
registered after it win. Anything the catch-all sees is recorded and fails the test. The origin comes
from `E2E_API_URL` when the runner sets one, because a pattern pinned to the live host would match
nothing under that override.

**Painted truth.** `toBeVisible` passes an `opacity: 0` card, so the card and the heart are each
photographed twice, once with the element hidden, and the two strips must differ. A hit test runs
beside it, because painted and covered are different failures.

**Each assertion was proved to fail.** One turn short of the threshold: no card. The heart's fill
class removed: the fill assertion fails. The card given `opacity: 0`: the photograph compare fails
while `toBeVisible` still passes. The already-liked skip and the prompted mark both removed: the card
returns on the sixteenth turn. The Install id cleared before the reload: the heart comes back empty.

**Known duplication, not fixed here.** `mockNarration`, the turn settings and `playTurn` repeat
[stat-code-turn.spec.ts](../../../../e2e/stat-code-turn.spec.ts)'s local helpers. Both copies are
file-local, which matches the suite's prior art, and lifting them into
[app.ts](../../../../e2e/app.ts) would edit a shared file while neighboring sessions are in it.
