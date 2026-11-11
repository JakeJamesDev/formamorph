# 30: Scripts Read Routine Data

Status: ready-for-agent
Blocked by: 27, 28
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

Scripts can read where an entity is, whether it follows and whether it waits. They cannot read the rest of what this effort added. The user approved four read-only additions on 2026-11-11 (Q211). This widens what the script sandbox exposes; that approval covers these four and nothing else.

- **Entity kind.** Whether the entity is Unique or Generic. A script can then skip a Generic entity before `move` or `follow`, which do nothing on one.
- **Exit distance and direction.** Each entry of `exits` says whether the way is Nearby or Far and whether it is one-way. A parent, child or sibling with no Connection is Nearby and two-way (Q48).
- **Current routine action.** What the entity does now: stays, wanders or patrols, or none when no row covers the hour. Also whether a script move holds it (Q90). A follower and a waiting entity keep `following` and `waiting`; say what the action reads for them.
- **Known In.** The entity's value: Nowhere, Nearby or Picked Locations.

All four are read-only. A write to one is an error, as for the other read-only fields. Pick names that fit the fields beside them, and ask the spec session before the first edit if two names are equally good.

Each field needs its completion entry, hover text, variable tree entry and Scripts Reference row, in the technical register. Each must read correctly in play and in an authoring run (ticket 28's placement). The Test Code report shows them like the fields beside them.

`exits` lists one move. The router reaches further. Do not change that here; the description of `exits` must say it lists the direct ways only.

No world or save shape changes. The fields are derived at run time.

Do not rebuild the help vectors. Ticket 32 does that once.

Spec rulings: Q211, Q48, Q90, Q174.

## Acceptance criteria

- [ ] A script reads the kind of a Unique and of a Generic entity; an entity with no kind reads the documented empty value.
- [ ] `exits` entries carry distance and direction for a Far Connection, a one-way Connection and a link with no Connection.
- [ ] The routine action reads correctly for an entity in a stay row, a wander row, a patrol row, a gap, under a script-move hold, following and waiting.
- [ ] Known In reads each of its three values.
- [ ] A write to any of the four fails with the read-only error.
- [ ] The four fields read the same in play and in Test Code on the same world at the opening hour.
- [ ] Completion, hover text, the variable tree and the Scripts Reference list each field. `npm run copy:sweep` gives no notice on the new strings.
- [ ] A save made before this ticket loads and plays, and no save or world file gains a field.
