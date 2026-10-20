# Sandbox Snapshot

Status: done
Status note: 2026-10-20. Tickets 01–10 done. Last landing de8b232d4. Closed without gates.
Spec session: sandbox-snapshot — spec

One module assembles the world a Script runs against. Play, Test Code and the Test Bench all take a Sandbox Snapshot and run each Script through it, so an editor run and a real turn read the same board.

## Problem Statement

An author tests a Script in the editor and sees one result. The same Script runs in play and does something else.

Three parts of the app each build the Script's world their own way: a real turn, the **Test Code** button in a script box, and the Test Bench's script check. The three copies have drifted. The Bench runs with no clock, so `clock` reads a flat hour. It treats every stat as on, so a write to a switched-off stat lands there and is dropped in play. It runs with a closed cast, so a `diary` name no entity has fails there and warns in Test Code. It opens stats at their `starting` value, while a real game opens them at the authored value. The Bench promises to show what play computes (ADR-0005). Today it keeps that promise only for the sandbox's inner engine, not for the world the engine reads.

For a maintainer, a new field the Script can see means three edits, and each new Timing or Owner kind has three places to go wrong. The executor's interface is 17 optional fields, so every caller is also the module that assembles them.

## Solution

A **Sandbox Snapshot** is taken once per turn, per Test Code run or per Bench check. Every Script of that turn or check runs through it. The snapshot knows how to turn a Script's home into its Owner, how to read the clock, the placeholders, the traits, the dictionaries, the places and the cast, and how to hand all of it to the sandbox.

Play takes its snapshot from the turn's playthrough state. Test Code and the Bench take theirs from the authored world at turn one, built by the same opening fold that Enter World runs. The Bench adopts Test Code's clock, enabled map and open cast. All four readers open a stat at the authored value, as play does.

The author sees one answer in three places. The maintainer edits one module.

## Rulings

Rulings from the grill, numbered as asked. Q7 was folded into Q6 before it was asked.

- **Q1** The snapshot is built once per turn or check and asked once per Script unit. `snapshotOf(state)` returns the snapshot; `snapshot.run(unit)` returns the sandbox result. The run options and the executor call are implementation. An `optionsFor(unit)` seam stays internal, for tests.
- **Q2** The Bench adopts all three of Test Code's turn-one readings: the clock (turn-start timings read zero elapsed; After the AI reads one hour), the authored enabled map (a write to a switched-off stat is dropped), and the open cast (a `diary` name the cast lacks is a warning, not a failure).
- **Q3** One input shape, not two adapters. A pure `openingStateOf(world, picks, persona)` is extracted from the Enter World effect and feeds the editors. It also replaces the third copy of the opening fold in the Test Bench's opening instrument.
- **Q4** The Bench's script check calls the snapshot directly. `runTestCode` keeps its report shape (writes, pending persona, dropped). The Bench maps results to Findings itself.
- **Q5** The mapping from a Script's home to its Owner is in scope. `run(unit)` takes the home and derives the Owner.
- **Q6** Test Code's editor-only overlays, the pending persona of the playable entities and the assumed stats for names the world lacks, are snapshot construction options. The Bench passes none. Play never sees them.
- **Q8** Play's seed rule is canonical: a stat opens at its authored value, then its min, then zero. `starting` is the delta baseline, not the opening number. The Bench, Test Code and the gate-stat start value adopt it. A Bench result that changes is a fix.
- **Q9** Four guards: an options table per Timing and Owner kind with no sandbox engine; Bench equals Test Code on a fixture world; only the snapshot imports the executor; a seed-rule bite test.
- **Q10** The name is Sandbox Snapshot. Its glossary entry is in `CONTEXT.md`.
- **Q11** Three home-to-Owner copies fold into the snapshot: the Bench's unit enumeration, Test Code's stat and trait lookup, and the editor's box owner (the script entry context and Find All Uses). The trait-gate owner resolver in the Bench rules stays out; it is not a Script owner.
- **Q12** GameViewer's Enter World effect switches to `openingStateOf` in this effort. The extraction would otherwise be a fourth copy.
- **Q13** A `SandboxState` is split out of the turn's input type. The turn type holds it as one field beside the per-turn parts (timing, triggers, replayed writes, narration, switched trait). `openingStateOf` returns a `SandboxState`.

## User Stories

1. As an author, I want Test Code and the Bench to agree on a Script's result, so that I trust the editor before I play.
2. As an author, I want the Bench to run my Script under the same clock a real turn one has, so that a `clock.elapsedHours` branch tests the way it plays.
3. As an author, I want the Bench to drop a write to a stat I switched off, so that the Bench shows the write play would drop.
4. As an author, I want the Bench to warn, not fail, on a `diary` name no entity has, so that a name I will add later does not read as a broken Script.
5. As an author, I want a stat to open at the value I typed, in play, in Test Code and in the Bench, so that one number means one thing.
6. As an author, I want the Enter World trait picker's gate preview to use the same opening value, so that a trait the preview shows as open is open when I enter.
7. As an author, I want Test Code on a Blueprint stat to still run with the group's stats as its Owner, so that a Blueprint Script tests without an entity.
8. As an author, I want Test Code to keep reporting pending persona writes and assumed stats, so that a half-authored world still tests.
9. As an author, I want Test Code and the Bench to keep running offline with no endpoint, so that checks stay instant and free.
10. As an author, I want an entity's own Script to run with that entity as `owner` in every reader, so that `owner.stats` names the same stats everywhere.
11. As an author, I want a trait's Script to read `self` the same way in play, Test Code and the Bench, so that a held or unheld trait reads the same.
12. As an author, I want a world script and a World Tool Script to run on the global stats in every reader, so that `stats` means the same list.
13. As an author, I want a During AI Output Script to rewrite a sample sentence in the editor as it rewrites a real one in play, so that the test is a real test.
14. As an author, I want a When a Trait Switches Script to fire on a sample trait in the editor the way it fires on a real switch, so that `trait` reads the same shape.
15. As an author, I want the Bench's Issues to keep their existing finding kinds for a failing Script and for unknown write names, so that my saved worlds' Issues lists still read the same.
16. As a player, I want a turn's Scripts to behave exactly as before, so that a refactor never changes my game.
17. As a player, I want a new game to open with the same stats, traits and entity stats as before, so that the opening turn is unchanged.
18. As a player, I want the opening turn's At Game Start Scripts to read the same world as before, so that a world's setup Script runs as the author tested it.
19. As a player, I want a loaded save to behave as before, so that the refactor never touches my progress.
20. As a prompt tuner, I want every request body to stay byte-equal, so that the parity harness stays green.
21. As a maintainer, I want one place that turns a Script's home into its Owner, so that a new Owner kind is one edit.
22. As a maintainer, I want one place that assembles what a Script can see, so that a new sandbox field is one edit.
23. As a maintainer, I want to test the assembled world of a Script as a table, with no sandbox engine, so that the tests run fast and read as a spec.
24. As a maintainer, I want a test that fails when the Bench and Test Code drift apart, so that the ADR-0005 promise is held by a guard, not a habit.
25. As a maintainer, I want only the snapshot to import the executor, so that a new caller cannot assemble the world its own way.
26. As a maintainer, I want the opening fold to be a pure function, so that a new-game bug is reproducible without React.
27. As a maintainer, I want the turn's input type to name its world part, so that the per-turn parts and the world parts stop sharing one flat record.
28. As a maintainer, I want a test that fails if a stat opens at `starting` again, so that the seed rule cannot drift back.
29. As an agent, I want the glossary to name the Sandbox Snapshot, so that specs and tickets use one word for it.

## Implementation Decisions

**The module and its interface.** The Sandbox Snapshot is a lib module with no React. Its interface is two operations. `snapshotOf(state, options?)` takes a `SandboxState` and optional editor overlays and returns a snapshot. `snapshot.run(unit)` takes one Script unit and returns the sandbox result the executor returns today. Everything a caller needed to know about run options, placeholder entries, trait entries, cast entries, dictionaries, places, the Owner entry, the self trait and the switched trait is implementation. `optionsFor(snapshot, unit)` is exported for the module's own tests and is not part of the interface callers use. As built, the module also exports the runtime-state and gate-stat helpers the turn module reads, the switched-trait resolver, the pending-persona id, and two named constructors (Test Code's snapshot and the Bench's) that exist for the parity test.

Ruled for ticket 03: the per-turn stat inputs (each stat's previous value, AI ask and regen, by Owner and for the global run) are a play-only construction option beside the editor overlays; editors omit them and read an untouched turn. The snapshot has a third member, `switchesOf(unit, result)`, which maps a result's trait writes from code names to ids through the entries the snapshot owns; the turn keeps the run-order merge. A trait's `self` where no Owner map holds the trait reads as not held in play as well as in the editor; play used to pass no `self` in that edge, so a Script reading `self.enabled` failed. That is a fix with a changelog line.

As built in ticket 03, for tickets 04 to 06: the per-turn readings option holds the global run's and each Owner's readings, and the caller leaves them empty at a turn-start Timing; the snapshot does not zero them. `switchesOf(unit, writes)` returns id-keyed trait switches with an optional Owner id. A Blueprint stat home carries its group's stats already under code names. The switched trait's event and the world it reads against are chosen by the turn and passed in the unit, since which world (the pre-switch or the state's) is a per-turn part.

**The unit.** A unit names a Script's home and its Timing, its code, and the per-run inputs the Timing needs: the narration input for During AI Output (play's live one; the editors' sample one, built by the snapshot from a sentence after ticket 10), the switched trait for When a Trait Switches or the `'sample'` sentinel the editors pass, the call arguments for a World Tool, and the prompt host for `player.*`. The home is one of: a global stat's box, an entity's own stat's box, a Blueprint group stat's box, a trait's box (held globally, by an entity, or on a Blueprint), a world script, or a World Tool Script.

**Owner derivation.** The snapshot turns a home into its Owner. A global stat, a world script and a World Tool run on the global stats with no Owner. An entity's stat or trait runs with that entity's cast entry as `owner`. A Blueprint stat runs with an entry of its own that holds the group's stats and no entity. A Blueprint trait runs with an empty Owner entry. A trait's `self` is its entry as its Owner's map holds it; one no map holds reads as not held. The module exports the Owner derivation so the editor's script entry context and Find All Uses read the same Owner for their analysis options; a thin adapter maps the derived Owner onto the editor's own owner type, which stays. The Blueprint rule that leaves `owner.stats` names unchecked keeps its current home and reads the derived Owner.

**SandboxState.** The world part of today's turn input becomes one named type: the global stats and their enabled map, the Owners and their stats, the traits in force (held, applied values, disabled ids, cascade-off ids, owned traits, the trait world and library), the placeholders with their rolls and pins, the places and current location, the discovered cast, and the clock. The turn input holds a `SandboxState` as one field beside its per-turn parts. The turn's own assembly of per-owner runs, run order, World Tool triggers and replayed writes stays in the turn module and calls `snapshot.run` per unit.

Field placement, ruled for ticket 01: an Owner row in the state carries its id, stats and enabled map; the Owner's per-turn part (previous values, asks, regen applied) sits beside the state keyed by Owner id. The gate stats are board state and live in the state; the opening fold produces them too. The world's script list, the per-turn penalties, the log-naming functions, the switched-from world and the triggers-only flag are per-turn parts beside the state. Today's field names stay inside the state; no rename rides with the split.

**The opening fold.** `openingStateOf(world, picks, persona)` is a pure function that returns the `SandboxState` a new game opens with: seeded global stats, held picks acquired in order, global rows and owned traits applied, entity stats seeded, the opening clock, no rolls. The Enter World effect calls it and keeps only its setters. The Test Bench's opening instrument calls it. Test Code and the Bench call it with no picks and no persona, then hand the result to `snapshotOf`. The fold itself holds no rolls; there is no roll argument. The editors re-seed the home stat's value through the fold too, so a mid-edit stat opens by the seed rule.

Ruled for ticket 02: the fold returns a complete `SandboxState`. Its placeholder set holds the world's placeholders with no rolls and no pins; its places are the world's locations with the Starting Location as current; its discovered cast is empty; its clock is zero with no calendar. Play's view replaces the placeholder set with the session's and the places with the live location. The fold takes the authored world slice, the picks (global and owned) and the persona pick with its library characters. The Bench's opening instrument settles global stats and entity stats in one call under the chosen persona, as play does; its earlier persona-blind global settling was a drift. Two more copies of the global half of the fold stay for a later effort: Enter World's draft-pin preview and the lens the authoring tour reads.

As built in ticket 02: the fold returns the `SandboxState` plus what only play's setters need (every entity's seeded stats as the baseline, the starting traits and the trait state, with each applied global row's owner for the start log). `openingStateOf` is the fold's state alone; Enter World calls the full fold, the editors call `openingStateOf`. Both are one computation.

**Seed rule.** A stat opens at its authored value when one is set, else its min, clamped to its range; an authored zero is zero (ruled for ticket 09: `??` semantics plus a clamp, not `||`). `starting` is the baseline the opening turn's deltas read from, and the seed writes it from the opening value; an authored `starting` is never read at the seed (ruled for ticket 09). Both rules live in the one seed function, which the authored-scene Chip Scene reads too. The Bench's two sanity rules on a stat's start (out of range, no descriptor at the start) judge the authored number, not the opening one, so they read the unclamped value through a second helper and keep firing. The descriptor bar is an opening reader: its caption and start band show the clamped opening value, where a fresh game opens (ruled for ticket 09). The gate-stat start value, the Bench's turn-one seeding and Test Code's stats adopt this rule. The Enter World picker's gate preview reads the gate-stat start value, so it adopts the rule too. Adopting the rule covers the whole chain, not only the `starting`-first case: a stat with no authored value opens at its min in every reader, where Test Code read zero before (ruled for ticket 07). Ticket 04 later takes Test Code's stats from the opening fold, which seeds by the same rule. The editor's descriptor bar start band reads the same start value and marks the authored value (ruled after ticket 07 landed). Two concepts share the word: the delta baseline keeps reading `starting` first (the per-turn stat-change map); the opening number follows Q8. Three more opening readers adopt the rule in ticket 08: the code hover card's Starts At line, a Link's Base Value and the save backfill of a stat the save lacks. A linked copy still drops the Original's `starting` (ruled for ticket 08): a copy can override its Base Value, so its delta baseline is its own opening value, never the Original's. A Link's Base Value override saved while the field read `starting` can show as stale where the Original's `starting` differs from its value; the override still wins, and nothing migrates (ruled for ticket 08).

**Editor overlays.** Two construction options exist for Test Code: a pending persona built from the playable entities, so a `persona` write to a trait or placeholder a persona-capable entity holds is reported as pending; and assumed stats for names the world lacks, so a Script can be tested before its stats exist. The Bench passes neither.

Ruled for ticket 04: Test Code takes the authored world slice and runs it through the opening fold with no picks and no persona. With no picks the fold applies no trait, so Test Code's numbers do not change. Its cast does: `entities` holds the cast a new game opens with, so an entity that can only be played as a persona is left out, as in play with no persona, and `persona` is play's empty entry. Its name lookups return a unit home, and the Owner comes from the snapshot's derivation. The open cast is a snapshot reading option beside the turn readings, not an overlay; the editors pass it and play does not.

**Bench readings.** The Bench's check builds the clock from the Timing as Test Code does, passes the authored enabled map, and runs with the cast open. Under the open cast a `diary` for a name the cast lacks is a warning row under the existing unknown-name kind, with its own sentence in Test Code's phrasing, since play may discover the name (ruled for ticket 06). The two existing messages do not change.

**The Bench's check.** It enumerates its units through the snapshot's Owner derivation, calls `snapshot.run` per unit, and maps a failing result to its existing execution finding and unknown write names to its existing unknown-name finding. Finding kinds and message shapes do not change.

**Test Code.** `runTestCode` builds a snapshot with its overlays, runs the unit, and shapes its report as today. Its Owner type for the box goes away; the home carries the Owner.

**The executor.** Unchanged. It stays the inner seam the three readers share. The sandbox exposes nothing new; the stat record and the story-clock variables stay the whole surface.

**No export-shape change.** World and save JSON are untouched.

**Changelog.** Two Fixed entries, merged by hand after the tickets landed, since a fragment always lands as its own entry: one for the opening value (tickets 07, 08, 09) and one for the editors' turn-one world (tickets 03, 04, 06). The executor-import guard (Q9) matches the `executeStatCode` import, not the shared formatters and field lists in that module.

## Testing Decisions

A good test drives the snapshot's interface or the opening fold and asserts what a Script, an author or a player would see. It never asserts a private helper.

- **Options table.** For each Timing and each Owner kind (global stat, entity stat, Blueprint stat, trait on an entity, trait on a Blueprint, world script, World Tool), build a snapshot from a small fixture state and assert the assembled run options: the Owner entry, `self`, the clock, the enabled map, the cast, the narration or switched-trait input. No sandbox engine runs. Prior art: the Test Code run tests and the executor tests, which already build small worlds by hand.
- **Bench equals Test Code.** On one fixture world, the options the Bench's snapshot assembles for a unit equal the options Test Code's snapshot assembles for the same unit. This is the guard for ADR-0005. Prior art: the drift test that keeps the help window's sandbox global names equal to the surface's list.
- **Only the snapshot imports the executor.** A test walks the source tree and fails if a non-test file outside the snapshot module imports the executor. Prior art: the account site's bundle boundary test.
- **Seed-rule bite.** A stat authored with `starting` 10 and value 5 reads 5 at turn one in the Bench and in Test Code. The test fails on today's Bench seeding. The same fixture asserts the gate-stat start value.
- **Opening fold.** `openingStateOf` returns the same stats, traits, entity stats and clock the effect produced for a fixture world with picks and a persona. Prior art: the trait runtime tests for acquiring and settling traits.
- **Play unchanged.** The parity fixtures stay byte-equal. The existing GameViewer tests for the opening turn, staged On Call writes and output Scripts stay green without edits to their assertions.
- **Bench and Test Code behavior.** The existing script-check and Test Code tests stay green, with assertion updates only where a ruling changed the result (clock, enabled map, open cast, seed).

**Spec review after landing.** Tickets 01 to 09 landed and were reviewed against this spec on 2026-10-20. One gap remained: Test Code and the Bench still built the During AI Output narration input themselves. Ticket 10 moves it into the snapshot. The six changelog lines were merged to two by hand.

## Out of Scope

- The Script Reader: one interface from a home and Timing to the surface, analysis options and Variable tree. The Owner derivation this spec exports is its first piece; the rest is a later effort.
- Replacing the Bench's regex unknown-stat check with the editor's analyzer.
- Splitting the Bench rules file by rule family, and the trait-gate owner resolver.
- The three `StatCodeNames` adapters.
- Any new sandbox exposure. The stat record and story-clock variables stay the whole surface.
- Export-shape changes, prompt text changes, and the executor's own behavior.

## Further Notes

- This effort comes from the architecture review of 2026-10-20. It is candidate 1 of eight; candidates 4 and 5 (the Script Reader and the Bench analyzer) build on it.
- ADR-0005 stands. This effort moves its promise one seam higher: the Bench shares play's world assembly, not only play's engine.
- The glossary entry for Sandbox Snapshot was added to `CONTEXT.md` during the grill and lands with this spec.
- The seed rule ruling (Q8) can change a Bench Issues list, a Test Code result and the Enter World gate preview for a world that authors both `starting` and `value` with different numbers. The changelog line covers it.
