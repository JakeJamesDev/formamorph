# Spec: Drawn Opening

Status: ready-for-agent
Spec session: drawn-opening — spec

## Problem Statement

A world can hold many Openings, and a new game draws one by weight. After the draw, nothing in the game knows which one it was. Scripts see the opening text on turn 1 through `turn.action`, but that is empty for an Opening Narration, carries filled-in placeholders, and breaks when the author rewrites the text. Traits and image Visibility rules cannot react to the opening at all. An author who writes an "ambush" start and a "quiet arrival" start cannot branch the rest of the story on them.

Openings also have no code name, so even a script that could see the drawn row would have only an opaque id to compare against.

## Solution

Three pieces, one effort:

- **Opening names.** Each Opening gets an optional code name, edited the same way as a script name. A blank name shows a derived label such as "Aki · Opening 2" in the editor.
- **The `opening` global.** Scripts read a read-only `opening` on every turn: which Opening started this playthrough, its name, owner, kind and text. It is null when the game started from the shipped default opening.
- **The Opening Condition.** A new Condition holds while the drawn Opening is one of a picked list. Traits and image Visibility rules share it, as they share the Weather Condition.

Alongside, every script-facing entry gains a read-only `category` field ("entity", "location", "item" and so on), so code can tell an Opening's owner, or any entry, apart by what it is. The Time and Weather Conditions gain Not, and the Opening Condition has it from the start.

## Rulings

Settled in the grill, 2026-11-21. A ruling reopens on new evidence, never on a new opinion.

| Q | Ruling |
|---|---|
| Q1 | Script global, Opening names and the Opening Condition are one spec, with tickets per piece. |
| Q2 | The name is optional, as a script name is. A blank name shows a derived label ("Owner · Opening N") in the editor only. In code, `opening.name` reads null. |
| Q3 | Names are unique per owner. Two owners can each have an "ambush". |
| Q4 | `opening` is readable in every script on every turn, not only At Game Start. |
| Q5 | A page-one re-roll that draws another Opening updates `opening`. |
| Q6 | `opening.owner` is the owner's full script entry (an entities or locations entry), or null for the world's own Openings. |
| Q7 | `opening` is null when the game starts from the shipped default opening, and for saves that hold no opening record. |
| Q8 | A new read-only `category` field tells entries apart. `type` and `kind` are taken on stats, entities, the persona and currencies; `category` is free everywhere. Values are singular. |
| Q8b | `category` ships in this spec. The `opening` global depends on it. |
| Q9 | The Opening Condition picks one or more Openings, stored by id and shown by name or derived label. It holds while the drawn Opening is any of them. |
| Q10 | It is offered everywhere the Weather and Time Conditions are. |
| Q11 | It holds for the whole game, not only while the starting traits settle. |
| Q12 | Test Code and the Test Bench get an opening picker, default None. |
| Q13 | Renaming an Opening updates matching `opening.name` comparisons in scripts, through the existing code-name rename path. |
| Q14 | Every script-facing entry gets `category`: entities, the persona, locations, items, Item Instances, stats, traits, currencies, dictionaries, dictionary entries and memories. |
| Q15 | The persona reads `category` "entity". |
| Q16 | `opening` holds `category` "opening", `id`, `name`, `owner`, `kind`, `self`, `time`, `weather`, and `text` with its placeholders filled in as the player saw it. |
| Q17 | The save holds an opening record. On load it resolves against the current world; an Opening the author has since deleted reads null. |
| Q18 | The Opening Condition has Not. The Time and Weather Conditions gain Not too. Reopened on new evidence: Weather never had Not, against the grill's premise. |
| Q19 | A Condition that lists a deleted Opening shows as unresolved and drops the missing id, as a Weather row with no kinds does. |
| Q20 | Opening names use the script-name field and code-name rules. No new visual pattern. |
| Q21 | The Condition's picker lists every Opening in the world, grouped by owner: World, each entity, each location. |
| Q22 | The shared Opening pick and the Test Bench Opening instrument's own pool pick stay separate values. The instrument previews page one, and the shared pick drives only `opening` and the Opening Condition. |
| Q23 | Player lines leave the Opening Condition out, as they do Hidden targets. A row with nothing else left reads "Locked". |

## User Stories

1. As an author, I want to name an Opening, so that my scripts can refer to it by a word I chose.
2. As an author, I want an unnamed Opening to show a readable label in the editor, so that I can tell rows apart without naming every one.
3. As an author, I want the editor to stop me from giving two Openings of one owner the same name, so that a script comparison is never ambiguous.
4. As an author, I want two different entities to each have an Opening named "ambush", so that I don't have to invent prefixes.
5. As an author, I want the Opening name field to look and behave like the script name field, so that I don't learn a new control.
6. As an author, I want a script to read which Opening started the playthrough, so that I can branch stats and events on it.
7. As an author, I want to read the drawn Opening's name in an At Game Start script, so that I can set up the start for each route.
8. As an author, I want to read the drawn Opening on any later turn, so that a route chosen at the start can still change things on turn 20.
9. As an author, I want `opening.owner` to give me the owner's full entry, so that I can read its name, stats and traits without a second lookup.
10. As an author, I want `opening.owner` to be null for the world's own Openings, so that I can tell a world start from an entity's greeting.
11. As an author, I want to read whether the drawn Opening was an Opening Action or an Opening Narration, so that I can handle each.
12. As an author, I want to read whether the drawn Opening was a Self Opening, so that I can treat play-as starts differently.
13. As an author, I want to read the drawn Opening's Time and Weather, so that scripts agree with how the story started.
14. As an author, I want to read the Opening's text as the player saw it, placeholders filled in, so that I can match on what was on screen.
15. As an author, I want `opening` to be null when my world has no Openings, so that `if (opening)` tells me a real Opening was drawn.
16. As a player, I want a page-one re-roll to change which Opening the game thinks started the story, so that scripts follow the page I kept.
17. As a player, I want a saved game to remember its Opening after I load it, so that a route keeps working across sessions.
18. As a player loading a save from before this feature, I want the game to load normally, so that nothing breaks.
19. As an author, I want a save whose Opening I deleted to read `opening` as null, so that scripts never see a row that no longer exists.
20. As an author, I want a save to show an Opening's new name after I rename it, so that the world stays the authority.
21. As an author, I want every script entry to say what it is through `category`, so that one function can handle an owner that may be an entity or a location.
22. As an author, I want the persona to read `category` "entity", so that code written for entities handles the persona too.
23. As an author, I want items and Item Instances to read different categories, so that I can tell an item definition from a carried copy.
24. As an author, I want stats, traits, currencies, dictionaries, dictionary entries and memories to carry `category` too, so that the field is never missing.
25. As an author, I want the code editor's completions and quick reference to list `opening` and `category`, so that I find them without reading docs.
26. As an author, I want a trait gated on the Opening, so that a route grants its own starting traits without code.
27. As an author, I want an image Visibility rule gated on the Opening, so that a character's art can differ by route.
28. As an author, I want the Opening Condition to pick several Openings at once, so that one row covers a family of starts.
29. As an author, I want the Opening Condition to keep working after I rename or rewrite an Opening, so that edits don't break gates.
30. As an author, I want the Condition's picker to list every Opening in the world, grouped by owner, so that I can pick any start from any surface.
31. As an author, I want the picker to show names, or derived labels for unnamed rows, so that I know which row I picked.
32. As an author, I want "Opening is not" a set, so that I can gate everything except one route.
33. As an author, I want "Weather is not" and "Time is not", so that I can gate on the absence of a kind or daypart.
34. As an author, I want a Condition that lists a deleted Opening to show as unresolved, so that I see the problem in the editor.
35. As an author, I want an Opening-gated trait to stay available on later turns, so that route traits don't drop off after the start.
36. As an author, I want the starting traits to settle under the drawn Opening, so that a route's traits are there on page one.
37. As an author, I want Test Code to let me pick which Opening the sample run reads, so that I can test each branch.
38. As an author, I want Test Code to default to None, so that the sample matches a world with no Openings until I choose.
39. As an author, I want the Test Bench to use the same picker, so that the Opening Condition and scripts read the same sample.
40. As an author, I want renaming an Opening to update `opening.name === "old"` in my scripts, so that renames don't break code.
41. As an author, I want code analysis to flag a comparison against an Opening name that no Opening has, so that I catch typos.
42. As an author, I want world export and import to keep Opening names and Opening Conditions, so that shared worlds keep working.
43. As an author, I want player-facing Condition lines to read the Opening Condition clearly, so that players understand why a trait is or isn't offered.

## Implementation Decisions

**Opening names**

- `Opening` gains an optional `name`. Blank or absent means no name. The editor label falls back to "Owner · Opening N", N being the row's position in its owner's list. Code never sees the fallback.
- Names use the script-name field, which has no charset rule: trimmed plain text, no chips, case-sensitive. A name is unique across the owner's full list, Self rows included even when hidden (ticket 01 ruling).
- A duplicate shows an inline error and is not written; the previous name stays.
- The card header shows the name when there is one, else the derived label, "World · Opening N" for the world's own rows. It replaces today's "Opening N". Accessible labels and text search keep working.
- The rename path that already rewrites code names in scripts learns Opening names. It rewrites string comparisons against `opening.name`, scoped by owner where the code also tests the owner.
- Code analysis knows the set of Opening names and flags an unknown one, as it does for other code names.
- Ticket 07 rulings: the rename rewrites `opening.name` compared with a string literal by `===`, `!==`, `==` or `!=` in either order, and `switch` cases. Other forms stay as written. A guard is an `opening.owner.name` literal test, or a null-owner test, in the comparison's own `&&` chain or in its enclosing condition. A guard naming the renamed Opening's owner is rewritten, and a guard naming another owner is left alone. A guard that can't be proven goes to the existing pick box. An unguarded comparison is rewritten outright only when no other owner still has the old name; otherwise it goes to the pick box. The offer fires only from the Opening name field, and there is no find-and-replace target. Analysis warns on a literal that matches no Opening name in the world, Self rows included. It stays silent where the host passes no Opening names.

**The opening record in the save**

- The save gains an opening record: owner id, Opening id, and a location id when a location owns the row. This mirrors the key the opening pool already uses, since Opening ids repeat across owners.
- The draw at New Game writes the record. A page-one re-roll that draws another row rewrites it. The shipped default opening writes none.
- Load resolves the record against the current world. A missing owner or Opening resolves to null. A save with no record resolves to null.
- Ticket 03 rulings: the record is a top-level save field, `drawnOpening?: { ownerId: string | null; openingId: string; locationId?: string }`. It sits beside the Opening Action, outside the per-turn snapshots, so undo never rewinds it. A location row has a null owner id plus the location id. The type is exported as `OpeningKey`.
- The gameplay context holds and exposes the raw record only. Readers call one pure resolver with live data. It returns null or the key, the Opening and the owner, tagged by category (entity or location), or null for a world row.
- "Current world" means the cast in play: world entities, picked library entities, the persona and the Custom Persona.
- A record that no longer resolves stays unchanged in state and in later saves. It only reads null.

**The `opening` global**

- A read-only global, built once per turn from the resolved record, present in every Timing.
- Fields: `category`, `id`, `name`, `owner`, `kind`, `self`, `time`, `weather`, `text`. `owner` is the same entry shape scripts already get from `entities` or `locations`, or null for a world row. `text` is the Opening text with placeholders filled in from the opening pins.
- The code surface, completions and quick reference list it, as they list `turn` and `world`.
- Ticket 04 rulings: `text` is resolved again on each run through the draw's resolution, with the same opening pins, session rolls and owner. A player's edit to an Opening Action shows only in turn 1's `turn.action`. `time` and `weather` are the Opening's own authored fields, null when it leaves them to the world default. `owner` is the same object as `entities[name]`, `persona` or `locations[name]`. `opening` also exists in Tool, World Tool and item event runs, as `turn` does.

**`category`**

- A read-only string on every script-facing entry: entity (persona included), location, item, itemInstance, stat, trait, currency, dictionary, dictionaryEntry, memory, opening. Exact casing follows the script-value casing convention (camelCase).
- It is constant per entry shape, so it costs nothing at runtime beyond the field itself.
- Previous-turn snapshots of an entry carry it as well.
- Ticket 02 rulings: a blank entry still reads its shape's category. A stats entry for an unknown name reads "stat", and an unknown entity or an empty persona reads "entity". Nested stats and traits under the persona or an entity read "stat" and "trait". Trait and item `self` read "trait" and "item". Placeholders, exits, generic instances and the clock, turn and world objects carry no category.

**The Opening Condition**

- A new Condition kind on Requirement Rows, holding a list of Opening keys (owner plus id, as in the save record) and an optional Not.
- It holds while the drawn Opening's key is in the list, inverted by Not. With no drawn Opening it does not hold; with Not it holds.
- Gate input gains the drawn Opening key. The opening fold already re-settles starting traits under the drawn Opening for Weather and Time; it passes the key the same way, so the first settle sees it. Every later turn commit reads it from the save record.
- Outside play (editor, Enter World, library), it reads the Test Bench pick where there is one, else no Opening.
- The editor offers it wherever it offers the Weather and Time Conditions. The picker lists every Opening in the world, grouped by owner. A listed key with no Opening shows the row as unresolved, and saving drops the dead key.
- Its line text reads the picked names or derived labels.
- Ticket 06 rulings: the editor offers it only while the world has at least one Opening, at most one per row. On an entity card, keys on the card entity's own Openings travel as the self-entity token and are rebound on import. Other keys are dropped, and a Condition left with no keys is dropped. In play it reads the resolved key, so a drawn Opening that no longer resolves counts as none. The Condition stores keys only, so linked-content update lines read "Opening", "Not Opening" or "Opening (2)".

**Not on Time and Weather**

- The Time and Weather Conditions take the existing Not flag. Not inverts the set test. Their editor rows show the Not control, and their line text reads the negated form.
- Code that treats Time and Weather as never negated (row simplification, contradiction checks, the player line) learns the flag.
- Ticket 05 rulings: an empty set stays unresolved and never holds, Not or not. The Opening Condition follows the same rule. Line text prefixes "not ", as in "not night" or "not Rain or Storm". Not is the plain `not` flag, and the editor's flip control toggles it. Hold, clash and equality checks normalize a negated set to its complement. For Weather, the complement covers every kind, Clear included, never only the allowed list.

**Test Code and Test Bench**

- One opening picker, default None, shared by Test Code and the Test Bench. Its pick feeds both the `opening` global and the Opening Condition.
- Ticket 04 rulings: the pick is one `OpeningKey | null` per world. It is kept in its own session record, so Test Code reads it even when the Test Bench has never opened. The Test Bench lens bar shows it, and every Test Code box shows the same picker reading the same value. This is a deliberate exception to Test Code's no-picks rule. Surfaces with no Test Bench (the library entity editor, the help window, World Tool Try) show no picker and read None. The rows are None first, then every Opening grouped by owner, Self rows included. Ticket 06 reuses the list.

**Export shape**

- World `.json`: `name` on Openings; the Opening Condition kind; Not on Time and Weather Conditions.
- Save `.json`: the opening record.
- All are additive. Nothing here has shipped, so no migration code is written.

## Testing Decisions

A good test drives a public entry point with authored data and checks what an author or player would see: a script's output, a gate's state, a loaded save's value. It never asserts on private helpers or mirrors the code it tests. Each guard gets proven by reinstating the bug once.

Seams, all existing:

1. **The stat-code turn runner.** Scripts read `opening` in every Timing, null and present, with each owner category; `category` on every entry shape, persona included. Prior art: the At Game Start timing tests.
2. **The opening fold plus gate states.** The Opening Condition holds, fails, inverts with Not, settles starting traits under the drawn Opening, and re-settles on a redraw. Time and Weather with Not. Prior art: the opening-state start tests and the Weather Condition tests.
3. **The gameplay context save/load round trip.** The record is written at the draw, rewritten on a re-roll, absent for the default opening, null for a legacy save, and null after the Opening is deleted. Prior art: the opening-action round-trip test.
4. **The code rename and analysis suites.** Renaming an Opening rewrites `opening.name` comparisons; an unknown name is flagged. Prior art: the existing rename and analysis suites per code-name kind.

Editor surfaces (name field, Condition picker, unresolved row, Test Bench picker) take component tests in the existing Openings panel and requirement-row test files.

## Out of Scope

- Openings that set stat or option values (option D from the first discussion).
- Matching on Opening text.
- Any per-player or per-save override of which Opening was drawn, beyond the page-one re-roll.
- Owner or Not semantics for other list Conditions beyond Time, Weather and Opening.
- Renaming the existing `type` or `kind` fields.

## Further Notes

- Glossary additions for `CONTEXT.md`: **Drawn Opening** (the Opening a playthrough started from, recorded in the save) and **Opening Condition**. The Time Condition and Weather Condition entries lose "no Not".
- The `opening` global depends on the `category` ticket. The Opening Condition depends on the save record. Opening names can land first and on their own.
- ⚠️ Export shape changes on both the world and the save `.json`.
