# 17: Pin Conflicts Once Per Target

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: an algorithmic rewrite of pin-conflict resolution that must keep every precedence and never-together rule exact, shared by a Test Bench rule and an editor note.

## What to build

A placeholder pinned from hundreds of sources opens, edits and checks without freezing (Q25). Today the pin-conflict check is computed from scratch once per pin: each call rescans every pin in the world for the target, then compares the source against every rival, including the never-together tests (two locations, two bands of one stat, two values of one Wildcard, exclusive trait siblings). The Test Bench pin-conflict rule and every Pin Conflict Note in the pins section each call it once per row, so a placeholder with k pins costs about k × (all pins + k comparisons).

Compute the competition for a target once: gather its pins in one pass over a world-wide pin index, order them by the existing precedence (Code Pin > descriptor > location > trait > value pin, later in a kind's list wins), and derive each row's conflict, winner and rule from that one result. The Test Bench rule and the pins section's notes read the shared result. Results, wording and precedence stay exactly as today.

On the pin world (`genLargeWorld.mjs --pins 1`), the rules pass took 18.6 s at 1x, 16.0 s of it in this rule; opening "Mood" (551 pins) did not finish in 15 minutes. Report `npm run profile:editor-speed` pin steps before and after at 6x (Q7).

## Acceptance criteria

- [ ] Parity test: for every target and source in the bundled worlds and the pin world, the new conflict result (rivals, winner, rule) equals the current one.
- [ ] The pin-conflict rule's findings on the pin world are identical before and after.
- [ ] Unit timing: the pin-conflict rule on the pin world runs in under 200 ms unthrottled.
- [ ] Harness `pinTarget` at 6x: "Mood" opens and typing into its Name meets Q1 (no block over 1 s).
- [ ] Harness `open` at 6x on the pin world meets the same bar as the plain bench world.
- [ ] Guard bites: reintroducing the per-row rescan brings the unit timing back over the limit (numbers recorded).
- [ ] Four gates green.
