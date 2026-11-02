# 01: Currencies and Item Prices

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Touches world data, the load parser, a new editor entry and every reader of the old unit, and it sets the shapes later tickets build on.

## What to build

An author opens the pinned Currencies entry on the Items tab and adds a stat-backed Credits or a name-only goats. An item's Properties tab prices it in a Currency. A new item takes the first Currency in the list. The player sees the item's worth in its popup.

The stat picker lists each stat once: Global Stats, then Persona stats through Stat Links, with a Blueprint stat under its original id. A world built on Blueprints no longer gets an empty list.

This ticket owns the Currency type with all three backings and the new pure Currency module. Coin rows exist in the type, and ticket 02 builds their editor and Breakdown.

`valueUnit` goes away here. Emberwatch and the dev fixture move to `currencyId` directly, with Emberwatch on an interim stat-backed Gold Currency until ticket 08. No migration or compat code exists for `valueUnit`, because it never shipped.

Rulings: Q1, Q4, Q5, Q13, Q14, Q21.

## Acceptance criteria

- [x] The world parser keeps valid Currencies in order and drops malformed ones, like the Slot and Body parsers. A test fails when the parser drops a valid one. `currency.test.ts` parseCurrencies; mutation dropping the name backing went red.
- [x] A world export and import keeps `currencies` and `currencyId`. Bench test "keeps Currencies and an item's Currency through an export and an import".
- [x] The pinned Currencies entry adds, renames, reorders and removes a stat-backed and a name-only Currency. Bench tests, reorder by keyboard drag.
- [x] In Emberwatch's shape, with every stat in Blueprints and linked to Personas, the stat picker lists each stat once. A test fails when the picker reads raw Persona stats again. `emberwatchWorld.test.ts`, the bench picker test; mutation went red. Live read on Emberwatch: Health, Mana, Faith, Gold, Renown.
- [x] A new item takes the first Currency. An existing item with no Currency stays priceless, and an author can clear an item's Currency. Bench tests.
- [x] The item popup shows worth with the Currency's name, and the Formaquestion player view and world index read `currencyId`. `InventoryTab.itemPopup.test.tsx`, `GamePanels.inventoryHere.test.tsx`, `playerViewUnidentified.test.ts`, `worldIndex.test.ts`.
- [x] No reader of `valueUnit` remains, and Emberwatch's priced items open with their Currency shown. Grep; live read: Cold Iron Sword shows 40 and Gold.
- [x] Every new screen has a dev route, and the Items fixture covers a stat and a name-only Currency. `subtab=currencies` with `fixture=items`.
- [x] Frames of the Currencies entry and the item Properties tab, in both themes at 1366: `.scratch/frames/currencies-light.png`, `currencies-dark.png`, `item-price-light.png`, `item-price-dark.png`. Playwright at 1366×768.
- [x] `CONTEXT.md` gains Currency and Backing, and Item's entry drops the unit wording.
- [x] Docs that describe item Value and the world format name Currencies, and a changelog fragment exists. `docs/World-Editor-Items.md`, `docs/WorldFormat.md`, `docs-internal/changelog.d/currency-01.md`.
- [x] The response carries the export-shape reminder.

## Landed

**Not verified**

- None.

**For you**

- Add a Currency in the Currencies entry and price an item in it. Does the setup read clearly? Frames: `.scratch/currency-01/frames/currencies-light.png`, `.scratch/currency-01/frames/item-price-light.png`.
- The stat list has three headings: Global Stats, Linked to Personas, and each Persona's name. Look at it on Emberwatch: `.scratch/currency-01/frames/emberwatch-currencies.png`.

**Notes for later tickets**

- The parser checks only record shape, like the Slot and Body parsers. Ticket 02's editor enforces the coin-row rules.
- The player view's scene and script items pass raw `value` and `currencyId` on an identified face, and they carry no Currency list. The readable worth is `PlayerViewItem.worth`.
- `npm run fingerprints` crashes on main until `c3cbde4f5` lands. This ticket ran it with that fix applied for the run only, and the file came out unchanged.
