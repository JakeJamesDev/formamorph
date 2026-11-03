# 07: Between-Turn Switch Loop

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

The close's review found this by reading the source. No run has confirmed it, so the failing test comes first. If that test can't fail, report it to the spec session, and this ticket ends with that evidence.

## What to build

A trait granted by an item, whose When a Trait Switches script takes or gives that item, can flip forever between turns. Each commit of Item Copies fires its switches as a new action, so the depth caps and the totals (Q40, Q45) restart each pass. One player action, such as a panel toggle, must stop firing scripts at those limits, across every pass that it starts. The world and its state stay usable, and the author sees a warning once.

Rulings: Q40, Q45, Q46.

## Acceptance criteria

- [x] A failing test through the mounted game view reproduces the loop from a panel toggle before any fix. `GameViewer.betweenTurnLoop.test.tsx` hit its brake at 300 runs; without the brake, the run did not end in 300 s.
- [x] That test passes: the toggle ends, within the existing totals, with one warning. "ends within the switch total, with one warning": exactly 100 runs, one console warning, no console error.
- [x] A test proves one normal switch whose script gives an item still lands, and its item events and switches fire. "lands the item, and its item events and the switch it grants fire".
- [x] The guard fails when each pass starts a new action again. Dropping the totals from `runSwitchScripts` turned 4 tests red at 300 runs; from `runItemScripts`, 1 test red at 101 runs; keeping one totals object past its root, "leaves the next action a full total" red.
- [x] Scripts Reference's limit line says the totals cover what an action starts between turns. Both the switch line and the item line (Q56).

## Landed

**Not verified**

- Nothing in the criteria. The Inventory panel commit, persona change and turn commit settle roots have no mounted test: the compiler requires their totals, and they run the same path.

**For you**

- Nothing only a player can judge.
