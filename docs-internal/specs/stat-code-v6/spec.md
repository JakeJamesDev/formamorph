# Stat Code v6: Writes To Other Stats

Status: done
Status note: Closed 2026-10-11. Tickets 01–08 done; last landing 9779a1bc. Gates green on 2026-10-11.
Spec session: stat-code-v6 — spec

## Problem Statement

Stat code can read every stat but write only its own. An author who wants one event to move several stats has to split the logic: the event in one stat's box, and a reaction in each target stat's box that reads the event stat. Because every box runs over one snapshot, the reactions see last turn's event unless the author also learns to put the event in the Before the AI box and each reaction in an After the AI box. One idea, three boxes, and a timing rule.

The case that prompted this: a d20 stat that rolls, pins the result text to a placeholder, halves Health on a 1, and adds one Luck on a 20. That is one block of code in any other scripting surface.

## Solution

Stat code may write another stat of the same owner through the `stats` map: its `value`, `min`, `max`, and `regen`. The rules it already has for placeholder pins and trait switches apply: writes land in stat order within the owner, then owner order, the last write wins, and the Test Bench warns when two boxes write one field. A bound write behaves like a value write: `max = 20` makes the effective max 20 now, and every later change, from a trait, the AI, or code, moves from 20. Code no longer stores an override that hides the layers under it, so there is nothing to release and `null` is an error.

## User Stories

1. As a world author, I want to write another stat's value from my code, so that one event can move several stats from one box.
2. As a world author, I want to write another stat's min, max, or regen from my code, so that a hub stat can cap or speed up a target.
3. As a world author, I want `stats.Name.value += 1` and `stats.Name.value = x` both to land, so that the map reads and writes like `self`.
4. As a world author, I want a write to another stat to clamp to that stat's effective range, so that a hub cannot push a target past its cap.
5. As a world author, I want two boxes that write one stat field to land in stat order with the last write winning, so that the rule is the one I already know from pins and trait switches.
5a. As a world author, I want an entity stat's code to write its owner's other stats through `stats`, so that an NPC's own hub works as the player's does.
5b. As a world author, I want `entities[x].stats` and `persona.stats` to stay read-only, so that one owner's code never moves another owner's values.
5c. As a world author, I want a Blueprint stat's code that writes `stats.Name` to reach each owner's own copy, so that one script serves every bearer.
6. As a world author, I want the Test Bench to warn when two boxes write the same stat field, so that a race is loud before I ship.
7. As a world author, I want that warning to count the target's own box as a writer, so that a hub fighting the stat's own code is caught too.
8. As a world author, I want a write to a stat name that does not exist to be dropped and reported, so that a typo never throws at run time.
9. As a world author, I want the editor to underline an unknown stat name on the write side as it does on the read side, so that a rename is loud in the editor.
10. As a world author, I want a write to a disabled stat to be dropped and reported, so that a stat a trait switched off stays off.
11. As a world author, I want `max = 20` to make the effective max 20 now, so that a bound write reads like a value write.
12. As a world author, I want a trait switched after that write to add or remove its change from 20, so that no code number hides a trait.
13. As a world author, I want a bound write to persist like a value write, so that a hub that caps a stat on one turn does not lose the cap on the next.
14. As a world author, I want `null` written to any field to fail the run as a bad write, so that there is no second meaning to learn.
15. As a world author, I want a save made before this change to keep the same effective bounds after it loads, so that a playthrough in progress does not jump.
16. As a world author, I want Test Code on a hub to list every write it made to other stats, so that I see what the box does without running a turn.
17. As a world author, I want Test Code never to apply those writes to the authored world, so that testing is safe.
18. As a world author, I want a hub's write to be invisible to the target's box on the same run, so that the snapshot rule stays one rule.
19. As a world author, I want both boxes to be able to write other stats, so that the surface is the same before and after the AI.
20. As a world author, I want the "write to self instead" warning gone, so that the editor does not fight the feature.
21. As a world author, I want completions after `stats.Name.` to offer the writable fields, so that I can discover the write side.
22. As a world author, I want a template that rolls a die and moves two other stats, so that the hub pattern has a starting point.
23. As a world author, I want the existing templates checked against the new rules, so that none teaches a form that no longer holds.
24. As a player, I want a stat a hub moved to show on the bar as any code move does, so that the change is visible.
25. As a player, I want no new turn-log line for a hub write, so that the log stays as it reads today.
26. As a player, I want a hub write to roll back with the turn on a failed or stopped turn, so that half a turn leaves no trace.
27. As a world author, I want existing worlds to keep their meaning, so that a shipped world needs no edit.

## Implementation Decisions

**1. Sandbox surface.**

- Every entry in the owner's own `stats` map takes writes to `value`, `min`, `max`, and `regen`. The lock that made other entries read-only is lifted for those four fields. `entities[x].stats` and `persona.stats` keep their read-only lock and their dropped-write report, as Entity Stats Q9 and Q41 rule. `id`, `name`, `type`, `description`, `previous`, and `delta` stay read-only on every entry, `self` included.
- `self` is still the same object as its map entry, so a write through either path is one write.
- A write to an unknown stat name reaches the blank entry the map already hands out. The write is recorded and reported as a dropped write, by its path, as an unknown placeholder write is. Nothing throws.
- A write to a disabled stat is recorded and reported as a dropped write.
- `null` written to any writable field fails the run with the existing `non-number` kind, the same as a string. No new failure kind and no change to the Test Bench reason line (Q15).
- Writing other stats works in both boxes. One surface list, one drift guard.

**2. Executor result.**

- The executor already tracks which paths each entry's code wrote. It now marshals the written fields of every entry back out, not only `self`, and diffs each against what it injected. The result carries a list of stat writes, one per written entry: the target stat id and each written field's number.
- For `value`, the diff rule is unchanged: a changed field is a write, an untouched field keeps the pipeline's result. For `min`, `max`, and `regen`, any assignment is a write, changed or not, as a placeholder assignment is, so the written number is what lands after this run's trait switches (Q17). The same rules apply to every other entry.
- Any failure discards every write from that run, as today.

**3. Per-turn run.**

- The run collects every stat's writes keyed by target id, in stat order within each owner. For one target field, the last writer wins: stat order within the owner, then owner order across owners, the player first and entities in authored order, as Entity Stats Q42 already settles pins and trait switches. Since writes stay inside one owner, owner order only matters for pins and switches.
- A Blueprint stat's code runs once per owner with that owner's `stats`, so a write to `stats.Name` lands on each owner's own copy.
- **Bounds are ledgers, not overrides (Q14).** The stored code bounds layer and its replace-the-sum derive step go. Each stat carries a code delta per bound field, beside the AI's max delta, and the derive step adds it on top: base, plus trait changes, plus the AI delta, plus the code delta. A write of `max = 20` books `20 minus the effective max` into the ledger, so the stat derives to 20 after this run. A trait switched later adds or removes its change from 20; an AI max change adds to it; a later code write books a new difference. Min and regen work the same way with their own ledgers.
- **The effective min never goes below the authored base min (Q19).** The floor applies to the whole sum, trait changes and code delta together, so no layer digs under the author's floor. The code min delta is measured before the floor, as the max delta is measured before the min floor.
- The difference is taken against the bounds as re-derived after this run's trait switches, so the written number is what the stat shows when the run lands, whatever its own switch moved. This keeps v2's order: switches first, then bounds re-derived, then code bounds and values on top.
- Values are clamped to the target's effective range after its bounds write, as a self write is today.
- The empty-boxes clear from v5 goes: there is no stored override to clear. Deleting code leaves the ledger where it is, as deleting a trait leaves the AI's delta.
- Each box still runs in parallel over one snapshot. A hub's write to Health is not visible to Health's box on the same run, and not in Health's `delta.actual` during that run. It is in Health's `previous` on the next turn.
- Live delta feedback folds hub moves in as it folds self moves in. No log entry is written for a hub write.
- Rollback and re-roll are unchanged: hub writes are part of the run's stat result and go back with the turn's snapshot.

**4. Editor.**

- The "writes to another stat, write to self instead" diagnostic is removed, with its tests.
- The unknown-stat underline covers write paths as it covers read paths.
- Replacing a whole entry, `stats.Health = 5`, stays dropped by the executor and keeps one editor warning on any entry: "Write to <path>.value instead." Field writes on other entries get no warning. The field documentation for `value`, `min`, `max`, and `regen` is worded to hold after `self.` and after a map entry. A write to another stat counts as the code doing something for the missing-return warning, as a self write does (Q18).
- Completions after a stat map entry's dot offer the four writable fields with the same documentation they carry on `self`.
- Test Code lists the box's writes to other stats beside its own value, bounds, pins, and switches: stat name, field, and the number. These are shown, never applied. On an entity stat's box the targets are its owner's stats, seeded at their starting values as Entity Stats Q46 seeds them.

**5. Test Bench.**

- A new rule, two writers on one stat field. It scans every box in the world, per owner, for a write to `self.<field>` or to `stats.<Name>.<field>` by dot or bracket literal, resolves `self` to the owning stat, and reports each owner's stat field with more than one writing box. A Blueprint stat's box counts once per owner it runs for. Severity warning. The finding names the field and each writer with its box label. Computed names are out of reach and the rule says nothing about them.
- The rule runs in the static pass; it does not spin the VM.

**6. Templates.**

- One new After the AI template, Dice Roll With Consequences: a d20 roll, a placeholder pin of the band text, a halving write to one target stat on a 1, and a plus-one write to another on a 20, with slots for the two target stats and the placeholder. A comment names the stat-order rule.
- A sweep of the existing templates against the new rules follows as its own ticket: any template whose comment or structure assumes self-only writes or a code bound that replaces traits is updated.

**7. Docs.**

- The stat code guide gains a section on writing other stats: the four fields, same owner only, stat order and last write wins, the same-run snapshot rule, and the Blueprint per-owner note. Its bounds section is rewritten: a bound write sets the number now and later changes move from it, like a value. The lines about a code bound replacing traits go. The existing lines that call `entities[x].stats` and `persona.stats` read-only stay.
- The in-app help for the Code tab gets the matching line. The changelog entry ships with the feature.

**8. Shapes.**

- No world export change. `Stat.code` and the before-the-AI field stay strings.
- **Save shape change.** The stored code bounds field on a player stat is replaced by a per-field code delta ledger beside the AI max delta. Code bounds shipped in v3.2.1, so a save can carry the old field. On load, each stored code bound on a player stat becomes a ledger entry: the bound minus the bound derived without it under the player's stat traits in force, persona-linked traits included. The old field is then dropped. Entity stats are in no release tag, so an entity stat's stored bound is an unreleased form and gets no migration (Q16). Idempotent, applied in the post-load settle once the player's bearers are known, since a library persona loads async. Until that settle runs, a stat that still carries the legacy stored field derives its bounds as that stored override, the v5 read, so a derive in the window reads the saved bound (Q20). The user sets the version.

## Testing Decisions

A good test drives a run and reads what came out: the stats, the stored bounds, the reported drops, the bench findings. It never reads the prelude text or the editor's internal state.

- **Primary seam: the per-turn run.** Given two stats where one writes the other, assert: a value write lands clamped; a bound write lands as the written number after this run's trait switches; a trait switched on the next turn moves from that number; an AI max change adds to it; `null` on any field fails the run; two writers on one field land in stat order; a self write and a hub write on one field follow the same order; a hub write is not visible to the target's box on the same run; a stat with empty boxes keeps its ledger; a write to an unknown or disabled stat is dropped and reported; a failing hub discards all its writes. Prior art: the per-turn tests beside the turn module.
- **Executor seam.** Marshaling only: a write to another entry comes back keyed by that entry; `self` and its map entry are one write; `null` on any field is a bad write; read-only fields on another entry are reported by path. Prior art: the executor's own tests.
- **Editor seam.** The other-stat warning is gone; an unknown name on the write side is underlined; completions after a map entry's dot list the writable fields; Test Code lists writes to other stats and applies none. Prior art: the analysis and stat panel tests.
- **Bench seam.** The two-writers rule fires for `self` plus a hub, for two hubs, by dot and by bracket, names the box, and stays quiet for one writer and for computed names. Prior art: the rules tests.
- **Templates.** The new template renders with its slots and runs clean under the executor. Prior art: the templates test file.
- **Save migration.** A save with the old stored code bounds loads to the same effective min, max, and regen it showed before, with the ledger holding the difference and the old field gone; loading twice changes nothing. Prior art: the save envelope migration tests.
- **Live check.** The e2e stat-code spec gains one case where a hub writes another stat and the bar shows the move.

## Out of Scope

- Writing `previous`, `delta`, `id`, `name`, `type`, or `description` on any entry.
- Writes to another owner's stats through `entities[x].stats` or `persona.stats`. Entity Stats Q9 and Q41 stand (Q13).
- A turn-log line naming the writer.
- Summing deltas when two boxes write one field.
- Any way to see a hub's write from the target's box on the same run.

## Further Notes

- Grilled 2026-10-04. Q1 all four fields; Q2 stat order, last write wins; Q3 bench warning; Q4 new spec; Q5 and Q9 `null` is the one release, empty-boxes clear removed; Q6 Test Code lists hub writes, live delta as today, no log line; Q7 unknown and disabled targets dropped and reported, editor underlines; Q8 one new template plus a sweep; Q10 `null` on `self` too; Q11 finding per stat and field, any two writers; Q12 stale stored bound explained in the guide, no new UI; Q13 (2026-10-11) same owner only, after Entity Stats landed; **Q14 (2026-10-11) bounds are ledgers: a write sets the number now, later changes move from it, `null` is an error.** Q14 supersedes Q5, Q9, Q10, and Q12: there is no stored override, so no release and no stale bound. Q15 (ticket 01): `null` on a stat field keeps the `non-number` failure kind; only tests are added. Q16 (ticket 01): the save migration covers player stats only; entity code bounds never shipped. Q17 (ticket 01): any assignment to a bound field is a write, changed or not; value keeps the diff rule. Q18 (ticket 03): whole-entry replace keeps one warning on any entry; field docs hold for self and map entries; a cross-write satisfies the missing-return check. Q19 (review, 2026-10-11): the effective min is floored at the authored base min, traits and code together; the code min delta is measured pre-floor. Q20 (ticket 08): a stat still carrying the legacy stored field derives as that override until the post-load settle migrates it.
- **Behavior change for shipped worlds.** A code bound no longer hides the trait and AI layers under it; traits add on top of the written number. Checked 2026-10-11: no bundled world writes a bound, and the user's wip worlds only read `self.max`. A stat whose code was deleted keeps its ledger in an in-progress playthrough. A new playthrough is unaffected.
- **Shared-seed claim retracted (ticket 08, 2026-10-11).** Bare QuickJS contexts made in the same millisecond do share a `Math.random` seed, but a stat run takes about 2.5 ms, so 0 of 200 parallel stat-run pairs drew the same number. The template line "a second draws the same numbers" is removed from the dice template and from Random Per-Turn Roll, and the guide's reseed warning now says each stat's code draws its own numbers.
- **Q19 and Q20 together:** a v3.2.1 save whose stored code min sits below the authored min reads that min until the settle runs, then rises to the authored min. Tested; the migration helper's doc says so.
- Builds on Entity Stats: owners, owner order, per-owner code bounds, Blueprint stats. Tickets base on a commit after that effort lands.
- The v2 story "code writes only its own stat's bounds so two scripts never race" is superseded. The race is now author-visible through the bench rule and settled by stat order.
