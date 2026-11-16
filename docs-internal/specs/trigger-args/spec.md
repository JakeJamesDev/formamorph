# Spec: Trigger Args and Item Instances

Status: ready-for-agent
Spec session: trigger-args — spec

Give a script the context of what fired its run: an `args` global, as World Tool scripts already have. Item timings learn who caused the event, where the item came from or went, and whether it was a purchase. When a Trait Switches learns who switched the trait. The item event's subject becomes the `instance` global, and "Item Copy" becomes **Item Instance** everywhere: glossary, docs, UI copy, the script surface, code and save keys.

## Problem Statement

An item script can't tell how an item arrived. A When Gained script sees only the timing, the quantity and the copy, and the copy shows its current owner, not its source. The Sunmeadow Town world gives Affection through a When Gained script on 28 gift items. A cast member who buys a gift at a shop, or gets one from another cast member, gains the same Affection as one the player gave it to. The world can't skip those gains.

The same gap exists elsewhere. A When Lost script can't see where the item went. No item script can tell the Inventory pass from the player's Inventory panel, or from another script. A When a Trait Switches script can't tell a player toggle from a script write or a gate.

The shipped surface also hangs the event on `self` (`self.event`), and `self` is the item, the kind. That reads as though the item owns an event, which is not how the feature works.

## Solution

Every script gets an `args` global: the side information the thing that fired the run passed. A World Tool's `args` keeps its meaning (the AI's parameter values). A run that nothing fires reads an empty, frozen `args`.

The **subject** of a run gets its own global, and `args` holds only side information (Q2). `trait` (When a Trait Switches) and `narration` (During AI Output) already follow this rule. Item timings gain `instance`, the Item Instance the event happened to. `self` stays the item.

Item timings read:

| Field | Timings | Value |
|---|---|---|
| `args.by` | all five | `'story'` (the Inventory pass), `'player'` (the Inventory panel), `'script'` (a script's inventory write, World Tools included) or `'rule'` (an automatic change: a Becomes result, or an unequip forced by a full slot, a Body change or a requirement) |
| `args.from` | When Gained | The entity or location entry the instance came from; `null` when it is new |
| `args.to` | When Lost | The entity or location entry the instance went to; `null` when it is destroyed |
| `args.purchase` | When Gained, When Lost | `{ price, currency }` on both sides of a buy; `null` otherwise |
| `args.quantity` | all five | How many the event moved |
| `args.target` | When Used | The Item Instance a use acted on; `null` when none or gone |

When a Trait Switches reads `args.by`: `'player'`, `'script'` or `'rule'`.

A Sunmeadow gift script then reads: `if (args.from !== persona || args.purchase) return;`.

Shipped scripts migrate on world load, with no alias (Q6). `self.event.copy` becomes `instance`, `self.event.timing` becomes the script's own timing as a string literal, and the other `self.event.X` fields become `args.X`. `.copies` becomes `.instances`. Saves migrate their renamed keys.

## Rulings

Settled in the grill on 2026-11-14. A ruling reopens on new evidence, never on a new opinion.

| # | Ruling |
|---|---|
| Q1 | One top-level `args` global carries the trigger context, as World Tool scripts already read the AI's values from `args`. `self.event` goes. |
| Q2 | The subject of a run gets its own global; `args` holds side information. `trait` and `narration` stay as they are. |
| Q3 | Item timings' subject is the `instance` global: the Item Instance entry the event happened to. `self` stays the item. Once the instance is gone, `instance` reads it as it was before the event, as `self.event.copy` does today. |
| Q4 | `args` is always defined. A run that nothing fires (Before the AI, After the AI, At Game Start, During AI Output) reads an empty, frozen object. |
| Q5 | `args.by` on item timings is `'story'`, `'player'`, `'script'` or `'rule'`, on all five timings. |
| Q6 | `self.event` shipped in v3.6.0. Script text migrates on world load, with no alias: `self.event.copy` → `instance`, `self.event.timing` → the script's own timing as a string literal (for example `"gained"`), every other `self.event.X` → `args.X`. |
| Q7 | `args.from` (When Gained) and `args.to` (When Lost) hold the entity entry or the location entry of the other side, or `null` when the instance is new or destroyed. The played persona is the `persona` entry, so `args.from === persona` means the player gave it. |
| Q8 | `args.by` names the direct writer. An inventory write a script makes reads `'script'`, even when the Inventory pass started the chain. |
| Q9 | `args.purchase` is `{ price, currency }` on both sides of a buy (When Lost on the seller's side when a seller's instance moved, and When Gained), and `null` otherwise. `price` is in the Currency's base unit and `currency` is its name. Both are `null` for a buy the story didn't price. Only the Inventory pass buys; scripts can't. |
| Q10 | No reason field. A `'rule'` event doesn't say which rule. |
| Q11 | Test Code and the Test Bench give item timings a fixed sample: one instance at the persona, quantity 1, `by: 'story'`, `from` and `to` `null`, no purchase, no target. |
| Q12 | When a Trait Switches gets `args.by`: `'player'` for the trait the player toggled, `'script'` for a trait a script wrote (World Tools included), `'rule'` for everything else (a gate, an exclusive sibling, a cascade-off, a persona or Option change). |
| Q13 | `args.timing` doesn't exist. A script's own Timing tells it which one ran. |
| Q14 | `args.target` stays side information on When Used. |
| Q15 | "Item Copy" becomes **Item Instance** in every layer: glossary, docs, UI copy, the script surface, code identifiers and save keys. |
| Q16 | The script surface renames with it: `items[x].copies` → `items[x].instances`, and every hover card and guide line that says copy. Script text migrates on load with Q6. |
| Q17 | Save keys that name an Item Copy rename, with a save migration. This is a save export-shape change. |
| Q18 | In scope: hover cards and the tree, the Scripts guide and reference, the built-in templates (with a new gift-style template), and the Formaquestion help vectors. |
| Q19 | The bundled Emberwatch world's source is rewritten to the new names. The Sunmeadow gift script update stays with the Sunmeadow spec. |
| Q20 | Tests go through four existing seams: the inventory operations into the item runs, the Inventory pass, the switch runs, and the world and save migration. |

## User Stories

1. As a world author, I want a When Gained script to know who the item came from, so that a gift from the player raises Affection and a shop purchase doesn't.
2. As a world author, I want to compare `args.from` with `persona`, so that one line tells me the player gave the item.
3. As a world author, I want `args.from` to be `null` for a new item, so that a reward the story made apart from any giver is easy to spot.
4. As a world author, I want a pickup from the ground to read the location as `args.from`, so that a pickup and a gift are told apart.
5. As a world author, I want a When Lost script to know where the item went, so that I can react to a gift the player gave away.
6. As a world author, I want `args.to` to be `null` when the item is destroyed, so that a lost item and a given item are told apart.
7. As a world author, I want `args.purchase` on a bought item, so that a gift script can skip purchases.
8. As a world author, I want the price and Currency of a purchase, so that a script can react to an expensive buy.
9. As a world author, I want the seller's When Lost to carry the purchase too, so that a merchant's script can count its sales.
10. As a world author, I want a sale by the player to carry the purchase, so that selling to a character never counts as a gift.
11. As a world author, I want `args.by` to say whether the story, the player's panel, a script or a rule caused the event, so that my script can trust or skip each cause.
12. As a world author, I want a script's own grant to read `'script'`, so that a gift box that opens into a berry doesn't count as a second gift.
13. As a world author, I want a Becomes result to read `'rule'`, so that an empty bottle isn't treated as a new gift.
14. As a world author, I want a forced unequip to read `'rule'`, so that a curse script can tell the player's choice from a full slot.
15. As a world author, I want an equip from the Inventory panel to read `'player'`, so that I can react only to the player's own choices.
16. As a world author, I want `args.quantity` on every item timing, so that a stack gain counts every piece.
17. As a world author, I want `args.target` on When Used, so that oil poured into a lantern can light that lantern.
18. As a world author, I want the instance an event happened to in its own `instance` global, so that `self` clearly stays the item.
19. As a world author, I want `instance` to read the gone instance as it was, so that a When Lost script can still read the quantity and State.
20. As a world author, I want `instance.transfer(persona)` and the other verbs to work, so that a script can act on the instance the event happened to.
21. As a world author, I want a When a Trait Switches script to know whether the player toggled the trait, so that a manual toggle can cost something and a gate switch doesn't.
22. As a world author, I want a script's trait write to read `'script'`, so that two scripts don't fight over one trait.
23. As a world author, I want an exclusive sibling turned off by a toggle to read `'rule'`, so that only the trait the player picked reads `'player'`.
24. As a world author, I want `args` defined in every timing, so that shared code that reads `args.by` never throws.
25. As a world author, I want a World Tool's `args` to keep its meaning, so that my Tools don't change.
26. As a world author, I want my shipped `self.event` scripts to keep working after the update, so that I don't rewrite them by hand.
27. As a world author, I want `self.event.timing` rewritten to my script's own timing, so that the migrated script behaves as before.
28. As a world author, I want `items[x].copies` scripts to migrate to `.instances`, so that the rename doesn't break my world.
29. As a world author, I want the hover cards to describe `args`, `instance` and each field per timing, so that I learn the surface in the editor.
30. As a world author, I want the variable tree to list `args` fields for the box's timing only, so that I don't reach for a field that is always empty there.
31. As a world author, I want Test Code to run an item script with a sample `args` and `instance`, so that I can test it without playing.
32. As a world author, I want a gift-style template, so that I can start from working code that skips purchases and non-player sources.
33. As a world author, I want the Scripts guide to explain `args` and `instance` with examples, so that I know when each field is set.
34. As a world author, I want Formaquestion to answer with `args` and `instance`, so that its code help matches the current surface.
35. As a world author, I want the editor and docs to say Item Instance, so that the word matches what scripts call it.
36. As a player, I want my saves to load after the update with every item where it was, so that the rename costs me nothing.
37. As a player, I want the Inventory panel and its messages to say Item Instance where they named a copy, so that the app speaks one language.
38. As a player of Emberwatch, I want its item scripts to keep working, so that the bundled world plays as before.
39. As the Sunmeadow world author, I want a gift script that skips shop purchases and cast-to-cast gifts, so that Affection rises only for the player's gifts.
40. As a developer, I want one name, Item Instance, in code, glossary and saves, so that no translation layer is left between them.
41. As a developer, I want each event to carry its cause from the point the write happens, so that `by` never has to be guessed from a diff.

## Implementation Decisions

**Event cause (Q5, Q8).** The inventory operations already know who sent a list (`pass`, `panel`, `script`). Each item event carries its cause. Events the operations make on their own (a Becomes result) and the settle's forced unequips read `'rule'`. The script chain's own inventory writes read `'script'` at every depth.

**Parties (Q7).** A transfer knows both sides when it happens. Its When Lost event records the destination and its When Gained event records the source. A gain records no source; a lose records no destination. The Inventory pass's location pickups and buys turn into transfers where an instance moved, so they carry the location or the seller. A pass gain with no instance to move stays a gain with `from` `null`. The sandbox resolves a side to the entity or location entry by id. The persona resolves to `persona`.

**Purchase (Q9).** A buy settles in the pass's money step as a transfer or a gain plus a payment. The purchase rides on the inventory operations the buy makes, so the events those operations fire carry it. A purchase is `{ price, currency }`, `null` fields when the story stated no price. This adds an optional field to the inventory operation. That operation also appears in a save's saved script writes, but scripts can't buy, so a saved operation never carries it.

**Trait switch cause (Q12).** The switch diff carries no cause today and can mix several causes. The cause is attributed where it is known: the player toggle names the trait it switched; a script's trait writes name theirs. A switch event whose trait is the one toggled or written reads that cause. Every other event in the same diff (exclusive siblings, cascade-offs, gate settles) reads `'rule'`. Switches from the end-of-turn settle, an Option change, a persona change, an item commit and the Inventory pass read `'rule'`.

**Sandbox surface (Q1–Q4, Q13, Q14).** One `args` global, frozen and read-only, built per run from the run's trigger: the World Tool call's values, the item event's side fields, the switch's cause, or nothing. `instance` exists only in item timings. Item timing fields that don't apply to a timing are absent (When Gained has no `to`). This widens the sandbox by these read-only values, settled by this grill. The prelude that defines `self.event` goes. `self` takes the item entry only.

**Migration (Q6, Q16, Q17).** `migrateWorld` gains one step for script text, in every script home (stats, traits, world, items, Blueprints, World Tools): the `self.event` rewrites, `.copies` → `.instances` on item entries. The rewrite is token-bounded, rewrites exact forms only, and leaves the rest. A save migration renames the keys that name an Item Copy: the snapshot list, the copy id fields in saved inventory operations, and any ledger key that holds one. The script-text step runs before the version short-circuit, beside the existing script-text rewrites, because worlds stamped with the current version carry the old forms. It is idempotent. An unequip caused by losing or giving away an equipped item keeps its writer's `by` (Q8); only a full slot, a Body change or a requirement reads `'rule'`. A side with no name key reads `null`. `purchase` is an object on every buy. A buy that moves no money (a Name Only Currency, or a Value of 0) reads both fields `null`, the same as an unpriced buy (user ruling). The gift template's guard is `args.from !== persona || args.purchase || args.by === 'script'` (user ruling): a script that moves the player's item is not a gift. Item boxes get a template kind keyed by timing. The Test Bench runs no item scripts, so Q11's item sample applies to Test Code only. The switch sample reads `by: 'player'` in Test Code and the Test Bench; every real switch run reads one of the three values, `'rule'` when no writer applies. The save step in `migrateSave` is also ungated: presence-based and idempotent, and a record holding both keys keeps the new one.

**Rename (Q15).** Types, functions, fields, tests and fixtures say Item Instance, `instance`, `instanceId`. The glossary entry is renamed and its `_Avoid_` line lists "Item Copy". UI copy follows the Writing Guide. Ticket 01 renames everything except what a save writes (`itemCopies`, `copyId` on persisted operations) and what the sandbox reads by name. Those wait for tickets 02 and 03. Other efforts' specs and released changelog entries stay as history. Placeholder, Blueprint and Supporter Copy and the clipboard "copy" are not Item Instances. Ticket 03 rebuilds the help vectors.

**Editor (Q11, Q18).** The surface entries gain `args` (per timing) and `instance`; the tree shows a box's own timing's fields. The Test Code samples gain an item event sample beside the switched-trait sample. The Templates menu gains a gift-style template for When Gained. The help vectors are rebuilt.

## Testing Decisions

Good tests run a real script through the real QuickJS executor and assert what the script observed or wrote. They never assert the shape of an internal event record.

- **Item runs** (prior art: `statCodeTurn.itemScripts.test.ts`, `statCodeTurn.inventoryChain.test.ts`): each `by` value; `from` for a transfer from the persona, from an entity, from a location, and `null` for a gain; `to` for a transfer and `null` for a lose; the nested grant reads `'script'`; `instance` before and after the instance is gone; `quantity`; `target`; fields absent on timings they don't apply to.
- **Inventory pass** (prior art: `pass.buy.test.ts`, `pass.test.ts`): a priced buy and an unpriced buy carry `purchase` on both sides; a buy from location stock reads the location; a sale by the player reads `from === persona` with `purchase`; a pass transfer reads `'story'`.
- **Switch runs** (prior art: `statCodeTurn.nestedSwitch.test.ts`, `statCodeTurn.chain.test.ts`): a toggled trait reads `'player'`, its exclusive sibling `'rule'`; a script's switch reads `'script'`, its cascade `'rule'`.
- **Migration** (prior art: the version migration tests): every rewrite form; text that only resembles them is left alone; idempotence; a save's renamed keys load with every instance in place.
- Each new guard is shown to bite: drop the cause, the side or the purchase, and the test fails.
- **Sunmeadow-shaped check:** a gift script with the Solution's guard line raises Affection for the player's gift only, and not for a shop buy, a cast-to-cast transfer or a script grant.

## Out of Scope

- A reason on `'rule'` events (Q10).
- `args` for the Before the AI, After the AI, At Game Start and During AI Output timings beyond the empty object.
- Switch runs for load, the opening and undo, which fire none today.
- Script buys.
- Updating the Sunmeadow world's gift script (Q19). Its own spec picks it up once this lands.

## Further Notes

- ⚠️ Export shape: the save shape changes (Q17), and world script text is rewritten on load (Q6). The script-text rewrite runs on every load, ungated.
- The rename touches about a thousand code lines. It should land first and alone, so the other tickets build on the new names.
- Related specs: `docs-internal/specs/inventory/`, `docs-internal/specs/item-use-and-identity/`, `docs-internal/specs/script-run-order/`, `docs-internal/specs/currency/`.
