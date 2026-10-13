# Spec: Stat Pass Owner Blocks

Status: ready-for-agent
Spec session: stat-pass-owner-blocks — spec

## Problem Statement

The stat tracker reads the wrong picture of who owns what. The default Stat Updates prompt puts every world stat under a `### Player Character` heading and tells the model a stat "moves only for what that character does, goes through, or feels". In City Rampage that heading holds Destruction and Alert Level, which belong to the city and the military. The rule tells the tracker to leave them alone. Every bundled world except Open Chat has at least one stat like this: Suspicion, Pursuit, Predator Attention.

The tracker also sees no owner's traits. The Traits chip in the stat prompt is world traits only, so a present entity's conditions and a played persona's traits never reach the pass that judges their stat changes. An entity's stats arrive as a bare list under its name.

Worlds authored before entity stats never chose an owner for anything. Their player stats, their world stats and their faction stats are one loose list.

## Solution

The Stat Updates prompt reads the same owner blocks the narrator reads. A `Player Character` block holds the played persona's traits and stats. An In Scene cast block holds each present entity that owns stats, with its traits and its stats. After them, Other Stats and Other Traits hold the loose world stats and traits with no ownership prose. The owner rules apply to the headed blocks only.

The reply keeps the one-object shape with one key per heading: `Player Character`, `Other Stats`, and one per entity. A persona with no stats renders no block and gets no key.

Every bundled world moves its player stats onto a Custom Persona entity, created where none exists. World stats such as Destruction stay loose. Emberwatch turns its player stats into Blueprints linked on each of its personas.

The text fallback takes the same player and world blocks, and it fires for every built-in preset in that preset's style.

## Rulings

Settled with the user on 2026-10-12 and 2026-10-13.

| # | Ruling |
|---|---|
| Q1 | The Stat Updates prompt reads the same chips as narration: a Persona block, an In Scene Entities block, then the world Stats and Traits chips |
| Q2 | Loose world stats and traits render as a neutral block with no prose about who owns them. Ownership is the author's to set. Bundled worlds move their owned stats onto owners |
| Q3 | The text fallback takes the same blocks, player and world only, as entity-stats Q4 keeps entity stats off that path |
| Q4 | Only present entities that own stats get owner blocks, as entity-stats Q2 limits the request |
| Q5 | Every bundled world moves its player stats onto the played persona. A world with no persona entity gets one. World stats stay loose. Reopens player-character-block Q12 on this evidence |
| Q6 | The owner filter is a chip option. Delivered by the Chip Options spec as Only With Stats |
| Q7 | No name-style chip option. The stat pass renames owned stats to their request keys before any chip renders (chip-options Q5). Narration keeps raw names |
| Q8 | The player's key stays `Player Character`. The default Persona header already reads that way |
| Q9 | Superseded by the Chip Options spec, which ships the filter and the Include and Stat Detail rows |
| Q10 | The loose world block heads Other Stats, as narration does, and Other Stats is its reply key. The world Traits chip heads Other Traits |
| Q11 | In the stat pass the Stats chip carries world stats only. Entity sections leave it. A saved custom stat prompt gets entity stats once its author adds an Entities chip. Reverses entity-stats Q52 |
| Q12 | The entity-stats Q28 measures must clear on both models for player and entity cells. A new world-stat recall measure on Rampage and Slime is reported for the user to rule on |
| Q13 | The default prompt's Persona and Entities chips pick Summary content, Include Traits and Stats, and all three Stat Detail pieces |
| Q14 | The text fallback's style gap is in scope |
| Q15 | Moot. The Chip Options spec closed before this spec was written |
| Q16 | A played persona with no stats renders no block and the schema drops the `Player Character` owner. Other Stats carries whatever is loose |
| Q17 | The text fallback fires whenever a built-in preset is active, rendered in that preset's style. A user preset is sent as written (entity-stats Q34). The equals-default string compare goes away |
| Q18 | A Custom Persona entity owns the moved player stats, so they run under None and under a library persona (entity-stats Q47). Emberwatch makes its player stats Blueprints linked on Wanderer, Albus and Sylvie |
| Q19 | Loose world stats: Destruction and Alert Level (Rampage), Suspicion (Slime), Pursuit (Valentines), Predator Attention (Veilwood). Every other stat moves to the persona, Renown included |
| Q20 | A save of a bundled world from the current release keeps its loose player stats and backfills the persona's at starting values. No migration. The changelog notes it |
| Q21 | Each new Custom Persona entity is named as the world's prose addresses the player: The Creature, The Drone, and a role name per world listed in the ticket for sign-off |

## User Stories

1. As a player of City Rampage, I want Destruction to rise when I level a block, so that the world's stats move with the world.
2. As a player, I want the tracker to know my persona's traits, so that a wound or a curse informs how my stats move.
3. As a player, I want the tracker to know a present entity's traits, so that Bram's trust moves in line with his condition.
4. As a player, I want my persona's stats under one Player Character heading, so that the tracker never moves them for what someone else did.
5. As a player, I want a present entity's stats under that entity's name, so that each change lands on the right owner.
6. As a player of a world with no persona stats, I want the stat pass to still track the loose stats, so that an older world keeps working.
7. As a player with a library persona, I want my Custom Persona entity's stats to keep running under Other Stats, so that no owner's stats run unseen.
8. As a world author, I want world stats and player stats told apart by where I put them, so that I never write ownership into a description.
9. As a world author, I want to leave a stat loose on purpose, so that a city or a faction can have a meter without an owner.
10. As a world author, I want the stat prompt's blocks to match the narration prompt's blocks, so that one layout teaches both.
11. As a prompt author, I want the default stat prompt to use ordinary chips with ordinary options, so that I can rearrange it in Settings.
12. As a prompt author, I want the Persona and Entities chips in the stat prompt to show Only With Stats, so that the tracker reads a cast that has something to update.
13. As a prompt author with a saved stat prompt, I want it sent exactly as written, so that an update never silently changes my request.
14. As a prompt author with a saved stat prompt, I want a documented way to get entity stats back, so that I can add the Entities chip myself.
15. As a player on the Simple or XML preset, I want the text fallback to run when my endpoint refuses the schema, so that a styled preset is not worse than the default.
16. As a player on the text fallback, I want the same player and world blocks, so that the fallback never calls a world stat mine.
17. As a player of a bundled world, I want my character's stats on my character, so that the stat panel and the prompts agree about who owns them.
18. As a player of Emberwatch, I want Health, Mana, Faith, Gold and Renown whether I play Albus, Sylvie or the Wanderer, so that no persona starts without a body.
19. As a player with a save from the current release, I want to know why a bundled world shows a second Health after the update, so that I can start a new game on purpose.
20. As a help reader, I want the Guide to describe the stat prompt's blocks, so that the help window can answer how the tracker sees owners.
21. As a developer, I want probe numbers for the new layout on both models, so that the change ships on evidence.
22. As a developer, I want a world-stat recall number, so that the user can rule on whether the tracker now moves city stats.

## Implementation Decisions

- **The request has three owner kinds.** The stat request snapshot separates the played persona's stats, the loose world stats and each present entity's stats. Each kind has its own owner key: `Player Character`, `Other Stats`, one per entity. Key dedupe runs over all three. The schema emits one required object per owner that has stats, so a persona with no stats produces no `Player Character` object. The reply reader maps each owner key back as it does today. Under a library persona, the Custom Persona entity's stats sit under Other Stats with their keys, as player-character-block Q17 places them.
- **Renaming before rendering.** The stat pass hands the chip scene a renamed view of every owner's stats, each named by its request key, before any chip value renders. This extends what the world and played stats already do to entity-owned stats. Narration's scene is untouched and keeps raw names. The lazy values source the Chip Options spec built is the point where the stat pass substitutes its scene.
- **The Stats chip in the stat pass.** It carries the loose world stats only. The entity sections it appended since entity-stats Q52 go away. The text pass keeps reading the same world-only value.
- **The default prompt.** The built-in Stat Updates prompt opens with the Persona chip headed `Player Character`, then the Entities chip in the In Scene scope, both with Only With Stats, Summary content, Include Traits and Stats, and Range, Descriptor and Description. Then the Stats chip headed Other Stats and the Traits chip headed Other Traits. The prose keeps the owner rule for headed blocks and says nothing about who owns a loose stat. The format section names the three key kinds. The three-part framing from entity-stats Q76 stays as it shipped.
- **The text prompt.** The text fallback prompt takes the Persona chip with the same picks, then Other Stats and Other Traits. Its reply stays stat-change lines over the player's and the world's stats. Entity owners are skipped with a diagnostic as today.
- **Fallback selection.** The pass asks the settings layer whether the active preset is a built-in. When it is, the text pair is the built-in text prompt rendered through that preset's style. When a user preset is active, the stat prompt is sent as written on the fallback path too. The string compare against the raw default is removed.
- **Bundled worlds.** Six worlds gain a Custom Persona entity that owns the player stats listed in Q19's complement. The entity's name follows Q21; its description is one line in the world's voice. Stat code that reads a sibling stat keeps working because an owned stat's code reads its owner's stats as `stats` (entity-stats Q29); each moved world's code is run through the code test. Emberwatch's five player stats become Blueprints and each persona links all five. Open Chat has no stats and does not change. Bundled fingerprints update with the files.
- **Saves.** No migration. On load, the persona's stats backfill at starting values and the old loose stats are kept, as entity-stats Q40 rules. The changelog entry says a save of a bundled world from an older version shows both until a new game.
- **Settings preview and sample scene.** The sample scene's Traveler already owns one stat and one trait, so the stat prompt's Persona block renders in the Settings preview. The sample gains one present entity that owns a stat so the In Scene block renders there too.
- **Docs.** The Guide pages on the stat tracker and on prompt chips describe the three blocks and the three reply keys, and tell a custom-prompt author how to add the Entities chip. CONTEXT.md's stat request entry names the three owner kinds. The changelog entry is one line under Minor, Added, 🛠️, with the save note folded in.
- **Export shape.** Unchanged. The world and save envelopes gain no field. Bundled world files change content only.

## Testing Decisions

A good test puts data in at a seam and reads text or a request out. It never asserts on an intermediate structure the prompt does not see.

- **The stat request snapshot.** Stats, personas and entities in; targets, keys, schema and chip values out. Cases: a persona with stats, a persona with none, loose stats only, two entities whose stat names clash with the persona's, an entity named `Other Stats`. Prior art: the stat request owners tests.
- **Chip values over a scene.** The stat pass's renamed scene and each default token in; rendered text out. Cases: keyed entity stats inside a Summary cast entry with every Stat Detail piece, Only With Stats dropping a stat-less entity, the Persona miss rendering the bare placeholder, narration's scene still showing raw names. Prior art: the chip values and persona stats tests.
- **The stat pass request builder.** Prompt and material in; request bodies out. Cases: the default prompt's system prompt holds the four blocks in order, a user preset is sent as written, each built-in style picks its own text pair, and the byte-equal parity run over recorded history for the requests this spec leaves unchanged. Prior art: the turn passes tests and the parity suite.
- **Bundled world data.** Each world file in. Assertions: every world but Open Chat has a Custom Persona entity owning its player stats, the loose list is exactly Q19's, Emberwatch's personas each link the five Blueprints, and the code test runs clean for every stat in every world. Prior art: the default worlds and Emberwatch world tests.
- **Probes.** The entity-stats and persona-block stat harnesses gain the new default prompt as an arm, with Rampage and Slime cases for the world-stat recall measure. Both models, in-batch controls, the Q28 bar on owner cells. Numbers go in the spec's Further Notes.
- No test asserts on the raw default prompt string.

## Out of Scope

- An owner flag on world stats. Ownership is expressed by where a stat sits.
- Carrying loose stat values onto a persona when a save loads (Q20).
- The AI reading or editing traits.
- Moving entity stats into narration's cast entries with keyed names. Narration keeps raw names (Q7).
- Rewriting saved custom prompts to the new layout.
- Filters that name a particular stat or compare its value.

## Further Notes

- Reopened on evidence: entity-stats Q37 and Q52, player-character-block Q12. Each carries a note pointing here.
- Rampage is the probe world for world-stat recall because two of its five stats are loose. Slime gives a second case with one.
- Probe numbers: pending.
