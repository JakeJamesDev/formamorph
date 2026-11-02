# 03: Stats and Traits Follow In Scene

Status: done
Blocked by: 01
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

## What to build

The stat picker and the Traits tab's owner nodes both read **In Scene**. The stat picker's "absent" group goes away, along with its own history-based "ever revealed" rebuild. The player's own node and library owners stay in the Traits tab.

## Acceptance criteria

- [x] The stat picker offers only In Scene entities, strangers by label. `GamePanels.entityStats.test.tsx`: lists In Scene in cast order, label for a stranger, leaves out quiet and elsewhere entities.
- [x] The Traits tab shows owner nodes only for In Scene entities, plus the player and library owners. `TraitsTab.test.tsx` quiet, elsewhere and played-entity cases; `inSceneTraitTree` unit tests (kept library owner).
- [x] An unmet owner's traits never show. A stranger with no label is never in a set, so it gets no node (`presence.test.ts`); the stranger case in `TraitsTab.test.tsx` shows the label and no true name.
- [x] The stat picker's history rebuild is removed, and nothing else reads it. `nameKnowledge` is gone; grep finds no other reader.

## Landed

**Not verified**
- A stranger's own-trait names and descriptions that contain the Character Name: owned names resolve before the Traits filter relabels the node, so a true name may show there. No test covers it.
- Two strangers with the same label draw two identical Traits nodes. The picker numbers them; the Traits tab does not.
- Past-page Traits tab: no test. The stat picker has one (`reads the viewed turn on a past page`).

**For you**
- Play a few turns in Emberwatch and check that the stat picker and Traits tab list only the people on stage.
