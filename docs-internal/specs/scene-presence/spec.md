# Spec: Scene Presence and Strangers

Status: in-progress
Status note: Reopened on 2026-10-31 for tickets 13–14. Closed on 2026-10-31. Tickets 01–09 and 11–12 are done, and 10 is wontfix. The last landing is 1553e521b. Review: spec text corrected, and fixes landed in 268e1a00e, af9e382d1 and 9b6e60f93. Closed red: lint failed on a peer's uncommitted collapsing-segments files, and StrangerModal.test.tsx failed on a run that read the test before its fix landed. Both are outside this effort's code, and the test passes now.
Spec session: scene-presence — spec

## Problem Statement

Each player surface decides on its own who the player can see, examine or act on, and the surfaces disagree.

- The Entities tab lists this turn's scene list. It does not clear when the player moves, so the Smithy's people stay listed in the gate yard until the next narration.
- The Give list in the Inventory tab lists everyone at the location by their true name. A hooded stranger the story has not named shows as "Sylvie Thornwhistle" there.
- The stat picker works out who the player knows from the scene history. The map reads a separate met list. The Help window's Player View counts every discovered character, met or not. That is three meanings of "met".
- The Traits tab lists every owner in the cast, so a wizard the player never met shows his Wizard traits.
- The map never shows an entity with no single position, such as one listed at several places, even after the player meets it.
- "In scene" has two meanings: this turn's scene list, and anyone named in the last 3 turns.

An author also cannot make a character the player does not know yet. Every entity starts unmet in a new game, so the map and the Help window show nobody at first. Meanwhile nothing stops the planner from naming a stranger on sight. A childhood friend and a hooded spy start the same way.

## Solution

Every entity has three facts about it, computed in one place for every player surface:

- **Where:** here, connected or elsewhere.
- **Met:** whether the player knows who the entity is.
- **In scene:** whether the entity takes part in the story now.

Each player surface shows one named set built from those facts:

- **Look Around:** everyone here the player would see if they looked around. Met people show by name, strangers by their stranger label. This set feeds the Entities tab.
- **In Scene:** the people here taking part in the story. This set feeds the stat picker, the Traits tab and Give.
- **Met:** everyone the player knows, wherever they are. This set feeds the map and the Help window.

AI passes do not change. The narrator, the planner and the Inventory pass still see everyone at the location.

An author can give an entity an optional **Stranger Name** and **Stranger Description**. An entity without them starts met, so old worlds keep the behavior a player expects. An entity with them is a stranger until the story names it. The exceptions are a relationship with the played persona, or the entity being known where the persona lives. The planner uses the Stranger Name until then.

## User Stories

### Where, met and in scene

1. As a player, I want someone I just traded with to stay in the scene for a few quiet turns, so that panels do not flicker when one turn skips them.
2. As a player, I want the scene to clear when I walk to a new place, so that the last room's people do not follow me unless they really follow me.
3. As a player, I want a follower to stay in the scene when I move, so that a companion stays with me.
4. As a player, I want someone who walks away to leave the scene at once, so that I cannot hand an item to a person who left.
5. As a player, I want a person mentioned only in another character's dialogue to stay out of the scene, so that gossip does not summon them.
6. As a player, I want someone shouting from the next room to stay "connected" and not in scene, so that I must go to them to act on them.
7. As a player, I want people in the parent place, sibling rooms, child rooms and map connections to count as connected, so that "one step away" means one thing.
8. As a player, I want an entity listed at several places with no single position to count as here at each of those places, so that the Cold Lights are at every mound.
9. As a player, I want a person the story invents to count like anyone else once they become an entity, so that the fishwife can take my coin.

### Meeting people

10. As a player, I want to meet a stranger when the story names them, dialogue included, so that an introduction works.
11. As a player, I want a stranger to show under the story's alias or the Stranger Name until I meet them, so that I never learn a name early.
12. As a player, I want a met person to stay met for the rest of the game, so that my knowledge never resets.
13. As a player, I want a character the story invents to start met, so that a name the story just gave stays usable.
14. As a player on an older save, I want everyone without a Stranger Name to count as met, so that my map and Help window fill in at once.

### Surfaces

15. As a player, I want the Entities tab to show everyone here I would see if I looked around, people in scene first and quiet people after, so that I know who is in the room.
16. As a player, I want strangers in the Entities tab to show by their stranger label, so that the list matches the story.
17. As a player, I want a stranger with no label at all to stay off the Entities tab, so that the panel never invents a name.
18. As a player, I want clicking a stranger to open a popup with the stranger label, the image and the Stranger Description only, so that I see what I can see and nothing more.
19. As a player, I want clicking a met person to open the full popup as today, so that nothing I rely on goes away.
20. As a player, I want the stat picker to offer only people in scene, so that I examine people who stand in front of me.
21. As a player, I want the Traits tab to show the same owners as the stat picker, so that I never see a stranger's traits.
22. As a player, I want Give to offer only people in scene, so that I hand things to people the story is showing.
23. As a player, I want Give to show a stranger by their stranger label, so that the true name never leaks.
24. As a player, I want a person with no entity, or a stranger with no label, to stay out of Give, so that I type that action and the story plays it out.
25. As a player, I want the map to show every met person where they stand, and a multi-place entity at each listed place, so that I can find people I know.
26. As a player, I want the map to leave out strangers, so that it does not spoil who is where.
27. As a player, I want the Help window to know only met people and the aliases I have seen, so that asking "who is the hooded stranger?" gives nothing away.

### Authoring strangers

28. As an author, I want an optional Stranger Name and Stranger Description on an entity, so that I can hide who a character is.
29. As an author, I want an entity without a Stranger Name to start met, so that my existing world plays as before.
30. As an author, I want a stranger who has a relationship with the played persona to start met, on either side of the tie, so that a childhood friend needs no introduction.
31. As an author, I want a stranger with an explicit Known In pick that covers a place where the played persona lives to start met, including the pick's child places, so that Albus knows the keep's people.
32. As an author, I want the Nearby default of Known In to make nobody met, so that a Stranger Name does what it says.
33. As an author, I want a persona that lives nowhere, such as the Custom Persona or a library persona, to meet strangers fresh, so that a newcomer is a newcomer.
34. As an author, I want Stranger Name and Stranger Description to take placeholders and rolls, so that a stranger's look can vary per game.
35. As an author, I want the planner and narrator to call a stranger by the Stranger Name until the story names them, so that prose and panels agree from the first turn.
36. As an author, I want scripts to read whether the player has met an entity and to introduce one, so that a found letter can reveal who the stranger is.
37. As an author, I want a world change, such as a new Stranger Name, to apply to saves I already have, so that I can tune strangers without a new game.

## Implementation Decisions

### Rulings (grill, 2026-10-30)

- Q1, Q6: in scene lasts 3 turns after the entity's last action.
- Q2: a move clears the scene, except for followers.
- Q3: connected means the parent place, sibling places, child places and map connections.
- Q4, Q34: the player meets a stranger when the story names them, dialogue included.
- Q5, Q36: an invented character counts once it is an entity, and it starts met.
- Q7: only actions put someone in scene. The prose shows them, or the planner casts them. A name inside dialogue does not.
- Q8, Q12: in scene needs here. Leaving ends it at once.
- Q9: a person with no entity, or a stranger with no label, is never offered in a picker.
- Q10: an unpositioned entity is here at every place it lists.
- Q11: "met, elsewhere" is a state, used by the map.
- Q13, Q24: the Entities tab is Look Around.
- Q16: Give offers In Scene only.
- Q18: the map shows a multi-place entity at each listed place.
- Q19: the Player View holds met people and seen aliases only.
- Q20: a stranger's popup shows the label, image and Stranger Description only.
- Q21, Q22: the stat picker and the Traits tab use In Scene.
- Q26: AI passes keep "at location". Nothing in this spec filters a prompt.
- Q25, Q30, Q32: Stranger Name and Stranger Description are optional. Without them the entity starts met.
- Q27, Q28: the planner prompt uses the Stranger Name as the alias until the story names the entity.
- Q29: Stranger Description is optional.
- Q31: an explicit Known In pick covers its subtree. The Nearby default and Nowhere make nobody met.
- Q33: a relationship on either side counts.
- Q35: scripts read and set met. Met never un-sets.
- Q37: start-met is derived at read time from the world and persona, never stored.
- Q38: stranger fields resolve placeholders and rolls.
- Q39, Q40: test seams (see Testing Decisions).

### Rulings (ticket 01 intent questions, 2026-10-30)

- **Q41:** only the entity's resolved true name introduces it, including the name-part matching detection already does. Authored aliases do not count, because an alias can describe a stranger. Only an entity that is here that turn can be introduced. Hearing an absent stranger's name does not let the player recognize them.
- **Q42:** taking part reads each assistant turn's stored participant list: the prose with quoted speech stripped, plus the planner cast. An entity is in scene when it is here and named in that list in one of the last 3 assistant turns. One shared constant holds the 3. A participant at turn T is in at T+2 and out at T+3.
- **Q43:** the window stops at the first older turn whose stored location differs from the current one. A turn with no stored location, from an older save, does not cut it.
- **Q44:** a follower is in scene when it took part in the last 3 turns, and the move cutoff is ignored for it. Following alone does not make it in scene.
- **Q45:** the save field is `strangerAliases`, an entity id to alias map. It is written each turn from the planner cast's alias for a cast member the player has not met, and never cleared. A met entity's label ignores it.
- **Q46:** the met-in-play list records every here entity the story names, whether the start rule already meets it or not. A later world edit that adds a Stranger Name then hides only people the player never saw named.
- **Q47:** each set keeps cast order: authored entities, then runtime characters. Look Around puts In Scene first, then quiet. The played persona and the Custom Persona are in no set.
- **Q48:** an authored Stranger Name that is blank or whitespace-only reads as absent, so the entity is met. Only a Stranger Name whose placeholders resolve blank gives an unlabeled stranger. The editor in ticket 06 stores a cleared field as absent.
- **Q49:** a player's edit to the latest narration page introduces the here entities it names, like AI narration. An edit is the player writing the story.

### Rulings (ticket 02 intent questions, 2026-10-30)

- **Q50:** a surface showing a past page reads presence from that page's snapshot, not the live state, so paging back shows who was there then. The Presence module is pure over a state, so the viewed snapshot is its input.
- **Q51:** the Entities tab drops rows with no entity (Q9). Runtime-character rows keep their remove control and the following marker.
- **Q52:** clicking a stranger opens the reduced popup only. It does not select the stranger in the Entity View, which can show the true name.
- **Q53:** the persona's own row stays above Look Around, as today.

### Rulings (ticket 03 intent questions, 2026-10-30)

- **Q54:** ticket 02 owns the one panel hook, `usePresence(viewedPage?)`. It returns the Presence result for the viewed page (Q50), or the live state with no page. Tickets 03 and 04 build against that shape and import it after 02 lands. No other ticket builds its own.
- **Q55:** the stat picker drops its keep-the-selection rule. A selected entity that leaves the scene falls back to the first showable entity.
- **Q56:** no true name appears anywhere for a stranger. Every place a surface shows or resolves the entity's name uses the label instead: the Character Name placeholder in stat and trait text, the Traits owner node, and the "X's trait" prefix. A stranger in scene still shows stat rows and traits under the label.
- **Q57:** the played persona's Traits node and library owners stay, whatever Presence says.
- **Q58:** two strangers with the same label keep the picker's numbered suffix, such as "a gate guard (2)".

### Rulings (ticket 04 intent questions, 2026-10-30)

- **Q59:** Give drops its quiet group, its divider and the in-scene flag. Each entry shows the label.
- **Q60:** the Inventory tab's own writes accept only In Scene owners, so a give to a quiet or absent entity is refused. Inventory pass writes keep "at location" (Q26).
- **Q61:** Give's empty text reads "Nobody is in the scene." The inventory panel's participants input is removed once nothing reads it.

### Rulings (ticket 05 intent questions, 2026-10-30)

- **Q62:** the Player View stays pure. It computes the Met set by calling the Presence module on its own current snapshot, not by taking a hook's live value, so an undo still moves it back (ADR-0014). Met rows follow cast order without the persona, and runtime characters are met by the start rule.
- **Q63:** a stranger's row in the Player View keeps the existing rule: aliases the player has seen in the chain's scene rows. A stranger seen under no alias, with only a Stranger Name, gets no row.
- **Q64:** the map reads the live Met set. Positioned entities show at their position, and unpositioned ones at each place they list. The old roster helpers are removed.

### Rulings (ticket 06 intent questions, 2026-10-30)

- **Q65:** Stranger Name and Stranger Description sit together as a pair in the Profile tab's identity group, after Pronouns. This matches how the item editor keeps Unidentified Name and Unidentified Description side by side. The description has no AI-generate button.
- **Q66:** both fields show in Advanced mode only, and only in the World Editor. Library entities get neither.
- **Q67:** one help topic on Stranger Name states the start-met rule with the existing field names, plus a section on the World Editor entities docs page. The changelog fragment is a user-facing Minor Added entry, in the same group as the Entities tab and Give entries.

### Rulings (ticket 07 intent questions, 2026-10-30)

- **Q68:** an unmet entity with a Stranger Name gets one roster field that carries its label. The planner's alias rule tells it to use that text as the parenthetical alias. A met entity, or one without a Stranger Name, gets no field and is cast as today.
- **Q69:** only the planner's request renders that field. Every other prompt's roster stays byte-equal to today. A custom planner prompt still gets it, because it rides in the Entities chip.
- **Q70:** the field carries the Presence label: the latest story alias, else the Stranger Name. This follows Q27, where the story's alias wins once seen.
- **Q71:** for an entity with a Stranger Name, met decides whether the name may appear, in the prompt rule and the code backstop alike. A name spoken elsewhere does not reveal it (Q41). Entities without a Stranger Name keep today's narration test.
- **Q72:** the backstop fills a missing alias with the label in place of the generic fallback. It does not overwrite an alias the planner invented. The staged-mode director prompt is out of scope.
- **Q73:** after the full-name swap, the backstop also swaps each distinctive word of an unrevealed name for the alias. It uses the same distinctive words that name-part detection uses (Q41). This applies to every unrevealed name, strangers and narration-test names alike, so hiding matches revealing. A word shared with any other entity's name is never swapped, whether that entity is in the cast or off-scene, and the same goes for the player's names. Only whole words match. Ticket 07 widened the guard beyond the cast.
### Rulings (ticket 08 intent questions, 2026-10-30)

- **Q74:**
  - `meet()` introduces any cast entity, here or not, because the author calls it on purpose.
  - A later `met` read in the same run sees it. The met-in-play append lands when the run commits.
  - `persona.met` is always true, and the persona has no `meet()`.
  - A blank entry reads `met: false`, and its `meet()` stops the script.
  - `met` ships wherever entity entries do. `meet()` ships only where entity writes are allowed, so a read-only run, such as a user Tool, has `met` and no `meet()`.
- **Q75:** The opening state lands a Start-timing script's `meet()`, move and follow writes, so they take effect on turn one (ticket 10).
- **Q76:** Q75's premise was wrong: play already lands Start writes at turn one's commit. A live repro then showed re-rolls keep those writes too, so ticket 10 closed as wontfix and Q75 has nothing to build.
- **Q77:** `met` uses the full start-met rule at every sandbox site, Test Bench, script Test Runs and Tools included (ticket 11).
- **Q78:** A stranger's trait text resolves with the label, never the true name. The Traits tab numbers strangers who share a label, as the stat picker does (ticket 12).
- **Q79:** The Entity View may show a stranger's art when no one is selected. Art is not identity.
- **Q80:** Script sites pass a persona when they hold one: in-game Tools pass the played persona. A Test Run with no persona (Q3) still calls the start-met rule with a null persona, so one code path serves every site.
- **Q81:** One helper builds the opening persona from what the caller holds, library personas included, so the Test Bench reads `met` for a library persona too. The trailing `persona?` arguments fold into an options object (ticket 13).
- **Q82:** The planner backstop's name-part swap stays case-exact, so ordinary words that match a name are left alone.
- **Q83:** The narrator must read a stranger's true name to recognize the introduction, so the name stays in its roster. Every prompt that lists an unmet stranger with a Stranger Name also shows the stranger label as one more field, like the planner's (ticket 14). This widens Q69 past the planner.
- **Q84:** The name normalizers in Presence, the planner backstop and entityMatch stay separate.
- **Q85:** The Test Bench's Opening instrument lists world personas only, so Q81's library case is tested through the helper and the callers that can hold a library persona. A library picker for the Bench is out of scope.
- **Q86:** A name-only roster, such as the Now Line's, prints an unmet stranger with a Stranger Name as "true name (label)". Per Q83, the label is shown with the true name, never in its place (ticket 14).

- **Open (for the user):** with planning off, no planner seeds the alias, so the narrator sees the stranger's true name in its roster. This effort leaves that as is.

### The Presence module

- A new pure module computes presence. Its input is the game state, the authored and discovered entities, the locations with their connections and parents, the played persona, and the recent turns' scene records. Its output gives, for every entity:
  - `where`: here, connected or elsewhere.
  - `met`: a boolean.
  - `inScene`: a boolean.
  - `label`: what the player sees, or none.
- It exposes three named sets: **Look Around**, **In Scene** and **Met**. Each set is an ordered list of entities with labels. Look Around lists people in scene first.
- Every player surface reads one named set. No surface combines positions, met lists or scene lists on its own any more.
- **Here** reads the same positions the cast already uses: positioned entities by position, unpositioned entities at each listed place, followers with the player, and runtime characters at their recorded place.
- **In scene** reads the per-turn scene records. An entity is in scene when it is here and took part in one of the last 3 turns that a move has not cut off. Taking part means the prose shows it, or the planner casts it. Followers stay in scene across a move.
- **Met** is the union of the start rule and the met-in-play list the save keeps:
  - The start rule is never stored.
  - The met-in-play list keeps its current shape.
  - Naming detection, dialogue included, and a script's `meet()` both append to it.
- **The start rule.** An entity starts met when any of these holds:
  1. It has no Stranger Name.
  2. A relationship joins it to the played persona, authored on either side.
  3. One of its explicit Known In picks, subtree included, covers a place the played persona's entity lists.
  4. It is a runtime character.
- **Label:**
  - A met entity shows its resolved name.
  - A stranger shows the latest story alias it was seen under. Without one, it shows the resolved Stranger Name.
  - A stranger with neither has no label. It is left out of every set except Met, which never holds strangers anyway.
- The module also replaces the stat picker's own "ever revealed" rebuild, the map's met-and-positioned roster, and the Player View's met-or-discovered rule.

### State and world shape

- An entity gains optional `strangerName` and `strangerDescription` strings. Both resolve placeholders and rolls the way other entity text fields do. ⚠️ This is an additive world export-shape change.
- The save gains a remembered last alias per entity, keyed by entity id. The planner's cast alias fills it. The Stranger Name is a read-time fallback and is never stored (Q45). ⚠️ This is an additive save export-shape change.
- The met-in-play list keeps its shape. It records every entity here that the story names, start-met ones included (Q46).
- The per-turn scene record keeps its alias and revealed fields. A move now clears the live scene list, apart from followers.

### Surfaces

- **Entities tab:** Look Around, with people in scene first and quiet people after. A stranger shows by label.
- **Entity popup:** a met person gets the full popup, as today. A stranger gets a reduced popup with the label, the image and the Stranger Description.
- **Stat picker:** In Scene. Its "absent" group goes away.
- **Traits tab:** owner nodes follow In Scene. The player's own node and library owners stay.
- **Give:** In Scene, by label. An entry with no label is left out.
- **Map:** Met, at each place: positioned entities where they stand, and unpositioned ones at each listed place.
- **Help window:** the Player View's entity rows become the Met set, plus aliases of strangers the player has seen. ADR-0014's Player View definition is updated to match.

### Prompts

- The turn planner prompt casts an entity that has a Stranger Name under that name as its alias until the entity is met. The prompt change ships with probe numbers, per the prompt rules.
- The narrator already receives aliases through the planner. No other prompt changes.

### World Editor

- The entity editor gains Stranger Name and Stranger Description fields. Help copy follows the Writing Guide. Placeholders and rolls work there as in the other entity text fields.

### Scripts

- An entity entry gains a read-only `met` boolean and a `meet()` verb. A `meet()` call on a met entity does nothing.
- The surface catalog, the hover cards and the Scripts guide document both.

## Testing Decisions

- **Primary seam: the Presence module.** It is pure, so every rule is tested there by its external result: the sets and labels for a given state. Cases come from the grill:
  - **Mara quiet for 2 turns:** still in scene. Quiet for 3: out.
  - **The move to the gate yard:** clears Bram, keeps a follower.
  - **Mara walks off:** out at once.
  - **Bram named in Mara's dialogue:** not in scene.
  - **Shouting across:** connected, not in scene.
  - **The Cold Lights at three mounds:** here at each.
  - **Hooded Sylvie:** a stranger by alias until named in dialogue, then met.
  - **Marr with a Stranger Name:** labeled "a gate guard" before any alias. A stranger with no alias and no Stranger Name has no label.
  - **Start rule:** a childhood friend tied on either side starts met. A Known In pick on a parent covers a child place. The Nearby default does not. The Wanderer, who lives nowhere, meets strangers fresh. A runtime character starts met.
  - **An older save** with an empty met list reads everyone without a Stranger Name as met.
- **Second seam: surfaces.** Each surface gets one thin check that it shows its named set:
  - The Entities tab, entity popup, stat picker, Traits tab and Give run through the existing GamePanels harness.
  - The map runs through LocationMap's tests.
  - The Help window runs through the Player View builder's tests.
- **Prompt:** the planner prompt change is measured by a probe with in-batch controls on cloud, not by a unit test.
- **Scripts:** the sandbox's item and entity tests are the prior art for `met` and `meet()`.
- Each guard is proven to bite by putting the old behavior back and watching the test fail.
- Prior art:
  - The inventory pass tests, for the pure-module style.
  - The stat picker and Player View tests, for the surface checks.
  - The Emberwatch world tests, for a bundled world using the new fields.

## Out of Scope

- Using an item on an entity, and the Inventory tab's Use On picker. The rulings already made for it are kept in Further Notes for that effort.
- Any change to what AI passes see (Q26).
- Per-persona met lists, and a "newcomer" switch on a persona.
- Remembering last-seen stat values for people elsewhere.
- Stranger images, meaning a separate picture before meeting.
- Authoring Stranger Names for Emberwatch's cast. That is a world-content follow-up after this lands.

## Further Notes

- Rulings already made for the later Use On effort:
  - Q17: Use On offers Give's people, plus the player and items.
  - Q23: target items are the player's own and the ones lying here.
- Today's met list is written by one effect from the live scene list. Moving the writer into the Presence module's naming detection removes the case where a revealed row that left the scene before the effect ran was never met.
- The 3-turn buffer is the same window the chips' In Scene source uses today. One constant serves both.
