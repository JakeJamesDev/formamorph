# Entity Avatars

Status: done
Status note: 2026-10-23. Tickets 01–14 are done. Last landing is 735a757bf. Review: the follow-up gaps were fixed in d3baf2ba0. Closed red: one load timeout in locationGraphNeighbors.test.ts, another effort's test, which passes alone; lint green.
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
50. As a player with an old save from a world whose 3D Player Avatar flag was on, I want the save to keep showing the world's Avatar or the library Avatar it chose, so that loading an old save changes nothing.
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

## Ticket Rulings

- **T01-1:** the store is keyed by id with a display name and an embedded file. An entity pick has two stored forms, user's default and world store id. An absent pick means none, so None writes no field. Ticket 06 adds the library-id form.
- **T01-2:** the World Overview Avatar section and the entity Avatar dropdown are Advanced only, like the 3D Model field and the old uploader.
- **T01-3:** the dropdown sits next to the 3D Model field for every world entity (NPCs, world personas, the Custom Persona). The library entity editor gets it in ticket 06.
- **T01-4:** the morph-binding picker lists each store Avatar by display name, then the old world Avatar until ticket 03 removes it, then the library Avatars as today.
- **T01-5:** each store row has an inline name field that commits on blur as one history step. A new Avatar's name defaults to the filename without extension, or to the library record's name for a library copy.

- **T02-1:** ticket 02 adds the library-id form to the pick type, because the resolver reads it. No editor or store writes it until ticket 06.
- **T02-2:** the resolver takes the legacy fallback as a pick: a world store id, or user's default when the flag is on with no old Avatar. Ticket 03 decides where it is stored.
- **T02-3:** the save's chosen Avatar is a world or library id plus a legacy mark. Without the mark, it replaces User's Default wherever the played side lands on User's Default (the played entity's pick, the Custom Persona's pick, or a fallback of User's Default). With the mark (Q24), it replaces the whole played-side result, even a result of none. Ticket 03 sets the mark during the remap.
- **T02-4:** a store id missing from the store resolves to none. In the played precedence, any source that resolves to none falls through to the next.
- **T02-5:** an unresolvable library id (an entity pick, the save's chosen Avatar, or the device default) resolves to the bundled file and does not fall through.
- **T02-6:** the resolver returns a world id, a library id, the bundled file, or nothing. It has two entry points: one for any entity in context, and one for the played side alone, which the You row uses when there is no played entity.
- **T02-7:** Set Default Avatar and its badge are player-visible, so ticket 02 adds a changelog fragment. Deleting the default Avatar leaves the device key in place, and it resolves to the bundled file.
- **T02-8:** a save's chosen Avatar that names a store id missing from the store counts as no chosen Avatar. With the legacy mark, normal precedence applies. Without it, User's Default resolves to the device default.
- **T06-1:** a world store pick and a library pick name the same Avatar when their content hashes match. Each store entry records its file's content hash. No store entry records a library id, because a world never refers to a device-local library id. Link state, write-back and the review diff compare picks this way. Picks of none and User's Default compare as they are.
- **T06-2:** adding or syncing a library entity reuses a store entry with the same hash, else embeds a new one named after the library record.
- **T06-3:** world to library (Save to Library, write-back): a store pick maps to the library record with the same hash. With no such record, the store file is imported into the Avatar library (the same hash-reuse rule as ticket 07's import) and the pick points at it.
- **T06-4:** deleting a library Avatar clears the picks on the library entities that use it and bumps their revision. A linked world copy sees the change in the normal review flow, as "Avatar: <name> → None", and the store entry stays.
- **T06-5:** the review diff shows the pick as one row labeled "Avatar". Its values are None, User's Default, or the Avatar's display name.
- **T06-6:** ticket 03 owns wiring the played persona, library source included, into the resolver. Ticket 06 owns the library pick and the resolver-level test for library persona precedence.
- **T03-1:** an old world Avatar on a world whose flag is missing or `false` still moves into the store under the reserved id, with no fallback. No entity uses it, but the file survives a re-save, and Q24's legacy saves can still show it.
- **T03-2:** the fallback is stored as its own overview field holding a pick, and the reserved store id is `legacy-player-avatar`. The migration runs unconditionally, converts the old flag and the old world Avatar, and deletes both. A world that already holds the fallback field and no flag keeps its fallback, so the step stays idempotent.
- **T03-3:** until ticket 05 lands, the Enter World avatar step and new-game seeding gate on "the world has a legacy fallback", which equals the old `true`. Ticket 05 replaces this gate.
- **T03-4:** ticket 03 drops the picker's "World Avatar" option. Ticket 05 reshapes the rest of the picker.
- **T03-5:** the save's chosen Avatar replaces the old model-id field and holds a world or library pick plus the legacy mark. The game-load remap turns an unset or "the world's" value into the reserved id with the mark (or nothing when the store lacks it), and an old library id into a library pick with the mark. Library-delete checks read both forms. The chosen Avatar also has an explicit no-choice form: absent marks a save made before this change, which is remapped once, and the remap and the seeding helper write the no-choice form.
- **T03-6:** deleting the reserved store entry in the editor also clears the fallback.
- **T03-7:** ticket 06 owns the store entry's content-hash field (T06-1). An entry without a hash, such as the one the migration creates, gets its hash computed lazily.
- **T05-1:** the step's picker starts on the device default. When that is unset or missing, it starts on the library copy of the bundled Avatar, and when that is gone too, on the first library Avatar.
- **T05-2:** when the picker shows, Finish writes the shown library Avatar as the save's chosen Avatar, so the save keeps what the player saw even if the device default changes later.
- **T05-3:** when the picker is hidden (an author's world Avatar or a library pick), the step previews the resolved Avatar, and Finish writes the no-choice form. The add control hides with the picker. The step has no delete control; Avatars are deleted from the library's Avatars tab.
- **T05-4:** "is User's Default" means the winning played-side pick, with no save yet, is user's default. A legacy fallback of User's Default counts. The resolver gains an additive export that returns the winning pick.
- **T05-5:** the button label is "Start Game", in title case.
- **T05-6:** for a library persona, the step and its label treat the pick as absent until the library entity has loaded.
- **T04-1:** the showing visual fills the slot. There is one corner button per other visual (View Avatar, View 3D Model, View Image), and each opens its viewer with **Display by Default**. The stored preference gains an Avatar value, and clearing it returns to the default order.
- **T04-2:** the entity popup shows the Avatar too. It uses the same component and the same order.
- **T04-3:** the mobile tab becomes the entity view, labeled "View" with the same icon. A row click on an entity with a visual sets the selection and still opens the popup, as today.
- **T04-4:** the landscape Avatar/Entities toggle goes. The chevron tips read "Hide Entity View" and "Show Entity View".
- **T04-5:** the played entity's row behaves like any other row. The fallback You row only selects and never opens a popup.
- **T04-6:** the stat panel's default pick counts an Avatar as a visual, so both use the same visual test. With no pick, the stat panel stays scene-first, because the played entity's stats already sit in the player rows. So at game start the view can show the played entity while the stat panel shows a scene entity. They agree once the player picks anyone, and selecting the fallback You row returns the stat panel to its scene default.
- **T04-7:** an NPC Avatar renders as its file is authored: no color overrides, and hair and morph values that leave the mesh unchanged. Only its own stats' morph bindings move it.
- **T07-1:** a card or listing carries its pick plus an embedded Avatar (name, file, hash) when the pick names a specific Avatar. Import adds the file to the library with hash reuse and rewrites the pick to that library id. A library pick that can't be resolved at export goes out as no pick.
- **T07-2:** the World Editor's card export of a world entity embeds its store Avatar the same way, so any Avatar an author put on an entity travels with the file (Q23 reopened).
- **T07-3:** every entity import dedupes by hash into the library: Main Menu card import (single and batch), World Editor card import, and community entity downloads. A World Editor import then embeds into the store per T06-2.
- **T07-4:** downloading an entity listing to the device as a card carries its embedded Avatar through unchanged.
- **T07-5:** publish already refuses over-limit uploads before sending. Ticket 07 embeds the Avatar before the payload is measured and adds tests for both limits. It adds no new UI.
- **T07-6:** a pick of none or User's Default exports as it is, with no embedded file.

## Post-Close Rulings

- **Q25:** an old save from a world with no flag value shows no Avatar, even when it held customization. Story 50 covers only worlds whose flag was on.
- **Q26:** a library Avatar id this device lacks reads "Missing Avatar" in the dropdown and in the link review. Play still shows the bundled file (ticket 11).
- **Q27:** copy calls the library Avatar marked by the tile menu the "Default Avatar", matching Default Persona. User's Default stays the name of the dropdown option.
- **Q28:** importing a card adds its Avatar to the library only when the import is confirmed. Canceling the World Editor's import review leaves the library unchanged (ticket 12).
- **Q29:** World Overview store rows regain a 3D preview and Export, and their history rows name the Avatar (ticket 13).
- **Q30:** the mobile entity-view tab keeps the label "View".
- **Q31:** the close review's Standards findings go into one behavior-neutral cleanup (ticket 14).
- **Q32:** the lint error in the WIP world script was fixed outside this effort.
- **T09-1:** export resolves the pick first and embeds that Avatar. It falls back to a held embedded file only when the pick resolves to nothing.
- **T10-1:** the raw-load fallback runs the chosen-Avatar remap only. The stat backfill on that branch stays out of scope.
- **T12-1:** for the World Editor card import, "confirmed" means the import review's confirm. Canceling the later Connect References step keeps the Avatar, matching the library copy that confirm already saves.
- **T13-1:** each store row gets a Preview button beside Delete. It opens the Avatar details panel, with Export in the panel footer, as the old uploader had.
- **T13-2:** a store Avatar exports under the library's file-name rule: its display name, with `.vrm`, or `.glb` when the file has no VRM metadata.
- **T13-3:** history rows read "Add Avatar: <name>", "Rename Avatar: <new name>" and "Delete Avatar: <name>". An empty name reads "Unnamed".
- **T13-4:** a library copy counts as an add in history.
- **T14-1:** the legacy default-avatar-id save migration stays. It is tested, and the library delete warning depends on it. Ticket 14 removes only its orphaned comment and explains its cast.
- **T14-2:** the long TSDoc to shorten is on the Avatar source URL hook.
- **T14-3:** the played-Avatar hooks module is renamed after the library-Avatar hooks it holds, and the visual test moves into `src/lib`.
- **T14-4:** the one player-facing "Default Avatar" casing fix is the library delete message. Comments that mean the bundled file stay as they are.

## Further Notes

- Glossary: **Avatar** in `CONTEXT.md` still says "chosen for a world". It needs an update to "chosen for an entity" once this lands. Add **User's Default** as a term.
- All eight bundled worlds have the flag set to `false`, so none of them change.
- The server caps a world at 100 MB and an entity listing at 25 MB.
- Rulings Q1–Q19 come from the 2026-10-22 grill. The spec review added Q20–Q24, and Q22 dropped Q5. The user reopened Q23: an exported entity carries the Avatar its author picked. One extra ruling from the user: a missing flag means no Avatar.
