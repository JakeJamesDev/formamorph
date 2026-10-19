# Entity Presence

Status: ready-for-agent

## Problem Statement

An entity is present at every location it lists, all at once, and it never moves. The game keeps no record of where an entity is during play. Narration can carry an entity anywhere, but nothing remembers it.

This breaks two kinds of world:

- **Rooted entities leak.** The reachable roster lists everyone in the parent and sibling locations. The narrator can pull a tree sage that can't move, or a monarch busy on their throne, into the next scene.
- **Mobile entities don't move.** A companion who walks with the player is still listed at home. The next turn's roster no longer has them, so the narrator forgets them. A captain who walks between the keep and the watchtower is at both places at once.

An author has no way to say "this one stays", "this one walks between these places" or "this one can come with you".

## Solution

Each entity gets three new settings beside its existing Locations list. The game tracks where each moving entity is during play.

**Authoring** (entity panel, plus the Locations Canvas):

- **Locations**: the existing list. On the Locations Canvas, the author selects an entity and its locations tint. A click on a location adds it or removes it.
- **Presence** (shown with two or more locations):
  - **Everywhere Listed**: a group or a kind, present at every listed location. This is today's behavior and the default.
  - **One, at a Random Listed Place**: one individual, placed at one listed location at random when a new game starts.
- **Movement**:
  - **Free**: today's behavior. Not tracked, no AI call. The default.
  - **Stays Put**: never leaves where it is.
  - **Moves Between Its Locations**: moves one Connection hop at a time, only to its own locations.
  - **Can Follow the Player**: can join the player and travel with them.
- **Known In**: where the AI knows of the entity when it isn't present.
  - **Nearby**: one hop from where it is, as today. The default.
  - **Nowhere**: the AI learns of it only at its own location.
  - **Picked locations**: anywhere inside each picked location, at any depth. A queen in Rosewood's throne room, Known In Rosewood, is known at Rosewood's inn.

The Locations Canvas warns when two locations of a Moves Between entity have no Connection path through its own locations.

**Play:**

- Each turn, every tracked entity in the scene gets one small AI call. The calls run in parallel with the player's location request and in the same stage. Each reply is one option from a closed list.
- A follower travels with the player on every move: AI-routed, Map travel and code moves. It stays where it is when it stops following.
- Code and World Tools can move any entity.
- The entity panel marks followers. The Map shows the live position of each tracked entity the player has met.
- A new **Entity Movement** setting (on by default) turns the AI calls off. With it off, the author's rules still hold: rooted entities stay rooted and followers keep following.

## User Stories

1. As an author, I want an entity to stay where I put it, so that a rooted tree sage never appears in the next glade.
2. As an author, I want an entity to stay at its post, so that a monarch on their throne isn't narrated into the market.
3. As an author, I want existing worlds to play exactly as before, so that turning nothing on changes nothing.
4. As an author, I want new entities to default to today's behavior, so that I opt in to movement on purpose.
5. As an author, I want to place one individual at a random location from a list, so that a wandering merchant isn't always in the same place.
6. As an author, I want an entity listed in several places to be present at all of them, so that a group or a kind (lantern moths, the barrow dead) keeps working as it does today.
7. As an author, I want to choose between "one individual" and "everywhere listed" in one control, so that I don't set the start and the kind separately.
8. As an author, I want an entity to walk between a set of locations, so that a captain moves between the keep and the watchtower.
9. As an author, I want that walking to follow my Connections, so that an entity doesn't jump across the map.
10. As an author, I want a warning when an entity's locations aren't connected through its own locations, so that I don't strand a range by accident.
11. As an author, I want an entity to be able to follow the player, so that a companion comes along on the adventure.
12. As an author, I want a Moves Between entity to come along only inside its own locations, so that the captain walks to the tower with me but never into the barrow.
13. As an author, I want to hide an entity from the nearby roster, so that the AI doesn't learn about it before the player arrives.
14. As an author, I want nearby entities known by default, so that they are known as they are today.
15. As an author, I want to set an entity's locations on the Locations Canvas, so that placing the cast is visual and quick.
16. As an author, I want the canvas to tint an entity's locations when I select it, so that I see its range at a glance.
17. As an author, I want scripts to move any entity, so that I can build schedules and conditions (a wight that leaves its tomb when the crown is whole, a nightly raid).
18. As an author, I want a script that moves a Free entity to start tracking it, so that I don't change its Movement just to script it.
19. As an author, I want the persona to hide Presence and Movement, so that I don't set rules that the player's own travel overrides.
20. As a player, I want companions to come with me when I travel, so that the story keeps them in my scene.
21. As a player, I want a companion to keep following me, so that I don't re-invite them every move.
22. As a player, I want followers to come with me on Map travel, so that clicking a location doesn't strand my party.
23. As a player, I want followers to come with me when a script moves me, so that scripted travel keeps the party.
24. As a player, I want a companion who stays behind to be where I left them, so that I can come back for them.
25. As a player, I want my location request to stay as fast as it is today, so that turns don't slow down.
26. As a player, I want entity movement decided in parallel with my own move, so that it adds no wait.
27. As a player in suggest mode, I want followers to come along only when I press Go, so that Dismiss leaves everyone in place.
28. As a player in auto mode, I want followers to arrive with me before the narration, so that the new scene narrates them.
29. As a player, I want to see who is following me in the entity panel, so that I know who is in my party.
30. As a player, I want the Map to show where the entities I've met are, so that I can find them again.
31. As a player, I want the Map to hide entities I haven't met, so that it doesn't spoil the world.
32. As a player on a slow endpoint, I want to turn Entity Movement off, so that turns cost fewer requests.
33. As a player with Entity Movement off, I want rooted entities to stay rooted, so that the leak doesn't come back.
34. As a player, I want one member of a group to be able to follow me, so that one barrow soldier can chase me without the whole group leaving.
35. As a player, I want characters invented in play to be able to follow me, so that a stranger I meet can join the party.
36. As a player, I want an old save to keep working after the author deletes a location, so that an entity standing there reappears somewhere valid.
37. As a player, I want a world without tracked entities to send exactly the same requests as today, so that nothing changes in worlds that don't use the feature.
38. As a prompt tuner, I want the entity request to have its own editable prompt, so that I can tune it apart from the player's.
39. As a prompt tuner, I want the entity request pinned like the player's location request, so that it is as fast and as stable.
40. As a prompt tuner, I want the entity request to show in Request Anatomy, so that I can see exactly what it sends.
41. As an author, I want a famous entity known across a whole region, so that townsfolk at the inn can talk about the queen in the throne room.
42. As an author, I want to pick several regions, so that a queen is known in her own city and the next town.
43. As an author, I want a known entity to stay out of the scene, so that talk of the queen doesn't put her in the inn.
44. As an author, I want a known entity to send only its summary, so that a long list of famous names stays cheap.
45. As an author, I want to set Known In on the Locations Canvas, so that I see a reputation's reach on the map.
46. As an author, I want a reputation to stay put when its owner travels, so that the queen is still known in Rosewood while she is away.
47. As an author, I want Known In to fall back to Nearby when I delete its last picked location, so that the entity never silently goes unknown.

## Implementation Decisions

**Authored shape (world JSON).** Three optional entity fields. Each one's absence means today's behavior, so existing worlds need no migration:

- `presence`: `'random'` for one individual at a random listed location. Absent means everywhere listed.
- `movement`: `'stays' | 'between' | 'follow'`. Absent means Free.
- `knownIn`: `'nowhere'`, or a list of location ids. Absent means Nearby. Picks replace Nearby, so the list is the whole answer.

The persona entity ignores Presence and Movement, and the editor hides them for it. An entity with Presence Everywhere offers only Free, Stays Put and Can Follow the Player: a group is at all its places at once, so Moves Between has no meaning for it.

**Runtime shape (save envelope, Gameplay side only).** Gameplay never writes GameDataContext.

- A per-entity position map (entity id → location id), beside the per-entity stat map.
- The set of entity ids that are following the player.
- The set of entity ids the player has met. An entity joins it the first time it is in the scene list with its name revealed. An alias-only stranger does not join until the narration names them.
- An entity has a position when its Presence is One, when its Movement is not Free, or when code has moved it.
- A runtime character's existing `locationId` is its position. Runtime characters get Can Follow the Player.

**Presence roster.** The existing presence module stays the one inversion of membership. It gains a runtime layer: a tracked entity is at its position; an untracked entity is at all of its listed locations. Every roster during play (present, in scene, sublocations, reachable, known) reads through it. The reachable roster lists only entities whose Known In is Nearby.

**Known roster.** A new `<ENTITIES|known>` chip scope lists each entity that is known at the player's location but not present. An entity is known there when one of its picked locations is the player's location or contains it at any depth.

- Each known entity sends only its AI summary.
- Picks stay fixed when the entity moves. Only Nearby follows its position.
- The existing highest-scope-wins rule applies, so an entity here, in a sublocation or reachable isn't listed again as known.
- The chip joins every default prompt that already uses `<ENTITIES|reachable>`. Each changed default prompt ships with probe numbers.
- Deleting a location drops it from every Known In list. An empty list falls back to Nearby.
- The persona hides Known In, and the known roster never lists the persona.

**New game.** Each entity with Presence One draws one listed location at random. A tracked entity with Presence Everywhere has no single position; it stays at all of its listed locations.

**The entity location request.** A new turn pass, one request per tracked entity in the scene (fan-out). It mirrors the player's location request:

- It runs in the same stage: before narration in auto mode, after narration in suggest mode.
- It shares the player request's due rules, plus the Entity Movement setting.
- It has its own editable prompt in the Prompts list, with sampler pins and a reasoning mode that match the player's location request.
- The reply is one name from a closed candidate list, matched by the same matcher as the player's reply. The token cap is the longest candidate plus a small slack.
- Candidates by Movement:
  - **Stays Put**: no call.
  - **Moves Between**: stay, come along, or each of its own locations that is one hop away through the router's effective destinations.
  - **Can Follow** (not following): stay, or come along.
  - **Following**: keep following, or stay here.
- The entity request does not wait for the player's request. It returns an intent. The turn commit joins the two.

**Turn commit (the join).** The commit applies, in order:

1. The player's move, from the AI router, from code or from Map travel.
2. Followers move with the player. They ignore Connections, since player travel is free (ADR-0006).
3. "Come along" applies only when the player moves. For a Moves Between entity it applies only when the destination is one of its own locations. Otherwise the entity stays.
4. In suggest mode, intents wait for the player's choice. Go applies them; Dismiss drops them.
5. Code moves of entities apply last, so a script has the final word.

- "Come along" adds the entity to the followers. "Stay here" removes it. Following is sticky until then.
- A One entity is in one place after any move.
- An Everywhere entity that comes along does not move. One member peels off as a new runtime character named after the group, already following. The group stays where it is.
- Map travel has no turn and no AI call. It applies only step 2.

**Code and World Tools.** Each entry of the existing `entities` record gets three writes: `entities["Name"].move(target)`, `.follow()` and `.unfollow()`. `move` resolves the target by id, then by name, and an unknown target throws. The writes work on any entity, and a write on a Free entity starts tracking it. `follow` and `unfollow` add the entity to the followers or remove it.

**Saves and stale data.** On load, a position on a location that no longer exists falls back to the Presence start rule. A follower or position for an entity that no longer exists is dropped. The world stays authoritative for saves.

**Setting.** **Entity Movement**, on by default, in the location settings. Off stops only the entity location requests. Stays Put, Presence, sticky followers and code moves still apply.

**Player UI.**

- The entity panel marks followers. This is a new visual pattern and needs the user's approval before it is built.
- The Map shows the live position of each tracked entity in the met set.

**Editor UI.**

- Presence, Movement and Known In sit in the entity panel.
- The Locations Canvas gets an entity selection mode with a switch between **Locations** and **Known In**. Locations shows a solid tint, and a click toggles membership. Known In shows a lighter tint over each picked subtree, and a click toggles a pick. These visuals need the user's approval before they are built.
- The canvas warns about a Moves Between entity whose locations aren't connected through its own locations.
- Every new screen or modal state gets a dev-route entry.

## Testing Decisions

A good test calls the real module through its public interface and asserts what a player or author would see. It never mirrors the code, and it proves each guard bites by reinstating the bug.

Three seams, all existing and pure:

1. **Presence roster.** Who is present, in scene, reachable and known for a given world, positions map and follower set. This includes subtree depth for picks, highest scope wins, and the empty-list fallback. Prior art: the presence module's own tests and the location context tests.
2. **Turn commit.** Most rules live here: the join order, sticky following, "come along" only on a move, the Moves Between limit, the suggest-mode Go and Dismiss, collapse for One, peel-off for Everywhere, code moves last, and the stale-position fallback. Prior art: the turn commit tests.
3. **Stat code executor.** The `move`, `follow` and `unfollow` writes: target lookup by id and name, the unknown-target throw, and tracking a Free entity. Prior art: the executor's world-write tests.

Also:

- The turn pass tests cover the new pass's due rules, its fan-out per tracked scene entity, and its candidate list.
- The parity suite stays byte-equal for a world with no tracked entities and no new fields. This proves existing worlds send the same requests.
- **Probes.** The entity request needs probe numbers on the cloud default, with the player's location pass as the in-batch control, on the Emberwatch cast. A local run measures how the fan-out queues on the local engine's single slot. Both run under the probe skill's policy.

## Out of Scope

- Off-screen AI movement. Entities move off-screen only through code.
- Schedules, time-of-day routines and presence conditions as fields. Code covers them.
- A home location and automatic return home.
- Counted group members (how many of a group are where).
- Gating player travel on Connections (ADR-0006 stands).
- Movement for the persona.

## Further Notes

- **Export shape:** three new entity fields in world JSON, all additive. **Save shape:** a positions map, a follower set and a met set in the save envelope.
- The version is user-managed. Do not bump it.
- If the Entity Movement setting gets a `DEFAULT_*` with a `VITE_DEFAULT_*` twin, remind the user about `.env.local`.
- ADR-0003 expected this feature as the refinement of the entity-owned membership field. A new ADR may record "authored membership, runtime position".
- The Emberwatch walkthrough that drove these rulings: Wenna Tallow, Mother Hesk, the Wight and the Barrow Dead Stay Put; Captain Blackwell Moves Between the Keep and the Watchtower; Albus, Sylvie and Corvin Can Follow.
