# 07: Praline In The Library

Status: ready-for-agent
Blocked by: 05, 06
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Seeding runs once per player and can't be redone, so its order and flags need care. Ticket 10 builds on the seam made here.

## What to build

On an NSFW build, a player's library holds Praline, and starting Sugarscape's Custom Persona offers her in the Player Avatar dropdown. On an SFW build she doesn't exist and is never fetched.

- **Seeding:** becomes a list of bundled entries, each with a fixed library id and its own one-shot flag. Existing players on NSFW builds gain Praline and keep their current default. A deleted Praline stays gone.
- **Build flag:** a build flag decides whether Praline exists, not a failed fetch. This ticket owns the flag's shape, and ticket 10 extends it for the Steam build.
- **Release swap:** the desktop, web and Android steps copy her file in. Pages stays without her.
- **Hash check:** the default-Avatar check includes her, so her unedited file can't be published.
- **Sugarscape:** the Custom Persona gains `vrmPick: { kind: 'default' }`. Use the `bundled-worlds` skill for the edit. The world file is the same on every build.

Existing players don't receive Sei (Q25).

Rulings: Q6, Q20, Q21, Q25.

## Acceptance criteria

- [ ] Each entry seeds once, and a deleted one stays gone after a reload.
- [ ] An existing library gains Praline and keeps its default.
- [ ] An SFW build makes no request for her file, tested on the build flag and not on a 404.
- [ ] A built SFW output holds no Praline file, and a built NSFW output holds both models.
- [ ] Publishing her unedited file is refused by the hash check.
- [ ] Starting Sugarscape offers the library picker, and picking Praline makes her the played Avatar. Tested on the real resolver.
- [ ] A changelog fragment is added.
- [ ] Frame: `.scratch/frames/sugarscape-picker.png`, the Player Avatar dropdown with Praline listed, at 1366.

The response must carry the export-shape reminder: the bundled Sugarscape world gains a `vrmPick`.

For you: choose Praline in Sugarscape on a release build and play a few turns.
