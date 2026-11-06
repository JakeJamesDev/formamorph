# Spec: Narrated Moves and the Scene Pull

Status: ready-for-agent
Spec session: narrated-moves — spec

## Problem Statement

A play log from an authored world showed the narration and the game disagreeing about where everyone is.

- **The player was carried, and the game never moved them.** The opening had the player carried up into a chieftain's hut, a child of the village where the game started. Later turns dragged them back down to the village, and then up again. The game location stayed the village for all 24 turns. In Auto mode the location router reads only the player's action, before the narration, so being carried never counts as a move. The opening runs no location request at all.
- **A character who acted in the scene never joined it.** The chieftain stood in her hut, a child of the player's place. The narration had her speak and act on most turns. She never joined In Scene, and the narrator only ever got her summary under Known Here. The scene pull takes characters from sibling places only, never from a child place.
- **The story's name for a stranger never matched.** The narration called her by her title, never by her name. Name matching reads an entity's name and aliases. It never reads the Stranger Name, which is the name the story uses before the player meets her.

## Solution

The game follows the story's moves, for the player and for the characters around them.

- **Narrated moves.** In Auto mode, when the router before the narration finds no move, one more location request after the narration reads the narration. When the narration has taken the player somewhere they can go, the move applies at once. Followers and "come along" replies act as they do for a walked move. The opening runs this check too.
- **The scene pull reaches child places.** When the prose names a character who stands in a direct child of the player's place, she joins the player's place, as a sibling's character does today. Her Movement decides whether she may come. The same rule now applies to the sibling pull.
- **The Stranger Name matches.** A full Stranger Name in the prose names its entity, under the same strict rule as a name.

The move applies first. Presence and the pull are judged at the place where the player ends the turn.

## User Stories

1. As a player, I want the game to move me when the story carries me somewhere, so that the location panel and the map show where my character is.
2. As a player, I want the opening to put me where the opening scene happens, so that a first scene set in a child place starts there.
3. As a player, I want a character who acts in my scene to join it, so that the narrator writes her from her full sheet instead of a summary.
4. As a player, I want a character in the room above me to come down when the story brings her, so that the story does not need her exact name to bring her.
5. As a player, I want a hooded stranger to join the scene when the story calls her by her stranger name, so that I see her in the Entities tab before I learn who she is.
6. As a player, I want followers to come with me when the story carries me, so that a companion is not left behind by a narrated move.
7. As a player, I want a "stay here" reply to keep that character behind on a narrated move, so that the move acts the same as one I walked.
8. As a player, I want no extra wait on a turn where I walked somewhere myself, so that the new check costs nothing when the router already moved me.
9. As a player, I want a story that only looks toward a place, or talks about it, to leave me where I am, so that I do not jump to places I never went.
10. As a player on a small or cloud model, I want the narrated-move check to be right almost every time, so that it does not move me by mistake.
11. As a player in Suggest mode, I want the move offer to read the narration, so that a story that carries me offers that move, and I still choose each move myself.
12. As a player who turned Location Changes off, I want no narrated moves either, so that the one switch covers every move.
13. As an author, I want a character set to Stays Put never to be pulled into the scene, so that a fixed shopkeeper stays at her counter.
14. As an author, I want a Moves Between character pulled only into one of her own places, so that her route stays the one I set.
15. As an author, I want Free and Can Follow the Player characters pulled whenever the story names them nearby, so that they act as they do today.
16. As an author, I want a leader's full sheet sent only where she stands, so that her Known In area gets her summary and no more context.
17. As an author, I want a Stranger Name to match only in full, so that a race word shared by a whole tribe does not pull its leader into every scene.
18. As an author, I want aliases to keep matching as they do now, so that I can add the short forms the story uses for a character.
19. As an author, I want a pulled character to keep her position after the turn, so that she stays in the scene until the story or her Movement takes her away.
20. As an author, I want a pull judged at the player's place after a narrated move, so that a character already in the room the player was carried into is not pulled out of it.
21. As an author, I want a character named only inside dialogue not to be pulled, so that the scene pull stays as strict as it is today.
22. As a developer, I want the pull and the matching as pure functions with tests, so that a regression fails a test and not a play session.
23. As a developer, I want the narrated-move check covered by turn-runner tests with fake replies, so that its timing (Auto only, after NONE, on the opening, move before pull) cannot drift.
24. As a developer, I want the probe numbers for the reused prompt, so that we change the prompt only if the probe shows a need.

## Implementation Decisions

Rulings from the grill, numbered as asked:

- **Q1. Stranger Name matching.** A Stranger Name matches only in full, under the strict rule for multi-word names. No single word of it matches alone: on the play log, a loose match fired on 10 turns where only the tribe's race word appeared. Aliases stay the way to match short forms, and they keep their case-sensitive rule. The Stranger Name joins name matching everywhere participants are read, so In Scene, the Entities tab and the pull read the same match.
  - **Ticket 02 rulings:** a leading a/an/the is ignored on both sides, so "a hooded woman" matches "the hooded woman", with at least 2 words left. A Stranger Name left with one word matches only with an initial capital, as a one-word name does. It keeps matching after the player meets the entity: matching reads presence in prose, not the Met state. A blank Stranger Name is ignored. Matching reads the Stranger Name as the player sees it, with placeholders resolved. The match evidence says it came from the Stranger Name.
- **Q2. Child pull.** The pull takes a character named in prose who stands in a **direct child** of the player's place. Deeper places are not pulled. Full-name hits only, as today, where a full Stranger Name and an alias count as full hits. Prose only, as today: a name inside dialogue never pulls.
- **Q3. One Movement rule for the pull,** for siblings and children alike:
  - **Stays Put:** never pulled.
  - **Moves Between Its Locations:** pulled only when the player's place is one of her locations.
  - **Free** and **Can Follow the Player:** always pulled.
- **Q4. Narrated moves in Auto mode.** A post-narration location request reads the narration and applies its answer at once. It sends the same reachable destination list the router uses.
- **Q5. The opening** runs this check too, after the opening narration.
- **Q6. Order.** The narrated move applies before the scene pull and before presence is read. The pull is judged at the place where the player ends the turn.
- **Q7. Skip rule.** The check runs only when the router before the narration answered NONE. One move per turn at most.
- **Q8. Probe bar.** On the cloud default model, at least 9 of 10 carried narrations move the player, and at most 1 of 10 stay narrations does.
- **Q9. Prompt.** The check reuses Suggest mode's post-narration location request as is. It gets its own prompt only if the probe misses the bar, and that prompt then ships with its own probe numbers.
  - **Ticket 01 finding (2026-11-06):** Suggest mode's request never sends the narration. Its user prompt holds only the action, and its system prompt routes "from the stated action alone". So the reused arm is a baseline, and a narrated-move prompt pair (system and user, rendering the action and the narration) runs beside it in the same batches. Ticket 01 adds the pair as exported default prompts only. Ticket 04 wires the settings, the pass and the editor rows.
  - **Probe rules (ticket 01):** the Q8 bar applies to each set's totals as rates (at least 90% of carried runs move, at most 10% of stay runs move). Per-scene numbers are reported too. A move to a different reachable place than the narration names counts as a miss. The opening sends an empty action. The router's existing action-only cases run in each batch on both arms as the in-batch control.
  - **Probe result and ruling (2026-11-06, user):** on the cloud model, the narrated-move prompt moved 80/80 carried runs (the reused request 10/80). It made 10/80 false stay moves (12.5%), all from one scene whose action waits "by the foot of the ladder". The router's own prompt moves on that action alone 10/10, so in Auto mode the router moves first and Q7 skips the post check. Ruling: land with the narrated-move prompt and record the miss. The threshold case is a router follow-up outside this spec.
- **Q10. Followers.** A narrated move goes through the same move path as a walked move. Followers come along, "stay here" replies stay, and Moves Between characters come along only into their own places.
- **Q11. Settings.** No new setting. The check runs whenever Location Changes is on and Auto mode applies moves. Suggest mode keeps its post-narration offer.
  - **Suggest mode (2026-11-06, user):** Suggest mode's offer uses the same narrated-move request as Auto mode, so it reads the narration too. It still offers the move and never applies it. Ticket 04 does both modes.
- The pull still records the moved character through the discovered-entity path, so the move persists, rolls back with its turn and survives reload. No save-shape change is expected. If one turns out to be needed, the change carries the export-shape reminder.
- Glossary words stay as they are: **In Scene**, **Stranger**, **Met**, **Known In**, **Movement**. A character the story names under her Stranger Name while she is here is met by the existing Met rule, which this spec does not change.

## Testing Decisions

A good test calls the real function or runs a real turn with fake model replies, and asserts what the player would see: who is here, who is In Scene, and where the player stands. It never mirrors the implementation, and each guard is shown to fail when its bug comes back.

- **Seam 1, narration reading (pure).** Next to the existing narration-reading tests:
  - A full Stranger Name in prose names its entity, and a single word of it does not.
  - A name inside dialogue never pulls.
  - A named character in a direct child is pulled. One two levels down is not.
  - The Movement rule bites for both siblings and children: Stays Put never, Moves Between only into her own places, Free and Follow always.
- **Seam 2, the turn runner (fake replies).** Next to the existing turn-runner and plan tests:
  - The post-narration check runs in Auto mode after NONE. It does not run after a router move or with Location Changes off.
  - Suggest mode's offer sends the narration and offers the move without applying it.
  - It runs on the opening.
  - The move applies before the pull: a character in the room the player is carried into is not pulled back out.
  - Followers come along, and "stay here" stays.
- **Seam 3, the cloud probe.** The existing location-router probe gains two sets: narrations that carry the player to a reachable place, and narrations that only look toward or talk about one. It runs 10 of each on the cloud default model with in-batch controls, against the Q8 bar.
- All test and probe scenes are neutral and made up. The play log that found these gaps stays private. The real-world check replays it outside the repo, and reports per turn where the player stands and who is In Scene.

## Out of Scope

- **Invented-character discovery.** In the same log, a character the narration invented acted for five turns and was never discovered, because the person check misses beast-folk anatomy and physical verbs. That needs a rescore on the saved sessions, so it gets its own spec.
- Pulls from deeper than a direct child, from a parent, or across a Connection.
- Changing when a Known In pick replaces Nearby.
- A second narrated move inside one turn (Q7).
- Suggest mode's timing: it keeps offering moves only, and only on turns after the opening, as today.

## Further Notes

- On the play log, aliases plus the child pull alone would have pulled the chieftain into the village on turn 0, while the story had the player in her hut. The narrated move is what puts both in the same room, which is why it comes first (Q6).
- The new request costs one call on each turn where the router answers NONE, which is most turns. It is the price of Q4. Q7 keeps it off the turns that already moved.
