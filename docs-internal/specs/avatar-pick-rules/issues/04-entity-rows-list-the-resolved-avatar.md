# 04: Entity Rows List the Resolved Avatar

Status: ready-for-agent
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

This ticket owns the shared lookup "the Avatars and models a row plays on", which ticket 05 extends. The picker, the color channels and the mark must all read it.

## What to build

An entity's stat or trait shows the author exactly what that entity can use (spec, World Editor pickers; Q2).

- The Sliders and Colors pickers of an owned row list the entity's 3D model and the Avatar its pick resolves to on the author's device, through the resolver from ticket 01.
- User's Default lists the author's resolved default Avatar. A world Avatar lists itself. A library Avatar lists itself, or resolves as User's Default when it is gone.
- The "Not on this model" mark reads the same resolved Avatar and the 3D model. A row is marked only when none has the control. User's Default is now known, which replaces the "unknown" rule of the Avatar Look Bindings spec.
- When no Avatar resolves and the entity has no 3D model, the Appearance tab shows a hint to select an Avatar. The hint is in the tab, not only inside the picker. Read the Writing Guide before you write it.
- A binding to a slider that is no longer listed stays on the row and stays removable.
- One lookup gives the picker, the color channels and the mark their models. Ticket 05 adds world rows to it.
- Update the stats and traits wiki pages where they say what an entity's lists hold.

## Acceptance criteria

- [ ] An entity on User's Default lists the author's Default Avatar's Body Sliders and Head Features.
- [ ] With no Default Avatar marked, it lists the first available library Avatar's.
- [ ] An entity on a world Avatar lists only that Avatar's groups, beside its 3D model's when it has one.
- [ ] An entity with None and no 3D model shows the hint in the Appearance tab, on a stat and on a trait.
- [ ] An entity with None and a 3D model lists the 3D model's sliders and shows no hint.
- [ ] On User's Default, a bound slider the resolved Avatar lacks is marked "Not on this model".
- [ ] A bound slider that is not in the list stays on the row and can be removed.
- [ ] Mutation: make User's Default add nothing again, and the User's Default test fails.
- [ ] Frames: `.scratch/frames/entity-appearance-none-dark-1440.png` and `.scratch/frames/entity-appearance-default-dark-1440.png`.

For you: read the hint text for None, and check an entity on User's Default against your own Default Avatar.
