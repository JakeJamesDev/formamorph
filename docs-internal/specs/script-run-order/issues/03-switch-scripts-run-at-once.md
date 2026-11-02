# 03: Switch Scripts Run At Once

Status: ready-for-human
Blocked by: 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This ticket owns firing events between scripts in the chain. Ticket 04 uses the same path for item events.

## What to build

When a script switches a trait, its When a Trait Switches scripts run at once, nested, before the next script in the list. The next script reads their full result. The existing switch depth cap stays.

Ruling: Q5.

## Acceptance criteria

- [x] A test through `runStatCodeTurn` proves the next script reads what a switch script wrote. (`statCodeTurn.nestedSwitch.test.ts`: "a script that switches a trait")
- [x] A test proves a chain past the depth cap stops firing and reports as it does today. ("the depth cap")
- [x] A test proves a trait that two scripts switch on and off in one timing fires what each switch fires, in order. ("fires what each switch fires, in order")
- [x] A test proves a re-roll fires the switches again from its clean start, with nothing counted twice. ("a re-roll", both tests)
- [x] A test proves the final `gateStats` applies no penalty to a stat a script moved, across a nested switch run (Q29). A nested run's timing starts at its firing, so ticket 02 left this gap. ("the final gateStats across a nested switch run")
- [x] Each new guard fails when switch runs move back to the end of the batch. (18 tests red under that mutation. The rest guard another bug, listed below)
- [x] Scripts Reference's Order of Effects and When a Trait Switches sections describe this, and the changelog entry from ticket 02 covers it. (Read in the diff. The Tool fix has its own Fixed line)

## Landed

**Rulings the spec session added mid-build (Q34 to Q40)**
- A nested run clears the Tool fields, so a Tool runs once, and switch scripts fire after an On Call Tool and its replay. This bug shipped, so it has its own changelog line.
- `switchRowOrder` is a required field, and every switch run reads it as its row order.
- During AI Output fires nothing per script. Its landing diffs the whole reply once.
- Regenerate Choices fires nested runs with silent prompts and discards their writes.
- One action fires at most `SWITCH_RUN_TOTAL` (100) switch runs across all depths. Measured before the total, in node, three world switch scripts that each flip one trait ran 9,840 scripts in 61 s. `runTotal` is exported for ticket 04's item events.

**Ask from an On Call Tool**
- A switch script's `player.ask` goes to the Tool run's prompt host, and answers as the Tool's own ask does. ("hands the switch script the prompt host of the Tool's run")

**Guards proven by their own mutation**
- Each reinstated bug failed its test: outer `rowOrder`, kept `triggers`, kept `replayed`, kept `triggersOnly`, kept `switchedFrom`, lost choices, doubled depth, per-script firing in During AI Output, discarded choices-only runs, and a total that never refuses, warns twice, or resets per depth or per item run.

**Tests flipped**
- None. Every existing test stayed green with no edit.

**Measured**
- `statCodeTurn.ts`: 94.69% statements, 93.24% branches, through the `statCodeTurn.*` tests alone. The uncovered lines are `withoutBodies`, `baseWritesOf` and `playedScripts`, none changed here.

**Not verified**
- A live game: nothing here renders, and the runner's tests drive it.
- Check Scripts fires no nested run (Q38). A later script there doesn't read a switch script's write, so a script that needs that write can rarely report a false finding.
- A nested switch script's inventory write inside an item run now lands at that item level. No test covers it. Ticket 04's "land once" criterion should.
- The harness and the test fixture pass an empty `switchRowOrder`, so their switch scripts run in owner order and ignore `order`. Play always passes the tab's rows.

**For you**
- Play a world where a script switches a trait that has its own **When a Trait Switches** script. A script lower in the list reads the result on the same turn.
- Drag **When a Trait Switches** rows across two homes in the **Scripts** tab, then switch the trait from a script. They run in the dragged order.
