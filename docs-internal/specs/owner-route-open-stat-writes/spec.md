# Owner Route And Open Stat Writes

Status: done
Status note: Closed 2026-10-13. Tickets 01–08 done; last landing 44125b0ad, review fold-in e5a2b3c21. Gates green on 2026-10-13 at e5a2b3c21; none run at close.
Spec session: owner-route-open-stat-writes — spec

## Problem Statement

In an entity stat's code, `stats` holds the owning entity's stats, not the world stats. So code on one of The Creature's stats in City Rampage can't read Destruction at all, because the sandbox has no other route to the world stats. `traits` works the other way: it is the world traits in every owner's code. The two maps change meaning in different ways, and authors have to learn which is which.

Writes have a second wall. Code can write only its own owner's stats, and `entities[x].stats` and `persona.stats` are read-only. An author who wants a Creature stat to push Alert Level, or a world stat to drain an NPC's Stamina, has to split the idea across boxes and owners and route around the lock.

## Solution

`stats` means the world stats in every owner's code, as `traits` means the world traits. A new top-level `owner` is the entity that owns the running stat. It has the same shape as an `entities[x]` entry, so code reaches its own stats as `owner.stats`, its own traits as `owner.traits`, and its own placeholders as `owner.placeholders`. In world-stat code, `owner` is an empty entry. In Blueprint stat code, `owner` is the bearer the run is for.

Every stat takes writes to `value`, `min`, `max`, and `regen`, whatever route reaches it: `stats`, `owner.stats`, `entities[x].stats`, or `persona.stats`. The v6 rules carry over across owners. Every owner's code reads one snapshot, writes land in owner order and then stat order, the last write wins, and the Test Bench warns when two boxes write one field.

## User Stories

1. As a world author, I want `stats` to mean the world stats in an entity stat's code, so that The Creature's code can read Destruction.
2. As a world author, I want `stats` and `traits` to mean the same scope in every box, so that I learn one rule.
3. As a world author, I want `owner.stats` to hold the running stat's owner's stats, so that an entity's code reads its own stats without spelling its name.
4. As a world author, I want `owner.traits` to hold the owner's traits, so that an entity's code switches its own traits by the same route.
5. As a world author, I want `owner.placeholders` to hold the owner's placeholders, so that every owned value has one route from `owner`.
6. As a world author, I want `owner` to have the same fields as an `entities[x]` entry, so that I don't learn a second entry shape.
7. As a world author, I want `owner` in world-stat code to be an empty entry, so that the same script runs in any box without an error.
8. As a world author, I want a write through an empty `owner` to be dropped and reported, so that I see the mistake instead of losing it.
9. As a world author, I want a Blueprint stat's `owner` to be the bearer it runs for, so that one script reaches each bearer's own copy.
10. As a world author, I want a Blueprint stat's `stats` to be the world stats too, so that Blueprint code follows the same rule as every other box.
11. As a world author, I want `self` to stay the running stat's own entry, so that existing self-only code keeps working in every box.
12. As a world author, I want `self` in an entity stat's code to be the same entry as `owner.stats.<Name>`, so that a write through either route is one write.
13. As a world author, I want to write `value`, `min`, `max`, and `regen` on any world stat from an entity stat's code, so that The Creature's fury can push Alert Level.
14. As a world author, I want to write any entity's stats through `entities[x].stats`, so that a world event can drain an NPC.
15. As a world author, I want to write the played persona's stats through `persona.stats`, so that world code can move them.
16. As a world author, I want `id`, `name`, `type`, `description`, `previous`, and `delta` to stay read-only on every entry, so that a rename in the middle of a turn doesn't break code-name routes.
17. As a world author, I want two writes to one stat field from different owners to resolve in owner order (Other Stats, then world entities in authored order, then library entities in pick order), with the last write winning, so that the result is predictable.
18. As a world author, I want writes within one owner to stay in stat order, so that v6's rule holds inside each owner.
19. As a world author, I want every owner's code to read one snapshot, so that no script sees another script's write in the same run and nothing loops or races.
20. As a world author, I want a write to a switched-off stat to be dropped and reported, so that a disabled stat stays untouched.
21. As a world author, I want a write to an unknown stat to be dropped and reported, so that a typo shows up.
22. As a world author, I want a write to an entity that isn't in the game to be dropped and reported, so that an absent NPC stays untouched.
23. As a world author, I want the editor to underline a write to an unknown stat on any route, so that I see the typo before I play.
24. As a world author, I want the editor to stop calling `entities[x].stats` and `persona.stats` read-only, so that its advice matches the runtime.
25. As a world author, I want completion after `owner.` to list `stats`, `traits`, and `placeholders`, so that I can find the route.
26. As a world author, I want completion after `owner.stats.` to list the owner's stats, so that I pick a real name.
27. As a world author, I want completion after `stats.` in an entity stat's box to list the world stats, so that the menu matches the runtime.
28. As a world author, I want the Variable menu to show an Owner group in an owned or Blueprint stat's box, so that I can insert owner paths by clicking.
29. As a world author, I want the Variable menu's Stats group to list world stats in every box, so that it matches `stats`.
30. As a world author, I want Test Code to list writes to other owners' stats with owner, stat, field, and number, so that I see what the box would do.
31. As a world author, I want Test Code to seed every target at its starting value, so that the listed numbers are realistic.
32. As a world author, I want Test Code to list dropped writes on every route, so that I see which writes would be ignored.
33. As a world author, I want the Test Bench to warn when two boxes write the same field of the same owner's stat through any route, so that a cross-owner race is visible.
34. As a world author, I want that warning to treat `owner.stats.X`, `entities["Name"].stats.X`, and `persona.stats.X` as the same target when they reach the same stat, so that aliases don't hide a race.
35. As a world author, I want a Blueprint box to count once per bearer in that warning, so that each bearer's copy is judged on its own.
36. As a world author, I want the Stat Code Guide to explain `owner` and open writes, so that I can learn the rule from the docs.
37. As a world author, I want the Quick Reference to show `owner` and the write routes, so that the short form matches the runtime.
38. As a player of a bundled world, I want the drone and The Student's stat code to keep working, so that the change doesn't break bundled worlds.
39. As a Formaquestion user, I want help answers about stat code to describe `owner` and open writes, so that the assistant doesn't teach the old rule.

## Implementation Decisions

Rulings from the grill (2026-10-13):

- **Q1** A top-level `owner` is the code's owning entity. It has `stats`, `traits`, and `placeholders`, in the same shape as an `entities[x]` entry.
- **Q2** In world-stat code, `owner` is an empty entry, like an empty `persona` today. Reads are blank, and writes are dropped and reported.
- **Q3** Code writes `value`, `min`, `max`, and `regen` on any stat. Every other field stays read-only.
- **Q4** Cross-owner writes land in owner order, as Q9 defines it. The last write wins. Within one owner, stat order still decides. The Test Bench warns on two writers.
- **Q5** In Blueprint stat code, `owner` is the bearer the run is for.
- **Q6** Every owner's code reads one snapshot. Writes apply after all code runs.
- **Q7** A write to a switched-off stat, an unknown stat, or an entity not in the game is dropped and reported. The editor underlines an unknown target.
- **Q8** Test Code lists cross-owner writes by owner, stat, and field, with targets seeded at their starting values.

Rulings from the spec review (2026-10-13):

- **Q9** Owner order follows the turn runner: Other Stats (the loose world stats) first, then world entities in authored order, then library entities (the library persona and Enter World characters) in pick order. A persona entity takes its place in that order like any entity, so a library persona lands last.
- **Q10** In Test Code, a Blueprint stat's `owner.stats` holds the stats of the Blueprint's group only.
- **Q11** With no playthrough, the Test Bench resolves `persona.stats.X` to every entity that can be played.
- **Q12** The two-writers rule counts each bearer of one Blueprint box as a writer. So a Blueprint box with two or more bearers that writes a world stat field gets the warning: every bearer reads one snapshot, so the stat moves once, not once per bearer. The guide explains this.
- **Q13** In an owned or Blueprint stat's box, a template's stat slot lists the owner's stats, which insert `owner.stats[...]`, and the world stats, which insert `stats[...]`.

Rulings from the closing review (2026-10-13):

- **Q14** Formaquestion's default code rider names `owner.stats` beside the world's `stats`. The user waived probe numbers for this line.
- **Q15** An unknown `owner.stats` name in a Blueprint box is a warning in the editor and on the Test Bench, because a bearer can hold more stats than the group.
- **Q16** The changelog folds this effort into the Entity Stats group, and the v6 Stat Code lines it supersedes go.
- **Q17** CONTEXT.md's Bearer avoid line keeps the clause that names the `owner` stat-code global as the one exception.
- The review's plain fixes land with these rulings: the stat move check knows the destination, so a moved stat that reaches `owner` breaks a move to the world; the unused turn-owner path goes; stale comments and guide lines follow owner order.

Settled before the grill, same day:

- `stats` is the world stats in every owner's code. This reverses Entity Stats Q29, and Q42 for `stats`.
- `entities[x].stats` and `persona.stats` take writes. This reverses Stat Code v6 Q13 and Entity Stats Q41.

Sandbox (executor):

- The executor gains `owner` as a run input: the owning entity, or the empty entry. It is bound beside `entities` and `persona`. When the owner is in the game, `owner` is the same object as its `entities` entry, as `persona` is today.
- The `stats` argument is always the world stats, without Blueprint stats (a Blueprint stat is never a world stat). An owned stat's `self` binds to its entry in `owner.stats`. In world-stat code, `self` stays its entry in `stats`.
- `owner` writes are keyed by entity id, not by name. The empty `owner` is its own entry, so its dropped writes never reach the persona. `owner` is still the owner's own entry when a later entity with the same name hides it in `entities`.
- A dropped-write report names the path as the code wrote it, for example `owner.stats.Rage.value`. One exception (ticket 01): when `owner` and the owner's `entities` entry are one object, the owner's stat map reports under `owner.stats.…` on both routes. The entry's own fields keep their `entities.<Name>` path. A separate owner entry (hidden by a same-name entity, or the empty owner) reports `owner.…` throughout.
- Ticket 01 changes the editor, Test Code, and the Test Bench only where its gates force it, for example the missing-name check accepting `owner`. Tickets 03–06 own the rest.
- The stat map on an `entities` entry uses the same lock as `stats`: the four writable fields are tracked, and every other field stays a read-only getter that reports its path.
- The result gains writes keyed by owner: the target entity, then the same stat-write rows `statWrites` holds today. `statWrites` keeps the world-stat writes. The unknown, switched-off, and read-only lists cover every route and name the full path.
- Writing a whole stat map, or replacing a whole entry, stays a read-only write.

Turn runner:

- Every owner's run passes the world stats as `stats` and its own entity as `owner`. A Blueprint stat's run passes its bearer.
- For `stats`, an owner's run passes the world run's code names, turn inputs, and enabled map. For `owner.stats`, it passes its own.
- Cross-owner writes merge per target before the first settle. So the gate snapshot (v6 Q19) and the starvation penalty see them, and a code write to a world stat skips the penalty as a world stat's own write does.
- Writes from all runs collect per target owner, then land in owner order (Q9) and stat order within each writer's owner. The last write wins per field. Landing uses the existing settle step, so bounds still book into the code delta as v6 Q14 rules.
- A target entity not in the game, a switched-off stat, or an unknown stat is dropped and reported through the existing dropped-write warnings.

Editor:

- Completion: `owner.` lists the entry fields; `owner.stats.` lists the owner's stats; `stats.` lists the world stats in every box. In a world-stat box, `owner` completes as an empty entry.
- Diagnostics: the read-only underline for `entities[x].stats.<Name>.<field>` and `persona.stats.<Name>.<field>` is removed for the four writable fields. An unknown stat name is underlined on every route.
- Variable menu: an Owner group appears in an owned or Blueprint stat's box. The Stats group lists world stats in every box.
- The stat-code surface tables (globals, entity fields, persona fields) gain `owner` and lose the read-only wording on `stats`.
- Self detection follows the owner. In an owned box, `owner.stats.<own name>` is the running stat, not `stats.<own name>`. The "write to `self` instead" hint and the missing-return check use that path.
- Ticket 03 ruling: in an owned box, `stats.<own name>` is a world stat that shares the name. It gets no `self` hint, but it still counts as a write for the missing-return check, as every write to another stat does (v6 Q18). Only the hint follows the running stat.
- The missing-name check knows `owner` as a root, beside `stats`, `entities`, and `persona`.
- Templates follow Q13: the stat slot's picker has both lists, and each inserts its own route.
- Ticket 04 rulings: the box context carries an owner kind (entity, Blueprint, or none) and separate world and owner stat name lists; ticket 03 reuses them for completion. In a Blueprint box, the Owner group lists what the stat Blueprints group holds, which is stats only, by analogy with Q10, never a union over bearers. A stat slot keeps its template text: a pick from the owner list rewrites the `stats` right before the slot to `owner.stats`, and the saved template shape does not change. The picker shows owner stats first, then world stats, each with an Owner or World trail. The template editor's Variable menu shows the Owner group only when the dialog opened from an owned or Blueprint box.

Test Code:

- An owned stat's box runs with the world stats as `stats` and its entity as `owner`. A Blueprint stat's box gets an `owner` that holds only the Blueprint group's stats (Q10). Every owner's stats start at their starting values.
- The writes list shows world writes as today and adds owner-keyed rows: owner, stat, field, number. A `persona.stats` write is listed with the pending persona writes, as persona trait writes are.
- Formaquestion's code test run finds owned and Blueprint stats as well as world stats, and passes the owner the same way.

Test Bench:

- The two-writers rule judges every target per owner and field across all writer boxes in the world. The write scan also roots at `owner.stats`, `entities.<Name>.stats`, `entities["Name"].stats`, and `persona.stats`, by dot or bracket literal. `owner` resolves to the writer's owner, once per bearer for a Blueprint box. Computed names stay out of reach.
- `persona.stats.X` resolves to every entity that can be played (Q11). Each bearer of a Blueprint box is a separate writer (Q12).
- The unknown-stat rule scans owned and linked boxes as well as world boxes. It checks `stats.X` against the world stats, `owner.stats.X` against the owner's stats, and `entities[x].stats.Y` and `persona.stats.Y` against that entity's stats.
- The Issues run that executes every box also runs owned and Blueprint boxes, each with its `owner`.
- Ticket 06 rulings:
  - In the two-writers finding, a writer from another owner than the target's is labeled with its stat and owner, for example `After the AI code on “Rage” of “The Creature”`. A Blueprint bearer is labeled the same way. A same-owner writer keeps the bare label. The finding points at the target: the stat row for a world stat, the entity row for an entity stat.
  - `persona.stats.Y` is unknown only when no entity that can be played has Y, including a world where no entity can be played.
  - `entities.N.stats.Y` with no entity named N is reported, and the message names the missing entity.
  - `owner.stats.Y` in a world-stat box is always reported, because the owner is empty.
  - In a Blueprint box, `owner.stats.Y` is checked against the Blueprint group's stats (Q10), and the Issues run runs the box once with that group-only owner, also when nothing bears it.
  - An owned box's findings point at its entity row. A Blueprint stat's own findings point at its stat row.
  - A link whose bearer overrides `code` or `beforeCode` is that bearer's own box: the Issues run runs it once with the bearer as `owner`, and its row names the stat and the bearer and points at the entity.
  - A world-stat writer keeps the bare label in the two-writers finding, also when it writes an entity's stat.

Renames (ticket 08, added 2026-10-13 at the user's request through the Code Hover Cards spec):

- Renaming a world stat offers to rewrite `stats.X` in every box in the world. Renaming an entity's own stat offers to rewrite `owner.stats.X`, `entities[x].stats.X`, and `persona.stats.X` where each reaches it. A same-name stat on another owner is never rewritten.
- The Test Bench's route-to-target resolution becomes one shared module. The Test Bench, the rename planner, and later Code Hover Cards' Find All Uses use it. Each reference carries its box, route, target stat, and the key's range in the box's code.
- Ticket 08 choices: a link box is one whose link overrides that box, not one whose text differs, in the Test Bench too. A Blueprint stat rename never rewrites `stats.X`, because that route never reaches a Blueprint stat.

Bundled worlds:

- The drone (Mobility, Firepower) and The Student (Agility) read their own stats through `stats`. Their code moves to `owner.stats`. Entity stats are in no release, so there is no migration; the bundled code is rewritten in place.

Docs:

- The Stat Code Guide drops the read-only and same-owner lines, documents `owner`, and states the owner-order rule. The sections are Quick Reference, How to Change Another Stat from Code, Accessing Other Stats, Writing to Other Stats, Two Boxes, One Field, Order of Effects, Average of All Stats, Persona, Entities, and Limitations.
- The guide has one heading each for `self`, `stats`, and `owner`, so the Code Hover Cards spec can link each global to its own anchor (its Q32). Ticket 07 reports the final anchors to that spec's session.
- The Persona section says that under a library persona, code reaches the Custom Persona's stats through `entities[...]`, not `persona`.
- The accumulating-stats note explains Q12: a Blueprint box's world-stat write moves the stat once, not once per bearer.
- CONTEXT.md gains an entry for the `owner` stat-code global: the entity that owns the running stat, or the bearer for a Blueprint stat. The Bearer entry's avoid line stays, because it covers prose, not the code name. The Quick Reference test keeps its rows tied to the surface tables.
- The changelog folds this into the unreleased entity stats entry, not a new one.

## Testing Decisions

A good test drives a public seam with a small world and asserts what an author sees: final stat values, reported drops, listed writes, findings. It never asserts the VM program text or internal maps.

- **Turn seam (main).** Through the turn runner: `stats` is the world stats in an entity stat's code; `owner.stats` reads and writes the owner's own stats; an entity stat's code writes a world stat; world code writes an entity stat through `entities[x].stats` and the persona's through `persona.stats`; two owners writing one field resolve in owner order, last write wins; a Blueprint stat's `owner` is each bearer in turn; one snapshot holds (a write is not seen by another run in the same turn); writes to a switched-off stat, an unknown stat, and an absent entity are dropped and reported; a write through an empty `owner` in world code is dropped and reported. Prior art: the existing turn test files for stat writes, entity stats, fields, and owners.
- **Executor seam (marshaling only).** A write through each route comes back keyed by the right owner; `self` and its `owner.stats` entry are one write; read-only fields on every route report their full path; a whole-map or whole-entry write stays read-only. Prior art: the executor's entity-stats and stat-writes test files.
- Test Code, the Test Bench rules, the write scanner, editor diagnostics and completion, the Variable menu, and the Quick Reference keep their own existing test files, and those tests move with the new rules.
- The existing tests that assert entity stats are read-only are rewritten to assert the write lands. They are not deleted.
- Each guard is shown to bite: reinstate the read-only lock or the owner-scoped `stats`, and the new tests fail.

## Out of Scope

- Writes to `id`, `name`, `type`, `description`, `previous`, or `delta` on any entry.
- A sequential run mode where later owners see earlier writes.
- A precedence rule that lets a stat's own owner override outside writers.
- Making `owner` the played persona in world-stat code.
- A route to entities that aren't in the game.
- Any change to trait writes beyond `owner.traits` as a new route to the owner's existing trait map.
- Export shape: no world or save field changes. Only stat code strings in bundled worlds change.

## Further Notes

- Backlog (closing review): trait and placeholder renames still scan world-stat boxes only, so entity-owned and link-override boxes that name a renamed trait or placeholder get no rewrite. The stat code help topic's "exposes nothing else" list predates `entities`, `persona`, `dictionaries`, and `owner`.

- Origin: code on The Creature's stats in City Rampage had no route to Destruction, while `traits` already meant the world traits in every box.
- v6 kept other owners read-only so one owner's code could not move another's values behind the turn. v6 then made writes ordered and visible, so that reason no longer holds.
- The unreleased Entity Stats changelog line says code reads `entities.Bram.stats` "read-only" and that an entity stat's code reads its owner's stats as `stats`. A ticket branch can't edit that line, so the spec session corrects it on main at close.
- The Formaquestion help corpus reads the Stat Code Guide, so the docs ticket carries a help-answer check on one `owner` question and one cross-owner write question.
