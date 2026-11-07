# 03: Place Hidden Gems on the Worlds tab

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high
Spec: ../spec.md (Rulings; Implementation Decisions › App; Testing Decisions)

Model rationale: a change inside the browse pipeline that sorts, filters, pins and pages the whole catalog. Placement must keep page counts, pins, hide preferences and the Contest tab intact.

## What to build

On the Worlds tab, in the plain browse view, the worlds the catalog flags `hidden_gem` sit in slots 3, 6 and 9 of page 1 with a badge, under any sort. A reader can turn this off with a toggle next to the sort control. The toggle is on by default and is remembered. A search or any filter gives the plain sorted list. A server that sends no flag gives no gems.

## Acceptance criteria

- [ ] The world record carries the optional `hidden_gem` flag from the catalog row.
- [ ] `useCommunityBrowserFilters` places gems after the sort and before paging, only on the Worlds tab, with no `order` override, the toggle on, an empty search box and no author, tag, model or status filter.
- [ ] Gems sit at positions 3, 6 and 9 of page 1, counted after the staff-pinned rows, in the order the sort gave them. No world appears twice, and `totalPages` is unchanged.
- [ ] A gem slot past the page size leaves that gem in its sorted position.
- [ ] Hide preferences remove a gem before placement.
- [ ] The hook returns `hiddenGemIds` for the current page, empty when placement doesn't apply. The card shows the badge from a `hiddenGem` prop.
- [ ] `showHiddenGems` is a per-tab setting saved with the tab filters. A saved setting without it reads as on. Flipping it resets to page 1. `clearFilters` leaves it alone. The control shows only on the Worlds tab.
- [ ] The Contest tab and the other kind tabs ignore the flag.
- [ ] Hook tests cover each case in the spec's Testing Decisions, and a card test covers the badge.
- [ ] The toggle label, badge and tooltip follow the Writing Guide.
- [ ] One 👤 Added changelog entry under Minor.
- [ ] Frames: `.scratch/frames/hidden-gems-page1-light.png` and `.scratch/frames/hidden-gems-page1-dark.png` at desktop width, with three gems placed and the toggle visible.

For you: open Community Creations › Worlds and check that the gem badges read clearly and that slots 3, 6 and 9 don't feel crowded.
