# 08: Emberwatch Coins

Status: ready-for-human
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

World authoring across prices, traits, Placements and text, where the balance is a judgment call.

## What to build

Emberwatch becomes the Currency showcase. Copper, Silver and Gold are coin items worth 1, 10 and 100, in a coin-backed Currency that replaces the interim one from ticket 01. Each Persona starts with a purse by Placement. Item prices and purses are rebalanced freely, because the current numbers don't bind.

The Gold stat goes, with its Stat Links and descriptors. The Rogue bonus becomes extra coins from the trait. Renown stays. The readme and any text that treats Gold as a stat are updated, and the story's plain mentions of gold stay.

Follow the bundled-worlds skill. From ticket 01's landing: `npm run fingerprints` crashes on main until `c3cbde4f5` lands, so check that before updating the bundled-world hashes.

Rulings: Q23, Q24, Q25.

## Acceptance criteria

- [x] A new game seeds each Persona's purse, and the Inventory tab shows the balance. `GameViewer.emberwatchCoins.test.tsx`, mounted: Albus 300, and the Money list reads "3 Gold".
- [x] A Rogue starts with more money than a non-Rogue. A test fails when the bonus is removed. Same file, through a played opening: played Sylvie 500, cast Sylvie 500, Albus 300. Removing the script turned 3 tests red.
- [x] No reference to the Gold stat survives in scripts, stat changes, Requirement Rows, descriptors or the readme. A per-world test proves it. `emberwatchWorld.test.ts` "leaves no reference to a Gold stat" scans every string in the file. Four reinstated references each turned it red.
- [x] Every priced item uses the coin Currency, and a real shop item can be bought from the starting purse by the `buy` op in a per-world test. `emberwatchWorld.test.ts`: Cold Iron Dagger from Bram Oakes, purse 300 to 150.
- [x] Bundled-world hashes update. `src/lib/bundledFingerprints.json`, with `c3cbde4f5` applied for the run only. Without it the generator still crashes.
- [x] The docs that use Emberwatch as an example match it, and a changelog fragment exists. `docs/World-Editor-Items.md`, `docs/Scripts-Reference.md`, and the fragment.
- [x] The response carries the export-shape reminder. In the final reply.

## Landed

**Rulings from build evidence.** Q74 holds the spec session's answers. The script fix is new evidence, ruled in this ticket: under a library persona, a script's `give` or `pay` naming the Custom Persona landed on the out-of-play entity. It now reaches the player. Reinstating the old mapping turned exactly the matching test red, once for `give` and once for `pay`.

**Prices and purses.** One old Gold is about 10 Copper. A hero's purse is 2 Gold, 8 Silver, 20 Copper (300). Rogue adds 2 Gold and Halfling adds 5 Silver. A Cold Iron Dagger costs 150 and a Cold Iron Sword costs 400, so only a Rogue can buy the sword from the start.

**Tests changed.** `ownerTreeParity.test.ts` drag cases named the Gold stat, and they now name Mana or Renown with the same expected outcomes. `bundledPlayerStats.test.ts` drops Gold from the player stats. The parity snapshots are regenerated: the diff is the Gold rows, the new scripts and order shifts. Ticket 01's "lists once" guard now reads Faith.

**Guards proved.** 11 reinstated faults in the world, one at a time, each turned a test red. Regenerating the opening keeps the bonus at one payment, and an unpicked Wanderer gets none. Coverage was not measured: the code change is about 5 lines, and the mutations prove them.

**Not verified**

- None of the acceptance criteria. Play in a live preview was not run: mounted tests only.

**Known limits**

- Test Code and the Test Bench run a Blueprint trait script with a blank owner, so `give(owner)` throws there. Both scripts guard with `if (owner.id)`. Any author's Blueprint script needs the same guard until the check supplies an owner.
- Under a library persona, `owner.items` on the Custom Persona still reads that entity's own items, not the player's. Only `give` and `pay` targets changed.
- `npm run fingerprints` crashes on main until `c3cbde4f5` lands.
- Item text says "Jory Pike pays well", and his description says he pays a quarter of worth. Both predate this ticket.

**For you**

- For you: start a Rogue and another class in Emberwatch and buy something from the keep. Do the prices and purses feel right?
- For you: sell grave goods to Jory Pike. His purse is 3250 (30 Gold, 20 Silver, 50 Copper). A sale past it is refused silently and moves nothing. At his authored quarter-of-worth rate the whole barrow's loot is about 1340, so only a haggled price reaches the limit. Is that size right?
