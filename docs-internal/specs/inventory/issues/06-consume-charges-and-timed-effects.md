# 06: Consume, Charges And Timed Effects

Status: ready-for-human
Blocked by: 05
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: story-clock expiry inside the turn commit and per-copy charge state.

## What to build

Items can be used up. The panel gets a **Use** button for Consumable items and items with charges. Effect rows (stat and trait) gain the **After Consumed** timing with a story-clock duration or Permanent (Q7); After Consumed rows show only when the item is Consumable or has charges.

Consuming lowers the quantity by one and starts the After Consumed effects (Q16). Use on a charged item spends one charge (Q57): at zero, a Consumable Item Copy goes away and a non-Consumable one stays with Use off until recharged. Charges live in per-copy state, and the panel shows them.

Running After Consumed effects are saved as timed effects on the owner with an end time (Q40), shown in the panel with time left, and expire in the turn commit after the clock advances. A second dose of a running effect restarts its timer (Q64).

Spec: Q4, Q7, Q16, Q40, Q47, Q57, Q64; stories 16, 17, 22, 23, 38–43, 84.

## Acceptance criteria

- [x] Use on a Consumable stack of three leaves two and starts the After Consumed effects (`consume.test.ts` "leaves two of a stack of three"; panel test "uses one Tonic from a stack of three")
- [x] A two-hour effect is gone after the clock passes two hours and reverses exactly; a Permanent one never expires (`consume.test.ts` "ends a two-hour effect…", "never ends a Permanent effect…")
- [x] A second dose restarts the timer and does not stack the effect (`consume.test.ts` stat and trait refresh tests)
- [x] A three-charge wand that is not Consumable stays at zero with Use off; a three-charge Consumable potion is gone after the third use (`consume.test.ts` charges tests; panel test "turns Use off at zero charges")
- [x] Each wand keeps its own charge count when one is given away (`consume.test.ts` "keeps each wand its own count")
- [x] The panel shows charges and timed effects with time left (panel test "lists the running timed effects"; live DOM read on the `items` fixture: "Healing Tonic · Vigor +2 · 2 h left", "2 of 3 charges")
- [ ] Timed effects round-trip through save export; a re-roll restores them
- [x] Frames: `.scratch/frames/inventory-timed-effects-light.png` and `-dark.png` at 1280 wide (Playwright, `items` fixture after Use on the tonic and the wand)
- [x] The item and player docs describe consuming, charges and timed effects; changelog fragment written (World-Editor-Items, How-to-Play, Design-System; `changelog.d/inventory-06.md`)

## Blocked by

- 05

## Landed

**Not verified**
- Timed effects round-trip through save export; a re-roll restores them: the save half is tested (`consume.test.ts` "survives a save round trip", a JSON round trip of the ledger). The re-roll half rests on `itemEffects` already living in the `GameState` snapshot since 04; no test drives a re-roll with a running timed effect.

**For you**
- Use a potion in a world with an After Consumed row, play a few turns, and check the Effects row counts down and the stat returns at the end. Look at the Inventory tab and the stat panel.
- Read the time-left copy ("1 h 20 min left", "1 d 2 h left") in the Effects section.

**Notes**
- The panel, turn and load settles now pass every world entity, so a `you` owner under None or a library persona finds the Custom Persona's stats. Before this, item stat effects on the player did nothing in the live game under those personas (04 and 05 paths).
- Runtime items get no Use button: the panel does not list runtime items until 09. The `consume` op accepts them.
- When Consumed item scripts (Q57) are ticket 11's.
