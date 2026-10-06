# 17: Pin Conflicts Once Per Target

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Recommended model rationale: an algorithmic rewrite of pin-conflict resolution that must keep every precedence and never-together rule exact, shared by a Test Bench rule and an editor note.

## What to build

A placeholder pinned from hundreds of sources opens, edits and checks without freezing (Q25). Today the pin-conflict check is computed from scratch once per pin: each call rescans every pin in the world for the target, then compares the source against every rival, including the never-together tests (two locations, two bands of one stat, two values of one Wildcard, exclusive trait siblings). The Test Bench pin-conflict rule and every Pin Conflict Note in the pins section each call it once per row, so a placeholder with k pins costs about k × (all pins + k comparisons).

Compute the competition for a target once: gather its pins in one pass over a world-wide pin index, order them by the existing precedence (Code Pin > descriptor > location > trait > value pin, later in a kind's list wins), and derive each row's conflict, winner and rule from that one result. The Test Bench rule and the pins section's notes read the shared result. Results, wording and precedence stay exactly as today.

On the pin world (`genLargeWorld.mjs --pins 1`), the rules pass took 18.6 s at 1x, 16.0 s of it in this rule; opening "Mood" (551 pins) did not finish in 15 minutes. Report `npm run profile:editor-speed` pin steps before and after at 6x (Q7).

## Acceptance criteria

- [x] Parity test: for every target and source in the bundled worlds and the pin world, the new conflict result (rivals, winner, rule) equals the current one. **A one-off differential run, not committed; see Results.**
- [x] The pin-conflict rule's findings on the pin world are identical before and after.
- [x] Unit timing: the pin-conflict rule on the pin world runs in under 200 ms unthrottled.
- [ ] Harness `pinTarget` at 6x: "Mood" opens and typing into its Name meets Q1 (no block over 1 s). **Miss; moved to ticket 19 (spec-session ruling).**
- [ ] Harness `open` at 6x on the pin world meets the same bar as the plain bench world. **Measured, not compared under the same load; moved to ticket 19.**
- [x] Guard bites: reintroducing the per-row rescan brings the unit timing back over the limit (numbers recorded).
- [x] Four gates green.

## Results

Measured 2026-10-06. Base is `1cb3f56e`.

| Check | Before | After |
|---|---|---|
| `placeholder-pin-conflict` on the pin world, unthrottled | 14,827 ms | 41 ms |
| `pinConflict` for every row of every target on the pin world (1,151 calls) | 16,835 ms | 193 ms |
| Guard: the index rebuilt on each call (the per-row rescan) | — | 18,183 ms, test red |
| Harness `open` at 6x on the pin world, worst block | not run | 1,258 ms |
| Harness `pinTarget` at 6x | did not finish | did not finish |

- **Parity:** a one-off differential run compared every target × source in the 8 bundled worlds and the pin world (1,151 pins) against base. Rivals, winner and rule matched: 0 differences. The rule's findings matched exactly. The run was not committed: a frozen copy of the old algorithm in the suite would mirror the code. The existing `pinConflict` and rule tests keep the never-together cases covered.
- **Load test:** `pinConflictLoad.test.ts` generates the pin world with 1-pixel images and asserts the rule runs under 200 ms and finds Mood's one conflict. It guards the pin index only: reverting `pinContext` to an entity scan stays under the limit on this world, because its entities own no traits.
- **Each row still tests every rival** (O(k²) per target). That stays under the limit; the rival-name volume it feeds is ticket 19's.
- **`open`:** the worst block is the Edit World click (1,227 ms in one task). Ticket 14 measured 0.78 s on the plain bench world on a quiet machine. Other sessions were running during this run.
- **`pinTarget` miss (to ticket 19):** the conflict notes are no longer the cost. Radix Select renders every item of a closed picker into a fragment, and each row lists every source of its kind: 300 items per location row and about 1,250 per value row on the bench world. Mood's 551 rows mount about 360k items, and its notes list about 250k rival names in total. jsdom, 20 pins on one placeholder, warm mount:

| Part | Time |
|---|---|
| Whole Pins section | 97–107 ms |
| 20 Selects with their items | 76–93 ms |
| 20 Selects, no items while closed | 16–28 ms |
| 20 conflict notes | 7.5 ms |
