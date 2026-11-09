# 05: Customization Lock

Status: ready-for-agent
Blocked by: 03, 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

UI wiring on top of the resolver's holder map. Bounded scope.

## What to build

In the new-game flow, Character Customization shows a slider or color that a checked trait sets as locked, with a note naming the trait (Q7, Q18).

- The trait step comes before the Avatar step. Customization reads the traits the player checked there. Automatic traits and item grants are not evaluated.
- The lock reads the resolver's holder map. The stored player value stays and returns when the trait ends.
- Customization in the Model Library has no world and locks nothing.
- Follow the Writing Guide for the note. Update the Avatars docs page. Add a changelog fragment.

## Acceptance criteria

- [ ] With Elf checked, Ear Shape shows locked with a note naming Elf.
- [ ] With Elf unchecked (Back to the trait step), Ear Shape is editable and keeps the player's value.
- [ ] A trait color pin locks that color picker the same way.
- [ ] The Model Library's Customization shows no lock.
- [ ] Frames: `.scratch/frames/customization-lock.png`, light and dark, 1280 wide and 375 wide.

For you: read the lock note in the start flow and confirm it is clear (Character Customization, new game).
