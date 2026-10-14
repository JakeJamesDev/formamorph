# Spec: Global Scope Split

Status: done
Status note: Closed on 2026-10-14. Tickets 01–12 landed; the last landing is 8e3c2b513. Closed without gates.
Spec session: world-scope-split — spec

## Problem Statement

The code treats the world's own stats and traits as "the player's". A loose stat such as City Rampage's Destruction sits under a stand-in owner key, saves call it `playerStats`, the editor files it under **Player Stats**, and the AI reads it under **Other Stats**. In play, the root traits and the played persona's traits count as one owner, so a root trait can satisfy a persona's **Same Owner** requirement. Authors and the AI get one word, "player", for two things: items no one owns and the persona.

## Solution

One rule: **a stat or trait with no owner is global.** Global items belong to no one. Persona items are the played entity's own. The code, the saves, the world file, the editor, the in-play panels, the hover cards and the AI prompts all keep the two apart and use the one word, Global.

## Rulings

Settled with the user on 2026-10-13 and reframed on 2026-10-14 around the core rule and the term Global. This reopens owner-term-rename Q2's player-key line on new evidence: the key holds global scope, not a player. It also reopens the Player Character Block heading "Other Stats" / "Other Traits" and its chip order on new evidence: the split defines that set as global.

| # | Ruling |
|---|---|
| R0 | A stat or trait with no owner is global. Global is the term in the UI, the AI prompts, the files, the code and the glossary |
| Q1 | A root trait the player picks is a global trait. The persona owns only traits in its own entity tree, links included |
| Q1b | Under None, the player's picks are global |
| Q2 | In memory, global scope has its own slot beside an owners map. No stand-in owner key |
| Q3 | The glossary gains Global Stat, Global Trait and Persona Stat. "Player stat", "world stat" and "other stat" go on the _Avoid_ line |
| Q4 | Save fields `playerStats` and `playerTraits` become `globalStats` and `globalTraits`. Old saves migrate at load |
| Q5 | A trait stat row's saved target `player` becomes `global`. Old world files migrate at load |
| Q6 | Global traits never count as the persona's for gates. Same Owner never pairs a global trait with an entity trait |
| Q8 | A global trait's hover card says `(global trait)` in its signature and has no Owners row |
| Q9 | New saves write the new names only. v3.1–3.2 apps load newer saves without global stats and traits until they update |
| Q10 | A requirement that names a global item reads global scope, whatever trait carries it. A requirement's owner choice applies only to entity items; the picker offers none for a global item |
| Q11 | A played entity's stats always go in the Persona block, including the Custom Persona entity under a library persona and under None |
| Q12 | Prompt lines that say "the player's stats" name the persona's stats or the global stats where each is meant |
| Q13 | **You** means the played entity. With no played entity, a You row is unmet |
| Q14 | Bundled worlds whose gates break under Q6 are fixed in this effort. The Test Bench warns on a Same Owner row that pairs a global trait with an entity trait |
| Q15 | Every saved map uses the same global/owners split: cascade-off traits, switched-off traits and applied trait values |
| Q16 | The AI reads global stats under **Global Stats** and picked global traits under **Global Traits** |
| Q17 | A persona's link to a root trait the player also picked is held twice: global scope holds the pick, the persona holds the link. Each holder's rows act once. The played-entity link dedup goes away. Only Blueprints items link, and the world migration drops root links on load, so this case arises only in hand-built data; gates still resolve it by tree membership (Q29) |
| Q18 | An active entity trait's global-target row moves the global stat whoever is played. Any entity's trait can author a Global row, playable or not |
| Q19 | The world migration strips a stored owner from every requirement row that names a global item (Q10). The strip runs only where a world exists: the world migration and the paths that bind an entity into a world. The entity file, card and library store importers keep stored owners; Q10 makes a stale one inert. The `player`→`global` target rewrite runs at all four boundaries, and the card reader carries `target` (ticket 03 ruling). A copy-vs-library-source check runs the source through the same world-bound strip before it compares, so a stripped owner never reads as a change |
| Q20 | Placeholder pins fall back to the global slot where they fell back to the stand-in key. Global stays first in the pin ranking |
| Q21 | In play, the Traits tab shows picked global traits in their own Global section. The You mark sits only on the played entity's section |
| Q22 | In play, the Stats tab shows global stats under a Global heading. The persona's stats sit under its own name, as other owners' do |
| Q23 | Stat code docstrings, the Stat Code Guide and hover card text say `stats` is the global stats |
| Q24 | In every prompt, Global Traits and Global Stats sit before the Player Character block, so the persona holds the more recent slot |
| Q25 | Saved maps take `{ global?, owners? }`: `cascadeOffTraitIds` → `{ global?: string[]; owners?: Record<entityId, string[]> }`; `appliedTraitValues` → `{ global?: Record<traitId, Record<statId, number>>; owners?: Record<entityId, Record<traitId \| "traitId/stats", Record<statId, number>>> }`. `disabledTraitIds`, `ownedTraits` and `entityStats` stay. Old keys migrate: `world` → global, `<owner>/<trait>[/stats]` → `owners[owner]`. In-memory gameplay state converts at the save boundary; ticket 11 owns any in-memory rename (ticket 02 ruling) |
| Q26 | The persona can be more than one entity: a world persona's entity; a library persona plus the world's Custom Persona entity; under None, the Custom Persona entity. The shape resolves a list of played entity ids, each through its own id. **You** reads that whole set, never global scope (ticket 01 ruling) |
| Q27 | The Traits tab shows one **Global** node, like an entity's node, with the root groups below it, always, even with no entities. The Stats tab follows the same rule with a Global node over global stats (user, ticket 09) |
| Q28 | One Persona block holds every played entity (Q26): the library persona's name, description and traits, then each played entity's stats and owned traits under its own groups. Their stats sit under the "Player Character" schema key; a clashing name takes the numbered key. The Custom Persona entity's owned traits are persona traits and never go under Global Traits. The global stats schema key is "Global Stats" (ticket 08 ruling) |
| Q29 | A Condition resolves by tree membership: it reads the entity it names (Same Owner = the host's owner, You = the played set, or a named entity) when that entity's tree holds the target; otherwise a global target reads global scope (Q10); otherwise it is unmet. The stat picker lists the host's own section, then **Global Stats** with no owner, then **Persona Stats** with a You owner over every playable entity's stats, then each other entity. The Q14 warning fires on a Same Owner Condition whose host is global and whose target is an entity item only (ticket 04 ruling) |
| Q30 | A stat row resolves like a Condition (Q29): an untargeted row moves the entity's own stat when it owns that id, else the global stat with that id, on any entity. `target: 'global'` forces the global stat when the entity owns a clashing id. No migration; released untargeted persona rows keep working (ticket 05 ruling) |
| Q31 | In play, pins lay all global traits first, then the persona's traits, then the cast, matching the editor ranking (Q20). The persona wins over global even where its node sits among root groups. A pin suite whose value changes for that case names this ruling (ticket 06 ruling) |
| Q32 | The code rename covers names that hold global scope: gameplay state, setters, helpers, local variables, `playerStatsOf`, and the fold (`playerOwnerIds`, `isPlayer` on the global owner). The `PlayerStat` type, which types every stat, and the player-facing world-file fields (`playerToggle`, `playerDescription`, `playerHidden`, `playerNotes`) keep their names (ticket 11 ruling) |
| Q33 | The Test Bench lens follows R0: a persona trait picked as the lens PC stays the persona's, and the lens and Enter World preview compute starting stats with the global/owners split. Test Bench results that change name this ruling. In memory, applied trait values stay one map keyed by record key; only the save splits it (Q25). Card import binds a You stat Condition among the played entity's stats (Q13, Q29), and a card's Owners row never shows You for the global tree (Q8). Ticket 12 carries the fixes (ticket 11 ruling) |
| S1 | Tests sit at four seams: import migration, gate resolution, AI request assembly, and hover cards with the Test Bench |

## User Stories

1. As an author, I want ownerless stats called global stats everywhere, so that I don't think Destruction belongs to the player.
2. As an author, I want player stats to mean the persona's stats, so that "player" always points at the entity being played.
3. As an author, I want the requirement picker's stat section to say **Global Stats**, so that it matches what the section holds.
4. As an author, I want the trait editor to label global-target stat rows **Global**, so that I see a row changes a global stat.
5. As an author, I want a requirement that names a global item to check global scope, so that I never pick an owner for something no one owns.
6. As an author, I want **Same Owner** to mean an entity's own tree, so that a global trait never satisfies a persona trait's requirement by accident.
7. As an author, I want **You** to mean the entity being played, so that a You row reads the persona and nothing else.
8. As an author of a world with no played entity, I want a You row to read as unmet, so that the gate doesn't pretend a persona exists.
9. As an author, I want the Test Bench to warn when a Same Owner row pairs a global trait with an entity trait, so that I find gates the split changed.
10. As an author, I want a global trait's hover card to say `(global trait)` with no Owners row, so that the card matches a global stat's card.
11. As an author with an older world, I want trait rows that target `player` to load as `global`, so that my rows keep changing the same stats.
12. As an author, I want new exports to write `global` as the row target, so that the file matches the docs.
13. As an author reading the world format doc, I want the row target documented as `global`, with a note that `player` loads, so that hand-edited files keep working.
14. As an author, I want an entity trait's Global row to act even when no one plays that entity, so that a monster's rampage moves the city's Destruction.
15. As a player with an older save, I want my global stats, global traits and switched-off traits to load unchanged, so that the rename never changes my playthrough.
16. As a player, I want a global trait a cascade switched off to return when its gate holds again after a load, so that saves keep their trait state.
17. As a player on v3.1–3.2, I accept that a save written after this change loads without global stats and traits until I update.
18. As a player of a bundled world, I want its gates to work after the split, so that the shipped worlds play as authored.
19. As a player, I want the Traits and Stats tabs to show global items under Global, so that I see which items are my persona's.
20. As a player, I want the AI to read my persona's stats in my Persona block, so that it never mistakes them for scene stats.
21. As a player under a library persona with a Custom Persona entity, I want that entity's stats in the Persona block, so that the AI knows they are mine.
22. As a player under None, I want the played entity's stats in the Persona block, so that the AI treats them as mine.
23. As a player, I want the AI to read global stats under Global Stats, so that it doesn't treat the city's Destruction as my body.
24. As a player, I want the Persona block after the global blocks, so that the AI weighs my character more.
25. As a player, I want narration that still uses my persona's stats to shape outcomes, so that the prompt rewording doesn't weaken play.
26. As a developer, I want global scope in its own slot, so that no owner list can hold it by mistake.
27. As a developer, I want the played persona keyed by its entity id everywhere, so that one entity has one key.
28. As a developer, I want every saved map in one global/owners shape, so that a reader never guesses which keys are owners.
29. As a developer, I want code names to say global or persona, so that "player" never means global scope.
30. As a developer, I want the glossary to carry Global Stat, Global Trait and Persona Stat, so that reviews and copy use one term per concept.
31. As a developer, I want each prompt change shipped with probe numbers, so that a wording or order change is judged on the real models.
32. As a Formaquestion user, I want help answers to say global stats and persona stats, so that the assistant uses the editor's words.

## Implementation Decisions

- **Glossary.** Global Stat: a stat in the world's own list, not under an entity or a Blueprint; it has no owner. Global Trait: the same for traits, including the player's root picks (Q1). Persona Stat: a stat of the played entity. _Avoid_: player stat and player trait in the global sense, world stat, other stat.
- **In-memory shape.** Owner-keyed state becomes a global part plus an owners map keyed by entity id (Q2). The stand-in player key and the read-time fold of the played entity into it go away. The played entity is reached through its own id wherever the persona is meant.
- **Gate resolution.** A requirement naming a global item reads global scope (Q10); one naming an entity item reads the owner the row names, as today. **You** reads the played entity and is unmet with none (Q13). **Same Owner** pairs only items in one entity's tree (Q6). A world group Condition counts global items only, never placed entities' traits. A linked trait belongs to the entity that links it (Q17); the held reason "holds X as a player trait" goes with the dedup.
- **Stat rows.** A global-target row on any entity's active trait moves the global stat, played or not (Q18). The editor offers the Global row on every entity, not only playable ones. Each holder's rows act once (Q17).
- **Placeholder pins.** The pin fallback and ranking use the global slot in place of the stand-in key (Q20). Global traits and persona traits pin as separate owners. Placeholder tree names stay.
- **In play.** The Traits tab gains a Global section for picked global traits (Q21); the Stats tab puts global stats under a Global heading (Q22).
- **Saved shape (save).** `playerStats` → `globalStats`, `playerTraits` → `globalTraits` (Q4). `disabledTraitIds` already holds global traits only and stays. `appliedTraitValues` keeps bare trait ids for global traits; owner records move under the owners part. `cascadeOffTraitIds` moves its stand-in key's list to a global part. The ticket names the final fields under Q15's one shape. The save migration converts every snapshot and is idempotent. New saves write the new shape only (Q9). Every ticket that touches it carries the export-shape reminder.
- **Saved shape (world file).** The trait stat row target `player` becomes `global` (Q5). Requirement rows naming a global item lose any stored owner (Q19). The world migration does both; the entity file importer, the character card importer and the library entity store run the same rewrite. Exports write the new shape. The world format doc documents `global` and notes that `player` loads.
- **AI requests.** A played entity's stats always go in the Persona block (Q11). Global stats go under **Global Stats**; picked global traits go under **Global Traits** (Q16). Both sit before the Player Character block in every prompt (Q24). Prompt lines that say "the player's stats" name the persona's or the global ones (Q12). Prompt changes follow the prompt-writing guide and ship with probe numbers.
- **Editor and cards.** The requirement picker's **Player Stats** section becomes **Global Stats**; the trait editor's **Player** label for global-target rows becomes **Global**. A global trait's card reads `(global trait)` with no Owners row (Q8). Code globals keep their names: `stats` is the global stats, and its docstrings, the Stat Code Guide and hover text say so (Q23).
- **Test Bench.** A new warning flags a Same Owner row that pairs a global trait with an entity trait (Q14).
- **Bundled worlds.** Each bundled world is audited for gates that relied on the fold, and fixed in its data (Q14). Bundled world prose that says player stats for global stats moves to global stats. City Rampage needs no data change: Destruction and Alert Level are global, and The Creature's stats and traits are its own.
- **Docs.** Traits, stats, persona authoring, world format, Stat Code Guide and Glossary pages; help content. Released changelog sections keep their history. In Progress entries that say player stats or Other Stats for global stats are reworded; one entry describes the split and its gate change.

## Testing Decisions

- A good test drives a public seam with a small world and asserts what an author sees, what the AI reads, or what a file holds. It never asserts on internal key names.
- **Import migration.** An old save loads into the new shape with the same values: global stats, global traits, and the global parts of cascade-off, switched-off and applied values. A second migration changes nothing. A fresh save writes no `playerStats` or `playerTraits`. An old world's `player` row target loads as `global`, and a stored owner on a row naming a global item is gone, from a world file, an entity file, a character card and the library entity store. Guard bites: removing a migration step fails its test. Prior art: the world migration and save migration tests.
- **Gate resolution.** From a small world: a requirement naming a global item reads global scope under every persona and from an entity trait; You reads the played entity and is unmet under no played entity; Same Owner no longer pairs a global trait with an entity trait; a world group Condition ignores a placed entity's traits; a linked trait the root also holds counts for both holders and its rows act once per holder; a cascade-off global trait returns after a save round trip. Existing gate suites keep every expected value except where Q6, Q10, Q13 or Q17 changes the behavior; each such change names its ruling in the test. Prior art: the trait gates, trait runtime and gameplay trait round-trip suites.
- **AI request assembly.** A played entity's stats sit in the Persona block under a world persona, a library persona with a Custom Persona entity, and None (Q1b, Q11); global stats sit under Global Stats and picked global traits under Global Traits, both before the Player Character block. Prior art: the stat request and chip value tests. The entity-stats, persona-block-stats, persona-stats-chip and owned-traits probe harnesses move to the new request shape before any probe runs. Prompt wording and order carry probe numbers with in-batch controls (probe skill).
- **Cards and Test Bench.** A global trait's card shows `(global trait)` and no Owners row. The Test Bench warns on a crossing Same Owner row and stays quiet on a same-entity pair. Prior art: the code card and Test Bench rule tests.
- **Stat rows and pins.** A global-target row on an unplayed entity's active trait moves the global stat (Q18). A placeholder pin with no entity owner resolves through the global slot (Q20).
- **In play.** The Traits tab renders a Global section without the You mark, and the Stats tab a Global heading (Q21, Q22). Prior art: the GamePanels tests.
- **Help.** After the docs change, the help index rebuilds and a Formaquestion check confirms answers say global stats and persona stats.
- **Copy.** The `copy-sweep` skill reviews the changed labels and docs.

## Out of Scope

- Renaming the `stats` code global or any stat code route.
- Writing both save shapes for old apps (Q9 chose new names only).
- Any change to how entity-owned traits gate among themselves.
- Playing As conditions and the self-named-gate rule.
- Rewriting released changelog sections.
- The placeholder tree's owner names (kept by an owner-term-rename ruling).

## Further Notes

- Origin: the owner-term-rename close review. The stand-in key `PLAYER_OWNER` held the value `'world'`, which described its contents; that spec's Q2 renamed it toward "player". A follow-up moved the value to `'player'` and was reverted once the user ruled that ownerless stats are not the player's.
- Facts gathered before the rulings: saves already store a played persona's traits under its entity id and its stats per entity; the fold into the player key happens at read time only. The persona trait half shipped in v3.2.3 under the `world` key; per-entity stats have not shipped.
- Known places that call global stats player stats: the requirement picker section, the trait editor label and hint, the Stats adapter hint, the held-reason text, the stat code docstrings, three In Progress changelog entries, and the traits, world format and persona authoring docs.
- The spec folder keeps its `world-scope-split` slug.

## Backlog

- The `PlayerStat` type names every stat, entity stats included; a rename to `Stat`-family naming is its own pass (Q32).
- A loaded save with an unplayed entity's trait already on gains its global effect only at the trait's first switch, because no record exists yet (Q18). From ticket 05's review.
