# 05: Purchase on buys and a gift template

Status: done
Blocked by: 04
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Model rationale: the purchase must ride the operations a buy settles into, through the pass's money step.

## Parent

[spec.md](../spec.md) — Trigger Args and Item Instances (Q9, Q18).

## What to build

A buy in the Inventory pass carries `args.purchase` = `{ price, currency }` on its When Gained and, when a seller's instance moved, on the seller's When Lost. `price` is in the Currency's base unit and `currency` is its name. Both are `null` for an unpriced buy. Every other event reads `null`. A sale by the player reads `args.from === persona` with a purchase, so it never counts as a gift.

The Templates menu gains a gift-style When Gained template. It skips anything not given by the player, or bought, and raises a stat of the receiver. The guide and hover cards describe `purchase`, and the help vectors are rebuilt.

## Acceptance criteria

- [x] A priced buy and an unpriced buy carry `purchase` on both sides (tests through the pass). `statCodeTurn.itemPurchase.test.ts`: priced, Item Value, unpriced, Value 0, Name Only, new stock.
- [x] A buy from location stock reads the location as `from`, with `purchase` (test). Same file, "location stock".
- [x] A sale by the player reads `from === persona` with `purchase` (test). Same file, "sale by the player".
- [x] A Sunmeadow-shaped check: the gift template's guard raises the receiver's stat for the player's gift only, not for a shop buy, a cast-to-cast transfer or a script grant (test). Same file, "Gift Raises a Stat": gift, shop buy, sale, cast-to-cast, Q8 grant, script transfer. Runs the filled built-in template.
- [x] The template appears for When Gained item boxes only. `StatCodeTemplateDialog.test.tsx` "lists the gift template…"; preview frame `.scratch/trigger-args-05/frames/gift-template-menu.jpg`.
- [x] Docs and hover cards describe `purchase`; the help vectors are rebuilt. Scripts-Reference Args, ScriptsGuide Item Timings and item template section, `ITEM_ARGS_ENTRIES.purchase`; `build:help-vectors` run.
- [x] Each guard is shown to bite by reinstating the bug. Dropped purchase on transfer, on gain and in `itemEventArgs`; priced a free buy at 0; dropped each gift-guard term; widened the template to When Lost. Each turned its test red.

## Landed

User rulings during the build: item boxes get a Templates menu (an `itemScript` template kind); the gift guard adds `args.by === 'script'`; a buy that moves no money (Value 0, Name Only) reads both fields `null`.

**Not verified**
- None.

**For you**
- Open an item's Scripts tab (Advanced), add a When Gained script, select **Templates**: **Gift Raises a Stat** should read well and insert working code.
- `args.purchase.price` is the whole buy's price on every event of that buy; a buy of 2 split over two Item Instances reads it twice. The docs say so. Decide whether that suits merchant scripts.
