# 24: Known In Nearby On The Canvas

Status: ready-for-agent
Blocked by: None (can start immediately)
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: medium

## What to build

An entity's Known In has three values. With Nearby, the AI gets the entity's summary when the player is one Nearby link from where the entity is now. The game already does this. Two things are behind:

- **The hint text** under Known In still says "one location away". It must say nearby, and match what the game does: Connections count, and a Far link does not.
- **The canvas** draws nothing in the Known In view when the value is Nearby, so the author cannot see where the entity can be known.

Build the canvas view:

- Every place the entity's routine uses gets the full mark: every place it begins at and every place a row names. Player's Starting Location stands for the world's starting locations.
- Every place one Nearby link from one of those gets a lighter mark.
- A Far link out of a routine place draws in the Far style, and its other end stays unmarked unless another routine place reaches it.
- The canvas key lists the two marks while this view draws them. Its text says the lighter mark applies only while the entity is there.
- Nowhere and Picked Locations draw as today. The Custom Persona draws nothing, as today.
- A Unique and a Generic entity use the same rule.

No engine or prompt change. Reach comes from the location graph's Nearby rule; do not write a second one. The marks are new canvas marks: follow the Design System and ask the user before adopting a look that is not in it.

Spec rulings: Q174, Q180, Q181, Q128, Q61, Q88.

## Acceptance criteria

- [ ] The Known In hint for Nearby no longer says "one location away", on the entity panel and on the canvas pick card. The copy sweep passes on it.
- [ ] The mark model gives the full mark to each routine place and the lighter mark to each place one Nearby link away, for an entity that stays, one that wanders, and one that begins at Player's Starting Location. (Unit tests on the mark model.)
- [ ] A place joined to a routine place only by a Far Connection gets no mark, and the test fails when the Far check is removed.
- [ ] A child joined to its parent by a Far Connection gets no mark from the parent.
- [ ] The canvas key lists the two marks in this view and neither of them in the Picked Locations view.
- [ ] Switching Known In between Nearby, Nowhere and Picked Locations redraws the canvas each time.
- [ ] Frames: `.scratch/frames/known-in-nearby-dark.png` and `-light.png`, at 1440 wide, on the dev fixture with a range, with a Far link in view.
- [ ] The Entities wiki page, the Locations wiki page where it describes the canvas, and the changelog fragment describe the view. Help vectors are rebuilt if a help topic changed.

For you: pick an entity on the full-screen canvas, set Known In to Nearby, and say whether the two marks are easy to tell apart.
