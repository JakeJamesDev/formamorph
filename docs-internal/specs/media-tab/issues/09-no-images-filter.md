# 09: No Images Filter

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A new filter option over the media index, plus blank cards that reuse the image panel's add slot. The world slot upload is the one new control.

## Parent

`docs-internal/specs/media-tab/spec.md`

## What to build

A **No Images** option joins the Media tab's filter popover (Q54–Q56). It shows only blank cards: one for each entity with no gallery image, each location with no image, and the world thumbnail and world background when empty. Dictionaries without a Cover Image are left out. Blank cards never show under All Media or any other filter.

- **Card:** the parent's name (the slot name for world media) and no size or badge, in the usual sections and grouping. Search and Largest First apply; blank cards sort last.
- **Click:** an entity or location card opens the image panel (ticket 05) framed on its add slot. A world slot opens its item panel with an upload control, file only, like Replace (Q41).
- **Upload:** the image lands as one history step, and the card leaves the filtered view; the panel stays open.
- **Index:** the media index reports the empty parents and slots; totals and the Publish Size meter don't change.

If ticket 08 has not landed, a location counts as empty when it has no background. Ticket 08 moves that read to the gallery with its other readers.

Update the Media tab wiki page. Changelog fragment: fold into ticket 01's line if unreleased.

## Acceptance criteria

- [ ] All Media and every other filter show no blank cards
- [ ] No Images shows a blank card for each imageless entity and location, and for an empty world thumbnail and background
- [ ] A dictionary without a Cover Image shows no blank card
- [ ] A blank entity card opens the image panel framed on the add slot, and an upload lands in slot 0
- [ ] A blank world slot card uploads into that slot
- [ ] After an upload the card leaves the No Images view, and one undo restores the empty state
- [ ] Search and grouping apply to blank cards; Largest First sorts them last
- [ ] Media index tests cover the empty parents and slots, and a guard fails when a blank card leaks into All Media
