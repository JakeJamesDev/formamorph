# 13: Cancel Test Timing

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: one test that races its own Cancel; the fix is a deterministic hold point, not a longer wait.

## What to build

The CUDA install test "Cancel keeps the partials, and the next install fetches only the missing ranges" fails under full-suite load. In the close gates on 2026-11-07, it expected 7,280 partial bytes and got 5,232, one chunk short, because the Cancel landed before the second chunk was written. It passed 3 of 3 runs on its own.

Make the test cancel at a point it controls, for example after the injected fetch has delivered exactly the chunks the assertion counts, so the result never depends on timing. Never weaken the assertion or widen it to a range: the test must still prove that the next install fetches only the missing ranges.

No player-visible change, so no changelog fragment.

## Acceptance criteria

- [x] The test cancels at a hold point it controls, with no timers or sleeps deciding the byte count. It waits for `receivedBytes(part) === CHUNK * 2` through the existing bounded `until` condition poll.
- [x] The assertion still checks the exact partial size and that the next install fetches only the missing ranges. Both assertions are untouched.
- [ ] The test passes in a full `FULL_GATES=1 npm run test` run, and 20 runs of the file in a row pass. Cancel test: 20 of 20 runs passed.
- [x] A guard: the test fails when the install module's Cancel drops the partials. Checked by making Cancel delete the staging folder; the next install then read `not-installed`. Reverted.

## Landed

**Not verified**
- Third criterion, in part: the whole-repo `FULL_GATES=1 npm run test` run belongs to `close-spec`, so it did not run here. In the 20 file runs (65.7 s total), run 12 failed in another test, "a rollback to the previous tag finds its folder valid, downloads nothing, and keeps the newer one" (`srv.state.requests` was not empty). The Cancel test passed in every run.

**For you**
- Nothing to judge as a player. Decide whether the rollback test flake needs its own ticket.
