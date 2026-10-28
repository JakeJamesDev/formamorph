# 06: Consume, Charges And Timed Effects

Status: ready-for-agent
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

- [ ] Use on a Consumable stack of three leaves two and starts the After Consumed effects
- [ ] A two-hour effect is gone after the clock passes two hours and reverses exactly; a Permanent one never expires
- [ ] A second dose restarts the timer and does not stack the effect
- [ ] A three-charge wand that is not Consumable stays at zero with Use off; a three-charge Consumable potion is gone after the third use
- [ ] Each wand keeps its own charge count when one is given away
- [ ] The panel shows charges and timed effects with time left
- [ ] Timed effects round-trip through save export; a re-roll restores them
- [ ] Frames: `.scratch/frames/inventory-timed-effects-light.png` and `-dark.png` at 1280 wide
- [ ] The item and player docs describe consuming, charges and timed effects; changelog fragment written

## Blocked by

- 05
