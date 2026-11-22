# 03: Hide Part Images

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

An image that only Layers use leaves both Media tab groupings, and search still reaches it through its Layered Image (spec Q3, Q5, Q9). This ticket owns the Media index's "part only" rule.

- **Part only.** An entry whose every use is a Variant use. Both groupings leave it out. An entry that any field also links directly stays.
- **Variants section.** The **Layered Image Variants** section and its id go.
- **Search.** A term matching a part-only entry's name lists each Layered Image that holds it, never the part's own card.
- **Unused.** The Unused section keeps its rule: an entry with no uses at all.
- **Docs.** The World Editor Media page drops the Layered Image Variants section and says parts show inside their Layered Image's editor and in search.

## Acceptance criteria

- [x] Group by Entity lists no part-only image and has no Layered Image Variants section. (test "leaves an image only Layers use out of both groupings")
- [x] Group by Type's Images section lists no part-only image. (same test)
- [x] A part that a gallery or field also links directly still shows in both groupings. (test "shows a Layer image again once a field links it directly")
- [x] Searching a part's name shows the Layered Image that holds it, and every one when two hold it. (searchSections tests, two holders)
- [x] An entry with no uses still shows under Unused. (same hide test keeps the Unused rig; existing Unused tests pass)
- [x] Each new guard fails with its bug put back. (hide rule, direct-link rule and part-name match each failed when reinstated; the filter-first test is not mutation-proven, since the filter runs in the hook)

## Landed

**Not verified**
- No live Media tab check: the change is index logic with unit tests, and I did not open the dev-router view.
- Filter-before-search is composed in `useWorldMediaEditor`; its test covers the two functions together, not the hook.

**For you**
- A hidden part entry can still be selected by id (`mediaHolds` and the selectable list keep it, so Used By links and the editor can open it). Say if a stale selection of one should reset instead.
