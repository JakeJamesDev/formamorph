# 03: Trait Slider Pins

Status: ready-for-agent
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Touches the settle's switch-on order, save reading, history paging and the resolver. Precedence bugs are easy to make here.

## What to build

A trait sets a slider while it is active (Q2, Q3). An Elf trait holds Ear Shape at 1; a Human trait holds it at 0.

- A trait gains optional `morphPins` (`{ name, value }`). Set To takes any number (Q13). Trait links carry no override for it (Q20).
- The resolver replaces the player's value with the winning pin, then adds stats on top. It returns, for each control, the trait that holds it.
- Precedence (Q4): the latest switch-on wins; tree order breaks a tie. `BodyRuntime.traitsOn` widens to hold traits with pins; Body picks don't change.
- The resolver treats an active trait missing from `traitsOn` as switched on after every listed one, in tree order. A loaded save shows trait looks at once.
- History paging reads the viewed snapshot's `bodies`.
- An entity reads its own traits. The played entity's own traits drive the played Persona, as with Body rows.
- **This ticket owns the trait editor's look section.** Rows of a slider (the ticket 02 picker) and its Set To value. A row whose slider the known model lacks shows "not on this model". A warning shows when another trait sets the same slider, unless both sit in one pick-one group.
- Update the glossary's Body rule to cover slider rows, and add a term for the trait rows. Update the trait docs page. Add a changelog fragment.

⚠️ Export shape: world `.json` gains `morphPins`; the save's `traitsOn` lists more traits. Name it in the landing message.

## Acceptance criteria

- [ ] An active trait replaces the player's value, and a bound stat adds on top.
- [ ] An inactive trait leaves the player's value.
- [ ] Of two active traits on one slider, the latest switch-on wins; two switched on together follow tree order.
- [ ] A save without the trait in `traitsOn` shows its pin on load.
- [ ] Paging back to a turn before the trait switched on shows the player's value.
- [ ] An entity's trait pins its own model; a played entity's trait pins the Persona.
- [ ] The overlap warning shows for two free traits and not for a pick-one pair.
- [ ] Body picks are unchanged when a pins-only trait joins `traitsOn`.
- [ ] Mutation: drop the trait replace, and reverse the precedence. The right tests fail each time.

For you: toggle a player-toggle Elf trait during play and confirm the ears change at once (game view).
