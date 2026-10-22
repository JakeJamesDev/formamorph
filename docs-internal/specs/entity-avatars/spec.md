# Entity Avatars

Status: ready-for-agent
Spec session: entity-avatars — spec

## Problem Statement

A world has one Avatar, and only the player shows it. An author turns it on with the world's **3D Player Avatar** checkbox and can upload one custom VRM for it. No other entity can show an Avatar. An author who wants a companion, a rival or a world persona to appear as a VRM has no way to do it. Two entities can't share one Avatar, and a world can't hold more than one.

The checkbox also mixes two jobs: it shows the Avatar in play, and it adds the avatar step to Enter World. Once every entity can carry its own Avatar, the checkbox no longer means anything to an author.

## Solution

Avatars move from the world to the entity.

- A world keeps a store of Avatars. The author adds them in the World Overview, by file upload or by copying one from their Avatar library.
- Each world entity picks one Avatar from a dropdown: None, User's Default, or one of the world's Avatars. Entities can share an Avatar.
- Each library entity picks from the player's Avatar library, None, or User's Default.
- The player marks one library Avatar as their default, the same way they mark a default persona.
- In play, one entity view shows the selected entity's Avatar, 3D model or image, in that order of preference. The player's own choice of visual overrides the order, as it does today for models and images. The separate player Avatar tab goes away, on landscape and on mobile.
- The **3D Player Avatar** checkbox leaves the editor. Old worlds keep working through a hidden legacy fallback.

## User Stories

1. As an author, I want to add several Avatars to my world, so that different entities can appear as different VRMs.
2. As an author, I want to upload an Avatar file into my world, so that the world carries it when I share it.
3. As an author, I want to copy an Avatar from my Avatar library into my world, so that I don't hunt for the file on disk again.
4. As an author, I want each world Avatar to have a display name, so that I can tell them apart in the entity dropdown.
5. As an author, I want to rename a world Avatar without breaking the entities that use it, so that tidying names is safe.
6. As an author, I want to manage the world's Avatars in the World Overview, so that I find them where the player Avatar used to be.
7. As an author, I want to pick an entity's Avatar from a dropdown, so that assigning one is one step.
8. As an author, I want two entities to share one Avatar, so that I don't embed the same file twice.
9. As an author, I want an entity's Avatar to start on None, so that no entity gains an Avatar until I choose one.
10. As an author, I want to set an entity to User's Default, so that it shows whatever Avatar the player prefers.
11. As an author, I want to give my Custom Persona an Avatar, so that the player under None appears as it.
12. As an author, I want to give each world persona its own Avatar, so that the player looks different depending on who they play.
13. As an author, I want a confirmation that names the entities using an Avatar before I delete it, so that I know what changes.
14. As an author, I want entities that used a deleted Avatar to fall back to None, so that the world never holds a broken reference.
15. As an author, I want my stat morph bindings to list the morphs of every Avatar in my world, so that I can bind stats for any of them.
16. As an author, I want to know before publishing when my world's Avatars push it over the size limit, so that an upload doesn't fail at the end.
17. As a player, I want to mark one Avatar in my library as my default, so that User's Default shows the Avatar I like.
18. As a player, I want a **Default** badge on that Avatar's tile, so that I can see which one is my default.
19. As a player, I want to clear my default Avatar, so that I can go back to the bundled one.
20. As a player, I want User's Default to show the bundled Avatar when I have no default, so that it always shows something.
21. As a player, I want my default Avatar to stay on my device and out of exports, so that it is my preference, not world data.
22. As a player, I want my library entities to carry an Avatar pick, so that they look the same in every world I add them to.
23. As a player, I want my library persona's Avatar to show while I play it, so that my persona keeps its look across worlds.
24. As a player, I want a library entity copied into a world to bring its Avatar along, so that the world shows it on any device.
25. As an author, I want an exported character card or entity listing to carry the Avatar I picked for that entity, so that whoever imports it sees the same Avatar.
26. As a player, I want a warning that names the library entities using an Avatar before I delete it from my library, so that I know which entities lose it.
27. As a player, I want the entity view to show an entity's Avatar first, then its 3D model, then its image, so that the richest visual shows by default.
28. As a player, I want to switch an entity between its Avatar, model and image, so that I can choose the view I like.
29. As a player, I want my choice of visual to stick for that entity, so that I don't switch it again every turn.
30. As a player, I want selecting an entity to swap the view to its visual, so that Avatars behave like images and models do today.
31. As a player, I want the entity view to start on my played entity when it has a visual, so that I see myself on entering, as I do today.
32. As a player, I want the view to start on the first scene entity with a visual when my played entity has none, so that the view is never empty without reason.
33. As a player, I want to select my played entity in the list, so that I can return to my own Avatar after looking at someone else.
34. As a player of an old world with no persona, I want a **You** row that shows my Avatar, so that I can return to it after selecting someone else.
35. As a mobile player, I want the same entity view as landscape, so that I can see other entities' Avatars on my device too.
36. As a player, I want my Avatar's body to keep reacting to stats as it does today, so that existing worlds keep their morph effects.
37. As a player, I want other entities' Avatars to react to their own stats, so that they behave like entity 3D models.
38. As a player, I want the Enter World avatar step whenever my chosen persona has an Avatar, so that I can customize how I look.
39. As a player, I want the avatar step to appear or disappear as I change my persona pick, so that the steps match who I will play.
40. As a player, I want to pick my Avatar in that step only when my entity uses User's Default, so that an author's chosen Avatar stays as the author set it.
41. As a player, I want the step to start on my default Avatar, so that I don't pick it again for every new game.
42. As a player, I want to change the Avatar in that step for one save, so that I can try a different look without changing my default.
43. As a player, I want my customization (colors, sliders) to apply only to my played entity's Avatar, so that NPCs keep their authored look.
44. As a player who skips setup with Quick Start, I want my Avatar customized with defaults, so that it still shows.
45. As a player, I want no avatar step when my played entity has no Avatar, so that worlds without Avatars start faster.
46. As a player of an old world that had the **3D Player Avatar** checkbox on, I want to see the same Avatar as before under any persona, so that the update changes nothing for me.
47. As a player of an old world, I want its persona entities to look the same as NPCs as they did before, so that the migration doesn't change their portraits.
48. As a player of an old world with no checkbox value, I want no Avatar, so that worlds that never chose one stay without one.
49. As a player of a bundled world, I want no Avatar to appear after the update, so that worlds that had it off stay off.
50. As a player with an old save that used the world's Avatar or a library Avatar, I want the save to keep showing it, so that loading an old save changes nothing.
51. As an author of an old world, I want the hidden fallback to go away once my Custom Persona has an Avatar, so that my world holds one rule, not two.
52. As an author, I want the old **3D Player Avatar** checkbox gone, so that the editor offers only the per-entity way.
53. As a player of a community world, I want shared worlds to carry their Avatars, so that downloads show what the author made.
54. As a reader of the docs, I want the Avatar pages to describe per-entity Avatars, so that help matches the app.

## Implementation Decisions

**World store (Q2, Q3, Q17)**
- The world overview gains an Avatar store: a map from an id to an embedded media asset plus a display name. New ids come from the project's UUID helper.
- Entities refer to an Avatar by store id, so a rename touches only the store.
- Copying from the Avatar library embeds the bytes. A world never refers to a device-local library id.
- The World Overview's Avatar section manages the store. It replaces the Player Avatar uploader and the **3D Player Avatar** checkbox.
- Publish checks the store's total size against the server's world limit before upload.
- The stat morph-binding picker lists the morphs of every store Avatar. Today it reads only the old world Avatar.

**Entity pick (Q11, Q16, Q18, Q23)**
- A world entity gains an optional Avatar pick with three forms: none, user's default, or a world store id. Absent means none.
- A library entity gains the same optional pick, where the third form is a library Avatar id.
- The field's name must not read as Profile Image, which is what "avatar" means in code today.
- Deleting a store Avatar sets every entity that used it to none, after a confirmation that names them.
- Deleting a library Avatar names the library entities that use it as well as the saves. Their picks become none.
- Copying a library entity into a world embeds its library Avatar into the world store and rewrites the pick to the new store id. A library id that no longer resolves becomes none. The library-link review flow treats the pick like any other field.
- Exports of a library entity (character cards, entity listings) embed the picked library Avatar in the file (Q23, reopened). Picks of none or user's default export as they are.
- Importing an entity file that carries an Avatar adds it to the Avatar library, reusing an existing record with the same content hash, and rewrites the pick to that library id.
- Publishing an entity listing checks its size, Avatar included, against the server's entity limit before upload.
- A library id that doesn't resolve on this device resolves like a missing default.

**User's default Avatar (Q1, Q9)**
- It follows the default-persona pattern: a device-local key, set and cleared from the Avatar library tile's menu, marked with a **Default** badge, never exported.
- When no default is set, or the default no longer exists, User's Default resolves to the bundled Avatar file. Deleting the library copy of the bundled Avatar does not matter.

**Resolver (new pure module)**
- One pure function resolves an entity, in context, to its Avatar source: a world store id, a library id, the bundled file, or nothing.
- Its inputs are the entity's pick, the world store, the device default, the played persona, the save's chosen Avatar, and the legacy fallback.
- An entity that isn't played shows its own pick and nothing else.
- The played side resolves by persona source (Q4, Q7, Q21). The first source that is not none wins:

| Played as | 1st | 2nd | 3rd |
|---|---|---|---|
| A library persona | The library persona's pick | The Custom Persona's pick | The legacy fallback |
| A world persona | That entity's pick | The legacy fallback | none |
| None | The Custom Persona's pick | The legacy fallback | none |

- The save's chosen Avatar replaces User's Default for the played entity only (Q10). A legacy save's chosen Avatar replaces the played-side result as well (Q24).

**Legacy fallback and migration (Q4, Q5 dropped, Q13, Q20, Q22)**
- The migration reads the raw value of the old 3D Player Avatar flag. Only an explicit `true` turns the fallback on. A missing value or `false` means no Avatar. The load normalization that fills a missing value with `true` goes away. So do the other places that default it to `true`, in the initial world state and the default-world seed.
- An explicit `true` that the editor once wrote back counts like an author's `true` (Q20). The two can't be told apart.
- With the flag on and an old world Avatar present, that Avatar moves into the store under a fixed, reserved id. The id must not change between loads, because the migration runs on every load and stored worlds are not rewritten. The fallback points at that id.
- With the flag on and no old world Avatar, the fallback resolves to User's Default.
- The migration assigns no Avatar to any entity and creates no Custom Persona (Q22). Persona entities keep their NPC look. The fallback covers them while they are played (Q21).
- The migration is idempotent.
- The editor drops the fallback once the world has a Custom Persona whose pick is not none (Q13).
- The old world Avatar field and both old editor-history labels go away.

**Saves (Q24)**
- The save migration has no world, so the save's chosen-Avatar remap runs at game load, where the world is known.
- A chosen Avatar of unset or "the world's" remaps to the fixed legacy store id, or to nothing when the world had no old Avatar.
- A save made before this change keeps a library Avatar it chose, even when Q10 would lock the picker today.
- The chosen Avatar must tell a world store id apart from a library id.
- The per-entity visual preference gains an Avatar value next to model and image.
- The saved persona and library-entity snapshots carry the Avatar pick.

**Play (Q6, Q8, Q12, Q14, Q19)**
- The entity visual component gains the Avatar as a third visual. The default order is Avatar, then 3D model, then image. The stored preference overrides it.
- The player Avatar tab goes away on landscape and on mobile. Mobile's tab becomes the entity view.
- At game start the view shows the played entity when it has a visual. Otherwise it shows the first scene entity with one.
- The played entity's Avatar takes its morphs from the player view's active stats, and its colors and sliders from the save's avatar customization, as the player Avatar does today.
- Other entities' Avatars take morphs from their own stats, like entity 3D models.
- When the legacy fallback applies and there is no played entity, the entity list shows a **You** row. It selects the fallback Avatar and opens no popup. Today the You row needs a persona entity, so under None with no Custom Persona it doesn't render.

**Enter World (Q10)**
- The avatar step follows the draft persona. It shows when the played entity would resolve to any Avatar, and its label (Continue to Avatar or Start Game) updates when the persona pick changes.
- The Avatar picker in the step shows only when that Avatar is User's Default. It lists library Avatars only and starts on the device default. The old "World Avatar" option goes away.
- Default avatar customization is seeded whenever the played entity resolves to an Avatar, on Quick Start too, and for old saves that hold none.

**Docs and dev routes**
- The player docs that describe the checkbox get rewritten for per-entity Avatars: the Avatars page, the World Editor overview, Starting a Game, and the world-format page. Help vectors are rebuilt after.
- New dev routes cover the World Overview Avatar section and the delete confirmation.

**Export shape**
- World: the Avatar store, the entity Avatar pick, the hidden legacy fallback, and the removal of the old world Avatar field and the editor-facing flag.
- Library entity: the Avatar pick. Character card and entity listing: the Avatar pick plus the embedded Avatar file.
- Save: the chosen-Avatar remap, the new visual-preference value, and the pick on saved snapshots.

## Testing Decisions

A good test drives a public seam with real inputs and asserts what a player or author sees. It never mirrors the implementation. Each guard is proven by reinstating the bug it prevents.

- **Migration** (prior art: `version.test.ts`): a missing flag, `false`, `true` without an old Avatar, `true` with one, a world that already has a Custom Persona, persona entities left unassigned, a second run (idempotency), and the same store id across two loads.
- **Save remap at game load:** saves whose chosen Avatar is unset, "the world's", or a library id, including Q24's legacy library pick.
- **Resolver** (new; prior art: `statPanelEntities.test.ts`): every cell of the precedence table, an entity's pick over the fallback, a missing default resolving to the bundled file, a deleted store id, an unresolvable library id, and the save's chosen Avatar touching only the played entity.
- **One entity view** (GamePanels harness; prior art: `EntityVisual.test.tsx`, `useEntityVisualPreference.test.ts`): Avatar before model before image, the stored preference overriding it, a swap on selection, the played entity first, the scene fallback, mobile, and the You row in a legacy-fallback world.
- **Avatar step** (prior art: `enterFlow.test.ts`): shown for any Avatar, skipped for none, a step list that changes with the persona pick, and the picker only on User's Default.
- **Editor** (worldEditorBench): add by upload and by library copy, rename, the entity dropdown's options and default, delete with the named confirmation, and the fallback dropped once a Custom Persona has a pick.
- **Library copy, export and import:** a library entity copied into a world embeds its Avatar; a character-card export embeds the picked Avatar; importing that card adds the Avatar to the library once (same hash, one record) and points the pick at it.

## Out of Scope

- Per-save customization of NPC Avatars.
- Locking or forcing an Avatar against the player's per-save pick beyond Q10's rule.
- Avatar animation, expressions or lip sync changes.
- Publishing world Avatars as separate community listings.
- Removing the read path for the legacy fallback. It stays for files in the wild.

## Further Notes

- Glossary: **Avatar** in `CONTEXT.md` still says "chosen for a world". It needs an update to "chosen for an entity" once this lands. Add **User's Default** as a term.
- All eight bundled worlds have the flag set to `false`, so none of them change.
- The server caps a world at 100 MB and an entity listing at 25 MB.
- Rulings Q1–Q19 come from the 2026-10-22 grill. The spec review added Q20–Q24, and Q22 dropped Q5. The user reopened Q23: an exported entity carries the Avatar its author picked. One extra ruling from the user: a missing flag means no Avatar.
