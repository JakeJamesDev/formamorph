# 02: Coin Currencies

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A bounded editor and one pure function, on the shapes ticket 01 sets.

## What to build

An author backs a Currency with coin items: Copper 1, Silver 10, Gold 100. An item priced in it shows one Value field per coin, so the author types 1 Gold and 5 Copper and the world stores 105. The player reads "1 Gold, 5 Copper" in the item popup.

This ticket owns the Breakdown in the Currency module. Tickets 03 and 05 read it.

Rulings: Q6, Q10.

From ticket 01's landing: the parser checks record shape only, so this ticket's editor enforces the coin-row rules. The player view's readable worth is `PlayerViewItem.worth`, and its scene and script items carry raw values with no Currency list.

## Acceptance criteria

- [x] The Currencies entry adds, reorders and removes coin rows of an item and a worth. Bench tests "switches a Currency to Coin Items…" and "reorders and removes rows".
- [x] The editor enforces: exactly one row worth 1, unique item and worth per Currency, Stackable items only, and an item in one Currency at most. A test fails when each rule is removed. `currencyCoins.test.ts` coin row rules; mutations on the duplicate worth, the only worth-1 row and the Stackable filter each went red. The one-Currency rule went red too.
- [x] The coin Value fields store base units. Changing a coin's worth keeps each item's stored total and shifts its breakdown. Bench test "keeps each item's stored total when a coin changes worth".
- [x] The Breakdown handles gaps, zero and a value below the second coin, largest coin first. Tests call the module and don't repeat its math. `currencyCoins.test.ts` Breakdown table with literal expected text.
- [x] The item popup, the Formaquestion player view and the world index show the Breakdown. `InventoryTab.itemPopup.test.tsx`, `playerViewUnidentified.test.ts`, `worldIndex.test.ts`.
- [x] The Items fixture covers a coin Currency. Crowns with Copper, Silver Bit and Gold, and a Coin Pouch priced in it.
- [x] Frames of the coin rows and the coin Value fields, in both themes at 1366: `.scratch/frames/coin-rows-light.png`, `coin-rows-dark.png`, `coin-value-light.png`, `coin-value-dark.png`. Playwright at 1366×768.
- [x] `CONTEXT.md` gains Coin, docs name coin Currencies, and a changelog fragment exists. `docs/World-Editor-Items.md`, `docs/WorldFormat.md`, `docs-internal/changelog.d/currency-02.md`.
- [x] The response carries the export-shape reminder.

For you: set up Copper, Silver and Gold and price an item in it. Do the fields read faster than one total?

## Landed

**Not verified**

- Focus leaving the Value group by real tabbing. The bench test fires blur events with `relatedTarget`; no browser run tabbed through the fields.
- None else.

**For you**

- Set up Copper, Silver and Gold and price an item in it. Do the fields read faster than one total? Frames: `.scratch/currency-02/frames/coin-rows-light.png`, `.scratch/currency-02/frames/coin-value-light.png`.
- Coin rows sit under the Currency's name inside its row, with the Delete button centered on the whole block. Look at it on the Crowns Currency in the Items fixture.

**Notes for later tickets**

- `breakdown`, `coinFields`, `breakdownText`, `valueOfCoins` and `coinsOf` live in `src/lib/currency.ts`. `worthText`, `copyWorthText` and `copyWorthFacts` now take the world's items as a required argument, for coin names.
- A coin row whose item is gone counts as absent in the Breakdown and in `lacksBaseCoin`. Ticket 04 owns the cleanup (Q22).
