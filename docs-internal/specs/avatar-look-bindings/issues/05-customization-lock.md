# 05: Customization Lock

Status: ready-for-human
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

UI wiring on top of the resolver's holder map. Bounded scope.

## What to build

In the new-game flow, Character Customization shows a slider or color that a checked trait sets as locked, with a note naming the trait (Q7, Q18).

- The trait step comes before the Avatar step. Customization reads the traits the player checked there. Automatic traits and item grants are not evaluated.
- The lock reads the resolver's holder map. The stored player value stays and returns when the trait ends.
- Customization in the Model Library has no world and locks nothing.
- Fix a false mark ticket 04 found: an owned stat's or trait's rows check only the owner's 3D model, so Colors rows read "Not on this model" although the owner's Avatar takes the colors in play. The mark's known model for an owner is every model the look applies to (its Avatar and its 3D model). A row is marked only when none of them has the slider or channel.
- Follow the Writing Guide for the note. Update the Avatars docs page. Add a changelog fragment.

## Acceptance criteria

- [x] With Elf checked, Ear Shape shows locked with a note naming Elf. (`EnterWorldFlow.customizationLock.test.tsx`; the test fails with the lock removed)
- [ ] With Elf unchecked (Back to the trait step), Ear Shape is editable and keeps the player's value. (editable: tested; kept value: not asserted)
- [x] A trait color pin locks that color picker the same way. (same test, Skin note; `customizationLock.test.ts`)
- [x] The Model Library's Customization shows no lock. (same file, hook with no lock)
- [x] An entity with an Avatar and a 3D model shows no "Not on this model" on a skin Colors row; an entity with only a non-VRM model still does. (`StatManager.bodySliders.test.tsx`, "on an entity with an Avatar")
- [ ] Frames: `.scratch/frames/customization-lock.png`, light and dark, 1280 wide and 375 wide.

For you: read the lock note in the start flow and confirm it is clear (Character Customization, new game).

## Landed

**Not verified**
- Frames: not captured; the lock note has only been read in jsdom.
- Unchecked Elf keeps the player's value: the stored value is never written while locked, but no test asserts it.

**For you**
- Read the lock note in the start flow and confirm it is clear (Character Customization, new game).
