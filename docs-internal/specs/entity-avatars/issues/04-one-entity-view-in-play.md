# 04: One Entity View in Play

Status: done
Blocked by: 03
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Opus at high: it removes the player Avatar tab on two layouts and merges three visuals into one view while keeping morphs and customization on the right entity.

## What to build

In play, one entity view serves every entity (spec: Play; Q6, Q8, Q12, Q14, Q19). The entity visual gains the Avatar as a third visual. The default order is Avatar, then 3D model, then image. The stored per-entity preference, which gains an Avatar value, overrides it. Selecting an entity swaps the view. The player Avatar tab goes away on landscape and on mobile; mobile's tab becomes the entity view. At game start the view shows the played entity when it has a visual, else the first scene entity with one. The played entity's Avatar takes morphs from the player view's active stats, and colors and sliders from the save's customization. Other entities' Avatars take morphs from their own stats, like 3D models. When the legacy fallback applies with no played entity, a select-only **You** row shows the fallback Avatar.

## Acceptance criteria

- [x] GamePanels harness tests: Avatar before model before image; the stored preference overrides; selection swaps; played entity first; scene fallback; mobile layout; the You row in a fallback world. `GamePanels.entityView.test.tsx`, each guard mutation-tested.
- [x] The played entity's Avatar moves with stat changes as today; an NPC Avatar moves with its own stats. "moves the played Avatar and an NPC Avatar each with its own stat changes".
- [x] Customization applies to the played entity's Avatar only. "drives an NPC's Avatar from its own stats, with no customization".
- [x] Frames `.scratch/frames/04-landscape.png` (1280 wide) and `.scratch/frames/04-mobile.png` (375 wide), light and dark. Playwright on the `entityAvatars` dev fixture; dark frames are the `-dark` twins.
- [x] Changelog fragment. `docs-internal/changelog.d/entity-avatars-04.md`.
- [x] Export-shape reminder in the landing: the save's visual preference gains an Avatar value. In the landing report.

For you: switching between Avatar, model and image on an entity that has all three, in a world you play.

## Landed

**Not verified**
- That an NPC Avatar's hair matches its file in a real VRM with several hair meshes. The viewer now leaves hair untouched when no customization applies (T04-7), checked by reading `VRMViewer.updateHairStyle`, not on a model with several hair meshes.

**For you**
- Switching between Avatar, model and image on an entity that has all three, in a world you play. `#dev?view=gameViewer&fixture=entityAvatars` has one (the Golem).
- The stacked corner buttons, one per other visual (T04-1): `.scratch/entity-avatars-04/frames/04-landscape.png`.
- The mobile tab's "View" label (T04-3): `.scratch/entity-avatars-04/frames/04-mobile.png` and `04-mobile-dark.png`.
- An entity with an image and a 3D model and no stored choice now opens on the model, per the default order. Existing saves show this change.
