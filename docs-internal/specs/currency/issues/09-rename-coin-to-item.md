# 09: Rename Coin to Item

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A wide mechanical rename with one data shape change, where the care is in not touching author content or prompt behavior by accident.

## What to build

An author backs a Currency with **Items**, not "Coin Items". These are plain items, and the author already names the Currency, so "coin" is a vague hardcoded word. A world about gems or shells should never read "coin".

The word goes from everything: the editor, the world file, the script surface, the docs, the glossary and the code.

- **World file:** `{ "kind": "items", "items": [{ "itemId": "<id>", "worth": 1 }] }` replaces `{ "kind": "coins", "coins": [...] }`. The shape never shipped (not in v3.5.2), so no migration or compat code exists.
- **Scripts:** a Currency's `kind` reads `"stat"`, `"items"` or `"name"`.
- **Editor:** the Currency Type reads **Items**, the button **Add Item**, and the row's label **Item**.
- **Confirms, hints and refusal reasons** say item or the Currency's name.
- **Glossary:** the **Coin** entry becomes **Currency Item**, and **Backing** and **Balance** follow.
- **Code:** `CurrencyCoin`, `coinsOf`, `CoinRows`, `CoinValueFields`, `coinPlan` and their kin take Currency Item names. Test fixtures and test titles follow.

**Stays as it is:** author content. That means Emberwatch's item names, its Currency named Coin and its coin story text, the `itemIcons` coin icon, and test fixtures whose names are a world's content, such as a Currency called Crowns.

Rulings: Q75. Spec rulings keep their old wording as history, and Q75 maps it.

## Acceptance criteria

- [ ] A world with the new shape loads, saves, exports and re-imports. A test fails when the parser reads the old key.
- [ ] No reader of `kind: 'coins'` or `backing.coins` remains, and Emberwatch and the fixtures use the new shape.
- [ ] A script reads `currencies.X.kind` as `"items"`, and the completions and Code Hover Cards say so.
- [ ] A case-insensitive search for "coin" in `src` code, docs and the glossary finds only author content, the icon data, and Payment rulings quoted as history. The landing lists what remains.
- [ ] Inventory pass and chip text the AI reads: if a default prompt says "coin", remove the word and ship probe numbers with in-batch controls. If no prompt text changes, the landing says so.
- [ ] Bundled-world fingerprints stay correct. `npm run fingerprints` crashes on main until `c3cbde4f5` lands, so check that first.
- [ ] Frames of the Currencies entry with an Items Currency, in both themes at 1366: `.scratch/frames/items-currency-light.png`, `items-currency-dark.png`.
- [ ] Docs name the new label, and the world format and scripting docs show the new shape. No changelog fragment: the spec session rewords the unreleased entries when this lands.
- [ ] The response carries the export-shape reminder.

For you: open the Currencies entry and read the Items option, its hint and its delete confirm with a non-coin Currency. Does anything still sound like coins?
