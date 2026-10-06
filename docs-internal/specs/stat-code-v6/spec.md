# Stat Code v6: Writes To Other Stats

Status: needs-info
Status note: Grilled 2026-10-04, Q1–Q12. Tickets on hold; more to discuss before they are cut.

## Problem Statement

Stat code can read every stat but write only its own. An author who wants one event to move several stats has to split the logic: the event in one stat's box, and a reaction in each target stat's box that reads the event stat. Because every box runs over one snapshot, the reactions see last turn's event unless the author also learns to put the event in the Before the AI box and each reaction in an After the AI box. One idea, three boxes, and a timing rule.

The case that prompted this: a d20 stat that rolls, pins the result text to a placeholder, halves Health on a 1, and adds one Luck on a 20. That is one block of code in any other scripting surface.

## Solution

Stat code may write another stat through the `stats` map: its `value`, `min`, `max`, and `regen`. The rules it already has for placeholder pins and trait switches apply: writes land in stat order, the last write wins, and the Test Bench warns when two boxes write one field. A code bound now has one release, writing `null`, on `self` or on any stat. The empty-boxes clear from v5 goes away.

## User Stories

1. As a world author, I want to write another stat's value from my code, so that one event can move several stats from one box.
2. As a world author, I want to write another stat's min, max, or regen from my code, so that a hub stat can cap or speed up a target.
3. As a world author, I want `stats.Name.value += 1` and `stats.Name.value = x` both to land, so that the map reads and writes like `self`.
4. As a world author, I want a write to another stat to clamp to that stat's effective range, so that a hub cannot push a target past its cap.
5. As a world author, I want two boxes that write one stat field to land in stat order with the last write winning, so that the rule is the one I already know from pins and trait switches.
6. As a world author, I want the Test Bench to warn when two boxes write the same stat field, so that a race is loud before I ship.
7. As a world author, I want that warning to count the target's own box as a writer, so that a hub fighting the stat's own code is caught too.
8. As a world author, I want a write to a stat name that does not exist to be dropped and reported, so that a typo never throws at run time.
9. As a world author, I want the editor to underline an unknown stat name on the write side as it does on the read side, so that a rename is loud in the editor.
10. As a world author, I want a write to a disabled stat to be dropped and reported, so that a stat a trait switched off stays off.
11. As a world author, I want to release a code bound by writing `null` to it, so that a cap I set from a hub can be lifted from any box.
12. As a world author, I want `self.max = null` to release the same way, so that there is one release everywhere.
13. As a world author, I want a code bound to stay stored until code writes a new number or `null`, so that a hub that writes a cap on one turn does not lose it on the next.
14. As a world author, I want deleting a stat's code to leave its stored bounds alone, so that a hub's bound on a stat with no code survives.
15. As a world author, I want the guide to tell me that a stored bound outlives the code that wrote it and how to release it, so that I am not surprised in a playthrough I edited mid-game.
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

- Every entry in `stats` takes writes to `value`, `min`, `max`, and `regen`. The lock that made other entries read-only is lifted for those four fields. `id`, `name`, `type`, `description`, `previous`, and `delta` stay read-only on every entry, `self` included.
- `self` is still the same object as its map entry, so a write through either path is one write.
- A write to an unknown stat name reaches the blank entry the map already hands out. The write is recorded and reported as a dropped write, by its path, as an unknown placeholder write is. Nothing throws.
- A write to a disabled stat is recorded and reported as a dropped write.
- `null` is a valid write to `min`, `max`, or `regen` on any entry. It means release the stored code bound for that field. `null` to `value` is a bad write and fails the run.
- Writing other stats works in both boxes. One surface list, one drift guard.

**2. Executor result.**

- The executor already tracks which paths each entry's code wrote. It now marshals the written fields of every entry back out, not only `self`, and diffs each against what it injected. The result carries a list of stat writes, one per written entry: the target stat id, the written value when the code wrote one, and the written bounds with `null` meaning release.
- The `self` diff rule is unchanged: a changed field is a write, an untouched field keeps the pipeline's result. The same rule applies to every other entry.
- Any failure discards every write from that run, as today.

**3. Per-turn run.**

- The run collects every stat's writes keyed by target id, in stat order. For one target field, the last writer in stat order wins. Stat order is the world's authored stat list, the order that already settles pins and trait switches.
- Values are clamped to the target's effective range after its bounds write, as a self write is today.
- Bounds writes lay over the target's stored code bounds field by field. A `null` removes that field from the stored bounds. A target with no stored bounds and only releases ends with none.
- The empty-boxes clear is removed: a stat with two empty boxes keeps whatever code bounds are stored on it. This reopens a v5 ruling on new evidence: a stat with no code can now carry a code bound a hub stored.
- Each box still runs in parallel over one snapshot. A hub's write to Health is not visible to Health's box on the same run, and not in Health's `delta.actual` during that run. It is in Health's `previous` on the next turn.
- Live delta feedback folds hub moves in as it folds self moves in. No log entry is written for a hub write.
- Rollback and re-roll are unchanged: hub writes are part of the run's stat result and go back with the turn's snapshot.

**4. Editor.**

- The "writes to another stat, write to self instead" diagnostic is removed, with its tests.
- The unknown-stat underline covers write paths as it covers read paths.
- Completions after a stat map entry's dot offer the four writable fields with the same documentation they carry on `self`, and `null` is mentioned in the bound fields' hover text.
- Test Code lists the box's writes to other stats beside its own value, bounds, pins, and switches: stat name, field, and the number or "released". These are shown, never applied.

**5. Test Bench.**

- A new rule, two writers on one stat field. It scans every box in the world for a write to `self.<field>` or to `stats.<Name>.<field>` by dot or bracket literal, resolves `self` to the owning stat, and reports each stat field with more than one writing box. Severity warning. The finding names the field and each writer with its box label. Computed names are out of reach and the rule says nothing about them.
- The rule runs in the static pass; it does not spin the VM.

**6. Templates.**

- One new After the AI template, Dice Roll With Consequences: a d20 roll, a placeholder pin of the band text, a halving write to one target stat on a 1, and a plus-one write to another on a 20, with slots for the two target stats and the placeholder. A comment names the stat-order rule.
- A sweep of the existing templates against the new rules follows as its own ticket: any template whose comment or structure assumes self-only writes or the empty-boxes clear is updated.

**7. Docs.**

- The stat code guide gains a section on writing other stats: the four fields, stat order and last write wins, the same-run snapshot rule, `null` as the one release, and the note that a stored bound outlives the code that wrote it in a playthrough edited mid-game.
- The in-app help for the Code tab gets the matching line. The changelog entry ships with the feature.

**8. Shapes.**

- No world export change. `Stat.code` and the before-the-AI field stay strings.
- No save shape change. The stored code bounds field already exists per player stat; a release removes a key.

## Testing Decisions

A good test drives a run and reads what came out: the stats, the stored bounds, the reported drops, the bench findings. It never reads the prelude text or the editor's internal state.

- **Primary seam: the per-turn run.** Given two stats where one writes the other, assert: a value write lands clamped; a bounds write lays over stored bounds; `null` releases one field and leaves the rest; two writers on one field land in stat order; a self write and a hub write on one field follow the same order; a hub write is not visible to the target's box on the same run; a stat with empty boxes keeps stored bounds; a write to an unknown or disabled stat is dropped and reported; a failing hub discards all its writes. Prior art: the per-turn tests beside the turn module.
- **Executor seam.** Marshaling only: a write to another entry comes back keyed by that entry; `self` and its map entry are one write; `null` on a bound field is a release, `null` on `value` is a bad write; read-only fields on another entry are reported by path. Prior art: the executor's own tests.
- **Editor seam.** The other-stat warning is gone; an unknown name on the write side is underlined; completions after a map entry's dot list the writable fields; Test Code lists writes to other stats and applies none. Prior art: the analysis and stat panel tests.
- **Bench seam.** The two-writers rule fires for `self` plus a hub, for two hubs, by dot and by bracket, names the box, and stays quiet for one writer and for computed names. Prior art: the rules tests.
- **Templates.** The new template renders with its slots and runs clean under the executor. Prior art: the templates test file.
- **Live check.** The e2e stat-code spec gains one case where a hub writes another stat and the bar shows the move.

## Out of Scope

- Writing `previous`, `delta`, `id`, `name`, `type`, or `description` on any entry.
- Writes to stats owned by entities. The `stats` field on an entity entry stays reserved.
- A turn-log line naming the writer.
- A play-time marker for a stored code bound.
- Summing deltas when two boxes write one field.
- Any way to see a hub's write from the target's box on the same run.

## Further Notes

- Grilled 2026-10-04. Q1 all four fields; Q2 stat order, last write wins; Q3 bench warning; Q4 new spec; Q5 and Q9 `null` is the one release, empty-boxes clear removed; Q6 Test Code lists hub writes, live delta as today, no log line; Q7 unknown and disabled targets dropped and reported, editor underlines; Q8 one new template plus a sweep; Q10 `null` on `self` too; Q11 finding per stat and field, any two writers; Q12 stale stored bound explained in the guide, no new UI.
- **Behavior change for shipped worlds.** A stat whose code was deleted no longer resets its stored bounds in an in-progress playthrough. A new playthrough is unaffected. The user ruled this in.
- The v2 story "code writes only its own stat's bounds so two scripts never race" is superseded. The race is now author-visible through the bench rule and settled by stat order.
