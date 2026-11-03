# Spec: Currency

Status: done
Status note: Closed 2026-11-03. Tickets 01 to 13 landed, last landing 4e6037f05. Review: spec text corrected. Closed red: bundledRevisions.test.ts, bundledWorlds.test.ts, scripts.migration.test.ts, statLookupMigration.test.ts and GameViewer.bundledSaves.test.tsx, whose pinned commits the history rewrite removed. Ticket 11's pay probe was run by the spec session.
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
| Q40 | (ticket 04) Q22's stat rule covers every delete that removes a backing stat's id: a world stat, a Persona's own stat, a Persona, and Blueprints removal. Unlinking a Blueprint stat from its last Persona is not a delete: the Currency keeps it, the picker still shows it, and it has no Balance |
| Q41 | (ticket 04) Deleting the base coin drops its row and leaves a coin Currency with ticket 02's hint. Only deleting the last coin makes it name only |
| Q42 | (ticket 04) A confirm for Currency reasons shows only when a Currency uses the stat or coin, or when items point at the Currency |
| Q43 | (ticket 03) An entity is tracked in a coin Currency when the world has a Placement of one of its coins at that entity, hidden or not. It stays tracked at 0 once spent down, and coins received in play don't make an untracked entity tracked. A stat-backed Currency tracks whoever has the stat |
| Q44 | (ticket 03) The player is always tracked in a coin Currency, so no coins reads as 0. A Persona without a backing stat is untracked and has no row. A Global Stat wallet reads for the player only |
| Q45 | (ticket 03) A switched-off backing stat reads as untracked. A hidden backing stat stays in the chip and has no Inventory tab row, so the row can't reveal it |
| Q46 | (ticket 03) The chip gives an unidentified copy's worth inside its "unknown to the player" part. A stack of 2 or more reads per unit, as "each" |
| Q47 | (ticket 03) Balance rows sit in the player's card under a Money subheader. The Inventory tab also shows in a world with Currencies and no items when the player has a row |
| Q48 | (ticket 03) Trading without limit applies to entities (Q8). An untracked player can't pay |
| Q49 | (ticket 03) The chip carries no sentence explaining worth or balance. Probes show a sentence doesn't stop a sale to a broke player, and it costs about 35 words per turn. Affordability rests on ticket 05's refusal |
| Q50 | (ticket 05) `price` is a string in the Breakdown form, read loosely. A bare number is base units, unless `currency` names a coin, then it counts that coin. A coin name beats a Currency name. Coins of two Currencies or a conflict with `currency` is refused. An unknown `currency` is ignored when `price` names its own coins or Currency (amended by ticket 06), and refused with a bare number. A blank `currency` with a bare number uses the Default |
| Q51 | (ticket 05) An unresolved `to` reads as blank, and an unresolved `owner` reads as blank. "here" reads as blank on either side. Blank on both sides is refused. Names of the player resolve the way the pass already resolves them |
| Q52 | (ticket 05) A payment that takes the payer below a stat's min is refused. A payee at its max clamps and the payer still pays. A locked payee refuses, income included. Income to an untracked player is refused |
| Q53 | (ticket 05) A settled stat payment joins the bar's held deltas, not `stat_changes`, because replay would charge it twice. History reads value diffs, so it still shows the move. A refusal shows nothing |
| Q54 | (ticket 05) Coins settle net per coin kind, so a kind that returns as change fires no script. Change comes from a tracked payee's visible, identified coins, and the rest is created. Amended by ticket 06: value is conserved between tracked parties, so the payer's Balance falls and a tracked payee's Balance rises by exactly the amount. A payee who lacks change receives coins worth the amount, not the payer's full handover. An untracked entity holds no money: coins paid to it leave the world, and coins it pays are created |
| Q55 | (ticket 05) Refines Q28: a name-only Currency doesn't make the Inventory pass due, because it settles nothing |
| Q56 | (ticket 05) Pays land first in a reply. A pay is the reply's only statement about its Currency's money: settled or refused, it skips any gain, lose or transfer of that Currency's coins in the same reply, with a diagnostic. The skip also matches the Currency's own name. A coin op in a reply with no pay runs as an ordinary item op, except Q57 |
| Q57 | (ticket 05) A coin `gain` repeated word for word in one reply counts once, because the cloud model repeats bounties and a repeat creates free money. A repeated `lose` or `transfer` runs as ruled. Two real equal gains in one reply count once, which is the safe direction |
| Q58 | (ticket 05) Money named with no `price` reads through `item` or `currency` only when `quantity` is above 1. A blank price with quantity 1 is refused, so code never invents an amount |
| Q59 | (ticket 07) A script's `pay` plans through a synchronous sandbox host function and returns `{ paid, reason }` in the run. Scripts never re-run for a payment, because a re-run would repeat Script Prompts and draw new random values |
| Q60 | (ticket 07) The surface is `currencies.Name.balance(owner)` and `currencies.Name.pay(payer, payee, amount)`. `balance` returns a number, or null for an untracked owner or a name-only Currency. A null payer is income and a null payee leaves the world, and both null is refused. A location stops the script with an error, like any unknown party. `amount` is base units or a Breakdown string (Q50) |
| Q61 | (ticket 07, amended by Script Run Order Q15) A balance read reflects every earlier write in the chain, including direct stat writes and `give`, and the run's own. A pay can't spend a copy the same run made (Script Run Order ticket 04) |
| Q62 | (ticket 07) A script's settled pay lands like a direct stat write or `give`, joins the held deltas (Q53) and replays on re-roll. Q56 applies to pass replies only, so a script's pay and a pass's pay in one turn both count. A name-only `pay` returns `{ paid: true }` and moves nothing |
| Q63 | (ticket 06) The new-copy rule covers entity and blank sellers. A player seller must hold the full quantity in visible copies, or the sale is refused. Bound and equipped copies can sell |
| Q64 | (ticket 06) With no stat or coin Currency in the world, a `buy` moves the item alone and ignores the price. An item whose Currency is name-only also moves alone. A Value of 0 moves the item alone. An item with a Value, no existing Currency and no stated price is refused (Q13). A stated price of 0 is refused, because a gift is a `transfer` or `gain` |
| Q65 | (ticket 06) On a `buy`, a bare number uses the item's Currency, then the Default. A price that names a coin uses that coin's Currency. `pay` stays as Q50 has it |
| Q66 | (ticket 06) A buy takes from the seller's visible copies, then visible copies lying here, then a new Item Copy for what is short, under one price. Hidden copies never sell. An unauthored name gains a runtime item when the reply states a price, and is refused without one. Seller "here" sends the money out of the world |
| Q67 | (ticket 06) A seller may be blank or unresolved. A buyer must resolve to someone present and is otherwise refused, except that a player seller with a blank or unresolved `to` loses the item and the money is created |
| Q68 | (ticket 06) A `buy`, settled or refused, is the reply's only statement about that item's move and its Currency's coins. It skips gains, losses and transfers of them, with a diagnostic. A `pay` of the same Currency and amount as a `buy`, settled or refused, is dropped as the same sum when it names either of the buy's parties in either direction or leaves a side blank. A pay settles when it differs in amount or Currency, or when both its sides resolve to others. A real tip of the same sum counts once, which is the safe direction. A `buy` repeated word for word counts once |
| Q69 | (ticket 06) Pays land first, then buys and item ops in reply order. A buy before the sale that funds it is refused. Money and item commit together or not at all |
| Q70 | (ticket 06, widened after ticket 09) A `pay` whose `item` names anything but money, known or not, is refused silently (Q15). Probes showed this shape on prices talked about, where it created money. Real lone pays carry an empty `item` or a money word. A person's name refuses too, because code can't tell a real pay from talk there. Words such as "no item" on a real lone pay would also refuse |
| Q71 | (ticket 06) On a `buy` with no stated price, a `pay` in the same reply that shares a party under Q68's test and reads in the item's Currency states the buy's price, and it is dropped as a pay. A real tip beside an unpriced buy sets the price, and still charges once. For an item with no Currency, that pay states the price in its own Currency, and the sale commits as one |
| Q72 | (ticket 06) Every pay of a buy's sum that shares a party is dropped, not one per buy. A real second equal pay in that reply counts once |
| Q74 | (ticket 08) Emberwatch's Rogue and Halfling bonuses are At Game Start scripts on their Blueprint traits, because no trait field grants items. Rogue gives 2 Gold and Halfling 5 Silver. Jory Pike alone holds a tracked purse of about 30 Gold; the other shopkeepers stay untracked. The Currency is named Coin, and Old King's Coin stays a priced non-money item |
| Q73 | (ticket 06) A stated coin price beats Q64: a name-only item priced "12 Copper" charges 12 Copper. A Value of 0 moves alone only with a Currency that settles. With no Currency it stays priceless and refused (Q13) |
| Q77 | (close review) The Currencies entry and its item rows use the Design System's expandable `EditorRow`, with drag reordering in place of arrow buttons |
| Q78 | (close review) A script's pay naming a location stops the script with an error, like any unknown party |
| Q79 | (close review) Deleting any Persona or entity whose own stat backs a Currency shows a confirm that names the Currency. With no Currency affected, nothing changes |
| Q80 | (close review) A pay with a money word in `item` and a bare `price` counts that item, so item Silver and price 5 means 5 Silver. A price that names money reads by its own words, so item Gold and price "5 Silver" means 5 Silver. Only money of another Currency conflicts |
| Q81 | (close review) A played entity's name counts as the player in a pay or buy, for every played entity |
| Q82 | (close review) A pay's text reply may state its price in the quantity cell, as ticket 05 built it |
| Q83 | (close review) The structure findings become one refactor ticket, after Script Run Order ticket 04 lands |
| Q84 | (close review) Test Code and the Test Bench build Currencies. User Tools get a read-only balance. A test covers a script pay followed by a pass pay in one turn |
| Q85 | (ticket 12) An empty `persona` or a blank `owner` reads as the player, in every run. It holds what the world places on the player and any Global Stat. Otherwise an Items balance reads 0, a stat balance reads null, and a `pay` is refused. A stand-in holding a Persona's money is out |
| Q86 | (ticket 12) Test Code reports one line per `pay` call, settled or refused, with the Currency, amount, parties and refusal reason |
| Q87 | (ticket 12) A user Tool's `currencies` has `id`, `name`, `kind` and `balance`. The editor marks `pay` unavailable there, and a run stops with an error. World Tools keep `pay` |
| Q88 | (ticket 13) Internal refusals share `{ settled: false; reason: string }`, and tests move from the `refused` property with it. A script's `{ paid, reason }` and its log row stay, and script money converts at its edge |
| Q89 | (close review) A played entity's name reads as the player for the whole Inventory pass, not only pay and buy |
| Q90 | (close review) Each Currency row shows Default and backing kind meta, as Bodies does |
| Q91 | (close review) A Currency's name field stays in its expanded body |
| Q76 | (after ticket 09) Narrows Q56: a pay with no `price`, or with a readable price and no one on either side, says nothing, so a gain, lose or transfer beside it runs. A pay with no price still blocks them when the player is its payer. A pay with a price it can't read, or one refused for funds or a lock, still blocks them. Probes showed Q56 losing a correct bounty in 5 of 15 runs |
| Q75 | (ticket 09) "Coin" leaves the product and the code. The backing is `{ kind: 'items', items: [{ itemId, worth }] }`, the label is **Items**, and a row is a **Currency Item**, because they are plain items and the author names the Currency. Earlier rulings keep "coin" as history and mean a Currency Item |

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
- Save shape: payment moves or creates Item Copies and writes stat values, which the save already holds. Additive change: `inventoryOps` rows can now hold `buy` and `pay`, with `price` and `currency`. Authored Currencies stay in GameDataContext, and gameplay never writes them.

### Currency module (new, pure)

A deep module with plain-value inputs and outputs and no React. Its interface answers:

- **Balance:** what an owner holds in a Currency, or that the owner is untracked. Coins count visible, identified copies at the owner. A Persona or entity stat resolves through Stat Links. A Global Stat is the shared wallet.
- **Breakdown:** base units to ordered coin amounts, largest first, and the display text.
- **Payment plan:** given a payer, a payee, an amount and the current state, either a refusal or the Inventory ops and stat changes that settle it.

The plan is the one place that holds Q8, Q11, Q18, Q21, Q26 and Q29. The Inventory pass and scripts both call it.

### Passes

- `PASS_OP_KINDS` gains `buy` and `pay`. The schema gains optional `price` and `currency` fields.
- **buy** reads as a transfer: `item`, `quantity`, `owner` (the seller) and `to` (the buyer). The money moves the other way. Selling is the same op with the player as `owner`.
- **pay** reads `owner` (the payer), `to` (the payee), `price` and `currency`. Its `item` is blank or a money word (Q58, Q70). A blank `owner` is income. A blank `to` means the money leaves the world.
- A buy's price is the stated `price`, else the item's Value times the quantity. A stated `currency` applies only to a stated price, and it defaults to the item's Currency, then the Default.
- A buy of an authored item the seller doesn't hold gains a new Item Copy for the buyer, because Q8 doesn't make shops list stock. A buy with no price and no Value is refused.
- A name-only Currency settles nothing: the buy moves the item alone, unless a stated price names money that settles (Q73).
- A refusal leaves everything unchanged. It logs a diagnostic in the existing Inventory form and shows no UI (Q15).
- Coin movement uses the ordinary lose, transfer and gain ops, so coins' item scripts fire like any other item's.
- The stat pass's writable set omits backing stats while the Inventory pass is due (Q9, Q27). `inventoryDue` also holds when the world has a stat-backed or item-backed Currency (Q28, Q55).
- The Inventory pass's default prompt teaches buy and pay. It follows the prompt writing guide, with no example values a small model can parrot.

### Chip and surfaces

- `<INVENTORY>` adds worth to each listed item and a balance to each owner block. Untracked owners show none.
- The Inventory tab shows one balance row per Currency the player has, stat-backed included, and name-only and hidden stats excluded (Q45).
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

- `CONTEXT.md` gains Currency, Backing, Currency Item and Balance, and Item's entry drops the unit wording.
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

- The refused-buy gap is known and accepted: one turn's narration can read as a sale that code refused. Ticket 03's probes show the chip doesn't make it rarer: the cloud narrator gave a broke player the sale in 6 of 30 runs with the chip, and 7 of 30 without.
- Payment moves money after narration, so the narrator's own sums can disagree with the settled balance for that turn.
- Emberwatch's new coins need no generated art for tickets to land, unless the user asks for it.
- The rulings in this spec amend Inventory Q32 and Q75 and remove "buying and selling" from that effort's out-of-scope hook.
