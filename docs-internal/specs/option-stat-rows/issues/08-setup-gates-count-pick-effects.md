# 08: Setup Gates Count Pick Effects

Status: ready-for-agent
Blocked by: 07
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

## What to build

At setup, gates read stats the way the game will start them, so picking Bodybuilder (+3 Strength) unlocks "Carry Capacity, needs 7 Strength". Today setup gates read authored starts while play reads live stats, so the two disagree. The spec covers this in Q26a–i.

- **Gate stats.** The setup gate stats apply the Option rows, then the picked traits' rows, global and entity, through the opening steps from ticket 04. Values are clamped by the derived max. Stats turned off read as inert.
- **Own rows.** A trait's own gate never reads that trait's own rows.
- **No loops.** The settle grows from the Options and authored starts: a pick enters only when its gate holds without any pick that depends on it. A pair that only props itself up never locks in. Keep the existing tie and group rules.
- **Cascade.** Removing a pick that a gate leaned on turns the failing picks off through the existing cascade, and the cascade notice names them.
- **Readers.** Trait gates, Starting Location gates, Preset apply and check, and the Test Bench opening all read the same setup gate stats.
- **Docs.** Update the trait gate docs in `docs/` to say setup gates count picks' stat effects. Write a changelog fragment: this changes how released worlds' gates behave at setup, so it is its own entry.

## Acceptance criteria

- [ ] Bodybuilder (+3 Strength, base 4) unlocks a trait gated on Strength 7 at Enter World.
- [ ] An Option value's starting row unlocks a gated trait the same way.
- [ ] Berserker (needs Strength 7, gives −2) can be picked at Strength 7 and stays on.
- [ ] Two traits that each need the other's +3 never lock in together from base 4, through clicks or a Preset.
- [ ] A starting row above the max a pick sets is read clamped.
- [ ] Removing Bodybuilder turns the gated trait off, and the cascade notice names it.
- [ ] An entity trait gated on the entity's own stat counts that entity's picks.
- [ ] A Starting Location gated on a stat counts the picks' effects.
- [ ] Each guard goes red with its bug reinstated.

For you: Build a small chain (Bodybuilder → Carry Capacity → a second gated trait) and judge whether the cascade notice reads clearly when you remove Bodybuilder.
