# 03: One grid render per catalog answer

Status: ready-for-human
Base: 5847491f
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

State batching and identity reuse across a hook and the card tree; subtle staleness bugs are possible.

## What to build

Spec Q9. Opening Community Creations renders the grid once per catalog answer, not three or four times. Cards are memoized. When the fresh catalog lands, a row that matches its cached copy keeps the cached object, so its card does not render again. Hearts, counts, and the anonymous-likes flag stay correct.

## Acceptance criteria

- [x] The catalog loader sets rows, the anonymous-likes flag, and the syncing flags in one commit per step.
- [x] A fresh row equal to its cached row keeps the cached object; a changed row replaces it.
- [x] A card whose row did not change skips the render when the fresh catalog lands.
- [x] A change of reader still clears the old reader's rows before the forced request.
- [x] Tests at the catalog sync seam and the card render seam (React `Profiler`) prove each rule, and each fails when its rule is removed.
- [x] Harness numbers before and after are recorded under `## Comments`.

## Comments

**What changed.** [useCatalogSync.ts](src/lib/useCatalogSync.ts) sets each step's states with no await between them. The fresh answer, the guest-like flag, and the loading, syncing, and settled flags land in one commit; the cache write runs after. [catalogRows.ts](src/lib/catalogRows.ts) keeps the held object for a fresh row with the same data (any key order), and returns the held list when every row is kept. [RemoteWorldCard.tsx](src/components/community/RemoteWorldCard.tsx) is memoized. [CommunityCreationsBrowser.tsx](src/views/CommunityCreationsBrowser.tsx) hands cards stable props: handlers through [useStableCallback.ts](src/lib/useStableCallback.ts), placements cached per row object, and the tutorial nav only on the card the like tutorial is showing on.

**Tests.** [useCatalogSync.commits.test.tsx](src/lib/useCatalogSync.commits.test.tsx) records every commit with a `Profiler`: the cached step, the answer step, row reuse, and the reader clear. [CommunityCreationsBrowser.cardRenders.test.tsx](src/views/CommunityCreationsBrowser.cardRenders.test.tsx) runs the real hook and counts each card's renders at its shell. Proved to bite: an await inside the cached step, settling after the write, and no reader clear each fail the hook test; no memo, a raw `onView`, raw `placementsBy`, and no row reuse each fail the card test.

**Harness.** Same machine, 700 rows, one sample per open. Base `5847491f` against this change.

| Throttle | Open | visibleMs | Blocks | Blocked ms | Longest ms | Tooltip % |
|---|---|---|---|---|---|---|
| 1× | cold | 38 → 37 | 0 → 0 | 0 → 0 | 0 → 0 | 16.6 → 5.4 |
| 1× | warm 1 | 32 → 37 | 0 → 0 | 0 → 0 | 0 → 0 | 15.8 → 5.1 |
| 1× | warm 2 | 31 → 35 | 0 → 0 | 0 → 0 | 0 → 0 | 19.3 → 5.3 |
| 1× | reopen | 35 → 30 | 0 → 0 | 0 → 0 | 0 → 0 | 23.7 → 6.2 |
| 4× | cold | 230 → 287 | 6 → 3 | 727 → 421 | 267 → 270 | 13.5 → 6.1 |
| 4× | warm 1 | 164 → 206 | 3 → 2 | 271 → 248 | 151 → 186 | 15.3 → 7.9 |
| 4× | warm 2 | 276 → 202 | 4 → 2 | 456 → 250 | 266 → 186 | 11.9 → 7.5 |
| 4× | reopen | 99 → 199 | 5 → 3 | 349 → 311 | 104 → 178 | 13.3 → 8.9 |

Blocks and tooltip share fall on every 4× open; no tooltip code changed, so the share falls because cards render fewer times. `visibleMs` moves both ways and stays within run-to-run noise (ticket 01). It is not a win or a loss to claim.

**Scope.** On an unchanged answer, the browser still commits three times: the loader's one, then the browser's own reactions to the settled flags. No card renders in them. A card still renders on every browser render while the like tutorial is showing on it.

**Review.**
- The card test counts renders at the card's shell, not with a `Profiler`. A `Profiler` reports only a whole subtree's commit, so it can't name which card rendered. The hook test keeps the `Profiler`.
- Q9 holds at the loader and for cards. The browser still commits three times per answer (see Scope above).
- Folded in: `reuseRows` keys rows by `listingId`. A failed cache write now logs as a cache error. The `useStableCallback` doc says the handler is for events only.
