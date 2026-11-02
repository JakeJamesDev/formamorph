# 04: Inventory and Money Chain

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Currency's two-script undercharge ends here. The Currency spec session edits its Q61 once this spec lands.

## What to build

A script's inventory writes land before the next script, with their automatic unequips and their item events nested at once, under the existing depth cap. A later script reads the Item Copies as they stand. `pay` and `balance` read every earlier write in the chain, including direct stat writes and `give`, and the run's own. Two scripts that pay from one balance charge the full sum. A failed script's `pay` adds nothing.

Rulings: Q4, Q5, Q6, Q15.

## Acceptance criteria

- [ ] A test through `runStatCodeTurn` proves a later script reads an earlier script's `give`, `gain` and equip.
- [ ] A test proves an item event fired by a script runs before the next script, and the depth cap still stops it.
- [ ] A test proves a loop of item events and switch runs stays bounded. Nested item events grow as a tree, as switch runs did (Q40), so they share or match that total for one action.
- [ ] Tests prove two scripts paying from one balance charge the full sum, for a stat Currency and a coin Currency.
- [ ] A test proves a third script's balance read includes earlier payments and direct writes.
- [ ] A test proves a script that fails after a `pay` moves no money.
- [ ] A test proves inventory writes land once in the turn's result, with no double apply when the turn commits or re-rolls.
- [ ] A test proves a nested switch script's inventory write inside an item run lands once, at that item level. Ticket 03 left this untested.
- [ ] A test proves a stat re-roll keeps the turn's location, time, scene entities, memories and diary lines. Ticket 05 left this criterion open because its drop has no reachable seam, so this test may need one moved out of the game view.
- [ ] Each new guard fails when the script's money state reads the start of the timing again.
- [ ] Scripts Reference's Items and Currencies sections describe this, and the changelog entry from ticket 02 covers it.
