# 13: Re-Roll Replay Reads This Turn's Presence

Status: ready-for-human
Blocked by: 09
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Gap found by the spec close review.

## What to build

The stats-only re-roll replays the stored Inventory pass operations with no discoveries and no moved positions. The live commit passes both. An operation aimed at an entity that arrived or was discovered this turn can skip on the re-roll.

Spec: Q62, Q142.

## Acceptance criteria

- [x] A re-roll replays a give to an entity discovered this turn and lands it, as the live turn did — `lands a give to an entity the turn discovered` in `GameViewer.inventoryPass.test.tsx`
- [x] A re-roll replays a give to an entity that moved in this turn and lands it — `lands a give to an entity that moved in this turn`
- [x] A test covers each; a replay that reads presence other than the live pass's fails them (Q147) — mutations run: empty owners fails the discovered, moved and Go tests; live location and live presence (the old replay) fails the Go test; live location with stored owners fails the Go test's lantern

## Blocked by

- 09

## Landed

Finding (Q147): the gap did not reproduce as written. The re-roll ran after the turn committed, so live presence was already post-turn. The real divergence was a **Go** on a suggested move after the turn: it moves the player and the come-along entities with no new turn, and the re-roll stays offered. A later code `location.move` also moved `turn.locationId` away from where the pass landed.

Fix: the live turn stores the owners and the location the pass validated against, and the re-roll replays against those.

⚠️ Additive save-shape change: the stored turn gains `inventoryOwners` (`{ id, name }[]`) and `inventoryLocationId` beside `inventoryOps`, only when ops exist. Both fields are unreleased; no compat path.

Paths checked for moves between turns: every `changeLocation` call in `GameViewer.tsx`. Only the **Go** button moves the player between turns (with its followers); the start-location call runs at game start, and the code move runs inside the turn. The stored fields cover any path missed here.

Test limit: the discovered and moved-in tests pass on the old replay too, since live presence then equals stored presence. Only the empty-owners mutation fails them. The Go test is the one that catches a replay reading live presence or the live location.

No changelog fragment: the Inventory pass is unreleased, and this fixes it within the release.

**Not verified**

- None.

**For you**

- None: the fix has no visible surface beyond the item landing where it should after a re-roll.
