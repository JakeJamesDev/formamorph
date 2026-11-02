# 02: Coin Currencies

Status: ready-for-agent
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

- [ ] The Currencies entry adds, reorders and removes coin rows of an item and a worth.
- [ ] The editor enforces: exactly one row worth 1, unique item and worth per Currency, Stackable items only, and an item in one Currency at most. A test fails when each rule is removed.
- [ ] The coin Value fields store base units. Changing a coin's worth keeps each item's stored total and shifts its breakdown.
- [ ] The Breakdown handles gaps, zero and a value below the second coin, largest coin first. Tests call the module and don't repeat its math.
- [ ] The item popup, the Formaquestion player view and the world index show the Breakdown.
- [ ] The Items fixture covers a coin Currency.
- [ ] Frames of the coin rows and the coin Value fields, in both themes at 1366: `.scratch/frames/coin-rows-light.png`, `coin-rows-dark.png`, `coin-value-light.png`, `coin-value-dark.png`.
- [ ] `CONTEXT.md` gains Coin, docs name coin Currencies, and a changelog fragment exists.
- [ ] The response carries the export-shape reminder.

For you: set up Copper, Silver and Gold and price an item in it. Do the fields read faster than one total?
