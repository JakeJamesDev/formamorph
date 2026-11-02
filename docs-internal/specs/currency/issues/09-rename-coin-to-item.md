# 09: Rename Coin to Item

Status: ready-for-human
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

- [x] A world with the new shape loads, saves, exports and re-imports. A test fails when the parser reads the old key. (`currency.test.ts`: the new shape parses, and the old `coins` kind and old `coins` key are dropped. `emberwatchWorld.test.ts` loads Emberwatch with the new shape. No separate export test.)
- [x] No reader of `kind: 'coins'` or `backing.coins` remains, and Emberwatch and the fixtures use the new shape. (Grep over src, e2e, testing, scripts, docs; the typechecker flags any reader of the old type.)
- [x] A script reads `currencies.X.kind` as `"items"`, and the completions and Code Hover Cards say so. (`statCodeSurface.ts` completion text; `codeCards.currencies.test.ts` green.)
- [x] A case-insensitive search for "coin" in `src` code, docs and the glossary finds only author content, the icon data, and Payment rulings quoted as history. The landing lists what remains. (Grep; the list is under Landed.)
- [x] Inventory pass and chip text the AI reads: if a default prompt says "coin", remove the word and ship probe numbers with in-batch controls. If no prompt text changes, the landing says so. (`pay` line in `GamePrompts.ts`; pay-probe `payOld` arm in the same batch.)
- [x] Bundled-world fingerprints stay correct. `npm run fingerprints` crashes on main until `c3cbde4f5` lands, so check that first. (`c3cbde4f5` is not on this branch, so I did not run the script. `worldFingerprint` of Emberwatch at the base and now is the same hash.)
- [ ] Frames of the Currencies entry with an Items Currency, in both themes at 1366: `.scratch/frames/items-currency-light.png`, `items-currency-dark.png`.
- [x] Docs name the new label, and the world format and scripting docs show the new shape. No changelog fragment: the spec session rewords the unreleased entries when this lands. (`World-Editor-Items.md`, `WorldFormat.md`, `Scripts-Reference.md`, `CONTEXT.md`.)
- [x] The response carries the export-shape reminder. (Landing report.)

For you: open the Currencies entry and read the Items option, its hint and its delete confirm with a non-coin Currency. Does anything still sound like coins?

## Landed

**Not verified**
- Frames `items-currency-light.png` and `items-currency-dark.png`: the preview refused to start. Five dev servers of other chats held the folder's limit.
- Export and re-import of an Items world: no test covers the file round trip. The parser and Emberwatch load tests cover the shape.
- `npm run fingerprints`: it crashes until `c3cbde4f5` lands. The hash of Emberwatch is unchanged by the rename.

**For you**
- Currencies entry (World Editor, Items tab): read the **Items** option, **Add Item**, the hint "Add an item worth 1, the smallest one." and the delete confirm "removes its item row from …" with a non-coin Currency. Does anything still sound like coins?
- 🧩 replaced 🪙 in `docs/World-Editor-Items.md`, in the type table and in the delete list. Look at both.

**What remains with "coin"**
- `moneyKey` in `src/lib/currency.ts` strips a trailing "coin" from story price words, with a test ("2 gold coins"). Ruled to stay: it reads story wording.
- The lucide `Coins` icon on the Currencies entry (`useWorldItemsAdapter.tsx`), kept as a money sign, and the coin icon in `src/data/itemIcons.json`.
- Author content: Emberwatch's item names, its Currency named Coin, its coin story text, image tags, and `__parity__/ownerTreeDrops.json`. Test and probe fixtures named Coin, Crowns or River Coin, with their story narration.
- `devFixtures.ts`: "Coin Pouch" and the backing item description "A copper coin." (Crowns fixture).
- Spec rulings and `docs/Changelog.md` keep the old wording as history. The spec session rewords the unreleased entries.

**Prompt text changed.** The `pay` line in `GamePrompts.ts` read "One pay records the whole sum, coins included". It now reads "One pay records the whole sum, whatever it is made of". Cloud default, 15 runs per case, both wordings in one batch (`pay-probe.cli.ts --arms pay,payOld`): bounty 4/15 right on each, fee 15/15 on each, double charges 0 on each. Every other case is 15/15 on both. Earlier batches with the word deleted outright scored bounty 1/10 and 5/10 against 9/10 for the old line in a separate batch, so the bounty case drifts between batches.

**`pay(4 Silver|here>)` moves nothing** because Q51 refuses a blank on both sides. No code change here.

**Export shape.** A world's Currency backing is now `{ "kind": "items", "items": [...] }`, not `{ "kind": "coins", "coins": [...] }`. It never shipped, so there is no migration.
