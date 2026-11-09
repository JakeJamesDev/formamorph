# 07: Owner Avatar in the Picker

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Sonnet 5.5 (`claude-sonnet-5-5`)
Reasoning effort: medium

A gap the close review found. The loaders and the known-model rule already exist; this wires the picker to them.

## What to build

An owned stat's or trait's slider picker lists the sliders of every model the look applies to on that owner: its Avatar and its 3D model (spec, Pickers and Missing controls). Today the picker reads only the 3D model. An entity with only an Avatar can't bind any slider, sees "This entity has no 3D model. Add one to bind its body sliders.", and never sees Head Features, although play drives its Avatar.

- The owner's Avatar adds groups headed "<Avatar> · Body Sliders" and "<Avatar> · Head Features", from the VRM catalog, beside the 3D model's Body Sliders group.
- Use the same Avatar rule as the "not on this model" mark: a world or library pick counts; a device-default pick is unknown and adds nothing.
- The empty text reads true for each case: no Avatar and no 3D model; a model with no sliders.
- Follow the Writing Guide for the empty text. Update the docs page that says what an owned stat's picker lists.

## Acceptance criteria

- [ ] An entity with only an Avatar lists that Avatar's Body Sliders and Head Features in an owned stat's picker and an owned trait's picker.
- [ ] An entity with both lists both models' groups.
- [ ] An entity with only a device-default Avatar and no 3D model shows the empty text.
- [ ] Mutation: drop the Avatar source, and the Avatar-only test fails.
