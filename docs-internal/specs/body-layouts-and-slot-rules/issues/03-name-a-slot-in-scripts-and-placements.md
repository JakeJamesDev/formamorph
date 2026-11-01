# 03: Name a Slot in Scripts and Placements

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

Two contained surfaces on top of ticket 01's equip operation.

## What to build

**Scripts (Q42).** A script reads which slot an equipped copy sits in, and may name a slot when it equips. An All of copy reads under each slot it occupies in the `body` read. Update code hover cards and the scripting docs.

**Placements (Q43).** An Equipped placement of an Either of item with 2+ slots gets a slot select. It defaults to the first free slot. `Placement` gains the optional slot. The new game, the Enter World draft and the chip preview all honor the slot through the one starting-copies helper.

⚠️ This changes the world export shape. Remind the user in the landing report.

## Acceptance criteria

- [ ] A script reads a copy's slot.
- [ ] A script equip that names an allowed slot lands there, and a disallowed name is refused with a diagnostic.
- [ ] The `body` read lists an All of copy under each slot it occupies.
- [ ] The placement select shows only on an Equipped placement of an Either of item with 2+ slots.
- [ ] A new game starts the copy in the selected slot.
