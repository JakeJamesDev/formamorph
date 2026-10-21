# Spec: World Tools

Status: done
Status note: Closed on 2026-10-17. Tickets 01–11 landed; the last landing is 38ff42f7e. Gates green on 2026-10-17.
Spec session: world-tools — spec

## Problem Statement

A world author cannot give the AI a Tool. Tools live in settings, per player, and they are read-only: a Tool can look something up, but it can never change the playthrough. An author who wants the AI to move the scene, pass time, mark a character met, or turn on a narration filter on its own judgment has no way to do it. Scripts can change state, but only on fixed timings, never when the AI decides. Scripts also cannot write the location, the story clock, discovered entities, or memories, which only the AI passes write today.

## Solution

A world can ship **World Tools**. A World Tool is a Tool stored on the world, edited in a new **Tools** tab beside **Scripts** in the World Editor's Logic group. When the AI calls a World Tool with a Script handler, the call **arms a trigger**: the Tool answers at once with a short reply, and its script fires at the Tool's timing with the call's arguments. Three timings exist: **On Call** (the script runs now and its return value is the reply), **During AI Output** (the script runs on each narration sentence for the rest of the turn), and **After the AI** (the script runs with the After the AI scripts). A trigger lasts one turn. The script surface gains four writes, for every Script and World Tool: move the location, advance the clock, discover an entity, and write a memory or diary line.

## Rulings

Settled with the user on 2026-10-17. R rulings came from the design discussion; Q rulings from the grill.

| # | Ruling |
|---|---|
| R1 | A World Tool call **arms a trigger**. The Tool answers at once; its script fires at the Tool's timing with the call's `args` |
| R2 | Timings: **On Call**, **During AI Output**, **After the AI**. No Before the AI timing |
| R3 | A Tool script writes what Scripts write plus what the AI passes write. The save shape does not change |
| R4 | **Stack Calls**, a per-Tool setting, off by default. Off: a later call in the turn replaces the armed trigger. On: every call fires, in call order |
| R5 | The editor home is a **Tools** tab in the World Editor's Logic group, beside **Scripts** |
| R6 | A trigger lives for one turn. Nothing armed carries into the next turn or the save |
| Q1 | Each Script-handler World Tool has a **Reply** field, the text the AI gets back. Empty uses "Done." An On Call Tool returns its script's value instead |
| Q2 | A regenerate or cancel drops the turn's armed triggers and every write they made, On Call writes included |
| Q3 | Trigger script errors follow the Scripts rules: During AI Output passes the sentence unchanged; other timings drop the script's writes and show the script error. The AI already got its reply |
| Q4 | Armed triggers in one timing run in Tools-tab order, before the world's Scripts of that timing. A During AI Output trigger chains `narration.sentence` like an output Script |
| Q5 | A World Tool is the existing `Tool` shape on `World.tools`, edited with the existing Tool editor. Lookup and Template handlers work as today. Only the Script handler gains timing, Reply and Stack Calls |
| Q6 | World Tools follow the global Tools switch only. Prompt presets do not list or switch them. No per-world player switch in this effort |
| Q7 | A World Tool whose name matches a catalog or user Tool replaces that Tool in its world. The Tools tab warns on the clash |
| Q8 | The script surface gains: move location, advance clock, discover entity, and memory and diary writes |
| Q9 | When narration retracts its shown text because the round ended in Tool calls, writes made by output scripts and output triggers on that text drop, and the output run starts over on the next round |
| Q10 | The Tools tab is advanced-only, like Scripts |
| Q11 | The Q8 writes join the one script surface: stat, trait and world Scripts use them too |
| Q12 | Global user Tools stay read-only, with no timing. Triggers and writes belong to World Tools only |
| Q13 | When a Tool and an AI pass write the same field in one turn, the Tool's write wins |
| Q14 | A write that names a location or entity the world does not have fails the script with an error. Nothing is created at runtime |
| Q15 | Q13 covers every script: authored code beats the pass for that field in that turn |
| Q16 | Memory has two calls: one adds a line to the turn's memory (recall finds it; it does not ride every request), one adds a pinned memory that rides every request |
| Q17 | The game shows the existing Tool-call indicator, with the Tool's name, when the AI calls a World Tool |
| Q18 | One bundled world ships an example World Tool: a During AI Output filter. The world is picked in its ticket |
| Q19 | Test seams: `runTurn` with a fake AI Stream as the primary seam, plus the script run and `computeTurnCommit` |
| Q20 | A name match removes the catalog or user Tool from every request in that world, whatever each one's `offeredTo`. One name is one Tool per world (ticket 01 ruling, from Q7) |
| Q21 | The Tools tab mirrors Settings: a read view with Edit and Delete; Edit opens the existing Tool editor as a draft with Cancel and **Save Tool**. Only a valid Tool reaches the world. A Save and a Delete are each one history Step (ticket 01 ruling, from Q5) |
| Q22 | Two World Tools in one world can't share a name: an error, as a taken name is. Taking a catalog or user Tool's name is a warning (ticket 01 ruling, from Q7) |
| Q23 | Out of ticket 01: a per-Tool Enabled switch in the tab, Tool pack import and export, and copying from the player's own Tools (ticket 01 ruling, from Q6) |
| Q24 | One Tool-call indicator for every Tool: the line names the round's Tools, joined ("Calling roll…"), catalog included. It stays behind Show Silent Requests, as today; a World Tool gets the same cue, not a louder one (ticket 01 ruling, from Q17) |
| Q25 | Q9 already holds for output Scripts: the output run resets on the restarted index 0, and a rewrite pending at the retract never surfaces. Ticket 02 makes the restart an explicit retract hook with a generation counter, so a step that finishes after the retract is discarded, as the seam ticket 06 builds on, and adds end-to-end tests through the transport. Q9's "never reaches the screen" covers pending rewrites and the final text and save; a sentence already shown before the retract stays shown, then retracted, as raw text is today (ticket 02 ruling) |
| Q26 | Calls: `location.move(nameOrId)` with read-only `location.name` and `location.id`; `clock.advance(minutes)` on the existing `clock` object; a top-level `discover(nameOrId)`. Ticket 04's calls follow the same style (ticket 03 ruling) |
| Q27 | Clock advances in a turn add up, and the sum replaces the turn's duration: the time pass result, or Time Per Turn with the pass off (Q13, Q15). Scripts in one run read the clock as the run started. Negative or non-finite minutes throw (ticket 03 ruling) |
| Q28 | Any world location is a valid move; there is no path check. A Before the AI move lands before routing, so narration is written at the new place and the up-front location pass result drops. An output or After the AI move lands at commit and drops that turn's route and suggest result. Later code write wins within the turn (ticket 03 ruling) |
| Q29 | `discover(name)` does what the discover pass does: it adds the name to the turn's participant names, so the existing pipeline writes a description, creates the runtime entity at the turn's location, and makes a diary due. `discover(name, description)` creates the runtime entity with that description and no AI call. A name that an entity or an earlier discovery already holds is a no-op. Both roll back with the turn. With Describe Characters off, the one-argument form adds the name and nothing is created; the two-argument form always creates. `discover` is the one exception to Q14. Replaces the roster-visitor reading of 2026-10-17 (user ruling, ticket 03) |
| Q30 | Each ticket that adds a script call teaches Test Code and the Test Bench the call in the same ticket: the world's names reach the editor runner, so a valid call never shows a false error, and each write gets a report line ("location.move: Inn", "clock.advance: 30 minutes", "discover: Tor"). Ticket 04 does the same for memory and diary; ticket 07 only adds World Tool scripts (ticket 03 ruling) |
| Q31 | A stat re-roll drops the replay's location, clock and discover writes. The turn keeps the place, time and cast it committed: a re-roll redoes stats, not the scene (ticket 03 ruling) |
| Q32 | `discover` skips a name the player deleted, in both forms, as the pass does (ticket 03 ruling, from Q29) |
| Q33 | An output or After the AI `clock.advance` that makes the turn longer than the hours regen already ticked ticks regen and starvation for the extra hours. A shorter one moves only the clock; the regen already ticked stays. A Before the AI advance has no gap. Making regen wait for the After batch is out of scope (user ruling, ticket 03) |
| Q34 | An imported world drops a malformed or duplicate-name World Tool and the import continues; a toast says how many Tools were dropped and why. Ticket 05 builds the toast (user ruling, ticket 01 edge) |
| Q35 | On the Tools tab read view, Offered To and Max Calls write as they change, one history Step each, as in Settings; Q21's draft applies to the Tool editor (ticket 01 ruling, from Q21) |
| Q36 | `memory.pin(line)` adds a Memory Manager note anchored at the turn, shown under Custom. The note id carries the turn id, and a regenerate, undo or cancel prunes notes whose turn is gone. A script-written marker is out of scope (ticket 04 ruling) |
| Q37 | `memory.add(line)` and `diary(nameOrId, line)` add beside the pass output, never replace it: the digest and diary passes still run for that turn, the code lines are stored on the turn beside them, and everything that reads the digest or the diary (recall, requests, the Memory Manager, the diary view) reads both. Several calls keep call order. Overrides Q15 for these two writes. **Save shape change (additive):** one per-turn field for code memory lines and one for code diary lines. Diary targets are entities in play, world or discovered; the persona is not a target; an unknown name fails the script (user ruling, ticket 04) |
| Q38 | On Call writes apply at once to the turn's live state. Later Tool calls, prompts built later in the same turn (Narration after a Planning call), the stat pass and the After batch all see them. A stop, regenerate or cancel drops them with the turn (Q2). Code beats pass still holds at commit (Q13) (user ruling, spec session; replaces the ticket 05 session's "land at commit") |
| Q39 | A stat re-roll replays the turn's Tool effects. After triggers re-run with call args saved on the turn; output triggers follow what a re-roll does for output Scripts. **Save shape change (additive):** the turn stores its Tool calls (Tool id, args, timing) and On Call writes (user ruling, spec session; replaces "runs no Tool triggers") |
| Q40 | An On Call script reads the live turn state: turn start, plus the Before the AI scripts' writes, plus earlier On Call writes this turn. Output-script writes not yet landed are not visible; the stat pass and After batch have not run (user ruling, spec session) |
| Q41 | On a re-roll, an On Call Tool does not run again: the re-roll reapplies the writes the call made, so a random result stays what the narration says (user ruling, spec session) |
| Q42 | Q39 and Q41 split from ticket 05 into ticket 09, blocked by 05 and 06. Until 09 lands, a re-roll drops Tool effects (user ruling) |
| Q43 | A Stop that keeps its narration keeps the On Call writes, as it keeps Before the AI writes: the kept text was written with them. A regenerate, a stop before narration and a failed turn drop them (user ruling, ticket 05) |
| Q44 | Q38 covers every write kind: an On Call location, clock or discover write lands on the live state at once, so Narration built after a Planning call is written at the new place. A call made during Narration never rebuilds the text being written; later prompts in the turn see the change (ticket 05 ruling, from Q38) |
| Q45 | A Before the AI or On Call `clock.advance` shows in prompts built after it in the same turn; the commit adds only the rest of the duration, never double counting. Ticket 10 builds it; ticket 05 lands with turn-start time in prompts, as every clock write reads today (user ruling) |
| Q46 | The editor has no discovered cast, so in Test Code and Try It a `diary` target the authored world lacks is a warning line, not a script failure (Q30: no false errors). Play still fails an unknown name (Q14). Ticket 07 builds it (ticket 04 edge) |
| Q47 | A world with a During AI Output World Tool reveals like a world with an output Script (Scripts Q21): the output run opens when narration starts and the crawl holds to whole sentences on every turn, armed or not. Only while the Tool would be offered: the global Tools switch on and the endpoint tool-capable (ticket 06 ruling, from Scripts Q21) |
| Q48 | Ticket 08's "help topic" means new routed how-to sections in the Tools doc for the Tools tab (timing, Reply, Stack Calls, a Tool that changes the story) and a fix to its "a Tool only reads" line, plus a World Tools section in the Scripts guide. No tab-level help topic entry. The example is `lock_target(name)` in the drone scripts showcase world: During AI Output, Stack Calls off, marks the locked target in later sentences (ticket 08 ruling) |
| Q49 | The cloud default endpoint rejects any request with `tools` (HTTP 400: auto tool choice is not enabled on the server), so the capability gate offers it no World Tools. Ticket 08's call-rate probe and live check run on Cydonia 24B locally, same design, in a GPU window the user agrees to; the ticket records that the cloud model is not tool-capable (ticket 08 ruling). **2026-10-21:** the cloud endpoint now takes Tools while its server runs with `--enable-auto-tool-choice --tool-call-parser gemma4` |
| Q50 | A location rename rewrites the string literal in `location.move("<name>")` in every script: World Tools and world, stat and trait Scripts. Find All Uses lists those calls. Ticket 07 builds it (user ruling, ticket 07) |
| Q51 | On a re-roll, a trait switch in an On Call call's saved writes fires the switched trait's When a Trait Switches scripts again, as every other re-rolled switch does. Q41 freezes only the On Call script, whose return value the AI read; switch scripts re-roll like the Before the AI box's (ticket 09 ruling) |
| Q52 | The Narration system prompt is assembled before the Planning request, so Q44 did not reach it as ticket 05 landed. Ticket 10 rebuilds the Narration system prompt and chip values at the narration stage when any Planning-stage On Call write landed (stats, traits, clock, location, discover), closing Q38, Q44 and Q45 together. The recap's now-line and memory stamps are built inside the trimmed history, so the rebuild re-renders that history with the shown time and code view, keeping the memories the first trim picked and recording recall once. The first trim also reads the shown time, which covers a Before the AI advance. A turn with no such write keeps today's prompt, so the prefix cache is unchanged (ticket 10 ruling, from Q44) |
| Q53 | A mid-turn advance moves the time that prompts, Tool calls and later scripts read. The visible clock panel moves at commit, as today, with no extra undo path (ticket 10 ruling, from Q45) |
| Q54 | The example `lock_target` Tool ships with its probed wording. It never fires on a melee attack such as ramming (0/6 on MeroMero 31B); a body-attack wording did worse (5/18). The gap is recorded in ticket 08 (user ruling) |
| Q55 | Staged planning passes built after a director Tool call read the pre-call context, which breaks Q38. Ticket 11 fixes it (user ruling, ticket 10 edge) |

## User Stories

1. As a world author, I want to add a Tool to my world, so that the AI can call it in every playthrough of that world.
2. As a world author, I want a **Tools** tab next to **Scripts**, so that I find Tools where the world's logic lives.
3. As a world author, I want the Tools tab only in the advanced editor, so that simple authoring stays simple.
4. As a world author, I want to edit a World Tool with the same editor the Settings Tools use, so that I learn one editor.
5. As a world author, I want Lookup and Template World Tools, so that I can ship world-specific lookups without code.
6. As a world author, I want to pick a timing for a Script Tool, so that I decide when its effect happens.
7. As a world author, I want an On Call timing, so that the AI gets a computed answer, such as a roll, right away.
8. As a world author, I want a During AI Output timing, so that the AI can turn on a narration filter for the rest of its reply.
9. As a world author, I want an After the AI timing, so that the AI can request a state change that lands with the turn.
10. As a world author, I want to set the Reply text, so that the AI knows its request was accepted in my world's terms.
11. As a world author, I want an empty Reply to send "Done.", so that I don't need to write one for every Tool.
12. As a world author, I want my script to read the call's arguments, so that one Tool covers many cases.
13. As a world author, I want a Stack Calls setting, so that repeat calls either replace or add up, as the Tool needs.
14. As a world author, I want Stack Calls off by default, so that a filter or mode call replaces the earlier one.
15. As a world author, I want armed Tools to run in the order of the Tools tab, so that I control how filters compose.
16. As a world author, I want armed Tools to run before my world Scripts of the same timing, so that my Scripts see the Tool's effect.
17. As a world author, I want a Tool script to move the location, so that the AI can take the scene somewhere on purpose.
18. As a world author, I want a Tool script to advance the clock, so that the AI can pass time with an exact amount.
19. As a world author, I want a Tool script to discover an entity, so that the AI can mark a character as met.
20. As a world author, I want a Tool script to add a turn memory line, so that a fact enters recall without riding every request.
21. As a world author, I want a Tool script to add a pinned memory, so that a key fact rides every request.
22. As a world author, I want a Tool script to add a diary line, so that a character's diary records what my code knows.
23. As a world author, I want my Scripts to use the same new writes, so that Before and After Scripts can move or pass time too.
24. As a world author, I want my code's writes to beat the AI passes in that turn, so that a pass doesn't undo my Tool.
25. As a world author, I want a write to an unknown location or entity to fail with an error, so that a typo shows up instead of creating junk.
26. As a world author, I want trigger errors to follow the Scripts rules, so that I debug Tools and Scripts the same way.
27. As a world author, I want a warning when my Tool's name matches a catalog or user Tool, so that I know mine replaces it in my world.
28. As a world author, I want my Tool to replace a same-name catalog Tool in my world, so that I can ship my own `roll`.
29. As a world author, I want World Tools to export with my world, so that sharing the world shares its Tools.
30. As a world author, I want to test a World Tool in the editor, so that I see its reply and its writes before play.
31. As a world author, I want find-all-uses and renames to cover World Tool scripts, so that renaming a stat doesn't break a Tool.
32. As a world author, I want a bundled example of a filter Tool, so that I can copy a working pattern.
33. As a player, I want World Tools to work without setup, so that a world plays as its author built it.
34. As a player, I want the global Tools switch to turn World Tools off too, so that one switch controls all Tools.
35. As a player, I want the usual Tool-call indicator with the Tool's name, so that I see when the AI used one.
36. As a player, I want a regenerate to undo everything a Tool did that turn, so that a regenerate starts clean.
37. As a player, I want a canceled turn to drop armed triggers, so that a stopped turn leaves no hidden effect.
38. As a player, I want retracted text to leave no writes behind, so that state matches the text I see.
39. As a player, I want a filter Tool's rewrite in the save, TTS and recaps, so that one version of the text exists.
40. As a player, I want a world's Tools to stay out of other worlds, so that one world's rules never reach another.
41. As a player, I want my own Settings Tools to stay read-only, so that a Tool I made can't change a world it doesn't know.
42. As a player on an endpoint without Tool support, I want the world to keep playing, so that only the Tools are missing.
43. As a player, I want an armed trigger to end with its turn, so that a filter doesn't stick across turns by surprise.

## Implementation Decisions

### Shape

- `World.tools?: Tool[]`. The `Tool` shape is unchanged except the Script handler: `{ kind: 'script', code, timing?, reply?, stack? }`. `timing` is `'call' | 'output' | 'after'`; absent means `'call'`, which is today's behavior. `reply` and `stack` apply only when `timing` is `'output'` or `'after'`.
- The new handler fields exist on World Tools only (Q12). The Settings Tool editor hides them; validation rejects them on a user Tool.
- **World export shape change.** `World.tools` is new. A world with Tools loads in an older build without them.
- The save shape does not change (R3, R6). Armed triggers live in turn-scoped memory only.

### Offer

- The offer list for a request is: catalog and user Tools as today, then the world's Tools, with a World Tool replacing any Tool of the same name (Q7). The global Tools switch and endpoint capability gate both apply (ADR-0008). Preset switches do not apply to World Tools (Q6).
- `offeredTo` and `callLimit` work as today on World Tools. A During AI Output trigger armed by a non-narration request covers that turn's narration.

### Arming

- A turn holds a **trigger list**. A call to a Script World Tool with timing `output` or `after` parses `args`, adds or replaces the Tool's entry (R4), and returns the Reply or "Done." (Q1). Arming runs no code.
- An `call` World Tool runs its script at once on the script surface (with writes, unlike user Tool scripts) plus `args`, and returns the script's value as text.
- The trigger list and every write staged by a trigger belong to the turn. Regenerate and cancel discard them (Q2). This rides the turn's staging, so no rollback code exists per write.

### Running

- Output triggers join the output run: per sentence, armed output triggers in Tools-tab order, then world, stat and trait output Scripts (Q4). They chain `narration.sentence` and land writes with the After batch, as output Scripts do.
- When a narration round ends in Tool calls and its shown text is retracted, the output run discards its writes and starts over with the next round (Q9). This applies to output Scripts as well as triggers.
- After triggers run in the After the AI batch, before the world's After Scripts, in Tools-tab order; with Stack Calls on, each call runs once, in call order.
- `player.*` follows the Scripts rule per timing: refused in During AI Output, allowed in After the AI and On Call.

### New script writes (Q8, Q11)

- One surface for Scripts and World Tool scripts. Four write groups: move location (by name or id), advance clock (minutes), discover entity (by name or id), memory (turn line; pinned memory) and diary (entity, line).
- A name or id the world does not have throws in the script (Q14).
- The Turn Commit gains these as code writes. For each field, a code write in the turn beats the matching pass output (Q13, Q15). Within code writes, later wins, as today.
- These writes travel through the same staging as stat writes, so regenerate, cancel and stopped-turn rules (Scripts Q44) carry over.

### Editor

- The Tools tab sits in the Logic group, advanced-only, with a dev-route entry. It lists the world's Tools in run order with drag to reorder, and opens the existing Tool editor with the timing, Reply and Stack Calls fields on the Script handler.
- The tab warns when a Tool's name matches a catalog or user Tool (Q7).
- Try It, the Variable menu, find-all-uses and rename walk World Tool scripts as they walk world Scripts. Try It shows staged writes instead of applying them.

### Docs and glossary

- A new ADR supersedes ADR-0008's "A world author cannot ship a Tool": World Tools ship in worlds, follow the global switch and capability gate, and skip preset switches.
- CONTEXT.md: **Tool** drops "Read-only"; add **World Tool**, **Trigger**, **Reply**. The Scripts guide documents the new writes and World Tools.
- One bundled world gains an example output filter Tool (Q18). That ticket follows the bundled-worlds skill.

## Testing Decisions

- A good test drives a seam's public input and asserts what a player or author would see: the reply text, the narration text, the committed state. It never asserts call order inside the runner or private fields.
- **`runTurn` with a fake AI Stream** (primary seam, `turnRunner` tests): a stream that emits a World Tool call, then narration. Cases: the reply reaches the next round; an output trigger rewrites later sentences; Stack Calls off replaces, on stacks; a retracted round drops its output writes and restarts; regenerate and cancel drop triggers and writes; an `after` trigger lands with the turn; World Tools skip preset switches and respect the global switch; a World Tool replaces a same-name catalog Tool.
- **The script run** (`statCodeTurn` tests): each new write lands; an unknown location or entity throws; triggers run before world Scripts in Tools-tab order; errors follow Scripts Q3 rules; `player.*` refused in output.
- **`computeTurnCommit`** (pure seam, ADR-0001): code writes beat pass output per field; no code write leaves the pass output unchanged.
- Each guard proves it bites: reinstate the bug (pass wins, retracted writes kept, trigger outlives the turn) and watch the test fail.
- Prior art: `toolLoop.test.ts` for fake tool rounds, `turnRunner.test.ts`, `statCodeTurn.test.ts`, `computeTurnCommit.test.ts`, `rollTool.test.ts`.

## Out of Scope

- Triggers that outlive a turn, a Before the AI timing, and anything that needs the save to hold armed state.
- A disarm call or paired off Tool.
- Creating locations or entities at runtime from a script.
- Timings or writes for global user Tools, and Formaquestion Tools.
- A per-world player switch for World Tools.
- A text fallback for endpoints without Tool support (ADR-0008 stands).

## Further Notes

- On an endpoint without Tool support, a world's Tools are not offered and the world plays without them. Authors should not make a world depend on a Tool.
- As of 2026-10-21 the cloud default endpoint is tool-capable. Its owner must launch it with `aphrodite run google/gemma-4-E4B-it --enable-auto-tool-choice --tool-call-parser gemma4`; without those flags it returns HTTP 400 again (Q49). The player and author docs say World Tools need a tool-capable endpoint.
- A World Tool that writes is a new way to change state beside the passes. That settles the open "Tools vs passes" question in the tool-call ideas notes for World Tools; catalog state-changing Tool ideas there stay open.
- Probe work: a World Tool's description is prompt text. The bundled example ships with probe numbers on a local tool-capable model, since the cloud endpoint took no Tools when it ran (Q49), showing it calls the Tool when asked and not otherwise.
