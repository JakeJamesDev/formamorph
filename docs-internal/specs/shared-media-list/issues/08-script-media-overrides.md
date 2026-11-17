# 08: Script Media Overrides

Status: ready-for-human
Blocked by: 05, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Scripts switch what the world shows or plays by naming a Media Entry, the way `persona.body = "Wolf"` sets a Body.

- Entity entries (and `owner`, `persona`) gain `image` and `sound`. Location entries gain `image` and `ambience`. Item entries gain `image`. The world gains `music` (Q12, Q13).
- Reading returns the shown entry's name, or `null`. Assigning a name sets the override; `null` clears it. A missing name throws with that name.
- An image override beats the Visibility rules until cleared (Q2). It applies everywhere that image shows.
- Overrides live in the save envelope, keyed by owner. An entity override is per Generic Entity Instance (Q3). Overrides rewind with their turn. An override holds the entry id, so a rename never breaks a save. A deleted entry's override reads as unset (Q19).
- **Open intent question:** does an item override apply per Item or per Item Instance? Ask the spec session before building the item member.
- Editor completions and hover cards for the new members.
- Ships its docs: the Scripts Reference sections for each member.

## Acceptance criteria

- [x] `entities.X.image = "<name>"` shows that entry on the entity in play, over a Visibility rule that picks another image. Verified: `useEntityGallery.test.ts` "shows a script’s override first", `mediaOverrides.test.ts` "shows first over the Visibility rule".
- [x] Assigning `null` returns the entity to its Visibility rules. Verified: the same two tests, cleared half; `statCodeExecutor.media.test.ts` "null clears it back to them".
- [x] Two instances of one Generic entity hold different overrides. Verified: `statCodeExecutor.media.test.ts` "gives each Generic Entity Instance its own override"; `useEntityGallery.test.ts` "for the one standing where the player is".
- [x] Location image and ambience, entity sound, item image and world music each switch by name. Verified: `statCodeExecutor.media.test.ts` "lists an assignment by entry id"; `mediaOverrides.test.ts` "switches a location’s image and ambience…"; `useLocationBackdrop.test.ts` "paints a script’s override".
- [x] A missing name throws an error that names it. Verified: `statCodeExecutor.media.test.ts` "stops the script with the missing name" (wrong kind included, Q53).
- [x] An override survives save and reload, and a rewind past its turn undoes it. Verified: `GameplayContext.mediaOverrides.test.tsx` (IndexedDB save, load, then the earlier snapshot loaded as a rewind does).
- [x] Deleting the entry an override names makes the entity fall back to its rules on load. Verified: `mediaOverrides.test.ts` "reads an override naming a deleted entry as unset"; `statCodeExecutor.media.test.ts` same for scripts.

> ⚠️ Export shape: save JSON gains an overrides field. Remind the user.

## Landed

**Not verified**
- Nothing in the running app. Every criterion is covered by tests on the readers play uses (`visibleImages`, `visibleLocationImages`, `visibleItemImage`, `resolveSound`) and the hooks over them; no frame was taken in the preview.

**For you**
- Run a turn whose script sets `entities.<X>.image = "<entry>"` and open that entity's panel: the entry shows first, and paging reaches the rule-picked images.
- Set `world.music` and a location's `ambience` from a script and listen: both switch at once, and `null` brings back the authored sound.
- In a world with a Generic entity, set one copy's `image` through `entities.<X>.instances` and walk between its places: the panel shows that copy's picture only where it stands.
- Notes: overrides land on the same paths as script lore toggles, so During AI Output writes land too, as `body` writes do. Mention cards read the live turn's entity-wide and persona overrides, not a Generic copy's: tying their rows to positions that move every turn kept the turn from finishing (`GameViewer.bundledSaves.test.tsx` emberwatch).
