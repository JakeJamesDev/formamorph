# 06: Buy and Sell

Status: done
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Atomic state changes across items and money, and a prompt change that needs probes.

## What to build

The player types "I buy the sword". The Inventory pass returns `buy`, and the money and the item move together. A haggled price counts when the AI states it. A sale is the same op with the player as the seller, at full Value unless the AI states a price.

A buy of an authored item the seller doesn't hold gains a new Item Copy for the buyer. A buy with no price and no Value is refused, and so is a buy the buyer can't afford. A refusal moves nothing. A name-only Currency moves the item alone.

Rulings: Q7, Q8, Q15, Q16, Q20, Q26.

## Acceptance criteria

- [x] A `buy` moves money and item together for coin and stat Currencies at the turn commit seam, and a refusal moves neither. A test fails when the money and item stop moving as one. `GameViewer.pay.test.tsx`, "a buy at the turn commit", re-roll included; turning off the rollback in `settleBuy` turns `pass.buy.test.ts` red.
- [x] A stated price overrides Value. A stated Currency applies only to a stated price, and defaults to the item's Currency, then the Default. `pass.buy.test.ts`, "what a buy costs".
- [x] Selling pays the player from a tracked seller and from an untracked one, and refuses a tracked seller who can't pay. `pass.buy.test.ts`, "selling (Q20)".
- [x] A seller without the item still sells it, by a new Item Copy. `pass.buy.test.ts`, "where a bought item comes from (Q66)". A player seller is refused instead (Q63).
- [x] Quantity above one prices the whole purchase. `pass.buy.test.ts`, by Value and by stated price.
- [x] The default Inventory prompt teaches `buy` with no parrotable example values, and the schema and text formats both carry it. Parse tests in `pass.buy.test.ts`; probes below.
- [x] Probe numbers with in-batch controls, cloud by default, cover buying, selling, haggling and refusal, and show no double charge. The numbers are in the landing. Below.
- [x] Docs name buying and selling, and a changelog fragment exists. How to Play, World Editor: Items, `currency-06.md`.

For you: buy, haggle and sell in a shop scene. Do the trades feel right, and how often does a story sale get refused?

## Landed

**Probe numbers.** `testing/baseline/harness/buy-probe.cli.ts`, cloud `default` (Gemma-4), 12 runs per arm per case, final batch. Control is the prompt and schema with no `buy`. The buy columns are the prompt that ships, run as that batch's arm without the dropped line below. "Right" means the balance moved by exactly the story's amount and the item ended where the story puts it. A refusal case holds still.

| Case | Control right (schema) | Buy right (schema) | Control right (text) | Buy right (text) |
|---|---|---|---|---|
| buy at Value | 2/12 | 12/12 | 0/12 | 0/12 |
| haggle | 12/12 | 12/12 | 0/12 | 0/12 |
| sell at Value | 10/12 | 12/12 | 0/12 | 12/12 |
| sell, haggled | 12/12 | 12/12 | 12/12 | 12/12 |
| buy, can't afford | 0/12 | 12/12 | 0/12 | 12/12 |
| price only talked about | 1/12 | 12/12 | 9/12 | 12/12 |
| gift | 12/12 | 12/12 | 12/12 | 12/12 |
| stat buy | 12/12 | 12/12 | 7/12 | 12/12 |
| stat haggle | 12/12 | 12/12 | 5/12 | 0/12 |
| stat sell | 12/12 | 12/12 | 0/12 | 12/12 |
| stat buy, can't afford | 0/12 | 12/12 | 0/12 | 12/12 |

Double charges in the buy arm: 0 of 132 schema, 0 of 132 text. Text control: 3 on the talked-about price. The control swings between batches: its broke buy double-charged 10 to 11 of 12 in earlier ones. The same-sum drop caught a pay on the schema path in haggle 12/12, stat sell 11/12, sell haggled 7/12, stat haggle 6/12 and stat buy that can't afford 5/12.

The canned rows in the probe all pass with no request: buy plus same-sum pay in three directions, refused buy plus pay, buy said twice, buy plus gain, refused buy plus gain, and an item that can't move.

Items, `inventory-pass-probe.cli.ts`, 6 runs per case, ticket 05 then this ticket: schema changes 30/42 then 32/42, schema guard 12/12 then 12/12; text changes 36/42 then 36/42, text guard 6/12 then 12/12.

These batches predate the last fold-ins: every same-sum pay dropped, and a pay pricing an item with no Currency. The spec session ruled no new run, since no run showed those shapes.

**A prompt line tried and dropped.** "A turn where the money stays where it is has no pay and no buy." Talked-about price was 12/12 with and without it, and text sell-haggle fell from 12/12 to 4/12 with it. The Q70 guard carries that case.

**Ticket 05 tests changed,** because Q54 was corrected and no guard was weakened. In `currencyPayment.test.ts`: "returns change in the fewest coins, created when the payee lacks it" and "draws change from what a tracked payee holds before creating the rest" now assert that the payee gains exactly the amount, and both are renamed. In `statCodeExecutor.currencies.test.ts`, ticket 07's "settles a coin pay with exact change and shows the script the result" now asserts the corrected ops: it pinned the Keeper keeping a whole Gold for a price of 5. In this ticket, "drops one pay per buy" became "drops every pay of the buy's sum" under the Q68 amendment.

**Guards proved.** `.scratch/mutate.mjs` reinstated 27 bugs, one at a time, and each turned a test red. They include the Q54 mint, the rollback, the player selling what they don't hold (Q63), player names before the unresolved rule (Q67), and the same-sum drop. A bare number with an unknown `currency` still refuses, both in `pass.buy.test.ts` and in ticket 05's tests.

**Not verified**

- Local Cydonia: not run. Test targets default to cloud.
- Play in a real shop scene: mounted tests and probes only.

**Known limits**

- One pay for two unpriced buys overcharges. Buy A at Value 40, buy B at Value 50 and `pay` "90" sets A's price to 90, and B still charges 50, 140 in all. No probe run showed this shape.
- Text path, buy at Value, 12/12: the reply wrote "2 Silver" for a 2 Silver, 5 Copper Value, so it charged 20 of 25.
- Text path, haggle and stat haggle, 12/12 each: the reply returned a `pay` and no `buy`, so the money moved and the item didn't. The control fails these too.
- A real tip beside an unpriced buy sets the buy's price, and a real pay of a buy's exact sum counts once. Both are the ruled direction.
- A pay beside a priced buy of another amount settles, so a reply that states two different sums for one trade charges both.
- `inventoryOps` rows in a save can now hold `buy`, with `price` and `currency`.

**For you**

- For you: buy, haggle and sell in a shop scene. Do the trades feel right, and how often does a story sale get refused?
