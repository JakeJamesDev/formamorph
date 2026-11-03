# Spec: Script Run Order

Status: done
Status note: Closed 2026-11-03, tickets 01 to 08, last landing 8d21caff3. Review: spec text corrected, with known gaps in Q52. Closed red: `electron/llamaServer.test.mjs` failed under suite load and passes alone. Tickets 09 to 11 landed after the close, last d8d6d19d1, with no full gate since. Ticket 11's failure never reproduced (Q66).
Spec session: script-run-order — spec

## Problem Statement

The Scripts tab lets an author drag scripts into an order, and the tab says they run in that order. The order only decides whose write lands last. Every script in a timing reads one Sandbox Snapshot, so no script sees what an earlier script wrote.

Authors meet this as lost effects. Two scripts that each take 5 Health take 5, not 10. A hub's write reaches Health's own script only on the next turn. A Blueprint stat that adds to a global stat adds once, however many owners run it. The Test Bench warns about these cases, but the author still can't build a step-by-step chain.

The same rule breaks money. Two scripts that `pay` from one balance in one turn each plan against the same start, and the later stat write wins, so the player is undercharged.

The list also misleads in smaller ways. Blueprint rows show last but run inside each owner. Timings are listed Before, After, During, Start, Switch, which is not the order a turn reaches them.

## Solution

Scripts run one by one: by timing, then top-down in the list. Each script reads everything the earlier scripts wrote. This holds for all worlds and every timing, with no new mode and no migration. World files don't change, and a save gains one optional field (Q48).

The Scripts tab becomes the truth. A row's place is where it runs, and one Blueprint row runs for all its owners back to back. Timings are listed in the order a turn reaches them.

Money needs no ledger, because each script's payment plans over what the earlier scripts left.

## Rulings

Settled with the user on 2026-11-02. A ruling reopens on new evidence, never on a new opinion.

| # | Ruling |
|---|---|
| Q1 | A script reads what earlier scripts in its timing wrote, in list order. All worlds, every timing. No mode, no world or save migration, no version bump |
| Q2 | Live community survey is limited to the one heavy script author's two latest worlds. No other community world is read |
| Q3 | That survey's +1 on each world's public download count is accepted |
| Q4 | Every write chains: stats, traits, placeholder pins, lore, choices, inventory, Bodies, location, clock, memories, the diary, discover and entity moves |
| Q5 | When a script switches a trait or changes inventory, the When a Trait Switches and item scripts it fires run at once, nested, before the next script in the list. The existing depth caps stay |
| Q6 | A script that throws or times out adds nothing, including a `pay` before the error. Later scripts read the state as if it never ran, and they still run |
| Q7 | The heavy script author hears early and tests a build before the release. The changelog tells everyone. The user makes the contact |
| Q8 | One Blueprint row runs for all its owners back to back, at the row's place in the list. With no `order`, Blueprint scripts now run after entity scripts |
| Q9 | Library entities' scripts run after every row in the list, in pick order, ignoring any `order` they carry. World Tools stay first. Item scripts run on their events |
| Q10 | Scripts with no `order` keep today's default sort. Only a drag or an add writes an `order` (Q25) |
| Q11 | The Test Bench's Two Scripts, One Field finding stays, reworded, and shows the writers' list order |
| Q12 | An open `player.ask` holds every later script in its timing, including ones that never name `player`. The docs get corrected |
| Q13 | `previous` stays the turn's start value for every script. At a timing that reads the turn start, it is the value when that timing began. `value` and `delta.actual` include earlier scripts' writes. `delta.ai` and `delta.regen` keep their meaning |
| Q14 | A re-roll uses the same chain from its clean start. A World Tool's replayed writes go at the head, and later scripts read them. Script Prompts ask again as they do today. Test Bench runs use the same chain |
| Q15 | The money ledger ticket closes. Currency Q61 changes: a balance read reflects every earlier write in the chain, including direct stat writes and `give`, and the run's own. The Currency spec session makes that edit once this spec lands |
| Q16 | This effort lands before the release that carries Currency. Currency's tickets 06 and 08 continue on their own |
| Q17 | During AI Output chains on each sentence: a later script reads the earlier scripts' writes. The real landing stays with After the AI, and a stopped turn applies none |
| Q18 | The Scripts tab lists timings in this order: At Game Start, Before the AI, During AI Output, After the AI, When a Trait Switches |
| Q19 | The Timing menus, Add Script, templates and Code Insert use the Q18 order. AI prompt text keeps its current order, so it needs no probe |
| Q20 | The test seams are the ones under Testing Decisions. No new seam |
| Q21 | (ticket 01) The played persona no longer runs ahead of other entities. Entity rows run in the tab's order, which is authored entity order. A library persona runs after the list, as Q9 says |
| Q22 | (ticket 01) A library entity's unit from a linked Blueprint stat or trait runs after the list with its other scripts. Only world-entity owners join the row's back-to-back run, in authored owner order |
| Q23 | (ticket 01) A link override is its own tab row per owner, and its unit runs at that row's place, not at the Blueprint row's |
| Q24 | (ticket 01) Timings become start, before, output, after, switch in the shared list. The Formaquestion help tool's schema and code-rider prompt read a separate list in the old order, pinned by a byte test |
| Q25 | (ticket 01) Add Script and Code Insert number that timing's rows in the tab's current order, as a drag does, and give the new script the last number. A new script reads everything above it. A world with no add or drag stores no `order`. This amends Q10, whose two clauses couldn't both hold |
| Q26 | (ticket 02) Check Scripts walks each timing in the Scripts tab's order, with each script over a fresh snapshot of the earlier writes. It still runs every filled script so it can check them all, but a script that play wouldn't run, such as one on an off trait, adds nothing to the chain. A failed script adds nothing. Test Code and the help code test run one script, so they don't change |
| Q27 | (ticket 02) During AI Output's `previous` is the value at the reply's start, for every sentence. A switch run or item event begins when it fires, so its `previous` is the value at that firing |
| Q28 | (ticket 02) Tests that assert one snapshot flip to the chain result, including the two in the entity stats and output test files, and the five ticket 02 reported: a hub's write hidden from the target's box, the capped ask, the switch landing after the run, two stats switching one trait, and a trait script on two owners. Any other failing test still goes to the spec session first |
| Q29 | (ticket 02) Penalties stay gate-view only. Each step's gate view applies a penalty to a stat not moved since the timing began, computed from the unpenalized value so it never stacks. The final `gateStats` is exact, so an early gate can read a penalty on a stat a later script moves |
| Q30 | (ticket 05) The diary stays write-only, with no new read in the sandbox. A diary line chains in that a later `diary` call can name an entity an earlier script discovered, and the lines stay in order |
| Q31 | (ticket 05, amended at the close) `memories.add` reads as the turn's own memory row, as the docs define it and the commit stores it. `memories.pin` reads as a Custom row. A later script's row verb on either lands on it. The user kept both calls: an added line is judged and sent when recalled, and a pinned line is always sent |
| Q32 | (ticket 05) Every kind of world write chains, including memory row verbs and `meet`. A described discover joins the cast, and a bare one adds nothing until the pass. Every clock read reflects an earlier advance, and each script adds only its own minutes |
| Q33 | (ticket 05) A stat re-roll's chain starts over the kept turn state. Later scripts read earlier writes in that chain, and its scene writes then drop as they do today |
| Q34 | (ticket 03) A nested run clears World Tool triggers and replayed writes, so a Tool runs once. A trait switch from an On Call Tool or its replay fires its switch scripts at once, as Q5 says of any script. They use the prompt host of the Tool's run |
| Q35 | (ticket 03) A drag at When a Trait Switches holds in every run. Nested switch scripts run in that timing's tab order, and no caller can leave that order out |
| Q36 | (ticket 03) During AI Output is the one exception to Q5. Its scripts fire nothing per sentence, because Q17 keeps the landing with After the AI. The whole reply's switches fire once there, so a trait switched on and off across one reply fires nothing |
| Q37 | (ticket 03) Regenerate Choices fires nested runs with silent prompts and discards their writes, so its choices match a real After the AI run |
| Q38 | (ticket 03) Check Scripts fires no nested runs and keeps its own sample run per switch script. A later script there doesn't read a switch script's write, which can rarely give a false finding. This is a known gap beside story 28 |
| Q39 | (ticket 03) Tests that assert a switch run lands after the batch flip to the new result and are listed at landing. Any other failing test goes to the spec session first |
| Q40 | (ticket 03) The depth cap stays, and one action also fires at most 100 switch runs across all depths. Past that, a switch still applies, fires no script and warns once. A looping author bug otherwise grows as a tree: three scripts measured 9,840 runs and 61 s in Node |
| Q41 | (ticket 04) A later script reads an earlier script's Item Copies and automatic unequips, not the item's granted traits and stat effects. Those land once in the turn's commit settle, and the docs name the gap. An equip's requirement check reads the chain's stats and traits. This is the user's named exception to Q4 |
| Q42 | (ticket 04) During AI Output applies each sentence's inventory writes for later scripts to read, with no settle and no item event. The whole reply's item events and unequips fire once at the landing, after its switch runs. A stop or retract drops them all |
| Q43 | (ticket 04) `balance` counts the run's own `give`, verbs and direct stat writes, and `pay` plans over them. `pay` can't spend a copy the same run made, because it has no id until the script lands. It refuses with a reason, and the next script can spend it |
| Q44 | (ticket 04) A script's landing runs in this order: its writes, its copies with their settle, its switch runs, then its item events (op events, then unequips). An item run's nested runs follow the same order |
| Q45 | (ticket 04) Item events have their own total of 100 per action. Past it, writes still land with one log line. Switch depth and item depth both carry through nesting, so a loop across the two stays capped |
| Q46 | (ticket 04) A switch run's inventory writes land between turns too. A failing test comes first. The bug never reached a release, so ticket 02's changelog entry covers it with no Fixed line |
| Q47 | (ticket 04) Check Scripts gets the world's items, slots and Currencies, so a script that names one no longer reports a false error. It applies inventory writes to its chain and fires no item event, as Q38 says of switch runs |
| Q48 | (ticket 06) Ticket 04's three gaps get fixed before the spec closes: an On Call Tool's inventory write reaches the output run and held item runs, a stat re-roll brings back that Tool's item writes, and Regenerate Choices reads Item Copies as a real After the AI run does. The saved writes gain an optional field, an additive change to the save shape |
| Q49 | (ticket 06) A replayed op that names a copy the same turn made skips with a log line, and the docs name it. Saved writes don't store copy ids |
| Q50 | (ticket 06) A replayed `give` or coin `pay` fires its item events again, so a rolled result in those scripts can differ. Only the Tool's own writes come back as saved |
| Q51 | (ticket 06) Regenerate Choices replays quietly from the pre-turn copies: the Before the AI scripts, the On Call saved writes, then the Inventory pass. During AI Output scripts don't replay, so an After the AI script there reads no copy they wrote, and the docs name it |
| Q55 | (ticket 07) Only the two totals (Q40, Q45) carry across the passes of one action. The depth caps stay per pass, so a legal long chain still runs. Each total warns once per action through its own channel: a console warning for switches, one log line for items |
| Q56 | (ticket 07) One action is one between-turn root: a trait toggle, an inventory panel commit, a persona change, one turn's commit settle, or one script landing during a turn. A turn's sandbox runs keep their own totals, and a second player toggle gets its own. This loop never reached a release, so it needs no changelog line |
| Q57 | (after the close, per Q4) A script's equip fits a Body an earlier script wrote in the chain, in `56d46add1`. Two gaps stay known: the Body log line leaves out what the chain unequipped when one chain has both write kinds, and the AI Inventory pass still reads the render's Bodies |
| Q59 | (after the close) The process table test that failed the close gate gets ticket 11 |
| Q60 | (after the close) Q57's two Body gaps get ticket 09 |
| Q61 | (after the close) The review's judgement-call findings get ticket 10: comment wording, duplication, names and copy |
| Q62 | (ticket 11) The user allowed one bounded stress run to reproduce the failure: about 8 busy-loop processes for about 60 s |
| Q63 | (ticket 11) `listProcesses` rejects with an Error naming the cause (timeout, spawn error or non-zero exit), instead of resolving an empty or partial table |
| Q66 | (ticket 11) The bounded stress run didn't reproduce the failure, so the ticket ships Q63 with no repro and runs no more stress. The next failure names its cause. The cause itself stays unproven, and the landing says so |
| Q67 | (ticket 10) `runItemScripts` takes one inventory step, and its test call sites change arguments only. `CONTEXT.md` defines Script Chain for code and specs. User-facing docs don't use the word: they say what happens, such as "the writes add up" |
| Q64 | (ticket 09) Regenerate Choices' quiet replay carries script Body writes, so the Inventory pass fix doesn't open a new disagreement with the live turn. Q52's other replay limits stay |
| Q65 | (ticket 09) A trait a script turns on reaches its Body row only at a settle. This stays out of ticket 09 as a known gap, named at landing |
| Q52 | (close) The between-turn loop and the persona order get tickets 07 and 08. Two gaps stay known and unticketed: `rowOrder` stays optional with a fallback, though play always passes it; and the Test Bench and Regenerate Choices edges stay, as Check Scripts counts a Blueprint row's write once, and a quiet replay reads live Body picks and enabled stats and fires no script on an item settle's switch |

## User Stories

1. As a world author, I want a script to read what the script above it wrote, so that I can build effects in steps.
2. As a world author, I want two scripts that each take 5 Health to take 10, so that neither effect is lost.
3. As a world author, I want a hub's write to Health to be in Health's own script on the same turn, if Health is lower in the list, so that a cap applies at once.
4. As a world author, I want dragging a row to change what later scripts read, so that the Scripts tab is a real control.
5. As a world author, I want a row's place in the list to be where it runs, so that I can trust the tab without reading the docs.
6. As a world author, I want one Blueprint row to run for all its owners together, so that one row means one place in the order.
7. As a world author, I want a Blueprint stat's write to a global stat to count once per owner, so that each owner's effect adds up.
8. As a world author, I want a new script to go to the bottom of its timing, so that it can read everything above it.
9. As a world author, I want an undragged world to read top-down as the tab lists it, so that I need no drag to know the order.
10. As a world author, I want timings listed in the order a turn reaches them, so that the list reads like a turn.
11. As a world author, I want the Timing menu and Add Script to use that same order, so that every list agrees.
12. As a world author, I want a later script to read an earlier script's trait switch, so that I can react on the same turn.
13. As a world author, I want a trait's switch script to finish before the next script runs, so that the next script reads its full result.
14. As a world author, I want a later script to read an earlier script's inventory change, so that a give and a check work in one timing.
15. As a world author, I want a later script to read an earlier script's location, clock and placeholder writes, so that no kind of write is an exception.
16. As a world author, I want a script switched off by an earlier script not to run, so that a trait's scripts stop when the trait stops.
17. As a world author, I want a script switched on by an earlier script to run if it is lower in the list, so that a switch takes effect in order.
18. As a world author, I want a failed script to add nothing, so that later scripts never read half an effect.
19. As a world author, I want later scripts to still run after a failure, so that one bug doesn't stop the whole timing.
20. As a world author, I want `previous` to stay the turn's start value, so that a script that compares against the turn start keeps working.
21. As a world author, I want `delta.actual` to show the whole move so far, so that a script can read what the turn has done.
22. As a world author, I want During AI Output scripts on one sentence to read each other's writes, so that this timing has the same rule.
23. As a world author, I want a stopped turn to apply none of its During AI Output writes, so that a stop behaves as it does today.
24. As a world author, I want an open `player.ask` to hold later scripts, so that a later script can use what the answer changed.
25. As a world author, I want a World Tool's writes to come ahead of the list, so that every row can read what the AI's call did.
26. As a world author, I want a library entity's scripts to run after the list, so that they can't break my order with a number from another world.
27. As a world author, I want the Test Bench to show who writes a field and in what order, so that I can check how writes stack.
28. As a world author, I want the Test Bench to compute with the same chain as play, so that what it shows is what a turn does.
29. As a world author, I want the docs to describe one rule, so that I don't have to learn exceptions.
30. As a world author, I want my world file to stay as it is, so that I need no re-export.
31. As a player, I want a re-roll to start clean, so that its effects never count twice.
32. As a player, I want a shop script and a quest script that both charge me to charge me both amounts, so that the balance is correct.
33. As a player, I want turns to feel no slower, so that the change costs me nothing.
34. As the heaviest script author, I want a test build before the release, so that I can fix my worlds first.
35. As a player with a saved game, I want my save to load unchanged, so that I keep my game.

## Implementation Decisions

**One run order, shared.** A single function produces the run order: World Tool units, then the rows in the tab's order, then the units with no row. Both the Scripts tab and the turn read it, so they can't drift. The rows stay world scripts, global stats, global traits, each entity's stats and traits, Blueprint stats, Blueprint traits. Scripts with an `order` sort first, as `inRunOrder` does today.

**The chain.** The per-script loop replaces the two branches at the end of the run, the one-by-one loop and the `Promise.all`. Each unit gets a fresh Sandbox Snapshot of the state the unit before left. The existing `afterRun` and `chainedResult` are the base. `afterRun` grows to carry every write in Q4. Switch runs and item events already chain this way, so this is one mechanism with a wider reach.

**In force at the script's turn.** Whether a stat is on and a trait is in force reads at that script's turn, not at the start of the timing. This follows from Q4 and Q5 and is the behavior in stories 16 and 17.

**Writes land per script.** Trait switches, bounds, values and placeholder pins apply after each script, in the existing order. Penalties stay in the gate view (Q29). Inventory writes need the apply and settle step at each script, so the turn entry point takes the step that `runItemScripts` already takes.

**During AI Output and stat re-rolls read a chain they don't land.** Later scripts read earlier writes, but what lands stays as it is today. For During AI Output, that is with After the AI. A stat re-roll keeps the turn's location, time, scene entities, memories and diary lines, so its chain can read a location write that the re-roll then discards. The stat re-roll part is derived from Q4, Q14 and the existing keep rule, and the Implement session may raise it with the spec session.

**Money.** A script's money state builds over the chained state, so `pay` plans over earlier scripts' payments, direct writes and `give` calls. The run's own direct writes count too (Q15).

**Timing order.** The shared timing list takes the Q18 order. The AI prompt text and the help tool's schema read a list of their own in the current order, so their bytes don't change. Their request bodies must stay byte-equal.

**Sandbox Snapshot keeps its name.** Its meaning narrows from one per turn to one per script. CONTEXT.md and its Timing and After the AI entries change with this.

**Docs to change.**
- Scripts Reference: Order of Effects, One snapshot per run, Owner order, Two Scripts, One Field, the prompts rule that a script that never names `player` is not held, and the "later in the same run" lines.
- Scripts Guide: Run Order, A Note on Accumulating Stats, the Scripts tab how-to.
- Test Bench: Issues.

**Export shape.** Worlds are unchanged, and `order` already exists. A Tool call's saved writes gain an optional `inventory` field (Q48), an additive save change. The version doesn't change.

**Measured cost.** Node, trivial script, median. One script runs in about 6 ms, and a snapshot rebuild adds 0.2 to 0.4 ms. Twenty chained scripts took 124 ms in Slime against 117 ms with one snapshot, and 274 ms in Rampage against 135 ms. That chained whole turn runs, so it is an upper bound. Not measured in a browser, or on Emberwatch or Fantasy Futanari.

## Testing Decisions

A good test plays a real run through the highest seam and asserts what the player or the next script reads. It never reads the order of internal calls. Every guard must fail when the snapshot rule is put back.

| Seam | Covers |
|---|---|
| `runStatCodeTurn` | Reads and stacking for every home, timing and owner. Blueprint rows, library entities, World Tools at the head, replayed writes, failed scripts, switched-off scripts, nested switches, `previous` and `delta.actual` |
| `runItemScripts` | Item events and the scripts on one event |
| `openOutputRun` | During AI Output within and across sentences, and a stopped turn |
| `scriptsByTiming` | The Q18 list order and the shared run order |
| Bundled-world tests | Parity. They must stay green, with no scenario changed to get there |
| Byte-equal request bodies | The AI prompt text and the help tool's schema keep their order |

- **Tests that assert the old rule flip.** "lets no run see another run's write" and "moves a world stat once when a Blueprint stat on two owners writes it" assert what Q1 and Q8 reverse. Flip each one to assert the new result. Any other test that fails gets reported first, never edited to pass.
- **Prior art:** the `statCodeTurn.*` test files, `outputRun.test.ts`, `worldScripts` tests, `statCodeTurn.crossOwner.test.ts`, and the bundled-world harness.
- **Currency:** a test where two scripts `pay` from one balance in one turn, for a stat Currency and a coin Currency, each charging the full sum.
- **Editor:** a dev-router read of the Scripts tab in both themes is not needed, since colors don't change. A DOM read confirms the timing order.

## Out of Scope

- A per-world switch or a mode. Q1 rejected it.
- Migrating, rewriting or linting shipped worlds or saves.
- Rows in the Scripts tab for item scripts, World Tools or library entities.
- Per-owner rows for a Blueprint script.
- Changing Currency's other rulings, or tickets 06 and 08.
- Editing bundled or work-in-progress worlds. If a bundled-world test fails on real behavior, it goes to the user.

## Further Notes

- **Survey of bundled worlds:** 14 scripts, none with an `order`. A regex survey found no script that reads another script's write in one timing. It reads literal names only.
- **Work-in-progress worlds:** Fantasy Futanari has Fertility reading Pregnancy in After the AI, and a Pregnancy script comments on another script's write in the same run. Centaur Breeder 3.3.2 has two Pregnancy scripts. Both need a check when they next change.
- **Survey of the heavy author's larger world:** 11 world scripts, about 656,000 characters, none with an `order`. In Before the AI, two scripts can both spend one stat, which the chain fixes. Two later scripts would read the first script's same-turn placeholder state instead of last turn's. Its scripts read placeholder names through variables, so the count may miss cases. The test build (Q7) is the real check.
- **Changelog:** a 👤 line under Major, because shipped worlds with stacking writes play differently. It also says how to check a world.
- **Docs bug found on the way:** the prompts rule already looks wrong for After the AI, which runs one by one today. Q12's docs fix covers it.
