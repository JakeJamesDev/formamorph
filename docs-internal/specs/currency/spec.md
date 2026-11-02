# Spec: Currency

Status: ready-for-agent
Spec session: currency — spec

## Problem Statement

An item has a Value, but money does not exist in the game. An author can label a price, and nothing can read or spend it.

The Value unit picker also breaks in common worlds. It reads raw Persona stats, so a world that keeps its stats in Blueprints and links them to Personas offers only No Unit and Text. Emberwatch does this: its items point at the Gold stat, and the picker shows a blank.

Authors need different kinds of money. A futuristic world keeps credits as a number on an account. A fantasy world has coins that the player carries, hands over and splits into smaller coins. A hardcoded system fits neither.

The AI and the player also see almost nothing. The unit reaches only the Formaquestion player view, and narration and the Inventory tab don't show an item's worth.

## Solution

A world defines **Currencies**. A Currency has one backing: a stat, coin items, or a name only. An item's Value is priced in one Currency.

Code owns the money. The Inventory pass gets two new operations: **buy**, which moves the money and the item together, and **pay**, which moves money alone. Code checks the balance and makes exact change. The AI never does the arithmetic.

The player sees an item's worth in its popup and each balance in the Inventory tab. The AI reads both in the `<INVENTORY>` chip. Scripts can read a balance and pay. Emberwatch becomes the showcase, with Copper, Silver and Gold coins in place of its Gold stat.

## Rulings

| # | Ruling |
|---|---|
| Q1 | Currencies are a world list. Items point at one with `currencyId` |
| Q2 | Superseded by Q6. Coin rates live in the Currency, not in a chain through coin Values |
| Q3 | Payment ships in this effort, not a later one |
| Q4 | The stat picker lists a Blueprint stat once under its original id. Code reads it from whichever Persona links it |
| Q5 | A Currency has exactly one backing: a stat, coin items, or name only. Name only replaces the free-text unit |
| Q6 | Coins are ordered rows of an item and its worth in the base unit. The smallest coin is worth 1 |
| Q7 | **buy** is atomic and priced at the item's Value unless the AI states a price. **pay** moves money with no item |
| Q8 | A shopkeeper's money is tracked only when the author gives them a balance. An entity with none trades without limit |
| Q9 | The Inventory pass owns all Currency movement. The stat pass can't write a stat that backs a Currency |
| Q10 | Value is stored in the base unit. The editor gives one field per coin. Players read "1 Gold, 5 Copper" |
| Q11 | A payment spends the smallest coins first and returns change in the fewest coins. Change is created if the seller lacks it |
| Q12 | Worth shows in the item popup and the `<INVENTORY>` chip. Balances show in the Inventory tab and the chip |
| Q13 | The first listed Currency is the Default. A new item takes it. An existing item with no Currency stays priceless |
| Q14 | Currencies are edited in a pinned entry on the Items tab, beside Equipment Settings |
| Q15 | A refused buy or pay changes nothing and shows nothing. Rider actions are the later fix, and they don't block release |
| Q16 | Buying is a typed player action. There is no Buy button |
| Q17 | The rider actions todo lives in `src/notes/TODO.md` |
| Q18 | A balance counts visible, identified copies only. Bound still stops the panel only (Inventory Q58) |
| Q19 | Scripts can read a balance and run pay under the same rules. Direct stat writes and `give` stay allowed |
| Q20 | Selling is buy in the other direction, at full Value unless the AI states a price |
| Q21 | A Currency backed by a Global Stat is one shared wallet. Paying an entity lowers it and adds to no one |
| Q22 | Deletes follow the Slot and Body pattern: never blocked, a confirm names what is affected, and references clear in one step. A deleted backing stat or last coin leaves a name-only Currency. A deleted Currency clears `currencyId` from its items |
| Q23 | Emberwatch moves to coin items |
| Q24 | Emberwatch uses Copper 1, Silver 10, Gold 100. Its current numbers don't bind, so prices and purses are rebalanced freely |
| Q25 | Emberwatch drops its Gold stat. The Rogue bonus becomes extra coins from the trait |
| Q26 | Currencies don't exchange. A price in one can't be paid in another |
| Q27 | The stat pass keeps writing a backing stat when the Inventory pass isn't due |
| Q28 | The Inventory pass is due in a world that has Currencies and no items |
| Q29 | A stat's No Decrease and No Increase locks still apply. A locked stat refuses the payment |
| Q30 | (ticket 01) The stat picker lists Global Stats, then each Persona's resolved stats, own and linked. A Blueprint stat appears once under its original id when at least one Persona links it. An own stat is that Persona's alone |
| Q31 | (ticket 01) The picker has no stat type filter. Number and percentage stats both list |
| Q32 | (ticket 01) Player surfaces show worth only for an item with a Value and an existing Currency. The world index keeps a bare Value for an item with none |
| Q33 | (ticket 01) An unidentified copy shows the player no worth, and its player view row carries no `value` or `currencyId` |
| Q34 | (ticket 01) Until ticket 04, removing a Currency has no confirm or cleanup. Every reader treats a dangling `currencyId` as no Currency |
| Q35 | (ticket 02) A coin Currency with no worth-1 row is legal while editing, and shows a hint. Removing rows in the Currencies entry never makes it name only; only deleting the coin item does (Q22). The Breakdown then reads the plain number and the Currency name, as it does for a stored Value that isn't a whole non-negative number. A row whose item is missing counts as absent |
| Q36 | (ticket 02) A worth edit that leaves two worth-1 rows, repeats a worth, or moves the only worth-1 row off 1 is refused inline. Removing the worth-1 row is allowed. The Breakdown sorts by worth, not row order |
| Q37 | (ticket 02) The coin picker lists Stackable items that aren't a coin in any Currency, plus the row's own item. A coin that later stops being Stackable keeps its row, with a warning |
| Q38 | (ticket 02) Coin Value fields normalize when focus leaves the group of fields, not on each field. A blank Value shows blank fields, and all blank clears the Value. A Value of 0 shows zeros and reads "0 Copper". A coin Currency's fields take whole non-negative numbers, and the top coin has no cap |
| Q39 | (ticket 02) The Breakdown is largest first with zero coins omitted, and ends in the worth-1 coin, so no remainder is lost |

## User Stories

### Authoring

1. As a world author, I want to define a Currency once, so that I don't repeat a unit on every item.
2. As a world author, I want to back a Currency with a stat, so that credits can be a number on an account.
3. As a world author, I want to back a Currency with coin items, so that the player carries money and hands it over.
4. As a world author, I want a name-only Currency, so that I can price an item in goats with no tracking.
5. As a world author, I want several coins in one Currency with worth rows, so that Gold splits into Silver and Copper.
6. As a world author, I want more than one Currency in a world, so that two nations can have separate money.
7. As a world author, I want to edit Currencies beside Equipment Settings, so that money setup sits with the items it prices.
8. As a world author, I want a Blueprint stat to appear once in the stat picker, so that I don't get a row per Persona.
9. As a world author, I want linked Persona stats in the picker, so that a world built on Blueprints isn't left with an empty list.
10. As a world author, I want a new item to take the first Currency, so that I can skip that choice on most items.
11. As a world author, I want to reorder Currencies, so that I can change which one is the Default.
12. As a world author, I want to clear an item's Currency, so that a quest item can have no price.
13. As a world author, I want one Value field per coin, so that I type 1 Gold and 5 Copper and not 105.
14. As a world author, I want a coin's rate change to keep each item's real price, so that I can retune coins without editing every item.
15. As a world author, I want a confirm that names the Currency when I delete its stat or coin, so that I see what breaks before it happens.
16. As a world author, I want item prices to survive that delete, so that one delete doesn't erase my pricing.
17. As a world author, I want a confirm with an item count when I delete a Currency, so that I know how many items lose their price.
18. As a world author, I want to give a shopkeeper coins or the stat, so that a merchant can run out of money.
19. As a world author, I want a shopkeeper with no balance to trade freely, so that most merchants need no setup.
20. As a world author, I want a Global Stat to work as a shared wallet, so that a party treasury needs no Persona setup.
21. As a world author, I want a script to read a balance, so that a door can check whether the player can pay the toll.
22. As a world author, I want a script to pay under the same rules, so that I don't rebuild change math.
23. As a world author, I want my direct stat writes and `give` calls to keep working, so that a reward script needs no new call.
24. As a world author, I want my stat locks to apply to money, so that a locked stat stays locked.

### Playing

25. As a player, I want to see an item's worth in its popup, so that I know a fair price.
26. As a player, I want worth shown in coins, so that I read "1 Gold, 5 Copper" and not 105.
27. As a player, I want each Currency balance in the Inventory tab, so that I know what I can afford.
28. As a player, I want a stat-backed balance in that list too, so that all my money reads the same way.
29. As a player, I want to type "I buy the sword", so that buying works like every other action.
30. As a player, I want a buy to move the money and the item together, so that I never lose one without the other.
31. As a player, I want to pay in any mix of coins, so that I don't need the exact coin.
32. As a player, I want exact change back, so that a Gold Coin can pay a small price.
33. As a player, I want to sell an item, so that loot has a use.
34. As a player, I want to be refused when I can't afford an item, so that money means something.
35. As a player, I want bribes and fees to cost money, so that spending needs no item.
36. As a player, I want bounties to add money, so that I can earn it.
37. As a player, I want a charge to happen once, so that a story mention doesn't double the cost.
38. As a player, I want a haggled price to count, so that talking the merchant down pays off.
39. As a player, I want hidden money to stay out of my balance, so that a stash I haven't found can't pay for things.

### The AI

40. As the narrator, I want each listed item's worth, so that I state fair prices.
41. As the narrator, I want each present owner's balance, so that I don't narrate a sale they can't afford.
42. As the Inventory pass, I want buy and pay operations, so that I report a trade and leave the math to code.
43. As the stat pass, I want backing stats out of my writable set, so that I can't charge the player a second time.

## Implementation Decisions

### Data

- The world gains an optional `currencies` list in order. The first is the Default. Absent means none.
- A Currency has an id, a name and a backing. The backing is a union: a stat id, a list of coin rows, or nothing for name only.
- A coin row has an item id and a whole-number worth in the base unit. Exactly one row has worth 1, and rows are unique by item and by worth.
- A coin row takes Stackable items only, and an item is a coin in at most one Currency.
- An item swaps `valueUnit` for `currencyId`. `value` stays and now means base units. `valueUnit` never shipped (not in v3.5.2), so no migration or compat code exists. The dev fixture and Emberwatch change directly.
- The world load parser drops malformed currencies the way the Slot and Body parsers do.
- Save shape: unchanged. Payment moves or creates Item Copies and writes stat values, which the save already holds. Authored Currencies stay in GameDataContext, and gameplay never writes them.

### Currency module (new, pure)

A deep module with plain-value inputs and outputs and no React. Its interface answers:

- **Balance:** what an owner holds in a Currency, or that the owner is untracked. Coins count visible, identified copies at the owner. A Persona or entity stat resolves through Stat Links. A Global Stat is the shared wallet.
- **Breakdown:** base units to ordered coin amounts, largest first, and the display text.
- **Payment plan:** given a payer, a payee, an amount and the current state, either a refusal or the Inventory ops and stat changes that settle it.

The plan is the one place that holds Q8, Q11, Q18, Q21, Q26 and Q29. The Inventory pass and scripts both call it.

### Passes

- `PASS_OP_KINDS` gains `buy` and `pay`. The schema gains optional `price` and `currency` fields.
- **buy** reads as a transfer: `item`, `quantity`, `owner` (the seller) and `to` (the buyer). The money moves the other way. Selling is the same op with the player as `owner`.
- **pay** reads `owner` (the payer), `to` (the payee), `price` and `currency`, with a blank `item`. A blank `owner` is income. A blank `to` means the money leaves the world.
- A buy's price is the stated `price`, else the item's Value times the quantity. A stated `currency` applies only to a stated price, and it defaults to the item's Currency, then the Default.
- A buy of an authored item the seller doesn't hold gains a new Item Copy for the buyer, because Q8 doesn't make shops list stock. A buy with no price and no Value is refused.
- A name-only Currency settles nothing: the buy moves the item alone.
- A refusal leaves everything unchanged. It logs a diagnostic in the existing Inventory form and shows no UI (Q15).
- Coin movement uses the ordinary lose, transfer and gain ops, so coins' item scripts fire like any other item's.
- The stat pass's writable set omits backing stats while the Inventory pass is due (Q9, Q27). `inventoryDue` also holds when the world has Currencies (Q28).
- The Inventory pass's default prompt teaches buy and pay. It follows the prompt writing guide, with no example values a small model can parrot.

### Chip and surfaces

- `<INVENTORY>` adds worth to each listed item and a balance to each owner block. Untracked owners show none.
- The Inventory tab shows one balance row per Currency the player has, stat-backed included, and name-only excluded.
- The item popup shows worth through the Breakdown.
- Formaquestion's player view and world index read `currencyId` and the Breakdown in place of the old unit.

### Editor

- A pinned **Currencies** entry on the Items tab, following Equipment Settings. Rows reorder by the existing list patterns.
- Each Currency edits its name, its backing kind, the stat picker or the coin rows.
- The stat picker follows Q4 and Q30. This replaces the broken picker in the item Value field.
- The item Properties tab shows a Currency picker. It shows one number field per coin for a coin-backed Currency, and one field otherwise.
- Deleting a stat, a coin item or a Currency follows Q22. The cleanup runs in the same GameDataContext action as the delete.
- Every new screen gets a dev route, with an Items fixture covering a stat, a coin and a name-only Currency.

### Scripts

- A new surface reads a balance and runs pay through the Payment plan. It follows the `give` write path and carries hover card data.
- Direct stat writes and `give` are unchanged (Q19). The stat code sandbox exposes nothing further.

### Emberwatch

- Add Copper, Silver and Gold coin items, a coin-backed Currency, starting Placements for each Persona, and rebalanced item Values.
- Remove the Gold stat, its Stat Links and its descriptors. The Rogue bonus becomes coins from the trait. Renown stays.
- Update the readme and any text that treats Gold as a stat. The story's plain mentions of gold stay. Follow the bundled-worlds skill.

### Glossary and docs

- `CONTEXT.md` gains Currency, Backing, Coin and Balance, and Item's entry drops the unit wording.
- The user-facing help and wiki describe Currencies. Copy starts from a facts list under the Writing Guide, not from this spec.
- ⚠️ Export shape: world `.json` gains `currencies`, and items swap `valueUnit` for `currencyId`.

## Testing Decisions

Tests assert behavior at a seam: inputs in, state out. They never mirror the code's math. Each guard must fail when its bug returns, and scenarios stay real. A broke buyer is the test case, not something to fund away.

- **Currency module (new seam):** balance by each backing, hidden and unidentified coins excluded, Persona stats through Stat Links, Global Stat wallet, untracked owners. Breakdown with gaps and zero. Payment plan: exact coins, smallest first, change in the fewest coins, created change, refusal, stat locks, other Currency refused. Prior art: the pure tests beside the Inventory module.
- **Turn commit (existing seam):** a pass reply with buy and pay moves money and items together, a refusal changes nothing, and stat and coin Currencies both settle. Prior art: the turn pipeline tests and parity inputs. Stat pass bodies omit backing stats only while the Inventory pass is due.
- **World Editor bench (existing seam):** add a Currency of each backing, the stat picker with linked Blueprint stats, coin Value fields, and each Q22 delete. Prior art: the items list editor tests.
- **Inventory chip (existing seam):** worth and balances in each context format. Prior art: the inventory context tests.
- **Prompts:** every prompt change ships with probe numbers, cloud by default, with in-batch controls. The bar covers buy, pay, refusal cases, and no double charge against the stat pass.
- **Emberwatch:** per-world tests prove coin-backed balances, a seeded purse for each Persona, the Rogue bonus, and that no reference to the Gold stat survives. Bundled-world hashes update.

## Out of Scope

- Rider actions, including telling the narrator about a refused buy (Q15).
- A Buy button or shop screen (Q16).
- Exchange between Currencies (Q26).
- Sell rates and merchant markup (Q20).
- Restocking merchants. Inventory's out-of-scope list already holds this.
- Money at a location. A location holds Item Copies but no Balance.
- Debt and negative balances.
- Coins on any bundled world other than Emberwatch, which is the only one with priced items.

## Further Notes

- The refused-buy gap is known and accepted: one turn's narration can read as a sale that code refused. The chip's balances should make it rare.
- Payment moves money after narration, so the narrator's own sums can disagree with the settled balance for that turn.
- Emberwatch's new coins need no generated art for tickets to land, unless the user asks for it.
- The rulings in this spec amend Inventory Q32 and Q75 and remove "buying and selling" from that effort's out-of-scope hook.
