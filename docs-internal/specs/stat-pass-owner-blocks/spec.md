# Spec: Stat Pass Owner Blocks

Status: done
Status note: Closed 2026-10-13. Tickets 01–06 done; last landing b2844bd51. Closed without gates.
Spec session: stat-pass-owner-blocks — spec

## Problem Statement

The stat tracker reads the wrong picture of who owns what. The default Stat Updates prompt puts every world stat under a `### Player Character` heading and tells the model a stat "moves only for what that character does, goes through, or feels". In City Rampage that heading holds Destruction and Alert Level, which belong to the city and the military. The rule tells the tracker to leave them alone. Every bundled world except Open Chat has at least one stat like this: Suspicion, Pursuit, Predator Attention.

The tracker also sees no owner's traits. The Traits chip in the stat prompt is world traits only, so a present entity's conditions and a played persona's traits never reach the pass that judges their stat changes. An entity's stats arrive as a bare list under its name.

Worlds authored before entity stats never chose an owner for anything. Their player stats, their world stats and their faction stats are one loose list.

## Solution

The Stat Updates prompt reads the same owner blocks the narrator reads. A `Player Character` block holds the played persona's traits and stats. An In Scene cast block holds each present entity that owns stats, with its traits and its stats. After them, Other Stats and Other Traits hold the loose world stats and traits with no ownership prose. The owner rules apply to the headed blocks only.

The reply keeps the one-object shape with one key per heading: `Player Character`, `Other Stats`, and one per entity. A persona with no stats renders no block and gets no key.

Every bundled world moves its player stats and its player traits onto a Custom Persona entity, created where none exists. World stats such as Destruction stay loose. Emberwatch turns its player stats into Blueprints linked on each of its personas.

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
| Q11 | In the stat pass the Stats chip carries the loose world stats, and under a library persona the Custom Persona entity's stats after them (Q31). Entity sections leave it. A saved custom stat prompt gets entity stats once its author adds an Entities chip. Reverses entity-stats Q52 |
| Q12 | The entity-stats Q28 measures must clear on both models for player and entity cells. A new world-stat recall measure on Rampage and Slime is reported for the user to rule on. Ruled in Q35 |
| Q13 | The default prompt's Persona and Entities chips pick Summary content, Include Traits and Stats, and all three Stat Detail pieces |
| Q14 | The text fallback's style gap is in scope |
| Q15 | Moot. The Chip Options spec closed before this spec was written |
| Q16 | A played persona with no stats renders no block and the schema drops the `Player Character` owner. Other Stats carries whatever is loose |
| Q17 | The text fallback fires whenever a built-in preset is active, rendered in that preset's style. A user preset is sent as written (entity-stats Q34). The equals-default string compare goes away |
| Q18 | A Custom Persona entity owns the moved player stats, so they run under None and under a library persona (entity-stats Q47). Emberwatch makes its player stats Blueprints linked on Wanderer, Albus and Sylvie |
| Q19 | Loose world stats: Destruction and Alert Level (Rampage), Suspicion (Slime), Pursuit (Valentines), Predator Attention (Veilwood). Every other stat moves to the persona, Renown included |
| Q20 | A save of a bundled world from the current release keeps its loose player stats and backfills the persona's at starting values. No migration. The changelog notes it |
| Q21 | Each new Custom Persona entity is named as the world's prose addresses the player: The Creature, and a role name per world listed in the ticket for sign-off. Drone's name is Q36 |

Settled 2026-10-13 during tickets 02 to 06. Spec-session rulings unless marked as the user's.

| # | Ruling |
|---|---|
| Q22 | (user ruling) Bundled worlds move their player traits onto the Custom Persona too, so each world is current with owned traits as well as owned stats. The root trait tree, groups, modes, pick counts, requirements and stat rows move as they are. Open Chat's setting-like traits stay loose. Emberwatch keeps its root: races and classes already live under Blueprints linked on its three personas, and Bonds stays where it is |
| Q23 | (ticket 04) Q22 is what keeps the stat rows alive. A root trait's row on a stat that moved to the persona would go dead (entity-stats Q23). A Custom Persona's own trait rows act on its own stats (entity-stats Q8, Q53; blueprint-only-links Q3), so the traits and the stats move together in ticket 04 as one unit. The Entity type's doc comment that says entity traits carry no stat rows is stale and is corrected in the same ticket |
| Q24 | (ticket 04) A loose stat whose code reads a moved stat reads it through `entities[...]`, the read-only path entity-stats Q9 gives. Rampage's Alert Level reads The Creature's Rampage that way. The code test proves it |
| Q25 | (ticket 04) The Test Bench unknown-stat rule treats a member-qualified `.stats` read (`entities[...].stats`, `persona.stats`) as not a world lookup, so Q24's read passes clean. A bare unknown `stats.X` still fires. Fixed in ticket 04 with a rule test for both cases |
| Q26 | (ticket 02) Stat keys stay unique across `Player Character` and `Other Stats`, world first, so a persona stat that clashes with a loose one keeps its `(2)`, as narration numbers it (entity-stats Q75) and as the text pass needs to read lines by name. Entity stat keys stay unique per entity. Owner keys dedupe across all three kinds: an entity named Other Stats becomes `Other Stats (2)` |
| Q27 | (ticket 02) Between tickets 02 and 03 the text pass keeps its player-side Stats value: persona stats and loose stats together, keyed as Q26. Ticket 03 switches it to world-only when it adds the Persona chip. Moot once ticket 03 landed |
| Q28 | (ticket 02) In the stat pass's keyed scene, In Scene is this turn's confirmed participants, the same list the request takes, stat-less ones included, and each cast entry's name reads as its owner key. Narration's In Scene is untouched. The default prompt heads the block `In Scene` and keeps Player Notes after Other Traits |
| Q29 | (ticket 02) The entity-stats probe is the one stat-pass harness. It gains arm OB, the new default prompt and request with the Sedge player stats on a Custom Persona, against SB, the request as built at the ticket's base, as the in-batch control (S0 stays the harness's prompts-at-ref arm), on both models, Q28 on owner cells. A Rampage and Slime case file in the same harness measures world-stat recall, OB against SB. The persona-block harness probes narration, choices and planning and is not touched; ticket 02's text naming it was wrong |
| Q30 | (ticket 02) The shipped owner rule, "Each stat belongs to the character it sits under. A stat moves only for what that character does, goes through, or feels this turn," satisfies Q2: it names no owner for the loose block, and a loose stat sits under no character. A block-scoped wording cost cloud recall. Ticket 02's three wording swaps (intro naming the two owner blocks, the shipped owner rule, a format line naming the three key kinds) are the default |
| Q31 | (ticket 02) Q26's "world first" is narration's order: loose world stats, then the played persona, then the Custom Persona entity, as the chips number them. Under a library persona that owns Trust beside a Custom Persona that owns Trust, the persona's is `Trust` under Player Character and the Custom Persona's is `Trust (2)` under Other Stats. Agreement with narration's numbering is the rule; the owner a key lands under is not |
| Q32 | (ticket 03) A world's applied Stats prompt counts as a custom prompt on the fallback path. When a world override is in effect, a schema refusal sends the resolved prompt as written (entity-stats Q34); otherwise a built-in preset sends its styled text pair (Q17). The fallback's user message follows the preset in both cases, since worlds do not override it |
| Q33 | (ticket 03, user ruling) The text fallback prompt ships unprobed. It runs only on a schema refusal and mirrors the probed schema prompt's blocks. The ticket's report and the spec record it as unprobed |
| Q35 | (user ruling) Q12 is closed on the numbers in Further Notes. World-stat recall is unchanged by the layout, the Q28 bar cleared, and three Cydonia runs are too few to read the invented-move rise |
| Q36 | (user ruling; replaces Q21 for Drone) Drone's Custom Persona is named by a placeholder rolled once per playthrough from twelve designations: C1PH3R, Z3PHYR, T1T4N, Axiom-0, R0GU3, PR1SM and six droid-style codes. The names stay as they are. Their rendering by TTS and the narrator was not probed |
| Q37 | (user ruling) No trait migration for saves, as Q20 for stats. On a current-release save of a bundled world, the old picks stay in the save as root traits that nothing reads: no AI context, no stat rows, no Traits tab row. Player Can Toggle traits can be picked fresh on the persona; creation picks cannot. The orphan stats lose their trait bonuses at the next settling switch. The changelog save note covers it |
| Q34 | (ticket 06) The changelog keeps two entries, both 👤 User-facing under the Entity Stats group. The owner-blocks entry moves there from 🛠️: the spec's 🛠️ call was wrong, since the stat panel, the bundled worlds and the double-Health save note are all player-visible. The fallback entry stays and drops its unprobed sentence; Q33 records unprobed in the ticket report and the spec only |

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
17. As a player of a bundled world, I want my persona's stats on my persona, so that the stat panel and the prompts agree about who owns them.
18. As a player of Emberwatch, I want Health, Mana, Faith, Gold and Renown whether I play Albus, Sylvie or the Wanderer, so that no persona starts without a body.
19. As a player with a save from the current release, I want to know why a bundled world shows a second Health after the update, so that I can start a new game on purpose.
20. As a help reader, I want the Guide to describe the stat prompt's blocks, so that the help window can answer how the tracker sees owners.
21. As a developer, I want probe numbers for the new layout on both models, so that the change ships on evidence.
22. As a developer, I want a world-stat recall number, so that the user can rule on whether the tracker now moves city stats.

## Implementation Decisions

- **The request has three owner kinds.** The stat request snapshot separates the played persona's stats, the loose world stats and each present entity's stats. Each kind has its own owner key: `Player Character`, `Other Stats`, one per entity. Key dedupe runs over all three. The schema emits one required object per owner that has stats, so a persona with no stats produces no `Player Character` object. The reply reader maps each owner key back as it does today. Under a library persona, the Custom Persona entity's stats sit under Other Stats with their keys, as player-character-block Q17 places them.
- **Renaming before rendering.** The stat pass hands the chip scene a renamed view of every owner's stats, each named by its request key, before any chip value renders. This extends what the world and played stats already do to entity-owned stats. Narration's scene is untouched and keeps raw names. The lazy values source the Chip Options spec built is the point where the stat pass substitutes its scene.
- **The Stats chip in the stat pass.** It carries the loose world stats, then any other played entity's stats, which under a library persona are the Custom Persona entity's (Q31). The entity sections it appended since entity-stats Q52 go away. The text pass reads the same value.
- **The default prompt.** The built-in Stat Updates prompt opens with the Persona chip headed `Player Character`, then the Entities chip in the In Scene scope, both with Only With Stats, Summary content, Include Traits and Stats, and Range, Descriptor and Description. Then the Stats chip headed Other Stats and the Traits chip headed Other Traits. The prose keeps the owner rule for headed blocks and says nothing about who owns a loose stat. The format section names the three key kinds. The three-part framing from entity-stats Q76 stays as it shipped.
- **The text prompt.** The text fallback prompt takes the Persona chip with the same picks, then Other Stats and Other Traits. Its reply stays stat-change lines over the player's and the world's stats. Entity owners are skipped with a diagnostic as today.
- **Fallback selection.** The pass asks the settings layer whether the active preset is a built-in. When it is, the text pair is the built-in text prompt rendered through that preset's style. When a user preset is active, the stat prompt is sent as written on the fallback path too. The string compare against the raw default is removed. A world's applied Stats prompt counts as custom: its resolved text is sent as written, and the user message still follows the preset (Q32).
- **Bundled worlds.** Six worlds gain a Custom Persona entity that owns the player stats listed in Q19's complement and the world's player traits and trait groups, moved as they are (Q22). The entity's name follows Q21 and Q36; its description is one line in the world's voice. A loose stat whose code reads a moved stat reads it through the entities path (Q24). Stat code that reads a sibling stat keeps working because an owned stat's code reads its owner's stats as `stats` (entity-stats Q29); each moved world's code is run through the code test. Emberwatch's five player stats become Blueprints and each persona links all five. Open Chat has no stats and does not change. Bundled fingerprints update with the files.
- **Saves.** No migration for stats (Q20) or traits (Q37). On load, the persona's stats backfill at starting values and the old loose stats are kept, as entity-stats Q40 rules. The old trait picks stay in the save but no longer apply. The changelog entry says a save of a bundled world from an older version shows both stat sets and loses its trait picks until a new game.
- **Settings preview and sample scene.** The sample scene's Traveler already owns one stat and one trait, so the stat prompt's Persona block renders in the Settings preview. The sample gains one present entity that owns a stat so the In Scene block renders there too.
- **Docs.** The Guide pages on the stat tracker and on prompt chips describe the three blocks and the three reply keys, and tell a custom-prompt author how to add the Entities chip. CONTEXT.md's stat request entry names the three owner kinds. Two changelog entries under Minor, Added, 👤, in the Entity Stats group: the owner-blocks entry with the save note folded in, and the fallback entry (Q34).
- **Export shape.** Unchanged. The world and save envelopes gain no field. Bundled world files change content only.

## Testing Decisions

A good test puts data in at a seam and reads text or a request out. It never asserts on an intermediate structure the prompt does not see.

- **The stat request snapshot.** Stats, personas and entities in; targets, keys, schema and chip values out. Cases: a persona with stats, a persona with none, loose stats only, two entities whose stat names clash with the persona's, an entity named `Other Stats`. Prior art: the stat request owners tests.
- **Chip values over a scene.** The stat pass's renamed scene and each default token in; rendered text out. Cases: keyed entity stats inside a Summary cast entry with every Stat Detail piece, Only With Stats dropping a stat-less entity, the Persona miss rendering the bare placeholder, narration's scene still showing raw names. Prior art: the chip values and persona stats tests.
- **The stat pass request builder.** Prompt and material in; request bodies out. Cases: the default prompt's system prompt holds the four blocks in order, a user preset is sent as written, each built-in style picks its own text pair, and the byte-equal parity run over recorded history for the requests this spec leaves unchanged. The stat pass's own parity compares the shared tail, since the recorded run predates owner blocks. Prior art: the turn passes tests and the parity suite.
- **Bundled world data.** Each world file in. Assertions: every world but Open Chat has a Custom Persona entity owning its player stats, the loose list is exactly Q19's, Emberwatch's personas each link the five Blueprints, a persona trait's row on a loose stat still moves it (Q22), Alert Level's entities read works (Q24), and the code test runs clean for every stat in every world. The Test Bench rule test covers a qualified stats read and a bare unknown one (Q25). Prior art: the default worlds and Emberwatch world tests.
- **Probes.** The entity-stats harness gains arm OB against SB (Q29), with a Rampage and Slime case file for the world-stat recall measure. Both models, in-batch controls, the Q28 bar on owner cells. Numbers go in the spec's Further Notes.
- No test asserts on the raw default prompt string.

## Out of Scope

- An owner flag on world stats. Ownership is expressed by where a stat sits.
- Carrying loose stat values onto a persona when a save loads (Q20).
- The AI editing traits.
- Moving entity stats into narration's cast entries with keyed names. Narration keeps raw names (Q7).
- Rewriting saved custom prompts to the new layout.
- Filters that name a particular stat or compare its value.

## Further Notes

- Reopened on evidence: entity-stats Q34, Q37 and Q68, player-character-block Q10 and Q12; entity-stats Q52 reversed by Q11. Each carries a note pointing here.
- Done in ticket 04: the Entity type's stale doc comment on owned trait stat rows (Q23) and the Test Bench unknown-stat rule (Q25).
- Rampage is the probe world for world-stat recall because two of its five stats are loose. Slime gives a second case with one.
- Probe numbers (ticket 02, entity-stats probe; SB = the request as built at base 633c60570, OB = the new default prompt and request with player stats on a Custom Persona, C3 = the entity-stats reference). The first OB wording missed cloud recall (56–59% vs C3 67–69%, entity cells at 0); three wording swaps fixed it and are the shipped default (Q30).
  - Q28 owner cells on Sedge, exact / recall / wrong signs / invented. Cloud ×8: OB 57% / 70% / 0 / 28 · C3 52% / 69% / 0 / 48 · SB 51% / 75% / 0 / 46. Cydonia ×3: OB 57% / 100% / 0 / 37 · C3 56% / 100% / 0 / 40 · SB 32% / 100% / 0 / 58. Clears vs C3 on both.
  - World-stat recall, loose cells (Q12, closed by Q35). Rampage cloud ×8: OB 24/24 · SB 24/24, 0 wrong signs, 0 invented; overall exact OB 78% vs SB 60%. Rampage Cydonia ×3: OB 9/9 · SB 9/9; invented world moves OB 3 vs SB 1. Slime cloud ×8: OB 16/24 · SB 16/24, both missing the slime-cover lowering case. Slime Cydonia ×3: OB 9/9 · SB 9/9, 0 invented.
  - Reading: the base request did not suppress loose stats in the probe, so the change is carried by attribution and traits, not by world-stat recall. Rampage overall exact improved; Cydonia invented world moves rose by 2 over 3 runs.
