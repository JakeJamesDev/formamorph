# 05: World Rows List the Playable Personas' Avatars

Status: ready-for-agent
Blocked by: 04
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: high

The lookup exists after ticket 04. The care here is in which personas count and in removing the old list without losing a binding.

## What to build

A world stat or trait lists the Avatars a player of this world can have, and nothing else (spec, World Editor pickers; Q1, Q19).

- A world row lists the Avatar of each persona a new game of the world can be played as, without duplicates. A world that fixes the persona gives one Avatar.
- A library persona or None plays as the Custom Persona's pick, so that pick stands for them.
- Each persona's pick resolves by the same rules as an entity's, on the author's device.
- The list of every library Avatar is removed.
- The Colors picker and the "Not on this model" mark read the same Avatars. A row is marked only when none has the control.
- When no Avatar resolves for any playable persona, the Appearance tab shows the hint from ticket 04.
- A binding to a slider that is no longer listed stays on the row and stays removable.
- Update the stats and traits wiki pages where they say what a world stat's or trait's lists hold.

## Acceptance criteria

- [ ] A world that fixes a persona on a world Avatar lists only that Avatar on a world stat and a world trait.
- [ ] A world that leaves the persona to the player lists each playable persona's Avatar once, grouped by Avatar.
- [ ] Two personas on the same Avatar give one group.
- [ ] A world whose personas all resolve to User's Default lists the author's resolved default Avatar only.
- [ ] A library Avatar that no playable persona resolves to is not listed.
- [ ] A world whose playable personas all have None shows the hint.
- [ ] A bound slider that is not in the list stays on the row and can be removed.
- [ ] Mutation: restore the all-library list, and the "not listed" test fails.

For you: open a world stat in one of your worlds and check that the list matches the Avatars its personas use.
