# Spec: Script Surface Gaps

Status: ready-for-agent
Spec session: script-surface-gaps — spec

## Problem Statement

A script cannot see what the player did. The player's action never reaches the sandbox, and no turn counter exists, so an author fakes "every fifth turn" with a hidden stat. The clock gives a daypart but no hour, and the start hour that would let a script work one out is not exposed. A stat's script cannot read the descriptor band the AI reads for that stat. A script cannot reveal a hidden stat, so a stat that should appear partway through the story needs a trait to carry it. Lore cannot follow story state: a dictionary entry or book is on or off for the whole playthrough, and a disabled entry is absent from the script's map. A script can move the turn to a location but cannot see the map around it: no parent, no children, no exits.

## Solution

A new `turn` global holds the player's action and the turn number. `clock` gains `hour` and `minute`. Each stat entry gains a read-only `descriptor` and a writable `hidden`. Dictionary entries list disabled ones, and entry `enabled` and `constant` and book `enabled` take writes that rewind with undo. Location entries gain `parent`, `children` and `exits`. Every new read reaches World Tool and user Tool scripts as well, and user Tools stay read-only.

## Rulings

Settled with the user on 2026-10-25 through a grill and an agent review of its first twenty rulings. A ruling marked *superseded* stands only as its successor reads.

| # | Ruling |
|---|---|
| Q1 | One effort covers all seven fields, one ticket per field where the work splits |
| Q2 | A new `turn` global holds `turn.action` and `turn.number` |
| Q3 | `clock` and `clock.previous` gain `hour` and `minute`. Both derive from one rounded minute, so `minute` never reads 60 and `day` agrees with the shown clock. The hour range is the calendar's hours per day. The opening turn reads the default start hour until the opening-time pass answers |
| Q4 | `stat.hidden` is writable. The write persists per playthrough and rewinds with undo. The saved stat record already carries `hidden`, and load keeps it as saved, so the save gains no field for it |
| Q5 | `turn.action` holds the player's text as sent, trimmed, with OOC square brackets kept. Images are never in it |
| Q6 | On the opening turn and At Game Start, `turn.action` reads the cue the narrator gets: the player's edited cue, else the drawn opening. The "START GAME" stand-in stays inside the prompts |
| Q7 | In a When a Trait Switches run between turns, `turn.action` reads empty and `turn.number` reads the last finished turn. No flag marks the case |
| Q8 | `turn.number` counts from 1 on the scale of `memories[].turn`, so undo and re-roll rewind it. It reads the turn in progress (see Q25) |
| Q9 | Each stat entry gains read-only `descriptor`: the active band's text, chips resolved, empty when no band applies. `previous` carries it too, resolved with the pins in force at the start of the turn |
| Q10 | A `hidden` write reaches the same stats a `value` write reaches |
| Q11 | Lore toggles live in a new map on the game state, keyed by book id plus entry id, so undo rewinds them. The save's copy of the books is never written in play |
| Q12 | `dictionaries.X.entries` lists disabled entries with `enabled: false`. This reverses Script Surface Q33's absence rule |
| Q13 | Entry `enabled` and `constant` take writes |
| Q14 | *Superseded by Q29* |
| Q15 | Location entries and `location` gain `parent` (a code name, empty at the top level) and `children` (code names) |
| Q16 | `hidden` and lore writes land as a stat field write does: after the run, in call order across one Timing's scripts. A Before the AI write shapes this turn's prompts; an After the AI write shapes the next turn's |
| Q17 | *Superseded by Q23* |
| Q18 | In Test Code and the Test Bench, `turn` reads a fixed sample action at number 2. At Game Start reads the world's heaviest Opening Action at number 1, else the default opening; a world with only narration openings reads empty (Q22). The Settings sample world for user Tools reads the same sample action, numbered from its sample memories |
| Q19 | *Superseded by Q33* |
| Q20 | A stat a script unhides appears in the panel with no built-in notice. An author who wants one calls `player.tell` |
| Q21 | The save keeps the opening cue the player sent in a new field, so `turn.action` on page 1 reads the same after a re-roll or a reload. History keeps the stand-in |
| Q22 | An Opening Narration start reads `turn.action` as empty |
| Q23 | During AI Output `hidden` and lore writes land with the After the AI batch, as Scripts Q42 rules for every During AI Output write |
| Q24 | A When a Trait Switches run inside a turn (a script switch, a gate cascade, the per-turn settle) reads that turn's `turn.action` and `turn.number` |
| Q25 | While a turn is in progress, `turn.number` is the finished turns plus one, computed on each path: the live turn, the stats re-roll, the full re-roll. A run before turn 1 reads 0 |
| Q26 | When entries in one book share a name, an enabled entry takes the name over a disabled one, as stats already do; among equals the later wins. A write through the name reaches that entry |
| Q27 | User Tool scripts see disabled entries too, and their help names `enabled`. Existing Tool text is not rewritten |
| Q28 | An entry a script enables, or whose `constant` it clears, gets its vector queued at once. Recall can miss it until the vector exists; keyword matching finds it at once |
| Q29 | `exits` on a location entry and on `location` is an array of `{ name, hint }`: code names, from the destination list the AI router reads |
| Q30 | After a Before the AI `location.move`, `location` and its `exits` still read where the turn started. Moves never read back within a run |
| Q31 | `descriptor` keeps the band from the start of the run after a `self.value` write |
| Q32 | `descriptor` reads the band whatever the display settings, and on a disabled stat as `value` does |
| Q33 | Scripts reach books by who turned them off. A book the player turned off stays absent. A book the author shipped off is listed with `enabled: false` |
| Q34 | A stat unhidden this turn shows this turn's delta chips |
| Q35 | Between turns (the Background Pass Queue, Formaquestion Tools, user Tool calls), `turn` reads the last finished turn with an empty action |
| Q36 | Who turned a book off is derived, with no new data: the save has it off while the world, or the player's library add, has it on means the player; the world shipping it off means the author |
| Q37 | Book `enabled` takes writes, so an author can ship a hidden book and unlock it in play |
| Q38 | Book toggles share the Q11 map and rewind with undo |
| Q39 | A library book the player added at world entry reads and takes writes like any book in play. Writes go to the Q11 map, never to the library record |
| Q40 | Book `enabled` writes go both ways on any reachable book |
| Q41 | `hour` and `minute` follow the shipped `clock.advance` rule: after an advance the whole clock still reads the run's start, and the advance lands at commit. Day, daypart, hour and minute derive from one rounded minute count, so 23:59.7 reads the next day at 00:00, on `clock` and `clock.previous` alike (ticket 03 ruling) |
| Q42 | A user Tool or World Tool call the AI makes inside a turn reads that turn's action and number; Q35's empty action covers only calls made between turns. The Settings sample world stands in for an in-turn call: the sample action "Look around." at number 4, after its three sample turns. Test Code's At Game Start reads world-level openings only: the heaviest Opening Action, the first in authored order on a tie, weight-0 and blank rows never counting, and the default opening when openings are off or none qualify (ticket 01 ruling) |
| Q43 | `descriptor` reads the band text as the run's live resolver gives it, agreeing with `description` and `placeholders.X.value` in the same run; a newly entered band's own pins land next turn, as for the prompt. `previous.descriptor` resolves with the turn-start pin record a re-roll's pre-turn state uses. Where no play resolver exists (Test Code, the Test Bench, user Tools), `descriptor` follows `description` as authored (ticket 04 ruling) |
| Q44 | A player toggle made while a turn runs reads an empty action, for Q7's reason, and the turn in progress as its number. A player toggle always reads empty; only script, gate-cascade and settle switches read the turn's action (Q24) (ticket 01 ruling) |
| Q45 | `previous.hidden` reads the turn-start state, read-only. `hidden` reads back within the run, as `value` and the bounds do. A non-boolean write fails the run as a bad write, as trait `enabled` does. Every assignment is a write, changed or not; a write to a switched-off stat or an unknown name drops and lists as `value` does (ticket 05 ruling) |
| Q46 | A World Tool's `hidden` write replays on a stats re-roll: the save's per-stat trigger-write row gains an optional `hidden` boolean. An additive save-shape change, refining Q4 (user, via ticket 05) |
| Q47 | The save envelope's `openingCue` holds the cue of every Opening Action start, edited or not, and `""` for an Opening Narration start: a present field is authoritative, an absent one marks an older save. A full re-roll of page 1 is a new opening turn whose cue replaces the saved one. The field does not rewind with undo, like `persona` (ticket 02 ruling) |
| Q48 | An exit's `hint` is the Connection leg's hint with placeholders filled in, `''` for an implicit or hintless exit. `exits` follows the router's order; `children` follows authored location order. A `parentId` naming no location reads `parent` as `''`. `parent`, `children` and `exits` are deferred per entry and built on first read (ticket 08 ruling) |

## Surface

Every entry is read-only unless its row says it takes a write.

| Path | Type | Access | Reads |
|---|---|---|---|
| `turn.action` | string | read | Q5, Q6, Q7, Q22, Q24, Q35 |
| `turn.number` | number | read | Q8, Q25, Q35 |
| `clock.hour`, `clock.previous.hour` | number | read | Q3 |
| `clock.minute`, `clock.previous.minute` | number | read | Q3 |
| `<stat>.descriptor`, `<stat>.previous.descriptor` | string | read | Q9, Q31, Q32 |
| `<stat>.hidden` | boolean | write | Q4, Q10, Q16, Q20, Q23, Q34 |
| `dictionaries.X.enabled` | boolean | write | Q33, Q36, Q37, Q38, Q40 |
| `dictionaries.X.entries.Y.enabled` | boolean | write | Q11, Q12, Q13, Q26 |
| `dictionaries.X.entries.Y.constant` | boolean | write | Q13, Q28 |
| `locations.X.parent`, `location.parent` | string | read | Q15 |
| `locations.X.children`, `location.children` | string[] | read | Q15 |
| `locations.X.exits`, `location.exits` | `{ name, hint }[]` | read | Q29, Q30 |

## User Stories

1. As an author, I want to read the player's action this turn, so that a script reacts to what the player said or did.
2. As an author, I want the action to keep OOC brackets, so that a script can tell a direction from an in-story action.
3. As an author, I want the opening turn to read the player's real opening cue, so that a script can branch on how the story began.
4. As an author, I want the opening cue to read the same after a re-roll or a reload, so that a re-rolled first page gives the same script result.
5. As an author, I want a narration opening to read an empty action, so that a script never mistakes authored text for the player's.
6. As an author, I want a toggle between turns to read an empty action, so that an action check never fires twice for one action.
7. As an author, I want a switch inside a turn to read that turn's action, so that it agrees with the scripts around it.
8. As an author, I want to read the turn number, so that I can write "every fifth turn" without a counter stat.
9. As an author, I want the turn number on the memories scale, so that a memory's turn compares to the current one.
10. As an author, I want undo and re-roll to rewind the turn number, so that a rewound turn runs as it first did.
11. As an author, I want a run before turn 1 to read turn 0, so that the opening turn alone reads 1.
12. As an author, I want between-turn runs, background passes and Tool calls to read the last finished turn, so that the number is always meaningful.
13. As an author, I want to read the hour and minute of the story clock, so that a script can act after a set time of day.
14. As an author, I want the hour and minute at the start of the turn too, so that I can tell when the clock crossed a time.
15. As an author, I want hour and minute to agree with the clock the player sees, so that a script and the panel never disagree.
16. As an author, I want a stat's descriptor text, so that a script reads the band the AI reads.
17. As an author, I want the descriptor at the start of the turn, so that a script can tell when a stat changed bands.
18. As an author, I want the descriptor to hold its run-start band, so that every read in one run agrees.
19. As an author, I want the descriptor whatever the display settings, so that a player's settings never change script results.
20. As an author, I want to unhide a stat from a script, so that a stat appears when the story earns it.
21. As an author, I want to hide a stat from a script, so that a stat can leave the panel when it stops mattering.
22. As an author, I want hidden-state writes to rewind with undo, so that an undone reveal is undone.
23. As an author, I want an unhidden stat to show this turn's changes, so that the player sees what moved it.
24. As an author, I want to choose the reveal message myself, so that the game adds no notice I did not write.
25. As an author, I want to reach every stat a value write reaches with `hidden`, so that one rule covers stat fields.
26. As an author, I want to switch a dictionary entry on, so that lore unlocks with the story.
27. As an author, I want to switch an entry off, so that lore the story has moved past stops reaching the AI.
28. As an author, I want to make an entry constant from a script, so that the AI always gets lore that matters now.
29. As an author, I want disabled entries in the script map, so that a script can find the entry it unlocks.
30. As an author, I want an enabled entry to win a shared name, so that imported lorebooks with duplicates read as they do today.
31. As an author, I want a Before the AI lore write to shape this turn's narration, so that an unlock takes effect at once.
32. As an author, I want a During AI Output lore write to land with the After batch, so that no write is dropped.
33. As an author, I want lore writes to rewind with undo, so that undo restores the lore state.
34. As an author, I want to ship a book off and switch it on in play, so that a whole body of lore can wait for its moment.
35. As an author, I want to switch a book off from a script, so that a chapter's lore can close.
36. As a player, I want a book I turned off to stay off, so that my choice at world entry holds.
37. As a player, I want my added library books to work with the world's scripts, so that my lore joins the story.
38. As a player, I want a library record never changed by a world's script, so that one world cannot edit my library.
39. As an author, I want a newly enabled entry found by keywords at once, so that an unlock works even before recall catches up.
40. As an author, I want a location's parent and children, so that a script can walk the location tree.
41. As an author, I want a location's exits with their hints, so that a script can pick a reachable place for `move`.
42. As an author, I want exits from the router's own list, so that a script and the AI agree on where the player can go.
43. As an author, I want `location` to read the start location after a move in the same run, so that reads stay consistent.
44. As an author, I want the new reads in World Tool scripts, so that a Tool sees what a Script sees.
45. As a user Tool author, I want the new reads in my Tools, so that a Tool can report the hour, the turn or the exits.
46. As a user Tool author, I want writes from my Tools still refused, so that a Tool never changes the playthrough.
47. As an author, I want Test Code to give `turn` sample values, so that I can test action checks in the editor.
48. As an author, I want At Game Start in Test Code to read the world's opening, so that I can test a start script.
49. As an author, I want completions, hover cards and the Variable menu to show each new name with its type and access, so that I learn the surface in the editor.
50. As an author, I want the Scripts guide to cover each new name, so that I can read how it behaves.

## Implementation Decisions

- **Sandbox Snapshot.** The snapshot builds `turn`, the clock's hour and minute, each stat's descriptor, the location tree and exits, and the lore listing once per turn or check, as it builds every other read. Its state input gains the turn's action and number, the places' parent ids and destination entries, and the lore overlay.
- **Turn inputs.** The turn pipeline hands the snapshot the action and number on every path: the live turn, At Game Start, the stats re-roll, the full re-roll, switch runs in and between turns, and World Tool calls. The number is the finished turns plus one while a turn is in progress, and the finished turns otherwise.
- **Opening cue.** The save envelope gains the opening cue the player sent. The page-1 re-roll and a reload read it. History keeps the stand-in, so later turns' requests stay byte-equal.
- **Clock.** One resolver returns day, hour and minute from one rounded minute. The sandbox clock object reads it, as the panel's stamp does.
- **Descriptor.** The sandbox reads the band picker the AI's stat context reads, with chips resolved by the same resolver the prompt uses. The previous stat's band is resolved with the turn-start pins.
- **`hidden` write.** The executor's writable stat fields gain `hidden`. It lands with the other stat field writes and reaches the stat records that already carry it. The delta chips for a stat unhidden this turn read this turn's change.
- **Lore overlay.** The game state gains a map of lore toggles keyed by book id and entry id, with book-level entries for book `enabled`. Every reader of in-play lore reads the books through the overlay: the narration prompt, the planner, the Tool snapshot, the semantic dictionary, the scripts' map, the stats re-roll's pre-turn reset, and the Before the AI undo. A Before the AI write reaches this turn's prompts through the code view, as stat writes do.
- **Book reach.** A book is absent from the scripts' map when the save has it off and its source has it on. A book its source ships off is listed with `enabled: false`.
- **Entry listing.** The scripts' entry map, editor completions, editor checks and hover cards all list disabled entries, and they change together. Name resolution prefers an enabled entry, then the later one.
- **Vectors.** A write that enables an entry or clears `constant` queues the entry for embedding. The turn does not wait.
- **Locations.** The places input carries each location's parent id and its destination entries from the router's list. `parent`, `children` and `exits` are code names, so no entry holds another and no cycle forms. They build lazily, after Script Surface Q53.
- **Naming.** The executor's existing internal per-stat turn readings take a new name, so `turn` means one thing. `turn` joins the globals a read-only user Tool run exposes.
- **Editor surface.** The surface description gains every new name with its type, access and help line. Completions, hover cards, the Variable menu and the access lock follow from it.
- **Export shape.** Two additive save-shape changes: the lore overlay on the game state and the opening cue on the envelope. No world-shape change.

## Testing Decisions

A good test runs real inputs through a public seam and asserts on what a script reads, what a write lands, or what a request holds. It never asserts on the prelude's text. Every guard proves it bites: a test that reinstates the old behavior fails.

- **The executor**: each new read; each new write landing; `hidden` and lore writes from a user Tool dropped; a During AI Output write collected for the After batch; name resolution preferring the enabled entry. Prior art: the executor's stat-write, memory-write and location tests.
- **The Sandbox Snapshot builder**: `turn` on each path, including 0 before turn 1, the opening cue, the narration opening and a between-turn switch; hour and minute from one rounded minute; descriptor and previous descriptor with pins; parent, children and exits; the lore listing with player-off books absent and authored-off books listed; the Test Code samples. Prior art: the snapshot and locations snapshot tests.
- **The turn commit**: `hidden` and the lore overlay land on the game state and rewind with undo; the opening cue lands on the envelope; the page-1 re-roll reads it. Prior art: the turn-commit and script-pins tests.
- **The turn pipeline's prompt build**: a Before the AI lore write reaches this turn's narration request; an After the AI write reaches the next turn's and not this one's; a book switched off drops its entries. Prior art: the turn-pass and narration-prompt tests.
- **The editor analysis**: every new name resolves to a card with its type and access; the Variable menu lists them; completions list disabled entries. Prior art: the code-cards and variable-tree tests.

## Out of Scope

- The Tier 2 and Tier 3 fields of the sweep: relationships, met, reveal state, discovered, player-facing descriptions, stat group and Base Value, persona source, the drawn opening as its own read, message history, choices, world overview fields and the AI-direction flags.
- Writes to `descriptor`, `parent`, `children`, `exits` or the clock's new fields.
- Writes from user Tool scripts (Script Surface Q24, Q44).
- A built-in notice when a stat is unhidden (Q20).
- Waiting for an entry's vector before the turn (Q28).
- A rewrite of existing user Tool text for the entry listing change (Q27).
- Reaching a book the player turned off (Q33).

## Further Notes

- The Scripts guide and the Tools guide change with the surface. The help vectors rebuild before release.
- Changelog: one entry per user-facing change, folded into any unreleased entry on the same subject.
- Q12 changes what a user Tool that lists every entry returns. If entry maps already shipped in a release, the changelog says so.
- Q36's derivation can misread an old save when an author flips a book's shipped state in a later world update. Accepted.
