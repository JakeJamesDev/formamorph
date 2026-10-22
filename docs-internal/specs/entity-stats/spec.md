# Entity Stats

Status: done
Status note: 2026-10-11. Tickets 01–25 are done and 26 is wontfix. Last landing is 1db1d488. Closed without gates. Release blocker 03 (Cydonia) stays open. Persona stat placement in prompts moves to a new effort.
Spec session: entity-stats — spec

## Problem Statement

An author can give an entity its own traits, but not its own stats. Only the player has stats. An author who wants Bram's trust, Odette's stock of eels or an ally's health has to fake it with a player stat named "Bram's Trust", or with notes the AI may forget. The stat pass reads only the player's stats, so the AI never records how a turn moved anyone else.

Owned traits already promise more. The trait-gates spec says that once entities own stats, an owned trait's stat effects target its owner's stats. Stat code reserves `entities[x].stats` for the same day. Neither has anything to point at yet.

## Solution

Entities own stats. An owned stat is a stat: it has every field and behavior a world stat has, with nothing left out. Stats work the way traits already do:

- The Stats tab gets a **Blueprints** group. An entity can **Link** a stat Blueprint, a Link can override any field except the name, and **Detach** makes it the entity's own stat.
- Stats get author-made groups, on the Stats tab and inside each entity, for organization.
- The entity panel gets a **Stats** tab that mirrors the Stats tab for that entity (Advanced only).
- In game, the stat panel shows the player's stats and, below them, the selected entity's stats. A dropdown at the top picks that entity.

Each turn, one stat request covers the player and every present entity that owns stats. It is a JSON-schema request with a fixed object: every owner, every stat, 0 for no change. A probe chose this shape ("C3") over one call per entity, text lines and a two-step gate. It was the only shape with no wrong signs on both test models, and it beat today's pass on the player's own stats.

Trait groups and stat groups both gain a toggle that lets the AI see the group's heading. It is on by default.

## Rulings

Rulings from the grill, numbered as asked.

- **Q1** Only authored entities own stats. Characters the narrator invents during play have none.
- **Q2** The stat request covers the entities present this turn: the participants the narration confirmed.
- **Q3** One request covers the player and the present entities. Today's player-only text pass is replaced, player-only turns included.
- **Q4** When an endpoint rejects the JSON schema, the turn falls back to today's player-only text pass, skips entity stats, and records a diagnostic.
- **Q5** The player sees an entity's stats in game. Each stat keeps its own hidden flag.
- **Q6** Authors share one stat across many entities through Links, as with traits.
- **Q7** An owned stat is the same thing as a world stat. No field or behavior is left out: type, bounds, starting value, regen, descriptors, threshold unit, before and after code, morph bindings, enabled, hidden, and the no-increase and no-decrease locks.
- **Q8** An entity's own traits, and the trait Links it bears, change its own stats (min, max, starting, regen, toggles), through the same derive step the player uses.
- **Q9** Stat code reads every entity's stats through `entities[x].stats`, read only.
- **Q10** The schema has a max-change slot per stat, for the player and for entities. A probe round confirms it adds no invented max changes.
- **Q11** A played persona's owned stats become the player's stats while it is played, as its owned traits become the player's traits.
- **Q12** Authors edit an entity's stats on a Stats tab in the entity panel. It mirrors the Stats tab: the shared list toolbar, search, a **+** menu with **Add Stat** and **Link Stat**.
- **Q13** The in-game stat panel shows the player's stats on top and the selected entity's stats below (Q13a). A dropdown at the top of the panel syncs both ways with the entity view's selection (Q13b). It also lists entities that aren't present, and (None), which hides the section. An entity whose name is not yet revealed is listed by its player description (Q13c).
- **Q14** Entity stats reach the narration, choices and planner prompts through a stats piece on the Entities chip, on by default.
- **Q15** Regen and stat code run every turn for every entity in the playthrough, present or not. Only the AI request is limited to present entities.
- **Q16** A played persona's stat and a world player stat with the same name stay two stats, as a persona trait and a world trait do. Each sits under its own owner.
- **Q17** Stat Blueprints live in a Blueprints group on the Stats tab. A Blueprint stat is not a player stat; it exists to be linked or copied.
- **Q18** A stat Link overrides any field except the name, each field with its own Reset. The name always follows the Blueprint. An owner holds at most one Link per Blueprint.
- **Q19** An author can Link or Copy a stat Blueprint onto an entity.
- **Q20** Library characters (character cards) own stats and bring them into any world.
- **Q21** Stats get full author-made groups, with nesting and reorder, on the Stats tab and inside each entity.
- **Q22** The entity Stats tab is Advanced only.
- **Q23** A trait's stat change on a stat its bearer doesn't own has no effect. The World Editor flags it.
- **Q24** A custom Stat Updates prompt stays as the player wrote it. The schema applies to it all the same.
- **Q25** The in-game stat panel shows groups as collapsible headings. A group with no visible stat doesn't show.
- **Q26** Stat groups reach the AI: stats chips and the stat request nest stats under group headings, as the Traits chip nests traits.
- **Q27** Stat groups are for organization only: name, description, order and nesting. No modes, pick counts or gates.
- **Q28** Every prompt change in this effort clears one probe bar on the cloud default model and on Cydonia: exact and recall stay within 5 points of the C3 numbers, wrong signs stay at 0, and invented changes don't rise.
- **Q29** An entity stat's own code reads its owner's stats as `stats`.
- **Q30** The probe drops its `odette-catch` case.
- **Q31** Trait groups and stat groups both gain the AI-visibility toggle in this effort.
- **Q32** With the toggle off, the AI loses only the group's heading and description. Its members still reach the AI as if ungrouped. A nested group keeps its own heading and moves up one level.

- **Q33** (ticket 01) Ticket 01 adds only the owner-keyed seam: an owner → stats map whose player owner reads and writes today's player stats, owner ids on request targets and resolved updates, regen and apply per owner, and a stat-code turn that names its owner. It adds no gameplay-state or save field for entity values; ticket 04 owns those, and `entities[x].stats` and entity-stat code.

- **Q34** (ticket 02) Today's text-line default Stat Updates prompts stay as an internal fallback pair. On the fallback path, a player whose prompts match the shipped default gets that legacy pair; a custom prompt is sent as written on both paths. *Replaced 2026-10-13 by the Stat Pass Owner Blocks spec (Q17, Q32): the fallback follows the active preset and a world override, not a string compare.*
- **Q35** (ticket 02) Schema support is a question on the per-endpoint capability record that already answers `tools` (ADR-0008): untried sends the schema, rejected uses the text pass. A 400 or 422 on the schema request retries once in the same turn on the text pass, and only a successful retry stores the rejection.
- **Q36** (ticket 02) The schema keeps C3's flat shape. Under each owner, a stat's key holds its bare signed change, and a "<key> max" key beside it holds its max change. All keys are required and bounded, 0 meaning no change. Key dedupe reserves both keys, so a real stat named "X max" gets a numbered key. A per-stat `{ change, max }` object was rejected: on the cloud model it wrote the size of a change instead of its signed value (6 wrong signs vs 0). Cloud, player cells: exact 87%, recall 78%, 0 wrong signs, 5 invented changes, 0 invented max changes.
- **Q37** (ticket 02) The player-only request already uses C3's per-owner sections: a Stats section with one owner heading for the player character, as the probe measured. Ticket 05 adds owners to the same structure. *Reopened 2026-10-13 by the Stat Pass Owner Blocks spec: the player section splits into a `Player Character` owner and an `Other Stats` owner.*

- **Q38** (ticket 04) A new game seeds every authored entity stat at its starting value, enabled or not, as the player's stats are seeded. A switched-off stat keeps its value, gets no regen or code, and reads in `entities[x].stats` as a real entry with `enabled: false`.
- **Q39** (ticket 04) Every authored world entity that owns stats is seeded at a new game. Regen and code run each turn for every authored entity in the playthrough, present or not (Q15), and for the played world persona. Until ticket 13, the persona's stats run as that entity's stats. Discovered characters never own stats; library characters wait for ticket 14.
- **Q40** (ticket 04) On load, entity stats backfill per owner as the player's do: a missing stat is added at its starting value, and a stat the world removed is kept. Owners no longer in the playthrough are pruned.
- **Q41** (ticket 04) `entities[x].stats` is keyed by code name, and each entry has the same shape as an entry in `stats`, change fields included, all read only. A write is dropped and reported with the other read-only writes. Every owner's code reads one snapshot, taken after asks and regen and before any code.
- **Q42** (ticket 04) Code for every owner runs over that one snapshot. Writes and trait switches then apply in owner order: the player first, then entities in authored order, and the later write wins. In an entity stat's code, only `stats` is the owner's; `traits` stays the player's world traits, and the owner's traits are under `entities[x].traits`.
- **Q43** (ticket 04) Entity-stat morph bindings move to ticket 16, which adds morphs to entity models and lists each entity model's own shape keys in the Body Sliders picker. A binding without a picker can't be authored, so both land together.

- **Q44** (ticket 02) A schema rejection that names a different parameter (a sampler or `max_tokens`) goes to the existing override path, not the text-pass retry. A rejection with no parameter, or one that names `response_format`, `json_schema` or a `guided*` field, retries as Q35 says. In the stat request, a stat whose plain name collides shows its numbered schema key, so the name the model reads is the key it writes.

- **Q45** (ticket 02, user ruling) Ticket 02 lands with a Cydonia miss on one Q28 measure: invented player changes, 81 against C3's 68 (cloud clears). Most of the gap comes from the player being alone in the request. Ticket 05 re-checks the full Q28 bar on Cydonia with entities back in the request, and a miss there blocks the release.

- **Q46** (ticket 04) The editor surfaces for `entities[x].stats` ship with the runtime in ticket 04: completion and the Variable menu list each entity's `stats` with the fields a `stats` entry offers; the Test Code button seeds entity stats at their starting values; the Stat Code Guide documents `stats` on `entities` and `persona` (read only, same entry shape) and that an entity stat's own code reads its owner's stats as `stats`.

- **Q47** (ticket 04) Entity stats run for the same owners that stat code's `entities` holds, including the entity whose traits are the player's. Under None or a library persona, that is the Custom Persona entity, so its stats keep running, as its traits apply. Stats follow the trait rule; ticket 13 moves a played persona's stats to the player.

- **Q48** (ticket 06, Q13c refined by the user) An unrevealed entity in the stat panel's dropdown shows the scene's alias, as the Entities tab does, or Unknown when the scene gave none. It never shows the name or the player description. An absent entity shows its name only if some turn has revealed it. Two equal labels get a count suffix.
- **Q49** (ticket 06) The shared selection is no pick, an entity id, or (None). With no pick, both places use the entity view's fallback entity. (None) hides the stat section, and the entity view keeps its fallback. The dropdown lists every present entity (one without visible stats shows an empty-state line), then absent authored entities that own stats, then (None). The played persona is listed as "<name> (You)"; once ticket 13 lands, picking it shows no entity section, since its stats sit with the player's. On a past page the section reads that turn's snapshot.
- **Q50** (ticket 06) Change deltas on entity stat rows belong to ticket 05, which applies the AI's entity updates.
- **Q51** (ticket 07) The Entities chip's stats piece is a toggle, on by default. Stats render under each entity in the Here and In Scene scopes, in Full and Summary content, never in Name. The Sub and Reachable scopes stay as they are.

- **Q52** (ticket 05) In the stat request only, the Stats chip's value carries each present entity's section after the player's block. Each section has an owner heading and that entity's stats, so the default prompt text stays as ticket 02 left it, and a custom prompt gets the same owners its schema names. The owner heading and key are the entity's authored name with placeholders resolved, and a clash gets a numbered key. The pass runs when any owner in the request has a live stat. The played persona stays out of the request until ticket 13. On the fallback path, each skipped present entity gets its own diagnostic. The turn's stored `stat_changes` stay player-only. Entity changes are stored per owner and stat id, for the panel's deltas (Q50) and past pages. *Reversed 2026-10-13 by the Stat Pass Owner Blocks spec (its Q11): entity sections leave the Stats chip; the stat prompt reads the Entities chip.*

- **Q53** (ticket 08) Q23 applies to cast bearers. A player bearer keeps the shipped rule (a played persona, or the Custom Persona entity under None or a library persona): its trait change targets its own stat when the id is one of its own, and otherwise the world player stat while it is played. Only an id that matches neither is flagged. The trait stat pickers list the bearer's own stats, plus the world player stats on a player bearer. A starting-value change on an entity's stat behaves as the player's does, with a per-owner applied-values record in the save. The flag is a Test Bench Issues rule at warning severity. Editor limits that existed only because entities couldn't own stat traits are removed.

- **Q54** (ticket 06) The dropdown and the entity section render only when a listed entity has a stat the player can see. The Stats tab opens when only an entity has visible stats. An absent entity is listed only if it owns a visible stat. A new game resets the shared pick, as a loaded save does.

- **Q55** (ticket 08, user ruling) In Emberwatch, Mother Hesk and Corvin Vale get their own stats that match the stats their linked class and race traits change (Health and Faith; Renown and Mana). The traits then move the NPCs' own stats, and the world runs clean under the no-target rule.
- **Q56** (ticket 05, user ruling) Ticket 05 lands its request mechanics with two Q28 misses on record. On the cloud model, recall is 59% against C3's 69–70%: the max keys leave social Trust shifts at 0. On Cydonia, invented player changes are 73 against C3's 68. The Q45 release blocker stays open and moves to ticket 17, a prompt ticket with its own probe A/B.

- **Q57** (ticket 05, user ruling) Ticket 05 lands entity-row deltas that hold for the whole turn. Ticket 18 brings the player's timing to entity rows (the chip fades after 10 s, the band drains at submit) through one per-owner delta piece shared by player and entity rows.
- **Q58** (ticket 08) Q55 is built now. The new Emberwatch stats get fresh descriptor ids, and the in-game Traits tab reads each bearer's trait stat changes against that bearer's own stats. Ticket 13 takes the hazards of a persona that owns a stat with a world stat's id: a doubled picker item, an own-first rule that can't reach the world stat, and false notes.

- **Q59** (ticket 10) A stat group shows its heading when its subtree holds any stat, as the in-game panel does, and its subgroups nest under it. A group whose subtree holds no stat is left out. Loose stats come first, then groups in authored order, so a world with no groups renders byte for byte as before.
- **Q60** (ticket 10, user ruling) Ticket 10's probe bar is relative: the grouped request against the shipped flat request in the same batch, on both models. Exact and recall stay within 5 points, wrong signs stay at 0, and invented changes don't rise. C3 runs in the batch for the record. Ticket 17 keeps the absolute Q28 bar.

- **Q61** (ticket 12) A stat Link points at one Blueprint stat. **Link Stat** and **Copy Stat** in the entity Stats tab's **+** menu (Advanced) drill into the Blueprints tree, and a Blueprint already linked on that entity can't be picked again. The Blueprints group's lifecycle mirrors traits: **Add Blueprints Group** (at most one), deleting a linked Blueprint deletes its Links after a confirm, and deleting the group turns each Link into its entity's own stat. Inside each owner, a linked stat runs under its Blueprint's id, so a trait change that names the Blueprint lands on each bearer's linked stat; a Copy gets a fresh id. A Link overrides every field except id, name, group and order. Descriptors, before code and after code are one field each, with Reset and a stale mark. A Copy is a detached stat at the end of the entity's top level, and its name is then the entity's to edit. In the user's ruling, group Links, **Link To…** on the Blueprint and **Detach** on a Link go to ticket 19.
- **Q62** (ticket 16) Stat morphs drive the entity's model everywhere in play: the entity view, its model dialog, and the entity card. Editor previews and the Authoring Tour stay unmorphed. On an entity with no model or no shape keys, the Body Sliders field stays, with an empty list and an empty-state line, so an existing binding can still be removed. A switched-off entity stat drives no morph. The picker lists the union of shape keys across the model's meshes.
- **Q63** (ticket 18) A full load clears every owner's deltas, the player's included; rollback and regenerate keep theirs. This fixes an in-game Load that kept last turn's player deltas. On a turn with no stat response, entity rows behave exactly as the player's rows do.

- **Q64** (ticket 10, user ruling) Ticket 10 lands the grouped request (nested as the Traits chip nests traits) with a Q60 miss on record on the cloud model. Over 3 batches of 21 cases × 6 runs, flat against grouped: exact 50.5% vs 47.4%, recall 57.8% vs 59.3%, wrong signs 3 vs 0, invented changes 19 vs 54. The whole rise is one case, `push-bram`, where a Mind or Body heading over Resolve and Vigor leads the model to dock them by 1–2. Other heading shapes didn't fix it. Ticket 17's work on invented player changes re-checks it with groups in the request, and ticket 10's commit body carries the Cydonia numbers.

- **Q65** (ticket 12, user ruling) Stats have no Copy. In the glossary, a Copy reads its Blueprint live, and traits make an owned version with **Detach** on a Link, so stats do the same: **Link Stat**, then **Detach** (ticket 19). Ticket 12 removes its Copy Stat action. The glossary's Blueprint, Link and Original entries now cover stats. This replaces Q19 and the Copy parts of Q61.

- **Q66** (ticket 17, user ruling, confirmed in this session) Ticket 17 lands wording WL with misses on record. WL adds two lines: "Each stat belongs to the character it sits under. A stat moves only for what that character does, goes through, or feels this turn." in the system prompt, and "A clear shift in how a character regards the player moves that character's own stat." in the user line. The cloud model clears Q28 (exact 59% vs C3 52%, recall 75% vs 70%, 0 wrong signs). Cydonia misses: exact 30% against ticket 05's 47% and C3's 50%, and invented changes 122 against 98 and 86 (player 82). Q64 also misses: with groups, `push-bram` still invents 12 player changes on the cloud model. Across 13 wordings, every line that lifted cloud recall raised Cydonia's invented changes. Cydonia's main error is draining the player's Vigor on most turns, in today's pass and in C3 as well. The Q45 blocker stays open on the release-blockers list (item 03).

- **Q67** (ticket 14) Ticket 14 makes every library entity a stat owner by id at every site: seed, regen and code, the request when present, the panel, chips, and backfill on load. Its stat Links resolve against the world's Blueprints. A library persona is seeded and kept as a world persona is. Ticket 13 owns the persona-to-player join for both world and library personas, and ticket 14 only guarantees seeded values under the persona's id. The card carries `stats`, `statLinks` and `statGroups`, and its stat Links bind to the world's Blueprints as a card's trait Links do. A Link that can't bind stays dormant and brings nothing.

- **Q68** (ticket 13) A trait stat change and a stat toggle gain an optional `target: 'player'`. The picker's Player list writes it and the own list clears it, so a persona's trait can reach a world stat that shares its own stat's id. Without the field, Q53's own-first rule holds. In the panel, the persona's stats sit in the player's part after the world stats, under a small heading with the persona's name and laid out by its own groups. They are read-only, as entity rows are, and the panel's Edit mode moves world stats only. In the request, persona stats sit in the Player Character section after the world stats, keys dedupe across both lists, and each change lands on its own owner's stat. The text-pass fallback covers persona stats as player stats. Stored `stat_changes` stay world-only, and persona changes go to the per-owner changes. Stat code is unchanged: `stats` is the world's, and the persona's own stats are under `persona.stats`. Values stay keyed by entity id, so switching persona and back keeps them. *Reopened 2026-10-13 by the Stat Pass Owner Blocks spec (Q16, Q26, Q31): persona stats sit under their own `Player Character` owner, loose stats under `Other Stats`.* *Reopened 2026-10-18: Edit mode also moves entity and persona rows, live turn only, and an edit does not count as the turn's change.*

- **Q69** (ticket 19) Trait Link behavior wins where the ticket text differs. Detach runs at once with no confirm, and undo covers it. A whole stat group is linked only through **Link To…** on a Blueprint group, as trait groups are; the entity **+** menu gets no new pattern. Detaching a group Link gives its groups fresh ids, while its stats keep the Blueprint's ids. Migration nests extra Blueprints stat groups under the first one. It also drops a second Link to the same Original on one owner, folding its Overrides into fields the first doesn't override. A group Link plus a Link to a stat inside it count as duplicates: the group wins and the stat Link's Overrides fold in.

- **Q70** (ticket 13) Stats follow the trait rule (Q47). Under a library persona, the Custom Persona entity is a Bearer "You" whose traits apply to the player, so its stats join the player's beside the library persona's. Each sits under its own heading in the panel and keeps its own keys in the request. No owner's stats run unseen.

- **Q71** (ticket 11) Byte-identical request bodies at the toggle's default satisfy ticket 11's probe criterion, with the dump result in the commit body. A second dump also shows that the SG fixture with every group hidden renders byte for byte as the flat request S. That ties the toggle-off shape to arms already measured, so no live run is needed.

- **Q72** (ticket 13) Ticket 13 lands without the joined owners' stats in the Stats chip outside the stat request. Today the narration, choices and planner prompts don't see the played persona's stats anywhere, which Q11's "they become player stats" doesn't intend. Ticket 20 adds them, with a probe.

- **Q73** (ticket 19, user ruling) After Detach, the entity owns a stat under the Blueprint's id, so Link Stat and **Link To…** refuse to link that Blueprint again, or any group that holds it. Ticket 19 lands the refusal without a reason shown. Ticket 21 adds a reason to every refused Link row, for traits and stats alike, after the user approves the pattern.

- **Q74** (ticket 14) Q40's backfill on load covers the library persona, a live library read. Ticket 13 builds that next to its persona join. Added library characters are snapshots seeded at Enter World and need none. A card with no stats reads as an entity with none, with absent fields and no seeded defaults, as with traits. The library entity editor gains a Stats tab (ticket 22) so authors can give a library character stats there, as they give it traits.

- **Q75** (ticket 20) The authored chip scene (editor previews, the Settings preview, probe fixtures) lists the Custom Persona entity's stats after the world stats, as its Traits chip already does under the None rule. In narration, choices and planning, the Stats chip lists world stats, then each played owner's stats in its own groups, with no owner heading, as the stat request joins them. A name clash is numbered there as in the stat request, so every prompt names a stat the same way. This widens Q44, which kept numbered names to the stat request before persona stats could collide with world stats.
  - Reversed for narration, choices and planning by the [Player Character Block spec](../player-character-block/spec.md) (Q4, Q5, Q9): the persona's own stats now nest in its block, numbered keys kept, and the Stats chip holds the rest.

- **Q76** (user ruling) Ticket 23 tries framing the stat request with three parts: what a stat is, how owner headings and groups lay out the list, and what stats in general can do to the story. The framing goes in the built-in Stat Updates prompt only; other prompts and custom prompts don't get it. Its bar is report only: the probe numbers on both models go to the user, who rules whether a wording ships.

- **Q77** (ticket 23) Ticket 23 builds and runs its wording arms, reports, and pauses before prepare. The wording the user picks goes into the default Stat Updates system prompt and lands; if the user picks none, only the probe arms land. The text-pass fallback prompt gets no framing. The group sentence is conditional phrasing in the one static prompt by default. One arm renders the group sentence only when the request has groups, so the report can compare the two.

- **Q78** (ticket 23, user ruling) Wording FB ships in the default Stat Updates system prompt. The role paragraph gains: "Each stat is a number that tracks one thing about one character, and it changes only when the story changes it. The narrator reads the stats each turn to decide what the characters can do and how they act." The Stats intro opens: "Each character's stats sit under their name, a ### heading, and belong to that character. When a character's stats sit in groups, a group bullet names what the stats nested under it share. A group holds no reading of its own; you record changes on its stats." Results in exact / recall / invented player changes, with no wrong signs and no invented max changes anywhere:

  | Model | Arm | Shipped before | FB |
  |---|---|---|---|
  | Cloud, 21 × 6 | grouped | 46–52 / 71–72 / 39–43 | 60 / 74–75 / 22–23 |
  | Cloud, 21 × 6 | flat | 57–58 / 73–75 / 22–29 | 51–55 / 75–77 / 32–34 |
  | Cydonia, 21 × 3 | grouped | 43–44 exact / 49–50 invented | 54–57 exact / 37–39 invented |
  | Cydonia, 21 × 3 | flat | 29–32 exact / 63–64 invented | 37 exact / 55–56 invented |

  Q64 is still not met: `push-bram` invents 12 player changes on the cloud model and 6 on Cydonia with groups. Placing "holds no reading" beside the framing stopped it, but lost Bram's Trust in two cases. The conditional and code-rendered group sentences were within noise of each other on both models.

- **Q79** (user ruling) The Stats tab's tree matches the Traits tab's for owned stats. An entity that owns a stat, a stat group or a stat Link shows as an entity node, and the author places it in their own stat groups. Stats and stat groups drag across owners with their ids kept, and a Blueprint stat dropped on an entity node links it. Ticket 24.
- **Q80** (ticket 24) A cross-owner stat move is refused, with a note in the trait form, when it would break a reference. A group drag is refused when anything inside it is refused, and the note names the first hit.
  - **Trait rows:** a trait row reaches the stat on its current owner, as play routes it (world traits on the player, an entity's own and linked traits, Link overrides included).
  - **Stat code:** code that stays reads a moved stat on its old owner (`stats.X`, `entities.Owner.stats.X`, `persona.stats.X` for a playable owner), or a moved stat's own code reads a stat that stays. Only exact name lookups count, as in the rename scanner.
  - **Id clash:** the destination already holds the id, own or through a Link (Detach, Q73).
  - **Links:** a stat Link, or a group that holds one, moves between entities only, and is refused where **Link Stat** refuses.
  - **Blueprints:** a linked Blueprint can't leave Blueprints, now with the note. A Blueprint dropped on an entity node links it (Advanced only) and never becomes an own stat.
  - The Custom Persona node stays at top level.
  - Morph bindings and descriptor placeholder pins travel and don't refuse a move.
  - Placement is a new optional `Entity.statPlacement`, apart from `traitPlacement`. In Simple mode, nodes show and existing items drag, as on the **Traits** tab.
- **Q81** (user ruling, gap from ticket 24) A drag of a world stat or trait into Blueprints is refused while something outside Blueprints reads it, with a note that names the reader, as placeholders do (Blueprints Q54). For stats the readers are Q80's trait rows and stat code. For traits they are other traits' requirements and anything else that names the trait. A group drag is refused when anything inside it is read. Traits had no such check before. Ticket 25.
- **Q82** (ticket 25) The trait readers for Q81 are:
  - requirement conditions on the trait or group, in world traits outside Blueprints, entity-owned traits and trait Link overrides;
  - stat code outside stat Blueprints that reads it through `traits.<Name>` or `persona.traits.<Name>`.

  These are not readers: anything inside Blueprints or moving in with the item, the item's own requirements, `traits.X.group` compared as a value, Test Bench picks and save data. A drag of an entity-owned trait into Blueprints runs the same check, as an entity stat already does under Q80.
- **Q83** (ticket 25 review) Three readings that follow from Q80 and Q82:
  - `entities.<owner>.traits.<Name>` in stat code reads an entity-owned trait.
  - A stat Blueprint's code counts where an entity links it, with that Link's code overrides. An unlinked Blueprint's code never counts.
  - A moving stat's own code never blocks its move into Blueprints.

  Known over-refusal, left as is: a world or linked trait that stays and shares a name with the entity trait doesn't clear the code refusal, so the check can refuse a drag that breaks nothing.
- **Q84** (user ruling, from ticket 23; replaces Q78) The default Stat Updates prompt becomes a lean prompt: a role line, each owner's stats under its heading, and format lines. Ticket 26 builds it. Ticket 23 stays as landed. Evidence: probe arms in `eec488c6`. On the cloud model, lean arm L scored 64–67% exact against 53% for S and 59–60% for SG, with 1–4 invented player cells against 20–32. On 12 held-out scenes, L scored 56% against 42%. On Cydonia, L scored 46%, behind SG at 54%. The agent wrote all gold, including the held-out set.
  - Lean keeps the world description, traits and notes chips.
  - Lean renders groups as the app does. The ticket probes lean flat against grouped.
  - **Ship bar:** lean, built through the app's own builder, beats S and SG on exact and on invented changes, on the cloud model and Cydonia, on the tuning and held-out sets. On a miss, the ticket stops and reports, and nothing ships.
  - Lean keeps the `<stat> max` keys and a format line for them. A probe arm measures their cost.
  - User presets keep their frozen copy of the old prompt. The changelog tells players to reset for the new default. No migration.
  - The schema-less text prompt stays unchanged.
  - The ticket probes lean with and without a regard line after the narration. If both pass the bar, lean ships without it.
- **Q85** (ticket 26) Q84's bar, read closely:
  - Lean flat and lean grouped both ship, since lean renders whatever groups the world has. Each must beat both S and SG.
  - The tuning set is the 21 Sedge cases on the sedge sheet. The held-out set is the 12 held-out cases. The familiar sheet is outside the bar and serves only the cap check, once on cloud.
  - The arm without `max` keys only measures their cost. The regard arm decides only whether the regard line ships. Neither is in the bar.
  - Layout: the role line, then Game World, Traits and Player Notes, then a `## Stats` section that holds each owner's `###` block, then the format lines.
- **Q86** (ticket 26 result) Lean missed Q84's bar on Cydonia, so nothing ships, and Q78's FB wording stays the default. Exact % / invented changes for lean flat and lean grouped against the `921dcace` prompt flat and grouped:

  | Set | Lean flat | Lean grouped | Shipped flat | Shipped grouped |
  |---|---|---|---|---|
  | Cloud tuning 21 × 6 | 70 / 14 | 61 / 13 | 50 / 34 | 60 / 20 |
  | Cloud held-out 12 × 6 | 60 / 18 | 63 / 13 | 42 / 18 | 42 / 16 |
  | Cydonia tuning 21 × 3 | 14 / 94 | 21 / 93 | 33 / 57 | 51 / 38 |
  | Cydonia held-out 12 × 3 | 3 / 67 | 8 / 66 | 36 / 46 | 42 / 40 |

  Without the "What to change" rules, Cydonia invents small player Vigor and Resolve drops on calm turns. The work stays unlanded on branch `ticket/entity-stats-26` (`ee82c580`).
- **Q87** (user ruling) Ticket 26 runs one more arm: lean with the "What to change" rules added back, against the same Q84 and Q85 bar. If it passes, it ships. If it misses, the ticket stops and reports again.
- **Q88** (ticket 26 result) Lean with the rules missed the bar too, so nothing ships. Exact % / invented changes:

  | Set | Lean flat | Lean grouped | Shipped flat | Shipped grouped |
  |---|---|---|---|---|
  | Cydonia tuning 21 × 3 | 30 / 60 | 27 / 63 | 32 / 59 | 49 / 42 |
  | Cydonia held-out 12 × 3 | 14 / 52 | 25 / 45 | 33 / 45 | 42 / 43 |
  | Cloud tuning 21 × 6 | 23 / 4 | 22 / 3 | 53 / 28 | 59 / 23 |
  | Cloud held-out 12 × 6 | 33 / 6 | 28 / 0 | 42 / 17 | 42 / 17 |

  On cloud, the model padded the JSON with whitespace until the token cap in 66–81% of replies. Cydonia had no cap hits and still missed. Branch `ticket/entity-stats-26` is at `7dd85ce3`, not landed.

  A rerun through the app's request layer (`buildAiRequestSpec`, default settings) matched Q86 and Q88 within noise. Both lean versions still miss. The branch is at `f23f3940`, with the probe port, not landed.
- **Q89** (user ruling) Ticket 26 closes as wontfix. FB (Q78) stays the default Stat Updates prompt. The branch `ticket/entity-stats-26` stays unlanded until the user decides about its worktree.
- **Q90** (user ruling, 2026-10-21, refines Q13, Q48, Q49 and Q54) The stat panel's dropdown lists an absent entity only once some turn revealed its name. An unrevealed absent entity is left out, so the list no longer fills with Unknown entries or counts the world's hidden entities. The shared pick stays listed when absent and unrevealed, by its last alias or Unknown.

Derived from Q7 and confirmed with the summary:

- An entity stat's morph bindings drive that entity's own model.
- The Test Bench covers entity stats.
- On load, a save drops the stat values of entities that are no longer in the playthrough, as owned-trait state is pruned.

## User Stories

### Authoring owned stats

1. As an author, I want to add a stat to an entity, so that the story can track something about that entity alone.
2. As an author, I want an entity's stat to have every field a world stat has, so that I never hit a feature that works only for the player.
3. As an author, I want to give an entity stat a type, a minimum, a maximum and a starting value, so that it behaves like any other stat.
4. As an author, I want to give an entity stat regen, so that an ally's stamina recovers between turns.
5. As an author, I want to give an entity stat descriptors, so that the AI reads "Wary" instead of a bare number.
6. As an author, I want to give an entity stat before and after code, so that I can script it like a player stat.
7. As an author, I want to mark an entity stat hidden, so that the player never sees Bram's Trust while the AI still reads it.
8. As an author, I want to switch an entity stat off until a trait turns it on, so that a stat can appear partway through a story.
9. As an author, I want the no-increase and no-decrease locks on entity stats, so that I can keep a stat moving one way.
10. As an author, I want an entity stat's morph bindings to drive that entity's own model, so that a wounded ally looks wounded.
11. As an author, I want an entity's Stats tab in the entity panel, so that I edit its stats without leaving the entity.
12. As an author, I want the entity Stats tab to mirror the Stats tab, so that the same toolbar, search and row buttons work there.
13. As an author, I want a **+** menu with **Add Stat** and **Link Stat** on the entity Stats tab, so that I can start a stat from scratch or from a Blueprint.
14. As an author, I want to search an entity's stats, so that I find one fast on a busy entity.
15. As an author, I want to reorder and nest an entity's stats, so that its list reads in the order I think in.
16. As an author working in Simple mode, I want the entity Stats tab hidden, as the entity Traits tab is, so that Simple mode stays simple.

### Blueprints, Links and Detach

17. As an author, I want a Blueprints group on the Stats tab, so that I can define Trust once for the whole cast.
18. As an author, I want a Blueprint stat to stay out of the player's stats, so that a stat meant for entities never shows on the player.
19. As an author, I want to Link a stat Blueprint onto an entity, so that every entity's Trust follows one definition.
20. As an author, I want a Link to read its Blueprint live, so that one edit to Trust reaches every entity that links it.
21. As an author, I want to override any field on a stat Link except its name, so that Bram can start at 20 Trust while Odette starts at 10.
22. As an author, I want each overridden field to have its own Reset, so that I can return one field to the Blueprint.
23. As an author, I want **Reset to Blueprint** on a stat Link, so that I can drop every override at once.
24. As an author, I want a stale mark on an override whose Blueprint field has changed since, so that I notice drift.
25. As an author, I want a stat Link's name to always be its Blueprint's, so that "Trust" means the same stat everywhere.
26. As an author, I want an entity to hold at most one Link per Blueprint, so that it never has two Trust stats.
27. As an author, I want to Detach a stat Link, so that I can start from a Blueprint and then cut it loose.
28. As an author, I want each entity to keep its own value of a linked stat, so that Bram's Trust and Odette's Trust move apart.

### Groups

29. As an author, I want to group stats on the Stats tab, so that a long list reads in sections.
30. As an author, I want to group an entity's stats, so that its stats read in sections too.
31. As an author, I want to nest stat groups, so that I can build the same structure traits allow.
32. As an author, I want to give a stat group a description, so that the AI knows what the section means.
33. As an author, I want a toggle on a stat group that lets the AI see its heading, so that I can group for my own tidiness without telling the AI.
34. As an author, I want the same toggle on trait groups, so that both kinds of group work alike.
35. As an author, I want the toggle on by default, so that new groups behave as groups do today.
36. As an author, I want a group with the toggle off to still send its members to the AI, so that hiding a heading never hides the stats under it.
37. As an author, I want a nested group under a hidden heading to keep its own heading, so that the AI still reads the inner section.

### Traits and stats together

38. As an author, I want an entity's own traits to change its own stats, so that a "Hardy" trait raises Bram's maximum Vigor.
39. As an author, I want a trait Link an entity bears to change that entity's stats, so that a shared "Wounded" Blueprint lowers whoever bears it.
40. As an author, I want an entity's traits to switch its stats on and off, so that a stat appears when a trait is gained.
41. As an author, I want the World Editor to flag a trait stat change on a stat its bearer doesn't own, so that a silent no-op never ships.
42. As a player, I want an NPC's trait never to change my own stats, so that buffs land where the story says.

### Personas and library characters

43. As a player, I want the stats of the entity I play to become my stats, so that playing Odette means tracking her Stock.
44. As a player, I want my persona's stats to show beside the world's player stats, so that I see everything I am.
45. As a player, I want a persona stat that shares a name with a world player stat to stay a separate stat, so that nothing merges by accident.
46. As a player, I want my library character's stats to come with it into any world, so that my persona is the same everywhere.
47. As a player, I want library characters I add to a world to bring their stats, so that they act like authored entities.
48. As a player, I want an entity's stat values kept when I switch persona and back, so that nothing resets behind my back.

### Play: the stat request

49. As a player, I want the AI to record how a turn moved the stats of everyone in the scene, so that Odette's Trust drops when I mock her eels.
50. As a player, I want entities who aren't in the scene left out of the request, so that the AI doesn't invent changes for absent people.
51. As a player, I want my own stats tracked in the same request, so that one turn makes one stat call.
52. As a player, I want the AI to change a stat's maximum when the story calls for it, for me and for entities, so that an injury can lower a ceiling.
53. As a player on an endpoint that can't follow a JSON schema, I want my own stats still tracked the old way, so that the game keeps working.
54. As a player on such an endpoint, I want a diagnostic that says entity stats were skipped, so that I know why they don't move.
55. As a player with a custom Stat Updates prompt, I want my prompt left as I wrote it, so that my edits survive.
56. As a player, I want regen and stat code to run for every entity each turn, present or not, so that an absent ally still heals.
57. As a player, I want a relationship shift to count as a stat change, so that Wick's Trust rises when she warms to me.

### Play: the stat panel

58. As a player, I want the stat panel to show my stats on top, so that my own state is always in view.
59. As a player, I want the selected entity's stats below mine, so that I can read Bram's state while I talk to him.
60. As a player, I want a dropdown at the top of the stat panel that picks the entity, so that I can look at anyone's stats.
61. As a player, I want the dropdown and the entity view to share one selection, so that picking in either place updates both.
62. As a player, I want the dropdown to list entities who aren't present, so that I can check on someone across the river.
63. As a player, I want (None) in the dropdown, so that I can hide the entity section.
64. As a player, I want an entity whose name I haven't learned listed by its description, so that the dropdown never spoils a name.
65. As a player, I want hidden entity stats left out of the panel, so that secrets stay secret.
66. As a player, I want stat groups as collapsible headings in the panel, so that a long list stays readable.
67. As a player, I want a group with nothing visible left out, so that I never see an empty heading.

### AI context and stat code

68. As a player, I want the narrator to know the present entities' stats, so that a wounded ally is written as wounded.
69. As an author, I want entity stats in a stats piece on the Entities chip, on by default, so that every prompt that lists entities can carry them.
70. As an author, I want stats chips to nest stats under their group headings, so that the AI reads sections as I wrote them.
71. As an author, I want stat code to read any entity's stats through `entities[x].stats`, so that a player stat can react to an NPC's state.
72. As an author, I want `entities[x].stats` read only, so that one stat's code can't rewrite another owner's values behind the turn.
73. As an author, I want an entity stat's own code to read its owner's stats as `stats`, so that Bram's code reads like the player's.
74. As an author, I want the Test Bench to cover entity stats, so that I can check bands and derived values before I play.

### Data

75. As a player, I want entity stat values saved with my game, so that a reload keeps them.
76. As a player, I want stat values of entities removed from the world dropped on load, so that old saves stay clean.
77. As an author, I want a world exported with entity stats, stat Blueprints and stat groups to import intact, so that sharing keeps everything.

## Implementation Decisions

### Model

- An owned stat is the world stat type, held by an entity next to its traits. An entity holds its own stats, stat Links, stat groups and a stat placement for its tree, mirroring the trait fields.
- A stat Link stores its Original's id, the Original's name, its group, its order and its Overrides. An Override stores the Blueprint's value it was made against, so a stale Override can be detected. This follows the trait and placeholder Link models.
- The Stats tab's tree gains groups, with a system Blueprints group. A Blueprint stat is excluded from the player's stats everywhere: seeding, the stat request, chips, the panel and stat code.
- Trait groups and stat groups gain an AI-visibility flag, default on. Prompt building reads it when it renders headings.
- Owners are resolved through the bearer resolution that owned traits use: a bearer's stat tree is its own stats plus its stat Links expanded against their Blueprints. The played persona's resolved stats join the player's stats under the persona, as separate stats. Under a library persona, the Custom Persona entity's stats join as well.
- Runtime values live in gameplay state, keyed by owner, then stat id. Owned-trait state is the precedent. The authored world is never written during play.
- Effective stats are derived per owner by the same derive step the player uses: base, plus the bearer's trait stat changes, plus the AI's max delta, then code bounds. A trait stat change finds its target among the bearer's own stats by id, or by Blueprint for a linked stat. On a player bearer (the played persona, or the Custom Persona entity), a change with no own target falls through to the world player stat, and an optional `target: 'player'` field reaches the world stat even when an own stat shares its id. On a cast bearer, a change with no target is dropped, and the Test Bench flags it.

### The stat request

- The stat pass builds one request from a list of owners: the player (world player stats, plus the stats of every owner that joins the player) and the present entities with enabled stats. The present entities arrive through the Turn Pipeline's derivation callback after narration (ADR-0001), from the participants the narration confirmed.
- The system prompt renders one section per owner, with stats nested under visible group headings. The response format is a JSON schema: one key per owner. Under it, each stat's key holds its bare signed change, and a "<key> max" key beside it holds its max change, all bounded integers. Every key is required, so "no change" is an explicit 0. A name clash gets a numbered key, and every prompt shows that numbered name.
- The default Stat Updates prompts carry the C3 wording: one JSON object on one line, and 0 for a stat that didn't move. They also carry the WL lines: each stat belongs to the character it sits under and moves only for what that character does, goes through or feels, and a clear shift in how a character regards the player moves that character's own stat. They also carry the FB framing (Q78): what a stat is, what stats do for the narrator, and how owner headings and group bullets lay out the list. Ticket 26 tried a lean prompt and missed (Q86–Q89). Custom prompts are not touched.
- The request layer gains a structured-output field. Schema support is a question on the per-endpoint capability record. A rejection with no parameter, or one that names the schema, retries once in the same turn on the text pass, and only a successful retry stores the rejection. Those turns use today's player-only text prompts, skip entity stats, and add a diagnostic. A rejection that names another parameter goes to the existing override path.
- The response reader matches owners and stats by identity from the request snapshot, as the current reader does. It returns per-owner updates and diagnostics. Applying runs max changes before values, per owner.
- The token cap scales with the number of stats and owners in the request.
- The request schema and its whitespace hints avoid keywords the cloud server rejects (`uniqueItems`).

### Stat code and regen

- Regen and stat code run for every owner in the playthrough each turn, in today's order: before code at turn start, then AI asks, regen and after code.
- `entities[x].stats` exposes every entity's stats read only. In an entity stat's code, `stats` is its owner's stats. The player's code keeps today's `stats`.

### UI

- The entity Stats tab reuses the shared list toolbar and the entity Traits mirror's layout: stacked over the list in the World Editor, with details sliding in over it.
- The Stats tab's tree shows entity nodes for entities that own stats, stat groups or stat Links, placed through `statPlacement`, as the Traits tab does (Q79). Cross-owner drags keep ids and are refused, with a note, when they would break a reader (Q80). A Blueprint dropped on an entity node links it.
- A drag into Blueprints, in the Stats or Traits tree, is refused while something outside Blueprints reads the item (Q81–Q83).
- The in-game stat panel renders the player's stats, then a section for the selected entity. The selection is lifted so that the entity view and the panel's dropdown share it. The dropdown lists present entities first, then absent entities with a visible stat and a revealed name (Q90), then (None). An unrevealed entity shows the scene's alias, or Unknown.
- Stat groups render as collapsible headings in the panel, reusing the stat row.

### Prompts

- The Entities chip gains a stats piece, on by default. It renders each entity's enabled stats with value, status and meaning, nested by group, in the Here and In Scene scopes and in Full and Summary content.
- The Stats chip outside the stat request lists the world player stats, then the stats of every owner that joins the player.
- Stats chips and the Traits chip skip the heading of a group with the AI-visibility flag off.

### Data

- World export shape: entity stats, stat Links, stat groups, stat placement, stat Blueprints and the group AI-visibility flag on trait and stat groups.
- Save shape: entity stat values keyed by owner. Load prunes owners no longer in the playthrough.
- Character card shape: the entity's owned stats, stat Links and stat groups.
- All are additive on unreleased forms; migration fills defaults (no entity stats, groups visible to the AI).

## Testing Decisions

- A good test drives behavior through a seam and asserts what a caller sees: requests sent, values applied, rows rendered. It never asserts private helpers or mirrors the code under test.
- **Turn Pipeline seams (ADR-0001):** a fake request adapter and the derivation callback cover owner selection, schema building, the fallback on rejection, response reading, diagnostics and per-owner apply. Prior art: the turn-pipeline parity and commit tests.
- **Pure stat runtime:** per-owner derivation (traits, trait Links, stat Links, Overrides, untargeted changes) and the stat-code turn with owners. Prior art: the trait-runtime and stat-code-turn tests.
- **Import boundary:** world, save and card migration, and save pruning on load. Prior art: the version migration and owned-trait pruning tests.
- **UI harnesses:** the game panels harness for the stat panel, its dropdown, sync and groups; the entity editor tab tests for the Stats mirror; the stat tree's entity node, cross-owner and Blueprints refusal cases, plus an e2e drag spec. Prior art: the entity traits mirror tests and `trait-entity-nodes`.
- **Probe:** the entity stats probe measures every prompt change against Q28 on the cloud default model and on Cydonia, with the player-only control in the same batch.
- Every guard is proved by reinstating the bug once and watching its test fail.

## Out of Scope

- Stats on characters the narrator invents during play.
- Modes, pick counts and gates on stat groups.
- Write access to another owner's stats from stat code.
- Changes to custom Stat Updates prompts.
- The leftover world-level stat update rules, which no turn runs.
- Cydonia's invented player changes past ticket 17's wording. They are release blocker 03 on the standing release-blockers list.

## Further Notes

- Evidence for the request shape: the entity stats probe, 22 cases (21 after Q30), cloud default model and Cydonia, 2026-10-10. C3 scored 56% exact and 68% recall on the cloud model and 48% and 100% on Cydonia, with no wrong signs on either. One call per entity scored 18%; text lines never wrote the player's lines.
- The cloud server ignores every whitespace switch tried. A fixed-shape object written on one line avoids the padding that list values cause.
- ⚠️ This effort changes the world, save and character card export shapes.
