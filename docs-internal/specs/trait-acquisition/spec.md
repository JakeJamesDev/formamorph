# Mid-Game Trait Acquisition

Status: done
Status note: verified shipped in the 2026-08 status sweep (changelog/code evidence)

## Problem Statement

A player picks their traits at character creation and is stuck with that build for the rest of the run. Traits the world author marked as player-toggleable can only be switched off and back on if they happened to be selected on the creation screen — anything left unpicked is permanently out of reach, even though the author explicitly said the player controls it.

Underneath that, the stat maths that traits rely on is wrong at the edges. When a trait's stat change is partly or wholly refused by a stat's floor or ceiling, switching that trait off hands back the full authored amount rather than what was actually taken. A player sitting at the bottom of a stat can take a penalty trait, drop it, and come out ahead — and repeat that cycle to ratchet the stat upward indefinitely. Two stat changes on the same stat within one trait are also order-dependent, so an author's trait can silently do something different from what they wrote.

The two problems compound: opening every toggleable trait to mid-game acquisition turns a rarely-hit bug into one reachable on every toggleable trait in every world.

## Solution

Any trait the author marked as player-toggleable becomes switchable during play, whether or not it was chosen at creation. The Traits panel lists owned and acquirable traits together in authored order — once a trait can be taken at will, "owned" stops being a meaningful distinction, so the only visible difference is the checkbox state. Switching one on applies its effects exactly as choosing it at creation would have; switching it off reverses them.

Reversal becomes honest. The game records what a trait's stat change *actually* moved, not what it asked for, and reverses that. A change swallowed by a floor gives back nothing, because nothing was taken. Toggle cycles are exactly neutral.

Stat bounds — minimum, maximum, and regeneration — stop being incrementally patched and become derived: an authored base, plus the contributions of whichever traits are currently active, plus whatever the AI has moved over the course of play. Bounds cannot drift, because they are recomputed rather than accumulated.

## User Stories

1. As a player, I want to switch on a toggleable trait I did not choose at character creation, so that my build can change as my character does.
2. As a player, I want an acquirable trait to appear in the same list as the traits I already have, so that I do not have to learn a second place to look.
3. As a player, I want acquirable and owned traits ordered the way the author arranged them, so that related traits sit together.
4. As a player, I want switching on a previously-unchosen trait to apply its stat changes, so that taking it means something mechanically.
5. As a player, I want switching that trait back off to undo exactly what it did, so that experimenting with a trait costs me nothing.
6. As a player sitting at the bottom of a stat, I want dropping a penalty trait to leave that stat where it was, so that I cannot accidentally farm stat points by toggling.
7. As a player, I want toggling a trait on and off repeatedly to leave my stats exactly where they started, so that the panel is safe to play with.
8. As a player, I want a trait I acquired mid-game to still be there after saving and reloading, so that my build persists.
9. As a player, I want a trait I acquired and then dropped to remain acquirable, so that a change of mind is not permanent.
10. As a player in an exclusive trait group, I want switching on a member I did not originally choose to retire the one I did, so that the group's rule still holds.
11. As a player, I want to be able to leave an exclusive group with nothing active, so that dropping a trait does not force me into a replacement.
12. As a player, I want a trait that was never available to me to stay invisible, so that the panel shows what I can act on rather than the world's full trait list.
13. As a player, I want the AI to describe me according to the traits currently switched on, so that acquiring a trait changes how the story treats me.
14. As a player, I want a trait acquired mid-game to affect which stats are visible if the author said it should, so that its stat-toggle behaviour matches a trait chosen at creation.
15. As a player, I want a trait acquired mid-game to apply its placeholder pins from that point on, so that world text reflects my current build.
16. As a player reading back through my history, I want each past turn to show the traits I had at that turn, so that the log stays an accurate record.
17. As a player reading back through my history, I want the trait checkboxes disabled, so that I cannot change a past state.
18. As a player loading a save made before this change, I want my toggleable traits to become acquirable immediately, so that existing runs benefit without starting over.
19. As a player loading a save made before this change, I want every stat to read exactly the number it read when I saved, so that the update does not silently rebalance my character.
20. As a player, I want my character creation screen to work exactly as it did, so that nothing about starting a new game changes.
21. As a world author, I want the existing player-toggle flag to be all I set, so that making a trait acquirable is not a second decision.
22. As a world author, I want a trait I did not mark as toggleable to remain unavailable in play, so that fixed traits stay fixed.
23. As a world author, I want two stat changes on the same stat within one trait to combine to the same result regardless of the order I wrote them, so that my trait does what it says.
24. As a world author, I want a trait's stat change to be honoured in full when there is room for it, so that bounds only ever reduce an effect, never silently delete it.
25. As a world author, I want raising a stat's maximum with one trait and lowering it with another to cancel out exactly, so that combinations are predictable.
26. As a world author, I want a stat's minimum never to fall below the floor I authored, so that traits cannot take a stat outside its designed range.
27. As a world author, I want to be able to recover a stat's authored maximum after traits have moved it, so that the original design is not lost once play begins.
28. As a world author, I want stat code in the sandbox to see the same effective values it sees today, so that my existing worlds keep working unchanged.
29. As a world author, I want model morph bindings to read the same maximum they read today, so that avatar morphs behave as before.
30. As a world author editing a world mid-session, I want a trait acquired after my edit to use my edited stat changes, so that iterating on a world is not confusing.
31. As a developer, I want trait acquisition, toggling, reversal and bounds derivation reachable from a test, so that this behaviour stops being untested.
32. As a developer, I want the ratchet bug reproducible as a failing test before it is fixed, so that the guard is proven to bite.
33. As a developer, I want the exported save shape to change additively only, so that saves made before this change load without migration.
34. As a developer, I want a save made before this change to reverse a pre-existing trait using the old behaviour rather than crashing, so that the absence of a record is handled gracefully.

## Implementation Decisions

### Scope of acquisition

- Any trait carrying the existing player-toggle flag is acquirable mid-game. No new authoring flag is introduced; "the player controls this one" is treated as already meaning both directions.
- Traits without that flag that were not chosen at creation remain entirely absent from the Traits panel.
- Availability is derived from the world, so saves made before this change gain it on load with no migration and no stored flag.
- The character creation screen and its trait selection modal are unchanged.

### Trait runtime module (new)

A new pure module owns trait runtime orchestration. It operates over a small state slice — player stats, the player's trait list, the disabled-trait id list, and the new applied-value record — and exposes:

- **acquire** — first switch-on of a trait not yet in the player's list. Behaves identically to selection at creation: applies stat changes and appends the trait.
- **set enabled** — switch an existing trait on or off, including exclusive-group retirement of siblings.
- **derive effective stats** — compute effective bounds from bases and the active trait set.
- **recover bases on load** — reconstruct authored bases from a save written under the old incremental model.

The GameViewer handlers become thin wrappers over this module. This is the only new seam.

### Storage of acquired traits

- On first switch-on, the trait is appended to the player's trait list exactly as creation does. No new field, no schema change for acquisition itself.
- Switching an acquired trait back off leaves it in the list and adds its id to the disabled set — identical to a trait chosen at creation. This keeps one code path and keeps the trait's frozen stat changes stable across further toggles.
- A trait acquired mid-game freezes its stat changes from authoring **at acquisition time**, not at turn one. Only observable if the world is edited mid-session, which the editor permits.

### Derived bounds

- Minimum, maximum and regeneration become derived rather than incrementally patched: effective value equals an authored base, plus the summed contributions of all currently-active traits, plus an accumulated AI contribution.
- Each player stat gains persisted base fields for these axes, plus a separate accumulated AI maximum delta. All are optional and additive to the save shape.
- The AI max-change path writes to the AI delta rather than to the maximum directly, so the maximum stays fully derived.
- The existing authored-minimums workaround — recomputing the floor per call because live stats already carry earlier raises — is removed. It exists only because bounds were incremental.
- Effective values are what the QuickJS stat-code sandbox and model morph bindings see. The base/effective split stays an internal detail; the sandbox surface is not widened.

### Correct reversal

- A new game-state field maps trait id to the value movement that trait actually produced, written from a before/after diff at apply time.
- Switching a trait off reverses the recorded movement, not the authored stat change. A change swallowed by a bound reverses as zero.
- Only the value axis is recorded. Bounds are derived, so there is nothing to reverse on those axes — the two mechanisms do not overlap.
- When a shrinking derived maximum forces the current value down at switch-off, that clamp is folded into the same trait's recorded movement, so switching back on restores it.
- Traits applied before this change have no record. Those fall back to the old negate-the-authored-change behaviour, bug included, for that one trait. Any subsequent re-apply writes a proper record, so saves self-heal.
- Within a single application, stat changes on the same stat accumulate before clamping — matching what the bounds pass in the same function already does — which removes the order-dependence.

### Migration

- At load, bases are recovered by subtracting the authored bound contributions of every currently-active trait from the saved bounds. Recomputing effective values from the recovered bases must reproduce the saved numbers exactly.
- This is exact when the world's trait definitions are unchanged since the save. It can be off if an author edited a trait's bound deltas mid-save; this is accepted.
- No version bump. All new fields are optional and omitted when empty, following the existing convention for the disabled-trait id list.

### UI

- The Traits panel lists owned traits and acquirable traits together, sorted in authored order. Owned and unowned render identically apart from checkbox state.
- While viewing an earlier turn, only that turn's traits are listed and checkboxes stay disabled. Acquirables are not shown, since they cannot be acted on there.

### Deliberate non-changes

- Nothing is added to the AI prompt about a trait having been acquired. The trait simply appears in the trait context block on the next turn, as any toggle-on does today.
- Conflict precedence stays authored-order-based. A trait acquired late sorts by its authored position, not by when it was gained, so the editor's conflict preview continues to predict the result.
- The exclusive-group swap behaviour that already exists for chosen siblings is extended to never-chosen members without change. An exclusive group may be left with nothing active, as it already may today.

### Sequencing

Three commits, all four gates green at each:

1. Derived bounds and the player-stat shape change, including load-time base recovery.
2. The applied-value record and correct reversal.
3. Mid-game acquisition and the panel listing.

## Testing Decisions

A good test here asserts observable outcomes — the stat numbers a player ends up with, which traits appear in a list — and never the shape of the intermediate state used to get there. Tests drive the new trait runtime module through its public operations rather than reaching into how bounds are stored.

**Prior art.** The existing pure-function suites for stat changes and trait effects are the model: pure input, pure output, no mocking. The component-level harness that mounts game panels with real context providers and stubbed 3D and speech surfaces is the model for the panel test.

**Modules under test.**

- *New trait runtime module* — the primary seam. Acquiring a trait not previously held; toggling on and off; exclusive-group retirement including a never-chosen member; a group left empty; reversal after a clamped application; toggle cycles at a bound proving neutrality; order-independence of two changes on one stat; bounds derivation from base plus active traits plus AI delta; base recovery from a legacy save reproducing its saved numbers exactly; the no-record fallback path.
- *Game panels harness* — the Traits tab renders owned and acquirable traits interleaved in authored order; non-toggleable unchosen traits absent; history view listing only that turn's traits with checkboxes disabled.

**Proving the guards bite.** The ratchet has no test today, and neither does any of the orchestration. Before the fix lands, the reversal test must be shown failing against current behaviour — reinstate the bug and confirm red. A guard that has never failed is not a guard.

**Scenarios are not to be rigged.** Bound-clamping is the mechanic under test here. No test may avoid a failure by choosing a stat range wide enough that no clamp fires; the clamped cases are the point. Note that the two existing reversal tests use unclamped ranges, which is exactly why they pass today against buggy code.

**Existing tests that must change.** Several cases in the stat-changes suite currently assert the clamp-per-change behaviour being removed. Each one that changes must be called out explicitly with the reason, not quietly updated to match new output.

## Out of Scope

- Any change to the character creation screen or trait selection modal.
- Exposing base bounds, or the active trait set, to the QuickJS stat-code sandbox. If a world presents a real need for trait-awareness in stat code, that is a separate feature with its own shape.
- Telling the AI that a trait was newly acquired, or any other prompt-surface change. No probe evidence is required for this work.
- A trait cost or points budget at creation or during play. None exists today and none is added.
- Making acquisition conditional — on story state, stats, location, or anything else. Every toggleable trait is available at all times.
- Any narration or scene reaction to acquiring a trait.
- Changing conflict precedence to acquisition order.
- A version bump or any save migration beyond the load-time base recovery described above.

## Further Notes

The bug being fixed here is tracked as an open issue and was originally worked around in a world by substituting a maximum change for a starting change. The originally recorded fix shape — accumulate deltas and clamp once — addresses only the order-dependence; it cannot address the toggle ratchet, which occurs across two separate applications and so is invisible to any accumulation within one. That earlier note should be superseded once this ships.

The exclusivity decision is the largest behavioural change in this work and is worth watching in play: creation-time exclusive picks become freely reversible. For worlds that treat an exclusive group as identity — species, origin — that is a meaningful shift in what character creation means, even though it required no new code.

The authored maximum is currently unrecoverable from runtime state once a trait moves it. Deriving bounds fixes that as a side effect, which may be useful to other work later.
