# 03: Balances

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Stat Link resolution and a prompt-visible chip change that needs probe judgment.

## What to build

The player sees one balance row per Currency in the Inventory tab, stat-backed included and name-only excluded. The narrator reads each listed item's worth and each present owner's balance in the `<INVENTORY>` chip.

This ticket owns Balance in the Currency module. An owner with no authored balance reads as untracked, not as zero. Ticket 05 reads it.

Rulings: Q8, Q12, Q18, Q21.

## Acceptance criteria

- [x] Balance covers each backing: coins at the owner, a Persona or entity stat through Stat Links, a Global Stat as a shared wallet, and an untracked owner. `currencyBalance.test.ts`, with links through `seedWorldEntityStats`.
- [x] Hidden and unidentified coins don't count, and a Bound coin does. A test fails when each rule is removed. Each bug reinstated went red, with 9 other mutants.
- [x] The Inventory tab shows the rows and updates when coins move. `GamePanels.inventoryHere.test.tsx`, Money block; DOM read on the `items` fixture.
- [x] `<INVENTORY>` carries worth and balances in each context format, and an untracked owner shows none. `inventoryContext.test.ts`, markdown, xml and plain.
- [x] The chip's sample scene and What the AI Reads show the new lines. Corpus snapshot and `WorldDetailsManager.chipOptions.test.tsx`.
- [x] Probe numbers with in-batch controls, cloud by default, show the narrator's stated prices against a control. The numbers are in the landing. Fair price: control 0/90, chip 16/90. Any price: control 17/90, chip 37/90. Broke player gets the item: control 7/30, chip 6/30.
- [x] Frames of the Inventory tab with a coin and a stat balance, in both themes at 1366: `.scratch/frames/balances-light.png`, `balances-dark.png`. Crops of the panel at a 1366 viewport.
- [x] `CONTEXT.md` gains Balance, docs name balances, and a changelog fragment exists. Read in the diff.

## Landed

**Not verified**

- Nothing is left unticked. The probe's prices come from Sedge Landing with one opening turn, not from a played shop.

**For you**

- For you: play a shop scene. Does the narrator state fair prices and respect what the player can afford? The probe says the chip names prices but doesn't stop a sale the player can't pay for (Q49).
- Frames: `.scratch/currency-03/frames/balances-light.png`, `.scratch/currency-03/frames/balances-dark.png`. The amount uses meta text, as an Effects row does. Check that it reads well enough for money.
- On an earlier page, a stat row shows that turn's value and a coin row shows the latest coins, as **Carried** does. Check that this is acceptable.
