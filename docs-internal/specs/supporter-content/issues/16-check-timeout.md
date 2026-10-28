# 16: Client: Supporter content requests time out

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Model rationale: adds a timeout to two requests in a module with injected fetch and clock.

## Parent

[spec.md](../spec.md) — Supporter Content and Mascot Listings. Found by the close review.

## What to build

The Supporter content module's entitlement check and install fetch have no timeout or abort. A stalled request never counts as a failed check: status stays checking, listings show **Checking…** forever, later installs queue behind it, and a lapsed account never falls back to Morphie (Q3, Q6). A stalled request must end as a failed check, or a failed install, after a bounded time.

## Acceptance criteria

- [x] A check that gets no answer within the time limit counts as a failed check and follows the 7-day rule. (tests: "ends a check with no answer…", "removes the cache when a check with no answer comes after the window")
- [x] An install that gets no answer within the time limit fails, and the next install runs. ("fails an install with no answer and runs the next install")
- [x] The request is aborted when it times out, and no timer outlives it. (abort count and `vi.getTimerCount() === 0`; mutation-tested: dropping `controller.abort()` or `clearTimeout` fails them)
- [x] Tests drive both cases with the injected fetch and clock. (injected fetch, `now`, fake `setTimeout`; limits 15 s check, 60 s install and update, Q43)

## Landed

**Not verified**: none. The race that ends a fetch which ignores the signal is covered by a test but was not mutation-tested.

**For you**: nothing to judge in the UI. A stalled check now ends in at most 15 s, so **Checking…** clears.
