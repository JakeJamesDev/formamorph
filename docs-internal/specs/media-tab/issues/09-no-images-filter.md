# 09: No Images Filter

Status: done
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A new filter option over the media index, plus blank cards that reuse the image panel's add slot. The world slot upload is the one new control.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

A **No Images** option joins the Media tab's filter popover (Q54–Q56). It shows only blank cards: one for each entity with no gallery image, each location with no image, and the world thumbnail when empty. Dictionaries without a Cover Image are left out. Blank cards never show under All Media or any other filter.

- **Card:** the parent's name (the slot name for world media) and no size or badge, in the usual sections and grouping. Search and Largest First apply; blank cards sort last.
- **Click:** an entity or location card opens the image panel (ticket 05) framed on its add slot. A world slot opens its item panel with an upload control, file only, like Replace (Q41).
- **Upload:** the image lands as one history step, and the card leaves the filtered view; the panel stays open.
- **Index:** the media index reports the empty parents and slots; totals and the Publish Size meter don't change.

If ticket 08 has not landed, a location counts as empty when it has no background. Ticket 08 moves that read to the gallery with its other readers.

Update the Media tab wiki page. Changelog fragment: fold into ticket 01's line if unreleased.

## Acceptance criteria

- [x] All Media and every other filter show no blank cards (DOM test "shows blank cards under No Images only")
- [x] No Images shows a blank card for each imageless entity and location, and for an empty world thumbnail (same test)
- [x] A dictionary without a Cover Image shows no blank card (`blankSections` test, Plain Book)
- [x] A blank entity card opens the image panel framed on the add slot, and an upload lands in slot 0 (DOM test, Hollow)
- [x] A blank world slot card uploads into that slot (DOM test, Thumbnail)
- [x] After an upload the card leaves the No Images view, and one undo restores the empty state (entity DOM test; the world slot test checks the card leaves and the "Add Thumbnail" step label)
- [x] Search and grouping apply to blank cards; Largest First sorts them last (search DOM test; grouping and sort in `blankSections` tests; bytes are 0, so they sort last)
- [x] Media index tests cover the empty parents and slots, and a guard fails when a blank card leaks into All Media (mutation: blank entity source in `mediaSections` failed 5 tests)

## Landed

**Not verified**
- A blank location card's upload through the panel: no test drives it (the entity path shares the panel). Location blanks read `backgroundImage` until ticket 08 moves the read.
- Undo of the world thumbnail upload: only the step label is asserted.

**For you**
- Open the **No Images** filter on a world with imageless entities and locations. Check the blank card look (icon tile, name only) and that the location card's upload lands.
