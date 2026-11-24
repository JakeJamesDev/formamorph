# Spec: In-Game Avatar Edit

Status: ready-for-agent

## Problem Statement

A player sets their Avatar's look once, on the Avatar step of the enter-world flow. After the game starts, the look is fixed. A player who wants a different hair color, other body sliders, or another Avatar from their Model Library must start a new game. A player who skipped the step with Quick Start never gets the chance at all.

## Solution

The played Avatar shows a pencil button in its bottom-right corner during play. The button opens the same Avatar customization screen the enter-world flow uses, filled with the player's current look. On desktop it opens as a dialog over the game. On mobile it opens as the full screen, as it does at entry. **Save** writes the new look to the playthrough at once. **Cancel** closes the editor and asks first when something changed. The new look stays through rewind and regenerate.

## Rulings

- **Q1 History view.** The pencil is hidden while the player views a past turn. A past turn shows the look its snapshot recorded.
- **Q2 Preview.** The editor preview shows the base look, with no stats on top. Active stats apply again after Save, so the in-game Avatar can differ from the preview.
- **Q3 Avatar switch.** When the world does not lock the played Avatar, the editor shows the Avatar picker and the player can switch. Switching resets the sliders for the new Avatar, as at entry.
- **Q4 Placement.** The pencil shows wherever the played Avatar shows: the played entity's view, and the You row when no entity is played. It never shows on another entity's Avatar.
- **Q5 Rewind.** The edit sticks. Rollback and regenerate keep the live look. Turn snapshots still record the look, for the history view only.
- **Q6 Presentation.** A dialog on desktop. The full customization screen on mobile.
- **Q7 Busy turn.** The pencil works while a turn runs. An edit during a turn only decides which look that turn's history page shows.
- **Q8 AI.** The edit is visual only. The narrator is not told.
- **Q9 Cancel.** With no changes, Cancel closes at once. With changes, a confirm asks to discard them.
- **Q10 Nothing to edit.** The pencil is hidden when the editor would have nothing to change: no Avatar picker, no sliders and no colors.

## User Stories

1. As a player, I want a pencil on my Avatar during play, so that I can change my look without starting a new game.
2. As a player, I want the editor to open with my current sliders, colors, hairstyle and hair length, so that I adjust my look instead of rebuilding it.
3. As a player, I want colors I never changed to stay untouched after Save, so that my Avatar keeps its own colors.
4. As a player, I want extra material colors I set at entry to show in the editor, so that I do not lose them on Save.
5. As a player, I want the Avatar picker to start on my current Avatar, so that opening the editor does not switch my model.
6. As a player in a world that does not lock the Avatar, I want to switch to another Avatar from my Model Library, so that I can play as a different model.
7. As a player, I want to add a new .vrm file from the in-game editor, so that I can use a model I just downloaded.
8. As a player in a world that locks the Avatar, I want to adjust only sliders and colors, so that the world's Avatar choice stays intact.
9. As a player, I want sliders a checked trait holds to stay locked in the editor, so that the in-game editor follows the same trait rules as entry.
10. As a player, I want the preview to show my base look, so that the sliders I move match what the preview shows.
11. As a player, I want Save to change my in-game Avatar at once, so that I see the result without a new turn.
12. As a player, I want active stats to keep shaping my Avatar after Save, so that stat effects still work.
13. As a player, I want Cancel to close at once when I changed nothing, so that a quick look costs no extra click.
14. As a player, I want a confirm before Cancel drops my changes, so that one misclick does not lose my work.
15. As a player, I want my new look to stay after I roll back or regenerate a turn, so that the edit does not silently undo itself.
16. As a player viewing a past turn, I want to see the look I had then and no pencil, so that history stays a true record.
17. As a player, I want the pencil to work while narration streams, so that I do not wait for the turn to end.
18. As a desktop player, I want the editor as a dialog over the game, so that I keep my place in the story.
19. As a mobile player, I want the full-screen editor with its controls drawer, so that the controls fit a small screen.
20. As a mobile player, I want the Android back button to close the editor, so that back does not offer to close the app.
21. As a player with no Avatar on screen, I want no pencil, so that I do not open an editor with nothing to edit.
22. As a player whose Avatar has no sliders or colors in a locked world, I want no pencil, so that I do not open an empty editor.
23. As a player who entered with Quick Start, I want the pencil too, so that I can customize the look I skipped.
24. As a player, I want my edited look saved in my save file, so that it is there when I load the game again.
25. As a player, I want the narrator to keep narrating as before, so that a visual change does not disturb the story.
26. As a player, I want the pencil only on my own Avatar, so that I never think I can restyle another character.
27. As a player, I want the pencil to not block rotating or zooming the Avatar, so that the view still works as before.
28. As a developer, I want a dev-route entry for the in-game editor, so that I can open it straight from the dev router.

## Implementation Decisions

- **The customization hook takes a starting look.** The shared customization hook gains an optional initial `CharacterData`. It seeds body morphs, hair, eye and skin colors, hairstyle, hair length and extra colors from it. A color counts as changed exactly when the stored look has it, so an untouched color stays untouched after Save. The model-capability effects (color seeding from the model, hairstyle fallback) must not overwrite a seeded value on first load. A switch to another Avatar resets as it does today.
- **The customization screen gets an edit mode.** In edit mode it starts the picker from the save's chosen Avatar instead of the picker's start rule, and its buttons are Cancel and Save instead of Back/Abort and Finalize Avatar. It reports Cancel and Save to its host. It reports whether anything changed, for the Cancel confirm. The enter-world flow keeps its current behavior.
- **The edit writes the live look only.** Save replaces the playthrough's live `CharacterData`. It writes no turn snapshot and adds no history entry.
- **Restore keeps the live look.** Rollback and regenerate stop restoring `CharacterData` from the turn snapshot. This follows the existing precedent for entity picture preference: a viewing preference, not story state. Loading a save still restores the saved look. Snapshots keep recording the look, and the history view keeps reading it.
- **The pencil lives on the played Avatar view.** The in-play Avatar view shows the pencil only for the played side, only on the live turn, and only when the editor has something to change. "Something to change" means the Avatar picker shows (the world does not lock the played Avatar) or the loaded model reports at least one slider or color.
- **The host.** The game view opens the editor: a dialog on desktop, the full customization screen on mobile. The trait lock comes from the playthrough's checked traits, as at entry.
- **No save or world shape change.** `CharacterData` and `chosenVrm` already hold everything. No migration.
- **A dev-route entry** opens the in-game editor on a playthrough.

## Testing Decisions

- Tests prove behavior a player sees: what the in-game Avatar view receives, whether the pencil shows, what the editor shows, and what the playthrough stores. They never assert internal state of the hook.
- **Seam 1: the in-game panel.** Use the existing in-game render harness with the VRM viewer stub, as the legacy Avatar panel test does. Cover: pencil on the played Avatar only; hidden on a past turn; hidden with nothing to edit; editor prefilled from the stored look, untouched colors included; Save changes the viewer props at once; Cancel with and without changes; switching Avatars in an unlocked world; the picker hidden in a locked world; trait-held sliders locked.
- **Seam 2: the gameplay state restore.** Use the existing rewind test seam for the discovered cast. Cover: an edited look survives rollback and regenerate; loading a save restores its look; a past page shows its snapshot's look.
- Each guard is proven to bite by reinstating the bug once: a restore that resets the look, a prefill that drops a color.

## Out of Scope

- Telling the narrator about the change.
- Editing any Avatar other than the played one.
- Editing the look of a past turn.
- A new compact layout for the customization controls. The dialog hosts the existing desktop layout.
- Changing what the enter-world Avatar step does.

## Further Notes

- The world-locked Avatar case keeps the picker hidden, as at entry. A missing locked Avatar shows the existing message.
- The Writing Guide governs the pencil's label, the button text and the Cancel confirm.
