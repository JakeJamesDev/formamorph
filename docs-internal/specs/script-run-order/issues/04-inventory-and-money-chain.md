# 04: Inventory and Money Chain

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Currency's two-script undercharge ends here. The Currency spec session edits its Q61 once this spec lands.

## What to build

A script's inventory writes land before the next script, with their automatic unequips and their item events nested at once, under the existing depth cap. A later script reads the Item Copies as they stand. `pay` and `balance` read every earlier write in the chain, including direct stat writes and `give`, and the run's own. Two scripts that pay from one balance charge the full sum. A failed script's `pay` adds nothing.

Rulings: Q4, Q5, Q6, Q15.

## Acceptance criteria

- [x] A test through `runStatCodeTurn` proves a later script reads an earlier script's `give`, `gain` and equip. (`statCodeTurn.inventoryChain.test.ts`: "a later script reads an earlier script's inventory write")
- [x] A test proves an item event fired by a script runs before the next script, and the depth cap still stops it. ("runs before the next script", "stops at the depth cap with its line")
- [x] A test proves a loop of item events and switch runs stays bounded. Nested item events grow as a tree, as switch runs did (Q40), so they share or match that total for one action. (`ITEM_RUN_TOTAL` matches it: "stays bounded when each run branches", "caps both kinds together", and "fires the item's level … through a switch run")
- [x] Tests prove two scripts paying from one balance charge the full sum, for a stat Currency and a coin Currency. ("money across scripts")
- [x] A test proves a third script's balance read includes earlier payments and direct writes. ("reads earlier payments and direct writes in a third script's balance")
- [x] A test proves a script that fails after a `pay` moves no money. ("moves no money for a script that fails after its pay")
- [x] A test proves inventory writes land once in the turn's result, with no double apply when the turn commits or re-rolls. ("lists each inventory write once", and `GameViewer.scriptInventory.test.tsx`: "land once … when the turn commits", "land once when a stat re-roll replays them")
- [x] A test proves a nested switch script's inventory write inside an item run lands once, at that item level. Ticket 03 left this untested. ("lands a nested switch script's write once, at its item level")
- [x] A test proves a stat re-roll keeps the turn's location, time, scene entities, memories and diary lines. Ticket 05 left this criterion open because its drop has no reachable seam, so this test may need one moved out of the game view. (`GameViewer.scriptInventory.test.tsx`: "keeps the turn's location, time, scene entities, memories and diary lines", through the mounted game, so no seam moved)
- [x] Each new guard fails when the script's money state reads the start of the timing again. (30 mutations ran. Each listed below turned its guard red. The one under Not verified didn't)
- [x] Scripts Reference's Items and Currencies sections describe this, and the changelog entry from ticket 02 covers it. (Read in the diff. The `balance` help text in `statCodeSurface.ts` changed with it)

## Landed

**Rulings from the spec session (Q41 to Q47)**
- A later script reads Item Copies and automatic unequips, not an item's granted traits or stat effects. Those land once in the commit's settle. The docs name the gap.
- During AI Output applies writes for later scripts to read. Its settle and item events run once at the landing, after its switch runs.
- `balance` counts the run's own writes. `pay` plans over them but can't spend a copy the same run made, and its `reason` says the next script can.
- A switch run's inventory writes now land between turns. A failing test came first: `Vigor` landed and the `give` did not.
- Check Scripts now reads the world's items, slots and Currencies, and applies inventory writes to its chain with no item event.

**No changelog line, against Q46**
- Q46 asked for a Fixed line, and the spec session asked for one on Q47 if that error shipped. `git grep itemsPrelude v3.5.2` finds nothing, so script item verbs aren't in a release and neither bug shipped. The changelog rule has an unreleased fix update its entry, and ticket 02's entry covers this behavior.

**Guards proven by their own mutation**
- Each reinstated bug failed its test: copies not chained, in `afterRun` and in the landing; item events after the batch; no item total; item depth reset, and reset through a switch run; no depth cap; During AI Output firing per sentence; a landing with no held events, no settle, no uses or no unequip writes; no settle per script; an item run keeping its writes; a choices-only run landing; an item run keeping a Tool's call; money ignoring own stats or own verbs; `pay` spending new copies; the plain refusal reason; no clamp under a payment; a switch run's landing dropped; a landing applied twice; a settle or equip reading live stats; a re-roll landing its scene writes; Check Scripts with no apply, no items or no money.

**Tests flipped**
- `statCodeExecutor.currencies.test.ts`: "adds a payment to the value the script wrote" now reads that write in `balance` (Q15). "does not let a second payment spend the change" also checks the new reason.

**Measured**
- Through the new and affected tests: `scriptMoney.ts` 97.43% statements, 83.6% branches. `statCodeTurn.ts` 91.44% statements, 81.88% branches.

**Not verified**
- `sameCopies` in the landing: a commit stores a copy of its list, so a render during a run would read as moved Item Copies. I couldn't force that render in a test, because a test's run has no gap for it. The mutation back to identity fails no test.
- The landing's re-apply when Item Copies really moved during a run, such as a panel write. No test reaches it. A re-applied write that names a copy the chain made skips, with a log line.
- A live game beyond the mounted tests.

**Known gaps, not fixed here**
- Regenerate Choices (Q37) reads the end-of-turn Item Copies, as it did before this ticket. A script that gives an item and then checks it reads one too many. The fix needs the turn's Inventory pass replayed quietly.
- An On Call Tool's inventory write during a reply: the output run read its opening copies, so held item runs and output payments don't read that write, and a stat Currency paid by both can undercharge.
- A World Tool's item writes aren't in its saved writes, so an On Call Tool's `give` or coin `pay` doesn't come back on a stat re-roll. Saving them changes the save shape.

**For you**
- Play a world with two scripts that `pay` from one Currency in one turn, one over a stat and one over items: each charges in full.
- Switch a trait on the Traits tab when its When a Trait Switches script gives an item: the item arrives.
- Run **Check Scripts** on a world whose scripts name an item or a Currency: no false error.
