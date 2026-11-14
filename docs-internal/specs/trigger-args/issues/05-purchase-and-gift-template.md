# 05: Purchase on buys and a gift template

Status: ready-for-agent
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

- [ ] A priced buy and an unpriced buy carry `purchase` on both sides (tests through the pass).
- [ ] A buy from location stock reads the location as `from`, with `purchase` (test).
- [ ] A sale by the player reads `from === persona` with `purchase` (test).
- [ ] A Sunmeadow-shaped check: the gift template's guard raises the receiver's stat for the player's gift only, not for a shop buy, a cast-to-cast transfer or a script grant (test).
- [ ] The template appears for When Gained item boxes only.
- [ ] Docs and hover cards describe `purchase`; the help vectors are rebuilt.
- [ ] Each guard is shown to bite by reinstating the bug.
