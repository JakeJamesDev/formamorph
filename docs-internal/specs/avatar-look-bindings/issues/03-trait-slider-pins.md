# 03: Trait Slider Pins

Status: done
Blocked by: 01, 02
Recommended model: Claude Opus 5.5 (`claude-opus-5-5`)
Reasoning effort: high

Touches the settle's switch-on order, save reading, history paging and the resolver. Precedence bugs are easy to make here.

## What to build

A trait sets a slider while it is active (Q2, Q3). An Elf trait holds Ear Shape at 1; a Human trait holds it at 0.

- A trait gains optional `morphPins` (`{ name, value }`). Set To takes any number (Q13). Trait links carry no override for it (Q20).
- Ticket 01 built the resolver (`avatarLook`) and the viewers' key reports; extend them. Ticket 02 built the shared picker.
- The resolver replaces the player's value with the winning pin, then adds stats on top. It returns, for each control, the trait that holds it.
- Precedence (Q4): the latest switch-on wins; tree order breaks a tie. `BodyRuntime.traitsOn` widens to hold traits with pins; Body picks don't change.
- The resolver treats an active trait missing from `traitsOn` as switched on after every listed one, in tree order. A loaded save shows trait looks at once.
- History paging reads the viewed snapshot's `bodies`.
- An entity reads its own traits. The played entity's own traits drive the played Persona, as with Body rows.
- **This ticket owns the trait editor's look section.** Rows of a slider (the ticket 02 picker) and its Set To value. A row whose slider the known model lacks shows "not on this model". A warning shows when another trait sets the same slider, unless both sit in one pick-one group.
- Update the glossary's Body rule to cover slider rows, and add a term for the trait rows. Update the trait docs page. Add a changelog fragment.

⚠️ Export shape: world `.json` gains `morphPins`; the save's `traitsOn` lists more traits. Name it in the landing message.

## Acceptance criteria

- [x] An active trait replaces the player's value, and a bound stat adds on top. Test `replaces the player's value while the trait is active, and a bound stat adds on top` (avatarLook.test.ts).
- [x] An inactive trait leaves the player's value. Tests `leaves the player's value with no active trait`, and `holds the player's slider while a chosen trait is active` (GameViewer, switch-off).
- [x] Of two active traits on one slider, the latest switch-on wins; two switched on together follow tree order. Tests `lets the latest switch-on win over tree order`, `breaks a tie between traits switched on together by tree order`.
- [x] A save without the trait in `traitsOn` shows its pin on load. Unit test `counts an active trait missing from the switch-on order...`; GameViewer test `shows the pin of an active trait a loaded save never listed...`. The load runs a settle that appends the trait anyway, so the unit test is the guard for the resolver rule.
- [x] Paging back to a turn before the trait switched on shows the player's value. Tests `shows the player's own value on a turn paged back...` and `reads the switch-on order the paged-back turn kept` (fails if the view reads the live `bodies`).
- [x] An entity's trait pins its own model; a played entity's trait pins the Persona. Tests `pins an entity's own model from its own trait`, `pins the played Persona from the played entity's own trait`.
- [x] The overlap warning shows for two free traits and not for a pick-one pair. Tests `names another free trait on the same slider`, `stays silent for a pick-one pair`, `counts two names on one model key as one slider` (TraitManager.sliderPins.test.tsx).
- [x] Body picks are unchanged when a pins-only trait joins `traitsOn`. Test `keeps a trait with only slider pins in the switch-on order, and leaves Body picks alone` (settle.bodies.test.ts).
- [x] Mutation: drop the trait replace, and reverse the precedence. The right tests fail each time. Drop replace: 10 tests red. Reverse precedence: 4 red. Also mutated: missing-rank first (1 red), pins out of `nextTraitsOn` (2 red), pick-one filter off (1 red), view reads live `bodies` (1 red). All restored.

For you: toggle a player-toggle Elf trait during play and confirm the ears change at once (game view).

## Landed

**Not verified**
- The ears changing in the real viewer during play. Tests read the resolved slider map; no game ran with a VRM.
- The Set To rows and the overlap note in a browser. The preview's blank world has no Avatar models, so the picker listed nothing. Only the empty section rendered: `.scratch/avatar-look-bindings-03/frames/trait-body-sliders-dark.jpg`. The rows are covered through the DOM in tests.

**For you**
- Toggle a player-toggle Elf trait during play and confirm the ears change at once (game view).
- Open a trait's Stats tab in a world with an Avatar, pick Ear Shape, and judge the Set To rows and the "Also set by" note under them.
