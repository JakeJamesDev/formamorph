# 02: Paint the window before the cards

Status: ready-for-human
Base: 9ddcc93f
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

One component's render order, but the empty-state flash is an easy regression to miss.

## What to build

Spec Q8. Clicking Community Creations shows its window at once. The card grid renders after the shell paints, as a transition, for cached and fresh rows alike. The reader never sees an empty grid or the "no results" state while cards are pending.

## Acceptance criteria

- [x] The window shell commits before the card grid on every open.
- [x] No "no results" or empty-grid frame shows while rows exist but have not rendered.
- [x] Scroll, search input, and close respond while the grid renders.
- [x] A render test proves the shell commits first and fails when the grid renders in the same commit.
- [x] Harness numbers before and after, at 1× and 4×, are recorded under `## Comments`.

## Comments

**What changed.** [CommunityCreationsBrowser.tsx](src/views/CommunityCreationsBrowser.tsx) reads the page's rows through `useDeferredValue`, and a closed browser reads as no rows. An open commits the shell with skeleton cards, then renders the cards in a transition. The empty state shows only when the deferred rows have caught up and are empty. Once cards are up, updates skip the deferral: a like press must redraw at once (the guestLikes tests caught the first version, which deferred every update). `pagedRemoteWorlds` in [useCommunityBrowserFilters.ts](src/lib/useCommunityBrowserFilters.ts) is now memoized, because a new array per render never settles a deferred value.

**Test.** [CommunityCreationsBrowser.shellFirst.test.tsx](src/views/CommunityCreationsBrowser.shellFirst.test.tsx) counts commits with a `Profiler`. It covers a reopen with cached rows, fresh rows that arrive late, no empty-state commit, a real empty catalog, and an immediate redraw after the grid is up. Proved to bite: the first two fail on the old code, the empty-state test fails when the pending guard goes, and the redraw test fails when every update defers.

**Harness.** A page reload opens with no rows in memory, so the rows already commit after the window there. The change matters on a reopen (close, then open in the same page), so the harness gained a `reopen` open. Same machine, one sample per open, same 700 rows. Reload opens (cold, warm 1, warm 2) stay within run-to-run noise.

| Throttle | Open | visibleMs before | visibleMs after | Blocks before → after | Blocked ms before → after |
|---|---|---|---|---|---|
| 1× | reopen | 54 | 34 | 1 → 0 | 51 → 0 |
| 4× | reopen | 411 | 132 | 6 → 4 | 626 → 317 |
| 4× | warm 2 | 161 | 187 | 7 → 4 | 624 → 457 |

Cold and warm 1 also ran at both rates and stayed in the noise (4× cold 220 → 240, warm 1 166 → 290; a single sample each, and the other runs of the same code read 223 and 170). They are not a win or a loss to claim.

**Scope, from the review.** The deferral covers the first cards of an open. Once cards are up, a filter, page, or tab change renders at once, as before, so a like press redraws at once. A browser that mounts open with rows in hand gets no shell-first commit: React 18.3 returns a deferred value as is on the first render. The real catalog hook starts empty, so its rows always arrive after the mount and defer; only a mocked hook could mount with rows. Story 27 (cached open as fast as an empty one) is not measured. The tests use a card mock, so they prove commit order, not card cost.

A timeline probe at 4× (throwaway, not kept) showed frames every 13–50 ms between the window and the first card, so the page stays live while the cards draw. Cards land later than before (about 590 ms against 280 ms on a warm open) because the render now yields to the frames.
