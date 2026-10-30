# Spec: Item Use and Identity

Status: ready-for-agent
Spec session: item-use-and-identity — spec

## Problem Statement

A world author can make an item that is used up, or one with charges. Nothing else can happen when an item is used. A potion cannot leave an empty bottle behind for the world to use. A letter cannot be opened and kept. A horn cannot be blown again and again. An item has no state, so the story cannot record that a lantern is lit or a cloak is soaked. Nor can an author hide what an item really is until the player finds out.

The Inventory pass shows the gap in play. On cloud, when the narration breaks a carried letter's seal, the pass sends `reveal` and then `lose`, and the letter disappears (36 of 48 runs). Rereading an already-open letter gives no operations (45 of 48). The pass has no operation for an item that changes, so it reaches for the nearest one.

## Solution

**Use** is the one action. An item can be used when it has a Uses count, On Use effects or an On Use script. Two settings replace Consumable and Charges:

- **Uses**: how many times a copy can be used before it is empty. Blank means unlimited. 1 means single-use.
- **When Empty**: what happens to the copy when its Uses run out. **Stays** keeps it at zero, ready for a recharge. **Gone** removes it. **Becomes** turns it into another authored item. **Changes State** sets a new State word.

| Item | Uses | When Empty |
|---|---|---|
| Potion that leaves a bottle | 1 | Becomes Empty Bottle |
| Potion with three gulps | 3 | Gone |
| Wand | 3 | Stays |
| Letter | 1 | Changes State "opened" |
| Horn | blank | — |

Every Item Copy has a **State**: a short free-text word, like an entity's Type. The Item holds the starting State. The story, through the Inventory pass, and scripts can change a copy's State. The player and the AI both see it.

An item can be **unidentified**. The Item gets an **Unidentified Name** and an **Unidentified Description**. When either one is filled, every copy starts unidentified, and a blank field shows the normal value. The player sees the unidentified face everywhere, the log included. The narrator sees both faces, with the true one marked unknown to the player. Its effects still apply.

The Inventory pass changes in three ways. `consume` becomes `use`, `change` is new and sets a copy's State, and `reveal` now also identifies an unidentified copy.

## Rulings

Settled with the user on 2026-10-30, from a cloud play test and the re-gain probe (commit e3efd8d1c).

| # | Ruling |
|---|---|
| Q1 | State is free text, like an entity's Type. The Item holds the starting State; each Item Copy holds its own current State. Copies with different States never stack |
| Q2 | Unidentified items are in this effort, beside State. This uses the inventory spec's Unidentified hook (inventory Q45) |
| Q3 | The Inventory pass and scripts change State. The Inventory tab does not |
| Q4 | Two pass operations stay apart: `reveal` and a state operation. No single word fits both "comes into view" and "changes state" |
| Q5 | Consumable becomes an outcome setting. Any item can be used, and the author picks what remains |
| Q6 | The pass's `consume` becomes `use`. The item's When Empty decides what remains |
| Q7 | A `change` operation sets a copy's State, for a change that is not a use (a soaked cloak) |
| Q8 | `reveal` covers both jobs: a hidden copy comes into view, and an unidentified copy shows its true face. The validator picks the job from the copy |
| Q9 | For a runtime item, the pass decides what a use leaves |
| Q10 | `use` carries an `after` field, `kept` or `used up`. Only runtime items read it; an authored item's When Empty always wins |
| Q11 | Becomes points only at an authored item, never free text |
| Q12 | Only the used copy Becomes the other item. The result is carried, not equipped, by the same owner |
| Q13 | The player sees State beside the name in the Inventory tab. The AI sees it beside the name in Items Here |
| Q14 | The narrator sees both faces of an unidentified item: the unidentified face as what the player sees, and the true face marked unknown to the player |
| Q15 | Unidentified is its own Item Copy flag, apart from visibility. A copy can be hidden and unidentified |
| Q16 | An item with an Unidentified Name or Unidentified Description starts every copy unidentified. A blank field shows the normal value |
| Q17 | An unidentified item's effects apply. Every player-facing line, the log included, uses the unidentified face |
| Q18 | Unidentified and identified copies never stack. A revealed copy merges into an identified stack in the same place |
| Q19 | Formaquestion's player view shows only the unidentified face. Scripts read both faces and the unidentified flag, and can reveal |
| Q20 | The Inventory tab shows Use on an item with Uses, On Use effects or an On Use script |
| Q21 | Uses and When Empty are two settings. Blank Uses is unlimited. When Empty runs when the last use is spent. Charges become Uses |
| Q22 | Requirement Rows can check a copy's State and whether it is identified |
| Q23 | The pass prompt's done bar, on cloud at 12 runs per arm with in-batch controls: the state cases beat shipped by a margin whose CI excludes zero; the take-another and use-up guards hold their shipped rate; the base cases don't drop |
| Q24 | The narrator's unidentified-name leak rate is measured on cloud first. The user sets its ceiling from those numbers. Ruled 2026-10-30: the ceiling is 10% unprompted name leaks on cloud. Ticket 06 measured 0/48 (95% upper bound about 7%), so the narrator keeps both faces |
| Q25 | The Effects tab always offers After Use rows, since an After Use row is one of the things that makes an item usable (Q20). Ticket 01 |
| Q26 | When Uses is first set, When Empty defaults to Gone, which matches today's Consumable. Ticket 01 |
| Q27 | Uses left is part of the merge key. A Uses 1 copy at zero (Stays) splits off and never merges with full copies. Ticket 01 |
| Q28 | Becomes: the used copy fires its After Use dose and `used`, not `lost`; the target copy fires `gained` and seeds like a new gain, with its own Uses. The target keeps the used copy's visibility, so a hidden copy Becomes a hidden one. Ticket 01 |
| Q29 | A Becomes target missing in play still applies the use and removes the copy as Gone, with a diagnostic line. Ticket 01 |
| Q31 | State is trimmed, and blank means no State. Stacking compares States trimmed and case-insensitive; a merged row keeps the text it already had. `change` to a blank State clears it. Ticket 02 |
| Q32 | Changes State on the last use leaves the copy at zero uses, with Use off, under its new State. Ticket 02 |
| Q33 | `change` works on runtime, hidden and location copies; it checks presence only. A `change` to the State a copy already has is skipped with a diagnostic. It fires no script event. Ticket 02 |
| Q34 | The Inventory tab shows the State after the name in muted text, as authored. Items Here shows the State, then uses left (Q30 wording), then the existing marks. Ticket 02 |
| Q35 | Formaquestion's player view lists one row per item and State, with a `state` field. The world player view and the world index facts show the Item's starting State. Ticket 02 |
| Q36 | Scripts read a copy's `state` as the word or null. `setState` takes a string, and blank clears. The item entry does not expose the starting State. The editor's State field sits beside Uses, plain text with no cap. Ticket 02 |
| Q37 | The copy flag is `unidentified` beside uses and State. Runtime items are never unidentified. Every new copy of an item with an unidentified field starts unidentified: seed, any gain, a Becomes target. A transfer keeps the flag. Ticket 03 |
| Q38 | Items Here gives an unidentified copy both faces in full: the Unidentified Name and Unidentified Description as what the player sees, then the true name and its AI text marked unknown to the player. Ticket 06 measures the leak. Ticket 03 |
| Q39 | An effect, trait-grant or timed log line names the unidentified face when every copy behind its source is unidentified, and the true name once any copy is identified. Only visible copies count toward the face; when every copy is hidden, "An item" still wins. Authoring diagnostics in the log use the face too. Ticket 03 |
| Q45 | Requirement text that names a required item ("needs owning …") uses the unidentified face while the owner holds no identified copy of it. Only visible copies count, as in Q39; author-side editor lists keep the true name. Ticket 05 |
| Q46 | An item row gains optional `state` and `identity` (identified or unidentified). Every check on the row must hold on the same copy; hidden copies count as today; Not flips the whole row. State matches trimmed and case-insensitive. A row cannot require "no State". Ticket 05 |
| Q48 | The leak probe's primary rate is the true name, scored by regex. The true nature is a second line, scored by keywords from the item's AI text and hand-checked. The control arm drops the true face, and any control hit is hand-checked as a scorer false positive. It reports rates per case and pooled, with Δ and a 95% CI. Four unprompted cases (carried, handled, equipped, lying here) set the primary rate; one baited case, where the player asks what the item is, is reported apart. Ticket 06 |
| Q49 | The pass probe grades a state case as a hit when the item stays with its owner at the same quantity and nothing else moves; that rate carries the Q23 bar against shipped. The rate at which the State is set to a new word is reported beside it. Two arms, `shipped` (frozen, `consume` mapped to `use`) and `new`; base cases and replays run under both. `retouch-read` is the unseal case, and a new `read-open` case (a letter already "opened", reread, nothing changes) is the control. Ticket 04 |
| Q50 | The `use` line says "as it is meant to be used", and `lose` names burned, broken or destroyed. On cloud the broader "any use" wording turned destroying an item into `use` (use-up guards 0/6). Ticket 04 |
| Q51 | A pass item name with a trailing parenthetical that Items Here wrote (State, uses left, marks) reads as the name before it when that bare name is known, as the colon rule does. Ticket 04 |
| Q47 | Requirement text puts the new checks in parentheses after the name, as Items Here shows State: "owning Lantern (lit)", "equipping Ring (unidentified)". The editor adds a State text field and an Identity select (Any, Identified, Unidentified) after Owned/Equipped. Ticket 05 |
| Q40 | Formaquestion's player view splits rows per face: an unidentified copy is its own row under its unidentified face, even when another copy of the item is identified. Ticket 03 |
| Q41 | The script item entry exposes `unidentifiedName` and `unidentifiedDescription` as authored, blank as "". Each copy exposes `unidentified`. In the player view these read as the face the player knows. Ticket 03 |
| Q42 | `reveal` with a quantity on a visible unidentified stack identifies that many, splitting them off to merge into an identified stack in the same place. Ticket 03 |
| Q43 | A pass name matches a copy by its true name, or by its unidentified name while it is unidentified. A gain by an Unidentified Name gains that authored item only when exactly one item has that name; otherwise it is a new runtime item. Pass `reveal` tries hidden copies first, then visible unidentified copies. Ticket 03 |
| Q44 | The Inventory tab's unidentified face covers the name and the player description. Images follow image rules. Ticket 03 |
| Q30 | The Inventory tab shows "N of M uses" on items with Uses 2 or more. A Uses 1 item shows no line while full, and "No uses left" at zero. Ticket 01 |

## User Stories

1. As a world author, I want to set how many times an item can be used, so that a potion gives three gulps and a wand three spells.
2. As a world author, I want to leave Uses blank, so that a horn can be blown any number of times.
3. As a world author, I want a used-up potion to leave an Empty Bottle, so that the world can have a use for the bottle.
4. As a world author, I want a spent wand to stay in the inventory at zero, so that a script or a recharge can power it again.
5. As a world author, I want a used item to be removed when that makes sense, so that a scroll burns away after it is read.
6. As a world author, I want a letter to change its State to "opened" when it is used, so that it stays in the inventory without a second item.
7. As a world author, I want Becomes to pick an item from my Items list, so that the result has its own description, effects and value.
8. As a world author, I want the editor to flag a Becomes target I deleted, so that no item points at nothing.
9. As a world author, I want to give an item a starting State, so that a lantern starts "unlit" and a letter starts "sealed".
10. As a world author, I want a trait or an image rule to check an item's State, so that a lantern grants Darkvision only while it is "lit".
11. As a world author, I want to give an item an Unidentified Name and Description, so that a cursed ring reads as a plain ring until the player learns the truth.
12. As a world author, I want a blank unidentified field to show the normal value, so that I can hide only the name or only the description.
13. As a world author, I want an unidentified item's effects to apply anyway, so that a cursed ring can harm the player before they know.
14. As a world author, I want a trait or an image rule to check whether an item is identified, so that an effect can change once the truth is known.
15. As a world author, I want scripts to read and set a copy's State, so that my world logic can light a lantern or seal a letter.
16. As a world author, I want scripts to see both faces of an unidentified item and reveal it, so that a quest can identify a relic.
17. As a world author, I want On Use effects and scripts to fire the same way whatever When Empty says, so that use and its result are separate choices.
18. As a world author, I want a hidden placement of an unidentified item to stay unidentified when found, so that a ring found in a barrow is still a mystery.
19. As a player, I want a Use button on any item that does something, so that I can blow a horn as well as drink a potion.
20. As a player, I want to see how many uses an item has left, so that I know when a wand is about to run out.
21. As a player, I want to see an item's State beside its name, so that I know my letter is opened or my lantern is lit.
22. As a player, I want the empty bottle to appear in my inventory after I drink, so that I can fill it later.
23. As a player, I want an unidentified item to show only what my character knows, everywhere, so that the mystery is not spoiled by the panel or the log.
24. As a player, I want an item to show its true name once the story reveals it, so that I see what I really have.
25. As a player, I want a spent wand to show Use as unavailable until it is recharged, so that I don't waste a turn.
26. As a player, I want the story to keep my letter when I open it, so that I can read it again later.
27. As a player, I want the story to record that my cloak got soaked, so that the narrator remembers it.
28. As a player, I want a revealed item to join the matching identified stack, so that my inventory stays tidy.
29. As a player, I want Formaquestion to answer about my items using only what my character knows, so that the help window never spoils an unidentified item.
30. As a player, I want the narrator to know what an unidentified item really is, so that the story can reveal it at the right moment.
31. As a player, I want the narrator not to name an unidentified item's true identity before it is revealed, so that the mystery holds.
32. As a player, I want the story's use of a runtime item it made up to keep it or use it up as the passage shows, so that an eaten honey cake vanishes and a read note stays.
33. As a narrator (AI), I want Items Here to show each copy's State and uses left, so that I describe items as they are now.
34. As the Inventory pass (AI), I want a `use` operation that covers drinking, reading, blowing and breaking a seal, so that every kind of use has one word.
35. As the Inventory pass (AI), I want a `change` operation for a new State, so that a changed item is never recorded as lost.
36. As the Inventory pass (AI), I want `reveal` to cover finding a hidden item and learning an item's true nature, so that both discoveries have one word.
37. As a developer, I want every writer (pass, panel, scripts) to go through the one operation validator, so that Uses, When Empty, State and identity follow one set of rules.
38. As a developer, I want a probe with in-batch controls for the new pass operations, so that a prompt change ships with numbers.

## Implementation Decisions

### The Item and the Item Copy

- The Item drops `consumable` and `charges`. It gains **Uses** (a whole number from 1, or absent for unlimited), **When Empty** (`stays`, `gone`, `becomes` with an authored item id, or `changesState` with a State word), **State** (the starting State), **Unidentified Name** and **Unidentified Description**.
- When Empty applies only when Uses is set. An item with no Uses has no When Empty.
- Stacking follows today's rule with Uses in place of Charges. An item with Uses 1 stacks, as a Consumable does today. An item with Uses 2 or more does not stack, because each copy counts its own uses.
- The Item Copy's per-copy state gains `uses` (in place of `charges`), `state` (the current State word) and `unidentified` (a flag). Seeding a copy sets its uses to the Item's Uses, its State to the Item's State, and `unidentified` when the Item has an unidentified field.
- The merge key adds State and the unidentified flag to today's key (item, place, visibility, unequipped, stacking). Copies merge only when both match.
- Inventory has not shipped. No world, save or stored-turn migration is written for `consumable`, `charges` or the `consume` op name; compat for an unreleased form is dead code.
- The item timing After Consumed and the script timing `consumed` take the new names After Use and `used`.

### The operation validator

- `consume` becomes `use`. A use fires the On Use effects (a Dose, as today) and the `used` script event, then counts down the copy's uses when the item has Uses.
- When the last use is spent, When Empty runs on that one copy. Stays leaves it at zero; Gone removes it; Becomes removes it and gains one carried copy of the target for the same owner, seeded like any new copy; Changes State sets its State word. A use is refused at zero uses.
- A use of an item with no Uses fires its effects and leaves the copy as it was.
- A use of a runtime item reads the pass's `after`: `used up` removes one, `kept` leaves it.
- A new `change` operation sets one copy's State. Splitting a stack follows the partial-reveal pattern: the changed copy leaves the stack as its own row, then merges with any row it now matches.
- `reveal` on a hidden copy shows it, as today. `reveal` on a visible unidentified copy identifies it. On a copy that is both hidden and unidentified, it shows it and leaves it unidentified; a second `reveal` identifies it.
- `setCharges` becomes `setUses`, with the same clamp.

### The Inventory pass

- The schema and the text line format gain `use` (in place of `consume`), `change`, a `state` field (the new State, for `change`) and an `after` field (`kept` or `used up`, for `use` on a runtime item). Fields an operation does not use are empty, as `to` is today.
- The prompt's operation list describes `use` as an owner using an item as it is meant to be used (drinking, eating, reading, opening, blowing, spending a charge), and `lose` as an item burned, broken or destroyed (Q50), `change` as an item whose look or state changes without being used, and `reveal` as a hidden item coming into view or an item's true nature becoming known.
- `applyInventoryPass` resolves a name against both faces of an unidentified item, so the pass can name it either way.
- The prompt change ships with probe numbers against the Q23 bar. The existing re-gain probe's fixture holds the letter cases; it gains the state, use and reveal cases listed under Testing.

### What each reader shows

- **Items Here** (the AI): each copy shows its State and its uses left beside the name. An unidentified copy shows its unidentified face, followed by its true face marked unknown to the player. Hidden copies stay marked as today.
- **Inventory tab**: the name shows the unidentified face, then the State; the line shows uses left; Use shows per Q20 and is off at zero uses. The tab has no control to change State.
- **The log and item lines**: the unidentified face, in the same places that write "An item" for a hidden copy today.
- **Formaquestion's player view**: the unidentified face only, with State. The true face never enters the player view, the world index facts line or the script state Formaquestion sees.
- **Scripts**: a copy exposes `state`, `uses` and `unidentified`, and the item exposes both faces. New verbs set State (`setState`) and set uses (`setUses`); `use()` and `reveal()` follow the validator.
- **Requirement Rows (Item Condition)**: an item row can also require a State word and require identified or unidentified. Both are optional and combine with Not.
- **World Editor Items tab**: Uses, When Empty (with an item picker for Becomes and a word for Changes State), State, Unidentified Name and Unidentified Description. The reference check covers a Becomes target. The Effects tab offers After Use rows when the item can be used.

### Copy and docs

- Help lines and labels follow the Writing Guide. The glossary gains Uses, When Empty, State, Unidentified and Use, and drops Consumable and Charges. The Items wiki page and the Scripts guide change to match.
- Emberwatch's consumable and charged items move to Uses and When Empty.

## Testing Decisions

- Tests check external behavior through the module entries, never internal helpers. A guard test must fail when its bug returns (`test-bar` skill).
- **Inventory module** (existing seam: `applyInventoryOps`, `applyInventoryPass`, `seedItemCopies`): Uses countdown and refusal at zero; each When Empty outcome, on a single copy and on one copy of a stack; Becomes seeding the target and carrying it; a use with no Uses; runtime `after`; `change` splitting and merging; State and unidentified in the merge key; `reveal` on hidden, unidentified, and both; name resolution against both faces; seed of State, uses and the flag. Prior art: `consume.test.ts`, `reveal.test.ts`, `pass.test.ts`, `inventory.test.ts`, `events.test.ts`.
- **Items Here** (existing seam): State, uses left, and both faces of an unidentified copy. Prior art: `inventoryContext.test.ts`.
- **Item Condition** (existing seam): State and identified checks, with Not. Prior art: `traitGates.item.test.ts`.
- **Player view** (existing seam): the true face never appears. Prior art: `playerView.test.ts`, `playerViewWorld.test.ts`, `worldIndex.test.ts`.
- **Scripts** (existing seam): `state`, `uses`, `unidentified`, both faces, `setState`, `setUses`, `use()`, `reveal()`. Prior art: `statCodeExecutor.items.test.ts`, `statCodeTurn.itemScripts.test.ts`, `sandboxSnapshot.test.ts`.
- **Inventory tab** (existing seam): Use per Q20, off at zero, State beside the name, the unidentified face. Prior art: `GamePanels.inventory.test.tsx`.
- **Item editor** (existing seam): the new fields, the Becomes picker and its reference check, After Use rows. Prior art: `ItemEffectsFields.test.tsx`, `WorldEditor.itemsListEditor.test.tsx`.
- **Emberwatch**: its items still cross-reference and its crown scripts still run. Prior art: `emberwatchWorld.test.ts`, `emberwatchWorld.scripts.test.ts`.
- **Probes** (cloud, 12 runs per arm, in-batch controls):
  - The pass: state cases (unseal, open a box, light the lantern, soaked cloak), the read-open control, use cases (drink, blow, read a single-use letter), reveal-identify cases, and the guards (take-another, second-eel, burn the letter, shatter a draught), against the Q23 bar.
  - The narrator: the true-name leak rate of an unidentified item, with a control, reported for the Q24 ruling.

## Out of Scope

- A control in the Inventory tab that changes State or identifies an item (Q3).
- Free-text Becomes targets (Q11).
- Identifying every copy of an item at once when one copy is revealed (Q18).
- Containers, durability and rolled affixes. Per-copy state stays their hook.
- Stat effects keyed to State (only Requirement Rows read State).

## Further Notes

- **Export shape:** world items gain Uses, When Empty, State, Unidentified Name and Unidentified Description, and lose Consumable and Charges. Saved Item Copies gain uses, State and the unidentified flag, and lose charges. Inventory is unreleased, so no migration is written.
- The re-gain fixes in commit e3efd8d1c stay. `change` replaces the state-change prompt line proposed after the letter split.
