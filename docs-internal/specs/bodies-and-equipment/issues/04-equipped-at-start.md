# 04: Equipped at Start

Status: ready-for-human
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

An owner placement can be marked **Equipped**. The row shows the checkbox only when the item has a slot. Location rows never show it. The row warns when the owner's authored Body lacks the item's slot, or when the slot's capacity is smaller than the item's Slot Size.

At new game, `openingFold` equips Equipped placements in placement order through the operation validator. It uses the panel rules without Bound, so swap-out applies. Then the existing settle applies item effects, so While Equipped effects are there on the first turn. A refused equip leaves the copy carried, with no log line. No item script fires (inventory Q59 and the game-start rule in the Scripts Guide). At Game Start scripts see the copies as equipped.

Ticket 03 moves Persona Items into the Equipment editor. The placement row is shared, so the checkbox follows it there.

Spec: Solution; Implementation Decisions under New game and Editor; Q2, Q18, Q26.

## Acceptance criteria

- [x] An owner placement stores Equipped. Location placements cannot (`parsePlacements` test; `PlacementsSection` "stores it" test; the fold ignores a stray location flag)
- [x] The checkbox shows only for items with a slot, and the Body warning shows on the right rows (`PlacementsSection.test.tsx`: slot-only, location, missing slot, capacity, None, Custom Persona, quiet cases)
- [x] A new game starts Equipped placements equipped, in placement order, with swap-out (`openingFold — Equipped placements`: Q26 and Q36 tests)
- [x] While Equipped effects apply at new game, and no item script fires (While Equipped test; the fold returns no item events, and GameViewer runs none from the opening, checked by reading `GameViewer.tsx`)
- [x] A refused starting equip starts carried (missing-slot, None, requirement Q37 and settle-cascade Q50 tests)
- [x] At Game Start scripts read the starting copies as equipped (`statCodeTurn.start.test.ts`: a start script reads `equipped` and `slot`)
- [x] The World Editor wiki page for placements describes Equipped (`docs/World-Editor-Items.md`, Starting Items → Equipped)

## Landed

**Not verified**
- The Equipped checkbox and the warning line were not seen in a live preview. They were checked by jsdom tests only.
- The coverage number for `PlacementsSection.tsx` did not print under the dom project. The lib modules are covered.

**For you**
- The Equipped checkbox and the warning line on a placement row (World Editor → an entity's **Items** tab, and **Persona Items**). Check the row layout and the warning wording.
- A new game with an Equipped starting item: the Inventory tab shows it in its slot on the first turn.
