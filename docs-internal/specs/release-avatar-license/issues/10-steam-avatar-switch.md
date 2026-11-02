# 10: Steam Avatar Switch

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Several code paths assume a bundled file exists, and a miss shows up only as a runtime error. No Steam build exists yet to catch one.

## What to build

A build with the flag set to `none` holds no `.vrm` file and runs without one. Every world plays, and a save or world that names the default Avatar id resolves to no model with no error. That includes Sugarscape's User's Default pick.

This adds `none` to ticket 07's `FORMAMORPH_AVATARS` flag, which the Steam effort will set. Building the Steam build itself stays out of scope. The output must leave out every `.vrm`, including the tracked default that `public/` copies into a dist.

With no bundled file, these change: the viewer's default model URL, library seeding, the bundled hash check, and the rule that the library keeps at least one Avatar. Ticket 11 owns the empty-state UI, so this ticket leaves those surfaces functional and unstyled.

A player can still add a `.vrm` and play with it.

Rulings: Q18, Q19.

## Acceptance criteria

- [ ] A build test asserts the Steam output holds no `.vrm`. Leaving one in turns it red, and that run is recorded in the Landed notes.
- [ ] With the switch on, no request for a bundled model is made, and seeding writes nothing.
- [ ] A game starts and plays with no Avatar and no error, tested on the real resolver.
- [ ] Sugarscape's User's Default pick resolves to no model with no error.
- [ ] The library can reach zero Avatars with the switch on, and can't with it off.
- [ ] An added `.vrm` is usable with the switch on.
- [ ] Non-Steam builds are unchanged, tested with the switch off.
