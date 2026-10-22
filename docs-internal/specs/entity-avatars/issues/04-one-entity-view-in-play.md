# 04: One Entity View in Play

Status: ready-for-agent
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it removes the player Avatar tab on two layouts and merges three visuals into one view while keeping morphs and customization on the right entity.

## What to build

In play, one entity view serves every entity (spec: Play; Q6, Q8, Q12, Q14, Q19). The entity visual gains the Avatar as a third visual. The default order is Avatar, then 3D model, then image. The stored per-entity preference, which gains an Avatar value, overrides it. Selecting an entity swaps the view. The player Avatar tab goes away on landscape and on mobile; mobile's tab becomes the entity view. At game start the view shows the played entity when it has a visual, else the first scene entity with one. The played entity's Avatar takes morphs from the player view's active stats, and colors and sliders from the save's customization. Other entities' Avatars take morphs from their own stats, like 3D models. When the legacy fallback applies with no played entity, a select-only **You** row shows the fallback Avatar.

## Acceptance criteria

- [ ] GamePanels harness tests: Avatar before model before image; the stored preference overrides; selection swaps; played entity first; scene fallback; mobile layout; the You row in a fallback world.
- [ ] The played entity's Avatar moves with stat changes as today; an NPC Avatar moves with its own stats.
- [ ] Customization applies to the played entity's Avatar only.
- [ ] Frames `.scratch/frames/04-landscape.png` (1280 wide) and `.scratch/frames/04-mobile.png` (375 wide), light and dark.
- [ ] Changelog fragment.
- [ ] Export-shape reminder in the landing: the save's visual preference gains an Avatar value.

For you: switching between Avatar, model and image on an entity that has all three, in a world you play.
