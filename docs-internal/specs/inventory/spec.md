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
| Q70 | (ticket 01) The slot list edits in a **Slots** section in the Overview's left column, below Starts On, beside the other world play settings. It uses existing list-row parts. No new pinned-row pattern |
| Q71 | (ticket 01) The Items list is flat with drag to reorder, no folders, like Tools |
| Q72 | (ticket 01) Items are a scoped placeholder home `{kind:'item'}` beside entity and dictionary, with an item Placeholders tab and `Item › Name` labels. Placeholders travel on duplicate and delete |
| Q73 | (ticket 01) The item rule host shows rows and targets like an entity host. The Persona is an explicit owner choice; an owner-less Condition reads the Item Copy's owner (Q67). State dots stay neutral until 02 and 10 supply copies |
| Q74 | (ticket 01) 01 defines the effect, timing, duration and placement types in full, so 04, 05 and 06 add only editors and runtime. Durations are Permanent or a story-clock length stored in the clock's own elapsed unit |
| Q75 | (ticket 01) The value unit's stat picker lists Global Stats and the Persona's stats, per Q32's "a global or player stat" |
| Q76 | (ticket 01) Setting charges turns Stackable off and disables it. Clearing charges leaves Stackable off for the author to turn back on |
| Q77 | (ticket 01) Slot Size shows only when a slot is picked, from 1 to that slot's capacity |
| Q78 | (ticket 01) Deleting a slot that items use asks for confirmation with the count, then clears those items' slot |
| Q79 | (ticket 01) The Items tab shows in Simple and Advanced. AI Summary and item Placeholders are Advanced only, as on entities |
| Q80 | (ticket 01) Item editor tabs: Profile, Descriptions, Properties, Placeholders. 04, 05 and 11 add Effects, Requirements and Scripts |
| Q81 | (ticket 02) Placements on `you` edit in a **Persona Items** section in the Overview's left column, below Slots, and land on whoever is played. A played Persona-marked entity's own placements also land on `you` (Q54); so do the Custom Persona entity's under None and a library persona |
| Q82 | (ticket 02) The seed skips placements on a persona-only entity that is not played, and on the Custom Persona entity when a world persona is played |
| Q83 | (ticket 02) World entities and locations get an **Items** tab in Simple and Advanced: item, Quantity, Hidden, remove, from existing list-row parts. The library entity editor gets none. Deleting an entity or location drops its placements |
| Q84 | (ticket 02) An Item Copy's item is a tagged union: an authored item or a runtime item. 09 adds runtime items and their orphan rule |
| Q85 | (ticket 02) The orphan drop (Q60) runs on the current state and every history snapshot. Its diagnostic is one system log line per load with the count; no toast |
| Q86 | (ticket 02) The seed stacks by item, owner and visibility. A non-stackable placement of quantity N makes N Item Copies of 1. A charged Item Copy starts full. Seeded Item Copies start unequipped |
| Q87 | (ticket 02) 02 seeds without effects. 04 adds effect apply to the seed (Q59) and effect reversal to the orphan drop |
| Q88 | (ticket 10) An owner-less Item Condition on a global trait or a location image rule reads the played Persona; on an entity-owned trait it reads that entity, as stat and trait Conditions do |
| Q89 | (ticket 10) On an item rule host, an owner-less Condition of any kind never holds while the Item Copy lies at a location, under Not too, as an unresolved Condition does today |
| Q90 | (ticket 10) An entity owner the Persona plays reads the `you` Item Copies, through the played-entity ids |
| Q91 | (ticket 10) Owned means any Item Copy of the item at the owner with quantity above 0, carried or equipped, visible or hidden. Equipped means such a copy is equipped. Not flips the result. Runtime items never match. Reads go through `copiesAt` only |
| Q92 | (ticket 03, user ruling) Drop and Give on a stack ask how many, defaulting to 1, with an All choice, using an existing number input |
| Q93 | (ticket 03) The panel in 03 has slots and carried items with Equip, Unequip, Drop and Give. Use and timed effects are 06; the Here section and an entity's equipped items (story 81) are 07 |
| Q94 | (ticket 03) A stackable Item Copy that lands beside a carried stack of the same item and visibility merges into it. Equipped Item Copies never merge |
| Q95 | (ticket 03) Dropping or giving an equipped Item Copy unequips it first |
| Q96 | (ticket 03) Swap-out unequips the items equipped longest, one at a time, until the new item's slot size fits |
| Q97 | (ticket 03) Operations address Item Copies by id: gain names an item, quantity and target; lose names a copy and optional quantity; transfer names a copy and target. 09 adds the name form for the pass |
| Q98 | (ticket 08) The inventory chip is `<INVENTORY>` with the shared Format axis only, no Scope or Content axes |
| Q99 | (ticket 08) The chip is offered to every prompt through the context variables, like Entities. Built-in presets add it to narration only |
| Q100 | (ticket 08) Built-in narration places it after the current-location entities block, headed "Items Here": the played owner first, labeled as the existing chips label the player, then present entities in roster order, then a "Lying here" group |
| Q101 | (ticket 08) Narration reads presence from the chip scene, after the auto location pass. In Suggest mode the move lands after narration, so narration sees the pre-move location. That is Q62 for narration |
| Q102 | (ticket 08) An equipped item with no AI Summary falls back to its AI Description, as Summary content does elsewhere |
| Q103 | (ticket 08) 08 renders authored items only and skips runtime Item Copies. 09 adds runtime names to the chip |
| Q104 | (ticket 08) The hidden-item contract lives in the built-in preset's pre-text as a positive statement, not in the renderer, so authors can reword it |
| Q105 | (ticket 08) 08 records the Q19 probe numbers only. If the event line helps, the spec session adds it to ticket 09 |
| Q106 | (ticket 04, user ruling) The player sees an item's stat change as a turn log line, "Iron Sword: Strength +2", when an effect applies or reverses. A hidden Item Copy shows as "An item". No stat-row tooltip |
| Q107 | (ticket 04) A `you` Item Copy's stat effects resolve on the played entity's own stats only. No Global Stat fallback, for `you` either (Q50) |
| Q108 | (ticket 04) The editor's stat picker lists each owner's stats under headings, deduped by id, with no Global Stats section |
| Q109 | (ticket 04) While Equipped applies once per equipped Item Copy: two equipped rings apply twice. Q11's once-per-owner covers While Owned only |
| Q110 | (ticket 04) A max raise on a value resting at its cap carries the value up, as trait max raises do. That carry goes on the value ledger and reverses exactly |
| Q111 | (ticket 04) The orphan drop reverses While Equipped and While Owned value changes only. On First Obtain changes and their record stay |
| Q112 | (ticket 07, user ruling) A hidden equipped Item Copy fills its slot unseen: the panel and its "n of m" count show visible Item Copies only, but it takes capacity, and swap-out can unequip it by equip order. That unequip logs "An item" and the copy stays hidden and carried |
| Q113 | (ticket 07, user ruling) Inventory panel rows (slots, carried, Here) show a small item thumbnail picked through `itemRuleStates`, using the existing thumbnail token. Rows without an image show none |
| Q114 | (ticket 07) Reveal addresses an Item Copy by id with an optional quantity; a partial reveal splits a row off. A revealed carried copy merges per Q94; a revealed equipped copy stays equipped. Reveal of an owned copy needs presence. The panel never sends it |
| Q115 | (ticket 07) A locked trait's gate line reads an Item Condition matched only by hidden Item Copies as if no copy exists. It names the item only as the authored rule does |
| Q116 | (ticket 07) An entity's visible equipped Item Copies show as an Equipped section on its existing overview tab, built from the 03 row parts. No new pattern |
| Q117 | (ticket 05) A trait grant reaches the owner's own tree only: the played entity's for `you`, the entity's (owned or linked) otherwise. No global-scope traits, matching Q39 and Q107. A missing trait skips the row with a diagnostic. The picker lists each owner's traits under headings, deduped, with no world section |
| Q118 | (ticket 05) The trait picker excludes both Always On and Hidden mode traits |
| Q119 | (ticket 05) A granted trait's own gate still applies. While its gate fails it stays off, and it returns once the gate holds again while the grant holds. It never joins the cascade-off list |
| Q120 | (ticket 05) The player cannot switch off a trait while a grant holds it. Grants neither retire exclusive siblings nor get retired by them |
| Q121 | (ticket 05) An On First Obtain trait row is a permanent grant source in the First Obtain record. It ignores Pick Count and siblings and never reverses |
| Q122 | (ticket 05) Q49's "own effects" means every While Owned and While Equipped effect, stat and trait, of the same item at that owner, across all its Item Copies. On First Obtain changes count as base |
| Q123 | (ticket 05) One inventory settle (effects, grants, requirement re-check, trait gates, to a fixed point) runs wherever item effects settle today and in the turn commit after stat-pass deltas and stat code. 05 owns the turn-commit wiring |
| Q124 | (ticket 05) The settle cap is 10 passes. Auto-unequip never re-equips, so a true cycle cannot form; the test drives a chain longer than an injected small cap |
| Q125 | (ticket 05) Grant switches log like code switches with a source, "(by Cursed Ring)" or "(by An item)"; Hidden traits log nothing. When a Trait Switches scripts fire on grant changes. Auto-unequip and refused equips log their reason |

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
- **Q19 settled by probe (ticket 08): no event line.** Narration handles a panel change from state alone. `inventory-chip-probe.cli.ts`, case `gave`: the player gave away a knife in the panel, then reaches for it. Narration that still hands the player the knife: cloud (12 runs per arm) no chip 12/12, chip 6/12, chip + event line 6/12 (Δ 0.00 [−0.40, 0.40]); Cydonia (3 per arm) 2/3, 2/3, 1/3. The chip carries the gain; the line adds nothing measurable.
- **Chip probe numbers (ticket 08), no chip → chip.** Names at least two carried items: cloud 0/12 → 5/12 and 0/12 → 6/12 in two batches, Cydonia 1/3 → 3/3. Uses an equipped item's AI Summary: cloud 0/12 → 6/12, Cydonia 0/3 → 0/3. Hidden item named unprompted (carry, look, wait, light, odette): cloud 0/60 → 0/60, Cydonia 1/15 → 0/15. Search finds the hidden item: cloud 0/12 → 1/12, Cydonia 0/3 → 3/3. On the cloud model, reveal on search rests on the Inventory pass and scripts, not the narrator.

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
- Item images use the `character` tag guidance for now (ticket 01). An item image subject is a prompt change and needs probe numbers first.
- The stat pass changes only by Q53's prompt line (R1).
