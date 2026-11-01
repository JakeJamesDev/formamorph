# Spec: Bodies and Equipment

Status: done
Status note: Closed 2026-10-31, tickets 01–08, last landing cb452d9f1. Review: spec text corrected. Lint green. Test gate rerun 2026-11-01: 30906 pass, 2 fail under load (CodeArea.test.tsx, Formaquestion.settings.test.tsx), both pass alone.
Spec session: bodies-and-equipment — spec

## Problem Statement

A world author can give an owner starting items, but every one starts carried. A knight cannot start in armor, and a guard cannot start with a sword in hand. The player has to equip each item on the first turn.

Every owner also shares one slot list. A faithful dog companion has the same Head, Hands and Ring slots as a party member, so the Inventory pass can put a helmet and two rings on it. And no slot changes when the story transforms someone: a player turned into a wolf still wears plate armor.

The slot list is edited in the Overview tab, beside the world's play settings. Starting items for the player sit there too. Neither one belongs on Overview. Both are equipment, and they are edited far from the items that use them.

## Solution

A placement on an owner can be marked **Equipped**. At new game, the item starts equipped, and its While Equipped effects apply. If the equip fails, the item starts carried.

A world defines **Bodies**. A Body is a name and an ordered list of slots, each with its own capacity in that Body. A Humanoid Body can have Head, Hand ×2 and Ring ×2. A Dog Body can have Collar and Back only. Each entity picks a Body. The first Body in the list is the **Default**, and every owner without a pick uses it. That includes new entities, library characters and characters the AI introduces. A library persona takes the Custom Persona entity's pick (Q31). An owner can also pick **None** and equip nothing.

A Body can change in play. A trait can set a Body while it is active, and a script can set an owner's Body directly. When a Body loses a slot, or a slot's capacity drops, the items there unequip and stay carried. Their effects reverse exactly.

Slots, Bodies and the player's starting items move out of Overview. They go into an **Equipment Settings** editor, opened from the top of the Items list.

## Rulings

| Q | Ruling |
|---|---|
| Q1 | Equipped at start, the editor move and Bodies are one spec |
| Q2 | A starting equip that fails at new game leaves the item carried. The placement row warns when the editor can already tell it will fail |
| Q3 | Capacity lives on a Body's slot entry. A slot is a name only |
| Q4 | Slots and Bodies are edited in an **Equipment Settings** editor. One Equipment Settings entry at the top of the Items list opens it in the right pane |
| Q5 | A Body can change in play. This is in scope |
| Q6 | Superseded by Q9 and Q27 |
| Q7 | Superseded by Q27 and Q28 |
| Q8 | The validator refuses an equip into a slot the owner's Body lacks. The Inventory pass lists each owner's own slots. **Extended:** an All of item is refused when the Body lacks any of its slots (body-layouts-and-slot-rules Q39) |
| Q9 | The played Persona takes the Custom Persona entity's Body pick, otherwise the Default, otherwise none |
| Q10 | Inventory has not shipped (`fe698b8d4` is not in v3.5.2). No migration. Emberwatch is reauthored |
| Q11 | A Body changes through a trait Body row or through a script |
| Q12 | When a Body change removes a slot or lowers its capacity, the items there unequip and stay carried. Effects reverse exactly and When Unequipped fires. When capacity shrinks, the item equipped most recently goes first |
| Q13 | When two active traits set a Body, the one switched on most recently wins. When it ends, the next one wins, and with none, the base Body returns |
| Q14 | A script's Body write sets the owner's base Body. An active trait's Body still wins over it |
| Q15 | The record is called **Body** |
| Q16 | Persona Items leaves Overview with the slots and goes into the Equipment Settings editor |
| Q17 | An entity's Body pick sits at the top of its Items tab, above its placements |
| Q18 | An owner placement row shows an **Equipped** checkbox only when its item has a slot. The row warns when the owner's Body lacks that slot. **Amended:** the warning follows the Slot Rule (body-layouts-and-slot-rules Q57) |
| Q19 | Reauthoring Emberwatch is a ticket in this spec |
| Q20 | Scripts read and write an owner's Body by name. They read the Body in force, with each slot's capacity and the Item Copies in it |
| Q21 | AI prompts see an owner's slots, never the Body's name. The traits tell the story of a transformation |
| Q22 | A Body holds a name and an ordered list of slot entries, with no descriptions or images. The shape leaves room for a later paperdoll: an image on the Body and a position on each entry |
| Q23 | The Inventory panel shows the slots of the owner's Body in force. A Body change writes a turn log line, such as "Body: Wolf", that names the items it unequipped |
| Q24 | A trait's Body row changes the trait's holder: a global trait changes the player, and an entity's trait changes that entity |
| Q25 | Deleting a Body or a slot follows the in-use delete standard (Q29). Hard references are counted in the confirm, then cleared. A script's Body name is a soft reference: it stays, and a new Test Bench rule reports it |
| Q26 | The panel lists slots in the Body's entry order. Starting equips run in placement order |
| Q27 | The first Body in the list is the **Default**. Every owner without a pick uses it: new entities, library personas, library characters and AI-introduced characters. The editor says so, and the Body list can be reordered |
| Q28 | A Body select lists **Default (\<first Body\>)** first, then **None**, then each Body. A world with no Bodies gives no owner a slot |
| Q29 | This spec writes the in-use delete standard into the Design System and adds one shared "used by" confirm helper. Body and slot deletes are its first users |
| Q30 | Moving the other delete flows onto the standard is its own effort, outside this spec |
| Q31 | (ticket 01) A played world persona uses its own Body pick. Under None or a library persona, the played Persona uses the Custom Persona entity's pick, else the Default (Q9; same routing as inventory Q81). This replaces ticket 01's "library personas use the Default" |
| Q32 | (ticket 01) In 01, the validator's equip check reads the Body in force: a missing slot is refused, and capacity and swap-out come from the entry. The settle's unequip of a lost or shrunk slot is 05's |
| Q33 | (ticket 01) A pick naming a Body the world lacks resolves to the Default. Slot Size's max is the largest capacity any Body entry gives the slot, and 1 when no Body holds it. The clamp on slot capacity edits goes away, and 03 re-adds it on Body entry edits |
| Q34 | (ticket 01) Emberwatch gains one Body with its four current slots and capacities in 01, so it plays the same until 08 reauthors it |
| Q35 | (ticket 01) An equipped copy whose slot the Body in force lacks shows under Carried with its Unequip button, never hidden |
| Q36 | (ticket 04) An Equipped placement with quantity above 1 equips once per unit, in order, and swap-out settles the result: Ring ×3 into a Ring capacity of 2 ends with two equipped and one carried |
| Q37 | (ticket 04) A starting equip checks the equip requirement up front. A failing requirement leaves the copy carried, with no log line and no When Unequipped |
| Q38 | (ticket 04) Hidden and Equipped are independent. A Hidden Equipped placement starts equipped and hidden, filling its slot unseen (inventory Q112) |
| Q39 | (ticket 05) A trait Body row's select lists None, then each Body, with no Default. A blank row, whether new or blanked by a Body delete, sets no Body |
| Q40 | (ticket 05) When several Body traits switch on in one commit, the later one in the holder's trait tree order wins. A trait link reads its original's Body row live; the row is not a link override |
| Q41 | (ticket 05) The log line reads "Body: Wolf" for the player and "Rex's Body: Wolf" for an entity, plus ". Unequipped A, B" when something came off, with copies named as the settle names them. None logs "Body: None"; an unwind logs the Body it returns to. A Hidden trait's row works and logs the same line |
| Q42 | (ticket 05) A load that finds a different Body settles it: it unequips what no longer fits and reverses effects exactly, but fires no When Unequipped (the load settle fires nothing, scripts Q47) and writes no log line. It leaves a diagnostic, as inventory Q60 does |
| Q43 | (ticket 03) `usedByText` gains a verb per reference kind, so one helper says what happens: "deletes its 2 Body entries and clears the slot on 3 items", "resets 3 picks to Default" |
| Q44 | (ticket 03) When a Body entry's capacity drops, an entry goes, or a Body is deleted, item Slot Sizes in that slot are cut silently to the new largest capacity (inventory Q77). **Superseded:** Slot Size retires, so nothing is cut (body-layouts-and-slot-rules Q35, Q59) |
| Q45 | (ticket 03) A Body has one entry per slot. Add Entry offers only the slots it lacks, entries drag-reorder, capacity is a whole number of 1 or more with no max, and a new Body starts as "New Body" with no entries |
| Q46 | (ticket 03) With no Bodies, the entity Body select is hidden and a hint points at Equipment. Duplicate Body names get an inline warning in the Bodies section, because scripts address Bodies by name; they are not blocked |
| Q47 | (ticket 03) The Custom Persona entity's Body select carries a short hint that it also sets the player's Body under None or a library persona. The Equipment Settings entry stays pinned under any Items filter, with no row actions and no drag |
| Q48 | (ticket 05) The trait Body row sits on the trait's Stats tab, below Stat Changes and above Stat Availability, in Simple mode too: a Body label with Help, one select and a remove button, or Add Body when there is none. A trait has at most one. It is read-only in a link view |
| Q49 | (ticket 03, user ruling) The entry and its editor are named **Equipment Settings**. Bodies reuse the Morphie layer pattern (an EditorRow with a chevron, an attached body and a nested EditorRowList), so no new Design System pattern is added. Every destructive remove button in the editor gets the red destructive hover |
| Q50 | (ticket 04) A starting item that the opening settle unequips, because another starting item's effect broke its requirement, comes off with no opening log line. A new game never logs a starting unequip (Q2, Q37) |
| Q51 | (ticket 04) One shared starting-copies helper feeds the new game, the Enter World trait-gate draft and the chip preview scene. The previews apply starting equips with the Body and swap-out rules but no requirement check, since they hold no stat state |
| Q52 | (ticket 07) Slots go on owners that already have an inventory block, plus the player always. The line reads `slots: Head, Hand ×2`, showing capacity only above 1. An owner with None or no Body reads `slots: none` in a world with Bodies, and the line is omitted in a world without Bodies |
| Q53 | (ticket 07) An equippable item's line names its slot, such as `Iron Helm (Head)`, with Slot Size above 1 as `(Hand ×2)`. The equip operation gains the clause "into a slot listed for that owner", kept only if the probe supports it. **Amended:** the line shows the Slot Rule, `(Main Hand or Off Hand)` or `(Main Hand + Off Hand)`, and the equip operation gains an optional slot (body-layouts-and-slot-rules Q41) |
| Q55 | (ticket 07, probe evidence) The model reads `slots: none`, but it does not match an item's `(Head)` against `slots: Collar`: 0/8 in every arm for a transformed owner. Each item an owner can't fit gets a precomputed per-owner mark in that owner's list, worded by the ticket under the prompt-writing guide, with one more probe round. If the mark does not move the rate, 07 ships slots, the item slot and the clause, and records the mismatch as a known gap; the validator still skips those equips (Q8). **Amended:** body-layouts-and-slot-rules Q45 sets the fit rule for a mark, and Q64 probed new wordings. None cleared the gate, so no mark ships and the known gap stands |
| Q54 | (ticket 07) 07 does not wait for 05. Whichever lands second wires 05's trait overrides into 07's prompt slice |
| Q56 | (user ruling, from 05's report) A between-turn script's trait or Body writes settle at once, as a Traits tab toggle does: the switch-run landing and the item-script landing run the settle, its unequips fire When Unequipped, and the Body log line writes then. This covers requirement unequips too. 06 builds it |
| Q57 | (ticket 06) `body` reads `{ name, slots: [{ name, capacity, items }] }` in entry order, or null with no Body in force. It takes a Body name string; `null` writes None. "Default" is not a keyword. Clearing the base back to the authored pick is out of scope |
| Q58 | (ticket 06) A duplicate Body name resolves to the first in list order; the Test Bench rule stays quiet on it (Q46 warns in the editor). The rule checks only literal names on known owner paths |
| Q59 | (ticket 06) The base Body lives in the save keyed like trait picks ('' = the player slot). A persona change keeps it, as it keeps global traits |
| Q60 | (ticket 06) A run that writes `body` reads the new Body at once; copies in a lost slot are not listed until the settle unequips them. A `body` write in a turn timing settles at once, as that timing's inventory writes do (ticket 06 landing; amends "settle at the turn commit") |
| Q61 | (user ruling, at close) The pinned list row from ticket 03 is approved as a Design System pattern, with its Design System row and Rich Lists showcase sample |

## User Stories

### Starting equipment

1. As a world author, I want to mark a starting item as equipped, so that a knight starts in armor.
2. As a world author, I want the Equipped checkbox only on placements whose item has a slot, so that a potion row stays plain.
3. As a world author, I want no Equipped checkbox on location placements, so that I can't equip an item on the floor.
4. As a world author, I want a warning on a placement row whose owner's Body lacks the item's slot, so that I catch the mistake before play.
5. As a world author, I want a starting item that can't be equipped to start carried, so that the owner still has it.
6. As a world author, I want starting equips to run in placement order, so that swap-out at start is predictable.
7. As a world author, I want a starting item's While Equipped effects to apply at new game, so that the armor's bonus is there on the first turn.
8. As a world author, I want a starting equip to fire no When Equipped script, so that it follows the same game-start rule as starting traits.
9. As a world author, I want At Game Start scripts to see starting items as equipped, so that my setup code reads the real opening state.
10. As a player, I want my starting equipment to show in its slots in the Inventory panel, so that I know what I'm wearing.

### Bodies

11. As a world author, I want to define Bodies, so that a dog companion and a party member have different slots.
12. As a world author, I want a Body's slot capacity set per Body, so that a Humanoid has two Ring slots and a Dog has none.
13. As a world author, I want a Body to hold more than one of a slot, so that a three-headed creature has Head ×3.
14. As a world author, I want a shared slot list across Bodies, so that one helmet item fits every Body with a Head.
15. As a world author, I want the first Body to be the Default, so that new entities get slots without extra work.
16. As a world author, I want to reorder the Body list, so that I can choose which Body is the Default.
17. As a world author, I want the editor to say that the first Body is the Default, so that I know what a new entity gets.
18. As a world author, I want to pick an entity's Body at the top of its Items tab, so that its Body and starting items are edited together.
19. As a world author, I want the Body select to start with Default and None, so that I can follow the Default or opt out of slots.
20. As a world author, I want None to give an owner no slots, so that a ghost can carry but never equip.
21. As a world author, I want the Custom Persona entity's Body pick to apply to the played Persona, so that the player's Body is authored like any entity's.
22. As a world author, I want library characters and AI-introduced characters to use the Default Body, so that they can wear what the story gives them.
23. As a world author with no Bodies, I want no owner to have slots, so that a world without equipment stays simple.
24. As a world author, I want the slots in a Body listed in my order, so that the Inventory panel reads head to toe.

### Bodies in play

25. As a player, I want the Inventory panel to show only the slots my Body has, so that a wolf has no Hand slots.
26. As a player, I want an entity's equipped items shown under its own Body's slots, so that the dog's collar looks right.
27. As a world author, I want a trait to set a Body while it is active, so that a wolf form changes the player's slots.
28. As a world author, I want a trait's Body row to change whoever holds the trait, so that the same curse can transform the player or a companion.
29. As a world author, I want the most recently switched-on trait's Body to win, so that a later transformation overrides an earlier one.
30. As a world author, I want an ended trait's Body to give way to the next active one, so that ending the wolf potion returns the cat curse.
31. As a world author, I want the base Body to return when no trait sets one, so that a cured player is human again.
32. As a world author, I want a script to set an owner's Body by name, so that a permanent transformation survives.
33. As a world author, I want a script's Body write to set the base Body, so that a temporary trait form still overrides it.
34. As a world author, I want scripts to read the Body in force with its slots, capacities and contents, so that code can react to a transformation.
35. As a player, I want items in a slot my new Body lacks to unequip and stay carried, so that I don't lose my armor when I turn into a wolf.
36. As a player, I want the most recently equipped item to unequip first when a slot's capacity drops, so that the result is predictable.
37. As a world author, I want unequipped items' effects to reverse exactly, so that a transformation never leaves stray stat changes.
38. As a world author, I want When Unequipped to fire for items a Body change removes, so that my scripts see the change.
39. As a player, I want a turn log line when my Body changes, naming what it unequipped, so that I see what happened.
40. As a player, I want a Body change on a loaded save to persist, so that my wolf is still a wolf next session.

### AI

41. As a player, I want the Inventory pass to equip only into slots the owner has, so that the dog never wears a helmet.
42. As a world author, I want an equip into a missing slot skipped like any invalid operation, so that a model mistake does no harm.
43. As a world author, I want the AI to see each owner's slots and never the Body's name, so that traits stay the one story source for a transformation.

### Editor

44. As a world author, I want an Equipment Settings entry at the top of the Items list, so that slots and Bodies sit beside the items that use them.
45. As a world author, I want slots, Bodies and the player's starting items edited in the Equipment Settings editor, so that Overview holds only world play settings.
46. As a world author, I want to add, rename and reorder slots in the Equipment Settings editor, so that my setting has its own equipment words.
47. As a world author, I want to add a slot to a Body with a capacity, so that the Body's layout is one list.
48. As a world author, I want an item's slot select to list every world slot, so that I can make an item for any Body.
49. As a world author, I want Slot Size limited to the largest capacity any Body gives that slot, so that I can't make an item that fits nowhere.
50. As a world author, I want deleting a slot in use to tell me how many items and Body entries use it, then clear them, so that I know what I'm breaking.
51. As a world author, I want deleting a Body in use to tell me how many entities and trait rows use it, then clear them, so that nothing points at a Body that's gone.
52. As a world author, I want a deleted Body's entity picks to fall back to Default, so that those entities keep their slots.
53. As a world author, I want a Test Bench issue for a script that names a Body that doesn't exist, so that I find a typo before play.
54. As a world author, I want Emberwatch to show Bodies in use, so that I have a working example.

### Delete standard

55. As a contributor, I want the in-use delete standard written in the Design System, so that every new delete flow behaves the same way.
56. As a contributor, I want one shared "used by" confirm helper, so that counts and wording match across editors.
57. As a world author, I want a delete with nothing using it to happen at once, so that the editor doesn't nag me.

## Implementation Decisions

### Data

- **Slot** keeps `id` and `name` and loses `capacity`. The world's slot list stays shared, so an item's slot reference works across Bodies.
- **Body** is a new world record: `id`, `name`, and an ordered list of entries. Each entry is an object with a slot reference and a capacity (absent = 1). Entries are objects, not pairs, so that a later paperdoll can add a position to each one. The Body can later get an image.
- The world holds an ordered **Body list**. The first Body is the Default.
- An entity's **Body pick** is one of three values: Default (absent), None, or a Body id. A tagged form keeps None distinct from Default.
- A **trait Body row** is a new trait effect: "set this holder's Body to X while active".
- An owner placement gains **Equipped**. A location placement never carries it.
- The save gains a per-owner **base Body** for owners whose Body a script changed. It also records the order the Body-setting traits switched on (`bodies.traitsOn`, oldest first), so that Q13's latest-on rule survives a load. Absent means the authored pick.
- ⚠️ **Export shape.** World `.json`: the Slot loses `capacity`, and the world gains Bodies, entity Body picks, trait Body rows and placement Equipped. Save `.json`: per-owner base Body and trait-on order. Inventory has not shipped, so there is no compat code (Q10).

### Body in force

- One resolver answers "which Body is in force for this owner": the most recently switched-on active Body-setting trait the owner holds, otherwise the base Body from the save, otherwise the authored pick, otherwise the Default (Q9, Q13, Q14, Q27). For the played Persona, the authored pick is the Custom Persona entity's pick.
- The validator and `settleInventory` read capacity from the Body in force, never from the slot.
- A Body change from any writer (a trait switch, a script write, a persona change) goes through the settle that already handles requirement auto-unequip (inventory Q48). The settle unequips what no longer fits, most recently equipped first, reverses effects exactly, and fires When Unequipped. One path covers every writer. A load settle fires nothing and writes a diagnostic (Q42); script writes settle at once (Q56, Q60).
- A Body change logs one turn log line with the new Body's name and the items it unequipped. The log is player-facing, so the name is shown there, even though the AI never sees it (Q21).

### New game

- `openingFold` seeds Item Copies as today, then equips the Equipped placements in placement order through the shared `startingCopies` helper (Q51), which checks as the `panel` source would minus Bound. It runs before `settleInventory` applies item effects, so that While Equipped effects apply in the same fold.
- A refused starting equip leaves the copy carried. It writes no log line in play. The editor's row warning is the author's signal (Q2).
- No item script fires (inventory Q59 and the documented game-start rule).

### Scripts

- The owner surface gains `body`: the Body in force's name, with its slots, each slot's capacity and its Item Copies. Assigning a Body name to `body` sets the base Body (Q14). An unknown name fails the write, and a Test Bench rule reports the script's literal name.
- The Variable menu and hover cards list the new name.
- A script that runs between turns settles its trait and Body writes at once (Q56).

### AI

- The Inventory pass and narration context list each present owner's slots from the Body in force, never the Body's name (Q8, Q21). This is a prompt change, so it ships with probe numbers.

### Editor

- An **Equipment Settings** entry pinned at the top of the Items list opens an editor in the right pane. It has three sections: Slots, Bodies and Persona Items. The current Slots and Persona Items sections leave Overview. Bodies reuse the Morphie layer pattern (Q49). The pinned entry is a new Design System pattern, the pinned list row (Q61).
- The Bodies section is reorderable. It states that the first Body is the Default.
- An entity's Items tab gains a Body select above its placements. Its options are Default (\<first Body name\>), None, then each Body (Q28).
- A placement row on an owner shows an Equipped checkbox when the item has a slot. It warns when the owner's authored Body lacks that slot, or has a capacity smaller than the item's Slot Size.
- An item's Slot Size ranges from 1 to the largest capacity any Body gives its slot.

### Delete standard

- The Design System gains an in-use delete section. A record nothing uses deletes at once. A record with hard references (picks, links, slot references) opens a `ConfirmDialog` with a count or the names, then clears those references. Soft references (requirement rows, scripts, text chips) stay, turn red, and the Test Bench reports them.
- One shared helper builds the "used by" confirm text from a list of counted reference kinds. `alsoDeletesLinks` folds into it.
- Deleting a slot counts the items that use it and the Body entries that hold it. Deleting a Body counts entity picks and trait Body rows. A deleted Body's picks fall back to Default, and its trait rows go blank.

### Glossary

- CONTEXT.md gains **Body**, **Default Body** and **Body in force**. **Slot** is rewritten: it is a name, and its capacity comes from the Body. Its "_Avoid_: equipment slot list per entity" note goes.

## Testing Decisions

- A good test drives behavior through a seam and asserts what a player or author would see. It never reaches into private helpers. Each guard proves it bites by reinstating the bug once (`test-bar` skill).
- **`openingFold`**: Equipped placements start equipped, in placement order. Swap-out applies at start. A refused equip starts carried. While Equipped effects apply. No item script fires. Body defaults resolve for an entity, the played Persona through the Custom Persona entity, and a library persona. Prior art: the opening-state tests and `statCodeTurn.start.test.ts`.
- **`settleInventory` and the operation validator**: capacity reads from the Body in force. An equip into a missing slot is refused. A trait Body row changes the holder's Body. Latest-on wins and unwinds in order. A script write sets the base Body under an active trait. A lost or shrunk slot unequips the most recently equipped copy first, reverses effects exactly and fires When Unequipped. A load restores the Body. Prior art: `src/lib/inventory/settle.test.ts`, `inventory.test.ts`, `effects.test.ts`, and the `traitRuntime` tests.
- **Editor components**: the Equipment Settings editor's sections, the Body select's options, the Equipped checkbox's visibility, the placement row warning, and both in-use delete confirms with their counts. The shared confirm helper gets unit tests. Prior art: the `SlotsSection` and `PlacementsSection` tests, and `GamePanels.inventoryHere.test.tsx`.
- **Test Bench**: the unknown Body name rule fires on a bad name and stays quiet on a good one. Prior art: `src/lib/testBench/rules.ts` tests.
- **Probe**: the Inventory pass with per-owner slots, on the cloud default with in-batch controls. Cases are an equip onto a slotless owner (the dog and a helmet), a normal equip, and a transformed owner. Report rates with the control arm (`probe` skill).

## Out of Scope

- A paperdoll layout: a Body image and slot positions (Q22). The data shape leaves room for it.
- Body descriptions or images.
- Moving the other editor delete flows onto the standard (Q30): dictionaries, Openings, World Tools, scripts, the Tools tab, and stat, trait and item deletes that leave soft references unmentioned.
- A Body choice at Enter World.

## Further Notes

- The game-start rule this spec follows is documented in the Scripts Guide's At Game Start section (`cc915783e`).
- Emberwatch is the one bundled world that uses slots today. Its reauthor follows the `bundled-worlds` skill.
- The in-use delete survey (2026-10-31) found the de facto split this spec writes down. Every confirm uses `ConfirmDialog`, and `alsoDeletesLinks` is the only reused helper.
