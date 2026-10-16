# 02: Three Owner Kinds And The Owner-Block Prompt

Status: done
Blocked by: 01
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Rationale: a request-shape change, a probed prompt rewrite and a two-model probe batch in one unit, with cross-cutting judgment on prose and numbers.

Parent: [Stat Pass Owner Blocks spec](../spec.md)

## What to build

The stat request tells the played persona, the loose world stats and each present entity apart, and the default Stat Updates prompt reads the same owner blocks the narrator reads.

- **The request.** Three owner kinds: `Player Character` for the played persona's stats, `Other Stats` for the loose world stats (and, under a library persona, the Custom Persona entity's stats with their keys), one key per present entity that owns stats. Key dedupe runs across all three. The schema emits one required object per owner that has stats, so a persona with no stats produces no `Player Character` object. The reply reader maps every owner key back to its targets as today.
- **The Stats chip in the stat pass** carries the loose world stats only. The entity sections it appended go away.
- **The default prompt.** The Persona chip headed `Player Character`, then the Entities chip in the In Scene scope, both with Only With Stats, Summary content, Include Traits and Stats, and Range, Descriptor and Description. Then the Stats chip headed Other Stats and the Traits chip headed Other Traits. The owner rule applies to headed blocks only; the loose block gets no ownership prose. The format section names the three key kinds. The Q76 framing stays.
- **The Settings preview.** The sample scene gains one present entity that owns a stat, so the In Scene block renders there.
- **Probes.** (Overruled by spec Q29: the entity-stats harness alone.) The entity-stats and persona-block stat harnesses gain the new prompt as an arm. Both models, in-batch controls. The Q28 bar must clear on player and entity cells. Rampage and Slime cases measure world-stat recall; that number is reported for the user's ruling and goes in the spec's Further Notes.

Rulings: Q1, Q2, Q4, Q8, Q10, Q11, Q12, Q13, Q16.

## Acceptance criteria

- [ ] A request with persona stats, loose stats and two entities yields `Player Character`, `Other Stats` and two entity objects, every key unique.
- [ ] A request whose persona owns no stats yields no `Player Character` object, and the reply reader accepts a reply without one.
- [ ] An entity named `Other Stats` gets a numbered key.
- [ ] The stat pass's Stats chip value holds world stats only.
- [ ] The default prompt's system prompt holds the four blocks in order, and the Persona block is absent when the persona owns no stats.
- [ ] The Settings preview renders both owner blocks from the sample scene.
- [ ] Probe numbers on both models clear the Q28 bar on owner cells; the world-stat recall numbers are in the spec's Further Notes.
