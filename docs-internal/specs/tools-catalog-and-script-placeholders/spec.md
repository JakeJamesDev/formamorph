# More Built-in Tools, Script Placeholders, and Tool Editor Copy

Status: ready-for-agent
Status note: Draft. The user will keep iterating on it before tickets.

Three parts. Each part can ship alone.

1. **Built-in Tools.** The catalog gains a location lookup and a dictionary lookup beside the entity lookup.
2. **Script placeholders.** A Tool script reads resolved placeholder values.
3. **Editor copy.** Four helper lines in the Tool editor become exact.

## Problem Statement

The catalog holds one built-in Tool, the entity lookup. A player who wants the AI to look up a location or a dictionary entry must write that Tool by hand, although the lookup handler already searches both.

A Tool script reads the world, the scene, and its arguments, but not placeholders. A Template body can insert a placeholder chip, so a script is the weaker handler for this one task. An author who wants "the hair color this playthrough rolled" in a script cannot get it.

The Tool editor has four helper lines that do not match what the editor does:

- The Description hint lists the outline headings, but **Add Outline** already writes them.
- The lookup's "Matches names and aliases, in any case" line sits under **By Parameter** only. The **Search** field beside it has no hint, so the two columns fall out of line.
- The save footer says "Check Definition and Handler to save". The editor knows the exact problem but names only the tabs.
- A parameter type reads "Yes/No". The script surface calls it `boolean`, and Try It reads the text `true`. The author sees two words for one type.

## Solution

**Built-in Tools.** Two new catalog Tools: `get_location` and `get_dictionary_entry`. Each one uses the lookup handler that exists today. Each one opens in the Tool editor with its definition locked, like `get_entity`. Each one ships switched off on every built-in preset until its description passes a probe.

**Script placeholders.** A Tool script gets a read-only `placeholders` global. It maps each world-level placeholder's name to the value this playthrough resolved. An entity's own placeholders go on that entity's item in `world.entities`, under `placeholders`, in the same name-to-value form. A script sees resolved text only, never the value list, weights, or pins. The code editor lists these names in autocomplete like it lists `args`.

**Editor copy.**

- The Description hint becomes "Tells the AI what the Tool does and when to call it".
- The lookup's match line moves to a full-width hint under the lookup grid, and names its source: "Matches entity names and aliases, in any case".
- The save footer names each fix, such as "Name the Tool and pick a lookup parameter to save".
- The boolean parameter type reads **True/False**.

## User Stories

### Built-in Tools

1. As a player, I want a built-in location lookup, so that the AI can read a location's full description without me writing a Tool.
2. As a player, I want a built-in dictionary lookup, so that the AI can read a lore entry on demand.
3. As a player, I want the new built-in Tools listed on every preset, so that I can find them where I find `get_entity`.
4. As a player, I want the new built-in Tools switched off by default, so that a fresh install sends the same requests it sends today.
5. As a player, I want to switch a new built-in Tool on for a built-in preset, so that I do not copy a preset to use it.
6. As a player, I want to open a new built-in Tool in the editor, so that I can read its definition.
7. As a player, I want its definition locked, so that I cannot break a shipped lookup.
8. As a player, I want to change its Offered To list and call limit, so that I can send it to more prompts.
9. As a player, I want the location lookup to match location names in any case, so that the AI finds "the docks" when the location is "The Docks".
10. As a player, I want the dictionary lookup to match trigger keywords, so that the AI finds an entry by the words that activate it.
11. As a player, I want a lookup that finds nothing to return an empty result, so that the AI knows the name was wrong.
12. As a player, I want the location lookup to return the full description, so that the AI gets what the location summary leaves out.
13. As a player, I want the new Tools to follow the global Tools switch, so that one switch still turns every Tool off.
14. As a player, I want Try It to work on the new Tools, so that I can see what the AI will receive.
15. As a player, I want the new Tools offered to narration by default, so that they reach the prompt that reads the most lore.
16. As a preset author, I want a preset export that enables a new built-in Tool to keep that switch, so that a shared preset behaves the same.

### Script placeholders

17. As a Tool author, I want a script to read a world placeholder's resolved value by name, so that the Tool returns what this playthrough rolled.
18. As a Tool author, I want an entity's own placeholders on that entity's item, so that I read them where I read the entity.
19. As a Tool author, I want each value to be the resolved text, so that I do not write a draw of my own.
20. As a Tool author, I want the same value a prompt shows this turn, so that a Tool never tells the AI something the narration contradicts.
21. As a Tool author, I want a pinned placeholder to read its pinned value, so that traits, locations, and stats that pin a value also reach scripts.
22. As a Tool author, I want a placeholder whose value holds other chips to read fully resolved, so that I never see a raw chip token.
23. As a Tool author, I want `placeholders` in autocomplete with its names, so that I do not guess a spelling.
24. As a Tool author, I want each entity item's `placeholders` member in the surface list, so that I know it exists.
24a. As a Tool author, I want a dictionary book's placeholders on each of its entries, so that I read them where I read the entry.
24b. As a Tool author, I want a repeated name to give the first placeholder's value, so that a read never fails on a collision.
25. As a Tool author, I want the placeholder values read-only, so that a script cannot change the playthrough.
26. As a Tool author, I want an empty `placeholders` object in a world with none, so that my script does not fail on a missing global.
27. As a Tool author, I want Try It with no world open to show sample placeholders, so that I can test a script before I open a world.
28. As a Tool author, I want Try It in an open world to use that world's resolved values, so that the test matches play.
29. As a Tool author, I want a snippet that reads one placeholder, so that the first use is one click.
30. As a player, I want scripts in shared presets to stay sandboxed, so that placeholder access does not widen what an untrusted script can reach.

### Editor copy

31. As a Tool author, I want the Description hint to say what the field is for, so that it does not repeat what **Add Outline** writes.
32. As a Tool author, I want the lookup's match rule under the whole lookup row, so that **Search** and **By Parameter** stay level.
33. As a Tool author, I want the match rule to name its source, so that I know which records it searches.
34. As a Tool author, I want the save footer to name each fix, so that I do not open tabs to find the problem.
35. As a Tool author, I want the footer to name an unnamed parameter by its position, so that I find it in a long list.
36. As a Tool author, I want the footer to list several fixes in one sentence, so that I see them all at once.
37. As a Tool author, I want the boolean type to read **True/False**, so that it matches the values my script and Try It use.
38. As a Tool author, I want my saved boolean parameters unchanged by the rename, so that no Tool breaks.

## Implementation Decisions

### Built-in Tools

- The catalog gains two entries. Each one uses a lookup handler with a source that exists today:
  - `get_location`: source `locations`, by a `name` parameter, returns the full description.
  - `get_dictionary_entry`: source `dictionary`, by a `keyword` parameter.
- Each description follows the `get_entity` outline: Purpose, Use when, Input, Output. Descriptions are prompt text, so each one ships with probe numbers per the prompt-writing guide.
- The shipped default on every built-in preset is off. Switching the default on is a later product call that uses the probe results.
- Both Tools default Offered To narration only.
- The empty result matches the handler's output shape (`{"matches": []}`).
- No stored-shape change: catalog Tools are not exported, and the per-preset switch uses the storage from the global-Tools spec.

### Script placeholders

- The Tool Snapshot gains a frozen, name-keyed map of world-level placeholder values. Each entity in the snapshot's world gains the same map for the placeholders that entity owns.
- **Resolved only.** Each value is the text the snapshot's resolver produces for that placeholder's chip. The resolver is the one Template chips use today, so pins, rolls, and nested chips come out the same as in a prompt this turn.
- **Entity owned.** A placeholder scoped to an entity goes on that entity's item, not in the world-level map.
- **Book owned.** A placeholder scoped to a dictionary book goes on each of that book's entries in `world.dictionary`, under `placeholders`, in the same form.
- **First name wins.** When two placeholders in one map share a name, the first in list order keeps the key. The later one is not listed under that name.
- A placeholder owned by another placeholder (`ownerId`) is not listed. Its text is already inside its holder's resolved value.
- The sandbox receives the map as one more frozen value, beside `args`, `world`, and `scene`. It gains no function and no host call.
- The script surface gains a `placeholders` global, with the world's names as members. The entity and dictionary entry item shapes gain `placeholders`. The surface describes the sandbox and never widens it.
- The surface takes the placeholder names as an input, so autocomplete lists the open world's names. With no world open, it lists the sample world's names.
- The sample snapshot carries sample placeholders, so Try It with no world open shows them.
- One new snippet reads one placeholder by name.
- No stored-shape change. The snapshot is built per turn and never stored.

### Editor copy

- The Description hint changes to "Tells the AI what the Tool does and when to call it".
- The match rule leaves **By Parameter**. It shows as one hint under the lookup grid, full width. Each source's text names what it searches:
  - Entities: "Matches entity names and aliases, in any case"
  - Locations: "Matches location names, in any case"
  - Dictionary: "Matches dictionary keywords, in any case"
- The footer builds its sentence from the draft problems, not from the tab names. Each problem kind maps to one verb phrase, and the phrases join with "and". Examples:
  - An empty name: "Name the Tool".
  - A repeated name: "Rename the Tool".
  - An unnamed parameter: "Name parameter 2".
  - An enum with no options: "Add options to parameter 3".
  - No lookup parameter: "Pick a lookup parameter".
- The tab strip's problem marks stay, so the author can still see which tab holds the fix.
- The boolean type label becomes **True/False**. The stored value stays `boolean`.

## Testing Decisions

- A good test drives a public entry point and asserts what a player or the AI receives. It never asserts an internal helper's call.
- **Tool runs:** the Tool runner's call entry, with a snapshot from the real snapshot builder, is the one seam for both built-in lookups and script placeholders. Prior art: the runner's existing lookup and script tests.
  - Each new built-in Tool: a hit, a case-insensitive hit, a miss that returns the empty result.
  - Scripts: a world placeholder read by name, an entity placeholder read from its item, a pinned value, a nested chip resolved, an empty map in a world with none, and a write that does not change the value.
  - The script value equals the Template chip value for the same placeholder in the same snapshot. This test guards against two resolvers.
- **Catalog and offer:** the catalog and offer tests cover the new Tools' default-off state and the global switch. Prior art: the catalog and catalog-overrides tests.
- **Surface:** the script-surface test covers the `placeholders` global, its members, and the entity item's new member. Prior art: the existing script-surface test.
- **Editor copy:** the Tools tab edit test and the Settings modal Tools test cover the footer sentences, the moved match hint, and the **True/False** label. These tests already assert the old footer text, so they change with it.
- **Probes:** each new built-in description needs a narration probe on both model tiers, at least two runs per case, per the prompt-writing guide. The probe numbers go in the ticket.

## Out of Scope

- Switching a new built-in Tool on by default. That is a product call after the probes.
- A script that reads placeholder definitions: the value list, weights, pins, or kind.
- A script that changes a placeholder or rerolls one.
- A built-in Tool for traits, stats, or the story clock. The scene already carries them.
- New lookup sources or new match rules.

## Further Notes

- Chips key placeholders by id, and a search of the placeholder modules found no check that keeps names unique. The first-wins rule covers that case.
- The global-Tools spec (tools-global-and-editor-polish) owns the per-preset switch storage. This spec's built-in Tools depend on it.
- The boolean label change is copy only. The AI sees `type: "boolean"` in the schema whatever the label says.
