# Stat Code Entities: `persona` and `entities`

Status: done
Status note: Tickets 01–06 cut 2026-10-01 under `issues/`; 07 added 2026-10-01 (Q26). Frontier at start: 01, 05.
Spec session: stat-code-entities — spec

## Problem Statement

A player reported that stat code can't see their persona's traits. They wrote `if (traits['Trait name'].enabled) …` to act on a trait the persona holds. The check is always false.

The script is correct. Stat code's `traits` map reads only the player's world-level trait list. Since the Blueprint-Only Links work, a persona's traits are owned by its entity, so they never reach `traits`. Each one reads as `acquired: false, enabled: false`.

Writes have the same gap. `traits['X'].enabled = false` can't turn off a persona's trait. Setting it to `true` acquires a world-level copy instead of switching the persona's own trait.

Stat code also has no way to read or switch any other entity's traits, even though every entity's trait state already lives in the playthrough.

## Solution

Stat code gets two new globals with one shared shape.

- **`entities`** maps each entity in play by name. Each entry has `id`, `name`, `type`, `pronouns`, `inScene`, `traits`, `placeholders` and, later, `stats`.
- **`dictionaries`** maps each dictionary by name. Each entry has `id`, `name` and `placeholders`.
- **`placeholders`** holds only the world's own placeholders. Every owned placeholder is reached through its owner.
- **`persona`** is the played persona's `entities` entry. With no persona entity in play, it is an empty entry.

```js
if (persona.traits['Scarred']?.enabled) self.value -= 1;
entities['Mira'].traits['Wounded'].enabled = true;
persona === entities[persona.name]; // same entry
persona.placeholders['Hair'].value;
dictionaries['Weather'].placeholders['Sky'].pin('overcast');
```

`traits` keeps its meaning: the world-level traits the player picks. One name can be a world trait and a persona trait without a clash, because each lives in its own map.

Each entity's `traits` map works like `traits`. `enabled` is writable and switches that entity's trait. Every other field is read-only. Every trait entry, in `traits` too, gains `id`, `name`, `mode`, `available`, `group` and `playerToggle`.

## Rulings

- **Q1. `persona` is the played persona only.** Under a library persona, the world's Custom Persona entity is not `persona`. The Custom Persona entity is `persona` only under None.
- **Q2. Persona trait writes work as `traits` does.** `enabled` is writable, `acquired` is read-only and a write to it is dropped and reported.
- **Q3. An entity's `traits` lists only that Bearer's own set**, owned or linked. A name outside it reads as a blank entry, like an unknown name in `traits`: `enabled` and `acquired` are false, and a write is dropped and reported as an unknown trait.
- **Q4. With no persona entity in play, `persona` is an empty entry.** `name` is `''` and `traits` holds no names, so every name reads as a blank entry (Q3) and `persona.traits['X'].enabled` never throws.
- **Q5. `entities` lists authored entities, library characters added at Enter World, and the played persona.** Characters the narrator invents in play are not listed.
- **Q6. Stat code can switch any listed entity's traits**, through the same owned-trait path cascades use.
- **Q7. Of two entities sharing a code name, the later one wins.** This is the rule `traits` and `placeholders` use. The editor's name-drift check warns the author.
- **Q8. `persona` and `entities[persona.name]` are the same entry.** The played persona is in `entities` even when it comes from the library.
- **Q9. An entity entry also exposes `id`, `type`, `pronouns` and `inScene`, read-only.** `type` and `pronouns` read `''` when unset. `inScene` reads the turn's scene list. The played persona always reads `true`. Descriptions, aliases, locations, media and editor fields are not exposed. Placeholders are covered by Q11.
- **Q10. A trait entry also exposes `id`, `name`, `mode`, `available`, `group` and `playerToggle`, read-only.** This applies to `traits` and to every entity's `traits`. `mode` is `'optional'`, `'alwaysOn'` or `'hidden'`. `available` is whether the trait's requirements hold for its Bearer now. `group` is the group's code name, `''` when ungrouped. Only `enabled` stays writable. A write to any other field is dropped and reported, as an `acquired` write is.
- **Q11. Every owned placeholder is reached through its owner, and only there.** An entity's placeholders are `entities['X'].placeholders`, and so `persona.placeholders` for the played persona. A dictionary's are `dictionaries['X'].placeholders`. The owner path `placeholders.Owner.Name` is removed.
- **Q12. `placeholders` holds only the world's own placeholders.** Owner names no longer share its namespace, so the bare-name and owner-name claim rules go away. Placeholder groups and nesting within the world's own list keep their paths.
- **Q13. `dictionaries` is a new global** that maps each dictionary by code name. Each entry has `id`, `name` and `placeholders`. Of two dictionaries sharing a code name, the later one wins (Q7).
- **Q14. A library persona's and added characters' placeholders are readable and pinnable** through their `entities` entries. This reverses the rule that stat code never reads a persona's placeholders. An unknown name reads as a blank entry, as an unknown placeholder does today, so code that names a placeholder it can't know never throws. Added characters' placeholders join through ticket 07 (Q26).
- **Q26. Stat code never shows a placeholder that play doesn't roll.** Play doesn't roll placeholders owned by added characters or by library dictionaries picked at Enter World, so their chips read empty in narration. Ticket 07 adds them to the session's placeholder set and rolls them, then exposes them in `entities` and `dictionaries`. Until then, `entities['Added'].placeholders` holds no names, and `dictionaries` lists only the world's authored dictionaries.
- **Q27. A rename leaves a shared `persona` path alone.** A rename rewrites `persona.placeholders.Old` or `persona.traits['Old']` only when no other playable entity still owns `Old`. Otherwise the path stays. Playing the renamed entity then reads a blank entry, and the editor shows the miss as a warning. A rename never breaks the path for another persona.
- **Q28. Library dictionaries join `dictionaries` after the authored ones.** A library dictionary is any dictionary in the playthrough's set whose id is not an authored dictionary's id. Under Q13 a library dictionary that shares an authored one's code name wins that name. Once library dictionaries join, the editor can't know every dictionary, so an unknown dictionary name and a miss under `dictionaries.X.placeholders` are warnings, not errors, as for entities (Q21).
- **Q29. `dictionaries` lists only dictionaries in play.** An authored dictionary the player turned off at Enter World is left out and reads as an unknown dictionary, as a not-in-play entity does (Q25). Code never reaches a dictionary that play doesn't use (Q26).
- **Q30. A switched-off stat reads as a real entry.** Its name, value and bounds read as usual, with `enabled: false`. A write to it is dropped and reported, because the stat is off. This refines Q17.
- **Q31. An entity with an empty code name is never listed in `entities`.** The editor warns the author to name it. The empty key belongs only to the empty `persona`.
- **Q32. Every read-only write is reported, `clock` included.** A write to `clock` or `clock.previous` is dropped and reported like any other read-only field (story 33).
- **Q33. A live stat wins its code name over a switched-off one.** Among stats in the same state, the later one wins (Q7). Listing a switched-off stat never changes which live stat code reaches. Its `previous` and `delta` read as usual.
- **Q34. The empty-name warning is a Test Bench finding**, beside name-drift. It fires only when the world has stat code.
- **Q35. Q32 covers every read-only path.** A write to another stat's fields, to `self.previous.*` or to `self.delta.*` is reported by its path, like a `clock` write. A write to `clock.previous` itself reports `clock.previous`.
- **Q36. Every placeholder has one path.** Q12 removes the bare-name shortcut to nested world rows too: `placeholders.Shade` no longer reaches `Hair › Shade`. The rewrite (Q19) turns it into `placeholders.Hair.Shade`.
- **Q37. The rewrite resolves an owned bare name to its owner.** Where `placeholders.Hair` reached Molly's `Hair` because the world has no `Hair`, the rewrite turns it into `entities.Molly.placeholders.Hair`, resolved against the world's tree as authored.
- **Q38. Owners out of play are an accepted change in results.** Old code that read an unpicked persona-only entity, the Custom Persona entity under a world persona, or a turned-off dictionary through `placeholders.Owner.Name` reads a blank entry after the rewrite (Q25, Q26, Q29).
- **Q39. An unnamed persona entity is the one exception to Q8.** It still plays as `persona`, but `entities['']` stays a blank entry, so `persona === entities[persona.name]` holds only when the persona has a code name. The guide states the exception. The Q34 finding already tells the author to name it.
- **Q40. A shadowed old global is an accepted change in results.** When old code declares a retired global's name anywhere (a helper parameter named `day`), the rewrite skips that name everywhere, and the code's other reads of the old global read `undefined`. Scope-aware rewriting is out of scope.
- **Q41. A `text` template slot inserts its value as typed**, as in v3.1.2, so saved author templates keep generating the same code. A built-in template that needs a quoted name gets it from its own slot types or quoting.
- **Q42. Templates pick entity and entity-trait names.** A new `entity` slot type picks from the world's entity code names. A `trait` slot tied to an `entity` slot lists the picked entity's traits, owned or linked. A `trait` slot tied to the persona lists the traits of entities with the Persona or Custom Persona mark, as Q21 completions do. The tie is `{{t:trait(who)}}` for the `entity` slot named `who`, and `{{t:trait(persona)}}` for the persona. A tie to a name that is not an entity slot is ignored: the slot lists the world's traits with no error, as `trait(x)` did on v3.1.2 (Q41 wins). A declared `entity` slot named `persona` wins over the persona tie. A new entity pick clears its tied trait slots. Both render as quoted strings, like the other name slots. The two persona and entity built-in templates use them.
- **Q15. The story clock is one `clock` object.** `clock.day`, `clock.daypart`, `clock.deltaHours` and `clock.elapsedHours` read the end of the turn. `clock.previous.day` and `clock.previous.daypart` read its start, as `self.previous` does for a stat. The six flat clock globals are removed. All fields are read-only.
- **Q16. `currentStatId` is removed.** `self.id` is the one route to the stat's id.
- **Q17. Identity and state fields match across entries.** A placeholder entry gains `id` and `name`, read-only. A stat entry gains `enabled`, read-only: false while a trait's stat toggle switches the stat off.
- **Q18. Placeholder writes keep both routes.** `value =` and `pin()` stay aliases, with `unpin()`.
- **Q19. Released code is rewritten at load.** `migrateWorld` rewrites `placeholders.Owner.Name`, the flat clock globals and `currentStatId` in every stat's code to their new routes, through the rename tooling. The rewrite is idempotent and runs at every import boundary, so old worlds keep working.
- **Q20. `persona.name` is the entity's code name**, never the name the player typed under None. Q8 needs `persona === entities[persona.name]`, and `entities` is keyed by authored names. The typed name is not exposed.
- **Q21. The editor can't know the played persona.** After `persona.traits`, completions offer the traits that entities with the Persona or Custom Persona mark hold, owned or linked. An unknown persona trait name is a warning, not an error, because a library persona can carry it.
- **Q22. A persona trait switch mirrors a `traits` code switch** on the persona's owned lists. It ignores Player Can Toggle, and a switch-on of an unchosen trait in the persona's set acquires it. It never switches an Always On trait. It retires exclusive siblings in the persona's groups. A locked switch-on lands, and then the settle switches it off. A switch to the state the trait already holds does nothing.
- **Q23. An unknown entity reads as a blank entry**, the same shape as an empty `persona` (Q4) and an unknown trait (Q3). Its `name` and `id` are `''`, and its `traits` hold no names. A trait write through it is dropped and reported as an unknown entity, so the run doesn't fail. `entities['X'].name` is the existence check.
- **Q24. The played persona always holds its own code name in `entities`.** When a later entity shares that code name, Q8 wins over Q7: `persona === entities[persona.name]`. The editor's name-drift check warns where it can see the clash.
- **Q25. `entities` lists only entities in play.** An unpicked persona-only entity has left the cast, and the Custom Persona entity is not a Bearer under a world persona, so neither is listed. Each reads as an unknown entity (Q23). To ask which persona plays, code reads `persona.name`.

## User Stories

1. As a world author, I want `persona.traits['X'].enabled` to read true when the played persona holds an active trait X, so that my stat code can react to the persona.
2. As a world author, I want `persona.traits['X'].acquired` to tell me whether the persona holds X at all, so that I can tell "switched off" from "never held".
3. As a world author, I want `persona.traits['X'].enabled = false` to switch off the persona's own trait, so that my code can end a temporary persona state.
4. As a world author, I want `persona.traits['X'].enabled = true` to switch on a trait the persona holds, so that my code can start a persona state.
5. As a world author, I want a write to `persona.traits['X'].acquired` to be dropped and reported, so that I learn the field is read-only, as it is on `traits`.
6. As a world author, I want `persona.name` to give the played persona's name, so that I can branch on who the player is.
7. As a world author, I want `persona` to work under the Custom Persona entity when no persona is picked, so that my code covers the default case.
8. As a world author, I want `persona` to be an empty entry when no persona entity is in play, so that my code doesn't crash in a world without one.
9. As a world author, I want `persona.traits` to list only the persona's own and linked traits, so that I can't switch on a trait the persona can't hold.
10. As a world author, I want `traits` to keep listing the world-level traits, so that my existing scripts behave the same.
11. As a world author, I want a persona trait and a world trait with the same name to stay separate, so that one script can read both without ambiguity.
12. As a world author, I want `entities['Mira'].traits['Wounded'].enabled` to read Mira's trait state, so that player stats can react to other entities.
13. As a world author, I want to switch an entity's trait from stat code, so that a player stat can change how an entity is described to the AI.
14. As a world author, I want a switched entity trait to cascade as a manual switch does, so that requirements and groups stay consistent.
15. As a world author, I want an entity switch to appear in the turn log, as a `traits` switch does, so that I can see what my code did.
16. As a world author, I want library characters added at Enter World in `entities`, so that my code covers the cast the player brought.
17. As a world author, I want an unknown entity name to read as a blank entry, so that `entities['X'].traits['Y'].enabled` never throws and `entities['X'].name` tells me whether the entity exists.
18. As a world author, I want a write to an unknown entity's trait to be warned about and dropped, as an unknown `traits` write is.
19. As a world author, I want `persona` and `entities[persona.name]` to be the same entry, so that I learn one shape.
20. As a world author, I want entity names with placeholder chips to reach code under their code name, as stat and trait names do.
21. As a world author, I want two entities with the same code name to resolve to the later one, with a name-drift warning in the editor.
22. As a world author, I want completions for `persona.`, `entities['…']` and their trait names in the code editor, so that I don't guess names.
23. As a world author, I want the editor to flag an unknown entity or persona trait name, as it flags an unknown trait name today.
24. As a world author, I want a trait rename to rewrite `persona.traits['Old']` and `entities['Mira'].traits['Old']`, so that a rename doesn't break my code.
25. As a world author, I want an entity rename to rewrite `entities['Old']`, so that a rename doesn't break my code.
26. As a world author, I want the editor's test run to accept `persona` and `entities` and report switches without applying them, as it does for `traits`.
27. As a world author, I want the stat code help and templates to show `persona` and `entities`, so that I can find them.
28. As a world author, I want an entity's `id`, `type` and `pronouns`, so that my code can branch on what an entity is without hard-coding names.
29. As a world author, I want `entities['Mira'].inScene`, so that a stat can react while Mira is in the scene.
30. As a world author, I want a trait's `mode` and `available`, so that I can see why a switch was ignored or refused.
31. As a world author, I want a trait's `group`, so that I can check every trait in one group.
32. As a world author, I want a trait's `playerToggle`, so that my code can leave player-controlled traits alone.
33. As a world author, I want a write to any read-only field to be dropped and reported, so that I learn which fields code can change.
34. As a world author, I want an entity's placeholders under `entities['X'].placeholders`, so that everything about an entity is in one place.
35. As a world author, I want `persona.placeholders['Hair']` to read the played persona's placeholder, so that my code doesn't hard-code which persona is played.
36. As a world author, I want a library persona's placeholders readable, so that my code can react to a persona I didn't author.
37. As a world author, I want to pin an entity's placeholder through its entry, as I pin a world placeholder.
38. As a world author, I want a dictionary's placeholders under `dictionaries['X'].placeholders`, so that every owner works the same way.
39. As a world author, I want `placeholders` to hold only the world's own placeholders, so that an owner's name never collides with a placeholder's name.
40. As a world author, I want completions to offer each owner's placeholders after `.placeholders`, so that I can find them.
41. As a world author, I want an entity or dictionary rename to rewrite its paths in my code, so that a rename doesn't break it.
42. As a world author, I want the story clock under one `clock` object, so that it reads like every other value.
43. As a world author, I want start-of-turn clock values under `clock.previous`, so that "previous" means the same thing for the clock and for a stat.
44. As a world author, I want one route to the stat's id, so that I don't wonder which one to use.
45. As a world author, I want a placeholder entry's `id` and `name`, as stat and trait entries have.
46. As a world author, I want a stat's `enabled`, so that my code can tell when a trait switched the stat off.
47. As a player, I want a world's persona-based stat code to work when I play a persona, so that the world plays as its author meant.
48. As a player, I want a saved game to keep working with no migration, so that my playthrough is not affected.

## Implementation Decisions

- **Executor:** the sandbox gains `persona` and `entities` globals. Each entity entry carries the Q9 fields and a tracked `traits` map. Trait entries, in `traits` and in each entity's map, carry the Q10 fields; `available` comes from the existing gate check for the trait's Bearer. The `entities` map and each entry's `traits` map are tracked for writes like the existing flat maps. `persona` refers to the same entry, so a write through either is one write.
- **Run result:** the executor reports entity trait writes per entity, beside today's trait writes. Unknown entity names and `acquired` writes are reported as today's are.
- **Building the entries:** a sibling of `sandboxTraits` builds the entity entries from the authored entities, the added characters, the played persona, the Bearers, and `ownedTraits`. A trait is acquired when its Bearer has it chosen. It is enabled when it is also not disabled. Linked traits read through their Original, as play reads them.
- **Persona resolution** reuses the existing player-Bearer resolution, narrowed to the played persona (Q1).
- **Applying writes:** a code switch on an entity's trait goes through the owned-trait switch path that cascades already use, then settles. It never writes `playerTraits`. The world-level `traits` path is unchanged.
- **Turn seam:** `runStatCodeTurn` resolves the entries once per turn, as it does for `traits`, and folds entity writes into the trait result in stat order.
- **Placeholders:** the path map builds the world's own tree only. Each owner's entry carries its own placeholder tree, built by the same resolver, so a node still holds one pin state. Pins still land as Code Pins by placeholder id, so pin storage does not change. Play passes the library persona's and added characters' placeholders to the run.
- **Tooling:** the surface module describes `persona` and `entities`. Completions, diagnostics, rename and name-drift learn both paths and entity names.
- **Editor test run:** it builds entries from authored entities with nothing chosen and an empty `persona`. Switches are reported, never applied.
- **No shape change:** no world or save field changes. Everything is derived at run time.

## Testing Decisions

- Tests assert what an author sees: what a script reads and what state a turn leaves. They don't assert prelude text or internal maps.
- **Runtime seam:** `runStatCodeTurn`. Cases:
  - The reporter's script reads true for an active persona trait.
  - It reads false for a switched-off persona trait, with `acquired` still true.
  - A persona write switches the owned trait and leaves `playerTraits` alone.
  - A world trait and a persona trait with one name stay separate.
  - The Custom Persona entity is `persona` under None and is not `persona` under a library persona.
  - With no persona entity, `persona.traits['X'].enabled` reads false, a write to it is dropped and reported, and the run doesn't fail.
  - An entity write switches that entity's trait and cascades.
  - `persona` and `entities[persona.name]` are one entry.
  - The later of two same-named entities wins.
  - An unknown entity write is dropped and reported.
  - `inScene` follows the scene list, and the persona reads `true`.
  - `available` reads false for a trait whose requirements fail, and `mode` reads `'alwaysOn'` for an Always On trait.
  - A write to a read-only field is dropped and reported.
  - `persona.placeholders` reads the played library persona's placeholder, and a pin through it lands on that placeholder's id.
  - An entity's and a dictionary's placeholders read and pin through their entries.
  - `placeholders.Owner.Name` no longer reaches an owned placeholder.
  - `clock` and `clock.previous` read the turn's end and start, and the flat clock globals are gone.
  - A stat switched off by a trait's stat toggle reads `enabled: false`.
- Each guard is proven to bite: reinstate the bug (persona traits left out of the entries) and see the reporter's case fail.
- **Tooling seams:** the existing surface drift guard, rename tests, and name-drift tests, extended to the new paths.
- Prior art: `statCodeTurn.test.ts`, `statCodeTraits.test.ts`, `statCodeRename.test.ts`, `statCodeNameDrift.test.ts`.

## Out of Scope

- `stats` on an entity entry. The name is reserved until entities can own stats.
- Characters the narrator invents in play (Q5).
- Entity fields outside Q9: descriptions, aliases, locations, media and editor fields. `locations` waits for a `location` global.
- Changing what the world-level `traits` map lists.

## Further Notes

- **Compatibility:** the owner path `placeholders.Owner.Name`, the flat clock globals and `currentStatId` all shipped by v3.1.0. Q19 rewrites them at load. New routes land first beside the old ones (expand), and one last ticket removes the old ones with the rewrite (contract).
- Origin: a player's bug report against v3.1.2. The read gap is the reported bug. The write gap and `entities` came out of the follow-up discussion.
- The changelog entry should credit the fix to the report: persona traits now read correctly in stat code.
