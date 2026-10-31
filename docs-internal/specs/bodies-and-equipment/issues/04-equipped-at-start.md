# 04: Equipped at Start

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

An owner placement can be marked **Equipped**. The row shows the checkbox only when the item has a slot. Location rows never show it. The row warns when the owner's authored Body lacks the item's slot, or when the slot's capacity is smaller than the item's Slot Size.

At new game, `openingFold` equips Equipped placements in placement order through the operation validator. It uses the panel rules without Bound, so swap-out applies. Then the existing settle applies item effects, so While Equipped effects are there on the first turn. A refused equip leaves the copy carried, with no log line. No item script fires (inventory Q59 and the game-start rule in the Scripts Guide). At Game Start scripts see the copies as equipped.

Ticket 03 moves Persona Items into the Equipment editor. The placement row is shared, so the checkbox follows it there.

Spec: Solution; Implementation Decisions under New game and Editor; Q2, Q18, Q26.

## Acceptance criteria

- [ ] An owner placement stores Equipped. Location placements cannot
- [ ] The checkbox shows only for items with a slot, and the Body warning shows on the right rows
- [ ] A new game starts Equipped placements equipped, in placement order, with swap-out
- [ ] While Equipped effects apply at new game, and no item script fires
- [ ] A refused starting equip starts carried
- [ ] At Game Start scripts read the starting copies as equipped
- [ ] The World Editor wiki page for placements describes Equipped
