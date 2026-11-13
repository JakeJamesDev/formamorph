# 03: World Options Core

Status: ready-for-human
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

An author adds World Options on a new Options tab, and the player picks them at new game.

- World shape: an ordered `options` list on the world. Each Option has an id, a name, a type (choice, boolean, number), a default, Shown to Player, and a mid-game flag. A choice lists named values; a number has a required min and max. Choice values and boolean states carry placeholder pins; numbers carry none (Q6, Q15, Q19, Q20, Q24).
- Editor: an **Options** tab in the World Editor to add, edit, reorder and delete Options (Q5). A dev-router entry for it.
- Save shape: an Option values record in GameplayContext and the save envelope, keyed by Option id, following the `loreToggles` precedent. A missing id reads the default (Q21).
- New game: shown Options appear in a World Options section above the traits on the trait selection screen. A number uses a slider. No section when no Option is shown (Q18).
- Pins: an Option's current value applies its pins in play through the placeholder pin path traits already use.
- Glossary: add World Option to CONTEXT.md.
- Docs: the wiki's world authoring pages gain Options. Changelog fragment in `docs-internal/changelog.d/`.
- ⚠️ Export-shape change for worlds and saves.

Spec rulings: Q5, Q6, Q13, Q14, Q15, Q18, Q19, Q20, Q21, Q24.

## Acceptance criteria

- [x] A world with one Option of each type round-trips through export and import unchanged. `GameDataContext.worldOptions.test.tsx`: export, `migrateWorld`, load.
- [x] A save round-trips its Option values; a save without the record loads with each Option at its default. `GameplayContext.worldOptions.test.tsx`; guard bites with the load restore removed.
- [x] A choice value's pins and a boolean state's pins reach the prompt in play; switching the value switches the pinned text. `worldOptions.test.ts` resolves a prompt chip through `collectPins` with Option pins; precedence guard bites. Each play caller (`useResolvedWorld`, `usePlaceholderResolver`, Enter World draft pins, GameViewer opening) passes Option pins; checked by review, not driven end to end.
- [x] Hidden Options never appear in the new-game section. `EnterWorldWorkspace.test.tsx` World Options cases; guard bites with the filter removed. DOM read in the preview shows Secret Flag absent.
- [x] Frames: `.scratch/frames/options-tab.png` and `.scratch/frames/new-game-options.png`, light and dark, at 1280 px width. Dark copies end in `-dark`. Laid out at a 1280 px viewport; the pane stores them at 800 px.

For you: whether the new-game section above the traits reads well (Enter World on a world with Options).

## Landed

**Not verified**
- No test starts a game and reads the prompt; the play wiring is checked by review only.

**For you**
- Whether the new-game section above the traits reads well (Enter World on a world with Options). Frames: `.scratch/world-options-03/frames/new-game-options.png` and `new-game-options-dark.png`.
- The Options tab layout: `.scratch/world-options-03/frames/options-tab.png` and `options-tab-dark.png`.
- ⚠️ Export shape: worlds gain `options`; saves gain `worldOptionValues`.

**Notes for later tickets**
- 05: view-aliased pins and the pre-turn snapshot read live `worldOptionValues`; per-page aliasing and undo must carry it once values change mid-game.
- The editor's trait preview (`ownerPreview`) does not lay Option defaults; the Bench lens does.
- The "Changeable During Play" flag and its docs describe 05's in-game tab, which this ticket does not build.
