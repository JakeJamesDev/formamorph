# Spec: Inventory

Status: ready-for-agent
Spec session: inventory — spec

## Problem Statement

A world author cannot give the player or an entity an item. A sword, a potion, a key or a cursed ring exists only in prose. Nothing records who has it, nothing applies its effect, and the narrator forgets it a few turns later. Authors fake items with stats, traits and scripts, which cannot be given, dropped, equipped, stacked or found. The stat pass cannot take this job: it already struggles with the work it has.

## Solution

A world can define **Items**. An item is an authored kind with its own list beside Entities. It has the entity fields (descriptions, AI Summary, images with rules, image tags, placeholders, scripts), plus stat and trait **effect rows**, an equipment **slot**, **Stackable**, **Consumable**, **Charges**, **Bound**, **equip requirements** and a **value** with a unit.

In play, the save holds **Item Copies**. An Item Copy has an owner (the Persona or an entity) or lies at a location. It has a quantity, an equipped state and a visibility. Authors place starting Item Copies on owners and at locations through **placements**, which a seed function turns into Item Copies when a new game starts.

After narration, a dedicated **Inventory pass** reads the prose and returns item operations: gain, lose, transfer, equip, unequip, consume and reveal. The player acts on items directly from an **Inventory** panel tab with Equip, Use, Drop and Give. Scripts read and write inventory too. All three writers go through one operation validator.

## Rulings

Settled with the user on 2026-10-19 and 2026-10-28. The design discussion ruled out folding item changes into the stat pass and ruled out narrator Tool calls as the write path; the research is in `.scratch/reports/Narration tool calling patterns.md`. Q50–Q69 came from the spec review.

| # | Ruling |
|---|---|
| R1 | AI item changes come from a dedicated **Inventory pass** after narration, never the stat pass |
| R2 | The Inventory pass uses a JSON schema with a text fallback on refusal. It reuses the stat pass's schema-refusal machinery but has its own prompts, schema, text format and parser. It runs in the parallel post-narration batch |
| R3 | Narrator Tools stay read-only lookups. No Tool writes inventory in this effort |
| Q1 | An item is its own authored kind with an Items list. It reuses the entity field editors. Items never enter the roster, discovery or the stat pass |
| Q2 | The world holds the item definition. The save holds Item Copies (Q68) |
| Q3 | The Persona and any entity can own items |
| Q4 | Effect timings: **While Equipped**, **While Owned**, **After Consumed** (a duration, up to permanent) and **On First Obtain** (permanent) |
| Q5 | Each effect row picks its own timing. One item can mix timings |
| Q6 | When a While Equipped or While Owned effect ends, it reverses exactly what it applied, after clamping, as trait switches do |
| Q7 | After Consumed durations use story-clock time, or Permanent |
| Q8 | Equipment uses author-named slots |
| Q9 | Trait effects use the same four timings as stat effects |
| Q10 | Each item has a **Stackable** switch, on by default. Stacked Item Copies share one quantity |
| Q11 | A While Owned effect applies once per owner, however many Item Copies they own |
| Q12 | The world defines one slot list. Each equippable item picks a slot from it |
| Q13 | Each slot has an author-set capacity, default 1 |
| Q14 | Equipping into a full slot unequips the item equipped there longest. It stays owned |
| Q15 | The Persona and every entity share the one slot list |
| Q16 | **Consumable** is a per-item switch. Consuming lowers the quantity by one and starts its After Consumed effects. After Consumed rows show only when it is on |
| Q17 | Panel buttons apply at once. They call the same validator as the pass |
| Q18 | The pass can create **runtime items** for names the world does not define |
| Q19 | After a panel action, narration sees the updated state. Whether it also gets a one-time event line is decided by a probe |
| Q20 | Give offers only the entities present (Q62) |
| Q21 | A dropped Item Copy lies at the current location |
| Q22 | The validator skips an invalid operation and logs a diagnostic. Valid operations in the same reply still apply |
| Q23 | Pass operations: gain, lose, transfer, equip, unequip, consume, reveal |
| Q24 | A pass name that matches an authored item's name uses that item. Only an unmatched name makes a runtime item. Matching rules: Q56 |
| Q25 | Narration sees each present owner's equipped items with their AI Summary, and carried items by name |
| Q26 | Narration sees the items at the current location, and the player sees them in the panel. An Item Copy can be **hidden** from the player |
| Q27 | Narration sees hidden Item Copies, marked hidden |
| Q28 | A hidden Item Copy becomes visible through the pass's reveal operation or a script write |
| Q29 | No containers in this effort. A chest is location text, and its contents lie hidden at the location |
| Q30 | The hidden state applies to owned Item Copies as well |
| Q31 | The player sees an entity's equipped items only |
| Q32 | The value's unit points to a stat or is free text |
| Q33 | Item scripts get five timings: **When Gained**, **When Lost**, **When Equipped**, **When Unequipped**, **When Consumed** |
| Q34 | Requirement Rows gain an **Item Condition**: owns or equips an item, with an owner. It works in trait gates and image rules |
| Q35 | Authors set starting items on owners (the Persona and entities) and at locations |
| Q36 | Runtime items have no slot and no effects. Q56 sets their switches |
| Q37 | The Inventory pass is due only when the world has authored items or the game has Item Copies |
| Q38 | The pass sees only the owners present (Q62), and the location's items |
| Q39 | Effect rows target the owner's own stats and traits only |
| Q40 | Running After Consumed effects are saved as timed effects on the owner and shown to the player with time left |
| Q41 | Scripts read and write inventory: gain, lose, transfer, equip, unequip, consume, reveal, and charges |
| Q42 | Item placeholders resolve once per item per playthrough, shared by every Item Copy |
| Q43 | The player's inventory is a game panel tab |
| Q44 | A **placement** is its own authored record: where (a location or an owner), quantity, hidden, and a source. The source is one item in this effort. One seed function turns placements into Item Copies |
| Q45 | Build the seven hooks listed under Implementation Decisions |
| Q46 | Bound, equip requirements, slot size and charges are in this effort |
| Q47 | An item with charges is never stackable. Each Item Copy keeps its own count. Scripts can recharge it |
| Q48 | An equipped item unequips on its own when its equip requirement stops holding. Its effects reverse exactly |
| Q49 | An equip requirement ignores the item's own effects in both directions |
| Q50 | A stat effect row names a stat the owner has. An owner without that stat skips the row with a diagnostic. No Global Stat fallback (Q39 stands) |
| Q51 | A stat effect row picks a facet like a trait stat row: value, min, max or regen. Value changes use the reversal ledger; min, max and regen join the derived bounds as trait contributions do |
| Q52 | An item-granted trait is an extra active source. The trait is on while any source holds. Item grants ignore Pick Count and switch off no group siblings. An item cannot grant an Automatic trait |
| Q53 | The stat pass prompt states that the turn's item effects are already applied. Inventory changes commit before stat-pass deltas. A probe confirms the stat pass stops double-adding |
| Q54 | The `you` owner always resolves to the played Persona. A played world entity has one inventory, and its authored starting items are the player's |
| Q55 | A world with no authored items never gets runtime items, and the pass stops once the last Item Copy is gone. Intended |
| Q56 | Runtime items are Stackable and Consumable, with no effects. Name matching ignores case and surrounding spaces, uses resolved names, and reuses an earlier runtime item of the same name. Plurals do not match |
| Q57 | Use on a charged item spends one charge and fires When Consumed and After Consumed. At zero, a Consumable Item Copy goes away; a non-Consumable one stays with Use off until recharged |
| Q58 | **Bound** is a player-only lock: the panel cannot drop or give a Bound Item Copy. The Inventory pass and scripts can still remove or move it |
| Q59 | Seeded starting Item Copies apply their effects, On First Obtain included, and fire no item scripts. The seed runs for a new game only and never backfills an older save |
| Q60 | On load, Item Copies whose item, owner entity or location no longer exists are dropped, with their applied effects reversed and a diagnostic |
| Q61 | Panel buttons are off while a turn runs. Re-rolling a turn also discards panel actions made after it. Intended |
| Q62 | Present means at the player's location after this turn's moves, entities discovered this turn included. One rule for Give, the pass and the narration block |
| Q63 | Hidden owned Item Copies still apply their effects and count for the Item Condition. The stat panel shows the change without the item's name |
| Q64 | A second dose of a running After Consumed effect restarts its timer instead of stacking |
| Q65 | Equipping from a stack splits one Item Copy off. Hidden and visible Item Copies of one item stay separate rows until revealed |
| Q66 | Cascades (unequip, requirement checks, trait settling) settle to a fixed point under a cap. Inventory writes from item scripts fire item timings up to a depth of 3, then stop with a diagnostic |
| Q67 | On an item, a Condition with no owner and the script `owner` mean the Item Copy's owner. Both are empty while it lies at a location |
| Q68 | An item in play is an **Item Copy**, always written in full, distinct from a placeholder Copy |
| Q69 | An Item Copy's possessor is its **Owner**. A location is not an owner: an Item Copy there lies at it |

## User Stories

### Authoring items

1. As a world author, I want an Items list beside Entities, so that I can define the objects of my world in one place.
2. As a world author, I want an item to have a player-facing description, an AI-facing description and an AI Summary, so that I control what the player reads and what the narrator knows.
3. As a world author, I want item images with Requirement Row rules, so that a ring can look different once it is cursed.
4. As a world author, I want image tags on an item, so that scene images can draw it.
5. As a world author, I want placeholders on an item, so that an item's name or detail can roll once per playthrough.
6. As a world author, I want item scripts, so that an item can do something no effect row covers.
7. As a world author, I want the item editor to look and work like the entity editor, so that I don't learn a second set of controls.
8. As a world author, I want to give an item a value and a unit, so that the narrator and player know what it is worth.
9. As a world author, I want the unit to point to a stat such as Gold, so that a later trade feature can do the math.
10. As a world author, I want a free-text unit, so that I can write a value with no matching stat.

### Effects

11. As a world author, I want stat effect rows on an item, so that equipping a sword raises Strength.
12. As a world author, I want each effect row to pick a facet, so that an item can raise a value, a maximum, a minimum or a regen rate.
13. As a world author, I want each effect row to pick its timing, so that one item can mix While Equipped, While Owned, After Consumed and On First Obtain.
14. As a world author, I want a While Owned effect, so that a lucky coin helps while it sits in a pack.
15. As a world author, I want an On First Obtain effect, so that finding a relic raises Max Health once and for good.
16. As a world author, I want an After Consumed effect with a story-clock duration, so that a potion's buff lasts two hours of game time.
17. As a world author, I want an After Consumed effect to be permanent, so that an elixir changes a stat for good.
18. As a world author, I want trait effect rows with the same four timings, so that a cursed ring grants the Cursed trait while owned.
19. As a player, I want an effect to reverse what it applied when I drop or unequip the item, so that the item leaves no hidden bonus behind.
20. As a player, I want a trait I already had to stay when the item that also granted it leaves, so that an item never strips my own traits.
21. As a player, I want three lucky coins to count once, so that hoarding copies isn't an exploit.
22. As a player, I want a second potion to refresh the buff, not double it, so that potions stay balanced.
23. As a player, I want to see my running timed effects and the time left, so that I know when a buff ends.
24. As a world author, I want an item effect on a stat its owner lacks to be skipped and reported, so that I can find the mistake.
25. As a player, I want the stat pass not to add a potion's effect a second time, so that one dose counts once.

### Slots and equipping

26. As a world author, I want to define a slot list for my world, so that my equipment fits my setting.
27. As a world author, I want a slot capacity, so that Ring holds two rings without two slot names.
28. As a world author, I want an item to take more than one unit of a slot's capacity, so that a two-handed sword fills both hands.
29. As a player, I want equipping into a full slot to swap out the item equipped there longest, so that I don't have to unequip first.
30. As a player, I want to equip one dagger from a stack of five, so that the rest stay in my pack.
31. As a world author, I want equip requirements on an item, so that a heavy axe needs Strength 5.
32. As a player, I want an item to unequip on its own when I no longer meet its requirement, so that the rules stay true.
33. As a player, I want an item's own bonus never to keep it equipped, so that a +Strength sword can't prop up its own requirement.
34. As a world author, I want an item's own penalty never to unequip it, so that a cursed -Strength sword can't escape its own requirement.
35. As a world author, I want the Persona and every entity to share the slot list, so that an entity can wear the same armor the player can.

### Stacks, consumables, charges, Bound

36. As a world author, I want a Stackable switch on by default, so that potions and arrows group into one row.
37. As a world author, I want to turn stacking off, so that each named sword is its own Item Copy.
38. As a world author, I want a Consumable switch, so that only food, potions and scrolls can be used up.
39. As a world author, I want charges on an item, so that a wand casts three times.
40. As a world author, I want an item with charges to keep each Item Copy's count, so that giving one wand away doesn't move another wand's charges.
41. As a player, I want an empty wand to stay in my pack until it is recharged, so that I don't lose it.
42. As a world author, I want a three-dose potion to vanish after its last dose, so that charged consumables clean up.
43. As a world author, I want scripts to recharge an item, so that resting at a shrine refills a wand.
44. As a world author, I want a Bound switch, so that the player can't drop or give away a quest item.
45. As a player, I want the story to still take a Bound item when the quest ends, so that it never becomes an accidental permanent item.

### Placement and the world start

46. As a world author, I want to give the Persona starting items, so that the player begins with a sword and a lantern.
47. As a world author, I want to give an entity starting items, so that a merchant has stock and a guard has a spear.
48. As a world author, I want a played world entity's starting items to be the player's, so that playing that entity starts with its gear.
49. As a world author, I want to place items at a location with a quantity, so that the cellar holds three bottles.
50. As a world author, I want a placed Item Copy to start hidden, so that the ring in the treasure pile must be found.
51. As a player, I want starting Item Copies to exist and apply their effects the moment the game starts, so that my inventory and stats are right on the first turn.
52. As a player, I want an older save to keep its inventory when the world gains new placements, so that a world update doesn't drop items into my game.
53. As a player, I want Item Copies of a deleted item, entity or location dropped cleanly on load, so that no ghost bonus remains.

### The Inventory pass

54. As a player, I want the item I pick up in the prose to appear in my inventory, so that the story and the state agree.
55. As a player, I want an item I give away in the prose to leave my inventory, so that I can't keep a sold sword.
56. As a player, I want items to move between entities present, so that a thief's take or a gift lands with the right owner.
57. As a player, I want an entity who arrived this turn to be able to take an item, so that a thief who bursts in can grab the purse.
58. As a player, I want the AI to equip and unequip items for entities, so that a guard draws a weapon when a fight starts.
59. As a player, I want a potion I drink in the prose to be used up, so that its effect starts and the dose is gone.
60. As a player, I want a hidden item to appear once the prose has me find it, so that searching pays off.
61. As a player in a world with items, I want an item the narration invents to land in my inventory, so that a rusty key from a drawer isn't lost.
62. As a world author, I want an invented name that matches my item to use my item, so that "iron sword" gets my Iron Sword's effects.
63. As a world author, I want invented items to have no slot and no effects, so that the AI can't create a +10 sword.
64. As a player, I want an invented potion to be drinkable, so that it doesn't sit in my pack forever.
65. As a player, I want one bad operation in the pass reply to be skipped, so that the rest of the turn's item changes still apply.
66. As a player, I want worlds with no items to skip the pass, so that they cost no extra request.
67. As a player, I want the Inventory pass to run beside the other post-narration passes, so that the turn takes no longer.
68. As a player on an endpoint that refuses JSON schemas, I want the pass to fall back to text, so that items still work.

### What the narrator sees

69. As a player, I want the narrator to know what each present owner has equipped and what it does, so that the prose describes the right gear.
70. As a player, I want the narrator to know what each present owner carries by name, so that it doesn't invent items they don't have.
71. As a player, I want the narrator to know what lies at the location, so that it can describe the room.
72. As a world author, I want the narrator to know where hidden items are, so that it can reveal them when the player searches.

### The player panel

73. As a player, I want an Inventory panel tab, so that I see my slots, my carried items and what lies here.
74. As a player, I want to equip, use, drop and give items from the panel, so that I don't have to type every action.
75. As a player, I want panel actions to apply at once, so that the panel feels responsive.
76. As a player, I want panel buttons off while a turn runs, so that my action never fights the turn's changes.
77. As a player, I want Give to list only the entities present, so that I can't hand items to someone across the map.
78. As a player, I want a dropped item to stay where I dropped it, so that I can come back for it.
79. As a player, I want hidden items never to show in my panel, so that the panel doesn't spoil a search.
80. As a player, I want a hidden item's stat change shown without its name, so that a concealed curse stays a mystery.
81. As a player, I want to see what an entity has equipped, so that I can judge an opponent's gear.
82. As a player, I want an entity's pack to stay private, so that its carried items stay unknown.
83. As a player, I want Bound items to show they can't be dropped or given, so that I'm not confused when the button is off.
84. As a player, I want an item's charges shown, so that I know how many uses are left.

### Rules and scripts

85. As a world author, I want an Item Condition in Requirement Rows, so that an Automatic trait can require the cursed item.
86. As a world author, I want the Item Condition to choose owned or equipped, so that a set bonus can require wearing two pieces.
87. As a world author, I want the Item Condition to take an owner, so that a trait can check what an entity owns.
88. As a world author, I want a Condition with no owner on an item to mean that Item Copy's owner, so that an item's image can react to its wielder.
89. As a world author, I want When Gained, When Lost, When Equipped, When Unequipped and When Consumed script timings, so that an item can react to its own events.
90. As a world author, I want an item script's writes to chain a few levels and then stop, so that a gift that gives a gift works without an endless loop.
91. As a world author, I want scripts to read who owns what, so that a door can check for a key.
92. As a world author, I want scripts to give, take, move, equip, consume, reveal and recharge items, so that I can build shops, rewards and traps.

### Saves and exports

93. As a player, I want my inventory, timed effects and revealed items saved, so that loading restores them exactly.
94. As a player, I want a re-roll to restore the inventory the turn started with, so that a re-rolled turn starts from the same state.

## Implementation Decisions

### Authored shape (world)

- **Item**: a new top-level world record. Fields: the shared entity description fields, AI Summary, images with Requirement Row rules, image tags, placeholders, scripts, stat effect rows, trait effect rows, slot reference and slot size (default 1), Stackable, Consumable, charges (absent or a maximum count), Bound, equip Requirement Rows, value and unit (a stat reference or free text).
- **Stat effect row**: a stat id resolved on the owner (Q50), a facet (value, min, max, regen; Q51), timing, duration (After Consumed only: story-clock time or Permanent), amount, and an **op** field that holds `add` only in this effort. It follows the trait `StatChange` shape where it can, without the Global target.
- **Trait effect row**: a trait, a timing and a duration. Item grants are an extra active source (Q52).
- **Slot list**: on the world. Each slot has a name and a capacity (default 1).
- **Placement**: its own record list. Fields: where (a location or an owner), quantity, initial visibility, and a **source** that is a tagged union with one kind, `item`, in this effort.
- **Item Condition**: a new `TraitRequirement` kind: an item, owned or equipped, an optional owner, and the Not flag.
- **Script homes and timings**: items become a script home; `ScriptTiming` gains the five item timings.
- Stable ids from `randomUUID()` for items, slots and placements.

### Runtime shape (save)

- **Item Copy**: an id, the item id (or a runtime item id), a location as a tagged union (`you` / `entity` / `location`; `you` resolves to the played Persona, Q54), a quantity, an equipped slot and an equip order, a visibility **enum** (`visible` / `hidden`), and an open **per-copy state** field. Charges live in per-copy state in this effort.
- **Runtime item**: a name and a short description, created by the pass, Stackable and Consumable, no slot, no effects (Q56).
- **Applied-effect ledger**: what each While Equipped or While Owned value effect actually moved, following the `appliedTraitValues` pattern. Bound facets are derived, not ledgered (Q51).
- **Timed effects**: per owner, with the story-clock end time. They expire in the turn commit after the clock advances.
- **First Obtain record**: which owners already got each item's On First Obtain effects.
- Item placeholder values join the session's resolved placeholder values, one per item.
- Inventory state lives in `GameState`, so a re-roll restores it with the page snapshot.

### The Inventory module

- One pure module owns inventory state changes. Its main entry takes the state, a list of operations, the world, the source of the operations (pass, panel or script) and an injected id maker, as `computeTurnCommit` injects its ids. It returns the new state, the stat and trait changes to apply, the item script events to fire, and diagnostics.
- The entry is the **one validator**. It enforces presence (Q62), Bound for the panel only (Q58), slot existence, capacity with swap-out, slot size, equip requirements (ignoring the item's own effects, Q49), charges, Consumable, and the name match for pass names (Q56).
- Effect apply and reverse live in the module, so that the auto-unequip, timed-effect expiry and orphan cleanup (Q60) share one path. Cascades settle to a fixed point under a cap (Q66).
- A **seed** entry turns placements into Item Copies for a new game (Q59). It is the only place that reads placements, so that a later loot-table source plugs in there. The Sandbox Snapshot and the Test Bench's turn-one snapshot carry seeded Item Copies.
- The module owns no AI and no UI.

### The Inventory pass

- A new post-narration pass, due when the world has items or the game has Item Copies (Q37). It joins the parallel batch when Concurrent Turn Requests is on.
- Its request lists the present owners' Item Copies and the location's Item Copies, hidden ones marked hidden, and asks for operations through a JSON schema.
- On a schema refusal it uses the shared refusal handling and remembered per-endpoint text mode, with its own text prompt, text line format and parser.
- New prompt-preset keys for the pass's system and user prompts, a `promptSamplers` entry that pins temperature and penalty, and per-prompt Native Reasoning and endpoint routing like every other pass.
- The parsed operations go to the Inventory module with the source `pass`. Diagnostics go to the existing diagnostics channel.
- Commit order: inventory changes, then stat-pass deltas (Q53).

### Stat pass change

- The stat pass prompt gains a line listing the turn's item effects as already applied (Q53). It ships with probe numbers.

### Narration context

- The inventory block is a prompt chip: each present owner's equipped items with their AI Summary, carried items by name, and the location's items, with hidden ones marked. Built-in presets gain the chip. User presets are never migrated silently; their authors add the chip from the picker. The block follows the prompt-writing guide: positive contract, no example values.
- A read-only `get_item` lookup is a candidate catalog Tool. It is not required by this effort.

### Requirement Rows

- The gate evaluator gets a new input carrying each owner's Item Copies. Each `TraitRequirement` switch site gains the `item` case. On an item, an owner-less Condition means the Item Copy's owner (Q67).

### Scripts

- The five item timings fire from the Inventory module's script events. Seeding fires none (Q59).
- The script surface gains inventory reads and an inventory write kind in `WorldWrites` (gain, lose, transfer, equip, unequip, consume, reveal, set charges). Script writes go through the Inventory module with the source `script`.
- A panel action between turns runs item scripts against the current committed state.

### Player UI

- An **Inventory** game panel tab: slots with their equipped items, carried items, a **Here** section for visible location items, and timed effects with time left.
- Buttons: Equip, Unequip, Use (Consumable or charges), Drop and Give (present entities only). Each calls the Inventory module with the source `panel` and applies at once. All buttons are off while a turn runs (Q61). Bound Item Copies show Drop and Give as unavailable.
- The stat panel names an item as the source of a change, except for hidden Item Copies (Q63).
- The entity panel shows that entity's equipped items.
- A World Editor Items list and editor, reusing the entity field editors after a light generalization, and a slot list editor in world settings. Placements appear on the location, on each entity and on the persona.
- Every new screen and modal gets a dev-route entry.

### The seven hooks (Q45)

1. A per-copy state field, so that durability, enchantment and rolled affixes need no new Item Copy shape.
2. A tagged-union location for Item Copies, so that containers add an `item` kind.
3. A visibility enum, so that `unidentified` adds cleanly.
4. One operation validator for every writer, so that weight limits and similar rules become one check.
5. An effect-row op field, so that percentage effects add an op.
6. Slot size, so that two-handed items work.
7. A re-runnable seed with a tagged placement source, so that loot tables and restocking add a source kind.

## Testing Decisions

- Tests check external behavior through the module entries, never internal helpers. A guard test must fail when its bug returns (`test-bar` skill).
- **Inventory module** (new seam): operations in, state and changes out. Covers validation and skips, presence, swap-out by equip order, capacity and slot size, stack splitting, equip requirements and Q49, auto-unequip and cascade caps, Bound by source, Consumable and charges at zero, the four timings and facets, exact reversal after clamping, extra-source trait grants, the once-per-owner rule, dose refresh, timed-effect expiry, reveal and hidden-row merging, runtime items and name matching, orphan cleanup, script event depth, and the seed. Prior art: `traitRuntime` tests, `seedRule` tests, `sandboxSnapshot` tests.
- **Turn pipeline** (existing seam): `runTurn` and `computeTurnCommit` tests with a fake transport. The pass is due only when items exist, joins the parallel batch, falls back to text on a schema refusal, and commits before stat deltas. Prior art: `turnRunner.test.ts`, `computeTurnCommit.test.ts`.
- **Pass prompt and parser** (existing seam style): request building, schema parsing and text-line parsing, as in `statRequest.test.ts`.
- **Item Condition** (existing seam): `traitGates` tests, as in `traitGates.stat.test.ts`.
- **Probes**: the pass prompt, the narration inventory chip and the stat pass's item-effects line ship with probe numbers on the cloud default and Cydonia, with in-batch controls. Probes decide Q19's event line and confirm Q53.

## Out of Scope

- Loot tables (a placement source that rolls a weighted list at world start). The Q44 seed is its hook.
- Containers (Q29). The tagged-union location is its hook.
- Unidentified items. The visibility enum is its hook.
- Durability, enchanting and rolled affixes. Per-copy state is their hook.
- Percentage effects. The op field is its hook.
- Weight and encumbrance. The validator is its hook.
- Restocking merchants and respawning loot. The re-runnable seed is its hook.
- Buying and selling as a feature. The value unit is its hook.
- A quest system. Until one exists, Bound is a player-only lock (Q58).
- Crafting and recipes.
- Equipment shown on the 3D model.
- Ammunition used by another item.
- Narrator Tools that write inventory.
- Per-entity slot lists.
- Global Stat targets on effect rows (Q50).

## Further Notes

- ⚠️ **Export shape.** World `.json` gains items, the slot list, placements, the `item` Requirement Condition kind, item script homes and the five item `ScriptTiming` values. Save `.json` gains Item Copies, runtime items, the applied-effect ledger, timed effects and First Obtain records. Settings export gains the Inventory pass prompt-preset keys.
- The Inventory tab, slot display and timed-effect rows are a new visual pattern. They need the user's approval through the `design-system` flow before they are built.
- CONTEXT.md needs entries for Item, Item Copy, Placement, Slot, Inventory pass, Item Condition and the five item timings. The Owner entry gains items; the script-home and Timing entries gain Items. Its curse example already reads "an Automatic trait that requires the cursed item".
- The stat pass changes only by Q53's prompt line (R1).
