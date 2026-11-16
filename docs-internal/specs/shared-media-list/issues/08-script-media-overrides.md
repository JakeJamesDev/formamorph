# 08: Script Media Overrides

Status: ready-for-agent
Blocked by: 05, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

Scripts switch what the world shows or plays by naming a Media Entry, the way `persona.body = "Wolf"` sets a Body.

- Entity entries (and `owner`, `persona`) gain `image` and `sound`. Location entries gain `image` and `ambience`. Item entries gain `image`. The world gains `music` (Q12, Q13).
- Reading returns the shown entry's name, or `null`. Assigning a name sets the override; `null` clears it. A missing name throws with that name.
- An image override beats the Visibility rules until cleared (Q2). It applies everywhere that image shows.
- Overrides live in the save envelope, keyed by owner. An entity override is per Generic Entity Instance (Q3). Overrides rewind with their turn. An override holds the entry id, so a rename never breaks a save. A deleted entry's override reads as unset (Q19).
- **Open intent question:** does an item override apply per Item or per Item Instance? Ask the spec session before building the item member.
- Editor completions and hover cards for the new members.
- Ships its docs: the Scripts Reference sections for each member.

## Acceptance criteria

- [ ] `entities.X.image = "<name>"` shows that entry on the entity in play, over a Visibility rule that picks another image.
- [ ] Assigning `null` returns the entity to its Visibility rules.
- [ ] Two instances of one Generic entity hold different overrides.
- [ ] Location image and ambience, entity sound, item image and world music each switch by name.
- [ ] A missing name throws an error that names it.
- [ ] An override survives save and reload, and a rewind past its turn undoes it.
- [ ] Deleting the entry an override names makes the entity fall back to its rules on load.

> ⚠️ Export shape: save JSON gains an overrides field. Remind the user.
