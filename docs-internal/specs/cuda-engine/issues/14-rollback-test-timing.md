# 14: Rollback Test Timing

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one replace test that sees a stray request; the fix is to find what sends it, not to wait longer.

## What to build

The CUDA replace test "a rollback to the previous tag finds its folder valid, downloads nothing, and keeps the newer one" failed 1 of 20 runs during ticket 13's check on 2026-11-07, because `srv.state.requests` was not empty. A request reached the fake server in a test that asserts nothing downloads. Either an earlier test's download leaks into this one, or the module sends a request it shouldn't.

Find which one it is. If the module is at fault, that's a product bug: fix the module, and the test stays as it is. If it's a leak between tests, isolate the fake server or await the earlier work so the test owns every request it counts. Never weaken the assertion.

No player-visible change unless the module was at fault, and then a 👤 Fixed fragment only if the bug shipped. It hasn't shipped, so no fragment.

## Acceptance criteria

- [x] The cause is named in the landing body: module request or test leak. (Test fixture: `zipSync` stamps the clock, so one tag's digests changed between builds; the module was right to re-download.)
- [x] The assertion that nothing downloads is unchanged. (`expect(srv.state.requests).toEqual([])` untouched.)
- [x] 30 runs of the CUDA install test file in a row pass. (Before: 5 of 60 and 1 of 60 failed. After: 40 of 40 and 30 of 30 passed.)
- [x] A guard: the test fails when the rollback path downloads the current tag again. (Dropped the `installedTag()` check in `begin()` and `startup()`: the rollback test went red. The new "one tag builds the same digests at any clock time" test goes red with `mtime` removed.)

## Landed

**Not verified**
- The whole-repo `FULL_GATES=1 npm run test` run belongs to `close-spec`, so it did not run here.

**For you**
- Nothing for a player to judge. No player-visible change.
