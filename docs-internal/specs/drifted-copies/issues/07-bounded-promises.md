# 07: Bounded Promises

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Sonnet at medium: one timer helper with fake-timer tests.

## What to build

One bounded-promise helper that clears its timer when either side settles. Every embedding call has a bound, including Help and the Test Bench. The ComfyUI settle wait uses the same helper.

Spec: Implementation Decisions: Bounded promises. Stories 14, 15, 33.

## Acceptance criteria

- [ ] Fake-timer tests show no pending timer after the promise wins and after the timeout wins
- [ ] A regression test shows a hung embedding in Help resolves after the bound
- [ ] The two game call sites, Help, the Test Bench and ComfyUI use the helper
- [ ] Four gates green

## Blocked by

- None (can start immediately)
