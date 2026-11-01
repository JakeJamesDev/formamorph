# 06: Buy and Sell

Status: ready-for-agent
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Atomic state changes across items and money, and a prompt change that needs probes.

## What to build

The player types "I buy the sword". The Inventory pass returns `buy`, and the money and the item move together. A haggled price counts when the AI states it. A sale is the same op with the player as the seller, at full Value unless the AI states a price.

A buy of an authored item the seller doesn't hold gains a new Item Copy for the buyer. A buy with no price and no Value is refused, and so is a buy the buyer can't afford. A refusal moves nothing. A name-only Currency moves the item alone.

Rulings: Q7, Q8, Q15, Q16, Q20, Q26.

## Acceptance criteria

- [ ] A `buy` moves money and item together for coin and stat Currencies at the turn commit seam, and a refusal moves neither. A test fails when the money and item stop moving as one.
- [ ] A stated price overrides Value. A stated Currency applies only to a stated price, and defaults to the item's Currency, then the Default.
- [ ] Selling pays the player from a tracked seller and from an untracked one, and refuses a tracked seller who can't pay.
- [ ] A seller without the item still sells it, by a new Item Copy.
- [ ] Quantity above one prices the whole purchase.
- [ ] The default Inventory prompt teaches `buy` with no parrotable example values, and the schema and text formats both carry it.
- [ ] Probe numbers with in-batch controls, cloud by default, cover buying, selling, haggling and refusal, and show no double charge. The numbers are in the landing.
- [ ] Docs name buying and selling, and a changelog fragment exists.

For you: buy, haggle and sell in a shop scene. Do the trades feel right, and how often does a story sale get refused?
