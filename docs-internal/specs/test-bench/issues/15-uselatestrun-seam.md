# 15 — Extract the run-guard shape into a useLatestRun seam

Status: ready-for-agent

## Problem Statement

The Bench now carries two on-demand async actions — the stat-code check and the image WebP
conversion — and each hand-rolls the same staleness machinery: a run-counter ref, an effect that
bumps it whenever the Bench's world payload changes identity, a ticket captured at the top of the
run, and a `run !== ref.current` check after every await. The two copies are line-for-line twins
today, which means they can drift apart tomorrow: a third async action (or a fix to one copy that
misses the other) would re-open the exact stale-result bug the guard exists to stop, in whichever
copy didn't get the fix.

## Solution

One small hook owns the staleness question: `useLatestRun(dep)` returns a `begin()` function; a
run calls `begin()` to get a `stillCurrent()` predicate and consults it after each await. A change
to `dep` — or a newer `begin()` — invalidates every outstanding ticket. Both existing actions
consume it; each keeps its own status/state handling, which is where they genuinely differ. Author-
visible behavior does not change at all: this is a seam extraction proven by the existing tests
staying green unmodified.

## User Stories

1. As a developer, I want the run-guard shape to exist exactly once, so that a fix or hardening to it reaches every async Bench action at the same time.
2. As a developer adding a third on-demand Bench action, I want a named seam to consume, so that I cannot forget the stale-run drop by writing the action from scratch.
3. As a developer reading `useTestBench`, I want the orchestration hook to read as wiring, so that the staleness bookkeeping doesn't obscure what each action actually does.
4. As a developer, I want the hook to own only the staleness question, so that the two actions' genuinely different state handling (check status vs. fixing spinner) stays at their call sites rather than being forced through a leaky abstraction.
5. As an author, I want the stat-code check to behave exactly as it does today — a verdict about code I've since edited never lands, and the button returns to me when the check itself breaks — so that the refactor is invisible to me.
6. As an author, I want the image conversion to behave exactly as it does today — a stale conversion drops, one run at a time, kept images reported — so that the refactor is invisible to me.
7. As a developer, I want the extraction proven by the existing editor-seam tests passing unmodified, so that "the seam moved" and "the behavior moved" can't be confused.
8. As a developer, I want a newer `begin()` to invalidate an older ticket, so that a re-triggered action can never be raced by its own predecessor landing late.

## Implementation Decisions

- **The hook: ticket-predicate API.** `useLatestRun(dep)` returns a stable `begin()` callback.
  Calling `begin()` issues a ticket and returns a `stillCurrent(): boolean` predicate for it. A
  ticket goes stale when `dep` changes identity (the hook carries the invalidation effect the two
  call sites currently duplicate) or when a newer `begin()` is issued. This matches the semantics
  both copies have today, where the effect bump and the run bump share one counter.
- **The hook owns nothing else.** No status enum, no spinner state, no result clearing. The
  stat-code site keeps its own effect that clears held findings and resets status when the world
  moves; the image site keeps `fixingRuleId` and its refuse-second-run gate. Those are the parts
  that differ, and forcing them into the hook is how the abstraction would go wrong.
- **Both call sites convert.** The stat-code check and the image WebP fix each replace their
  ref + effect + counter with one `useLatestRun(benchWorld)` and `stillCurrent()` checks at the
  points where they check the counter today — including the catch paths (the stat-code status
  reset stays guarded exactly as it is).
- **Placement beside its consumers.** The hook lives in the Bench's lib layer with the other
  `use*` bench hooks. It has no Bench-specific knowledge, so promoting it later is a move, not a
  rewrite — but today's only consumers are here, and a general hooks home is not this ticket's
  call to invent.
- **Unchanged:** every author-visible behavior of both actions, the write-back path, the props
  contracts, the rule registry.
- No export-shape impact; no new persistent state.

## Testing Decisions

- **No new tests; no modified tests.** The stale-drop behavior is already guarded at the highest
  seam — the real editor — by the two bench harness suites, whose stale-run cases were mutation-
  proven when they were written (removing the guard turns exactly the intended test red). The
  extraction's proof is those suites passing byte-for-byte unmodified.
- Good tests assert author-visible behavior at existing seams; a pure refactor that needs new
  tests to pass has changed behavior and has failed.
- The mutation check repeats after the extraction: remove the `stillCurrent()` consultation from
  one call site and watch that suite's stale-run case fail — proving the guard survived the move
  rather than being quietly bypassed by it.

## Out of Scope

- A general-purpose hooks module or moving other `use*` helpers.
- Any change to either action's status handling, toasts, button states, or wording.
- Adopting the hook anywhere outside the Bench (other stale-guard shapes exist in the app; each is
  its own evaluation).
- Abort/cancellation semantics — the current copies drop results, they don't cancel work, and the
  hook must not grow an AbortController speculatively.

## Further Notes

- Origin: named as a Duplicated Code finding in the ticket-14 code review (the run-guard clones)
  and deliberately left unfixed there — finish the ask, name the adjacent problem.
- The API shape and the no-new-tests decision were both confirmed by the user during spec-writing.
