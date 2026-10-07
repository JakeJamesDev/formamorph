# 06: Mobile Header And Footer

Status: done
Blocked by: 02
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

Recommended model rationale: layout changes across every tab at phone width, with mobile tests; no new logic.

## What to build

On mobile:
- Header: back, the Mode Select, then the Test Bench and Search at the far right. Search opens today's floating find bar.
- Footer, left: **Save to Library** on Entities and Dictionary. Every other tab, Overview included, leaves the left side empty, so Overview shows Export World once.
- Footer, right: the world actions (the Export World icon in Simple, the **More world actions** menu in Advanced), then an icon-only Save named "Save". Save has no unsaved dot; its enabled state is the signal. On a wrap, the right group stays right-aligned.
- Selecting an item opens its detail over the list's + and filter row. Back returns to the list with that row.

The Authoring Tour's `save` and `test-bench` anchors move with their controls.

Changelog fragment: the World Editor's phone layout fits its footer on one row and gives a selected item the full height.

From the prototype branch `prototype/editor-header-search` (commits `9fae1fb0`, `91591d7f`).

## Acceptance criteria

- [ ] At 375px the header holds back, Mode Select, Test Bench, Search, in that order, on one row; at 360px it still fits.
- [ ] The footer holds Save to Library (Entities, Dictionary), then the world actions and the Save icon, on one row at 375px.
- [ ] Overview shows Export World once.
- [ ] A selected item's detail hides the + and filter row; Back shows it again.
- [ ] The header-row test asserts the new order; the mobile tests cover the footer and the detail.
- [ ] The tour reaches Save and the Test Bench on mobile.
- [ ] Four gates green; verified at 375px in both themes.
