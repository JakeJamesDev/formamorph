# 03: World Options Core

Status: ready-for-agent
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

- [ ] A world with one Option of each type round-trips through export and import unchanged.
- [ ] A save round-trips its Option values; a save without the record loads with each Option at its default.
- [ ] A choice value's pins and a boolean state's pins reach the prompt in play; switching the value switches the pinned text.
- [ ] Hidden Options never appear in the new-game section.
- [ ] Frames: `.scratch/frames/options-tab.png` and `.scratch/frames/new-game-options.png`, light and dark, at 1280 px width.

For you: whether the new-game section above the traits reads well (Enter World on a world with Options).
