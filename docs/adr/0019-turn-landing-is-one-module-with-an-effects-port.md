# ADR-0019 — The Turn Landing is one module with an effects port

**Status:** Accepted · **Date:** 2026-11-18

## Context

[ADR-0001](0001-turn-pipeline-seams.md) describes the view's apply step as thin setters over the Turn Commit. That step grew. It now orders about twenty steps: the Inventory pass before stat changes, time before the wait for stat code, follower placement before the stored turn, settle before item events, the snapshot last.

The order is the logic, and the view held it twice. The live turn had one copy. The stat re-roll had a second, hand-kept copy, and the two drifted. Only tests that mount the whole game view could reach either one.

## Decision

The **Turn Landing** is one module outside React. It owns every step from the During AI Output writes to the armed snapshot.

- **Two modes.** The live turn and the stat re-roll run the same order. The module names each step the stat re-roll skips.
- **One effects port.** The view passes one object of trusted callbacks. The module decides when each runs; the view decides what each does to React state.
- **Edges stay in the view.** The move offer, the reveal hold, the turn count and the scene image are presentation timing. The choices re-roll is a separate short flow.

## Consequences

- The landing order is testable without a model server and without a mount: a test passes a recording port and reads the calls.
- One test can land the same commit in both modes and compare, so drift fails a test.
- The port is wide. It is trusted code with one production implementation, like the derivation callback, and not a plugin point.
- The view still owns the effects. A fault inside one effect is still found only by a mounted test.

## Alternatives rejected

**Pure landing: compute the landed state, then apply it.** The best test surface. It needs stat code, settle and the item scripts to stop writing through setters first, which is a larger effort of its own. It stays open as a later step.

**A hook in its own file.** Least rewiring, but its tests still need the view's providers, so the order stays hard to reach.

**Share only the steps both modes run.** The live-only order (followers, stored turn, memory) would stay in the view, and a skipped step would stay an omission in place of a named decision.
