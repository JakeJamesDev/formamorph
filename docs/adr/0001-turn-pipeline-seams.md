# ADR-0001 — The Turn Pipeline has two seams, not one

**Status:** Accepted · **Date:** 2026-08-13

## Context

The Turn Pipeline spec settled on a single injection point:

> The single seam is the request adapter given to the runner. Production passes the real AI-call function; tests pass a fake; the parity harness passes a recording wrapper. **No other injection points.**

Converting `GameViewer` to the pipeline showed that one seam cannot carry a turn.

A turn's later passes depend on world knowledge that only exists *after* an earlier pass answers:

| What a pass needs | Where it comes from | When it is known |
|---|---|---|
| Who gets a motivation pass | the director's cast, matched to entities present at the location, capped | mid-run, after the director answers |
| Who gets a diary | participants the narration confirmed, filtered to known entities | mid-run, after the narration answers |
| The location the turn runs in | the router's reply matched against navigable destinations | mid-run, after the first pass answers |

None of that can be precomputed into the plan, and none of it is a request — so the request adapter cannot carry it.

## Decision

The pipeline has **two** seams:

1. **The request adapter** — the only way a request reaches the network. Unchanged.
2. **The derivation callback** (`TurnAdvance`) — the only way the caller's own knowledge reaches the run. It is handed the material so far and answers with a patch to it.

`TurnAdvance` is also `await`ed, which makes a stage boundary a place the caller can *hold* the turn. The read-aloud pass uses this: narration audio has to finish generating before the post-narration batch competes with it for the graphics card.

## Consequences

- Turn logic stays testable without a model server: the runner's tests pass a fake adapter and a fake advance, and the parity harness passes a recording adapter with a replay advance.
- The view's `advance` implementation runs React state effects mid-run (`changeLocation`, `setVisibleEntities`, `setDiscoveredEntities`). That is a real cost — the run is no longer free of view effects — and it is why "the view's apply step is thin setters over the Turn Commit" describes the *commit*, not the whole turn.
- A caller can starve or stall a turn from inside `advance`. It is trusted code, one implementation, not a plugin point.

## Alternatives rejected

**Make `advance` pure — return a patch plus a list of effect descriptors the view interprets.** Needs a vocabulary (`changeLocation`, `setVisibleEntities`, `holdForAudio`, …) invented for a single caller, and every new derivation grows it. Speculative Generality for no second consumer.

**Precompute everything into the plan.** Impossible: the character pass's subjects are a function of the director's answer, which does not exist when the plan is made.

**Let the runner reach into the world itself** (pass it the entities, the history, the context builder). That is strictly worse — it puts world knowledge inside the React-free module and gives it many seams instead of two.
