# Entity Presence

Status: done
Status note: 2026-10-20. Tickets 01–09 are done. Last landing is 5ea4fa653. Gates on 2026-10-20: typecheck, test and build green; lint red only on the untracked worlds-wip/cb-3.3.2-live.ts. The planner cast fix is a separate effort.
Spec session: entity-presence — spec

## Problem Statement

An entity is present at every location it lists, all at once, and it never moves. The game keeps no record of where an entity is during play. Narration can carry an entity anywhere, but nothing remembers it.

This breaks two kinds of world:

- **Rooted entities leak.** The reachable roster lists everyone in the parent and sibling locations. The narrator can pull a tree sage that can't move, or a monarch busy on their throne, into the next scene.
- **Mobile entities don't move.** A companion who walks with the player is still listed at home. The next turn's roster no longer has them, so the narrator forgets them. A captain who walks between the keep and the watchtower is at both places at once.

An author has no way to say "this one stays", "this one walks between these places" or "this one can come with you".

## Solution

Each entity gets three new settings beside its existing Locations list. The game tracks where each moving entity is during play.

**Authoring** (the full-screen Locations Canvas, plus each location's **Presence** tab):

- **Locations**: the existing list. On the full-screen Locations Canvas, the author picks an entity, and its locations show a pin and a solid tint. A click on a location adds it or removes it.
- **Presence** (shown with two or more locations):
  - **Everywhere Listed**: present at every listed location at once. This is today's behavior and the default.
  - **One, at Random**: one individual, placed at one listed location at random when a new game starts.
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

The played persona ignores Presence and Movement: it has no position and gets no request. The editor hides both only for the entity with the **Custom Persona** mark, which is always the player. A world entity with the Persona mark keeps both, since it is in the cast whenever someone else is played; its controls carry the hint "Ignored while the player plays this entity". An entity with Presence Everywhere offers only Free, Stays Put and Can Follow the Player: a group is at all its places at once, so Moves Between has no meaning for it.

**Runtime shape (save envelope, Gameplay side only).** Gameplay never writes GameDataContext.

- A per-entity position map (entity id → location id), beside the per-entity stat map.
- The set of entity ids that are following the player.
- The set of entity ids the player has met. An entity joins it the first time it is in the scene list with its name revealed. An alias-only stranger does not join until the narration names them.
- An entity has a position when its Presence is One, when its Movement is not Free, or when code has moved it.
- A runtime character's existing `locationId` is its position. Runtime characters get Can Follow the Player, with no new field. Only runtime characters in this turn's scene list (the recent participants) get a stay / come-along request, not every one anchored at the location; a following one always gets its keep-following request. This keeps the fan-out small, since runtime characters pile up at often-visited locations.
- A runtime character peeled from an Everywhere Listed entity carries an optional `peeledFrom` with the source entity's id, which the one-at-a-time rule reads. Its name and aiSummary are the source's; its aiDescription is the source's aiSummary, or its aiDescription when the summary is empty.

**Presence roster.** The existing presence module stays the one inversion of membership. It gains a runtime layer: a tracked entity is at its position; an untracked entity is at all of its listed locations. Every roster during play (present, in scene, sublocations, reachable, known) reads through it. Known In governs every roster for entities that aren't present: the sublocations and reachable rosters list only entities whose Known In is Nearby. Nearby keeps today's behavior for both.

**Nearby through Connections.** Today the reachable roster is the parent and siblings in the location tree, so in a world of top-level locations joined only by Connections, Nearby reaches nobody. A new optional location field fixes this without changing old worlds:

- `nearbyUsesConnections`: when `true`, the location's reachable roster uses the router's effective destinations from it (tree neighbors plus Connection legs, one-way legs respected). Absent means today's tree-only rule.
- A location created in the editor gets `true`. `migrateWorld` never sets it, so no old world changes on load.
- The location's **Presence** tab shows it as a checkbox beside its Connections, so an author can opt an old location in.
- The highest-scope-wins rule still applies, so a child reached through the tree stays in the sublocations scope.
- Bundled worlds opt in where travel happens: every location that at least one Connection leg leaves gets `true`. That change ships with a probe run and regenerated fingerprints.
- The default planner prompt casts reachable entities as present: its Cast rules never say they are elsewhere. Ticket 09's probe found it (Emberwatch square, neutral action: 0 of 8 runs before, 8 of 8 after). The user ruled to land ticket 09 anyway. Fixing the planner's cast rules is a larger effort outside this spec (see Out of Scope).

**Known roster.** A new `<ENTITIES|known>` chip scope lists each entity that is known at the player's location but not present. An entity is known there when one of its picked locations is the player's location or contains it at any depth.

- Each known entity sends only its name and AI summary. The scope ignores the Full content option (Full renders as Summary; Name still renders names) and drops owned traits and stats.
- Picks stay fixed when the entity moves. Only Nearby follows its position.
- The existing highest-scope-wins rule applies, so an entity here, in a sublocation or reachable isn't listed again as known.
- The chip joins every default prompt that already uses `<ENTITIES|reachable>`, right after that line, with a header in the same form that says these entities aren't present. Default prompts means the app's own defaults plus any experimental prompt a player can select. The Open Chat world's narration and choices prompts change with the defaults, because a test holds them to every context chip the defaults carry. The other bundled world prompts that use `<ENTITIES|reachable>` change with the bundled worlds (ticket 09). Each changed prompt ships with probe numbers.
- `nearbyUsesConnections` changes only the entity roster. `<LOCATION|reachable>` stays tree-only, since `<LOCATION|destinations>` already carries Connections. The flag is read on the player's location; an entity counts when any place it is at is among that location's effective destinations.
- The Test Bench's AI Context roster gains a **Known Here** scope, so it shows what the prompt receives.
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
- "In the scene" means the present roster at the player's location when the turn starts: entities positioned there, plus followers. This holds in both modes.
- With **Concurrent Turn Requests** on, the entity requests go in the same batch as the player's location request. With it off, they run one at a time after the player's request.
- A failed entity request is dropped: that entity does nothing this turn, and the turn goes on.
- An Everywhere Listed entity has no position, so it gets no request until peel-off exists.
- "Stay here" applies before the player's move, so the entity stays at the location the player leaves. "Come along" applies after the move.

**Turn commit (the join).** The commit applies, in order:

1. The player's move, from the AI router, from code or from Map travel.
2. Followers move with the player. They ignore Connections, since player travel is free (ADR-0006).
3. "Come along" applies only when the player moves. For a Moves Between entity it applies only when the destination is one of its own locations. Otherwise the entity stays.
4. In suggest mode, only "come along" waits for the player's choice. Go applies it; Dismiss drops it. "Stay here" and "go to a location" apply at once, since they don't depend on the player's move.
5. Code moves of entities apply last, so a script has the final word.

- For a Can Follow entity, "come along" adds it to the followers. "Stay here" removes it. Following is sticky until then.
- For a Moves Between entity, "come along" moves it once, with the player. It never joins the followers, so the next move can't carry it outside its own locations.
- A One entity is in one place after any move.
- An Everywhere entity that comes along does not move. A new runtime character with its name joins the followers, and the Everywhere entity stays where it is.
- An Everywhere entity peels one follower at a time. While one of its runtime characters is following, it gets no request. Once that follower stays behind, it can be offered "come along" again.
- Map travel has no turn and no AI call. It applies only step 2.

**Code and World Tools.** Each entry of the existing `entities` record gets three writes: `entities["Name"].move(target)`, `.follow()` and `.unfollow()`. `move` resolves the target by id, then by name, and an unknown target throws. The writes work on any entity, and a write on a Free entity starts tracking it. `follow` adds the entity to the followers and moves it to the player's location. `unfollow` removes it from the followers and leaves it where the player is.

- The three writes on the persona, however it is reached, throw "The persona moves with the player". An unknown entity throws "The game has no entity named "<name>"" and fails the run.
- `move` on a follower also removes it from the followers. `unfollow` on an entity that isn't following changes nothing; only `move` and `follow` start tracking.
- Entity writes from every turn timing collect with the other world writes and apply at the commit, after followers and entity replies. Prompts of the same turn don't see them. Runs outside a turn drop them, as they drop `location.move`.
- In suggest mode, a code write on an entity whose "come along" waits on Go removes it from the pending offer.
- Test Code lists one line per write, for example `entities.Wight.move: Barrow` and `entities.Albus.follow()`.

**Saves and stale data.** On load, a position on a location that no longer exists falls back to the Presence start rule. A follower or position for an entity that no longer exists is dropped. A One entity with no saved position is placed by the Presence rule. The world stays authoritative for saves.

Load keeps every other position, because it can't tell a new-game draw from a code move. So switching an entity from One to Everywhere Listed reaches an existing save only on a new game.

**Setting.** **Entity Movement**, on by default, in the location settings. Off stops only the entity location requests. Stays Put, Presence, sticky followers and code moves still apply.

**Player UI.**

- The entity panel marks followers. This is a new visual pattern and needs the user's approval before it is built.
- The Map shows the live position of each tracked entity in the met set.

**Editor UI.**

The prototype settled this layout (variant D, see Prototype). The user approved its visuals.

- **Full-screen canvas only.** The embedded canvas in the Locations tab shows none of this; it has no room.
- **Inspector card** (top right): an entity picker (**Choose an entity**), a **Close Entity** button, a **Locations** / **Known In** toggle with a pin and a megaphone icon, then **Presence**, **Movement**, the range warning and **Known In**.
- **Marks on the canvas**, while an entity is picked:
  - Its locations: solid tint plus a pin icon.
  - Its Known In picks: a megaphone icon, and a dashed outline over each pick's whole subtree.
  - Every other location fades to 30% opacity. Connections and their labels fade to 25%.
- **Picking is read-only.** While an entity is picked, the canvas is a picker, not an editor:
  - No node drag, no nesting, no Connection drawing or editing, no selection or marquee, no context menu, no nudge keys, and no toolbar.
  - A drag with any mouse button pans. A click or tap toggles the location for the current mode.
  - Find a Location, zoom and the minimap still work.
  - Escape leaves picking first. A second Escape leaves full screen.
- **Location Presence tab.** Below the existing **Entities** field:
  - **Entities Here**: one row per entity at this location, with its **Movement** select, its **Presence** toggle when it lists other locations, and the range warning.
  - **Known Here**: each entity known at this location. A pick on this location shows **Remove**; a pick on a parent shows "Known in <parent>". A select adds this location to an entity's Known In.
- **Entity panel.** It holds no Presence fields. A hint points to the canvas: "Set **Presence**, **Movement** and **Known In** on the full-screen **Locations Canvas**".
- The canvas warns about a Moves Between entity whose locations aren't connected through its own locations. One warning names every unreachable location, joined with commas and "and", measured from the entity's first listed location.
- The entity picker lists every entity. For the Custom Persona the card shows only **Locations** mode and the persona hint, with no **Known In** toggle. A Persona-marked world entity keeps every control.
- Choosing **Picked Locations** while the entity has no picks stores nothing. It switches the card to **Known In** mode, and the select shows Picked Locations until the author leaves that mode. The first click stores the first pick.
- Picking closes the Connection inspector. When not picking, the Connection inspector stacks above the card in one top-right column.
- Every new screen or modal state gets a dev-route entry.

**Copy.** Swept with `copy:sweep` (0 notices) and settled with the user. "Group" and "kind" never appear in the UI: neither is defined.

| Control | Help line |
| --- | --- |
| Presence: Everywhere Listed | Puts it at every listed location at once |
| Presence: One, at Random | Places it at one of its locations at random in each new game |
| Movement: Free | Keeps no position. It appears at every listed location and costs no AI request. |
| Movement: Stays Put | Never leaves its location. Costs no AI request. |
| Movement: Moves Between Its Locations | Moves one Connection at a time, only between its own locations |
| Movement: Can Follow the Player | Joins the player when the AI decides, then travels with them until it stays behind |
| Can Follow, with Everywhere Listed | Adds a new entity with this name that travels with the player. This one stays at every listed location. |
| Known In: Nearby | Sends its summary to the AI one step away from where it is |
| Known In: Nowhere | Sends it to the AI only at its own location |
| Known In: Picked Locations | Sends its summary to the AI anywhere inside the picked locations |
| Persona | Moves with the player, so **Presence**, **Movement** and **Known In** don't apply |
| Canvas, Locations mode | Click a location to add it or remove it |
| Canvas, Known In mode | Click a location to pick it. A pick covers every location inside it. |
| Known Here | Sends these entities' summaries to the AI anywhere inside this location. They aren't here. |
| Known Here add select (placeholder) | Make an entity known here |
| Known Here **Remove** (tooltip) | Removes this location from <entity>'s Known In |
| Nearby Through Connections (checkbox) | Adds entities one Connection away to what the AI receives as nearby |
| Chip Options scope: **Known** | Sends the summaries of entities whose **Known In** covers this location |
| Range warning | <Entity> can't reach <location> from <location> through its own locations. Add the location between them, or a Connection. |

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
- The planner's cast rules for nearby and known entities. The default planner prompt casts them as present; fixing that is its own effort.

## Further Notes

- **Export shape:** three new entity fields and one new location field in world JSON, all additive. **Save shape:** a positions map, a follower set and a met set in the save envelope, plus an optional `peeledFrom` on runtime character records.
- The version is user-managed. Do not bump it.
- If the Entity Movement setting gets a `DEFAULT_*` with a `VITE_DEFAULT_*` twin, remind the user about `.env.local`.
- ADR-0003 expected this feature as the refinement of the entity-owned membership field. A new ADR may record "authored membership, runtime position".
- The Emberwatch walkthrough that drove these rulings: Wenna Tallow, Mother Hesk, the Wight and the Barrow Dead Stay Put; Captain Blackwell Moves Between the Keep and the Watchtower; Albus, Sylvie and Corvin Can Follow.

The logic model found two more gaps, now ruled: Nearby in a flat world (see Nearby through Connections) and groups peeling every turn (one peel at a time, see the turn commit).

## Prototype

Both prototypes live on branch `prototype/entity-presence` (worktree `.claude/worktrees/prototype-entity-presence`). Neither lands on main.

**Logic model.** Question: do the turn rules feel right in real turns? File: `docs-internal/specs/entity-presence/prototype/entity-presence-model.html` on the prototype branch (commit 8e8f9bf75); open it with a double-click. Verdict: the rules hold. The user accepted its three choices, now in Implementation Decisions:

- Moves Between "come along" moves once and never joins the followers.
- `follow()` brings the entity to the player's location.
- In suggest mode only "come along" waits for Go.

**UI prototype.** Question: where and how does an author set Presence, Movement and Known In? Launch entry `prototype-entity-presence`, port 5262; open the Rosewood (Prototype) world in the World Editor, with `?variant=A|B|C|D`. Variants: A Canvas Inspector, B Entity Panel First, C Location-First Cast, D Inspector + Icons, Full Screen Only. Verdict: **D**, with C's location Presence tab. Final commit e937dee78. Rounds after the first pick:

- Icons for Locations and Known In, in addition to the shading; C's letter badges rejected.
- The inspector shows on the full-screen canvas only.
- The canvas is read-only while picking, and every mouse button pans.
- Locations the entity doesn't touch fade out.
- Copy swept; "group" and "kind" removed.

The sample world in the prototype seats Captain Aldric at the Barracks and the City Gate on purpose, to show the range warning.
