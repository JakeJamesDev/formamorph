# ADR-0005 — The Test Bench shows computation, never model judgment

**Status:** Accepted · **Date:** 2026-08-16

## Context

The Test Bench is the World Editor surface where authors test how their world is used at runtime:
what fires on a piece of prose, what context each location serves, where a player can travel, what a
fresh game looks like. Everything it could show falls on one side of a line. On one side, values the
harness computes deterministically from the authored world — activation, presence, destinations,
context blocks, descriptor bands, placeholder odds. On the other, what the model then does with
them — whether narration mentions a character, whether the planner picks a thread, whether an action
counts as travel, which choices get written.

Authors will ask for the second side; "test my world" naturally reads as "show me a turn."

## Decision

The Test Bench displays only what the harness computes and what the model is shown. It never makes
an AI call and never previews, simulates, or estimates model behavior. Where a mechanism ends in a
model judgment (the travel router picking from the destination list), the Bench shows the exact
closed input the model receives and states the boundary rather than guessing past it.

## Consequences

- Every Bench result is deterministic, instant, and exactly what play uses — the instruments run the
  game's own functions, so the Bench can never disagree with a real turn.
- The Bench works offline, with no endpoint configured, at zero cost, and can recompute on every
  keystroke.
- Authors wanting "what will the AI write here" are deliberately unserved; the honest surface for
  that is playing a turn, where output quality is judged by probes, not single pretty completions.
- Semantic activation sits inside the line (deterministic cosine scores from a local index) but is
  gated behind an explicit toggle so its results are never attributed to keyword matching.

## Alternatives rejected

**A turn simulator** (real AI call against the drafted world): nondeterministic, needs a configured
endpoint, costs money or local compute, and one good completion is noise — it teaches false
confidence about prompt quality.

**Heuristic behavior prediction** (guessing what the model would likely do): worse than nothing;
wrong with authority, and drifts from every endpoint's actual behavior.
