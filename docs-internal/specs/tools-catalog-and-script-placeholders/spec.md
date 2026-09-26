# More Built-in Tools, Script Placeholders, and Tool Editor Copy

Status: ready-for-agent
Spec session: tools-catalog-and-script-placeholders — spec
Status note: Ticketed 2026-09-26, seven tickets in `issues/`.

Four parts. Each part can ship alone.

1. **Lookup Tools.** The catalog gains a location lookup and a dictionary lookup beside the entity lookup.
2. **Recall and Roll.** The catalog gains `recall`, which searches the playthrough's memory, and `roll`, which rolls dice.
3. **Script placeholders.** A Tool script reads resolved placeholder values.
4. **Editor copy.** Four helper lines in the Tool editor become exact.

Other Tool ideas, including a name Tool that needs more design, live in the Tool ideas notes (`docs-internal/notes/tool-call-ideas/notes.md`), not in this spec.

## Problem Statement

The catalog holds one built-in Tool, the entity lookup. A player who wants the AI to look up a location or a dictionary entry must write that Tool by hand, although the lookup handler already searches both.

The AI forgets old events. Milestone memory keeps a selected set of turn digests in the request, and it drops the rest on purpose. When a dropped event matters again, the AI has no way to fetch it. The player sees a character forget a promise or a gift.

Models do not produce fair random numbers. A world with dice, checks, or chance outcomes gets the result the model prefers, which is usually success.

A Tool script reads the world, the scene, and its arguments, but not placeholders. A Template body can insert a placeholder chip, so a script is the weaker handler for this one task. An author who wants "the hair color this playthrough rolled" in a script cannot get it.

The Tool editor has four helper lines that do not match what the editor does:

- The Description hint lists the outline headings, but **Add Outline** already writes them.
- The lookup's match hint already changes with the source, but it sits under **By Parameter** only. The **Search** field beside it has no hint, so the two columns fall out of line. The text also does not name what it searches: "Matches names, in any case" reads the same for entities and locations.
- The save footer says "Check Definition and Handler to save". The editor knows the exact problem but names only the tabs.
- A parameter type reads "Yes/No". The script surface calls it `boolean`, and Try It reads the text `true`. The author sees two words for one type.

## Solution

**Lookup Tools.** Two new catalog Tools: `get_location` and `get_dictionary_entry`. Each one uses the lookup handler that exists today.

**Recall.** A new catalog Tool, `recall`. The AI passes a few words about a past event. The Tool searches the playthrough's turn digests and diary entries and returns the best matches, oldest first, with their turn numbers. It skips turns the request already carries in full. With semantic memory on, recall also matches by meaning, so a query in different words from the memory still finds it.

**Roll.** A new catalog Tool, `roll`. The AI passes dice notation, such as `2d6+1`. The Tool returns each die, the modifier, and the total. It is a script Tool, so the player can read exactly how it rolls.

All four new catalog Tools open in the Tool editor with the definition locked, like `get_entity`. All four ship switched off on every built-in preset until their descriptions pass a probe.

**Script placeholders.** A Tool script gets a read-only `placeholders` global. It maps each world-level placeholder's name to the value this playthrough resolved. An entity's own placeholders go on that entity's item in `world.entities`, and a dictionary book's placeholders go on each of its entries in `world.dictionary`. Both use the same name-to-value form under `placeholders`. A script sees resolved text only, never the value list, weights, or pins. The code editor lists these names in autocomplete like it lists `args`.

**Editor copy.**

- The Description hint becomes "Tells the AI what the Tool does and when to call it".
- The lookup's match hint moves to a full-width hint under the lookup grid, and names its source: "Matches entity names and aliases, in any case".
- The save footer names each fix, such as "Name the Tool and pick the parameter to search by to save". Each phrase is the same text the tab shows inline for that problem.
- The boolean parameter type reads **True/False**.

## User Stories

### All new built-in Tools

1. As a player, I want the new built-in Tools listed on every preset, so that I can find them where I find `get_entity`.
2. As a player, I want the new built-in Tools switched off by default, so that a fresh install sends the same requests it sends today.
3. As a player, I want to switch a new built-in Tool on for a built-in preset, so that I do not copy a preset to use it.
4. As a player, I want to open a new built-in Tool in the editor, so that I can read its definition.
5. As a player, I want its definition locked, so that I cannot break a shipped Tool.
6. As a player, I want to change its Offered To list and call limit, so that I can send it to more prompts.
7. As a player, I want the new Tools to follow the global Tools switch, so that one switch still turns every Tool off.
8. As a player, I want Try It to work on the new Tools, so that I can see what the AI will receive.
9. As a player, I want the new Tools offered to narration by default, so that they reach the prompt that needs them most.
10. As a preset author, I want a preset export that enables a new built-in Tool to keep that switch, so that a shared preset behaves the same.

### Lookup Tools

11. As a player, I want a built-in location lookup, so that the AI can read a location's full description without me writing a Tool.
12. As a player, I want a built-in dictionary lookup, so that the AI can read a lore entry on demand.
13. As a player, I want the location lookup to match location names in any case, so that the AI finds "the docks" when the location is "The Docks".
14. As a player, I want the dictionary lookup to match the entry name and its trigger keywords, so that the AI finds an entry by the name it saw in a lore block or by the words that activate it.
15. As a player, I want a lookup that finds nothing to return an empty result, so that the AI knows the name was wrong.
16. As a player, I want the location lookup to return the full description, so that the AI gets what the location summary leaves out.

### Recall

17. As a player, I want the AI to fetch an old event when the story returns to it, so that characters remember promises, gifts, and insults.
18. As a player, I want recall to search turn digests, so that it finds events milestone memory dropped.
19. As a player, I want recall to search diary entries, so that it finds what a character thought about an event.
20. As a player, I want recall to skip the turns the request holds in full, so that it does not repeat recent text back to the AI.
20a. As a player, I want recall to find the memory as I edited it, and never one I deleted, so that my Memory Manager changes hold in recall too.
21. As a player, I want recall to return a small number of matches, so that one call cannot fill the context.
22. As a player, I want each match to carry its turn number, so that the AI can order events in time.
23. As a player, I want matches returned oldest first, so that the AI reads them as a story.
24. As a player, I want a diary match to name its character, so that the AI knows whose thought it is.
25. As a player, I want recall to return an empty result when nothing matches, so that the AI does not invent a memory.
26. As a player, I want recall to return an empty result when digests are off, so that the Tool never fails.
27. As a player, I want recall to read the playthrough only, so that it never changes my save.
28. As a player, I want recall to work after I roll back a turn, so that it never finds an event that no longer happened.
29. As a Tool author, I want Try It on recall with no world open to search sample memories, so that I can see its output shape.
30. As a player with semantic memory on, I want recall to match by meaning, so that "the promise to her" finds "agreed to escort Mira to the ferry".
31. As a player with semantic memory on, I want word matches kept, so that an exact name still finds its turn when the meaning score is low.
32. As a player with semantic memory on, I want a memory that matches both ways ranked first, so that the strongest evidence wins the limit.
33. As a player, I want recall to fall back to word matching for any memory with no vector yet, so that a new turn is never invisible.
34. As a player, I want recall to fall back to word matching when the embedding model is not loaded, so that a call never waits on a download.
35. As a player, I want recall to use the same meaning threshold as Scene Recall, so that a world where everything looks alike does not flood the result.

### Roll

36. As a player, I want the AI to roll real dice, so that chance outcomes are fair.
37. As a player, I want standard dice notation, such as `2d6+1` or `d20`, so that the AI can use the form it already knows.
38. As a player, I want each die in the result, so that the narration can describe the roll.
39. As a player, I want the total in the result, so that the AI does not add the numbers itself.
40. As a player, I want a negative modifier to work, such as `1d20-2`, so that penalties are possible.
41. As a player, I want bad notation to return a clear error, so that the AI can try again.
42. As a player, I want a limit on dice count and sides, so that one call cannot run away.
43. As a player, I want to read the roll script in the editor, so that I can trust how it rolls.

### Script placeholders

44. As a Tool author, I want a script to read a world placeholder's resolved value by name, so that the Tool returns what this playthrough rolled.
45. As a Tool author, I want an entity's own placeholders on that entity's item, so that I read them where I read the entity.
46. As a Tool author, I want a dictionary book's placeholders on each of its entries, so that I read them where I read the entry.
47. As a Tool author, I want each value to be the resolved text, so that I do not write a draw of my own.
48. As a Tool author, I want the same value a prompt shows this turn, so that a Tool never tells the AI something the narration contradicts.
49. As a Tool author, I want a pinned placeholder to read its pinned value, so that traits, locations, and stats that pin a value also reach scripts.
50. As a Tool author, I want a placeholder whose value holds other chips to read fully resolved, so that I never see a raw chip token.
51. As a Tool author, I want a repeated name to give the first placeholder's value, so that a read never fails on a collision.
52. As a Tool author, I want `placeholders` in autocomplete with its names, so that I do not guess a spelling.
53. As a Tool author, I want the entity and entry items' `placeholders` members in the surface list, so that I know they exist.
54. As a Tool author, I want the placeholder values read-only, so that a script cannot change the playthrough.
55. As a Tool author, I want an empty `placeholders` object in a world with none, so that my script does not fail on a missing global.
56. As a Tool author, I want Try It with no world open to show sample placeholders, so that I can test a script before I open a world.
57. As a Tool author, I want Try It in an open world to use that world's resolved values, so that the test matches play.
58. As a Tool author, I want a snippet that reads one placeholder, so that the first use is one click.
59. As a player, I want scripts in shared presets to stay sandboxed, so that placeholder access does not widen what an untrusted script can reach.

### Editor copy

60. As a Tool author, I want the Description hint to say what the field is for, so that it does not repeat what **Add Outline** writes.
61. As a Tool author, I want the lookup's match rule under the whole lookup row, so that **Search** and **By Parameter** stay level.
62. As a Tool author, I want the match rule to name its source, so that I know which records it searches.
63. As a Tool author, I want the save footer to name each fix, so that I do not open tabs to find the problem.
64. As a Tool author, I want the footer to name an unnamed parameter by its position, so that I find it in a long list.
65. As a Tool author, I want the footer to list several fixes in one sentence, so that I see them all at once.
66. As a Tool author, I want the boolean type to read **True/False**, so that it matches the values my script and Try It use.
67. As a Tool author, I want my saved boolean parameters unchanged by the rename, so that no Tool breaks.

## Implementation Decisions

### All new built-in Tools

- Each description follows the `get_entity` outline: Purpose, Use when, Input, Output. Descriptions are prompt text, so each one ships with probe numbers per the prompt-writing guide.
- The shipped default on every built-in preset is off. Switching a default on is a later product call that uses the probe results.
- Each one defaults Offered To narration only.
- No stored-shape change: catalog Tools are not exported, and the per-preset switch uses the storage from the global-Tools spec.

### Lookup Tools

- `get_location`: lookup source `locations`, by a `name` parameter, returns the full description.
- `get_dictionary_entry`: lookup source `dictionary`, by a `keyword` parameter.
- **The dictionary source matches the entry name too.** The AI sees an entry name only once that entry is in a lore block, and a keyword only from the story, so the lookup matches both. This changes user dictionary lookups the same way. It is a behavior change, not a stored-shape change.
- The empty result matches the handler's output shape (`{"matches": []}`).

### Recall

- `recall` is a lookup Tool with a new source, `memories`, by a `query` parameter.
- **The source is catalog-only in this spec.** The **Search** picker for user Tools does not offer it, and Tool validation rejects it on import. This keeps the stored Tool shape unchanged. Offering it to user Tools is an open question (see Further Notes).
- The locked editor still shows the source's label, "Memories", so the built-in Tool reads correctly.
- **No user copy.** **Duplicate** is disabled for a catalog Tool whose source a user Tool cannot store, and the copy helper refuses it, so no path builds a user Tool with the `memories` source. Otherwise a duplicate would save, run for the session, export as a Tool that import refuses, and vanish on reload.
- **What it searches:** each committed assistant turn's digest and each diary entry on that turn. Digests are read through `applyMemoryOverrides`, like every other memory consumer, so a player rewrite is the text recall finds and a deleted memory never returns. Diary entries that read "nothing notable" are skipped.
- **Not searched:** hand-written memories from the Memory Manager. They ride every request in full already. The player's per-turn scene notes are not memory and are never searched.
- **What it skips:** the verbatim floor, the last N turns the narration prompt carries in full, where N is the verbatim-turns setting. That is the one rule for every prompt the Tool is offered to. A kept milestone digest can come back as a match; recall returns digests, not narration, so the repeat is one line.
- **Match rule:** lexical. The query and each record are split into lowercase words, with common stop words removed. A record scores by how many query words it holds. Records with a score of zero never match. Ties go to the newer turn.
- **Limit:** at most five matches, then sorted oldest first.
- **Output shape:** `{"matches": [{"turn": 12, "kind": "digest", "text": "..."}, {"turn": 14, "kind": "diary", "character": "Name", "text": "..."}]}`. The empty result is `{"matches": []}`.
- **Turn number** is the chronological count of committed turns, every turn counted, not the Memory Manager's digest-only numbering, which shifts when a digest is deleted. Within one turn, the digest sorts before its diary entries.
- **Digests off:** recall returns the empty result, whatever an old save still holds.
- **Deleted digest:** the delete hides that turn's digest only. Its diary entries stay searchable, because the Memory Manager deletes one memory row and diaries are not rows there.
- **Snapshot:** the Tool Snapshot gains a frozen, read-only memory list for the turn: turn number, digest, and diary entries per turn, with the carried turns already removed. It is built from the committed history, so a rollback removes the rolled-back turns before the next call.
- The snapshot's memory list is not given to scripts in this spec. The script surface stays as it is.
- The sample snapshot carries a few sample memories, so Try It shows the output shape with no world open.
- **Hybrid mode.** When the semantic memory setting is on, recall ranks by meaning and by words together. When it is off, recall is lexical only, exactly as above.
  - **Query vector.** Recall embeds the query through the existing embedding worker. Record vectors come from the embedding cache, which the drainer already fills. Recall adds no new download, no new embedding work, and no AI request.
  - **Gate per record kind.** The drainer embeds digests when Semantic Memory and digests are on, and diary entries only when Diary Recall is also on. Recall follows those gates. With Diary Recall off, diary entries have no vectors and match by words only, through the fail-open rule below. Recall does not ask the drainer for vectors the settings did not request.
  - **Meaning match.** A record passes when its cosine similarity to the query clears the Scene Recall rule: at least the surface floor, and at least the median over all vectored candidates plus the Scene Recall margin. Below the Scene Recall minimum candidate count, only the floor applies. Digests use the Scene Recall floor, and diary entries use the Diary Recall floor. Recall reuses these constants and adds none of its own.
  - **Union.** A record matches when it passes the meaning match, or when its lexical score is above zero.
  - **Rank for the limit.** First the records that match both ways, then meaning-only matches, then word-only matches. Within a group, a higher score comes first, and ties go to the newer turn. The five survivors are then sorted oldest first, as in lexical mode.
  - **Which score orders a group.** Both-ways: cosine first, word count breaks a cosine tie, then the newer turn. Meaning-only: cosine. Word-only: word count.
  - **One pooled median.** The median and the minimum candidate count run over digests and diary entries together. Each kind is then held to its own floor.
  - **Fail open.** A record with no cached vector takes part through its lexical score only. If the embedding model is not loaded or the query embed fails, the whole call is lexical. Recall never waits for a model download.
  - **Output.** The output shape does not change. A match does not say how it matched.
  - The hybrid ranking is a pure function over the query, the records, their vectors, and the query vector, so tests can pass fixed vectors.
- Recall is the first user of the roadmap's hybrid scoring step (keyword plus cosine). It covers recall only. The ranked band, Semantic Lore, Scene Recall, and Diary Recall keep their current scoring.
- The earlier lexical rehydration was disabled because it pulled near-duplicate turns back verbatim. Recall differs in three ways: the AI asks for it, it returns digests and not verbatim turns, and it has a hard limit. The probe must still watch for a repeated-scene freeze.

### Roll

- `roll` is a catalog Tool with a script handler. It uses the existing sandbox and adds no handler kind.
- One required parameter, `dice`, as text.
- Notation: `NdS`, `dS`, `NdS+K`, `NdS-K`. Spaces are ignored and case does not matter.
- Limits: N from 1 to 100, S from 2 to 1000, K from -1000 to 1000.
- **Output shape:** `{"dice": "2d6+1", "rolls": [4, 2], "modifier": 1, "total": 7}`.
- Bad notation or an out-of-range value returns text that names the problem and gives one valid example, such as "Use dice notation like 2d6+1".
- **Seeded random.** The sandbox's own `Math.random` seeds from the clock at about a millisecond, so two runs in one millisecond roll the same dice. The host draws a fresh seed from `crypto.getRandomValues` per run and bakes it into the sandbox prelude, which replaces `Math.random` with a small seeded generator. No host call, no new global, and the script surface is unchanged. Every Tool script gets the fairer source; the stat-code sandbox keeps its clock seed and is named, not changed.
- Each die uses that `Math.random`.
- The script stays short and readable, because the player can open it.

### Script placeholders

- The Tool Snapshot gains a frozen, name-keyed map of world-level placeholder values.
- **Resolved only.** Each value is the text the snapshot's resolver produces for that placeholder's chip in `world` mode, with the placeholder's own id as the placement id. The snapshot builder resolves each placeholder's world-mode chip through the scene's own `resolve` and `resolveEntity`, the same path a Template chip takes, so there is one resolver. It does not use `readPlaceholders`, which skips built-ins and misses a before-box write. Pins, rolls, and nested chips come out the same as in a prompt this turn.
- **Owner context.** Entity text resolves with the entity as its owner (`resolveEntity` on the live scene), and that context carries the entity's pins. An entity item's `placeholders` resolve under the same owner context, never under the world `resolve`, or a pinned value goes missing. The resolver has no book owner context, so book-owned placeholders resolve under the world `resolve`, as entry values do today. The snapshot builder needs the scene's owner-aware resolvers, not only `resolve`.
- **Entity owned.** A placeholder scoped to an entity goes on that entity's item, under `placeholders`, not in the world-level map.
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
- The match hint leaves **By Parameter**. It shows as one hint under the lookup grid, full width. The per-source text stays, and each one now names what it searches:
  - Entities: "Matches entity names and aliases, in any case"
  - Locations: "Matches location names, in any case"
  - Dictionary: "Matches dictionary names and trigger keywords, in any case". "Trigger Keywords" is the app's defined term for the field, so the hint never says a bare "keywords".
  - Memories: "Matches words in past turns and diaries, in any case"
  - **Each hint lands with its behavior.** Name matching landed first, so the editor-copy ticket ships the final "Matches dictionary names and trigger keywords, in any case" and the lookup-Tools ticket makes no editor edit. The recall ticket adds the Memories source and its hint together. A hint never describes a match rule the runner does not have yet.
- The footer builds its sentence from the draft problems, not from the tab names. Each problem kind maps to one verb phrase, and the phrases join with "and". Examples:
  - An empty name: "Name the Tool".
  - A repeated name: "Rename the Tool".
  - An unnamed parameter: "Name parameter 2".
  - An enum with no options: "Add options to parameter 3".
  - No lookup parameter: "Pick the parameter to search by". This is the Handler tab's inline text today; the footer reuses it, so one problem has one wording.
- The tab strip has no problem marks, so the footer keeps a tab hint after each phrase, such as "Name parameter 2 (Parameters) to save". The shared tab strip is not changed.
- The boolean type label becomes **True/False**. The stored value stays `boolean`.

## Testing Decisions

- A good test drives a public entry point and asserts what a player or the AI receives. It never asserts an internal helper's call.
- **Tool runs:** the Tool runner's call entry, with a snapshot from the real snapshot builder, is the one seam for every new built-in Tool and for script placeholders. Prior art: the runner's existing lookup and script tests.
  - Each lookup Tool: a hit, a case-insensitive hit, a miss that returns the empty result. The dictionary lookup adds a hit by entry name.
  - Recall, lexical mode: a digest hit, a diary hit with its character, a turn inside the verbatim floor that is skipped, a kept milestone outside the floor that still matches, a rewritten digest found by its new text and not its old, a deleted digest that never matches, a hand-written memory that never matches, the five-match limit, oldest-first order, a "nothing notable" entry that is skipped, a history with no digests, and a rolled-back turn that no longer matches.
  - Recall, hybrid gate: with Diary Recall off, a diary entry that would match by meaning matches by words only.
  - Recall, hybrid mode, with fixed vectors: a meaning-only match that shares no words, a word-only match below the threshold, both-ways matches ranked first for the limit, a record with no vector that still matches by words, a failed query embed that returns the lexical result, and a same-cast world where the median margin keeps the result small. Prior art: the Scene Recall margin tests.
  - Roll: each notation form, a negative modifier, every limit edge, bad notation, and a total that equals the dice plus the modifier. Randomness is checked by range over many runs, never by a fixed value.
  - Scripts: a world placeholder read by name, an entity placeholder and a book placeholder read from their items, a pinned value, a nested chip resolved, a repeated name, an empty map in a world with none, and a write that does not change the value.
  - The script value equals the Template chip value for the same placeholder in the same snapshot. This test guards against two resolvers.
- **Snapshot:** the snapshot builder's test covers the memory list's carried-turn removal. Prior art: the existing Tool Snapshot use in the runner tests.
- **Validation:** an imported Tool with the `memories` source is rejected. Prior art: the Tool pack tests.
- **Catalog and offer:** the catalog and offer tests cover the new Tools' default-off state and the global switch. Prior art: the catalog and catalog-overrides tests.
- **Surface:** the script-surface test covers the `placeholders` global, its members, and the item shapes' new member. Prior art: the existing script-surface test.
- **Editor copy:** the Tools tab edit test and the Settings modal Tools test cover the footer sentences, the moved match hint, the Memories label on the locked recall Tool, and the **True/False** label. These tests already assert the old footer text, so they change with it.
- **Probes:** each new built-in description needs a narration probe on both model tiers, at least two runs per case, per the prompt-writing guide. The probe numbers go in the ticket.
  - Recall's probe needs a long playthrough with an event that milestone memory dropped and the story later returns to. It measures whether the AI calls recall, whether the narration then uses the fetched fact, and whether a repeated-scene freeze appears.
  - Recall runs two arms: semantic memory off and on. The on arm must find at least what the off arm finds. It should also find cases where the AI's query uses different words from the digest. The oblique cases from the semantic memory 50-turn A/B are the starting fixture.
  - Roll's probe measures whether the AI calls roll when a chance outcome comes up and whether the narration follows the total.

## Out of Scope

- Switching a new built-in Tool on by default. That is a product call after the probes.
- The `memories` source in the **Search** picker for user Tools.
- Memory in the script surface.
- Hybrid scoring for any surface other than recall.
- A reranker model. The semantic memory notes tested browser-size rerankers and rejected them.
- A stat check that rolls against a stat. See the Tool ideas notes.
- A name Tool. See the Tool ideas notes.
- A script that reads placeholder definitions: the value list, weights, pins, or kind.
- A script that changes a placeholder or rerolls one.
- Any Tool that changes the playthrough. See the Tool ideas notes.

## Further Notes

- **Open question: `memories` for user Tools.** Offering the source in the **Search** picker adds a value to the stored Tool handler. That is an export-shape change, because Tool packs and preset exports carry user Tools. It is the user's call.
- Chips key placeholders by id, and a search of the placeholder modules found no check that keeps names unique. The first-wins rule covers that case.
- The global-Tools spec (tools-global-and-editor-polish) owns the per-preset switch storage. This spec's built-in Tools depend on it.
- The boolean label change is copy only. The AI sees `type: "boolean"` in the schema whatever the label says.
