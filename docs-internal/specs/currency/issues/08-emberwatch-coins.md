# 08: Emberwatch Coins

Status: ready-for-agent
Blocked by: 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

World authoring across prices, traits, Placements and text, where the balance is a judgment call.

## What to build

Emberwatch becomes the Currency showcase. Copper, Silver and Gold are coin items worth 1, 10 and 100, in a coin-backed Currency that replaces the interim one from ticket 01. Each Persona starts with a purse by Placement. Item prices and purses are rebalanced freely, because the current numbers don't bind.

The Gold stat goes, with its Stat Links and descriptors. The Rogue bonus becomes extra coins from the trait. Renown stays. The readme and any text that treats Gold as a stat are updated, and the story's plain mentions of gold stay.

Follow the bundled-worlds skill.

Rulings: Q23, Q24, Q25.

## Acceptance criteria

- [ ] A new game seeds each Persona's purse, and the Inventory tab shows the balance.
- [ ] A Rogue starts with more money than a non-Rogue. A test fails when the bonus is removed.
- [ ] No reference to the Gold stat survives in scripts, stat changes, Requirement Rows, descriptors or the readme. A per-world test proves it.
- [ ] Every priced item uses the coin Currency, and a real shop item can be bought from the starting purse by the `buy` op in a per-world test.
- [ ] Bundled-world hashes update.
- [ ] The docs that use Emberwatch as an example match it, and a changelog fragment exists.
- [ ] The response carries the export-shape reminder.

For you: start a Rogue and another class in Emberwatch and buy something from the keep. Do the prices and purses feel right?
