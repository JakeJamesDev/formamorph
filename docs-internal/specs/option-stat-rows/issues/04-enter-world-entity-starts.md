# 04: Enter World Entity Starts

Status: done
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

The close review found that the Enter World preview seeds entity stats without the picked values' Option starting rows or toggles (spec Q15, Q19). Global stats already include them. Entity stat-band Pins in the preview therefore read the wrong band. The editor's authored scene has the same gap. Entity trait starts are missing in both places too; decide whether to fix that here or name it.

## Acceptance criteria

- [x] With Easy giving the Dragon "Health starting +20", the Enter World preview's Dragon Health reads the raised value, and a stat-band Pin on the Dragon resolves from it. EnterWorldFlow.test.tsx, "reads the Dragon's band from Health as the picked value's starting row leaves it".
- [x] An Option toggle on an entity stat shows in the preview. EnterWorldFlow.test.tsx, "leaves the band unpinned below it, and when the Option switches the stat off" (Hard).
- [x] The guard goes red with its bug reinstated. Reinstated one at a time: raw entity stats in Enter World, no Option rows in ownerPinPlan's entity and global toggles, no `optionStats` in usePlaceholderResolver, raw entity seeds, entity Option toggles and global toggles in authoredChipScene. Each turned its guard red; the in-play guard is GameViewer.worldOptions.test.tsx, "stops the stat's band pinning once the tab switches the Option on" (Q28).

## Landed

**Not verified:** nothing left unticked.

**For you:**
- Enter World on a world with an entity Option row: the Starting Location and trait names that a Dragon band pins follow the picked Difficulty.
- World editor prompt preview (World Details, custom prompts): entity and global stats read the Options' default values, toggles included.

**Named, not changed:**
- Test Bench lens pin plan (`lensPinPlan`) still seeds entity stats without Option or trait starts, and its global stats leave out the cast's default global rows. The Bench's opening fold path is right.
- `ownerPreview` passes no Options: it lays no stat bands, so no Option toggle can reach it.
- No changelog fragment (Q23 pattern): the fix is to the unreleased Option Stat Rows entry.
