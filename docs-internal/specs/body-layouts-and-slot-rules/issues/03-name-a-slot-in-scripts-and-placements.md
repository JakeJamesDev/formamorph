# 03: Name a Slot in Scripts and Placements

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Two contained surfaces on top of ticket 01's equip operation.

## What to build

**Scripts (Q42).** A script reads which slot an equipped copy sits in, and may name a slot when it equips. An All of copy reads under each slot it occupies in the `body` read. Update code hover cards and the scripting docs.

**Placements (Q43).** An Equipped placement of an Either of item with 2+ slots gets a slot select. It defaults to the first free slot. `Placement` gains the optional slot. The new game, the Enter World draft and the chip preview all honor the slot through the one starting-copies helper.

⚠️ This changes the world export shape. Remind the user in the landing report.

## Acceptance criteria

- [x] A script reads a copy's slot. `statCodeExecutor.slotName.test.ts` (`slot` read; an All of copy reads its first slot).
- [x] A script equip that names an allowed slot lands there, and a disallowed name is refused with a diagnostic. The test checks the name maps to the slot id; an unlisted name passes to the existing validator refusal ("can't go in …", `slotRule.test.ts`).
- [x] The `body` read lists an All of copy under each slot it occupies. `statCodeExecutor.slotName.test.ts`.
- [x] The placement select shows only on an Equipped placement of an Either of item with 2+ slots. `PlacementsSection.test.tsx` (starting slot).
- [x] A new game starts the copy in the selected slot. `startingCopies.slot.test.ts`; the Enter World draft and chip preview call the same `startingCopies`.

## Landed

**Not verified**
- The placement select in the live editor: tests read the DOM only, no frame was taken.

**For you**
- ⚠️ World export shape changed: `Placement` gains an optional `slotId`.
- Open a character's Starting Items in the World Editor, tick Equipped on an Either of item with 2+ slots, and check the slot select looks right.
- A script `copy.equip("Off Hand")` on a dagger: confirm it lands in the off hand in play.
