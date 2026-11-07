# 03: Place Hidden Gems on the Worlds tab

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Rulings; Implementation Decisions › App; Testing Decisions)

Model rationale: a change inside the browse pipeline that sorts, filters, pins and pages the whole catalog. Placement must keep page counts, pins, hide preferences and the Contest tab intact.

## What to build

On the Worlds tab, in the plain browse view, the worlds the catalog flags `hidden_gem` sit in slots 3, 6 and 9 of page 1 with a badge, under any sort. A reader can turn this off with a toggle next to the sort control. The toggle is on by default and is remembered. A search or any filter gives the plain sorted list. A server that sends no flag gives no gems.

## Acceptance criteria

- [x] The world record carries the optional `hidden_gem` flag from the catalog row. `isHiddenGem` in `src/lib/hiddenGems.ts`; a missing flag reads as no.
- [x] `useCommunityBrowserFilters` places gems after the sort and before paging, only on the Worlds tab, with no `order` override, the toggle on, an empty search box and no author, tag, model or status filter. Hook tests: search, each filter, Contest, other kinds; each condition mutation-tested.
- [x] Gems sit at positions 3, 6 and 9 of page 1, counted after the staff-pinned rows, in the order the sort gave them. No world appears twice, and `totalPages` is unchanged. Hook tests under seven sorts, the pinned case and the all-pages walk; DOM read on the live catalog: indexes 2, 5, 8.
- [x] A gem slot past the page size leaves that gem in its sorted position. Hook test at six rows a page.
- [x] Hide preferences remove a gem before placement. Hook tests for a hidden world, author and tag.
- [x] The hook returns `hiddenGemIds` for the current page, empty when placement doesn't apply. The card shows the badge from a `hiddenGem` prop. Hook tests incl. page 2; `RemoteWorldCard.hiddenGem.test.tsx`.
- [x] `showHiddenGems` is a per-tab setting saved with the tab filters. A saved setting without it reads as on. Flipping it resets to page 1. `clearFilters` leaves it alone. The control shows only on the Worlds tab. Hook tests; DOM read: no toggle on Entities, on/off gives 3/0 badges, saved in localStorage.
- [x] The Contest tab and the other kind tabs ignore the flag. Hook tests.
- [x] Hook tests cover each case in the spec's Testing Decisions, and a card test covers the badge. `useCommunityBrowserFilters.hiddenGems.test.ts` (24) and the card test (2).
- [x] The toggle label, badge and tooltip follow the Writing Guide. Title Case labels, verb-first tooltips, checked in the Standards review.
- [x] One 👤 Added changelog entry under Minor. Fragment `docs-internal/changelog.d/hidden-gems-03.md`.
- [x] Frames: `.scratch/frames/hidden-gems-page1-light.png` and `.scratch/frames/hidden-gems-page1-dark.png` at desktop width, with three gems placed and the toggle visible. Taken at 1024 px on the `fixture=hiddenGems` dev route.

For you: open Community Creations › Worlds and check that the gem badges read clearly and that slots 3, 6 and 9 don't feel crowded.

## Landed

**Not verified**
- Real server flags: the server half has not shipped, so the frames use the DEV `fixture=hiddenGems` route, which flags the three least-downloaded worlds of the live catalog.

**For you**
- Open Community Creations › Worlds and check that the gem badges read clearly and that slots 3, 6 and 9 don't feel crowded. Frames: `.scratch/hidden-gems-03/frames/hidden-gems-page1-light.png`, `.scratch/hidden-gems-03/frames/hidden-gems-page1-dark.png`. Dev route: `#dev?modal=community&tab=world&fixture=hiddenGems`.
- Check the badge tooltip "Gets many likes for how few players have downloaded it" and the toggle tooltip "Places a few well-liked worlds with few downloads on page 1".
