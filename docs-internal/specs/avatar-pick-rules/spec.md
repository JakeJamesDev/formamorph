# Spec: Avatar Pick Rules

Status: ready-for-agent
Spec session: avatar-pick-rules — spec

First of two specs from one grill. The second, Appearance Preview, depends on the resolver this one defines.

## Problem Statement

An Avatar choice has four values: None, User's Default, an Avatar the world includes, and a library Avatar. The app does not treat them the same way in every place.

In the World Editor, an entity set to User's Default lists no Avatar sliders in a stat's or trait's Sliders picker, although the author's default Avatar has sliders. A world stat lists the sliders of every Avatar in the author's library, which is more than the world can use. That list dates from before an entity could name its own Avatar.

In play, a missing Avatar falls back to the bundled Avatar file, even after the player deleted that Avatar from the library. On builds with a bundled Avatar the library also refuses to delete the last Avatar. A player who wants no Avatars can't get there.

## Solution

One rule decides which Avatar a choice shows, and the editor and the game both use it.

- **None** shows no Avatar. The editor shows a hint to select one.
- **User's Default** shows the Default Avatar of the person at the device: the author in the editor, the player in play. With no Default Avatar marked, it shows the first available library Avatar. With an empty library, it shows none.
- **A world Avatar** shows that Avatar only.
- **A library Avatar** shows that Avatar. When it is gone from the library, the choice acts as User's Default.

The editor's Sliders and Colors pickers list only what the resolved Avatar offers, plus the entity's own 3D model. The game never loads the bundled Avatar file directly and never restores a deleted Avatar. A player with no Avatars plays with none.

## User Stories

1. As a world author, I want an entity set to User's Default to list my Default Avatar's sliders, so that I can bind them.
2. As a world author, I want an entity set to a world Avatar to list only that Avatar's sliders and colors, so that I see what that entity can use.
3. As a world author, I want an entity with no Avatar to show a hint to select one, so that I know why the lists are empty.
4. As a world author, I want an entity's own 3D model sliders to stay in the list beside its Avatar's, so that I can bind both.
5. As a world author, I want a world stat or trait to list the sliders of the Avatar the player will have, so that I don't bind a slider no persona has.
6. As a world author whose world lets the player pick a persona, I want a world stat or trait to list every playable persona's Avatar, so that each one can be bound.
7. As a world author, I want the "Not on this model" mark to use the same Avatar the list uses, so that the two never disagree.
8. As a world author with no Default Avatar marked, I want User's Default to use my first available Avatar, so that the lists still work.
9. As a world author, I want a binding to a slider that is no longer listed to stay on the row and stay removable, so that changing an Avatar loses nothing.
10. As a new player, I want the bundled Avatar marked as my Default Avatar, so that User's Default shows it without any setup.
11. As a returning player with no Default Avatar marked, I want the bundled Avatar marked once on update if I still have it, so that my game looks the same as before.
12. As a player who deleted the bundled Avatar, I want it to stay deleted, so that my library holds only what I chose.
13. As a player, I want to delete my last Avatar, so that I can play with no Avatars at all.
14. As a player with no Avatars, I want a new game to skip the Avatar step, so that I'm not asked to customize nothing.
15. As a player with no Avatars, I want entities set to User's Default to show no Avatar, so that nothing I deleted comes back.
16. As a player with Avatars but no Default Avatar, I want User's Default to show my first available Avatar, so that entities still have a look.
17. As a player, I want Avatar Customization to preselect my Default Avatar under User's Default and let me change to any library Avatar, so that the world's choice stays mine.
18. As a player whose library lacks the library Avatar a world names, I want the choice to act as User's Default, so that I get my own Avatar and not a bundled one.
19. As a player with a None persona, I want no Avatar and no customization, as today.
20. As a player, I want a world Avatar to show as the world set it, as today.

## Implementation Decisions

### Rulings

Q-numbers are from the grill of 2026-11-11. Q7–Q17 belong to the Appearance Preview spec.

- **Q1.** A world stat or trait follows the played persona's pick by the same rules as an entity.
- **Q2.** An entity's picker keeps its 3D model's sliders beside its Avatar's.
- **Q3.** The last library Avatar is deletable on every build.
- **Q4.** A library pick whose model is gone resolves as User's Default.
- **Q5.** A new game skips the Avatar step when User's Default resolves to no Avatar.
- **Q6.** Seeding marks the bundled Avatar as the Default Avatar. An existing install gets the mark once on update, when no Default Avatar is marked and the bundled Avatar is still in the library.
- **Q19.** When the world leaves the persona to the player, a world row uses every playable persona's Avatar, without duplicates.
- **From the request.** None shows a hint in the Appearance tab. User's Default shows only the default Avatar. A world Avatar shows only itself. The app never restores a deleted Avatar to satisfy a pick: an empty library means the player removed Avatars on purpose.

### The resolver

One resolver turns a pick into an Avatar source or none. Play already has it; the editor's pickers and the "Not on this model" mark move onto it.

- User's Default resolves in this order: the marked Default Avatar when the library holds it, then the first available library Avatar, then none.
- "First available" keeps the order Avatar Customization preselects in today.
- The bundled-file source is removed. No caller loads the bundled Avatar file except seeding.
- The viewer shows no Avatar when its source resolves to none or fails to load. It has no bundled fallback.
- A world pick the store lacks is unchanged by this spec.

### World Editor pickers

- An owned row (entity stat or trait) lists the entity's 3D model and the Avatar its pick resolves to on the author's device.
- A world row lists the Avatar of each persona a new game of the world can be played as. A world that fixes the persona gives one Avatar. A library persona or None plays as the Custom Persona's pick.
- The list of every library Avatar is removed.
- The Colors picker and the color channels follow the same resolved Avatars.
- The "Not on this model" mark reads the same resolved Avatars. This replaces Q14 of the Avatar Look Bindings spec for User's Default: the pick is now known on the author's device. A row is marked only when none of its Avatars and models has the control.
- When no Avatar resolves and the owner has no 3D model, the Appearance tab shows a hint to select an Avatar. The hint is in the tab, not only inside the picker. The Writing Guide governs the words.

### Play

- Avatar Customization under User's Default preselects the resolved Avatar and lists every library Avatar, as today.
- A library pick that is missing unlocks the dropdown, because it acts as User's Default.
- The new-game flow skips the Avatar step when the pick is None, as today, and when User's Default resolves to none.
- With no Avatar, no customization controls render, the Animate Avatar checkbox included.

### Library and seeding

- The delete guard for the last usable Avatar is removed.
- The seed-once flags stay. They are what keeps a deleted bundled Avatar from returning.
- The first seed of the bundled default Avatar marks it as the Default Avatar when none is marked.
- A one-time device step marks it on existing installs under Q6. It runs once, and never after the player clears or changes the Default Avatar.
- A build with no bundled Avatar marks nothing.

### Export shape

No world or save field changes. The Default Avatar mark and the one-time flag are device-local.

## Testing Decisions

A good test here states a pick and a library, then reads what shows. It does not assert which helper ran.

- **The resolver** is the main seam. Table tests cover each pick against each library state: Default marked and present, marked and missing, unmarked with Avatars, empty. Prior art: the existing resolver tests.
- **The editor pickers** are tested through the stat and trait editors, as `StatManager.bodySliders.test.tsx` and `TraitManager.sliderPins.test.tsx` do today: an owner or world, an open picker, the group headings read back.
- **The new-game flow** is tested through `EnterWorldFlow`: an empty library skips the step; a missing library pick offers the dropdown.
- **Seeding and deletion** are tested on the model storage service with its in-memory store, as `ModelStorageService.bundledAvatars.test.ts` does.
- Each guard gets a mutation check: restore the bundled fallback, restore the delete guard, and restore the all-library list, and the matching test must fail.

## Out of Scope

- The Appearance Preview, slider undo, the eyedropper and the Avatar icon. They are the next spec.
- A world pick whose store entry is missing.
- Any change to None, to world Avatars in play, or to how personas are picked.
- A way to restore a deleted bundled Avatar.

## Further Notes

- The wiki pages for stats, traits and Avatars state where the lists come from. They change with the pickers.
- An install that deleted the bundled Avatar and has no other Avatar now plays with no Avatar, where it showed the bundled one before. This is intended.
